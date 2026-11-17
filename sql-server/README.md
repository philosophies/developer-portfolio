# SQL Server correction exercise

A small, standalone T-SQL counterpart to the reporting workflow. It demonstrates a stored procedure,
owner/tenant filtering, expected versions, transactions, rollback and append-only audit records. It
does not replace the PostgreSQL API or implement identity-provider authentication. A caller-supplied
owner or tenant parameter is not proof of identity; an application must derive those from a trusted
session before using such a procedure.

## Run

Requires Docker and Python 3. The container uses a pinned Microsoft SQL Server 2022 Developer image.
Developer Edition is for non-production use. Read and authorize the applicable license first:

```sh
python sql-server/run_lab.py --accept-license
```

The explicit flag records the caller's authorization to start the licensed non-production container.
The runner publishes no ports, mounts no host data, generates an ephemeral administration password,
creates its own database and removes only the container it created. Credentials are passed through
environment variables and are not written into evidence. The local SQL tool trusts the self-signed
certificate only for its connection inside this disposable container; this is not a production TLS
configuration. No existing SQL Server or PostgreSQL database is touched.

## Inspect

- `schema.sql`: three synthetic records, a correction procedure and append-only audit trigger.
- `tests.sql`: 13 checks, including missing/stale versions, scoped lookups, validation,
  pending-record protection, audit-write failure rollback and transaction cleanup.
- `plans.sql`: separate 100,000-row synthetic fixture and the same aggregation before/after
  indexing.
- `evidence/`: actual plans, IO, expected-result output, engine version and image digest from a
  local run.

The local plans changed from a clustered index scan to an index seek. Both returned **122216.00**;
reported logical reads changed from **1860 to 4**. These are one fixture/run's observations, not a
production speedup claim. The XML files include actual runtime counters and can be opened as query
plans in SQL Server tools. CI reruns the exercise and uploads fresh evidence; it does not commit it.

The rollback test installs a temporary failure trigger in the disposable database, attempts a
correction, and verifies that neither half of the write persists. The trigger is removed afterward.
The stored procedure is not a complete review application: there is no SQL Server HTTP API,
production authorization service, concurrent-session test, managed backup policy or deployment here.

[Microsoft container setup and licensing guidance](https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-docker?view=sql-server-ver16)
