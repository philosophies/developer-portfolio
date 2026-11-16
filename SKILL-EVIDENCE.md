# Role evidence and remaining practice

This map links role requirements to inspectable work. It is a guide for project discussion, not a
claim of production tenure or proficiency in every technology.

| Area               | Current evidence                                                                                                                        | Still worth practicing                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SQL and reporting  | [PostgreSQL schema](backend/sql), [100,000-row query-plan study](backend/performance), scoped aggregates and database integration tests | Execute and explain equivalent T-SQL examples on SQL Server; keep engine-specific claims separate |
| .NET backend       | [Authenticated API](backend), independent review, tenant/owner checks, concurrency, transactions and failure-path tests                 | Managed provider sign-in and deployment with restricted runtime grants                            |
| Internal tools     | [Typed workbench](reporting-ui), validation, inline errors, corrections and audit timeline                                              | Observe a user completing a task and improve the confusing steps                                  |
| Microsoft 365      | [PowerShell evaluator and read-only Graph adapter](automation), bounded retry and pagination checks                                     | Authorized test-tenant verification and permissions/licensing review                              |
| Operations         | [Recovery rehearsal](backend/operations), non-root container image and database readiness endpoint                                      | Offsite backups, production restore exercises, monitoring and incident response                   |
| Delivery           | [GitHub workflows](.github/workflows), dependency checks, CodeQL, protected-branch PRs and reproducible static builds                   | Review a real failure and explain the diagnosis and fix                                           |
| Legacy maintenance | [Smart-Brain migration prototype](smart-brain-modernization), isolated detection adapter and tests                                      | Account flows, backend migration and provider integration                                         |

When preparing to apply, pick a small workflow you can run, explain a failure case, and point to the
code and evidence. Use phrases such as “built a synthetic-data demo” or “tested locally” where those
are the actual scope. Leave deployment and tenant work marked incomplete until verified.

Optional practice, when capacity allows: explain the query plan, trace one review through its audit
events, then run the recovery drill. There is no deadline or contribution schedule to maintain.
