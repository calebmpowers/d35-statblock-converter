$legacyModulePath = Join-Path $PSScriptRoot 'DungeonStatBlockParser.psm1'
Import-Module $legacyModulePath -Force

function Resolve-DefaultSpellMacroLibraryPath {
    $candidates = @(
        (Join-Path $PSScriptRoot 'Spell Macros'),
        (Join-Path $PSScriptRoot '3.5_converter_port\statblock2npcjson\Spell Macros')
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return ''
}

$script:DefaultSpellMacroLibraryPath = Resolve-DefaultSpellMacroLibraryPath

function Split-Dnd35List {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return @()
    }

    $result = New-Object System.Collections.Generic.List[string]
    $buffer = New-Object System.Text.StringBuilder
    $depth = 0

    foreach ($character in $Text.ToCharArray()) {
        if ($character -eq '(') {
            $depth++
        }
        elseif ($character -eq ')' -and $depth -gt 0) {
            $depth--
        }

        if ($character -eq ',' -and $depth -eq 0) {
            $part = $buffer.ToString().Trim()
            if ($part) {
                $result.Add($part)
            }
            $buffer.Clear() | Out-Null
            continue
        }

        [void]$buffer.Append($character)
    }

    $tail = $buffer.ToString().Trim()
    if ($tail) {
        $result.Add($tail)
    }

    return @($result | ForEach-Object { $_ })
}

function Get-SkillAbilityExpression {
    param([string]$Ability)

    switch ($Ability) {
        'Str' { return '@{str-mod} ' }
        'Dex' { return '@{dex-mod} ' }
        'Con' { return '@{con-mod} ' }
        'Int' { return '@{int-mod} ' }
        'Wis' { return '@{wis-mod} ' }
        'Cha' { return '@{cha-mod} ' }
        default { return '@{int-mod} ' }
    }
}

function ConvertTo-JsonFriendlyArray {
    param([object[]]$Items)

    if (-not $Items) {
        return @()
    }

    return @($Items | ForEach-Object { $_ })
}

function Convert-ProjectSkillToJson {
    param([pscustomobject]$Skill)

    $roll20 = $null
    if ($Skill.Mapping) {
        $roll20 = [pscustomobject][ordered]@{
            kind = 'standard'
            prefix = $Skill.Mapping.Prefix
            ability = $Skill.Mapping.Ability
            misc = $Skill.MiscModifier
            armor = if ($Skill.Mapping.Extra -eq 'Armor') { $true } else { $false }
        }
    }
    elseif ($Skill.CustomMapping) {
        $roll20 = [pscustomobject][ordered]@{
            kind = 'custom'
            ability = $Skill.CustomMapping.Ability
            ability_expression = (Get-SkillAbilityExpression -Ability $Skill.CustomMapping.Ability)
            misc = $Skill.MiscModifier
        }
    }

    return [pscustomobject][ordered]@{
        name = $Skill.Name
        bonus = $Skill.Bonus
        notes = $Skill.Notes
        roll20 = $roll20
    }
}

function Convert-ProjectSpellToJson {
    param(
        [pscustomobject]$Spell,
        [string]$Kind
    )

    $reference = $null
    if ($Spell.PSObject.Properties['Reference'] -and $Spell.Reference) {
        $reference = [pscustomobject][ordered]@{
            name = $Spell.Reference.Name
            compact_rules = $Spell.Reference.CompactRules
            body_paragraphs = @($Spell.Reference.BodyParagraphs)
            body = $Spell.Reference.Body
            raw = $Spell.Reference.Raw
        }
    }

    return [pscustomobject][ordered]@{
        kind = $Kind
        track = $Spell.Track
        heading = $Spell.Heading
        name = $Spell.Name
        raw = $Spell.Raw
        level = if ($null -eq $Spell.Level) { '' } else { $Spell.Level }
        caster_level = $Spell.CasterLevel
        save_dc = $Spell.SaveDC
        slots = $Spell.Slots
        prepared_count = $Spell.PreparedCount
        usage = $Spell.Usage
        matched_macro = $Spell.MatchedMacro
        reference = $reference
    }
}

function Convert-ProjectSpellToRoll20Spell {
    param(
        [pscustomobject]$Spell,
        [bool]$Prepared = $true
    )

    $details = [ordered]@{}
    if ($Spell.SaveDC) {
        $details.dc = $Spell.SaveDC
    }
    if ($Spell.PreparedCount) {
        $details.detail = $Spell.PreparedCount
    }
    if (-not $Prepared) {
        $details.prepared = $false
    }

    $reference = $null
    if ($Spell.PSObject.Properties['Reference'] -and $Spell.Reference) {
        $reference = [pscustomobject][ordered]@{
            name = $Spell.Reference.Name
            compact_rules = $Spell.Reference.CompactRules
            body_paragraphs = @($Spell.Reference.BodyParagraphs)
            body = $Spell.Reference.Body
            raw = $Spell.Reference.Raw
        }
    }

    return [pscustomobject][ordered]@{
        name = $Spell.Name
        raw = $Spell.Raw
        details = [pscustomobject]$details
        macro_text = $Spell.MatchedMacro
        reference = $reference
    }
}

