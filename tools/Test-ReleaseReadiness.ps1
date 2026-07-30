[CmdletBinding()]
param(
    [string]$NodePath,

    [switch]$SkipRoll20Mock
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Path $PSScriptRoot -Parent

function Assert-RequiredPath {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required release file is missing: $RelativePath"
    }
}

@(
    'Launch D35 Converter.bat',
    'D35 Converter App.ps1',
    'Convert-D35StatBlock.ps1',
    'Dnd35JsonTools.psm1',
    'DungeonStatBlockParser.psm1',
    'D35_Statblock_Importer.js',
    'LICENSE',
    'NOTICE.md',
    'Stat Block Authoring Guide.md',
    'templates\D&D 3.5e Stat Block Template.docx',
    'templates\Dungeon Magazine Stat Block Template.txt',
    'README.md',
    'Quick Start.md',
    'Roll20 Importer\README.md',
    'Roll20 Importer\D35_Statblock_Importer.js',
    'Spell Macros'
) | ForEach-Object { Assert-RequiredPath -RelativePath $_ }

$rootImporter = Join-Path $repoRoot 'D35_Statblock_Importer.js'
$bundledImporter = Join-Path $repoRoot 'Roll20 Importer\D35_Statblock_Importer.js'
if ((Get-FileHash -LiteralPath $rootImporter).Hash -ne (Get-FileHash -LiteralPath $bundledImporter).Hash) {
    throw 'The bundled Roll20 importer does not match the canonical root importer.'
}

$scriptFiles = Get-ChildItem -LiteralPath $repoRoot -Recurse -File | Where-Object { $_.Extension -in @('.ps1', '.psm1') }
foreach ($scriptFile in $scriptFiles) {
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($scriptFile.FullName, [ref]$tokens, [ref]$errors)
    if (@($errors).Count -gt 0) {
        throw "PowerShell syntax errors found in $($scriptFile.FullName): $($errors.Message -join '; ')"
    }
}

$pythonFunctions = Select-String -LiteralPath (Join-Path $repoRoot 'tools\statblock_converter.py') -Pattern '^def\s+(\w+)\(' | ForEach-Object {
    if ($_.Line -match '^def\s+(\w+)\(') { $Matches[1] }
}
$duplicates = @($pythonFunctions | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
if ($duplicates.Count -gt 0) {
    throw "The legacy Python converter contains duplicate function definitions: $($duplicates -join ', ')"
}

if (-not $SkipRoll20Mock) {
    & (Join-Path $repoRoot 'tests\Run-Tests.ps1') -NodePath $NodePath
}
else {
    & (Join-Path $repoRoot 'tools\Test-Roll20ImporterPayload.ps1')
    Write-Warning 'The Roll20 mock test was skipped. Do not mark this build as release-verified until it has passed.'
}

Write-Host 'Release-readiness checks passed.'
