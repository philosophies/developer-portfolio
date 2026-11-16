[CmdletBinding()]
param(
    [Parameter(Mandatory)][securestring]$AccessToken,
    [Parameter(Mandatory)][securestring]$IdSalt,
    [ValidateRange(0, 5)][int]$MaxRetries = 3,
    [ValidateRange(1, 60)][int]$MaxRetryDelaySeconds = 60,
    [ValidateRange(1, 1000)][int]$MaxPages = 1000,
    [ValidateRange(1, 100000)][int]$MaxUsers = 100000,
    [Parameter(DontShow)][scriptblock]$Request = {
        param($Uri, $Headers)
        Invoke-WebRequest -Uri $Uri -Headers $Headers -Method Get -TimeoutSec 30 -MaximumRedirection 0 -SkipHttpErrorCheck -ErrorAction Stop
    },
    [Parameter(DontShow)][scriptblock]$Delay = { param($Seconds) Start-Sleep -Seconds $Seconds }
)
$ErrorActionPreference = 'Stop'
function Read-Secret([securestring]$Value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
function Assert-GraphUrl([string]$Value) {
    $parsed = $null
    if (-not [uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$parsed) -or
        $parsed.Scheme -ne 'https' -or $parsed.DnsSafeHost -ne 'graph.microsoft.com' -or
        $parsed.Port -ne 443 -or $parsed.UserInfo -or $parsed.Fragment -or
        $parsed.AbsolutePath.TrimEnd('/') -ne '/v1.0/users') {
        throw 'Rejected an unexpected Graph pagination URL; token was not forwarded.'
    }
}
$plain = Read-Secret $AccessToken
$salt = Read-Secret $IdSalt
if ([string]::IsNullOrWhiteSpace($plain) -or $salt.Length -lt 16) { throw 'A token and an identifier salt of at least 16 characters are required.' }
$headers = @{ Authorization = "Bearer $plain"; Accept = 'application/json' }
$next = 'https://graph.microsoft.com/v1.0/users?$select=id,accountEnabled,assignedLicenses,signInActivity&$top=100'
$visited = [Collections.Generic.HashSet[string]]::new()
$seenIds = [Collections.Generic.HashSet[string]]::new()
$users = [Collections.Generic.List[object]]::new()
$page = 0
try {
    while ($next) {
        Assert-GraphUrl $next
        if (-not $visited.Add($next)) { throw 'Graph pagination repeated a URL; incomplete snapshot rejected.' }
        $page++
        if ($page -gt $MaxPages) { throw 'Graph page limit exceeded; incomplete snapshot rejected.' }
        for ($attempt = 0; ; $attempt++) {
            try { $response = & $Request $next $headers }
            catch { throw 'Graph transport failed; no partial snapshot returned.' }
            $status = [int]$response.StatusCode
            if ($status -in 429, 503, 504) {
                if ($attempt -ge $MaxRetries) { throw 'Graph retry budget exhausted; no partial snapshot returned.' }
                $seconds = [int][Math]::Pow(2, $attempt)
                $retry = @($response.Headers['Retry-After'])[0]
                if ($retry) {
                    $number = 0
                    $date = [DateTimeOffset]::MinValue
                    if ([int]::TryParse([string]$retry, [ref]$number)) { $seconds = [Math]::Max(1, $number) }
                    elseif ([DateTimeOffset]::TryParse([string]$retry, [ref]$date)) { $seconds = [Math]::Max(1, [int][Math]::Ceiling(($date - [DateTimeOffset]::UtcNow).TotalSeconds)) }
                    else { throw 'Invalid Graph Retry-After value; no partial snapshot returned.' }
                }
                if ($seconds -gt $MaxRetryDelaySeconds) { throw 'Graph requested a delay beyond the configured budget; retry later.' }
                & $Delay $seconds
                continue
            }
            if ($status -eq 401) { throw 'Graph authentication failed (401); obtain a fresh authorized token.' }
            if ($status -eq 403) { throw 'Graph access denied (403); check read permissions, directory role and licensing.' }
            if ($status -ne 200) { throw "Graph request failed with HTTP $status; no partial snapshot returned." }
            break
        }
        try { $payload = $response.Content | ConvertFrom-Json -ErrorAction Stop }
        catch { throw 'Graph returned invalid JSON; no partial snapshot returned.' }
        if ($null -eq $payload.value -or $payload.value -isnot [array]) { throw 'Graph returned an invalid users collection.' }
        foreach ($user in $payload.value) {
            if (-not $user.id -or -not $seenIds.Add([string]$user.id)) { throw 'Missing or duplicate Graph user ID; incomplete snapshot rejected.' }
            if ($user.accountEnabled -isnot [bool] -or $null -eq $user.assignedLicenses -or $user.assignedLicenses -isnot [array]) { throw 'Incomplete account/license evidence; check read permissions.' }
            $last = $null
            $raw = $user.signInActivity.lastSuccessfulSignInDateTime
            if ($raw) {
                try {
                    $timestamp = if ($raw -is [datetime]) { [DateTimeOffset]$raw } else { [DateTimeOffset]::Parse([string]$raw, [cultureinfo]::InvariantCulture) }
                    $last = $timestamp.UtcDateTime.ToString('yyyy-MM-dd')
                }
                catch { throw 'Invalid successful-sign-in evidence; incomplete snapshot rejected.' }
            }
            $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($salt + '|' + [string]$user.id))).ToLowerInvariant()
            $users.Add([pscustomobject]@{
                id = 'graph-' + $digest.Substring(0, 20)
                accountEnabled = $user.accountEnabled
                licenses = @($user.assignedLicenses | ForEach-Object { 'assigned-license' })
                lastSignIn = $last
            })
            if ($users.Count -gt $MaxUsers) { throw 'Graph user limit exceeded; incomplete snapshot rejected.' }
        }
        $next = [string]$payload.'@odata.nextLink'
    }
    [pscustomobject]@{ Source = 'Microsoft Graph snapshot'; CapturedAt = [DateTimeOffset]::UtcNow.ToString('O'); Complete = $true; Users = $users.ToArray() }
}
finally { $headers.Clear(); $plain = $null; $salt = $null }
