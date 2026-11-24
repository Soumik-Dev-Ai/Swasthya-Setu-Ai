# Windows PowerShell equivalent of run_all.sh (same phases, same order, same gates).
#   .\run_all.ps1                 full run
#   $env:FROM="P4"; .\run_all.ps1 resume     $env:ONLY="P2"; .\run_all.ps1  single phase
# NOTE: written for the Windows path used by the project, NOT executed by its author (no PowerShell available in the build sandbox). Treat first run as a test of this script too.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
if (-not (Test-Path .env.qa)) { Write-Host "Copy .env.qa.example to .env.qa and fill it in first."; exit 2 }
# verbatim loader: regexes like \b and selectors with spaces must not be interpreted
Get-Content .env.qa | ForEach-Object {
  if ($_ -match '^\s*(#|$)') { return }
  $i = $_.IndexOf('='); if ($i -lt 1) { return }
  $k = $_.Substring(0, $i); $v = ($_.Substring($i + 1) -replace '\s+#.*$', '').TrimEnd()
  Set-Item -Path "Env:$k" -Value $v
}
if (-not $env:RUN_ID) { $env:RUN_ID = Get-Date -Format "yyyyMMddHHmmss" }
$env:PYTHONPATH = "$PSScriptRoot\scripts"
$py = if (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { "py" }
New-Item -ItemType Directory -Force results\logs, results\load, results\recon | Out-Null
$order = "P0","P1","P2","P3","P4","P5","P6","P7","P8"
$from = if ($env:FROM) { $env:FROM } else { "P0" }; $only = $env:ONLY
if ($from -eq "P0" -and -not $only) { Set-Content results\results.jsonl "" }
if (-not (Test-Path results\results.jsonl)) { Set-Content results\results.jsonl "" }
function Want($p) { if ($only) { return $only -eq $p } return ([array]::IndexOf($order, $p) -ge [array]::IndexOf($order, $from)) }
function Step($ph, $label, [scriptblock]$cmd) { Write-Host "--- [$ph] $label"; & $cmd 2>&1 | Tee-Object -FilePath "results\logs\$ph.log" -Append; Add-Content results\phase_rc.txt "$ph|$label|rc=$LASTEXITCODE" }
function Settle($s = 65) { Write-Host "waiting ${s}s for rate-limit windows to drain"; Start-Sleep $s }

if (Want "P0") {
  Write-Host "=== P0 PREFLIGHT (hard gate) ==="
  & $py scripts\make_fixtures.py | Out-Null
  & $py scripts\preflight.py 2>&1 | Tee-Object results\logs\P0.log
  if ($LASTEXITCODE -ne 0) { Write-Host "Preflight failed: aborting."; exit 1 }
}
if (Want "P1") {
  Write-Host "=== P1 RECON ==="
  Step P1 "api routes" { & $py scripts\recon_api.py }
  Step P1 "ui inventory" { npx playwright test tests/p1_recon.spec.ts }
  if (-not (Test-Path forms.json)) { Write-Host "NOTE: forms.json missing: Flows 5-7 will be BLOCKED (see forms.example.json)." }
}
if (Want "P2") {
  Write-Host "=== P2 FLOW 2 CONTRADICTION + KNOWLEDGE BASE ==="
  Step P2 "endpoint sequence + grounding" { npx playwright test tests/p2_flow2.spec.ts }
  Step P2 "grounding exists in KB" { & $py scripts\verify_grounding.py }
  Step P2 "vector store + semantic retrieval" { & $py scripts\rag_probe.py }
}
if (Want "P3") { Write-Host "=== P3 DATA INTEGRITY ==="; Step P3 "cost/bed/landing/selectors" { npx playwright test tests/p3_data_integrity.spec.ts } }
if (Want "P4") {
  Write-Host "=== P4 E2E FLOWS ==="
  Step P4 "your own suites (baseline)" { & $py scripts\existing_suites.py }
  Step P4 "flows 1,3,5,6,7" { npx playwright test tests/p4_flows.spec.ts }
  Step P4 "flow 8 monitor" { & $py scripts\flow8_monitor.py }
}
if (Want "P5") { Write-Host "=== P5 ADVERSARIAL ==="; Step P5 "corpus, override, XSS, SQLi, oversize" { npx playwright test tests/p5_adversarial.spec.ts } }
if (Want "P6") {
  Write-Host "=== P6 CONCURRENCY ==="; Settle 65
  Step P6 "refresh stampede" { npx playwright test tests/p6_refresh_race.spec.ts }
  Step P6 "rate-limit thresholds" { & $py scripts\rate_limit_probe.py }
}
if (Want "P7") {
  Write-Host "=== P7 LOAD ==="; Settle 65
  Step P7 "cold start" { & $py scripts\cold_start.py }
  if (Get-Command locust -ErrorAction SilentlyContinue) {
    $u = if ($env:LOAD_USERS) { $env:LOAD_USERS } else { "50" }; $d = if ($env:LOAD_DURATION) { $env:LOAD_DURATION } else { "90s" }
    Step P7 "solo red-flag baseline" { locust -f load/locustfile.py --headless -u 3 -r 3 -t 30s --only-summary --csv results/load/solo --tags redflag_only --host $env:API_BASE }
    Settle 65
    Step P7 "mixed load" { locust -f load/locustfile.py --headless -u $u -r 10 -t $d --only-summary --csv results/load/mixed --host $env:API_BASE }
    & $py load\analyze.py
  } else { & $py -c "from common import record; record('P7-LOAD-NONBLOCK','Red-flag path stays fast under mixed load','BLOCKED',{'why':'pip install locust'})" }
}
if (Want "P8") { Write-Host "=== P8 REPORT ==="; & $py scripts\report.py; exit $LASTEXITCODE }