function Convert-ProjectSpellsToRoll20Sections {
    param(
        [object[]]$Spells,
        [object[]]$SpellLikeAbilities,
        [object[]]$Powers,
        [string]$Spellbook,
        [string]$Domains
    )

    $sections = New-Object System.Collections.Generic.List[object]
    $sectionMap = @{}

    function Get-OrCreateSection {
        param(
            [string]$Type,
            [string]$CasterLevel,
            [string]$Extras
        )

        $key = "$Type|$CasterLevel|$Extras"
        if (-not $sectionMap.ContainsKey($key)) {
            $section = [pscustomobject][ordered]@{
                type = $Type
                caster_level = $CasterLevel
                extras = $Extras
                groups = @()
            }
            $sectionMap[$key] = $section
            $sections.Add($section)
        }
        return $sectionMap[$key]
    }

    function Add-SpellToSection {
        param(
            [string]$Type,
            [string]$CasterLevel,
            [string]$Extras,
            [string]$GroupLabel,
            [pscustomobject]$Spell,
            [bool]$Prepared
        )

        if (-not $Spell) {
            return
        }

        $section = Get-OrCreateSection -Type $Type -CasterLevel $CasterLevel -Extras $Extras
        $groups = @($section.groups)
        $group = $groups | Where-Object { $_.label -eq $GroupLabel } | Select-Object -First 1
        if (-not $group) {
            $group = [pscustomobject][ordered]@{
                label = $GroupLabel
                spells = @()
            }
            $groups += $group
            $section.groups = @($groups | ForEach-Object { $_ })
        }

        $spellList = @($group.spells)
        $spellList += (Convert-ProjectSpellToRoll20Spell -Spell $Spell -Prepared $Prepared)
        $group.spells = @($spellList | ForEach-Object { $_ })
    }

    foreach ($spell in @($Spells)) {
        $prepared = $true
        if ($spell.Heading -match 'Known') {
            $prepared = $false
        }
        Add-SpellToSection `
            -Type $spell.Heading `
            -CasterLevel $spell.CasterLevel `
            -Extras $(if ($Domains) { "Domains/Prohibited schools $Domains" } else { '' }) `
            -GroupLabel ([string]$spell.Level) `
            -Spell $spell `
            -Prepared $prepared
    }

    foreach ($power in @($Powers)) {
        Add-SpellToSection `
            -Type $power.Heading `
            -CasterLevel $power.CasterLevel `
            -Extras '' `
            -GroupLabel ([string]$power.Level) `
            -Spell $power `
            -Prepared $false
    }

    foreach ($spellLike in @($SpellLikeAbilities)) {
        Add-SpellToSection `
            -Type 'Spell-Like Abilities' `
            -CasterLevel $spellLike.CasterLevel `
            -Extras '' `
            -GroupLabel $spellLike.Usage `
            -Spell $spellLike `
            -Prepared $false
    }

    if (-not [string]::IsNullOrWhiteSpace($Spellbook)) {
        foreach ($segment in @($Spellbook -split '\s*;\s*')) {
            $clean = $segment.Trim()
            if (-not $clean) {
                continue
            }

            if ($clean -match '^(?<level>\d+)(?:st|nd|rd|th)?-(?<spells>.+)$') {
                $level = $Matches.level
                foreach ($spellName in (Split-Dnd35List -Text $Matches.spells)) {
                    if ($spellName -match '^(all|all spells)$') {
                        continue
                    }

                    $spell = [pscustomobject]@{
                        Name = $spellName
                        Raw = $spellName
                        SaveDC = ''
                        PreparedCount = ''
                        MatchedMacro = ''
                    }
                    Add-SpellToSection `
                        -Type 'Spellbook' `
                        -CasterLevel '' `
                        -Extras '' `
                        -GroupLabel $level `
                        -Spell $spell `
                        -Prepared $false
                }
            }
        }
    }

    return @($sections | ForEach-Object { $_ })
}

function ConvertTo-Dnd35JsonModel {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [string]$SpellMacroLibraryPath = $script:DefaultSpellMacroLibraryPath
    )

    $project = ConvertTo-ProjectModel -Path $Path -SpellMacroLibraryPath $SpellMacroLibraryPath
    return ConvertFrom-ProjectModelToRoll20ImporterJson -Project $project
}

