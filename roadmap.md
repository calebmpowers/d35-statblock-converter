# D35 Statblock Converter Roadmap

## Goal

Turn the recovered D&D 3.5 stat block tooling into an easy local program that can accurately convert pasted or saved D&D 3.5 stat blocks into Roll20-ready character-sheet import data.

The finished workflow should feel like this:

1. Open the local converter.
2. Paste a stat block or choose one or more files.
3. Click convert.
4. Review any warnings.
5. Copy or save Roll20 handout JSON.
6. Import it in Roll20 with the companion API script.

## Current Baseline

The workspace already contains a working recovery baseline.

- `Convert-D35StatBlock.ps1` converts one stat block into the current Roll20 handout JSON format.
- `Dnd35JsonTools.psm1` adapts parsed stat block data into `schema_version: 1` importer JSON.
- `DungeonStatBlockParser.psm1` contains the main PowerShell parsing engine.
- `D35_Statblock_Importer.js` is the Roll20 API script that reads the handout JSON and fills out the D&D 3.5 character sheet.
- `tools/statblock_converter.py` supports friendlier bulk conversion, but overlaps with the PowerShell converter.
- `tests/smoke_test.ps1` verifies the recovered sample through both conversion paths.
- `Spell Macros` contains reusable Roll20 spell macro text used during spell import.

The immediate concern is schema drift: some saved JSON files use an older flattened format, while the current Roll20 importer expects `schema_version: 1`.

## Guiding Decisions

- Treat the `schema_version: 1` Roll20 handout JSON as the canonical output format.
- Treat the root-level scripts and modules as the canonical source.
- Preserve recovered and legacy files as references, but do not build new workflows around them.
- Prefer incremental accuracy improvements backed by fixtures and regression tests.
- Keep the user-facing app simple first, then improve packaging once the conversion path is stable.

## Phase 1: Stabilize The Canonical Converter

Status: complete as of 2026-05-11.

Purpose: make the current conversion path trustworthy before wrapping it in an app.

Tasks:

- Completed: confirmed `Convert-D35StatBlock.ps1` is the supported single-stat-block converter.
- Completed: kept `tools/statblock_converter.py` for comparison and legacy bulk workflows only.
- Completed: separated older flattened JSON outputs into `Converted JSON\legacy-format`.
- Completed: added a clear schema note to `README.md`.
- Completed: expanded `tests/smoke_test.ps1` into a fixture-based regression suite.
- Completed: added active fixtures for:
  - Advanced Ochre Jelly
  - Avatar of the Black Spinner
  - Chittrik, Black Spinner Shaman
  - Ettercap Hunter
  - Ettercap
  - Goblin Raider
  - Ochre Jelly
  - Xochitona
- Completed: validate key fields for each fixture:
  - name
  - CR
  - alignment, size, type
  - initiative and senses
  - AC, HP, saves
  - speed, space, reach
  - base attack and grapple
  - melee and ranged attacks
  - abilities
  - feats
  - skills and skill bonuses
  - possessions
  - spells, powers, maneuvers, and special abilities where present

Exit criteria:

- Running the test suite proves the canonical converter produces stable `schema_version: 1` JSON for all fixtures.
- Current and legacy output formats are clearly separated.
- The README tells the user which converter to use and what output to expect.

## Phase 2: Clean Up The Roll20 Importer

Status: complete as of 2026-05-11 for offline cleanup and validation. Live Roll20 import testing remains a follow-up hardening task.

Purpose: make the Roll20-side importer easier to trust, maintain, and test.

Tasks:

- Completed: deduplicated repeated helper functions in `D35_Statblock_Importer.js`.
- Completed: preserved the latest recovered behavior while removing override-order ambiguity.
- Completed: added duplicate-function detection to `tests\smoke_test.ps1`.
- Completed: created `tools\Test-Roll20ImporterPayload.ps1` for offline payload and importer validation.
- Completed: bumped the importer version to `0.3.0`.
- Deferred: live Roll20 import testing with selected fixture payloads.
- Deferred: help text refinement after the local app workflow exists.

Known cleanup targets:

- Completed: duplicate `normalizeText` definitions.
- Completed: duplicate `repairText` definitions.
- Completed: duplicate `parseDamageText` definitions.
- Completed: duplicate-helper detection now guards against future repeats.

Exit criteria:

- Complete: the importer has one clear implementation of each helper.
- Complete: existing valid handout JSON passes offline payload validation.
- Partial: invalid or old-format JSON rejection is covered structurally by the validator and importer schema check, but user-facing Roll20 message quality still needs live testing.

## Phase 3: Build The Local Converter App

