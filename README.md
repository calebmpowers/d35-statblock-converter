# D35 Statblock Converter

A portable Windows application for converting D&D 3.5 stat blocks into Roll20-ready JSON and importing them with the included Roll20 API script.

## What Works

- Single-file conversion with PowerShell modules that emit the current Roll20 handout importer schema
- Fixture-based regression testing for recovered example stat blocks
- A Windows desktop app for pasted text, one file, or a folder of `.txt`/`.docx` stat blocks
- Fixture-based regression and Roll20 mock-import testing
- Bundled Roll20 API importer source in `Roll20 Importer\D35_Statblock_Importer.js`

## Requirements

To use the app, you need Windows 10 or later with Windows PowerShell 5.1 (included with supported Windows versions). The app has no Python or Node.js runtime dependency.

Python is retained only as a legacy recovery/comparison tool. Node.js 18 or later is required only when developers run the Roll20 mock test suite.

## Canonical Format

The authoritative authoring format is `templates\D&D 3.5e Stat Block Template.docx`. Its bold lower-entry names, bold Spell Reference headings/spell names, and italic compact spell lines are meaningful input structure. Finished stat blocks do not need hidden tags or a separate conversion copy.

The supported Roll20 import format remains `schema_version: 1` handout JSON. Version 1 now has backward-compatible optional fields for ordinary lower entries, the lower Skills entry, and Spell Reference. Use `Convert-D35StatBlock.ps1` when you want output intended for the current Roll20 API importer.

Converted JSON is treated as local output and is not included in the public source repository.

## Main Entry Points

### Open the local app

Double-click `Launch D35 Converter.bat`.

The app supports:

- pasted stat block text
- one `.txt` or `.docx` file
- a folder of `.txt` or `.docx` files
- handout JSON output
- inline Roll20 command output
- diagnostic parser-model output

See `Quick Start.md` for the normal workflow.

For reliable source formatting, start with `templates\D&D 3.5e Stat Block Template.docx` and follow `Stat Block Authoring Guide.md`. The `.txt` template is a fallback mirror, not the authority.

## From a Raw Stat Block to a Roll20 Character and Token

This is the complete everyday workflow. You do not need to know how to code.

### 1. Start with the raw stat block

Copy the creature's stat block from your source into a document. Keep the stat block itself, its attack lines, spell lists, and special abilities together. Leave out adventure text, flavor paragraphs, page headers, and tables.

### 2. Put it into the supplied template

Open `templates\D&D 3.5e Stat Block Template.docx` and save a working copy. Move the information from the raw stat block into the matching template lines, then remove instructions and fields the creature does not use. Replace every `XXX`; do not leave placeholders behind.

Keep the section order and labels such as `Init`, `AC`, `hp`, `Spd`, `Melee`, `Ranged`, `Abilities`, `Feats`, and `Skills`. This is what lets the converter recognize each part. The [Stat Block Authoring Guide](Stat%20Block%20Authoring%20Guide.md) explains spells, special abilities, and the most common formatting mistakes.

Write stable baseline values in the upper block. Put feats, abilities, class/template features, item effects, and named mechanics in the continuous alphabetical lower series. Prepared/known casters add the structured `Spell Reference` after those entries.

### 3. Save a clean input file

Save one creature per file as a normal `.docx`. UTF-8 `.txt` remains supported as a conservative fallback, but it cannot carry the authoritative bold/italic structure. Put the file in the `Stat Blocks` folder, or keep it anywhere you can browse to from the app.

### 4. Convert it

1. Double-click `Launch D35 Converter.bat`.
2. Choose the `File` tab, select your `.txt` or `.docx` stat block, and leave Output set to `Handout JSON`.
3. Click `Convert File`.
4. Read the status message. If it reports warnings, click `Open Report` and fix the source file before converting again.

The app writes a new JSON file in `Converted JSON`. It never overwrites an older conversion; it adds a number to the filename when needed.

### 5. Set up the Roll20 game once