function Get-Roll20AttackLineEntries {
    param(
        [object[]]$Attacks,
        [string]$Category,
        [string]$RawLine
    )

    if ([string]::IsNullOrWhiteSpace($RawLine)) {
        return @()
    }

    $fragments = foreach ($attack in @($Attacks | Where-Object { $_.Category -eq $Category })) {
        [pscustomobject][ordered]@{
            raw = $attack.Raw
        }
    }

    return @(
        [pscustomobject][ordered]@{
            raw = $RawLine
            fragments = @($fragments | ForEach-Object { $_ })
        }
    )
}

function Get-Roll20SpecialAbilities {
    param([pscustomobject]$Project)

    if (@($Project.Creature.OrdinaryEntries).Count -gt 0) {
        return @(
            foreach ($entry in @($Project.Creature.OrdinaryEntries | Where-Object { $_.TypeStyle -ne 'bracketed' -and $_.Name -ne 'Skills' })) {
                [pscustomobject][ordered]@{
                    name = $entry.Name
                    type = $entry.Type
                    raw = $entry.Raw
                }
            }
        )
    }

    $abilities = New-Object System.Collections.Generic.List[object]
    $rawText = [string]$Project.Raw.StatBlockText
    $lines = @($rawText -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^_+$' })
    $current = $null

    foreach ($line in $lines) {
        if ($line -match '^.+?\s+\[[^\]]+\]\s+.+$') {
            if ($current) {
                $abilities.Add([pscustomobject][ordered]@{
                    name = $current.Name
                    type = $current.Type
                    raw = ($current.Lines -join "`n`n")
                })
                $current = $null
            }
            continue
        }

        if ($line -match '^(?<name>[A-Z][A-Za-z0-9'' -]+?)\s+\((?<type>Ex|Su|Sp|Ps)\)\s*(?<body>.*)$') {
            if ($current) {
                $abilities.Add([pscustomobject][ordered]@{
                    name = $current.Name
                    type = $current.Type
                    raw = ($current.Lines -join "`n`n")
                })
            }
            $current = [pscustomobject]@{
                Name = $Matches.name.Trim()
                Type = $Matches.type.Trim()
                Lines = New-Object System.Collections.Generic.List[string]
            }
            $current.Lines.Add($line)
            continue
        }

        if ($current) {
            if ($line -match '^(Skills|Possessions|Combat Gear|Spellbook)\b') {
                $abilities.Add([pscustomobject][ordered]@{
                    name = $current.Name
                    type = $current.Type
                    raw = ($current.Lines -join "`n`n")
                })
                $current = $null
                continue
            }
            if ($line -notmatch '^(Init|Aura|Languages|AC|hp|Immune|Resist|Fort|Weakness|Spd|Melee|Ranged|Space|Base Atk|Atk Options|Special Actions|Abilities|SQ|Feats)\b') {
                $current.Lines.Add($line)
            }
        }
    }

    if ($current) {
        $abilities.Add([pscustomobject][ordered]@{
            name = $current.Name
            type = $current.Type
            raw = ($current.Lines -join "`n`n")
        })
    }

    if ($abilities.Count -gt 0) {
        return @($abilities | ForEach-Object { $_ })
    }

    return @(
        foreach ($ability in @($Project.Creature.SpecialAbilities)) {
            [pscustomobject][ordered]@{
                name = $ability.Name
                type = $ability.Type
                raw = ("{0} ({1}) {2}" -f $ability.Name, $ability.Type, $ability.Body).Trim()
            }
        }
    )
}

function Get-Roll20BioNotes {
    param([pscustomobject]$Project)

    return @($Project.Creature.Notes) -join "`n`n"
}

function Convert-LowerEntryToJson {
    param([pscustomobject]$Entry)

    if (-not $Entry) { return $null }
    return [pscustomobject][ordered]@{
        name = $Entry.Name
        type = $Entry.Type
        type_style = $Entry.TypeStyle
        body = $Entry.Body
        raw = $Entry.Raw
    }
}

function Convert-SpellReferenceToJson {
    param([pscustomobject]$SpellReference)

    $levels = foreach ($level in @($SpellReference.Levels)) {
        $spells = foreach ($spell in @($level.Spells)) {
            [pscustomobject][ordered]@{
                name = $spell.Name
                compact_rules = $spell.CompactRules
                body_paragraphs = @($spell.BodyParagraphs)
                body = $spell.Body
                raw = $spell.Raw
                matched_upper_spell = [bool]$spell.MatchedUpperSpell
            }
        }
        [pscustomobject][ordered]@{
            level = $level.Level
            label = $level.Label
            spells = @($spells)
        }
    }
    return [pscustomobject][ordered]@{
        heading = $SpellReference.Heading
        levels = @($levels)
    }
}

function Split-Roll20SkillNameList {
    param([string]$Text)

    $clean = $Text -replace '\s+and\s+', ', '
    return @($clean -split '\s*,\s*' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Get-Roll20SkillDetails {
    param([pscustomobject]$Project)

    $details = New-Object System.Collections.Generic.List[object]
    foreach ($note in @($Project.Creature.ExpandedSkillDetails)) {
        $body = $note -replace '^Skills\s+', ''
        foreach ($sentence in @($body -split '(?<=[.])\s+')) {
            $clean = $sentence.Trim()
            if ($clean -notmatch '^(?<skill>[A-Z][A-Za-z ]+(?:\s+\([^)]+\))?)\s+(?<total>[+-]\d+)(?<condition>.*?)\s+includes\s+(?:the\s+|an?\s+)?(?<modifiers>.+?)[.]?$') {
                continue
            }

            $condition = $Matches.condition.Trim(' ', ',', ';')
            $modifierText = $Matches.modifiers
            $modifiers = New-Object System.Collections.Generic.List[object]

            foreach ($modifierMatch in [regex]::Matches($modifierText, '(?<bonus>[+-]\d+)\s+(?<type>[A-Za-z-]+\s+)?bonus\s+from\s+(?<source>[^.;]+?)(?=\s+and\s+(?:an?\s+|the\s+)?[+-]\d+|[.;]|$)', 'IgnoreCase')) {
                $modifiers.Add([pscustomobject][ordered]@{
                    bonus = [int]$modifierMatch.Groups['bonus'].Value
                    type = $(if ($modifierMatch.Groups['type'].Success) { $modifierMatch.Groups['type'].Value.Trim().ToLowerInvariant() } else { 'untyped' })
                    source = $modifierMatch.Groups['source'].Value.Trim()
                    reason = ''
                })
            }

            foreach ($modifierMatch in [regex]::Matches($modifierText, '(?<bonus>-\d+)\s+penalty\s+for\s+(?<reason>[^.;]+?)(?=\s+and\s+(?:an?\s+|the\s+)?[+-]\d+|[.;]|$)', 'IgnoreCase')) {
                $modifiers.Add([pscustomobject][ordered]@{
                    bonus = [int]$modifierMatch.Groups['bonus'].Value
                    type = 'penalty'
                    source = ''
                    reason = $modifierMatch.Groups['reason'].Value.Trim()
                })
            }

            $details.Add([pscustomobject][ordered]@{
                skill = $Matches.skill.Trim()
                total = [int]$Matches.total
                condition = $condition
                modifiers = @($modifiers | ForEach-Object { $_ })
                raw = $clean
            })
        }
    }

    return @($details | ForEach-Object { $_ })
}

function Get-Roll20SkillBonuses {
    param([pscustomobject]$Project)

    $bonuses = New-Object System.Collections.Generic.List[object]
    foreach ($detail in @(Get-Roll20SkillDetails -Project $Project)) {
        if ($detail.Condition) {
            continue
        }
        foreach ($modifier in @($detail.Modifiers)) {
            $bonuses.Add([pscustomobject][ordered]@{
                bonus = [int]$modifier.Bonus
                type = $modifier.Type
                skills = @($detail.Skill)
                source = $detail.Raw
            })
        }
    }

    foreach ($note in @($Project.Creature.Notes | Where-Object { $_ -match '^Skills\b' })) {
        $body = $note -replace '^Skills\s+', ''
        $matches = [regex]::Matches($body, '([+-]\d+)\s+(?<type>[a-z-]+)\s+bonus on (?<skills>.+?) checks', 'IgnoreCase')
        foreach ($match in $matches) {
            $skills = Split-Roll20SkillNameList -Text $match.Groups['skills'].Value
            if ($skills.Count -eq 0) {
                continue
            }
            $bonuses.Add([pscustomobject][ordered]@{
                bonus = [int]$match.Groups[1].Value
                type = $match.Groups['type'].Value.ToLowerInvariant()
                skills = @($skills | ForEach-Object { $_ })
                source = $note
            })
        }
    }

    return @($bonuses | ForEach-Object { $_ })
}

function ConvertFrom-ProjectModelToRoll20ImporterJson {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Project
    )

    $feats = Split-Dnd35List -Text $Project.Creature.Feats
    $skills = foreach ($skill in @($Project.Creature.SkillEntries)) {
        $skillNote = ([string]$skill.Notes).Trim()
        if ($skillNote -match '^\((?<body>.*)\)$') {
            $skillNote = $Matches.body
        }
        "{0} {1}{2}" -f $skill.Name, $skill.Bonus, $(if ($skillNote) { " ($skillNote)" } else { '' })
    }
    $possessions = @(
        (Split-Dnd35List -Text $Project.Creature.Possessions) +
        (Split-Dnd35List -Text $Project.Creature.CombatGear) |
        Where-Object { $_ -and $_ -notmatch '^combat gear$' }
    )
    $combatGear = Split-Dnd35List -Text $Project.Creature.CombatGear
    $classes = foreach ($class in @($Project.Creature.Identity.Classes)) {
        [pscustomobject][ordered]@{
            name = $class.Name
            level = $class.Level
        }
    }
    $specialAbilities = Get-Roll20SpecialAbilities -Project $Project
    $featDetails = foreach ($feat in @($Project.Creature.ExpandedFeats)) {
        [pscustomobject][ordered]@{
            name = $feat.Name
            category = $feat.Category
            body = $feat.Body
            raw = $feat.Raw
        }
    }
    $skillDetails = Get-Roll20SkillDetails -Project $Project
    $ordinaryEntries = foreach ($entry in @($Project.Creature.OrdinaryEntries)) {
        Convert-LowerEntryToJson -Entry $entry
    }
    $lowerSkillsEntry = Convert-LowerEntryToJson -Entry $Project.Creature.LowerSkillsEntry
    $spellReference = Convert-SpellReferenceToJson -SpellReference $Project.Creature.SpellReference
    $bioNotes = Get-Roll20BioNotes -Project $Project

    return [pscustomobject][ordered]@{
        schema_version = 1
        source = [pscustomobject][ordered]@{
            parser_version = $Project.Metadata.ParserVersion
            generated_at = $Project.Metadata.GeneratedAt
            source_path = $Project.Metadata.SourcePath
            spell_macro_library_path = $Project.Metadata.SpellMacroLibraryPath
        }
        creature = [pscustomobject][ordered]@{
            name = $Project.Creature.Name
            cr = $Project.Creature.ChallengeRating
            header = [pscustomobject][ordered]@{
                name = $Project.Creature.Name
                cr = $Project.Creature.ChallengeRating
                ancestry = $Project.Creature.Identity.RaceText
                alignment_size_type = $Project.Creature.Identity.AlignmentLine
                source_reference = $Project.Creature.Identity.ReferenceLine
                classes = @($classes | ForEach-Object { $_ })
                init_line = $(if ($Project.Creature.Senses) { "Init {0}; Senses {1}" -f $(if ($Project.Creature.Initiative -ge 0) { "+$($Project.Creature.Initiative)" } else { "$($Project.Creature.Initiative)" }), $Project.Creature.Senses } else { "Init {0}" -f $(if ($Project.Creature.Initiative -ge 0) { "+$($Project.Creature.Initiative)" } else { "$($Project.Creature.Initiative)" }) })
                languages_line = $(if ($Project.Creature.Languages) { "Languages $($Project.Creature.Languages)" } else { '' })
                aura_lines = $(if ($Project.Creature.Aura) { @("Aura $($Project.Creature.Aura)") } else { @() })
            }
            defense = [pscustomobject][ordered]@{
                ac_line = $Project.Creature.AC.Raw
                hp_line = $Project.Creature.HP.Raw
                fort_ref_will_line = "Fort {0}, Ref {1}, Will {2}" -f $(if ($Project.Creature.Saves.Fort -ge 0) { "+$($Project.Creature.Saves.Fort)" } else { "$($Project.Creature.Saves.Fort)" }), $(if ($Project.Creature.Saves.Ref -ge 0) { "+$($Project.Creature.Saves.Ref)" } else { "$($Project.Creature.Saves.Ref)" }), $(if ($Project.Creature.Saves.Will -ge 0) { "+$($Project.Creature.Saves.Will)" } else { "$($Project.Creature.Saves.Will)" })
                immune_line = $Project.Creature.Immune
                resist_line = $Project.Creature.Resist
                weaknesses_line = $Project.Creature.Weaknesses
            }
            offense = [pscustomobject][ordered]@{
                speed_line = $Project.Creature.Speed.Raw
                melee_lines = @(Get-Roll20AttackLineEntries -Attacks $Project.Creature.Attacks -Category 'Melee' -RawLine $Project.Creature.Melee)
                ranged_lines = @(Get-Roll20AttackLineEntries -Attacks $Project.Creature.Attacks -Category 'Ranged' -RawLine $Project.Creature.Ranged)
                space_reach_line = $(if ($Project.Creature.Space -or $Project.Creature.Reach) { "Space $($Project.Creature.Space); Reach $($Project.Creature.Reach)" } else { '' })
                base_attack_line = $(if ($Project.Creature.BaseAttack -or $Project.Creature.Grapple) { "Base Atk $($Project.Creature.BaseAttack); Grp $($Project.Creature.Grapple)" } else { '' })
                attack_options_line = $(if ($Project.Creature.AttackOptions) { "Atk Options $($Project.Creature.AttackOptions)" } else { '' })
                special_actions_line = $(if ($Project.Creature.SpecialActions) { "Special Actions $($Project.Creature.SpecialActions)" } else { '' })
                combat_gear_line = ''
                spell_sections = @(Convert-ProjectSpellsToRoll20Sections -Spells $Project.Creature.Spells -SpellLikeAbilities $Project.Creature.SpellLikeAbilities -Powers $Project.Creature.Powers -Spellbook $Project.Creature.Spellbook -Domains $Project.Creature.Domains)
            }
            statistics = [pscustomobject][ordered]@{
                abilities_line = "Abilities Str $($Project.Creature.Abilities.Str), Dex $($Project.Creature.Abilities.Dex), Con $($Project.Creature.Abilities.Con), Int $($Project.Creature.Abilities.Int), Wis $($Project.Creature.Abilities.Wis), Cha $($Project.Creature.Abilities.Cha)"
                sq_line = $(if ($Project.Creature.SQ) { "SQ $($Project.Creature.SQ)" } else { '' })
                feats = @($feats | ForEach-Object { $_ })
                feat_details = @($featDetails | ForEach-Object { $_ })
                skills = @($skills | ForEach-Object { $_ })
                skill_details = @($skillDetails | ForEach-Object { $_ })
                skill_bonuses = @(Get-Roll20SkillBonuses -Project $Project)
                possessions = @($possessions | ForEach-Object { $_ })
                spellbook_line = $(if ($Project.Creature.Spellbook) { "Spellbook $($Project.Creature.Spellbook)" } else { '' })
            }
            special_abilities = @($specialAbilities | ForEach-Object { $_ })
            ordinary_entries = @($ordinaryEntries | ForEach-Object { $_ })
            lower_skills_entry = $lowerSkillsEntry
            spell_reference = $spellReference
            bio_notes = $bioNotes
        }
        warnings = @($Project.Warnings)
        roll20_hints = [pscustomobject][ordered]@{
            character_name = $Project.Creature.Name
        }
    }
}

function ConvertFrom-ProjectModelToDnd35Json {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Project
    )

    $classes = foreach ($class in @($Project.Creature.Identity.Classes)) {
        [pscustomobject][ordered]@{
            name = $class.Name
            level = $class.Level
        }
    }

    $attacks = foreach ($attack in @($Project.Creature.Attacks)) {
        [pscustomobject][ordered]@{
            category = $attack.Category
            name = $attack.Name
            raw = $attack.Raw
            bonuses = @($attack.Bonuses)
            primary_bonus = $attack.PrimaryBonus
            damage = $attack.Damage
            damage_expression = $attack.DamageExpression
            crit_min = $attack.CritMin
            crit_multiplier = $attack.CritMultiplier
            count_text = $attack.CountText
            notes = $attack.Notes
        }
    }

    $skills = foreach ($skill in @($Project.Creature.SkillEntries)) {
        Convert-ProjectSkillToJson -Skill $skill
    }

    $specialAbilities = foreach ($ability in @($Project.Creature.SpecialAbilities)) {
        [pscustomobject][ordered]@{
            name = $ability.Name
            type = $ability.Type
            body = $ability.Body
        }
    }

    $featDetails = foreach ($feat in @($Project.Creature.ExpandedFeats)) {
        [pscustomobject][ordered]@{
            name = $feat.Name
            category = $feat.Category
            body = $feat.Body
            raw = $feat.Raw
        }
    }
    $skillDetails = Get-Roll20SkillDetails -Project $Project
    $ordinaryEntries = foreach ($entry in @($Project.Creature.OrdinaryEntries)) {
        Convert-LowerEntryToJson -Entry $entry
    }
    $lowerSkillsEntry = Convert-LowerEntryToJson -Entry $Project.Creature.LowerSkillsEntry
    $spellReference = Convert-SpellReferenceToJson -SpellReference $Project.Creature.SpellReference

    $spellList = foreach ($spell in @($Project.Creature.Spells)) {
        Convert-ProjectSpellToJson -Spell $spell -Kind 'spell'
    }

    $spellLikeList = foreach ($spellLike in @($Project.Creature.SpellLikeAbilities)) {
        Convert-ProjectSpellToJson -Spell $spellLike -Kind 'spell_like'
    }

    $powerList = foreach ($power in @($Project.Creature.Powers)) {
        Convert-ProjectSpellToJson -Spell $power -Kind 'power'
    }

    $feats = Split-Dnd35List -Text $Project.Creature.Feats
    $possessions = Split-Dnd35List -Text $Project.Creature.Possessions
    $combatGear = Split-Dnd35List -Text $Project.Creature.CombatGear
    $acComponents = foreach ($component in @($Project.Creature.AC.Components)) {
        [pscustomobject][ordered]@{
            bonus = $component.Bonus
            type = $component.Type
        }
    }

    $model = [pscustomobject][ordered]@{
        version = '1.0'
        format = 'dnd35-roll20-character'
        name = $Project.Creature.Name
        cr = $Project.Creature.ChallengeRating
        alignment = $Project.Creature.Identity.Alignment
        size = $Project.Creature.Identity.SizeText
        size_value = $Project.Creature.Identity.SizeValue
        race = $Project.Creature.Identity.RaceText
        type = $Project.Creature.Identity.TypeText
        reference = $Project.Creature.Identity.ReferenceLine
        classes = @($classes | ForEach-Object { $_ })
        initiative = $Project.Creature.Initiative
        senses = $Project.Creature.Senses
        aura = $Project.Creature.Aura
        languages = $Project.Creature.Languages
        ac = [pscustomobject][ordered]@{
            total = $Project.Creature.AC.Total
            touch = $Project.Creature.AC.Touch
            flat_footed = $Project.Creature.AC.FlatFooted
            notes = $Project.Creature.AC.Notes
            components = @($acComponents | ForEach-Object { $_ })
            raw = $Project.Creature.AC.Raw
        }
        hp = [pscustomobject][ordered]@{
            current = $Project.Creature.HP.HitPoints
            maximum = $Project.Creature.HP.HitPoints
            hit_dice = $Project.Creature.HP.HitDice
            damage_reduction = $Project.Creature.HP.DamageReduction
            extra = @($Project.Creature.HP.Extra)
            raw = $Project.Creature.HP.Raw
        }
        saves = [pscustomobject][ordered]@{
            fort = $Project.Creature.Saves.Fort
            reflex = $Project.Creature.Saves.Ref
            will = $Project.Creature.Saves.Will
            notes = $Project.Creature.Saves.Notes
        }
        speed = [pscustomobject][ordered]@{
            land = $Project.Creature.Speed.Base
            fly = $Project.Creature.Speed.Fly
            fly_maneuverability = $Project.Creature.Speed.FlyManeuver
            swim = $Project.Creature.Speed.Swim
            climb = $Project.Creature.Speed.Climb
            burrow = $Project.Creature.Speed.Burrow
            glide = $Project.Creature.Speed.Glide
            raw = $Project.Creature.Speed.Raw
        }
        space = $Project.Creature.Space
        reach = $Project.Creature.Reach
        base_attack = $Project.Creature.BaseAttack
        grapple = $Project.Creature.Grapple
        attack_options = $Project.Creature.AttackOptions
        special_actions = $Project.Creature.SpecialActions
        melee = $Project.Creature.Melee
        ranged = $Project.Creature.Ranged
        attacks = @($attacks | ForEach-Object { $_ })
        abilities = [pscustomobject][ordered]@{
            str = $Project.Creature.Abilities.Str
            dex = $Project.Creature.Abilities.Dex
            con = $Project.Creature.Abilities.Con
            int = $Project.Creature.Abilities.Int
            wis = $Project.Creature.Abilities.Wis
            cha = $Project.Creature.Abilities.Cha
        }
        sq = $Project.Creature.SQ
        feats = @($feats | ForEach-Object { $_ })
        feats_text = $Project.Creature.Feats
        feat_details = @($featDetails | ForEach-Object { $_ })
        skills = @($skills | ForEach-Object { $_ })
        skills_text = $Project.Creature.Skills
        skill_details = @($skillDetails | ForEach-Object { $_ })
        combat_gear = @($combatGear | ForEach-Object { $_ })
        combat_gear_text = $Project.Creature.CombatGear
        possessions = @($possessions | ForEach-Object { $_ })
        possessions_text = $Project.Creature.Possessions
        resist = $Project.Creature.Resist
        spell_resistance = $Project.Creature.SR
        immune = $Project.Creature.Immune
        weaknesses = $Project.Creature.Weaknesses
        domains = $Project.Creature.Domains
        spellbook = $Project.Creature.Spellbook
        spells = @($spellList | ForEach-Object { $_ })
        spell_like_abilities = @($spellLikeList | ForEach-Object { $_ })
        powers = @($powerList | ForEach-Object { $_ })
        special_abilities = @($specialAbilities | ForEach-Object { $_ })
        ordinary_entries = @($ordinaryEntries | ForEach-Object { $_ })
        lower_skills_entry = $lowerSkillsEntry
        spell_reference = $spellReference
        notes = @($Project.Creature.Notes)
        warnings = @($Project.Warnings)
        source = [pscustomobject][ordered]@{
            parser_version = $Project.Metadata.ParserVersion
            generated_at = $Project.Metadata.GeneratedAt
            docx_path = $Project.Metadata.SourcePath
            spell_macro_library_path = $Project.Metadata.SpellMacroLibraryPath
            raw_stat_block = $Project.Raw.StatBlockText
        }
    }

    return $model
}

function Export-Dnd35Json {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Model,

        [Parameter(Mandatory)]
        [string]$Path
    )

    $json = $Model | ConvertTo-Json -Depth 12
    $Path = [System.IO.Path]::GetFullPath($Path)
    $directory = [System.IO.Path]::GetDirectoryName($Path)
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    # A failed conversion must never leave a partial JSON file that looks ready to import.
    $temporaryPath = Join-Path $directory ('.' + [System.IO.Path]::GetFileName($Path) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [System.IO.File]::WriteAllText($temporaryPath, $json, [System.Text.Encoding]::UTF8)
        Move-Dnd35FileIntoPlace -SourcePath $temporaryPath -DestinationPath $Path
    }
    catch {
        throw "Unable to safely write '$Path': $($_.Exception.Message)"
    }
}

