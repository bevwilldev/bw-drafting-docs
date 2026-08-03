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
#   4. Chatter                                  - filtered out, still inspectable
#
# It writes an HTML report by default rather than printing. The report is the
# artefact worth having: it can be handed to whoever writes the page, it does
# not vanish with the scrollback, and the counts read better as a page than as
# a wall of terminal text. -Console restores the printed version.
#
# A question counts as work if it names a command the suite actually has (read
# from the generated command library, so it can never drift) or uses drafting
# vocabulary. Everything else is chatter. The classifier is deliberately
# generous towards "work": a false positive costs one line of reading, a false
# negative hides a real gap.
#
#   .\gaps.ps1              last 30 days -> writes and opens the HTML report
#   .\gaps.ps1 -Days 7      last week
#   .\gaps.ps1 -All         everything still in the log (90-day expiry)
#   .\gaps.ps1 -Console     print to the terminal instead of writing a report
#   .\gaps.ps1 -Console -Chatter   also list what the filter removed
#
# Reads only. Nothing here deletes or edits an entry.

param(
    [int]    $Days = 30,
    [switch] $All,
    # Terminal output instead of the report. The report is the default because
    # it is the thing worth keeping: it can be sent to someone who was never
    # going to run a PowerShell script, and it survives the scrollback.
    [switch] $Console,
    # Only meaningful with -Console; the report always includes the filtered
    # questions behind a collapsed section.
    [switch] $Chatter,
    [string] $OutFile
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
if ($Console -and $repeat) {
    Write-Host ""
    Write-Host "=== ASKED MORE THAN ONCE -- write these pages first ===" -ForegroundColor Green
    $repeat | ForEach-Object { "{0,3}x  {1}" -f $_.Count, $_.Name }
}

# ---- 2. unanswered work questions ------------------------------------------
if ($Console -and $gaps.Count) {
    Write-Host ""
    Write-Host "=== ASKED ABOUT THE WORK, ANSWERED WITH NO SOURCE ===" -ForegroundColor Yellow
    Write-Host "    (either the page does not exist, or retrieval cannot find it)" -ForegroundColor DarkGray
    $gaps | Sort-Object t -Descending | ForEach-Object {
        "{0:yyyy-MM-dd}  {1,-30} {2}" -f [datetime]$_.t, $_.page, $_.q
    }
}

# ---- 3. answers a reader flagged -------------------------------------------
if ($Console -and $wrong.Count) {
    Write-Host ""
    Write-Host "=== MARKED WRONG BY A READER ===" -ForegroundColor Red
    $wrong | Sort-Object t -Descending | ForEach-Object {
        "{0:yyyy-MM-dd}  {1}" -f [datetime]$_.t, $_.q
        "              on {0}" -f $_.page
        "              said: {0}" -f (($_.a -replace '\s+', ' ') -replace '^(.{200}).*$', '$1...')
        ""
    }
}

if ($Console -and $outages.Count) {
    Write-Host ""
    Write-Host ("=== {0} flagged answer(s) were the OUTAGE message, not a wrong answer ===" -f $outages.Count) -ForegroundColor DarkYellow
    Write-Host "    The model call failed at the time. Nothing to fix in the docs; check" -ForegroundColor DarkGray
    Write-Host "    the worker logs for that date if it was not a known quota exhaustion." -ForegroundColor DarkGray
    $outages | Sort-Object t -Descending | ForEach-Object {
        "{0:yyyy-MM-dd}  {1}" -f [datetime]$_.t, $_.q
    }
}

# ---- 4. chatter ------------------------------------------------------------
if ($Console -and $smallTalk.Count) {
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

# ---- HTML report -----------------------------------------------------------
# Self-contained on purpose: no stylesheet, no font CDN, no script. It gets
# emailed, dropped on a share and opened months later, and every one of those
# breaks an external reference. Colours are the docs site's own tokens so it
# reads as part of the family, and it follows the reader's light/dark setting.
if (-not $Console) {

    function HtmlEnc([string]$s) {
        if ($null -eq $s) { return '' }
        return [System.Net.WebUtility]::HtmlEncode($s)
    }

    # A logged page is a path on the docs site; make it clickable, and show a
    # readable label rather than a raw path.
    function PageCell([string]$p) {
        if (-not $p) { return '<span class="dim">-</span>' }
        $clean = $p -replace '^/bw-drafting-docs', ''
        if (-not $clean) { $clean = '/' }
        $label = if ($clean -eq '/') { 'home' } else { $clean.Trim('/') }
        $href  = 'https://agabanto.github.io/bw-drafting-docs' + $clean
        return ('<a href="{0}" class="page">{1}</a>' -f (HtmlEnc $href), (HtmlEnc $label))
    }

    $windowText = if ($All) { 'all logged questions (90-day retention)' }
                  else      { "the last $Days days" }

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append(@"
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Caddie - what the documentation is missing</title>
<style>
  :root{
    --bg:#ffffff; --raised:#fafafa; --ink:#18181b; --strong:#09090b; --muted:#52525b;
    --faint:#71717a; --line:#e7e7ea; --brand:#d81f21; --wash:rgba(216,31,33,.06);
    --good:#15803d; --warn:#a16207;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --bg:#0b0b0d; --raised:#131316; --ink:#ededf0; --strong:#ffffff; --muted:#9b9ba4;
      --faint:#8a8a96; --line:#232327; --brand:#e5484a; --wash:rgba(229,72,74,.09);
      --good:#4ade80; --warn:#fbbf24;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;padding:48px 24px 80px;background:var(--bg);color:var(--ink);
       font:15px/1.6 "Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       -webkit-font-smoothing:antialiased}
  .wrap{max-width:920px;margin:0 auto}
  h1{font-size:26px;line-height:1.25;margin:0 0 6px;color:var(--strong);letter-spacing:-.02em}
  .sub{color:var(--muted);margin:0 0 32px;font-size:14px}
  h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);
     margin:40px 0 4px;font-weight:600}
  h2 + .note{color:var(--faint);font-size:13px;margin:0 0 14px}
  .stats{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 8px}
  .stat{flex:1 1 150px;background:var(--raised);border:1px solid var(--line);
        border-radius:10px;padding:14px 16px}
  .stat .n{display:block;font-size:26px;font-weight:650;color:var(--strong);letter-spacing:-.02em}
  .stat .l{display:block;font-size:12px;color:var(--faint);margin-top:2px}
  .stat.hot .n{color:var(--brand)}
  table{width:100%;border-collapse:collapse;margin:0}
  td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  tr:last-child td{border-bottom:0}
  .count{width:56px;font-weight:650;color:var(--brand);white-space:nowrap;
         font-variant-numeric:tabular-nums}
  .date{width:96px;color:var(--faint);white-space:nowrap;font-variant-numeric:tabular-nums}
  .pagecol{width:190px}
  a.page{color:var(--muted);text-decoration:none;border-bottom:1px solid var(--line);
         font-size:13px;word-break:break-word}
  a.page:hover{color:var(--brand);border-bottom-color:var(--brand)}
  .q{color:var(--ink)}
  .card{background:var(--raised);border:1px solid var(--line);border-radius:10px;
        padding:14px 16px;margin:0 0 10px}
  .card .q{font-weight:550;color:var(--strong)}
  .card .said{color:var(--muted);font-size:13.5px;margin-top:7px;
              border-left:2px solid var(--line);padding-left:12px}
  .dim{color:var(--faint)}
  details{margin-top:8px;border:1px solid var(--line);border-radius:10px;background:var(--raised)}
  summary{cursor:pointer;padding:12px 16px;color:var(--muted);font-size:14px;
          list-style:none;user-select:none}
  summary::-webkit-details-marker{display:none}
  summary:before{content:"> ";color:var(--faint)}
  details[open] summary:before{content:"v "}
  details .inner{padding:0 16px 8px}
  .empty{color:var(--faint);font-style:italic;padding:6px 0}
  footer{margin-top:56px;padding-top:16px;border-top:1px solid var(--line);
         color:var(--faint);font-size:12.5px}
</style></head><body><div class="wrap">
"@)

    [void]$sb.Append("<h1>What the documentation is missing</h1>")
    [void]$sb.Append(("<p class=""sub"">From Caddie's question log, covering {0}. Generated {1}.</p>" -f `
        (HtmlEnc $windowText), (Get-Date -Format 'd MMMM yyyy, HH:mm')))

    # Stats
    [void]$sb.Append('<div class="stats">')
    [void]$sb.Append(("<div class=""stat""><span class=""n"">{0}</span><span class=""l"">questions asked</span></div>" -f $asks.Count))
    $hot = if ($repeat) { ' hot' } else { '' }
    [void]$sb.Append(("<div class=""stat{0}""><span class=""n"">{1}</span><span class=""l"">asked more than once</span></div>" -f $hot, @($repeat).Count))
    [void]$sb.Append(("<div class=""stat""><span class=""n"">{0}</span><span class=""l"">unanswered, about the work</span></div>" -f $gaps.Count))
    [void]$sb.Append(("<div class=""stat""><span class=""n"">{0}</span><span class=""l"">marked wrong</span></div>" -f $wrong.Count))
    [void]$sb.Append('</div>')

    # 1. repeats
    [void]$sb.Append('<h2>Asked more than once</h2>')
    [void]$sb.Append('<p class="note">The office telling you which pages it expects to exist. Start here.</p>')
    if ($repeat) {
        [void]$sb.Append('<table>')
        foreach ($g in $repeat) {
            [void]$sb.Append(("<tr><td class=""count"">{0}x</td><td class=""q"">{1}</td></tr>" -f `
                $g.Count, (HtmlEnc $g.Name)))
        }
        [void]$sb.Append('</table>')
    } else { [void]$sb.Append('<p class="empty">Nothing asked twice in this window.</p>') }

    # 2. gaps
    [void]$sb.Append('<h2>Asked about the work, answered with no source</h2>')
    [void]$sb.Append('<p class="note">Either the page does not exist, or retrieval cannot find it.</p>')
    if ($gaps.Count) {
        [void]$sb.Append('<table>')
        foreach ($r in ($gaps | Sort-Object t -Descending)) {
            [void]$sb.Append(("<tr><td class=""date"">{0:yyyy-MM-dd}</td><td class=""pagecol"">{1}</td><td class=""q"">{2}</td></tr>" -f `
                [datetime]$r.t, (PageCell $r.page), (HtmlEnc $r.q)))
        }
        [void]$sb.Append('</table>')
    } else { [void]$sb.Append('<p class="empty">None - every work question found a source.</p>') }

    # 3. marked wrong
    [void]$sb.Append('<h2>Marked wrong by a reader</h2>')
    if ($wrong.Count) {
        foreach ($r in ($wrong | Sort-Object t -Descending)) {
            $said = ($r.a -replace '\s+', ' ')
            if ($said.Length -gt 320) { $said = $said.Substring(0, 320) + '...' }
            [void]$sb.Append(("<div class=""card""><div class=""q"">{0}</div>" -f (HtmlEnc $r.q)))
            [void]$sb.Append(("<div class=""dim"" style=""font-size:13px;margin-top:3px"">{0:yyyy-MM-dd} on {1}</div>" -f `
                [datetime]$r.t, (PageCell $r.page)))
            [void]$sb.Append(("<div class=""said"">{0}</div></div>" -f (HtmlEnc $said)))
        }
    } else { [void]$sb.Append('<p class="empty">Nothing flagged in this window.</p>') }

    # outages
    if ($outages.Count) {
        [void]$sb.Append('<h2>Flagged, but these were outages</h2>')
        [void]$sb.Append('<p class="note">The model call failed at the time - a reader reporting downtime, not a documentation error.</p>')
        [void]$sb.Append('<table>')
        foreach ($r in ($outages | Sort-Object t -Descending)) {
            [void]$sb.Append(("<tr><td class=""date"">{0:yyyy-MM-dd}</td><td class=""q"">{1}</td></tr>" -f `
                [datetime]$r.t, (HtmlEnc $r.q)))
        }
        [void]$sb.Append('</table>')
    }

    # chatter, collapsed
    if ($smallTalk.Count) {
        [void]$sb.Append(("<details><summary>{0} chatter questions, filtered out - open to check the filter is not eating real ones</summary><div class=""inner""><table>" -f $smallTalk.Count))
        foreach ($r in ($smallTalk | Sort-Object t -Descending)) {
            [void]$sb.Append(("<tr><td class=""date"">{0:yyyy-MM-dd}</td><td class=""q dim"">{1}</td></tr>" -f `
                [datetime]$r.t, (HtmlEnc $r.q)))
        }
        [void]$sb.Append('</table></div></details>')
    }

    [void]$sb.Append('<footer>Generated by worker/gaps.ps1 from the ASK_LOG KV namespace. Questions are logged without any identifier - there is no way to tell who asked what, by design.</footer>')
    [void]$sb.Append('</div></body></html>')

    if (-not $OutFile) {
        $stamp   = Get-Date -Format 'yyyy-MM-dd'
        $OutFile = Join-Path $PSScriptRoot "gaps-$stamp.html"
    }
    [System.IO.File]::WriteAllText($OutFile, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ("Report written: {0}" -f $OutFile) -ForegroundColor Green
    try { Start-Process $OutFile } catch { Write-Host "  (open it yourself - $($_.Exception.Message))" -ForegroundColor DarkGray }
    Write-Host ""
}
