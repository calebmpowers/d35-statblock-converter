[CmdletBinding()]
param(
    [string]$WorkspaceRoot
)

$ErrorActionPreference = 'Stop'
if (-not $WorkspaceRoot) {
    $WorkspaceRoot = Split-Path -Path $PSCommandPath -Parent | Split-Path -Parent
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    throw 'Python is required only for this legacy comparison test.'
}

$runStamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$output = Join-Path $WorkspaceRoot "_legacy_python_out_$runStamp"
$report = Join-Path $WorkspaceRoot "_legacy_python_reports_$runStamp"
New-Item -ItemType Directory -Path $output | Out-Null
New-Item -ItemType Directory -Path $report | Out-Null

Push-Location $WorkspaceRoot
try {
    & $python.Source .\tools\statblock_converter.py --input-dir . --output-dir $output --report-dir $report --file sample-dungeon-statblock.txt
    if ($LASTEXITCODE -ne 0) {
        throw 'Legacy Python converter smoke test failed.'
    }

    $jsonPath = Join-Path $output 'sample-dungeon-statblock.json'
    $json = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json
    if ($json.creature.name -ne 'Goblin Raider') {
        throw "Legacy Python converter parsed unexpected name: $($json.creature.name)"
    }
    Write-Host 'Legacy Python comparison test passed.'
}
finally {
    Pop-Location
}
