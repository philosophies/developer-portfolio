# Publishing and maintenance

Publication was approved on November 12, 2026. Repository: `philosophies/developer-portfolio`. Separate Cloudflare Worker: `cody-developer-portfolio`. Existing websites and repositories remain unchanged. The following checklist documents the intended publication and maintenance process.

## Publication checklist

1. Review the public wording in `site/index.html`, particularly background and attribution. Review and understand each demo before describing personal implementation experience.
2. Approve repository creation, visibility, and the exact Cloudflare deployment. The owner approved a public repository and separate public static portfolio. Do not publish private review notes, tokens, tenant exports, or the `work/` directory.
3. GitHub access was refreshed using the existing Git Credential Manager sign-in. Credentials remain in memory and are not committed. Cloudflare CLI account access was verified; reauthenticate if it expires.
4. Create the new repository and publish this source in one meaningful initial change with AI assistance disclosed. Set the default branch to `main`. Project/source links and case studies are included; the prototype is built from source into the static site.
5. Enable Actions and Dependabot. Run CI, CodeQL and the maintenance workflow manually once. Require passing tests and review before merging. CodeQL requires an eligible public repository or licensed private-repository scanning. The initial CI, CodeQL and maintenance-report runs passed; see DEPLOYMENT.md.
6. From `site/`, with supported Node installed: `npm ci`, `npm --prefix ../smart-brain-modernization ci`, `npm run check`, `npm run build`, then `npm run deploy`. Use `cf`; do not add a Wrangler configuration. The deployment command uses the prebuilt production output. The only intended new resource is the named static Worker; no custom domain or existing site route is changed.
7. Verify the returned public URL, desktop/mobile layout, links and security headers. Record the deployment version and actual URL. Cloudflare preview-only build checks are not proof of a live deployment. Roll back using the previous deployment version if needed; leave existing sites alone.

Node: use 24.22.0 or a compatible supported version listed by the installed `cf` package. .NET: SDK 10.0. PostgreSQL: 17. PowerShell: 7. Lockfiles are included. Portfolio preview: `node preview.mjs` from `site/`, then open the printed localhost URL on the same computer. The source HTML can also be opened directly beside its stylesheet.

## Optional maintenance rhythm

| When | Automatic work | Human involvement |
|---|---|---|
| Each PR or push to main | Backend integration tests, migration tests/build, PowerShell checks, portfolio build, dependency advisory checks and CodeQL | Review only when ready; no automatic merge |
| Monthly, first day | CI at 14:23 UTC; read-only maintenance report at 14:43 UTC; Dependabot checks monthly | Optional short review of failures and dependency PRs |
| Monthly, second day | CodeQL at 14:53 UTC | Review actionable findings |
| When capacity allows | No scheduled development work | Pick one small improvement, explain the tradeoff and add a regression check |

Schedules are UTC: 14:23 is 9:23 a.m. Eastern in standard time and 10:23 a.m. in daylight time. Exact execution may be delayed. Public-repository scheduled workflows can be disabled after inactivity; manual dispatch remains available. No schedule guarantees continuous monitoring. Reports are retained as workflow summaries/artifacts, not committed to inflate activity.

Dependabot opens genuine dependency PRs. No workflow directly pushes generated code, makes empty commits, backdates activity, or auto-merges. A future generated-source update must have an explicit source, reproducible generator, meaningful diff, clear provenance and separately approved PR workflow. No such scheduled push is enabled here.

You can pause all scheduled workflows and return later. There are no contribution quotas, deadlines or expected weekly hours.

## Next development milestones

- SQL Developer: document query plans with a larger synthetic fixture, compare indexes, add reproducible performance evidence. Avoid invented production-scale claims.
- .NET / backend: add an authenticated test-only write flow with transactional audit records, ownership checks and failure-path tests; then evaluate hosting separately from the static site.
- Internal Tools: implement a read-only Graph adapter in a test tenant, including pagination, throttling and permission documentation. Keep public fixtures synthetic.
- Smart-Brain: follow the separately reviewed PR sequence in its README. The current prototype does not implement the legacy account flows or real detection.

Sources for operating details: [Cloudflare project builds](https://developers.cloudflare.com/cf/projects/), [ASP.NET integration testing](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0), [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
