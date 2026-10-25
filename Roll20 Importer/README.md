# Roll20 Importer

This folder contains the Roll20 API companion script for the local D35 converter.

Use `D35_Statblock_Importer.js` in Roll20's API Scripts page.

Current bundled version: `0.6.0`.

Basic import workflow:

1. Convert a stat block with the local converter using `Handout JSON`.
2. Create a Roll20 handout.
3. Paste the converted JSON into the handout's GM Notes.
4. Place the desired image token on the map and select exactly one unbound token.
5. Run `!D35 Handout Name` in Roll20 chat (spaces supported; no flags needed).

Creation configures the sheet, portrait, token association, unlinked HP/AC bars, visibility, reusable default token, and token actions, then verifies stored objects. Invalid inputs fail before creation. Bio and NPC Description contain only the canonical source reference. Attack actions remove zero/inactive terms using current sheet values at click time; the importer must remain installed.

The importer expects `schema_version: 1` payloads. Version 0.4 consumes the optional ordinary-lower-entry, lower-Skills, and Spell Reference fields while remaining compatible with older version 1 payloads.

## Managed Lifecycle v1 (0.6.0)

Updates use explicit Character and handout IDs; `preview` checks conflicts before `update`, and `audit` verifies stored Roll20 objects. Creation copies the portrait automatically; later `bind` preserves it unless `--avatar` is supplied. Existing unmanaged Characters require explicit `adopt` before updates. See [commands, preservation rules, and commissioning](../docs/managed-lifecycle-v1.md) and [verification and limitations](../Releases/0.6.0.md).
