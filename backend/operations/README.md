# PostgreSQL recovery rehearsal

A backup is useful only if it restores something usable. This drill creates two disposable databases
inside a development PostgreSQL container, loads the repository's SQL schema and synthetic fixtures,
then uses `pg_dump` and `pg_restore` to move them into a fresh database.

## Run

Start the local database from `backend/` with `docker compose -p cody-portfolio-demo up -d`. From
the repository root, with Python 3 and Docker available:

```sh
python backend/operations/rehearse_recovery.py --container cody-portfolio-demo-postgres-1
```

The container must be a development PostgreSQL instance with the local `demo` administration role.
The script takes no passwords or connection strings. It creates random database names, reads only
its own synthetic source database, keeps the archive in memory, and drops only databases created by
that invocation. It does not read or restore over the existing `reporting` database. Run it only in
a development container where creating and dropping disposable databases is appropriate.

The same command runs in the backend CI job against the ephemeral PostgreSQL service. Its output is
retained in the backend evidence artifact. A failure exits nonzero and blocks that job.

## What passes

Ten checks verify:

- Every restored row and column in `entries`, `records` and `audit_log` matches the source, using
  ordered JSON fingerprints.
- Approved report aggregates match by tenant and department.
- Record and audit identity sequences advance beyond the restored IDs.
- The append-only audit trigger still rejects updates.
- Negative amounts, orphan audit events and duplicate tenant/external IDs are rejected.

The fixture audit events describe fixture creation performed during the rehearsal. They do not
represent historical user activity. Failed SQL probes run in subtransactions and cannot leave
partially applied constraint tests behind.

## If it fails

Keep the failure output and resolve the first database error before rerunning. A row mismatch means
the restored fixture differs; a constraint failure means recovered data protections need attention.
A cleanup failure can leave a disposable database behind. Inspect its exact generated name and
active connections before removing it; the script does not force-disconnect sessions.

## Scope

This is a same-container PostgreSQL 17 logical recovery check using the repository's SQL schema. It
does not execute the application's migration runner or recover its migration ledger. Existing
integration tests cover that runner separately. It does not verify production ownership/grants,
encrypted offsite storage, point-in-time recovery, host loss, restore duration, managed-service
behavior or a production recovery objective. Those require a separately configured deployment and
recovery environment. Never substitute this fixture drill for a production backup policy.
