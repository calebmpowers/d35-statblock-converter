# Stat Block Authoring Guide

The authoritative input is `templates\D&D 3.5e Stat Block Template.docx`. Keep its visible formatting: upper labels and lower entry names are bold, Spell Reference names and headings are bold, and each compact spell rules line is italic. The converter reads that formatting; finished stat blocks need no hidden tags, machine-only markup, or separate conversion copy.

## Stable baseline

The upper block is the numerical source imported into Roll20. Write the creature's stable, normal configuration there: racial, class, and template features; equipped weapons and armor; stable gear; continuous item effects; permanent effects; inherent bonuses; and effects that are effectively always active.

Do not pre-apply temporary, optional, consumable, tactical, encounter-dependent, or situational changes. Power Attack, Combat Expertise, fighting defensively, rage, smite, short-duration spells, activated effects, poison for one encounter, charging, flanking, cover, and higher ground belong in options or lower rules text. If a published block printed one of those adjustments, restore the unaffected baseline during production.

Power Attack normally appears under `Atk Options` and as a complete lower feat entry. State the available maximum and exchange, but do not select a fixed penalty. The converter imports the attack and damage values exactly as written and does not reconstruct obsolete asterisked Power Attack adjustments.

## Upper stat block

Keep the familiar Dungeon-style order and labels:

1. Name and CR; ancestry/classes; alignment, size, and type; source.
2. `Init`, `Aura`, and `Languages`.
3. `AC`, `hp`, defenses, saves, and weaknesses.
4. `Spd`, attacks, space/reach, base attack/grapple, options, actions, gear, and spellcasting.
5. `Abilities`, `SQ`, `Feats`, `Skills`, `Possessions`, and optional `Spellbook`.

The upper `Skills` line supplies sheet totals. A parenthetical conditional total such as `Move Silently +13 (+17 in forested areas)` is supplemental: the first number remains the baseline, and the condition is retained in the skill note. It is not a second skill or an extra modifier.

`Spellbook` lists unprepared book contents. Those entries remain unprepared and do not require Spell Reference entries unless they are also prepared.

## Ordinary lower entries

After the upper block, write one continuous alphabetical series. Do not insert category headings. Each entry is one run-in paragraph whose entry name (including an optional type) is bold:

```text
Power Attack [General] Complete applicable feat text. (Player's Handbook, page 98.)
Pounce (Ex) Complete applicable ability text.
Improved Grab Complete applicable named mechanic text.
Gargoyle Crown Complete item-effect text. (DUNGEON #143, page XX.)
```

Valid entries include bracketed feats, `(Ex)`, `(Su)`, `(Sp)`, and `(Ps)` abilities, class and template features, qualities, item effects, spell mechanics, and untyped named rules. The converter does not require a type.

A lower `Skills` entry is optional. Use it only for distinctive play rules such as racial or conditional bonuses, unusual uses, ability substitutions, take-10 permissions, movement rules, and relevant synergies. Do not reconstruct ranks, ability modifiers, class-skill status, armor penalties, or every upper total. The converter never adds the lower rule on top of an already-final upper total.

## Spell Reference

Prepared and spontaneous casters add `Spell Reference` after every ordinary lower entry. Creatures with only spell-like abilities do not. Creatures without prepared or known spells omit it.

For each level, descending:

1. A bold level heading such as `3rd-Level Spells`.
2. A separate bold paragraph for the spell name.
3. A separate italic paragraph containing final creature-specific rules fields.
4. One or more ordinary body paragraphs preserving mechanically relevant published wording and the citation.

Include each prepared spell once even when prepared multiple times, and every spell known once. Preserve domain and specialist markings. Do not expand unprepared `Spellbook` entries.

The upper list remains authoritative for level, slots/usage, prepared count, save DC, caster level, casting track, and domain/specialist marks. Spell Reference supplies detailed text for those records. Safe name matches attach the reference to the upper spell. An unmatched item is preserved and reported rather than discarded.

The source reference text takes precedence over the bundled generic macro library. In Roll20, it appears in the spell's macro and compact details; the complete section is also retained in the character's Other reference field.

## Plain-text fallback

DOCX is authoritative because plain text cannot retain bold and italic runs. A text export remains supported when it keeps one logical paragraph per line and the visible `Spell Reference` and level headings.

Typed and bracketed lower entries are recognized directly. For untyped entries, use a conservative visible boundary such as:

```text
Improved Grab - Complete mechanic text.
```

Common run-in sentences beginning with `The`, `A`, `An`, `When`, `If`, or `This` are also recognized. Lines that cannot be distinguished safely are preserved as continuation text or notes with a warning; they are not dropped.

## Before import

Review warnings, then verify name, CR, AC, hp, saves, attacks, upper skill totals, prepared counts, and Spell Reference matches. Import the generated handout JSON and inspect the Roll20 character's Feats, Racial Abilities, Other, skills, and repeating spells. Only initiative and weapon attacks become token actions.
