# D35 Map Pin Importer v0.1

This component creates one hidden heading-linked pin from an existing Journal
formatter pin plan. It requires the existing `D35_Journal_Importer.js`; it uses
that component's semantic HTML reader and digest function without changing the
Journal importer, formatter, or planner. No Handouts are written by this Mod.

Live acceptance completed in the disposable **d35** game on **2026-10-30**.
Native heading navigation, hidden visibility, source fidelity, actual synthetic
blockquote extraction, repeated import, and restart persistence passed. No
production-code correction was needed. The component remains unreleased. Evidence is local in Area 03: `Reports/Map-Pin-Live-Acceptance-20261030-068ef091/ACCEPTANCE.md`.

The live manual-change test used a native editor title change, which audit and
import preserved; the title was then restored manually. Canvas dragging was not
available through the background browser, so the drag-specific variation of
step 10 remains covered by automated tests. Player checks used Roll20's built-in
Re-Join as player mode on the actual test page. The original Start party page
was restored afterward. The temporary read-only diagnostic Mod is disabled.

## Package and commands

`tools/map_pin_package.py` wraps one entry from the existing `pin-plans.json`.
It requires an exact page ID and name, explicit finite nonnegative x/y pixels,
an explicit pin title, and a stable `pin_id`. An unresolved planner entry also
requires the actual imported Handout ID. It preserves the planner's heading,
visibility, synchronization, and native extraction settings. It rejects custom
notes, changed settings, and conflicting Handout IDs.

Run from Area 01, supplying values obtained from the disposable game:

```powershell
python tools/map_pin_package.py `
  --plan '..\03-Import-Staging\YOUR-EXISTING-EXPORT\pin-plans.json' `
  --pin-id savage-tide.tod.6.1.wrecked-wyvern.pin-test `
  --page-id=ACTUAL_PAGE_ID --page-name 'EXACT PAGE NAME' `
  --x 140 --y 210 --title 'The Wrecked Wyvern' `
  --handout-id=ACTUAL_HANDOUT_ID `
  --output-root '..\03-Import-Staging\Reports'
```

Use `--page-id=-...` and `--handout-id=-...` when an ID begins with a hyphen.
Do not paste placeholder IDs. The builder creates a new UUID directory and never
overwrites an older export. Outputs are `map-pin-package.json` and
`transfer-gmnotes.html`, both restricted to Area 03. The HTML file is an escaped
transport representation; it is not pin prose.

Put the JSON in the GM Notes of a GM-only transfer Handout. The transfer's
Description & Notes can remain empty. Commands accept its exact name or ID:

```text
!d35pin preview D35 Pin Transfer
!d35pin import D35 Pin Transfer
!d35pin audit D35 Pin Transfer
```

Preview resolves the page and Handout, checks permissions and the unique exact
heading in Description & Notes, and checks for conflicts without creating a pin.
Import creates at most one pin. Audit requires an already managed pin and never
creates one. Reports are whispered to the invoking GM. Players and API-generated
chat messages cannot invoke these commands.

## Native fields and preservation

The implementation follows Roll20's official [Mod Scripts Objects documentation](https://help.roll20.net/hc/en-us/articles/360037772793-Mod-Scripts-Objects).
Creation uses `pageid`; readback checks the pin's read-only `_pageid`. The link
uses the verified Handout ID, `linkType: "handout"`, the exact heading as
`subLink`, `subLinkType: "headerPlayer"`, and `autoNotesType: "blockquote"`.
All three desynchronization flags are false. `notes` and `gmNotes` are empty;
the Mod never writes encounter descriptions or extracted flavor text.

All seven visibility fields are explicitly empty: `visibleTo`,
`tooltipVisibleTo`, `tooltipTitleVisibleTo`, `nameplateVisibleTo`,
`imageVisibleTo`, `notesVisibleTo`, and `gmNotesVisibleTo`. The destination and
transfer must also have empty `inplayerjournals` and `controlledby`. Shared
Handouts and any requested player visibility are rejected.

`state.D35MapPinImporter` associates each stable `pin_id` with its native object
ID, canonical package digest, destination semantic digest, and readback snapshot.
Repeated import verifies that object and makes no pin writes. Restarting the
sandbox preserves this registry. Lost state does not authorize adopting an
existing pin. Changed plans, missing managed objects, occupied coordinates,
duplicate destination names/headings, and manual link, visibility, position, or
appearance changes fail closed. There are no update, move, reveal, delete,
adopt, or repair commands. A failed creation verification reserves the returned
ID and preserves the object for inspection; retry cannot silently replace it.

## Disposable Wrecked Wyvern acceptance procedure

Do this only after authorization to install the new component, and only in the
disposable **d35** game. Do not perform these steps in Savage Tide.

1. Verify that the previously accepted Journal importer remains installed and
   that the canonical Wrecked Wyvern Handout remains GM-only. Add
   `Roll20 Importer/D35_Map_Pin_Importer.js` as a **separate** Mod script, named
   `D35 Map Pin Importer v0.1`. Save it and confirm a clean sandbox startup.
2. Use the prepared local `map-pin-package.json`. Its chosen test page is
   `Clean a5e22769`, ID `-P58jqkdz3yllRG3gX0z`, at **x=140, y=210 pixels**.
   Its destination is `ToD 6.1 — The Wrecked Wyvern`, ID
   `-P5D_gPa5SRRTQAqGKQV`, heading `The Wrecked Wyvern (EL 10)`.
   This is an arbitrary disposable test point chosen with the GM's permission,
   not a canonical adventure map location. The page ID comes from the retained
   d35 live acceptance report; preview must verify it still resolves correctly.