function Move-Dnd35FileIntoPlace {
    param(
        [Parameter(Mandatory)][string]$SourcePath,
        [Parameter(Mandatory)][string]$DestinationPath
    )

    if (-not ('Dnd35NativeFileOperations' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Dnd35NativeFileOperations {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool MoveFileEx(string existingFileName, string newFileName, int flags);
}
'@
    }

    # MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH: replace only after the complete temporary file exists.
    if (-not [Dnd35NativeFileOperations]::MoveFileEx($SourcePath, $DestinationPath, 0x1 -bor 0x8)) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw [System.ComponentModel.Win32Exception]::new($errorCode)
    }
}

function Import-Dnd35Json {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $parsed = $text | ConvertFrom-Json

    if ($parsed.format -eq 'dnd35-roll20-handout-envelope' -and $parsed.payload) {
        $innerJson = ConvertFrom-Base64UrlUtf8 -Encoded $parsed.payload
        return $innerJson | ConvertFrom-Json
    }

    return $parsed
}

function ConvertTo-HandoutSafeModel {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Model
    )

    $clone = $Model | ConvertTo-Json -Depth 12 | ConvertFrom-Json

    if (-not $clone.source) {
        $clone | Add-Member -NotePropertyName source -NotePropertyValue ([pscustomobject]@{})
    }

    if ($clone.source.PSObject.Properties['docx_path']) {
        $clone.source.PSObject.Properties.Remove('docx_path')
    }

    if ($clone.source.PSObject.Properties['spell_macro_library_path']) {
        $clone.source.PSObject.Properties.Remove('spell_macro_library_path')
    }

    return $clone
}

