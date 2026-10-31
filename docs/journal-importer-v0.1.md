# Journal Handout Importer v0.1

The standalone Mod is `Roll20 Importer/D35_Journal_Importer.js` (v0.1.2).
It imports one prepared section from a GM-only transfer Handout, then reads the
destination back to verify content, formatting, navigation, title, and permissions.
It has no dependency on the Character importer and performs no Character, token,
pin, map, Drive, or tracker operations. The existing formatter and pin planner
are unchanged. This feature-branch implementation is not a tagged release.

## Folder-first creation (explicit pristine target)

**Live folder-first acceptance passed in disposable d35 on 2026-10-30**, using
one unique synthetic runtime Handout. It retained its native-created ID through
population, editor save/reopen, actual copied-heading-link navigation, repeated
imports and sandbox restart. The earlier drag-based migration of the existing
Wrecked Wyvern remains pending separately; it was not recreated or moved.

Roll20's documented native **folder context menu → Add Handout** creates a new
entry in that folder. `prepareJournalTarget(gameTab, {packagePath})` reuses the
existing native creation/editor helper to create a blank runtime target with the
package's exact title. It verifies actual ancestor IDs and names, blank fields,
no images and private permissions. It returns the new object ID; it never drags
an item or inserts runtime prose. Preserve that ID after an interrupted operation.

Create the separate private transfer using `prepareJournalTransfer()` as before.
Then use:

```text
!d35journal preview TRANSFER --target HANDOUT_ID
!d35journal import TRANSFER --target HANDOUT_ID
!d35journal audit TRANSFER --target HANDOUT_ID
```

The optional `--request NONCE` follows `--target HANDOUT_ID` when used by a caller.
For the reusable browser operation, pass `{targetId: newTarget.objectId}` to
`importAndFileJournal(gameTab, modConsoleTab, transferReference, options)`. It
imports and audits that exact target and recognizes its existing placement
without invoking a drag. Retain the ID and use import/audit on retries instead
of creating another UI target.
The destination must already have the exact package title, occur uniquely in the
approved existing folder, be empty/private/unarchived without images, tags or pin
references, and have no existing managed identity. A legacy migration plan is not
accepted in this mode. Preview performs no writes or identity reservation. Audit
cannot populate an unmanaged target. Import rereads empty fields, rechecks
metadata and folder identity, reserves the original ID, then uses the unchanged
formatting/content verification. Failed writes retain that ID without automatic
repopulation. A successful repeat only verifies the bound object; it never
rewrites content. Ordinary create-or-verify commands remain supported.

The native test exposed `tags` as the string `[]` on a UI-verified empty target.
Only the empty serialized/array tag list is accepted; populated tags still fail
and are never cleared. Expected-empty blobs use the established Roll20 empty
representation check, including its persisted `null` sentinel. Actual rich-text
prose such as `<p>null</p>` is nonempty and refused.

This mode is for deliberately created empty targets, not recovery of existing
adventure Handouts. The older Wrecked Wyvern entry remains untouched and pending
filing separately. The shared Image Asset Publisher drag behavior is unchanged.

Run `node tests/roll20_mock/journal-folder-first-tests.js` in addition to the
existing complete regression suite. Live sign-off requires initial native folder
creation, unchanged ID after population, semantic source/heading readback,
private permissions, actual heading navigation, repeated import and sandbox
restart with no additional object writes or creation.

## Existing-Handout relocation (not live-accepted)

Folder-first creation above is the live-accepted path for new runtime Handouts.
The separate drag-based relocation path **has not passed live acceptance**.
In disposable `d35`, content verification preserves the original
Wrecked Wyvern ID, but background native drag attempts have not moved it out of
the generic `Handouts` folder. It remains `pending_filing`. The earlier live
sign-off below concerns the original content importer. Do not recreate, rename,
replace, or apply pristine-target adoption to the original Wrecked Wyvern to
work around its outstanding one-time relocation. Its existing ID and links must
be preserved; that relocation remains a separate task.

