[CmdletBinding()]
param([string]$InputPath = "$PSScriptRoot/fixtures/users.json", [datetime]$AsOf = '2026-11-01', [int]$InactiveDays = 90)
$ErrorActionPreference = 'Stop'
if ($InactiveDays -lt 1) { throw 'InactiveDays must be positive' }
$users = @(Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)
$seen = @{}
foreach ($user in $users) {
    if (-not $user.id -or $seen.ContainsKey($user.id)) { throw 'Missing or duplicate user ID' }
    $seen[$user.id] = $true
    if ($user.accountEnabled -isnot [bool]) { throw 'accountEnabled must be boolean' }
    $reasons = @()
    if (-not $user.accountEnabled -and @($user.licenses).Count -gt 0) { $reasons += 'Disabled account retains license' }
    if (-not $user.lastSignIn) { $reasons += 'Sign-in evidence unavailable; manual review' }
    else {
        $last = [datetime]::ParseExact($user.lastSignIn, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture)
        if ($last -gt $AsOf) { throw 'Sign-in cannot be after report date' }
        if (($AsOf - $last).TotalDays -ge $InactiveDays) { $reasons += 'Inactive account; review required' }
    }
    [pscustomobject]@{ Id=$user.id; ReviewRequired=($reasons.Count -gt 0); Reasons=($reasons -join '; '); AsOf=$AsOf.ToString('yyyy-MM-dd'); Source='synthetic fixture'; Action='Report only' }
}
