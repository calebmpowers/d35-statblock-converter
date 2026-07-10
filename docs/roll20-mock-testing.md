# Roll20 Mock Importer Testing

Roll20 does not publish a local copy of its Mod/API sandbox runtime. The project tests the importer with a small local mock that implements the Roll20 calls used by `D35_Statblock_Importer.js`: object creation, object lookup, chat events, handouts, attributes, abilities, selected tokens, and GM chat output.

## What It Tests

- The importer script loads and registers its `ready` and `chat:message` handlers.
- Converted JSON payloads can be stored in mock handouts and imported with `!d35import`.
- A character is created for each payload.
- Core sheet attributes are created: CR, AC, HP, saves, possessions, spells, and spellbook entries.
- The selected token is bound to the imported character and receives HP/AC bars.
- Token actions are created for Initiative and weapon attacks.
- Spellbook entries include unprepared spell rows.

This does not run Roll20's real character sheet workers. It verifies that our importer creates the Roll20 objects and attributes we expect.

## Run The Default Mock Test

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\roll20_mock_test.ps1
```

By default this tests JSON files in `Converted JSON` against `D35_Statblock_Importer.js`.

## Run Against A Specific Output Folder

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\roll20_mock_test.ps1 -JsonDirectory ".\Converted JSON"
```

## Full Smoke Test

The main smoke test now includes the Roll20 mock importer check after converting the fixture stat blocks:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\smoke_test.ps1
```