The destination verified against the current Design Journal is:
`Savage Tide Adventure Path → 05 Tides of Dread → 07 Part Six: Reclaiming the Wyvern`.
The disposable game required explicit user-approved setup of the missing Part
folder. The production helpers never create folders or invent destinations.

Build an optional filing specification with `kind: "gm_adventure"`, exact
`folder_path` names, matching actual `folder_ids`, and an `authority` identifying
the reviewed organization. Supply it with `--filing-spec PATH` to the package
builder. This adds only filing metadata; formatter output and the stable
content fingerprint are unchanged. IDs must come from the target game; Design
game folder IDs are not interchangeable with disposable-game IDs.

The experimental relocation path supports managed root Handouts. A
previously imported Handout in a generic staging folder requires an explicitly
approved `legacy_source` containing its exact `handout_id`, `folder_path`, and
`folder_ids`. That exception cannot move Handouts out of established GM
adventure or Player Handout organization. Unmanaged title matches are refused.

For filing, retain the existing Image Asset Publisher Mod: Journal reuses its
exported, read-only `folders()` resolver. There is no dependency on the Character
importer. Neither Mod writes Journal folders. `tools/journal_ui.mjs` calls the
existing `filePublishedHandout()` from `tools/image_asset_ui.mjs`; standalone
image Handouts continue using `Savage Tide Player Handouts` unchanged.

The GM commands are:

```text
!d35journal preview TRANSFER
!d35journal import TRANSFER
!d35journal audit TRANSFER
```

`preview` never creates or reserves an identity. `import` creates or verifies
content; `audit` only verifies. A correctly created, unfiled Handout is reported
as `pending_filing`, including when the package lacks a filing plan. Only exact
folder readback plus content and permission verification yields `verified`.
Do not interpret successful content creation at the Journal root as completion.

For an authenticated, supported background browser Tab and the game's Mod
console Tab, use the single integration operation:

```javascript
const {importAndFileJournal} = await import(absoluteJournalUiModuleURL);
const result = await importAndFileJournal(gameTab, modConsoleTab, transferNameOrId);
```

It runs import → shared native filing → audit, correlating console responses by
unique request IDs. It verifies the original Handout ID and exact destination.
Optional `prepareJournalTransfer()` prepares a new private technical transfer
from a local package; it does not copy prose into the runtime Handout. Its
`draftId` option can resume only an identified blank `Mysterious Note` draft.
Use unique transfer names and close dialogs before filing.

The native filer needs both drag endpoints in view and an unfiltered Journal.
The input bounds now also come from the actual PNG/JPEG screenshot header:
the background browser exposed a 2400-pixel DOM but captured only 1352 pixels.
The former y=1899 drag was incorrectly allowed by DOM bounds alone. Such input
is now refused before dragging; unsupported capture formats/scales fail closed.
After a drop, exact DOM ancestry determines placement; a failed destination wait
produces the filing-specific error instead of an unrelated selector timeout.
It expands the destination, temporarily collapses unrelated folders, and
restores those collapse controls. Unsupported/offscreen geometry or unsuccessful
native movement stops without automatic retries. A caller may supply an
explicitly approved `viewport` capability plus `viewportSize`; the integration
restores that temporary override on success or failure. A larger viewport alone
did not resolve the current live move; do not treat mock success as browser proof.

Targeted diagnosis additionally tested settled native search at the normal
1280×720 viewport: before temporary folder collapse the source point was
(1040,417), and after collapse the helper used (1040,376); the destination header
point was (1100,213.5). Both endpoints fit the capture. The original drag did not
file the Handout. A diagnostic below-header child-list drop also failed and was
discarded. The supported two-endpoint background gesture has not reliably
performed this nested-folder move; the remaining rejection cause is unresolved.
Roll20's [native reorganization instructions](https://help.roll20.net/hc/en-us/articles/360039675133-Journal)
describe moving below a folder and then right while holding the item. No private
application-state mutation or manual move was substituted for that live test.

