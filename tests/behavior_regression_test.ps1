[CmdletBinding()]
param([string]$NodePath)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $repo ('_behavior_regression_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $outDir | Out-Null
foreach ($fixture in @('Wrapped Campaign Pirate', 'Conditional Campaign Halfblood')) {
    & (Join-Path $repo 'Convert-D35StatBlock.ps1') -Path (Join-Path $repo ('fixtures\statblocks\' + $fixture + '.txt')) -OutputPath (Join-Path $outDir ($fixture + '.dnd35.json'))
}
$pirate = Get-Content (Join-Path $outDir 'Wrapped Campaign Pirate.dnd35.json') -Raw | ConvertFrom-Json
if ($pirate.creature.offense.melee_lines[0].fragments.Count -ne 3 -or $pirate.creature.offense.melee_lines[0].raw -notmatch 'dagger \+5') { throw 'Wrapped pirate attack routine was lost.' }
$bow = Get-Content (Join-Path $outDir 'Conditional Campaign Halfblood.dnd35.json') -Raw | ConvertFrom-Json
if ($bow.creature.defense.ac_line -notmatch '^AC 20.*AC 18') { throw 'Conditional AC replaced the baseline.' }
if ($bow.creature.defense.resist_line -ne 'SR 16') { throw 'Spell resistance was lost.' }
if ($bow.creature.statistics.skills.Count -ne 6 -or $bow.creature.statistics.abilities_line -notmatch 'Str 15, Dex 13') { throw 'Spell-like header swallowed statistics.' }
$spellCount = @($bow.creature.offense.spell_sections | ForEach-Object { $_.groups | ForEach-Object { $_.spells } }).Count
if ($spellCount -ne 7) { throw "Expected seven spell-like abilities, got $spellCount." }
$detect = @($bow.creature.offense.spell_sections | Where-Object { $_.caster_level -eq '6th' })
if ($detect.Count -ne 1 -or $detect[0].groups[0].spells[0].name -ne 'Detect Poison') { throw 'Per-spell caster-level override was lost.' }
& (Join-Path $repo 'tools\Test-Roll20ImporterPayload.ps1') -JsonDirectory $outDir
& (Join-Path $PSScriptRoot 'roll20_mock_test.ps1') -JsonDirectory $outDir -NodePath $NodePath
Write-Host 'Campaign attack and spell-header regression tests passed.'