3. Create `D35 Pin Transfer` with **In Players' Journals empty** and
   **Can Be Edited & Controlled By empty**. Paste the raw JSON file into GM
   Notes and save. Leave Description & Notes empty. Do not paste escaped HTML
   source into the rich editor; the importer also accepts the editor's ordinary
   paragraph/entity wrapping and whitespace normalization.
4. Run `!d35pin preview D35 Pin Transfer`. Require `PREVIEW`, the correct page
   name, coordinates, Handout title and exact heading, and the message
   `No source blockquote; no invented flavor text.`
   Do not import after an error. If an existing pin occupies the point, preserve
   it and regenerate the package with another explicitly selected test position.
   The importer does not invent a replacement position.
5. Run `!d35pin import D35 Pin Transfer`. Require
   `VERIFIED: Created and read-back verified hidden pin` and a native pin ID in
   brackets. Record the object ID and complete GM report.
   The readback verifies the actual link, coordinates, empty notes, synchronization
   settings, visibility, and unchanged destination. The internal registry retains
   the native-property snapshot; inspect the visible native settings in step 6.
6. Open the chosen test page and inspect that pin as GM. Confirm its title and
   point, linked Handout, player-header selection, native blockquote setting,
   and hidden visibility. Follow its destination: it must open the correct
   Handout at `The Wrecked Wyvern (EL 10)` in Description & Notes, including
   after closing and reopening that Handout. Use scrolling to distinguish
   actual heading navigation from merely opening the Handout.
7. Inspect the pin tooltip. The Wrecked Wyvern has no marked read-aloud passage;
   it must acquire no encounter summary or fallback flavor text. Its native
   `notes` and `gmNotes` must remain empty. Check that the seven source blocks
   and heading in the existing Handout are unchanged. Neither command writes
   the Handout.
8. Run audit, import again, then audit again. Require `VERIFIED`, the **same
   object ID**, and `no pin or Handout writes` for the repeated import. Confirm one
   managed pin exists. Restart the sandbox and repeat audit and import: the ID
   and zero-write behavior must survive. Save every report.
9. Rejoin as a player and verify the pin is absent and its destination Handout
   is unavailable. Return as GM without revealing anything. Do not use Show to
   Players to perform this check.
10. To exercise manual-change protection, move only the new test pin a few
    pixels. Audit and import must report a conflict and leave it where moved.
    Restore its original coordinates manually if continued successful auditing
    is desired. Do not reset state or modify another pin to force acceptance.

The existing native heading link can serve as a reference for the target:
`http://journal.roll20.net/handout/-P5D_gPa5SRRTQAqGKQV/#The%20Wrecked%20Wyvern%20(EL%2010)`.
The importer sets native link fields; it does not insert this URL into notes.

## Automated checks and live limitations

Run the prepared canonical case locally without copying its text into the repo:

```powershell
python -m unittest discover -s tests -p 'test_journal*.py'
python -m unittest discover -s tests -p test_map_pin_package.py
node tests/roll20_mock/journal-importer-tests.js `
  --package '..\03-Import-Staging\Reports\journal-package-001829ffacee47219d4e777606c054ae\journal-package.json' `
  --stored-transfer '..\03-Import-Staging\Reports\Journal-Live-Acceptance-20261030-9f9e467f\transfer-stored-before-workaround.html'
node tests/roll20_mock/map-pin-importer-tests.js `
  --handout-json '..\03-Import-Staging\Reports\Journal-Formatter-20261030-baed8608\handout.json' `
  --planner '..\03-Import-Staging\Reports\Journal-Formatter-20261030-baed8608\journal-d432a080927b4f1ab6bbec21edd4cae6\pin-plans.json' `
  --prepared-package '..\03-Import-Staging\Reports\Journal-Publish-Pin-Development-20261030-7a8abc4b\map-pin-package-1a1afd9f4ace4d63b9063ffde0215add\map-pin-package.json'
node tests/roll20_mock/batch-tests.js
node -e "require('./tests/roll20_mock/managed-lifecycle-tests').runLifecycleTests('Roll20 Importer/D35_Statblock_Importer.js')"
```

The separate `tests/roll20_mock/fixtures/map-pin-native-extraction.json` is
entirely synthetic. It contains a blockquote with two paragraphs followed by
another heading and a different blockquote. Tests verify the native property
contract and a **mock model** of first-blockquote extraction, including no-quote
and multiple-quote cases. The Mod never calls this model or copies its output.
Only a later Roll20 test with a separate synthetic Handout can confirm the
platform's actual extraction and tooltip rendering; the Wrecked Wyvern alone
cannot prove the positive blockquote case.

Live verification must also confirm that this Roll20 engine exposes pins to
Mods, accepts the documented parent/link properties, and retains the empty
notes/synchronized settings after rendering and restart. Native asynchronous
normalization that changes the stored fields will produce a conservative
verification error, preserve the created pin, and require diagnosis. No mock
result is a claim that these engine behaviors have passed live acceptance.

This version handles one hidden pin per package. It deliberately refuses
post-import source edits, manual customization, reveal requests, and changed
placement plans. Those require deliberate review, not automatic reconciliation.
Generated packages, canonical text, and acceptance evidence stay in Area 03 and
must not be committed or published.