After successful filing, repeat the same integration operation, restart the
sandbox, and repeat it again. Expect the same ID, `already_filed`, no drag and
no Handout writes. Recheck full text, heading links, existing pin navigation,
empty GM Notes and permissions. Once verified, unexpected manual moves, changed
destination IDs, duplicate references or a changed/removed bound plan are
conflicts rather than invitations to reorganize or overwrite content.

Additional deterministic acceptance commands:

```powershell
node tests/roll20_mock/journal-filing-tests.js
node tests/roll20_mock/journal-ui-tests.js
node tests/roll20_mock/image-asset-ui-tests.js
```

## Prepare a package

Run from `01-Development-Repository`:

```powershell
python tools/journal_package.py --source "..\03-Import-Staging\Reports\Journal-Formatter-20261030-baed8608\wrecked-wyvern-source.json" --journal-id savage-tide.tod.6.1.wrecked-wyvern --output-root "..\03-Import-Staging\Reports"
```

The builder calls the unchanged formatter and fidelity audit. Each run creates a
unique Area 03 directory with `journal-package.json`, `transfer-gmnotes.html`,
`description-notes.html`, and `provenance.json`. It never overwrites prior output.
The stable `journal_id` identifies the approved section; retain it across exports
and imports. Do not generate a new key to evade a conflict.

The first acceptance package is already prepared at:

```text
C:\Users\Xcart\Documents\CODEX PROJECTS\d35-importer\03-Import-Staging\Reports\journal-package-001829ffacee47219d4e777606c054ae\journal-package.json
```

It uses the approved canonical export retained by the formatter milestone. Its
title is `ToD 6.1 — The Wrecked Wyvern`; its internal Heading 3 is
`The Wrecked Wyvern (EL 10)`. It contains seven body paragraphs, including four
bold run-in labels and both creature references. This source section contains no
marked read-aloud passage, so no blockquote is invented. The subsequent repair
section and preceding Part Six overview remain outside this entry's scope.

Package schema is `d35-journal/0.1`, with `journal_id` and the formatter's
`handout` result. The Mod validates exact fields, source SHA-256, source plus
navigation composition, safe HTML structure, and empty GM Notes and permissions.
Canonical authority comes from the reviewed source supplied to the builder;
checksums detect corruption, not provenance or approval. Packages contain no pin
creation instructions. A package cannot request an update or player access.

## Install in the disposable game

Use the disposable Roll20 test game, with Mod Scripts available. Do not install
this milestone in the live Savage Tide game. A verified existing managed
destination is reused by identity. An unmanaged exact-title match is preserved
and refused; it is never adopted, renamed, or replaced.

1. On that game's landing page, select **Settings → Mod Scripts → New Script**.
2. Name the script **D35 Journal Handout Importer v0.1**. Paste the complete
   contents of `Roll20 Importer/D35_Journal_Importer.js` and select **Save Script**.
   Install it once. It can coexist with the Character importer without editing
   that importer. These are Roll20's documented [custom Mod installation steps](https://help.roll20.net/hc/en-us/articles/360037256714-Introduction-to-Mod-Scripts).
3. Wait for the sandbox to restart. Confirm its console logs
   `D35 Journal Handout Importer v0.1.2 ready (create-or-verify; native folder-first targets).` Launch the game as GM.
4. Create a Handout named exactly **D35 Journal Transfer**. Leave **In Player's
   Journals** and **Can Be Edited & Controlled By** empty. Leave its Description
   & Notes empty. Paste the entire `journal-package.json` into **GM Notes**, as
   plain text, and save. This is the only content handoff; do not manually paste
   or format the adventure prose in the destination.

To copy the prepared package faithfully on Windows:

```powershell
Get-Content -Raw -Encoding UTF8 -LiteralPath 'C:\Users\Xcart\Documents\CODEX PROJECTS\d35-importer\03-Import-Staging\Reports\journal-package-001829ffacee47219d4e777606c054ae\journal-package.json' | Set-Clipboard
```

