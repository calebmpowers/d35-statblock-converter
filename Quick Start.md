# D35 Statblock Converter Quick Start

## Open The Converter

Double-click `Launch D35 Converter.bat`.

The app opens a local window with three ways to convert:

- Paste a stat block.
- Choose one `.txt` or `.docx` file.
- Convert a whole folder of `.txt` or `.docx` files.

## Recommended Workflow

1. Open `templates\D&D 3.5e Stat Block Template.docx`, save a working copy, and follow `Stat Block Authoring Guide.md`.
2. Save the completed DOCX. Plain text and pasted text remain conservative fallbacks.
3. Open `Launch D35 Converter.bat`.
4. Use the `Paste` tab or the `File` tab.
5. Leave output set to `Handout JSON`.
6. Click convert.
7. Review any warning count in the status line, then open the report if warnings were found.
8. Copy the output or open the output folder.
9. Paste the JSON into a Roll20 handout's GM Notes.
10. Put the desired token image on the Roll20 map and select exactly that token.
11. In Roll20 chat, type `!D35 Handout Name`, for example `!D35 Tonatiuh`. Spaces in names need no quotes.
12. Wait for stored-object verification. The Character, sheet, portrait, linked token, HP/AC bars, saved default token, and token actions are configured automatically.

Use a unique handout name and an unbound token with a valid image. Invalid selection, ambiguous names, unsuitable images, or invalid JSON stop creation. Check the reported error before retrying. If an operation failed after writes began, use `audit` and `report` to inspect its pending state before attempting another import.

Bio and NPC Description contain only the source reference supplied by the stat block. Attack actions omit inactive modifiers at click time; buffs enabled later remain available. Keep the importer installed. Check real sheet calculations and attack rolls in your game before relying on them in play.

## Output Modes

- `Handout JSON`: the normal Roll20 handout payload. Use this most of the time.
- `Inline command`: legacy `!dnd35import B64:` output for older tooling. The bundled managed importer does not consume it; use `Handout JSON` for this release.
- `Diagnostic model`: a fuller parser model for debugging converter behavior.

## Folders

- `Stat Blocks`: default place to keep raw input text files.
- `Converted JSON`: converted Roll20-ready output.
- `reports`: conversion reports from the app and older command-line tools.
- `Spell Macros`: spell macro library used during spell conversion.
- `fixtures`: regression-test stat blocks.
- `Roll20 Importer`: copy of the Roll20 API script to paste into Roll20.

The app never overwrites an existing converted file. If an output name is already in use, it adds a number such as `Goblin Raider (2).dnd35.json`.

## Roll20 Setup

1. Open your Roll20 game.
2. Go to API Scripts.
3. Create or update the D35 importer script.
4. Paste the contents of `Roll20 Importer\D35_Statblock_Importer.js`.
5. Save the script.
6. In chat, run `!d35import --help` to confirm it is installed.

## Testing The Tool

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\smoke_test.ps1
```

Run the payload validator:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Test-Roll20ImporterPayload.ps1
```

## Managed Lifecycle v1 (0.6.0)

For corrections, reconvert and replace the handout JSON, then use `!d35 preview <character-id> <handout-id>` followed by `!d35 update <character-id> <handout-id>`. This retains the Character and protects live HP, spent spells, manual additions, and encounter tokens. Creation copies the portrait automatically; later `bind` changes it only with `--avatar`. Existing unmanaged Characters require explicit `adopt` before updates. See [commands, preservation rules, and commissioning](docs/managed-lifecycle-v1.md).
