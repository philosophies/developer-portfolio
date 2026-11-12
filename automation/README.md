# Microsoft 365 access-review demo

AI-assisted, synthetic-data portfolio demonstration. No tenant connection, real users, credentials, license changes, or permission changes.

Run `./Get-AccessReview.ps1 | ConvertTo-Json` in PowerShell 7. Run `./Test-AccessReview.ps1` for deterministic checks. The report date is explicit so outputs are reproducible. Missing sign-in evidence triggers review rather than an assumption of inactivity. Findings are recommendations for a human reviewer, never actions.

Future Graph adapter (not implemented): delegated read-only User.Read.All and AuditLog.Read.All with admin consent as required; fetch only selected fields, follow @odata.nextLink, honor Retry-After for 429, redact identities, record snapshot time, and map missing sign-in evidence explicitly. Validate licensing and permissions in a test tenant. Keep the adapter separate from the pure evaluation step. Never put tenant data in this repository or public reports.
