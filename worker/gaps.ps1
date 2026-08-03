# What people asked, and where the documentation let them down.
#
# The log exists to improve the DOCUMENTATION, so this reports it that way
# rather than as traffic.
#
# WHY THIS WAS REWRITTEN. The first version equated "the answer cited no
# source" with "documentation gap" and listed every one. Caddie is deliberately
# allowed to chat, so that list came out as: "what up", "hello bro", "ur sexy",
# "could you get me a coffee", and thirty variations of "who is <colleague>".
# Real gaps were in there, buried, and the genuinely valuable signal -- the same
# question asked thirteen times -- was last on the page. Reporting everything
# equally is the same as reporting nothing.
#
# So this version ranks by what is worth acting on:
#   1. Questions asked MORE THAN ONCE          - a page people expect to exist
#   2. Unanswered questions that look like WORK - the actual gaps
#   3. Answers a reader marked wrong           - excluding outages, see below
#   4. Chatter                                  - counted, not listed (-Chatter shows it)
#
# A question counts as work if it names a command the suite actually has (read
# from the generated command library, so it can never drift) or uses drafting
# vocabulary. Everything else is chatter. The classifier is deliberately
# generous towards "work": a false positive costs one line of reading, a false
# negative hides a real gap.
#
#   .\gaps.ps1              last 30 days
#   .\gaps.ps1 -Days 7      last week
#   .\gaps.ps1 -All         everything still in the log (90-day expiry)
#   .\gaps.ps1 -Chatter     also list what was filtered out, to check the filter
#
# Reads only. Nothing here deletes or edits an entry.

param(
    [int]    $Days = 30,
    [switch] $All,
    [switch] $Chatter
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# ---- the suite's real command names, from the generated library ------------
# Using the generated file rather than a hand-list means a new command is
# recognised here the moment it is documented, with nothing to maintain.
$commandNames = @()
$cmdJs = Join-Path $PSScriptRoot '..\assets\js\commands.js'
if (Test-Path $cmdJs) {
    try {
        $txt  = Get-Content $cmdJs -Raw
        $json = ($txt -replace '(?s)^.*?window\.WSY_COMMANDS\s*=\s*', '') -replace ';\s*$', ''
        $commandNames = ($json | ConvertFrom-Json).n
    } catch { }
}

# Vocabulary that marks a question as being about the work, not about Caddie.
$draftingWords = @(
    'lot','layer','text','mtext','dimension','dim','drawing','plot','sheet','layout',
    'viewport','scale','block','contour','easement','boundary','cadastr','survey',
    'annotat','label','hatch','polyline','xref','template','title block','titleblock',
    'plan','detail','profile','alignment','tin','surface','elevation','level','datum',
    'command','install','ribbon','panel','toolbar','shortcut','alias','pgp','style',
    'font','print','pdf','export','import','geofetch','fetch','tree','curve','table',
    'north','bearing','area','offset','trim','snap','osnap','wipeout','leader'
)

function Test-IsWork([string]$q) {
    if (-not $q) { return $false }
    $s = $q.Trim()
    if ($s.Length -lt 12) { return $false }        # "heeey", "aiden?", "what up"

    # Names a real command -> unambiguous. Word-boundary match so "dim" does not
    # fire on "dimension" being absent, and so ALAB matches "alab" typed lower.
    foreach ($c in $commandNames) {
        if ($s -match ('(?i)\b' + [regex]::Escape($c) + '\b')) { return $true }
    }
    foreach ($w in $draftingWords) {
        if ($s -match ('(?i)' + [regex]::Escape($w))) { return $true }
    }
    return $false
}

# The worker returns this sentence when the model call itself failed. A reader
# marking THAT as wrong is reporting an outage, not a documentation error, and
# mixing the two makes both harder to see.
function Test-IsOutage([string]$a) {
    return $a -and ($a -match '(?i)fallen over at my end|something went wrong at my end')
}

# ---- read the log ----------------------------------------------------------
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
    if (-not $e.t) { continue }
    try { if ([datetime]$e.t -lt $since) { continue } } catch { continue }
    $e
}

if (-not $rows) { Write-Host "Nothing in that window."; exit 0 }

$asks    = @($rows | Where-Object { $_.kind -eq 'ask'   -and $_.q })
$flagged = @($rows | Where-Object { $_.kind -eq 'wrong' -and $_.q })