function ConvertTo-AsciiSafeJson {
    param(
        [Parameter(Mandatory)]
        [object]$InputObject
    )

    $json = $InputObject | ConvertTo-Json -Depth 12 -Compress
    $builder = New-Object System.Text.StringBuilder

    foreach ($character in $json.ToCharArray()) {
        $codePoint = [int][char]$character
        if ($codePoint -gt 127) {
            [void]$builder.AppendFormat('\u{0:x4}', $codePoint)
        }
        else {
            [void]$builder.Append($character)
        }
    }

    return $builder.ToString()
}

function ConvertTo-Base64UrlUtf8 {
    param(
        [Parameter(Mandatory)]
        [string]$Text
    )

    $base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Text))
    return $base64.TrimEnd('=') -replace '\+', '-' -replace '/', '_'
}

function ConvertFrom-Base64UrlUtf8 {
    param(
        [Parameter(Mandatory)]
        [string]$Encoded
    )

    $base64 = $Encoded -replace '-', '+' -replace '_', '/'
    switch ($base64.Length % 4) {
        2 { $base64 += '==' }
        3 { $base64 += '=' }
    }

    $bytes = [Convert]::FromBase64String($base64)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Get-Dnd35InlineImportCommand {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Model
    )

    $json = $Model | ConvertTo-Json -Depth 12 -Compress
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
    return "!dnd35import B64:$encoded"
}

function Get-Dnd35HandoutJson {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Model
    )

    $handoutModel = ConvertTo-HandoutSafeModel -Model $Model
    $payloadJson = ConvertTo-AsciiSafeJson -InputObject $handoutModel
    $envelope = [pscustomobject][ordered]@{
        format = 'dnd35-roll20-handout-envelope'
        version = '1.0'
        encoding = 'base64url-utf8'
        payload = (ConvertTo-Base64UrlUtf8 -Text $payloadJson)
    }

    return ($envelope | ConvertTo-Json -Depth 6 -Compress)
}

Export-ModuleMember -Function @(
    'ConvertTo-Dnd35JsonModel',
    'ConvertFrom-ProjectModelToDnd35Json',
    'Export-Dnd35Json',
    'Import-Dnd35Json',
    'Get-Dnd35InlineImportCommand',
    'Get-Dnd35HandoutJson'
)
