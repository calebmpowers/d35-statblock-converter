[CmdletBinding()]
param(
    [string]$WorkspaceRoot,

    [string]$NodePath
)

$ErrorActionPreference = 'Stop'

if (-not $WorkspaceRoot) {
    $WorkspaceRoot = Split-Path -Path $PSCommandPath -Parent | Split-Path -Parent
}

function Assert-Equal {
    param(
        [Parameter(Mandatory)]
        [string]$Label,

        [AllowNull()]
        [object]$Actual,

        [AllowNull()]
        [object]$Expected
    )

    if ([string]$Actual -ne [string]$Expected) {
        throw "$Label expected '$Expected' but got '$Actual'."
    }
}

function Assert-Count {
    param(
        [Parameter(Mandatory)]
        [string]$Label,

        [AllowNull()]
        [object]$Items,

        [int]$Expected
    )

    $actual = @($Items).Count
    if ($actual -ne $Expected) {
        throw "$Label expected count $Expected but got $actual."
    }
}

function Assert-NoDuplicateImporterFunctions {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $functionNames = Select-String -LiteralPath $Path -Pattern '^\s*function\s+([A-Za-z0-9_]+)' | ForEach-Object {
        if ($_.Line -match 'function\s+([A-Za-z0-9_]+)') {
            $Matches[1]
        }
    }
    $duplicates = @($functionNames | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
    if ($duplicates.Count -gt 0) {
        throw "Roll20 importer contains duplicate function definitions: $($duplicates -join ', ')"
    }
}

$runStamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$psOutput = Join-Path $WorkspaceRoot "_smoke_ps_out_$runStamp"
$fixtureInput = Join-Path $WorkspaceRoot 'fixtures\statblocks'
$fixtureManifestPath = Join-Path $WorkspaceRoot 'tests\fixture_manifest.json'
$roll20ImporterPath = Join-Path $WorkspaceRoot 'D35_Statblock_Importer.js'

New-Item -ItemType Directory -Path $psOutput | Out-Null

Push-Location $WorkspaceRoot
try {
    Assert-NoDuplicateImporterFunctions -Path $roll20ImporterPath

    Set-ExecutionPolicy -Scope Process Bypass -Force | Out-Null
    $psScript = Join-Path $WorkspaceRoot 'Convert-D35StatBlock.ps1'
    & $psScript -Path (Join-Path $WorkspaceRoot 'sample-dungeon-statblock.txt') -OutputPath (Join-Path $psOutput 'sample-dungeon-statblock.dnd35.json')
    if (-not $?) {
        throw "PowerShell converter smoke test failed."
    }

    $psJsonPath = Join-Path $psOutput 'sample-dungeon-statblock.dnd35.json'
    if (-not (Test-Path -LiteralPath $psJsonPath)) {
        throw "PowerShell converter did not write $psJsonPath"
    }

    $psJson = Get-Content -LiteralPath $psJsonPath -Raw | ConvertFrom-Json
    if ($psJson.schema_version -ne 1) {
        throw "PowerShell converter emitted unexpected schema version: $($psJson.schema_version)"
    }
    if ($psJson.creature.name -ne 'Goblin Raider') {
        throw "PowerShell converter parsed unexpected name: $($psJson.creature.name)"
    }
    if ($psJson.creature.header.alignment_size_type -ne 'NE Small humanoid (goblinoid)') {
        throw "PowerShell converter parsed unexpected type line: $($psJson.creature.header.alignment_size_type)"
    }
    if ($psJson.creature.header.source_reference -ne 'Dungeon Magazine sample') {
        throw "PowerShell converter parsed unexpected reference: $($psJson.creature.header.source_reference)"
    }
    if (-not $psJson.creature.header -or -not $psJson.creature.defense -or -not $psJson.creature.offense -or -not $psJson.creature.statistics) {
        throw "PowerShell converter did not emit the Roll20 importer handout sections."
    }

    if (-not (Test-Path -LiteralPath $fixtureManifestPath)) {
        throw "Fixture manifest was not found at $fixtureManifestPath"
    }

    $fixtureManifest = Get-Content -LiteralPath $fixtureManifestPath -Raw | ConvertFrom-Json
    foreach ($fixture in @($fixtureManifest)) {
        $inputPath = Join-Path $fixtureInput $fixture.file
        if (-not (Test-Path -LiteralPath $inputPath)) {
            throw "Fixture input was not found: $inputPath"
        }

        $outputName = [System.IO.Path]::GetFileNameWithoutExtension($fixture.file) + '.dnd35.json'
        $outputPath = Join-Path $psOutput $outputName
        & $psScript -Path $inputPath -OutputPath $outputPath
        if (-not $?) {
            throw "Fixture conversion failed for $($fixture.file)."
        }

        $json = Get-Content -LiteralPath $outputPath -Raw | ConvertFrom-Json
        $expected = $fixture.expected

        Assert-Equal -Label "$($fixture.file) schema version" -Actual $json.schema_version -Expected 1
        Assert-Equal -Label "$($fixture.file) name" -Actual $json.creature.name -Expected $expected.name
        Assert-Equal -Label "$($fixture.file) CR" -Actual $json.creature.cr -Expected $expected.cr
        Assert-Equal -Label "$($fixture.file) alignment/size/type" -Actual $json.creature.header.alignment_size_type -Expected $expected.alignment_size_type
        Assert-Equal -Label "$($fixture.file) AC line" -Actual $json.creature.defense.ac_line -Expected $expected.ac_line
        Assert-Equal -Label "$($fixture.file) HP line" -Actual $json.creature.defense.hp_line -Expected $expected.hp_line
        Assert-Equal -Label "$($fixture.file) save line" -Actual $json.creature.defense.fort_ref_will_line -Expected $expected.fort_ref_will_line
        Assert-Equal -Label "$($fixture.file) speed line" -Actual $json.creature.offense.speed_line -Expected $expected.speed_line
        Assert-Equal -Label "$($fixture.file) abilities line" -Actual $json.creature.statistics.abilities_line -Expected $expected.abilities_line
        Assert-Count -Label "$($fixture.file) feats" -Items $json.creature.statistics.feats -Expected $expected.feat_count
        Assert-Count -Label "$($fixture.file) skills" -Items $json.creature.statistics.skills -Expected $expected.skill_count
        Assert-Count -Label "$($fixture.file) possessions" -Items $json.creature.statistics.possessions -Expected $expected.possession_count
        Assert-Count -Label "$($fixture.file) melee lines" -Items $json.creature.offense.melee_lines -Expected $expected.melee_line_count
        Assert-Count -Label "$($fixture.file) ranged lines" -Items $json.creature.offense.ranged_lines -Expected $expected.ranged_line_count
        Assert-Count -Label "$($fixture.file) spell sections" -Items $json.creature.offense.spell_sections -Expected $expected.spell_section_count
        $spellEntryCount = 0
        foreach ($section in @($json.creature.offense.spell_sections)) {
            foreach ($group in @($section.groups)) {
                $spellEntryCount += @($group.spells).Count
            }
        }
        Assert-Equal -Label "$($fixture.file) spell entries" -Actual $spellEntryCount -Expected $expected.spell_entry_count
        Assert-Count -Label "$($fixture.file) special abilities" -Items $json.creature.special_abilities -Expected $expected.special_ability_count
        Assert-Count -Label "$($fixture.file) warnings" -Items $json.warnings -Expected $expected.warning_count
    }

    & (Join-Path $WorkspaceRoot 'tests\roll20_mock_test.ps1') -JsonDirectory $psOutput -ImporterPath $roll20ImporterPath -NodePath $NodePath
    if ($LASTEXITCODE -ne 0) {
        throw "Roll20 mock importer test failed."
    }

    Write-Host "Smoke and fixture tests passed. Outputs: $psOutput"
}
finally {
    Pop-Location
}