# Classify explicitly rather than with two opposed Where-Object filters. The
# negated form -- Where-Object { -not (Test-IsWork $_.q) } -- has PowerShell
# parse the "-not" as a parameter name in some positions and fail with a
# SwitchParameter conversion error. One pass, one decision per row, no
# ambiguity, and the predicate runs once per row instead of twice.
# NOTE the variable name: $smallTalk, NOT $chatter. PowerShell variable names
# are case-INSENSITIVE, so $chatter is the same variable as the -Chatter switch
# declared in param(), and assigning a list to it fails with a baffling
# "cannot convert ... to SwitchParameter". Costly to spot, trivial to avoid.
$noSource  = @($asks | Where-Object { [int]$_.n -eq 0 })
$gaps      = New-Object System.Collections.ArrayList
$smallTalk = New-Object System.Collections.ArrayList
foreach ($r in $noSource) {
    if (Test-IsWork $r.q) { [void]$gaps.Add($r) } else { [void]$smallTalk.Add($r) }
}

$wrong   = New-Object System.Collections.ArrayList
$outages = New-Object System.Collections.ArrayList
foreach ($r in $flagged) {
    if (Test-IsOutage $r.a) { [void]$outages.Add($r) } else { [void]$wrong.Add($r) }
}

Write-Host ""
Write-Host ("{0} questions | {1} unanswered and about the work | {2} chatter | {3} marked wrong" -f `
            $asks.Count, $gaps.Count, $smallTalk.Count, $wrong.Count) -ForegroundColor White

# ---- 1. repeats: the strongest signal there is ------------------------------
# Somebody asking the same thing twice is a page they expect to exist. Repeats
# of WORK questions lead, whether or not a source was found: a question asked
# ten times and answered from the wrong page is still a documentation problem.
$repeat = $asks | Group-Object { $_.q.ToLower().Trim() } |
          Where-Object { $_.Count -gt 1 -and (Test-IsWork $_.Name) } |
          Sort-Object Count -Descending
if ($repeat) {
    Write-Host ""
    Write-Host "=== ASKED MORE THAN ONCE -- write these pages first ===" -ForegroundColor Green
    $repeat | ForEach-Object { "{0,3}x  {1}" -f $_.Count, $_.Name }
}

# ---- 2. unanswered work questions ------------------------------------------
if ($gaps.Count) {
    Write-Host ""
    Write-Host "=== ASKED ABOUT THE WORK, ANSWERED WITH NO SOURCE ===" -ForegroundColor Yellow
    Write-Host "    (either the page does not exist, or retrieval cannot find it)" -ForegroundColor DarkGray
    $gaps | Sort-Object t -Descending | ForEach-Object {
        "{0:yyyy-MM-dd}  {1,-30} {2}" -f [datetime]$_.t, $_.page, $_.q
    }
}

# ---- 3. answers a reader flagged -------------------------------------------
if ($wrong.Count) {
    Write-Host ""
    Write-Host "=== MARKED WRONG BY A READER ===" -ForegroundColor Red
    $wrong | Sort-Object t -Descending | ForEach-Object {
        "{0:yyyy-MM-dd}  {1}" -f [datetime]$_.t, $_.q
        "              on {0}" -f $_.page
        "              said: {0}" -f (($_.a -replace '\s+', ' ') -replace '^(.{200}).*$', '$1...')
        ""
    }
}

if ($outages.Count) {
    Write-Host ""
    Write-Host ("=== {0} flagged answer(s) were the OUTAGE message, not a wrong answer ===" -f $outages.Count) -ForegroundColor DarkYellow
    Write-Host "    The model call failed at the time. Nothing to fix in the docs; check" -ForegroundColor DarkGray
    Write-Host "    the worker logs for that date if it was not a known quota exhaustion." -ForegroundColor DarkGray
    $outages | Sort-Object t -Descending | ForEach-Object {
        "{0:yyyy-MM-dd}  {1}" -f [datetime]$_.t, $_.q
    }
}

# ---- 4. chatter ------------------------------------------------------------
if ($smallTalk.Count) {
    Write-Host ""
    if ($Chatter) {
        Write-Host "=== FILTERED OUT AS CHATTER (check the filter is not eating real questions) ===" -ForegroundColor DarkGray
        $smallTalk | Sort-Object t -Descending | ForEach-Object {
            "{0:yyyy-MM-dd}  {1}" -f [datetime]$_.t, $_.q
        }
    }
    else {
        Write-Host ("{0} chatter question(s) not listed -- run with -Chatter to see them." -f $smallTalk.Count) -ForegroundColor DarkGray
    }
}

Write-Host ""
