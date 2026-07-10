[CmdletBinding()]
param(
    [string]$JsonDirectory,

    [string]$ImporterPath,

    [string]$NodePath,

    [switch]$VerboseOutput
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$runner = Join-Path $PSScriptRoot 'roll20_mock\run-importer-tests.js'

if (-not $JsonDirectory) {
    $JsonDirectory = Join-Path $repoRoot 'Converted JSON'
}

if (-not $ImporterPath) {
    $ImporterPath = Join-Path $repoRoot 'D35_Statblock_Importer.js'
}

if (-not $NodePath) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $NodePath = $nodeCommand.Source
    }
}

if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) {
    throw 'Node.js 18 or newer is required for the Roll20 mock tests. Install Node.js or supply -NodePath <path-to-node.exe>.'
}

$argsList = @(
    $runner,
    '--json-dir',
    $JsonDirectory,
    '--importer',
    $ImporterPath
)

if ($VerboseOutput) {
    $argsList += '--verbose'
}

& $NodePath @argsList
if ($LASTEXITCODE -ne 0) {
    throw "Roll20 mock importer tests failed with exit code $LASTEXITCODE."
}
