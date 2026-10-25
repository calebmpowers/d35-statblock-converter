[CmdletBinding()]
param(
    [string]$NodePath
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Path $PSScriptRoot -Parent

& (Join-Path $PSScriptRoot 'behavior_regression_test.ps1') -NodePath $NodePath
if (-not $?) { throw 'Campaign behavior regression tests failed.' }

& (Join-Path $PSScriptRoot 'smoke_test.ps1') -WorkspaceRoot $repoRoot -NodePath $NodePath
if (-not $?) {
    throw 'Smoke tests failed.'
}

$savedPayloads = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'Converted JSON') -File -Filter '*.json')
if ($savedPayloads.Count -gt 0) {
    & (Join-Path $repoRoot 'tools\Test-Roll20ImporterPayload.ps1')
    if (-not $?) {
        throw 'Payload validation failed.'
    }
}
else {
    Write-Host 'No saved payloads to validate; smoke-test payloads were validated by the Roll20 mock test.'
}

Write-Host 'All release tests passed.'
