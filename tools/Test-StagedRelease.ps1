[CmdletBinding()]
param([string]$NodePath)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot
try {
    $tree = (& git write-tree).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not snapshot the staged release.' }
    $destination = Join-Path ([IO.Path]::GetTempPath()) ('d35-staged-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $destination | Out-Null
    $archive = Join-Path $destination 'source.zip'
    & git archive --format=zip "--output=$archive" $tree
    if ($LASTEXITCODE -ne 0) { throw 'Could not export the staged release.' }
    $source = Join-Path $destination 'source'
    Expand-Archive -LiteralPath $archive -DestinationPath $source
    foreach ($folder in @('Converted JSON', 'Stat Blocks', 'reports')) {
        New-Item -ItemType Directory -Path (Join-Path $source $folder) -Force | Out-Null
    }
    & (Join-Path $source 'tools\Test-ReleaseReadiness.ps1') -NodePath $NodePath
    if (-not $?) { throw 'Isolated staged-release checks failed.' }
    Write-Host "Isolated staged release passed: tree $tree; evidence retained at $destination"
}
finally { Pop-Location }
