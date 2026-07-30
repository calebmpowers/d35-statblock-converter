# Parser Standard

`templates/D&D 3.5e Stat Block Template.docx` is the authoritative source format. The DOCX paragraph/run model is part of the contract.

## Input model

DOCX extraction retains, per paragraph:

- normalized visible text;
- source paragraph number;
- run text with bold and italic flags;
- the consecutive leading-bold text;
- whether the complete paragraph is bold or italic.

Upper parsing continues to use visible labels, so existing `.docx`, `.txt`, pasted text, and folder workflows remain compatible. Plain text uses paragraph boundaries, visible headings, typed/bracketed signatures, conservative untyped recognition, and continuation preservation.

## Parser states

1. **Upper block:** recognized labels populate header, defense, offense, spell-list, and statistics fields.
2. **Ordinary lower entries:** after statistics, a DOCX paragraph with a leading bold entry name begins the alphabetical lower series. Bracketed, parenthetical, and untyped entries share one first-class collection. A `Skills` entry is also exposed separately.
3. **Spell Reference:** an exact `Spell Reference` heading ends ordinary entries. Bold level headings and spell-name paragraphs, italic compact lines, and ordinary body paragraphs are parsed structurally.
4. **Unrelated notes:** text not safely assignable to those structures remains in notes/warnings.

The Spell Reference boundary is recognized before ordinary ability continuation. A final `(Ex)`, `(Su)`, `(Sp)`, or `(Ps)` entry therefore cannot absorb spell headings or bodies.

## Intermediate and handout model

The project model and optional `schema_version: 1` handout additions keep these distinct:

- existing `creature.header`, `defense`, `offense`, and `statistics`;
- `creature.ordinary_entries`;
- `creature.lower_skills_entry`;
- `creature.spell_reference`;
- `creature.special_abilities` and `statistics.feat_details` compatibility views;
- `creature.bio_notes`;
- top-level `warnings`.

No schema bump was required. Older importers ignore the optional additions; the 0.4 importer consumes them.

Each ordinary entry contains `name`, `type`, `type_style`, `body`, and `raw`. Spell Reference contains levels and spell entries with `name`, `compact_rules`, `body_paragraphs`, `body`, `raw`, and match status.

## Spell matching and duplication

Only upper prepared/known spell records participate in reference matching. Match keys remove DC/prepared-count decorations and trailing domain/specialist markers while preserving the original names and marks in output.

Spell Reference never creates a second `offense.spell_sections` record. Repeated prepared names collapse to one repeating Roll20 spell while prepared counts are summed. Known spells import once. `Spellbook` entries remain unprepared. Unmatched upper and reference entries produce explicit warnings; unmatched reference text remains in `creature.spell_reference`.

Authoritative reference text overrides a bundled generic macro for the repeating spell macro. The compact line populates the spell detail field. The complete Spell Reference is also placed in Roll20's Other field, which preserves unmatched material without turning every spell into a token action.

## Roll20 destinations

- bracketed ordinary entries: `feats` and `npcfeats`;
- typed and untyped ordinary entries: `racialabilities`;
- lower Skills rules: per-skill notes where safely parsed, plus the Other reference field;
- Spell Reference: matched repeating spell macros/details and complete Other reference text;
- unrelated notes: biography/mechanical split retained for legacy payloads.

Initiative and weapon attacks remain the only token actions.

## Baseline rules

The converter trusts upper numerical values. It does not reverse-audit, "correct," or reapply old printed adjustments. In particular:

- Power Attack lower text never subtracts attack or adds damage;
- temporary lower effects never overwrite AC, hp, saves, attacks, or skills;
- stable continuous/permanent effects remain incorporated exactly as authored;
- parenthetical conditional skill totals remain notes and are not added to the baseline total;
- lower Skills text never double-counts an upper value.

## Compatibility

Windows PowerShell 5.1 remains the shipping runtime. Existing upper labels, schema version 1, desktop app modes, unique filenames, diagnostic output, handout JSON, inline commands, legacy fixtures, and Roll20 mock imports remain supported.

Legacy plain-text casters without a Spell Reference remain accepted without a new missing-section warning. Authoritative DOCX casters require the section; partial references in either format report unmatched entries.
