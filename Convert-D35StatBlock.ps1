[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Path,

    [string]$OutputPath,

    [string]$SpellMacroLibraryPath,

    [switch]$PassThru
)

Set-ExecutionPolicy -Scope Process Bypass -Force | Out-Null
$ErrorActionPreference = 'Stop'

$modulePath = Join-Path $PSScriptRoot 'Dnd35JsonTools.psm1'
Import-Module $modulePath -Force

$resolvedInputPath = (Resolve-Path -LiteralPath $Path).Path

if (-not $OutputPath) {
    $outputDirectory = Join-Path $PSScriptRoot 'Converted JSON'
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory | Out-Null
    }

    $outputName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedInputPath) + '.dnd35.json'
    $OutputPath = Join-Path $outputDirectory $outputName
}

if ($PSBoundParameters.ContainsKey('SpellMacroLibraryPath')) {
    $model = ConvertTo-Dnd35JsonModel -Path $resolvedInputPath -SpellMacroLibraryPath $SpellMacroLibraryPath
}
else {
    $model = ConvertTo-Dnd35JsonModel -Path $resolvedInputPath
}

Export-Dnd35Json -Model $model -Path $OutputPath
Write-Host "Wrote $OutputPath"

if ($PassThru) {
    $model
}