Status: complete as of 2026-05-11 for the first local Windows app wrapper. Hands-on UI testing remains a follow-up.

Purpose: make conversion accessible without needing to edit scripts or ask Codex to run commands.

Recommended first version: a lightweight Windows local app that wraps the existing PowerShell converter.

Core user interface:

- Completed: paste stat block text.
- Completed: choose a `.txt` or `.docx` stat block file.
- Completed: choose a folder for batch conversion.
- Completed: convert.
- Completed: preview output.
- Completed: save output to `Converted JSON`.
- Completed: write conversion reports.
- Completed: open the latest conversion report.

Nice-to-have controls:

- Completed: choose output mode:
  - Roll20 handout JSON
  - inline import command
  - diagnostic parser model
- Deferred: choose spell macro library folder in the UI.
- Completed: copy output to clipboard.
- Completed: open output folder.
- Deferred: re-run last conversion.

Exit criteria:

- Complete: the app can convert pasted text.
- Complete: the app can convert a selected file.
- Complete: the app can batch convert a folder.
- Complete: the user can get Roll20-ready JSON without touching the command line.

## Phase 4: Accuracy Expansion

Status: complete as of 2026-05-11 for the first hard-case fixture expansion. This phase should continue as new real stat blocks appear.

Purpose: move from "works on known examples" to "handles real D&D 3.5 stat blocks reliably."

Build a fixture library for hard cases:

- Completed: simple martial creature.
- Completed: multiattack natural attacker.
- Completed: manufactured weapon plus natural attacks.
- Completed: full attack lines with multiple bonuses.
- Completed: prepared arcane caster.
- Completed: prepared divine caster.
- Deferred until a real example is available: spontaneous caster.
- Completed: psionic creature.
- Deferred until a real example is available: Tome of Battle maneuvers and stances in standard source text.
- Completed: swarm.
- Completed: incorporeal creature.
- Completed: grapple-focused creature.
- Completed: creature with unusual reach or space.
- Completed: creature with racial skill bonuses through existing recovered examples.
- Deferred until a real example is available: creature with several conditional skill bonuses.
- Partial: creature with templates or advancement through advanced creature examples.
- Deferred until a real example is available: stat block copied from PDF text with broken punctuation.
- Deferred until a real example is available: stat block copied from web text with inconsistent spacing.

For each fixture:

- Save the raw input stat block.
- Save expected canonical JSON.
- Save notes for any ambiguous fields.
- Add automated assertions for fields that should not regress.

Exit criteria:

- Complete: new parser fixes are driven by failing fixtures.
- Complete for current sample set: known hard stat block shapes are covered by tests.
- Partial: conversion warnings are tracked by tests, but warning language should improve as more real failures are observed.

## Phase 5: Packaging And One-Click Use

Status: complete as of 2026-05-11 for a self-contained project-folder package.

Purpose: make the tool feel like a normal local program.

Tasks:

- Completed: create a stable project folder layout:
  - `Stat Blocks`
  - `Converted JSON`
  - `reports`
  - `Spell Macros`
  - `fixtures`
  - `Roll20 Importer`
- Completed: add a project-folder shortcut and launcher batch file.
- Blocked by workspace permissions: creating a Desktop shortcut directly. Use `tools\Create-DesktopShortcut.ps1` from a normal desktop session to retry.
- Completed: bundle the Roll20 API script with clear setup instructions.
- Completed: add a quick-start guide for first-time use.
- Completed: package as a PowerShell-based app folder for this release.
- Completed: add release notes for version `0.3.0`.

Exit criteria:

- Complete: a non-technical user can open the app, convert a stat block, and import it into Roll20 using documented steps.
- Complete: the app can be moved or backed up as a self-contained local tool.

## Suggested Immediate Work Order

1. Create a fixtures folder and move known test inputs into it.
2. Convert all known examples using the canonical converter.
3. Archive or rename older JSON outputs so old and current formats are not mixed.
4. Expand the smoke test into a fixture regression test.
5. Clean duplicate helpers in the Roll20 importer.
6. Build the first local app wrapper.
7. Package the app with quick-start docs.

## Open Questions

- Should the Python converter become the future core, or should PowerShell remain the canonical parser?
- Do we want the local app to output only handout JSON, or also create inline Roll20 chat import commands?
- How much manual review should the app require before import?
- Should converted output include a confidence score or just warnings?
- Should spell macros be bundled as-is, or should the app include a spell macro manager later?

## Definition Of Done

This project is done when the user can convert most D&D 3.5 stat blocks locally without Codex assistance, receive clear warnings for uncertain parses, and reliably import the result into a Roll20 D&D 3.5 character sheet with attacks, skills, spells, special abilities, and core stats populated correctly.
