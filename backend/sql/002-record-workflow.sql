CREATE TABLE IF NOT EXISTS reporting.records (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id text NOT NULL CHECK(length(tenant_id) BETWEEN 1 AND 100),
 external_id text NOT NULL CHECK(length(external_id) BETWEEN 1 AND 100),
 owner_id text NOT NULL CHECK(length(owner_id) BETWEEN 1 AND 200),
 department text NOT NULL CHECK(length(department) BETWEEN 1 AND 80),
 occurred_on date NOT NULL,
 amount numeric(12,2) NOT NULL CHECK(amount>=0),
 status text NOT NULL CHECK(status IN ('valid','exception')),
 workflow_state text NOT NULL CHECK(workflow_state IN ('draft','submitted','approved','rejected')),
 version integer NOT NULL CHECK(version>0),
 UNIQUE(tenant_id,external_id), UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS records_report ON reporting.records(tenant_id,occurred_on,department) WHERE workflow_state='approved';
CREATE INDEX IF NOT EXISTS records_owner_cursor ON reporting.records(tenant_id,owner_id,id);
CREATE TABLE IF NOT EXISTS reporting.audit_log (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id text NOT NULL,record_id integer NOT NULL,
 actor_id text NOT NULL,action text NOT NULL CHECK(action IN ('create','submit','approve','reject','correct')),
 reason text,before_state jsonb,after_state jsonb NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,record_id) REFERENCES reporting.records(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS audit_record ON reporting.audit_log(tenant_id,record_id,id);
CREATE OR REPLACE FUNCTION reporting.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END; $$;
DROP TRIGGER IF EXISTS audit_immutable ON reporting.audit_log;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON reporting.audit_log FOR EACH ROW EXECUTE FUNCTION reporting.reject_audit_mutation();
-- Synthetic baseline fixtures; no historical review events are fabricated.
INSERT INTO reporting.records(tenant_id,external_id,owner_id,department,occurred_on,amount,status,workflow_state,version)
SELECT 'demo-tenant',external_id,'demo-owner',department,occurred_on,amount,status,'approved',1 FROM reporting.entries
ON CONFLICT(tenant_id,external_id) DO NOTHING;
