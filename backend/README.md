# Enterprise Reporting API

ASP.NET Core / .NET 10 / PostgreSQL application for creating, submitting, reviewing and correcting
synthetic reporting records. Includes bearer authentication, tenant/owner boundaries, independent
review, transactional audit history, optimistic concurrency, cursor pagination, checksum-tracked
migrations, readiness checks and a reproducible query-plan study.

## Local setup

Use .NET SDK 10 and PostgreSQL 17. From the repository root:

```powershell
docker compose -p cody-portfolio-demo -f backend/compose.yaml up -d --wait
$env:ConnectionStrings__Reporting='Host=127.0.0.1;Database=reporting;Username=demo;Password=local-demo-only'
dotnet restore backend.tests/Reporting.Tests.csproj --locked-mode
dotnet run --project backend -- --migrate
dotnet test backend.tests/Reporting.Tests.csproj --no-restore
```

The password above belongs only to the local synthetic container. The migration command is explicit;
the service does not migrate a production database automatically. Applied migration checksums are
recorded and edits are rejected; add a new SQL file for schema changes. Checksums normalize
Windows/Linux line endings. The original three synthetic fixtures are retained as a documented
baseline without inventing historical review events.

## Identity and local development

All `/api` routes require a signed bearer token with `sub`, `tenant_id` and `role` claims. Roles are
`operator` and `reviewer`. The application does not issue access tokens or store passwords.
Configure a trusted OIDC/OAuth provider for a deployed service. The JWT middleware validates
signatures, issuer, audience and expiry. Owner and tenant IDs come from trusted claims, never
request fields. Unrecognized JSON fields are rejected.

For local development, ASP.NET Core supports `dotnet user-jwts`. Set
`ASPNETCORE_ENVIRONMENT=Development`, then create local development tokens using
`dotnet user-jwts create --project backend/Reporting.Api.csproj --name demo-owner --claim tenant_id=demo-tenant --role operator --audience http://localhost:5080 --valid-for 1h`.
Create a second token with a different name and `--role reviewer`. Run
`dotnet run --project backend --urls http://localhost:5080`. Treat the output tokens as credentials;
do not commit or paste them into issues. These development tokens are not a production identity
system. Integration tests use separate signing keys confined to the test fixture and exercise the
real JWT validation middleware.

Production startup requires `Authentication__Schemes__Bearer__Authority` (HTTPS) and
`Authentication__Schemes__Bearer__Audience`. Configure the provider to issue the documented claims.
A tenant with an operator and a distinct reviewer is required for an end-to-end review. There is no
anonymous write route, fixed application token, test-login endpoint or production authentication
bypass.

## Workflow and API

| Route                                                     | Behavior                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /health`                                             | Liveness; no authentication                                                      |
| `GET /health/ready`                                       | Database/schema readiness; no authentication                                     |
| `GET /api/records?limit=50&afterId=0`                     | Owner-scoped list, or same-tenant reviewer list; limit 1–100                     |
| `GET /api/records/{id}`                                   | Scoped record; unauthorized resource lookups return 404                          |
| `POST /api/records`                                       | Create an owned draft, version 1                                                 |
| `POST /api/records/{id}/submit`                           | Owner submits a draft with `expectedVersion`                                     |
| `POST /api/records/{id}/review`                           | Different same-tenant reviewer approves/rejects with reason and expected version |
| `POST /api/records/{id}/corrections`                      | Owner corrects draft/rejected/approved records with reason; returns to draft     |
| `GET /api/records/{id}/history`                           | Ordered audit events within the same resource boundary                           |
| `GET /api/reports?from=2026-01-01&to=2026-12-31&limit=50` | Aggregates approved records only, scoped by tenant and owner/reviewer            |

Create body:
`{"externalId":"sample-001","department":"Operations","occurredOn":"2026-01-10","amount":12.50,"status":"valid"}`.
Business status is `valid` or `exception`, separate from workflow state. Submission body:
`{"expectedVersion":1}`. Review body:
`{"expectedVersion":2,"approve":true,"reason":"Checked source fixture"}`. Correction body adds
`expectedVersion` and `reason` to department/date/amount/status fields; it cannot change ownership
or external ID.

Valid transitions: draft → submitted → approved/rejected; correction → draft. Pending submissions
cannot be edited. Corrected approved records leave report totals until independently approved again.
Stale versions and invalid transitions return 409; duplicate external IDs are unique within a
tenant. Record and audit writes commit together or both roll back. Database row locks serialize
concurrent edits; version comparison prevents silently overwriting stale clients. Audit events
contain actor, action, reason, timestamp and before/after snapshots. Database triggers reject audit
UPDATE/DELETE, but database administrators still control storage; this is not a tamper-proof ledger.

Anonymous/invalid tokens return 401; missing roles/tenant or self-approval return 403. Requests are
bounded to 64 KiB and 120 authenticated requests per subject/tenant per minute. Logs record IDs,
versions and transitions rather than tokens or full request bodies.

## Tests and SQL evidence

28 integration cases passed locally against PostgreSQL 17, covering
signed/expired/tampered/wrong-issuer/wrong-audience tokens, missing tenant/roles, ownership
spoofing, cross-owner/tenant access, independent review, correction/rejection, stale versions,
concurrent submissions, transactional rollback on an injected database audit failure, append-only
enforcement, duplicate IDs, invalid values, pagination and migration checksums.

See [performance/README.md](performance/README.md) for a 100,000-row temporary-data query-plan
comparison and raw EXPLAIN ANALYZE/BUFFERS evidence. This is a single local measurement, not a
production performance claim. SQL Server/T-SQL execution evidence remains a separate milestone.

## Deployment boundaries

The portfolio hosts static case studies; this API is not currently a publicly hosted service.
`Dockerfile` provides a non-root .NET runtime image. Build with
`docker build -t reporting-api backend`. Apply migrations as a separate release step, then start the
image with a managed PostgreSQL connection string, trusted identity-provider settings,
TLS/reverse-proxy configuration, restricted database grants, backups and monitoring. Never expose
the local demo database port or development signing keys publicly.

Before public backend deployment, select a PostgreSQL host and identity provider, approve hosting
costs where applicable, test backup/restore and verify the runtime database role cannot change the
schema or audit history. The companion reporting workbench provides a typed local API interface and
a separate public sample mode. Managed identity-provider sign-in and broader operational testing
remain next steps. No employer data or real tenant exports are included.
