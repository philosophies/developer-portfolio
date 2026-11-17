-- Standalone SQL Server exercise. Synthetic records; not a second production backend.
SET NOCOUNT ON;
CREATE TABLE dbo.ReportRecord (
    Id int IDENTITY PRIMARY KEY,
    TenantId nvarchar(40) NOT NULL,
    ExternalId nvarchar(50) NOT NULL,
    OwnerId nvarchar(50) NOT NULL,
    Department nvarchar(80) NOT NULL,
    OccurredOn date NOT NULL,
    Amount decimal(12,2) NOT NULL CHECK (Amount >= 0),
    WorkflowState varchar(12) NOT NULL CHECK (WorkflowState IN ('draft','submitted','approved','rejected')),
    Version int NOT NULL CHECK (Version > 0),
    CONSTRAINT UQ_Record_TenantExternal UNIQUE (TenantId, ExternalId)
);
CREATE TABLE dbo.ReviewAudit (
    Id int IDENTITY PRIMARY KEY,
    RecordId int NOT NULL REFERENCES dbo.ReportRecord(Id),
    ActorId nvarchar(50) NOT NULL,
    Reason nvarchar(200) NOT NULL,
    PreviousAmount decimal(12,2) NOT NULL,
    CorrectedAmount decimal(12,2) NOT NULL,
    OccurredAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE TRIGGER dbo.AuditAppendOnly ON dbo.ReviewAudit
INSTEAD OF UPDATE, DELETE AS
BEGIN
    THROW 50010, 'Audit events are append-only', 1;
END;
GO
CREATE PROCEDURE dbo.CorrectRecord
    @TenantId nvarchar(40), @OwnerId nvarchar(50), @RecordId int,
    @ExpectedVersion int, @Amount decimal(12,2), @Reason nvarchar(200)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @ExpectedVersion IS NULL OR @ExpectedVersion < 1
        THROW 50001, 'A positive expected version is required', 1;
    IF @Amount IS NULL OR @Amount < 0 OR NULLIF(LTRIM(RTRIM(@Reason)), '') IS NULL
        THROW 50001, 'A non-negative amount and correction reason are required', 1;
    DECLARE @Version int, @Previous decimal(12,2), @State varchar(12);
    BEGIN TRY
        BEGIN TRANSACTION;
        SELECT @Version = Version, @Previous = Amount, @State = WorkflowState
        FROM dbo.ReportRecord WITH (UPDLOCK, HOLDLOCK)
        WHERE Id = @RecordId AND TenantId = @TenantId AND OwnerId = @OwnerId;
        IF @Version IS NULL THROW 50004, 'Record not found in owner scope', 1;
        IF @Version <> @ExpectedVersion THROW 50009, 'The record changed; reload before retrying', 1;
        IF @State = 'submitted' THROW 50008, 'A pending submission cannot be corrected', 1;
        UPDATE dbo.ReportRecord SET Amount = @Amount, WorkflowState = 'draft', Version = Version + 1
        WHERE Id = @RecordId;
        INSERT dbo.ReviewAudit (RecordId, ActorId, Reason, PreviousAmount, CorrectedAmount)
        VALUES (@RecordId, @OwnerId, @Reason, @Previous, @Amount);
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO
INSERT dbo.ReportRecord (TenantId, ExternalId, OwnerId, Department, OccurredOn, Amount, WorkflowState, Version)
VALUES ('sample-tenant','approved-001','sample-owner','Operations','2026-01-10',125.50,'approved',1),
       ('other-tenant','approved-001','other-owner','Finance','2026-01-10',900.00,'approved',1),
       ('sample-tenant','pending-001','sample-owner','Operations','2026-01-11',40.00,'submitted',1);
GO
