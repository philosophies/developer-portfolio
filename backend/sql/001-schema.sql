CREATE SCHEMA IF NOT EXISTS reporting;
CREATE TABLE IF NOT EXISTS reporting.entries (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 external_id text NOT NULL UNIQUE,
 department text NOT NULL CHECK (length(department) BETWEEN 1 AND 80),
 occurred_on date NOT NULL,
 amount numeric(12,2) NOT NULL CHECK (amount >= 0),
 status text NOT NULL CHECK (status IN ('valid', 'exception'))
);
CREATE INDEX IF NOT EXISTS entries_occurred_on ON reporting.entries(occurred_on);
INSERT INTO reporting.entries (external_id,department,occurred_on,amount,status) VALUES
 ('demo-001','Operations','2026-01-10',125.50,'valid'),
 ('demo-002','Operations','2026-01-11',40.00,'exception'),
 ('demo-003','Finance','2026-02-01',210.25,'valid')
ON CONFLICT (external_id) DO NOTHING;
