[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Import-Module (Join-Path $root 'Dnd35JsonTools.psm1') -Force
Import-Module (Join-Path $root 'DungeonStatBlockParser.psm1') -Global
$work = Join-Path $root ('_spell_library_' + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $work | Out-Null
$empty = Join-Path $work 'empty'
$external = Join-Path $work 'external'
New-Item -ItemType Directory -Path $empty,$external | Out-Null
[IO.File]::WriteAllText((Join-Path $empty 'README.md'), 'Original test marker; not a spell macro.')
$inputFile = Join-Path $work 'Probe.txt'
$probe = @(
 'Library Probe CR 1', 'human wizard 1', 'LN Medium humanoid (human)',
 'Original synthetic packaging test', 'Init +0; Senses normal; Listen +0, Spot +0',
 'AC 10, touch 10, flat-footed 10', 'hp 5 (1d4+1)', 'Fort +1, Ref +0, Will +2',
 'Spd 30 ft.', 'Melee quarterstaff +0 (1d6)', 'Base Atk +0; Grp +0',
 'Wizard Spells Prepared (CL 1st):', '1st (1/day)-audit light (DC 11)',
 'Abilities Str 10, Dex 10, Con 12, Int 12, Wis 10, Cha 10',
 'Feats Scribe Scroll', 'Skills Spellcraft +5', 'Possessions quarterstaff'
)
[IO.File]::WriteAllText($inputFile, ($probe -join [Environment]::NewLine))
$missing = ConvertTo-ProjectModel -Path $inputFile -SpellMacroLibraryPath (Join-Path $work 'absent')
$emptyProject = ConvertTo-ProjectModel -Path $inputFile -SpellMacroLibraryPath $empty
if ($missing.Metadata.AvailableMacroCount -ne 0 -or $emptyProject.Metadata.AvailableMacroCount -ne 0) { throw 'Absent/readme-only library did not remain empty.' }
if (@($emptyProject.Creature.Spells).Count -ne 1 -or $emptyProject.Creature.Spells[0].Name -ne 'Audit Light') { throw 'Missing library lost a spell.' }
if ($emptyProject.Creature.Spells[0].SaveDC -ne '11' -or $emptyProject.Creature.Spells[0].CasterLevel -ne '1st') { throw 'Missing library lost DC/CL.' }
$default = ConvertTo-Dnd35JsonModel -Path $inputFile
$spell = $default.creature.offense.spell_sections[0].groups[0].spells[0]
if ($spell.name -ne 'Audit Light' -or $spell.macro_text -or $spell.details.dc -ne '11') { throw 'Default macro-free schema-v1 conversion is incorrect.' }
Export-Dnd35Json -Model $default -Path (Join-Path $work 'default.dnd35.json')
$marker = '&{template:DnD35StdRoll} {{spellflag=true}} {{name=@{character_name}}} {{notes=ORIGINAL_EXTERNAL_LIBRARY_PROBE}}'
[IO.File]::WriteAllText((Join-Path $external 'audit_light.txt'), $marker)
$override = & (Join-Path $root 'Convert-D35StatBlock.ps1') -Path $inputFile -OutputPath (Join-Path $work 'override.dnd35.json') -SpellMacroLibraryPath $external -PassThru
$externalSpell = $override.creature.offense.spell_sections[0].groups[0].spells[0]
if ($externalSpell.macro_text -ne $marker -or $externalSpell.name -ne $spell.name -or $externalSpell.details.dc -ne $spell.details.dc) { throw 'Existing external-library CLI override failed.' }
if ($override.creature.defense.hp -ne $default.creature.defense.hp -or $override.creature.name -ne $default.creature.name) { throw 'Library selection changed unrelated identity/HP.' }
$bundledFiles = @(Get-ChildItem -LiteralPath (Join-Path $root 'Spell Macros') -File -Filter '*.txt')
if ($bundledFiles.Count -ne 696) { throw 'Expected all 696 bundled spell macros.' }
$knownInput = Join-Path $work 'Known.txt'
[IO.File]::WriteAllText($knownInput, (($probe -replace 'audit light','cause fear') -join [Environment]::NewLine))
$known = ConvertTo-Dnd35JsonModel -Path $knownInput
$knownSpell = $known.creature.offense.spell_sections[0].groups[0].spells[0]
$expectedMacro = [IO.File]::ReadAllText((Join-Path $root 'Spell Macros\cause_fear.txt'))
if ($knownSpell.name -ne 'Cause Fear' -or $knownSpell.macro_text -ne $expectedMacro) { throw 'Default bundled-library enrichment changed.' }
Write-Host 'Spell-library tests passed: absent/readme-only fallback, unmatched generic schema-v1, external CLI library, 696 bundled macros with unchanged default enrichment.'
