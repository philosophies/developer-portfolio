# Verification evidence — November 12, 2026

- .NET SDK 10.0.404: API and test-project build succeeded with zero warnings/errors. Six HTTP
  integration tests passed against an isolated PostgreSQL 17 container seeded with three synthetic
  records. Covers invalid ranges/limits/dates, exact totals/exception counts and date exclusion. An
  initial invalid-date 500 response was corrected and the complete suite rerun successfully.
- PowerShell 7: five fixture checks passed (active account, disabled licensed account, unknown
  evidence, inclusive inactivity threshold, invalid threshold). No tenant operations.
- React/Vite: four Node tests passed (URL validation, geometry validation, synthetic provenance,
  abort handling); production Vite build succeeded. No real image provider is implemented.
- npm audits: zero known vulnerabilities reported for the site and migration prototype resolved
  dependency trees. The initial older Cloudflare package had findings; it was replaced with the
  current CLI/plugin release and the final tree audited successfully. Results are point-in-time
  advisory checks, not security guarantees.
- NuGet vulnerable-package check including transitives: no vulnerable packages reported. Lockfiles
  generated.
- Cloudflare cf: static build and prebuilt deployment dry-run passed, reading static assets without
  uploading. No bindings, domains, database or existing site resources were changed.
- Portfolio anchor and unpublished-link/provenance checks passed. The original browser failure was
  resolved by running the local preview with normal local-network access. Desktop and phone frames
  (1440×1000 / 390×844) rendered with loaded fonts and no horizontal document overflow. Navigation
  and expandable details were checked on the main page; synthetic demo success and insecure-URL
  rejection were checked through the browser. The in-app viewport override itself did not resize the
  panel, so explicit iframe viewports were used for responsive layout checks.
- Maintenance report generator ran against public Smart-Brain Actions API data. Zero runs returned;
  the report explicitly says this is not evidence of passing checks. Read-only generation performed
  no commits or pushes.
- The initial GitHub-hosted tests/dependency checks, CodeQL scan and maintenance report passed.
  Dependency alerts and security update PRs are enabled. See DEPLOYMENT.md for source SHA, version,
  public URLs and run links.

## November 16 workflow expansion

28 HTTP/database integration cases passed locally against PostgreSQL 17. Covers real JWT
signature/issuer/audience/expiry validation; missing tenant/role; owner spoofing; cross-tenant/owner
resource boundaries; independent review; rejection/correction; stale versions; simultaneous
submissions; rollback on an injected database audit-insert failure; immutable audit events;
tenant-scoped duplicates; pagination; readiness; and repeatable/checksummed migrations. New records
use synthetic identifiers. No historical review events were fabricated for the existing seed
fixtures.

A 100,000-row temporary-table study measured the same selective aggregation at 6.647 ms without an
index and 0.311 ms with a partial index, with raw plans recorded under backend/performance. This is
one local sample, not production-scale evidence or a guaranteed speedup. New live hosting and
provider sign-in are not claimed.

## Workbench, integration and presentation review

- The React/TypeScript workbench passed 16 workflow-model and HTTP-boundary tests, strict type
  checking and formatting checks. Its actual HTTP adapter was also exercised against the running
  .NET/PostgreSQL application using temporary local development identities, including permission
  denials.
- The evaluator passed six checks; the read-only Graph adapter passed 24 injected-transport checks.
  These contacted no Microsoft tenant. The adapter validates pagination targets, bounds retries,
  pseudonymizes identifiers and rejects incomplete snapshots. Live consent and a controlled tenant
  run remain unverified.
- Browser review completed the synthetic create/submit/independent-review/correction flow and
  checked that totals and audit history changed correctly. A 390-pixel phone frame had matching
  content/document widths and loaded fonts.
- The source was formatted for readability. The workbench is split into typed contracts, transport,
  fixtures, components and application state. Stale selection responses and conflict recovery were
  reviewed; editable amount inputs retain their text while being entered.
- Rajdhani and IBM Plex Sans were converted from the retained licensed source fonts to WOFF2.
  Combined font bytes changed from 927,584 to 336,820. These are file sizes, not a measured
  page-load claim.
- The site build replaces only verified, allowlisted generated directories and checks its resulting
  local routes, scripts, stylesheets and fonts. A build check verified 38 references in the reviewed
  output.

The public workbench is explicitly a browser-memory simulation. The local build uses the real HTTP
client. Managed backend hosting and production provider sign-in remain separate steps; no sample is
presented as a live tenant or production system.
