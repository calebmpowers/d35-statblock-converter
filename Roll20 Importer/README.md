# Roll20 Importer

This folder contains the Roll20 API companion script for the local D35 converter.

Use `D35_Statblock_Importer.js` in Roll20's API Scripts page.

Current bundled version: `0.5.0`.

Basic import workflow:

1. Convert a stat block with the local converter using `Handout JSON`.
2. Create a Roll20 handout.
3. Paste the converted JSON into the handout's GM Notes.
4. Run `!d35import <handout name>` in Roll20 chat.

The importer expects `schema_version: 1` payloads. Version 0.4 consumes the optional ordinary-lower-entry, lower-Skills, and Spell Reference fields while remaining compatible with older version 1 payloads.

## Managed Lifecycle v1 (0.5.0)

Imports create managed Characters. Updates use explicit Character and handout IDs; `preview` checks conflicts before `update`, and `audit` verifies stored Roll20 objects. Token images are copied to the Character portrait only with `--avatar`. Existing Characters require explicit `adopt` before updates. See [commands, preservation rules, and commissioning](../docs/managed-lifecycle-v1.md).
