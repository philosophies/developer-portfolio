# Microsoft 365 access review

A report-only PowerShell tool for disabled accounts retaining licenses, inactivity, and missing
sign-in evidence. The evaluator works with deterministic fixtures or an in-memory snapshot from the
read-only Graph adapter.

## Try the synthetic fixtures

From the repository root, in PowerShell 7:

```powershell
./automation/Get-AccessReview.ps1 | ConvertTo-Json
./automation/Test-AccessReview.ps1
./automation/Test-GraphSnapshot.ps1
```

The fixture report uses November 1, 2026 as its explicit report date. Missing successful-sign-in
evidence is a manual-review finding, not proof of inactivity. Every output row says `Report only`;
no account, license or permission is changed.

## Read-only Graph adapter

`Get-GraphSnapshot.ps1` requests only account IDs, enabled state, assigned-license counts and
sign-in activity from the global Graph endpoint. It follows validated `@odata.nextLink` URLs, honors
`Retry-After` within a bounded retry budget, and rejects repeated pages, incomplete evidence and
partial snapshots. HTTP redirects are not followed. Tokens are never forwarded to another host or
resource path.

IDs are pseudonymized with a caller-supplied salt before the snapshot is returned. Display names,
email addresses and raw account IDs are not returned. This reduces exposure; it does not make an
organization's account activity public information. Keep snapshots private and retain the salt only
if stable comparisons are needed.

Use an authorized test tenant and an appropriately scoped access token. The request needs
user-directory read access (`User.Read.All`) and `AuditLog.Read.All` for sign-in activity, with
admin consent, an appropriate directory role and Microsoft Entra P1/P2 licensing as applicable.
Check the current
[list-users requirements](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0#example-11-get-users-including-their-last-sign-in-time)
before granting access. The script does not obtain tokens or grant permissions.

```powershell
$token = Read-Host 'Authorized Graph access token' -AsSecureString
$salt = Read-Host 'Private ID salt (at least 16 characters)' -AsSecureString
$snapshot = ./automation/Get-GraphSnapshot.ps1 -AccessToken $token -IdSalt $salt
./automation/Get-AccessReview.ps1 -Users $snapshot.Users `
    -AsOf ([DateTimeOffset]::Parse($snapshot.CapturedAt).UtcDateTime.Date) `
    -Source 'Microsoft Graph snapshot'
```

Only `lastSuccessfulSignInDateTime` is used for inactivity. Failed sign-in attempts do not
substitute for successful access, and the property is not historically backfilled. Missing evidence
stays explicit. See Microsoft's
[sign-in activity reference](https://learn.microsoft.com/en-us/graph/api/resources/signinactivity?view=graph-rest-1.0)
and [throttling guidance](https://learn.microsoft.com/en-us/graph/throttling).

## Verification and limits

Six evaluator checks and 24 injected-transport adapter checks cover normal and unknown evidence,
pagination, retry behavior, permission errors, hostile links, repeated/duplicate data, bounds,
malformed responses and the adapter/evaluator contract. These tests contact no Microsoft tenant.
Live tenant consent and a controlled tenant run remain unverified.

The adapter deliberately does not return partial results as complete. Exports belong under the
ignored `automation/exports/` directory, never in public issues, the portfolio or committed
fixtures. No export is written automatically.
