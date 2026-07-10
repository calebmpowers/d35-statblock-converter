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

The supported Roll20 import format is `schema_version: 1` handout JSON. Use `Convert-D35StatBlock.ps1` when you want output intended for the current Roll20 API importer.

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

For reliable source formatting, start with `templates\Dungeon Magazine Stat Block Template.txt` and follow `Stat Block Authoring Guide.md`.

### Convert a single stat block to Roll20 handout JSON

Use `Convert-D35StatBlock.ps1`:

```powershell
powershell -ExecutionPolicy Bypass -File .\Convert-D35StatBlock.ps1 -Path .\sample-dungeon-statblock.txt
```

By default, the script writes output to `Converted JSON\<input-name>.dnd35.json`. The JSON is ready to paste into a Roll20 handout's GM Notes and uses `schema_version: 1` with `creature.header`, `creature.defense`, `creature.offense`, and `creature.statistics`.

Skill context such as racial skill bonuses is emitted under `creature.statistics.skill_bonuses`; the Roll20 importer applies those bonuses as skill misc modifiers rather than ranks.

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

Current active fixtures:

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

- The restored Roll20 importer is versioned as `0.3.0` and is covered by local mock sandbox tests. It still needs occasional live Roll20 spot checks because Roll20's real character sheet workers are not available locally.

## License and content

The original converter code and documentation are released under the [MIT License](LICENSE). Read [NOTICE.md](NOTICE.md) before redistributing the bundled template, spell macros, fixtures, or other game-content assets.
