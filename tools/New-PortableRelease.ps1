[CmdletBinding()]
param(
    [string]$Destination,

    [string]$NodePath,

    [switch]$SkipRoll20Mock
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Path $PSScriptRoot -Parent

if (-not $Destination) {
    $Destination = Join-Path $repoRoot 'dist\D35-Statblock-Converter-0.3.1'
}

if (Test-Path -LiteralPath $Destination) {
    throw "Release destination already exists: $Destination. Choose a new empty destination; this script never deletes an existing release."
}

& (Join-Path $PSScriptRoot 'Test-ReleaseReadiness.ps1') -NodePath $NodePath -SkipRoll20Mock:$SkipRoll20Mock

New-Item -ItemType Directory -Path $Destination | Out-Null

foreach ($file in @(
    'Launch D35 Converter.bat',
    'D35 Converter App.ps1',
    'Convert-D35StatBlock.ps1',
    'Dnd35JsonTools.psm1',
    'DungeonStatBlockParser.psm1',
    'D35_Statblock_Importer.js',
    'importer_versions.json',
    'sample-dungeon-statblock.txt',
    'LICENSE',
    'NOTICE.md',
    'Stat Block Authoring Guide.md',
    'README.md',
    'Quick Start.md'
)) {
    Copy-Item -LiteralPath (Join-Path $repoRoot $file) -Destination (Join-Path $Destination $file)
}

foreach ($folder in @('Roll20 Importer', 'Spell Macros', 'templates', 'tests', 'fixtures', 'tools', 'Releases', 'docs')) {
    Copy-Item -LiteralPath (Join-Path $repoRoot $folder) -Destination (Join-Path $Destination $folder) -Recurse
}

foreach ($folder in @('Stat Blocks', 'Converted JSON', 'reports')) {
    New-Item -ItemType Directory -Path (Join-Path $Destination $folder) | Out-Null
}

Write-Host "Created portable Windows release: $Destination"
