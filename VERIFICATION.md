# Verification evidence — November 12, 2026

- .NET SDK 10.0.404: API and test-project build succeeded with zero warnings/errors. Six HTTP integration tests passed against an isolated PostgreSQL 17 container seeded with three synthetic records. Covers invalid ranges/limits/dates, exact totals/exception counts and date exclusion. An initial invalid-date 500 response was corrected and the complete suite rerun successfully.
- PowerShell 7: five fixture checks passed (active account, disabled licensed account, unknown evidence, inclusive inactivity threshold, invalid threshold). No tenant operations.
- React/Vite: four Node tests passed (URL validation, geometry validation, synthetic provenance, abort handling); production Vite build succeeded. No real image provider is implemented.
- npm audits: zero known vulnerabilities reported for the site and migration prototype resolved dependency trees. The initial older Cloudflare package had findings; it was replaced with the current CLI/plugin release and the final tree audited successfully. Results are point-in-time advisory checks, not security guarantees.
- NuGet vulnerable-package check including transitives: no vulnerable packages reported. Lockfiles generated.
- Cloudflare cf: static build and prebuilt deployment dry-run passed, reading static assets without uploading. No bindings, domains, database or existing site resources were changed.
- Portfolio anchor and unpublished-link/provenance checks passed. The original browser failure was resolved by running the local preview with normal local-network access. Desktop and phone frames (1440×1000 / 390×844) rendered with loaded fonts and no horizontal document overflow. Navigation and expandable details were checked on the main page; synthetic demo success and insecure-URL rejection were checked through the browser. The in-app viewport override itself did not resize the panel, so explicit iframe viewports were used for responsive layout checks.
- Maintenance report generator ran against public Smart-Brain Actions API data. Zero runs returned; the report explicitly says this is not evidence of passing checks. Read-only generation performed no commits or pushes.
- The initial GitHub-hosted tests/dependency checks, CodeQL scan and maintenance report passed. Dependency alerts and security update PRs are enabled. See DEPLOYMENT.md for source SHA, version, public URLs and run links.

## November 16 workflow expansion

28 HTTP/database integration cases passed locally against PostgreSQL 17. Covers real JWT signature/issuer/audience/expiry validation; missing tenant/role; owner spoofing; cross-tenant/owner resource boundaries; independent review; rejection/correction; stale versions; simultaneous submissions; rollback on an injected database audit-insert failure; immutable audit events; tenant-scoped duplicates; pagination; readiness; and repeatable/checksummed migrations. New records use synthetic identifiers. No historical review events were fabricated for the existing seed fixtures.

A 100,000-row temporary-table study measured the same selective aggregation at 6.647 ms without an index and 0.311 ms with a partial index, with raw plans recorded under backend/performance. This is one local sample, not production-scale evidence or a guaranteed speedup. New live hosting and provider sign-in are not claimed.
