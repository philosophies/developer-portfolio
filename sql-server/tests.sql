SET NOCOUNT ON;
EXEC dbo.CorrectRecord 'sample-tenant','sample-owner',1,1,130.75,'Checked synthetic source';
IF NOT EXISTS (SELECT 1 FROM dbo.ReportRecord WHERE Id=1 AND Amount=130.75 AND Version=2 AND WorkflowState='draft')
    THROW 51000, 'Correction state mismatch', 1;
PRINT 'PASS correction returns to draft and advances version';
IF NOT EXISTS (SELECT 1 FROM dbo.ReviewAudit WHERE RecordId=1 AND PreviousAmount=125.50 AND CorrectedAmount=130.75)
    THROW 51000, 'Missing before and after amounts', 1;
PRINT 'PASS audit preserves correction amounts';
IF (SELECT COUNT(*) FROM dbo.ReportRecord WHERE TenantId='sample-tenant' AND WorkflowState='approved') <> 0
    THROW 51000, 'Corrected draft leaked into approved reports', 1;
PRINT 'PASS corrected amount leaves approved totals';
GO
BEGIN TRY
    EXEC dbo.CorrectRecord 'sample-tenant','sample-owner',1,1,140.00,'Stale edit';
    THROW 51000, 'Stale edit unexpectedly succeeded', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50009 THROW; END CATCH;
PRINT 'PASS stale versions rejected';
BEGIN TRY
    EXEC dbo.CorrectRecord 'sample-tenant','sample-owner',1,NULL,140.00,'Missing version';
    THROW 51000, 'Null version accepted', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50001 THROW; END CATCH;
PRINT 'PASS missing version rejected';
BEGIN TRY
    EXEC dbo.CorrectRecord 'other-tenant','sample-owner',1,2,140.00,'Wrong tenant';
    THROW 51000, 'Tenant boundary failed', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50004 THROW; END CATCH;
PRINT 'PASS tenant boundary';
BEGIN TRY
    EXEC dbo.CorrectRecord 'sample-tenant','other-owner',1,2,140.00,'Wrong owner';
    THROW 51000, 'Owner boundary failed', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50004 THROW; END CATCH;
PRINT 'PASS owner boundary';
BEGIN TRY
    EXEC dbo.CorrectRecord 'sample-tenant','sample-owner',1,2,-1,'Invalid amount';
    THROW 51000, 'Invalid amount accepted', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50001 THROW; END CATCH;
PRINT 'PASS negative amount rejected';
BEGIN TRY
    EXEC dbo.CorrectRecord 'sample-tenant','sample-owner',1,2,140.00,'  ';
    THROW 51000, 'Blank reason accepted', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50001 THROW; END CATCH;
PRINT 'PASS blank reason rejected';
BEGIN TRY
    EXEC dbo.CorrectRecord 'sample-tenant','sample-owner',3,1,140.00,'Pending record';
    THROW 51000, 'Pending record changed', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50008 THROW; END CATCH;
PRINT 'PASS pending submission protected';
GO
CREATE TRIGGER dbo.FailAuditProbe ON dbo.ReviewAudit AFTER INSERT AS
BEGIN THROW 50011, 'Injected audit write failure', 1; END;
GO
BEGIN TRY
    EXEC dbo.CorrectRecord 'sample-tenant','sample-owner',1,2,140.00,'Rollback probe';
    THROW 51000, 'Failure probe unexpectedly succeeded', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50011 THROW; END CATCH;
IF NOT EXISTS (SELECT 1 FROM dbo.ReportRecord WHERE Id=1 AND Amount=130.75 AND Version=2)
    THROW 51000, 'Failed audit left a partial record write', 1;
IF (SELECT COUNT(*) FROM dbo.ReviewAudit) <> 1 THROW 51000, 'Failed transaction left an audit event', 1;
PRINT 'PASS audit failure rolls back both writes';
GO
DROP TRIGGER dbo.FailAuditProbe;
GO
BEGIN TRY
    UPDATE dbo.ReviewAudit SET Reason='Changed';
    THROW 51000, 'Audit update accepted', 1;
END TRY BEGIN CATCH IF ERROR_NUMBER() <> 50010 THROW; END CATCH;
PRINT 'PASS append-only audit';
IF @@TRANCOUNT <> 0 THROW 51000, 'A test leaked a transaction', 1;
PRINT 'PASS no leaked transactions';
GO
