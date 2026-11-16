$ErrorActionPreference = 'Stop'
$script:checks = 0
function Assert-That($Condition, [string]$Message) { if (-not $Condition) { throw $Message }; $script:checks++ }
function Assert-Fails([scriptblock]$Action, [string]$Pattern) {
    try { & $Action | Out-Null; throw 'Expected failure was not raised' }
    catch { if ($_.Exception.Message -eq 'Expected failure was not raised' -or $_.Exception.Message -notmatch $Pattern) { throw }; $script:checks++ }
}
function User([string]$Id, $Last = '2026-07-01T12:00:00Z') {
    @{ id=$Id; accountEnabled=$false; assignedLicenses=@(@{skuId='synthetic-license'}); signInActivity=@{lastSuccessfulSignInDateTime=$Last;lastSignInDateTime='2026-10-31T12:00:00Z'} }
}
function Response([int]$Status = 200, $Users = @(), [string]$Next = '', [hashtable]$Headers = @{}) {
    $payload=@{value=@($Users)}; if($Next){$payload['@odata.nextLink']=$Next}
    [pscustomobject]@{StatusCode=$Status;Headers=$Headers;Content=($payload|ConvertTo-Json -Depth 10 -Compress)}
}
function Context([object[]]$Responses) {
    $queue=[Collections.Generic.Queue[object]]::new();foreach($item in $Responses){$queue.Enqueue($item)}
    $calls=[Collections.Generic.List[string]]::new();$delays=[Collections.Generic.List[int]]::new()
    $request={param($Uri,$Headers) if(-not $Headers.Authorization.StartsWith('Bearer ')){throw 'Missing authorization'};$calls.Add($Uri);$queue.Dequeue()}.GetNewClosure()
    $delay={param($Seconds)$delays.Add($Seconds)}.GetNewClosure()
    [pscustomobject]@{Request=$request;Delay=$delay;Calls=$calls;Delays=$delays}
}
$token=ConvertTo-SecureString 'synthetic-test-token' -AsPlainText -Force
$salt=ConvertTo-SecureString 'synthetic-salt-for-tests-only' -AsPlainText -Force
function Snapshot($Context, [hashtable]$Options = @{}) { & "$PSScriptRoot/Get-GraphSnapshot.ps1" -AccessToken $token -IdSalt $salt -Request $Context.Request -Delay $Context.Delay @Options }
$next='https://graph.microsoft.com/v1.0/users?$skiptoken=synthetic-page-2'
$ctx=Context @((Response -Users @((User 'sample-a')) -Next $next),(Response -Users @((User 'sample-b' $null))))
$snapshot=Snapshot $ctx
Assert-That ($snapshot.Complete -and $snapshot.Users.Count -eq 2 -and $ctx.Calls.Count -eq 2) 'Pagination did not produce a complete snapshot'
Assert-That ($snapshot.Users[0].id -match '^graph-[0-9a-f]{20}$' -and $snapshot.Users[0].id -notmatch 'sample-a') 'Identifier was not pseudonymized'
Assert-That ($snapshot.Users[1].lastSignIn -eq $null) 'Failed/attempted sign-in must not substitute for successful evidence'
$report=@(& "$PSScriptRoot/Get-AccessReview.ps1" -Users $snapshot.Users -AsOf '2026-11-01' -Source 'Microsoft Graph snapshot')
Assert-That ($report[0].Reasons -match 'Inactive' -and $report[1].Reasons -match 'unavailable' -and $report[0].Source -eq 'Microsoft Graph snapshot') 'Snapshot/evaluator contract failed'
$again=Snapshot (Context @((Response -Users @((User 'sample-a')))))
Assert-That ($again.Users[0].id -eq $snapshot.Users[0].id) 'Pseudonyms must remain stable with the same salt'
$empty=Snapshot (Context @((Response)))
$emptyReport=@(& "$PSScriptRoot/Get-AccessReview.ps1" -Users $empty.Users -AsOf '2026-11-01' -Source 'Microsoft Graph snapshot')
Assert-That ($emptyReport.Count -eq 0) 'A complete empty snapshot should produce an empty report'
$ctx=Context @((Response -Status 429 -Headers @{'Retry-After'='2'}),(Response))
$null=Snapshot $ctx
Assert-That ($ctx.Calls.Count -eq 2 -and $ctx.Delays[0] -eq 2) 'Retry-After was not honored'
$ctx=Context @((Response -Status 503),(Response))
$null=Snapshot $ctx
Assert-That ($ctx.Delays[0] -eq 1) 'Missing retry header should use bounded exponential backoff'
$ctx=Context @((Response -Next 'https://untrusted.example/v1.0/users'))
Assert-Fails {Snapshot $ctx} 'pagination URL'
Assert-That ($ctx.Calls.Count -eq 1) 'Token forwarded to untrusted pagination host'
$ctx=Context @((Response -Next 'https://graph.microsoft.com/v1.0/groups'))
Assert-Fails {Snapshot $ctx} 'pagination URL'
$first='https://graph.microsoft.com/v1.0/users?$select=id,accountEnabled,assignedLicenses,signInActivity&$top=100'
$ctx=Context @((Response -Next $first))
Assert-Fails {Snapshot $ctx} 'repeated a URL'
$ctx=Context @((Response -Status 401))
Assert-Fails {Snapshot $ctx} '401'
$ctx=Context @((Response -Status 403))
Assert-Fails {Snapshot $ctx} '403'
$ctx=Context @((Response -Status 429),(Response -Status 429),(Response -Status 429))
Assert-Fails {Snapshot $ctx @{MaxRetries=2}} 'budget exhausted'
Assert-That ($ctx.Calls.Count -eq 3) 'Retry limit was not bounded'
$ctx=Context @((Response -Status 429 -Headers @{'Retry-After'='120'}))
Assert-Fails {Snapshot $ctx} 'beyond the configured budget'
$ctx=Context @((Response -Users @((User 'duplicate')) -Next $next),(Response -Users @((User 'duplicate'))))
Assert-Fails {Snapshot $ctx} 'duplicate Graph user ID'
$incomplete=User 'incomplete';$incomplete.Remove('assignedLicenses')
$ctx=Context @((Response -Users @($incomplete)))
Assert-Fails {Snapshot $ctx} 'Incomplete account/license'
$ctx=Context @((Response -Next $next))
Assert-Fails {Snapshot $ctx @{MaxPages=1}} 'page limit exceeded'
$ctx=Context @((Response -Users @((User 'a'),(User 'b'))))
Assert-Fails {Snapshot $ctx @{MaxUsers=1}} 'user limit exceeded'
$ctx=Context @([pscustomobject]@{StatusCode=200;Headers=@{};Content='invalid json'})
Assert-Fails {Snapshot $ctx} 'invalid JSON'
$ctx=Context @((Response -Status 302))
Assert-Fails {Snapshot $ctx} 'HTTP 302'
$ctx=[pscustomobject]@{Request={throw 'transport failure including synthetic-test-token'};Delay={}}
Assert-Fails {Snapshot $ctx} '^Graph transport failed; no partial snapshot returned\.$'
Write-Output "$script:checks Graph adapter checks passed (injected transport; no tenant contacted)"
