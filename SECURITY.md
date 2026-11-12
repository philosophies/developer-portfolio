# Security scope

All fixtures are synthetic. Do not add employer scripts, tenant exports, real account information, credentials or face images. The Microsoft 365 demo is report-only. The reporting API is a local unauthenticated read-only demonstration and is not approved for public exposure. Smart-Brain's new adapter is synthetic and does not call an image provider.

Dependency checks and static analysis supplement review; passing them is not a security guarantee. No secrets are required for the static site. GitHub Actions uses read-only contents access except for CodeQL security-result uploads. Pull-request code does not receive deployment credentials. There is no automatic deployment workflow or automatic merge.

Before publishing, enable GitHub's supported secret scanning and private vulnerability reporting where available. Review findings privately; never paste credentials into issues. Lockfiles and fixed Action revisions make changes reviewable. Dependabot is configured for monthly PRs.
