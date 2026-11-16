"""Rehearse recovery using disposable synthetic databases in a development container."""

import argparse
import hashlib
from pathlib import Path
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)
    print(f"PASS: {message}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True, help="Running development PostgreSQL container")
    args = parser.parse_args()
    run_id = uuid.uuid4().hex
    source = f"portfolio_recovery_source_{run_id}"
    target = f"portfolio_recovery_target_{run_id}"
    created = []

    def command(*parts, data=None):
        result = subprocess.run(
            ["docker", "exec", "-i", args.container, *parts],
            input=data, capture_output=True, timeout=90, check=False,
        )
        if result.returncode:
            # Inputs contain only generated fixture data; never accept connection secrets.
            raise RuntimeError(result.stderr.decode("utf-8", errors="replace").strip())
        return result.stdout

    def sql(database, statement):
        return command(
            "psql", "-X", "-qAt", "--set=ON_ERROR_STOP=1", "-U", "demo", "-d", database,
            data=statement.encode("utf-8"),
        ).decode("utf-8").strip()

    def fingerprint(database, table):
        # Fixed table allowlist at call sites; stable JSON includes every column and row.
        rows = sql(database, f"SELECT row_to_json(t)::text FROM reporting.{table} t ORDER BY id;")
        return hashlib.sha256(rows.encode("utf-8")).hexdigest()

    def report(database):
        return sql(database, """
            SELECT tenant_id,department,count(*),sum(amount)
            FROM reporting.records WHERE workflow_state='approved'
            GROUP BY tenant_id,department ORDER BY tenant_id,department;
        """)

    try:
        for database in (source, target):
            command("createdb", "-U", "demo", "--template=template0", database)
            created.append(database)
        for migration in sorted((ROOT / "backend" / "sql").glob("*.sql")):
            sql(source, migration.read_text(encoding="utf-8"))
        sql(source, """
            WITH inserted AS (
                INSERT INTO reporting.records
                    (tenant_id,external_id,owner_id,department,occurred_on,amount,status,workflow_state,version)
                VALUES ('recovery-fixture','draft-001','fixture-owner','Operations','2026-01-15',15.25,'valid','draft',1)
                RETURNING *
            )
            INSERT INTO reporting.audit_log(tenant_id,record_id,actor_id,action,after_state)
            SELECT tenant_id,id,owner_id,'create',to_jsonb(inserted) FROM inserted;
        """)
        before = {table: fingerprint(source, table) for table in ("entries", "records", "audit_log")}
        totals = report(source)
        old_record = int(sql(source, "SELECT max(id) FROM reporting.records;"))
        old_audit = int(sql(source, "SELECT max(id) FROM reporting.audit_log;"))
        archive = command("pg_dump", "-U", "demo", "--format=custom", "--no-owner", "--no-acl", source)
        if not archive:
            raise RuntimeError("Backup archive was empty")
        command("pg_restore", "-U", "demo", "--exit-on-error", "--no-owner", "--no-acl", "-d", target, data=archive)
        for table, digest in before.items():
            require(fingerprint(target, table) == digest, f"Restored {table} matches every fixture row")
        require(report(target) == totals, "Restored approved report totals match")
        new_record = int(sql(target, """
            INSERT INTO reporting.records
                (tenant_id,external_id,owner_id,department,occurred_on,amount,status,workflow_state,version)
            VALUES ('recovery-fixture','draft-002','fixture-owner','Operations','2026-01-16',8.50,'valid','draft',1)
            RETURNING id;
        """))
        require(new_record > old_record, "Record identity continues beyond restored rows")
        new_audit = int(sql(target, f"""
            INSERT INTO reporting.audit_log(tenant_id,record_id,actor_id,action,after_state)
            SELECT tenant_id,id,owner_id,'create',to_jsonb(r)
            FROM reporting.records r WHERE id={new_record} RETURNING id;
        """))
        require(new_audit > old_audit, "Audit identity continues beyond restored events")
        sql(target, """
            DO $$ BEGIN
                BEGIN
                    UPDATE reporting.audit_log SET reason='must fail';
                    RAISE EXCEPTION 'Expected append-only trigger to reject update';
                EXCEPTION WHEN raise_exception THEN
                    IF SQLERRM <> 'Audit events are append-only' THEN RAISE; END IF;
                END;
            END $$;
        """)
        print("PASS: Restored append-only trigger rejects audit changes")
        checks = [
            ("negative amount", "check_violation", f"UPDATE reporting.records SET amount=-1 WHERE id={new_record}"),
            ("orphan audit", "foreign_key_violation", "INSERT INTO reporting.audit_log(tenant_id,record_id,actor_id,action,after_state) VALUES ('absent',2147483647,'fixture','create','{}')"),
            ("duplicate external ID", "unique_violation", f"UPDATE reporting.records SET external_id='draft-001' WHERE id={new_record}"),
        ]
        for label, state, statement in checks:
            sql(target, f"""
                DO $$ BEGIN
                    BEGIN
                        {statement};
                        RAISE EXCEPTION 'Expected constraint rejection';
                    EXCEPTION WHEN {state} THEN NULL;
                    END;
                END $$;
            """)
            print(f"PASS: Restored constraints reject {label}")
        print("Recovery rehearsal passed: 10 checks. Synthetic fixtures only; no recovery-time objective measured.")
    finally:
        failed = sys.exc_info()[0] is not None
        cleanup_errors = []
        for database in reversed(created):
            # Only names created by this invocation are eligible for cleanup. No FORCE/disconnect.
            try:
                command("dropdb", "-U", "demo", database)
            except (RuntimeError, subprocess.TimeoutExpired) as error:
                cleanup_errors.append(f"Cleanup failed for {database}: {error}")
        for error in cleanup_errors:
            print(error, file=sys.stderr)
        if cleanup_errors and not failed:
            raise RuntimeError("Recovery checks passed, but disposable database cleanup failed")


if __name__ == "__main__":
    main()
