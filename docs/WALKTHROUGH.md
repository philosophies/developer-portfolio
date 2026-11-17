# Reporting workbench walkthrough

Open the [public sample](https://cody-developer-portfolio.jones-cody.workers.dev/demos/reporting/).
It uses fictional records and personas, with browser-memory changes only.

1. As Operator, open sample-002. Explain why the owner cannot approve their own submission.
2. Switch to Independent reviewer, reopen the record, enter a reason and approve. Approved totals
   increase from 210.25 to 250.25. Inspect the audit snapshots.
3. Switch to Operator and correct the approved record with a reason. Saving returns it to draft; its
   amount leaves approved totals until an independent review happens again.
4. Explain the real local API's server-side identity, owner/tenant checks, version guard and atomic
   record/audit transaction. Locate the integration test that injects an audit-write failure and
   verifies rollback. The hosted sample does not call this API or provide real sign-in.
5. Open the SQL Server exercise. Show its correction procedure, rollback test and two actual plans.
   They return the same total; explain why an index seek reads less of this particular fixture.

For a short recording, demonstrate steps 1-3, explain one failure case and show its source/test. Use
synthetic data and keep credentials out of view. This guide is an interactive walkthrough; it is not
a recording or evidence that the owner has practiced presenting it.

## Maintenance example

[Issue 20](https://github.com/philosophies/developer-portfolio/issues/20) records a latent
Smart-Brain race masked by the immediate fixture. After extracting the existing handler behavior, a
deferred adapter regression failed: editing an input cleared the display, but a late response
repopulated it. Invalidation now aborts and detaches the request. Stale successes/errors cannot
change the current result or history, even if the adapter ignores abort. See session.test.js for the
regression. This is a portfolio fix, not an employer incident.
