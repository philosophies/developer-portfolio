# Cody Jones — software developer portfolio workspace

SQL, backend and internal-tools development portfolio. Created November 12, 2026. Updated November
16 with a transactional record-review workflow.

**[Open the live portfolio](https://cody-developer-portfolio.jones-cody.workers.dev)** ·
[Deployment and hosted checks](DEPLOYMENT.md)

Projects: `site/` separate portfolio, `backend/` reporting API, `reporting-ui/` interactive
workbench, `automation/` read-only Microsoft 365 review demo, `smart-brain-modernization/` isolated
migration prototype. Existing repositories and websites are unchanged.

## Scope

The projects use synthetic fixtures and are separate from employer systems. The reporting API
includes authenticated record review and corrections; the Graph integration remains report-only, and
the React detector is synthetic. Existing source credits and font licenses are retained. See each
project README for implementation limits and setup.

## Projects

- [Reporting API](backend/README.md): ASP.NET Core / PostgreSQL, authenticated review/correction
  workflow, transactional audit history, schema migrations, 28 HTTP/database integration cases and a
  reproducible index study and a ten-check logical recovery rehearsal.
- [Reporting workbench](reporting-ui/README.md): typed React client, role-aware workflow, audit
  timeline and a credential-free hosted sample.
- [Access-review tool](automation/README.md): report-only evaluator and a read-only Graph adapter
  with bounded retries, validated pagination and pseudonymized output. Live tenant verification
  remains separate.
- [Smart-Brain migration](smart-brain-modernization/README.md): React/Vite prototype with synthetic
  sample selection, export, session history and nine tests. Original app unchanged.
- [Portfolio](site/README.md): static Cloudflare site with four project case studies and the
  synthetic React demo.

See [role evidence and remaining practice](SKILL-EVIDENCE.md),
[maintenance and milestones](REVIEW-AND-MAINTENANCE.md), [repository review](REPOSITORY-REVIEW.md),
[verification](VERIFICATION.md) and [security boundaries](SECURITY.md). Repository:
https://github.com/philosophies/developer-portfolio. No automated direct pushes or
activity-generating commits are included. Dependabot proposes real dependency PRs; merges remain
manual.

[SQL Server exercise and actual plans](sql-server/README.md) · [Walkthrough](docs/WALKTHROUGH.md) ·
[Practice](practice/README.md)
