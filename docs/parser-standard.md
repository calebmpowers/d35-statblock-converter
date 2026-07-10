# Parser Standard

This document defines the intended source format for the D35 converter.

The source standard is based on `templates/Dungeon Magazine Stat Block Template.txt`, exported from the user's Google Docs template. Most fields are optional, but fields should appear in the order shown here when present.

## Section Order

### 1. Header

Expected order:

- `Character Name CR XX`
- Creature race, templates, and class levels
- Creature alignment, size, and type/subtype
- Creature reference
- `Init ...; Senses ...; Listen ..., Spot ...`
- `Aura ...`
- `Languages ...`

Current destination:

- Name and CR go to `creature.name` and `creature.cr`.
- Race/templates/classes go to `creature.header.ancestry`.
- Alignment/size/type goes to `creature.header.alignment_size_type`.
- Reference goes to `creature.header.source_reference`.
- Initiative and senses stay in `creature.header.init_line`.
- Aura lines stay in `creature.header.aura_lines`.
- Languages stay in `creature.header.languages_line`.

### 2. Defense

Expected order:

- `AC ..., touch ..., flat-footed ...; ...`
- `hp ... (... HD); ...; DR .../...`
- `Immune ...`
- `Resist ... SR ...`
- `Fort ..., Ref ..., Will ...`
- `Weaknesses ...`

Current destination:

- AC line goes to `creature.defense.ac_line`.
- HP and DR text goes to `creature.defense.hp_line`.
- Immunities go to `creature.defense.immune_line`.
- Resistances and SR go to `creature.defense.resist_line`.
- Saves go to `creature.defense.fort_ref_will_line`.
- Weaknesses go to `creature.defense.weaknesses_line`.

### 3. Offense

Expected order:

- `Spd ...`
- `Melee ...`
- `Ranged ...`
- `Space ...; Reach ...`
- `Base Atk ...; Grp ...`
- `Atk Options ...`
- `Special Actions ...`
- `Combat Gear ...`
- Spellcasting sections
- Spell-like ability sections
- Incorporated-stat-block notes marked with `*`

Current destination:

- Speed goes to `creature.offense.speed_line`.
- Melee attacks go to `creature.offense.melee_lines`.
- Ranged attacks go to `creature.offense.ranged_lines`.
- Space/reach goes to `creature.offense.space_reach_line`.
- Base attack/grapple goes to `creature.offense.base_attack_line`.
- Attack options go to `creature.offense.attack_options_line`.
- Special actions go to `creature.offense.special_actions_line`.
- Combat gear is merged into `creature.statistics.possessions`.
- Spell and spell-like sections go to `creature.offense.spell_sections`.

### 4. Statistics

Expected order:

- `Abilities Str ..., Dex ..., Con ..., Int ..., Wis ..., Cha ...`
- `SQ ...`
- `Feats ...`
- `Skills ...`
- `Possessions combat gear, ...`
- `Spellbook ...`
- Incorporated ability-score notes marked with `*`

Current destination:

- Ability scores go to `creature.statistics.abilities_line`.
- Special qualities go to `creature.statistics.sq_line`.
- Feats go to `creature.statistics.feats`.
- Skills go to `creature.statistics.skills`.
- Parsed racial/conditional skill bonuses go to `creature.statistics.skill_bonuses`.
- Possessions go to `creature.statistics.possessions`.
- Spellbook entries go to `creature.offense.spell_sections` as unprepared spell entries.

### 5. Special Abilities

Expected format:

- `Special Ability Name (Sp/Su/Ex) Special ability description.`

Current destination:

- Special ability blocks go to `creature.special_abilities`.
- These are used by the Roll20 importer for text sections and ability references.

## Parser Contract

- Separator lines made of underscores may appear between sections.
- Blank lines may appear between sections.
- Fields may be omitted.
- Fields that appear should keep the template order.
- Line prefixes are meaningful and should stay close to the template names.
- Parenthetical details should be preserved unless the parser has an explicit field for them.
- Asterisk notes are meaningful. They should help the parser avoid double-counting incorporated bonuses, then be preserved as notes when useful.
- Token actions should be limited to weapon attacks and initiative for now.
- Combat gear should be treated as possessions.
- Spellbook spells should be added to the character sheet's spell list, but should not be marked prepared or used unless they also appear in prepared/used spell sections.

## Open Mapping Questions

These fields need user confirmation before we hard-code more precise Roll20 destinations:

- Should `Aura` become only descriptive text, or should common aura mechanics create token actions?
- Should `Weaknesses` map only to an info field, or should common weaknesses have sheet-level attributes?
- Should `Domains/Prohibited schools` populate a dedicated spellcasting notes field?
- Which incorporated-bonus notes should alter parser math automatically, and which should remain descriptive only?
