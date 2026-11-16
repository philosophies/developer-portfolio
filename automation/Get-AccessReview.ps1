[CmdletBinding()]
param(
    [Parameter(ParameterSetName='File')][string]$InputPath = "$PSScriptRoot/fixtures/users.json",
    [Parameter(Mandatory,ParameterSetName='Memory')][AllowEmptyCollection()][object[]]$Users,
    [datetime]$AsOf = '2026-11-01',
    [int]$InactiveDays = 90,
    [ValidateSet('synthetic fixture','Microsoft Graph snapshot')][string]$Source = 'synthetic fixture'
)
$ErrorActionPreference = 'Stop'
if ($InactiveDays -lt 1) { throw 'InactiveDays must be positive' }
if ($PSCmdlet.ParameterSetName -eq 'File') { $Users = @(Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json) }
$seen = @{}
foreach ($user in $Users) {
    if (-not $user.id -or $seen.ContainsKey($user.id)) { throw 'Missing or duplicate user ID' }
    $seen[$user.id] = $true
    if ($user.accountEnabled -isnot [bool]) { throw 'accountEnabled must be boolean' }
    if ($null -eq $user.licenses -or $user.licenses -isnot [array]) { throw 'licenses must be an explicit array; missing evidence cannot be treated as no licenses' }
    $reasons = @()
    if (-not $user.accountEnabled -and @($user.licenses).Count -gt 0) { $reasons += 'Disabled account retains license' }
    if (-not $user.lastSignIn) { $reasons += 'Sign-in evidence unavailable; manual review' }
    else {
        $last = [datetime]::ParseExact($user.lastSignIn, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture)
        if ($last -gt $AsOf) { throw 'Sign-in cannot be after report date' }
        if (($AsOf - $last).TotalDays -ge $InactiveDays) { $reasons += 'Inactive account; review required' }
    }
    [pscustomobject]@{ Id=$user.id; ReviewRequired=($reasons.Count -gt 0); Reasons=($reasons -join '; '); AsOf=$AsOf.ToString('yyyy-MM-dd'); Source=$Source; Action='Report only' }
}
