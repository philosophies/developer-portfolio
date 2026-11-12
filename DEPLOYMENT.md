# Published portfolio

- Live site: https://cody-developer-portfolio.jones-cody.workers.dev
- Source: https://github.com/philosophies/developer-portfolio
- Cloudflare Worker: `cody-developer-portfolio`
- Deployment version: `b3f2c4b0-87ef-48f7-ba80-f66b64df9dc4`
- Deployed application source: `d626a0fe8b2eba5c14bdbfa8e6da396de2739035`
- Published November 12, 2026, following owner approval.

The deployment serves the static portfolio, four project case studies and the synthetic Smart-Brain prototype. The .NET/PostgreSQL API is runnable locally; it is not a public hosted service. The Microsoft 365 sample uses synthetic fixtures and has no tenant connection. Existing websites, repositories, routes and domains were left unchanged.

## Project links

- [SQL case study](https://cody-developer-portfolio.jones-cody.workers.dev/projects/sql-analysis/)
- [Reporting API case study](https://cody-developer-portfolio.jones-cody.workers.dev/projects/reporting-api/)
- [Access-review sample report](https://cody-developer-portfolio.jones-cody.workers.dev/projects/access-review/)
- [Smart-Brain migration notes](https://cody-developer-portfolio.jones-cody.workers.dev/projects/smart-brain/)
- [Synthetic Smart-Brain demo](https://cody-developer-portfolio.jones-cody.workers.dev/demos/smart-brain/)

All six routes returned HTTP 200 after publication. The browser rendered the live site and the synthetic demo; the demo produced its labeled synthetic box with no console errors. Security headers, including CSP and nosniff, were checked on the published response.

## Initial hosted checks

- [Tests and dependency checks — passed](https://github.com/philosophies/developer-portfolio/actions/runs/43172896889)
- [CodeQL — passed](https://github.com/philosophies/developer-portfolio/actions/runs/43172896900)
- [Monthly maintenance report — passed](https://github.com/philosophies/developer-portfolio/actions/runs/43172945993)

Dependency alerts and security update PRs are enabled. Dependabot proposes dependency updates for human review. Scheduled reports are artifacts and summaries, not commits. There is no automatic merge, generated activity or direct scheduled push. See `REVIEW-AND-MAINTENANCE.md` for the optional schedule and remaining project milestones.

## Browser verification fix

The first preview ran without the local-network access needed by the in-app browser. Starting the same Node preview with normal local access fixed the timeout. Browser navigation, project disclosures and demo success/error paths were checked. Because the browser's resize capability did not change its real panel width, local fixed-size iframe documents provided desktop (1440×1000) and phone (390×844) responsive checks. Both loaded fonts and had matching document/content widths, with no horizontal page overflow. These are local test routes, not published functionality.
