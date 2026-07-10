# Stat Block Authoring Guide

Use this guide with `templates\Dungeon Magazine Stat Block Template.txt` to create stat blocks the converter can read consistently.

## Fast workflow

1. Copy the template into a new Google Doc, Word document, or plain-text file.
2. Replace every `XXX` placeholder with the creature's actual information; remove fields the creature does not have.
3. Keep the section order and field labels from the template.
4. Export as UTF-8 `.txt`, or save as `.docx`.
5. Convert it in the app, review its report, and correct any warnings before importing into Roll20.

Use one creature per file. Keep ordinary paragraphs and adventure prose out of the file; the converter expects only a stat block and its special abilities.

## Required structure

The parser is most reliable when you preserve these four sections in order. Underscore divider lines and blank lines are optional but recommended.

### Header

Start with the creature's name and CR on one line:

```text
Example Creature CR 3
```

Follow with, in order when available:

```text
Race, templates, and class levels
Alignment, size, and type (subtypes)
Source or reference
Init ...; Senses ...; Listen ..., Spot ...
Aura ...
Languages ...
```

Keep `Init`, `Senses`, `Aura`, and `Languages` at the beginning of their lines.

### Defense

Use the template labels exactly where possible:

```text
AC ..., touch ..., flat-footed ...; modifiers
hp ... (... HD); DR ...
Immune ...
Resist ...; SR ...
Fort ..., Ref ..., Will ...
Weaknesses ...
```

`AC`, `hp`, and the three saves are especially important. Omit an optional line entirely rather than leaving `XXX` in it.

### Offense

Start this section with `Spd`. Put attacks on lines beginning with `Melee` or `Ranged`.

```text
Spd 30 ft., climb 20 ft.
Melee claw +6 (1d6+3)
Ranged shortbow +4 (1d6/x3)
Space 5 ft.; Reach 5 ft.
Base Atk +3; Grp +6
Atk Options ...
Special Actions ...
Combat Gear ...
```

For spellcasters, keep the spell heading and spell-level lines together. Use the template's spelling for `Spells Prepared`, `Spells Known`, or `Spell-Like Abilities`; list spell levels from highest to lowest.

```text
Spells Prepared (CL 5th):
3rd (2/day)—spell name, spell name
2nd (3/day)—spell name
```

The converter uses the bundled macro library when it finds a matching spell name. A missing macro is a warning to review, not a failed conversion.

### Statistics and special abilities

Keep the ability-score label and order intact:

```text
Abilities Str ..., Dex ..., Con ..., Int ..., Wis ..., Cha ...
SQ ...
Feats ...
Skills ...
Possessions ...
Spellbook ...
```

Place each special ability after the statistics block, one ability per paragraph, in this form:

```text
Ability Name (Ex) Description.
```

Use `(Ex)`, `(Su)`, or `(Sp)` when known. An asterisk at the start of a line marks a note about a bonus already included in the stat block; retain it so the converter can avoid double-counting that bonus.

## Formatting rules that prevent trouble

- Use plain text: no tables, text boxes, two-column layouts, headers, or footers.
- Keep each labeled field on one line. Long special-ability descriptions may wrap naturally.
- Do not rename labels such as `Spd`, `Melee`, `Abilities`, `Feats`, or `Skills`.
- Use commas between entries and keep parenthetical details, such as damage, save DCs, and maneuverability.
- For a creature with no value for an optional field, remove that line instead of writing `None`, `N/A`, or placeholder text.
- Save text files in UTF-8. The app can also read ordinary `.docx` files.

## Before importing into Roll20

1. Read the conversion report. Warnings identify fields that deserve a manual check.
2. Open the JSON preview and confirm the creature name, CR, AC, hp, saves, attacks, skills, and spells.
3. Paste the handout JSON into the GM Notes of a Roll20 handout.
4. Run `!d35import <handout name>` in the Roll20 game with the companion API script installed.

For the complete parser mapping, see `docs\parser-standard.md`.
