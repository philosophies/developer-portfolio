# Reporting workbench

A React + TypeScript interface for the reporting API: create a draft, submit it, review it as a
different person, make a correction, and inspect the audit trail.

There are two explicit modes:

| Mode             | Data and identity                                              | Purpose                                                          |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Local API client | Calls the .NET API through `/api`; bearer token held in memory | Exercise the real backend with local development identities      |
| Hosted sample    | Invented records and two fictional personas, in browser memory | Explore the workflow without credentials or a backend connection |

The public sample never asks for an access token. Reloading or resetting restores its seed records.
Seed states do not invent past audit events; events appear only for actions performed in the sample.

## Run locally

Start and migrate the API using [its setup guide](../backend/README.md). Create an operator token
and an independent reviewer token with the documented development tool. Then:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (port 5174). The development proxy forwards only `/api` to
`http://127.0.0.1:5080`. Connect with a development token, exercise the workflow, then disconnect.
Tokens are neither logged nor stored in local/session storage. Client-side role labels are display
hints; the server is authoritative.

```sh
npm run typecheck
npm test
npm run build
npm run build:portfolio
```

The last command deliberately builds the synthetic sample at `/demos/reporting/`. The normal build
retains the real HTTP adapter. It needs a trusted same-origin `/api` backend if deployed; public
backend hosting and production provider sign-in are not configured by this project.

## Code map

- `App.tsx` owns connection state, selection and mutations.
- `components.tsx` contains the queue, form, detail view, summaries and audit timeline.
- `contracts.ts` defines domain types and shared input rules.
- `http.ts` validates API responses and maps failures to useful errors.
- `fixture.ts` provides the browser-only sample using the same client interface.

The 16 tests cover the workflow model and HTTP boundary, including stale versions, self-approval
prevention, pagination, invalid data, credential handling, malformed responses and server/network
errors. They complement the backend's PostgreSQL integration tests; they are not a claim of
production browser coverage.

Headings use Rajdhani and body text uses IBM Plex Sans, served locally as WOFF2. Font sources and
OFL licenses are retained in `site/fonts`. The layout uses native form controls, visible focus
states, readable status labels, responsive panels and reduced-motion support. Source formatting is
checked in CI.

## Check the real HTTP boundary

`scripts/api-smoke.ts` accepts local development operator/reviewer tokens on stdin. With the .NET
service running on loopback port 5080, it checks real create, submission, independent approval,
correction, totals, audit history and permission failures using the same `HttpClient` as the
interface. It does not write tokens to files or arguments. The local smoke run passed against
PostgreSQL; it is separate from the deterministic unit tests in CI. This does not claim a hosted
production API or identity-provider deployment.
