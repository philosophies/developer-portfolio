$ErrorActionPreference = 'Stop'
$rows = @(& "$PSScriptRoot/Get-AccessReview.ps1")
if ($rows.Count -ne 3) { throw 'Expected three users' }
if ($rows[0].ReviewRequired) { throw 'Active user incorrectly flagged' }
if ($rows[1].Reasons -notmatch 'Disabled account retains license' -or $rows[1].Reasons -notmatch 'Inactive') { throw 'Expected both findings' }
if ($rows[2].Reasons -notmatch 'unavailable') { throw 'Unknown evidence must require review' }
$boundary = @(& "$PSScriptRoot/Get-AccessReview.ps1" -AsOf '2026-11-01' -InactiveDays 123)
if ($boundary[1].Reasons -notmatch 'Inactive') { throw 'Inactivity boundary must be inclusive' }
try { & "$PSScriptRoot/Get-AccessReview.ps1" -InactiveDays 0; throw 'Expected rejection' } catch { if ($_.Exception.Message -eq 'Expected rejection') { throw } }
try {
    & "$PSScriptRoot/Get-AccessReview.ps1" -Users @([pscustomobject]@{id='missing-license-evidence';accountEnabled=$false;licenses=$null;lastSignIn=$null})
    throw 'Expected missing-license rejection'
} catch {
    if ($_.Exception.Message -notmatch 'explicit array') { throw }
}
Write-Output '6 access review checks passed'

