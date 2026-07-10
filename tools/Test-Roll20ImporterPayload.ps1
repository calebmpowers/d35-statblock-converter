[CmdletBinding()]
param(
    [string]$JsonDirectory,

    [string]$ImporterPath
)

$ErrorActionPreference = 'Stop'

if (-not $JsonDirectory) {
    $JsonDirectory = Join-Path (Split-Path -Path $PSScriptRoot -Parent) 'Converted JSON'
}

if (-not $ImporterPath) {
    $ImporterPath = Join-Path (Split-Path -Path $PSScriptRoot -Parent) 'D35_Statblock_Importer.js'
}

function Assert-NoDuplicateImporterFunctions {
    param([Parameter(Mandatory)][string]$Path)

    $functionNames = Select-String -LiteralPath $Path -Pattern '^\s*function\s+([A-Za-z0-9_]+)' | ForEach-Object {
        if ($_.Line -match 'function\s+([A-Za-z0-9_]+)') {
            $Matches[1]
        }
    }
    $duplicates = @($functionNames | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
    if ($duplicates.Count -gt 0) {
        throw "Importer contains duplicate function definitions: $($duplicates -join ', ')"
    }
}

function Test-Payload {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $json = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($json.schema_version -ne 1) {
        throw "$Path does not use schema_version 1."
    }
    if (-not $json.creature) {
        throw "$Path is missing creature."
    }
    foreach ($section in @('header', 'defense', 'offense', 'statistics')) {
        if (-not $json.creature.$section) {
            throw "$Path is missing creature.$section."
        }
    }
    if ([string]::IsNullOrWhiteSpace($json.creature.name)) {
        throw "$Path is missing creature.name."
    }
}

Assert-NoDuplicateImporterFunctions -Path $ImporterPath

$files = @(Get-ChildItem -LiteralPath $JsonDirectory -File -Filter '*.json')
if ($files.Count -eq 0) {
    throw "No JSON files found in $JsonDirectory."
}

foreach ($file in $files) {
    Test-Payload -Path $file.FullName
}

Write-Host "Validated $($files.Count) Roll20 importer payload(s)."
