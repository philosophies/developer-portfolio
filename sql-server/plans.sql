SET NOCOUNT ON;
-- The temporary study is deliberately separate from the three workflow fixtures.
CREATE TABLE dbo.PlanFixture (
    Id int IDENTITY PRIMARY KEY, TenantId int NOT NULL, OccurredOn date NOT NULL,
    Amount decimal(12,2) NOT NULL, Padding char(120) NOT NULL DEFAULT 'fixture'
);
WITH n AS (
    SELECT TOP (100000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_objects a CROSS JOIN sys.all_objects b
)
INSERT dbo.PlanFixture(TenantId,OccurredOn,Amount)
SELECT n % 100, DATEADD(day,n % 365,CONVERT(date,'20260101')), n % 1000 FROM n;
UPDATE STATISTICS dbo.PlanFixture WITH FULLSCAN;
SET STATISTICS IO ON;
SET STATISTICS XML ON;
SELECT SUM(Amount) AS Total FROM dbo.PlanFixture WHERE TenantId=42 AND OccurredOn >= '20261001' OPTION (MAXDOP 1);
SET STATISTICS XML OFF;
SET STATISTICS IO OFF;
CREATE INDEX IX_PlanFixture_TenantDate ON dbo.PlanFixture(TenantId,OccurredOn) INCLUDE(Amount);
UPDATE STATISTICS dbo.PlanFixture WITH FULLSCAN;
SET STATISTICS IO ON;
SET STATISTICS XML ON;
SELECT SUM(Amount) AS Total FROM dbo.PlanFixture WHERE TenantId=42 AND OccurredOn >= '20261001' OPTION (MAXDOP 1);
SET STATISTICS XML OFF;
SET STATISTICS IO OFF;
GO
