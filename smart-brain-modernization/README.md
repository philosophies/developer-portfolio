# Smart-Brain modernization — phase 1 prototype

Source reviewed: https://github.com/philosophies/Smart-Brain at
bd944c2d5baf4729dc5a0274a02c996428ff6cc7. The existing React 16 / react-scripts 1 frontend and
Express/Knex backend remain unchanged. The reviewed code uses a local database configuration, open
CORS, profile lookup by supplied ID and an image counter updated from a supplied ID without
authentication middleware. Vendored API node_modules are tracked. The Clarifai key is a placeholder
in the reviewed controller, not a confirmed leaked key.

This React/Vite migration prototype covers one focused interaction rather than replacing the full
application. No original source is copied. It separates URL validation, normalized bounding boxes
and a cancellable detector adapter. The adapter always returns a synthetic box, does not fetch
images, and performs no facial recognition. The interface clearly labels this.

Run `npm ci`, `npm test`, `npm run build`, then `npm run dev`. Node 22.18+ required. Tests cover
insecure URLs, credentials, malformed geometry, cancellation, and fixture provenance. No API keys or
external services are required.

Next PR sequence, each separately reviewed: (1) remove tracked node_modules and inventory licenses,
(2) replace unsupported dependencies with lockfile updates and regression tests, (3) add PostgreSQL
schema migrations and transactions for registration, (4) implement authenticated sessions, ownership
checks, password hashing, rate limiting and restricted CORS, (5) integrate server-side provider with
timeouts and explicit response mapping, (6) migrate React screens and perform end-to-end tests. Do
not deploy the legacy API as-is. Tutorial-like source conventions do not establish authorship;
retain upstream credits where confirmed by the owner.

## Completed sample workflow

Choose a one-box, two-box or empty synthetic response, run it, inspect the last five completed
samples, download a result as JSON, or clear the session. The export identifies its synthetic source
and excludes the entered URL. History is memory-only and disappears on reload. Nothing is sent to an
image provider. Nine checks cover geometry, input validation, fixtures, bounded history and request
cancellation.

Issue 20 documents a latent stale-response race reproduced with a deferred adapter after extracting
the original handler behavior. Input/sample edits and session clear now abort and invalidate
requests; late successes and failures cannot repopulate the display. The immediate fixture had
masked this case. Account flows and the server/provider migration remain unfinished.
