# What people asked, and what the assistant could not answer.
#
# The log exists to improve the DOCUMENTATION, so this reports it that way
# rather than as traffic: questions with NO sources first, because those are
# either a page that does not exist or one retrieval cannot find, and both are
# worth an afternoon. Then anything somebody marked wrong.
#
#   .\gaps.ps1              last 30 days
#   .\gaps.ps1 -Days 7      last week
#   .\gaps.ps1 -All         everything still in the log (90-day expiry)
#
# Reads only. Nothing here deletes or edits an entry.

param(
    [int]    $Days = 30,
    [switch] $All
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "Reading the question log..." -ForegroundColor Cyan
$keys = wrangler kv key list --binding ASK_LOG --remote | Out-String | ConvertFrom-Json
if (-not $keys) { Write-Host "Nothing logged yet."; exit 0 }

$since = if ($All) { [datetime]'2000-01-01' } else { (Get-Date).AddDays(-$Days) }

# One GET per key. Fine at this scale -- a busy month here is hundreds, not
# millions -- and it keeps the script to one dependency: wrangler.
$rows = foreach ($k in $keys) {
    $raw = wrangler kv key get --binding ASK_LOG --remote $k.name 2>$null | Select-Object -Last 1
    if (-not $raw) { continue }
    try { $e = $raw | ConvertFrom-Json } catch { continue }
    if ([datetime]$e.t -lt $since) { continue }
    $e
}

if (-not $rows) { Write-Host "Nothing in that window."; exit 0 }

$asks = @($rows | Where-Object { $_.kind -eq 'ask' })
$bad  = @($rows | Where-Object { $_.kind -eq 'wrong' })
$gaps = @($asks | Where-Object { $_.n -eq 0 })

Write-Host ""
$summary = "$($asks.Count) questions, $($gaps.Count) with no source, $($bad.Count) marked wrong"
Write-Host $summary -ForegroundColor White

if ($gaps.Count) {
    Write-Host ""
Write-Host "=== ANSWERED WITH NO SOURCE -- likely documentation gaps ===" -ForegroundColor Yellow
    $gaps | Sort-Object t -Descending | ForEach-Object {
        "{0:yyyy-MM-dd}  {1,-24} {2}" -f [datetime]$_.t, $_.page, $_.q
    }
}

if ($bad.Count) {
    Write-Host ""
Write-Host "=== MARKED WRONG BY A READER ===" -ForegroundColor Red
    $bad | Sort-Object t -Descending | ForEach-Object {
        "{0:yyyy-MM-dd}  {1}" -f [datetime]$_.t, $_.q
        "              on {0}" -f $_.page
        "              said: {0}" -f ($_.a -replace '\s+', ' ')
        ""
    }
}

# Repeats matter more than one-offs: the same question twice is a page people
# expect to exist.
$repeat = $asks | Group-Object { $_.q.ToLower().Trim() } |
          Where-Object { $_.Count -gt 1 } | Sort-Object Count -Descending
if ($repeat) {
    Write-Host ""
Write-Host "=== ASKED MORE THAN ONCE ===" -ForegroundColor Cyan
    $repeat | ForEach-Object { "{0,3}x  {1}" -f $_.Count, $_.Name }
}

Write-Host ""
