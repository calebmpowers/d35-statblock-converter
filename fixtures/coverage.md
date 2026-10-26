# Fixture Coverage

The fixture suite is meant to grow around parser risk. Each raw input lives in `fixtures/statblocks`, and expected key fields live in `tests/fixture_manifest.json`.

## Current Coverage

The suite explicitly covers ordinary lower entries, optional lower Skills, parenthetical conditional totals, stable versus temporary effects, unaffected Power Attack baselines, prepared duplicates, domain/specialist marks, unprepared spellbooks, multi-paragraph spell bodies, the final-ability/Spell-Reference boundary, unmatched warnings, no-spell creatures, DOCX run formatting, plain-text fallback, and resulting Roll20 character fields.

| Case | Fixture |
| --- | --- |
| Simple martial creature | `Goblin Raider.txt` |
| Ooze traits and missing ability scores | `Ochre Jelly.txt`, `Advanced Ochre Jelly.txt` |
| Aberration with climb speed and special abilities | `Ettercap.txt`, `Ettercap Hunter.txt` |
| Complex published-style spellcaster/monster | `Chittrik, Black Spinner Shaman.txt` |
| Large aberration with spell-like and special attacks | `Avatar of the Black Spinner.txt` |
| High-complexity recovered example | `Xochitona.txt` |
| Swarm, incorporeal, undead traits | `Ashen Grave Swarm.txt` |
| Psionic powers | `Crystal Mindhunter.txt` |
| Manufactured weapon plus natural attacks | `Dire Ape Veteran.txt` |
| Full attack bonuses, reach, grapple, trip | `Reach Grappler.txt` |
| Prepared divine caster | `Temple Adept.txt` |
| Prepared arcane caster and spellbook | `Vancian Necromancer.txt` |

## Remaining Targets

These are useful future additions when real examples appear:

- Spontaneous caster with spells known.
- Tome of Battle maneuvers and stances in standard source text.
- Mounted creature or rider plus mount.
- Shapechanger with alternate form stat text.
- Monster with template changes called out inline.
- Web-copy stat block with inconsistent spacing.
- PDF-copy stat block with broken punctuation and merged lines.
- Creature with several conditional skill bonuses in prose.

When a target is added, keep the original text as close to the source as possible. The parser should adapt to the text, not the other way around, except for the agreed Dungeon Magazine-style ordering.
