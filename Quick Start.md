# D35 Statblock Converter Quick Start

## Open The Converter

Double-click `Launch D35 Converter.bat`.

The app opens a local window with three ways to convert:

- Paste a stat block.
- Choose one `.txt` or `.docx` file.
- Convert a whole folder of `.txt` or `.docx` files.

## Recommended Workflow

1. Write or collect a Dungeon Magazine-style D&D 3.5 stat block in Google Docs.
   - For new stat blocks, copy `templates\Dungeon Magazine Stat Block Template.txt` and follow `Stat Block Authoring Guide.md`.
2. Export it as plain text, or copy the text directly.
3. Open `Launch D35 Converter.bat`.
4. Use the `Paste` tab or the `File` tab.
5. Leave output set to `Handout JSON`.
6. Click convert.
7. Review any warning count in the status line, then open the report if warnings were found.
8. Copy the output or open the output folder.
9. Paste the JSON into a Roll20 handout's GM Notes.
10. In Roll20 chat, run `!d35import <handout name>`.

## Output Modes

- `Handout JSON`: the normal Roll20 handout payload. Use this most of the time.
- `Inline command`: a direct Roll20 chat command payload. Useful for quick tests, but it may be too long for complex creatures.
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