Paste into transfer GM Notes with Ctrl+Shift+V. Do not paste
`description-notes.html` there. `transfer-gmnotes.html` is an alternate escaped
transport for tools that write the GM Notes HTML blob directly; ordinary manual
testing should use the JSON file above.

## Disposable-game acceptance sequence

1. In GM chat run:

   ```text
   !d35journal preview D35 Journal Transfer
   ```

   Expect a GM whisper beginning **PREVIEW: Would create ToD 6.1 — The Wrecked
   Wyvern as GM-only**. Confirm the destination does not yet exist. Preview
   validates the package and checks collisions; it creates no destination or
   identity reservation. Exact transfer IDs also work in place of the name.

2. Run:

   ```text
   !d35journal import D35 Journal Transfer
   ```

   Expect content verification with the new Handout ID and **PENDING_FILING**
   until exact native filing and final audit succeed, as described above.
   Save that ID and the report. Confirm exactly one Handout has the exact title.
   All reports are GM whispers; commands from players or `API` are ignored.

3. Open the new Handout. Check that all source prose is in **Description & Notes**,
   **GM Notes is empty**, and both permission selectors are empty. Compare against
   the package's `description-notes.html` preview: one Heading 3 and seven body
   paragraphs in original order; **Creatures:**, **Tactics:**, **Skephilipika:**,
   and **Bloodtooth, elasmosaurus animal companion:** remain bold run-in labels.
   Ship names, spells, and publication names retain italics. Verify punctuation,
   both creature-reference lines, and the absence of invented read-aloud text.

4. Select **Edit**, then save without changing any wording or formatting. Close
   and reopen the Handout. Run the same preview command again. Expect
   **VERIFIED: Verified existing…; no Handout writes**, with the same ID. This is
   the critical editor round-trip check: the Mod reads the stored blobs again,
   compares source text and semantic structure, and checks permissions. If this
   fails, retain the Handout and error report for diagnosis; do not reimport under
   a new key or manually recreate it.

5. In the rendered Handout, hover the heading and use **Copy Header Link**. Follow
   the copied link in Roll20 and confirm it opens this exact Handout and scrolls
   to `The Wrecked Wyvern (EL 10)`. Verify the editor still recognizes that text
   as Heading 3, rather than only enlarged body text. Do not drag the heading onto
   a map and do not create a pin.

6. Run the import command again. Expect **VERIFIED: Verified existing…**, the
   same ID, and still exactly one destination. Restart the Mod sandbox using its
   **Save Script** control, then repeat preview/import to check identity persists
   through restart. Do not clear the script's persistent state.

7. Rejoin as a player, or use a separate player session. Confirm neither transfer
   nor destination appears in the player's Journal, and the destination link does
   not expose its content. As a player, try the import command: it must create
   nothing and reveal no report. Return as GM and confirm the destination's ID
   and permissions are unchanged. Do not use **Show to Players** during the test.

Record the destination ID, import/repeat/round-trip reports, heading-link result,
paragraph/format review, restart result, and player-view result. Local mock
acceptance does not substitute for these live checks or advance production status.

## Identity, verification, and failure behavior

`state.D35JournalImporter` owns a versioned map of stable key → object ID, exact
title, semantic SHA-256 fingerprint, and pending/verified status. It stores no
adventure prose. The namespace does not touch Character importer state.