This importer needs a Roll20 game using the compatible D&D 3.5 character sheet. Roll20's Mod (API) Scripts are available to a Pro subscriber's games and are installed separately for each game. [Roll20's Mod Script guide](https://help.roll20.net/hc/en-us/articles/360037256714-Introduction-to-Mod-Scripts-API) explains the current interface.

1. Open the game’s landing page in Roll20.
2. Open **Settings** → **Mod (API) Scripts**.
3. Choose **New Script**.
4. Name it `D35 Statblock Importer`.
5. Paste the contents of `Roll20 Importer\D35_Statblock_Importer.js`.
6. Save the script and let Roll20 restart its script sandbox.
7. In the game chat, run `!d35import --help` to confirm that the importer is available.

### 6. Import the character and create its token

1. In Roll20, create a handout with a memorable name, such as `Goblin Raider Import`.
2. Open the converted `.dnd35.json` file and paste its entire contents into that handout’s **GM Notes**.
3. Drag any token image onto the map and select that token.
4. In chat, run `!d35import <handout name>`, replacing `<handout name>` with the handout's exact name.

The importer creates the character, fills in the converted data, and binds the selected token to that character. It also sets the token’s health and AC bars. Open the character sheet afterward and quickly check the name, CR, AC, hit points, attacks, skills, and spells.

If a creature needs correction, edit the source stat block and reconvert it. With importer 0.5.0, use `!d35import preview <character-id> <handout-id>` and then `!d35import update <character-id> <handout-id>` to update the same managed Character. See [Managed Lifecycle v1](docs/managed-lifecycle-v1.md) for ownership, adoption, token binding, and audit commands.

### Convert a single stat block to Roll20 handout JSON

Use `Convert-D35StatBlock.ps1`:

```powershell
powershell -ExecutionPolicy Bypass -File .\Convert-D35StatBlock.ps1 -Path .\sample-dungeon-statblock.txt
```

By default, the script writes output to `Converted JSON\<input-name>.dnd35.json`. The JSON is ready to paste into a Roll20 handout's GM Notes and uses `schema_version: 1` with `creature.header`, `creature.defense`, `creature.offense`, and `creature.statistics`.

Skill context such as racial skill bonuses is emitted under `creature.statistics.skill_bonuses`; the Roll20 importer applies only explicit safe modifiers. Parenthetical conditional totals and lower Skills rules are retained as notes and are not added to an already-final upper total.

Complete lower rules are emitted under `creature.ordinary_entries`. `creature.lower_skills_entry` and `creature.spell_reference` remain distinct. Matched Spell Reference text drives the repeating spell macro/detail fields; the complete section, including unmatched entries, is also retained in the character's Other field.

### Batch conversion

For normal use, open the app and use the `Folder` tab. It creates unique output names instead of overwriting an existing conversion.

The legacy Python converter is available only for recovery comparison and is not a supported Roll20 import path:

```powershell
python .\tools\statblock_converter.py --input-dir ".\Stat Blocks" --output-dir ".\Converted JSON" --report-dir ".\reports" --spell-dir ".\Spell Macros"
```

Place input `.txt` stat blocks in `Stat Blocks`. JSON output is written to `Converted JSON`, and conversion reports are written to `reports`.

## Validation

For a full developer test run (requires Node.js 18+):

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\Run-Tests.ps1
```

If Node is installed somewhere other than `PATH`, pass its location explicitly:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\Run-Tests.ps1 -NodePath "C:\path\to\node.exe"
```

The smoke test verifies:

- PowerShell conversion of the sample fixture into `schema_version: 1`
- PowerShell conversion of every fixture in `fixtures\statblocks`
- Expected key fields from `tests\fixture_manifest.json`

Current active fixtures include the legacy set plus focused current-format cases for baseline Power Attack, conditional skills, prepared and spontaneous Spell References, unmatched spells, multi-paragraph bodies, and DOCX bold/italic extraction.

Legacy fixtures:

- Advanced Ochre Jelly
- Ashen Grave Swarm
- Avatar of the Black Spinner
- Chittrik, Black Spinner Shaman
- Crystal Mindhunter
- Dire Ape Veteran
- Ettercap Hunter
- Ettercap
- Goblin Raider
- Ochre Jelly
- Reach Grappler
- Temple Adept
- Vancian Necromancer
- Xochitona

To validate the current Roll20 importer and all JSON payloads in `Converted JSON`, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Test-Roll20ImporterPayload.ps1
```

This checks for duplicate importer helper functions and verifies each payload uses the supported `schema_version: 1` shape.

To run the local Roll20 mock importer sandbox, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\roll20_mock_test.ps1
```

Before creating a portable release, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Test-ReleaseReadiness.ps1
```

Create a portable Windows release folder with:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\New-PortableRelease.ps1
```

To exercise the non-shipping legacy Python comparison converter, run `tests\legacy_python_smoke_test.ps1`. It is deliberately excluded from the release gate.

## Current Gaps

- The Roll20 importer is covered by the local mock sandbox, including resulting sheet attributes, spell macros, and token actions. Roll20's real sheet workers and production API sandbox are not available locally, so a live-game spot check remains necessary before release.

## License and content

The original converter code and documentation are released under the [MIT License](LICENSE). Read [NOTICE.md](NOTICE.md) before redistributing the bundled template, spell macros, fixtures, or other game-content assets.

## Credits

Created and maintained by Caleb M. Powers. Developed with implementation, testing, and documentation assistance from OpenAI Codex.

## Managed Lifecycle v1 (0.5.0)

Imports create managed Characters. Updates use explicit Character and handout IDs; `preview` checks conflicts before `update`, and `audit` verifies stored Roll20 objects. Token images are copied to the Character portrait only with `--avatar`. Existing Characters require explicit `adopt` before updates. See [commands, preservation rules, and commissioning](docs/managed-lifecycle-v1.md).
