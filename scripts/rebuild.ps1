# Rebuild everything the assistant reads, in the right order.
#
# WHY THIS EXISTS: the rebuild is two steps and skipping the second one is
# silent. gen_corpus.py writes the text; gen_vectors.py embeds it. If the corpus
# moves and the vectors do not, the Worker spots the fingerprint mismatch and
# drops to keyword retrieval - which is the mode where the answering section can
# rank eighteenth instead of third. Nothing breaks, answers just quietly get
# worse, and the only trace is a line in `wrangler tail`.
#
# One command, so the two cannot come apart.
#
#   .\scripts\rebuild.ps1              rebuild both
#   .\scripts\rebuild.ps1 -Commit      rebuild, then stage and commit them
#
# Needs a Gemini key for the embedding step:
#   $env:GEMINI_API_KEY = "..."
# It is never written to the repo.

[CmdletBinding()]
param(
    # Stage and commit the regenerated data files. Content changes are yours to
    # commit; this only ever touches the two generated files.
    [switch]$Commit,

    [string]$Message = "Docs: regenerate corpus and embeddings"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

# Whatever Python is around. Inkscape ships one and is often the only one on a
# drafting machine; it works, and gen_vectors.py handles its missing CA bundle.
$python = $null
foreach ($candidate in @(
    (Get-Command python -ErrorAction SilentlyContinue).Source,
    (Get-Command python3 -ErrorAction SilentlyContinue).Source,
    'C:\Program Files\Inkscape\bin\python.exe'
)) {
    if ($candidate -and (Test-Path $candidate)) { $python = $candidate; break }
}
if (-not $python) { throw "No Python found. Install one, or point this script at yours." }

if (-not $env:GEMINI_API_KEY) {
    throw @"
GEMINI_API_KEY is not set, and the embedding step needs it:

    `$env:GEMINI_API_KEY = "your-key"

Get one at aistudio.google.com. It is never written to this repo.
"@
}

Write-Host "python: $python" -ForegroundColor DarkGray
Write-Host ""

Write-Host "[1/2] corpus" -ForegroundColor Cyan
& $python (Join-Path $PSScriptRoot 'gen_corpus.py')
if ($LASTEXITCODE) { throw "gen_corpus.py failed - stopping before the vectors, so they stay consistent with the corpus already committed." }

Write-Host ""
Write-Host "[2/2] embeddings (a couple of minutes; it waits out the rate limit)" -ForegroundColor Cyan
& $python (Join-Path $PSScriptRoot 'gen_vectors.py')
if ($LASTEXITCODE) {
    throw @"
gen_vectors.py failed. The corpus HAS been rewritten and the vectors have not,
so they no longer match: the Worker will refuse them and fall back to keyword
retrieval until this is re-run. Fix the cause and run this script again, or
`git checkout assets/data/corpus.json` to put things back.
"@
}

Write-Host ""
if ($Commit) {
    $files = @('assets/data/corpus.json', 'assets/data/corpus-vectors.json')
    & git -C $root add @files
    $staged = & git -C $root diff --cached --name-only
    if ($staged) {
        & git -C $root commit -q -m $Message
        Write-Host "Committed: $Message" -ForegroundColor Green
        Write-Host "Not pushed - the Worker reads these from the live site, so push when ready."
    } else {
        Write-Host "Nothing changed; no commit made." -ForegroundColor DarkGray
    }
} else {
    Write-Host "Rebuilt. Commit and push both files - the Worker reads them from the live site." -ForegroundColor Green
    Write-Host "  assets/data/corpus.json"
    Write-Host "  assets/data/corpus-vectors.json"
}