- An unused key and unused exact title may create one new Handout. The object ID
  is reserved before blob writes. The notes and GM Notes are written separately
  after creation, then read with callbacks, following Roll20's
  [asynchronous blob API](https://help.roll20.net/hc/en-us/articles/360037772793-Mod-Scripts-Objects).
- Repeating the same package verifies the registered object without Handout
  writes. Preview of a registered object performs that same read-only audit.
- A changed package under the same key, duplicate title, unmanaged title match,
  renamed/missing registered object, or permission/content drift is an error.
  There is no force option, automatic adoption, update, repair, deletion, or
  recreation. Another key cannot claim a registered title.
- Creation/write/read-back failures retain the new object and reserved ID.
  Retrying can verify a successful write whose read-back timed out. Incomplete
  or changed objects remain errors; they are never silently repaired. An error
  after creation is not an acceptance pass.
- Commands are serialized; async blob reads time out after ten seconds and late
  callbacks are ignored. Transfer permissions are checked before and after the
  read. Destination identity, title, and permissions are checked around read-back.
- State loss fails safely on an existing title. Preserve state and objects for
  deliberate recovery; do not clear state or change a stable key as a workaround.

The semantic verifier retains paragraph, heading-level, blockquote, list-order,
table-cell/header, bold/italic/sup/sub, text, and link-target distinctions. It
allows `<b>`/`<strong>`, `<i>`/`<em>`, equivalent semantic spans, table section
wrappers, harmless root divs/editor metadata, supported entity representations,
layout whitespace, and NBSP versus ordinary space. It compares every other
character and structural boundary, so omissions, duplicates, reordering, changed
wording, missing marks, heading flattening, and changed URLs fail.

The normalizer intentionally supports a strict HTML subset rather than every
browser repair. Unknown tags/styles/entities, additional empty paragraphs, broken
nesting, and unsupported navigation URLs fail closed and require diagnosis.
Significant whitespace layouts such as poetry/preformatted text are outside v0.1.
Live API writes and editor saves may use normalization not yet represented by
the mock; the live sequence above is the remaining acceptance gate. SHA-256 and
the raw package source are checked before normalization. The comparison tolerates
layout-only whitespace changes and is not a byte-for-byte assertion about stored
HTML serialization. The local package remains the review reference.

## Repeat automated acceptance

From Area 01:

```powershell
python -m unittest discover -s tests -p 'test_journal*.py' -v
node tests/roll20_mock/journal-importer-tests.js --package '..\03-Import-Staging\Reports\journal-package-001829ffacee47219d4e777606c054ae\journal-package.json' --expected-html '..\03-Import-Staging\Reports\Journal-Formatter-20261030-baed8608\description-notes.html'
```

The JavaScript runner reuses the existing `roll20-sandbox-mock.js` unchanged,
including its async blob rules and prohibition on blob fields at creation.
Synthetic scenarios verify read-aloud, tables, lists, and navigation independently
of the no-read-aloud canonical example. The runner also imports the exact Wrecked
Wyvern package and compares against the formatter milestone's approved HTML.
No canonical adventure text is embedded in repository test fixtures.

## Live commissioning findings — 2026-10-30

The disposable `d35` game (22152364) exposed two normalization defects, now
corrected locally and in its separate Journal Mod: rich-editor NBSP indentation
is normalized only outside JSON strings, and the API's persisted-empty GM Notes
string `null` is recognized only in expected-empty GM Notes verification. Source
text and checksum validation remain strict. The original script and observed
failures are preserved in Area 03. No Character/token/formatter/pin code changed.

The original indented Wrecked Wyvern package now verifies after a confirmed
sandbox restart using the same Handout ID, `-P5D_gPa5SRRTQAqGKQV`, without Handout
writes. Exact canonical text, rich-editor save/reopen, permissions, player Journal
visibility, player command rejection, and direct Handout access were tested.
There are 50 passing Mod checks (including the captured real transfer markup)
and 24 passing Python checks. Full live sign-off is now complete: the exact
native copied heading URL opened the correct Handout and scrolled to its Heading
3, and remained valid after closing and reopening. The result and screenshots
are recorded in the final live report. No production-game deployment occurred.

The final live report is retained under
`03-Import-Staging/Reports/Journal-Live-Acceptance-20261030-9f9e467f/LIVE-ACCEPTANCE-FINAL.md`.
No production-game, Drive, tracker, Git, or release changes were made.
