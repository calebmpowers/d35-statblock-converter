# Batch Character and default-token importing — v0.7.0

This optional companion uses the v0.7.0 managed importer and retains its schema-v1 and managed-state-v1 behavior. Install the bundled core once, then add `D35_Batch_Importer.js` as a second Mod below it. The v0.6.2 core alone does not expose the required `batchV1` bridge. Keep only one core active. Back up the game before changing an installed Mod; preserve its managed state and object IDs.

## Workflow

1. Upload token images through Roll20's ordinary Art Library upload UI, if they are not already uploaded. Keep those Library images: deleting them breaks tokens that reference them.
2. Register names against existing Library references once. There are two supported choices:
   - Prepare an `images` array in a GM-only Handout and run `!d35batch register HANDOUT_ID`. Each record has `key`, the full Library `imgsrc` URL **including its query string**, and optional integer `width`/`height` (default 70 pixels).
   - For images already placed and named on a GM staging layer, select up to 20 together and run `!d35batch register-selected`. Each token's exact name becomes its registry key; image and dimensions are captured together. Blank names and duplicate names block registration. Naming is a one-time association step, not a per-import selection requirement. A newly dragged image is not assumed to have a usable name automatically.
3. Paste one batch envelope into one GM-only Handout's **GM Notes**. Leave player visibility and player editors empty. Reuse existing schema-v1 creature payloads unchanged inside `items[].payload`.
4. Run `!d35batch help` to get staging-page IDs. Set an explicit `page_id`, then run `!d35batch preview HANDOUT_ID`. This reads objects and reports proposed attribute/ability counts, HP, AC, conflicts and missing image keys. It creates no Handouts, Characters or graphics.
5. Run **one** `!d35batch apply HANDOUT_ID`. No token selection is needed. The coordinator serially creates a private source Handout, a GM-layer staging token and a managed Character for each ready item. The existing importer copies the image to the avatar, configures token policy, saves the object-layer default token, waits for workers and verifies stored objects. It removes its temporary capture token using its existing lifecycle logic. The two permanent staging tokens remain on the GM layer because their IDs are part of the managed baseline used by audits.
6. Read the batch summary; `!d35batch status` whispers its machine-readable JSON. Persistent per-item IDs, status and verification summaries are also under `state.D35BatchImporter.batches`. Repeating apply audits already verified outputs instead of importing them again.

Example envelope (placeholder IDs and image URL must be replaced):

```json
{
  "batch_version": 1,
  "batch_id": "test-creatures-001",
  "page_id": "ROLL20_STAGING_PAGE_ID",
  "images": [
    {"key": "Creature A", "imgsrc": "https://files.d20.io/images/12345/EXISTING_ASSET/thumb.png?EXISTING_QUERY", "width": 70, "height": 70}
  ],
  "items": [
    {"key": "creature-a", "image_key": "Creature A", "payload": {"schema_version": 1, "creature": "REPLACE WITH THE COMPLETE EXISTING CREATURE OBJECT", "warnings": []}}
  ]
}
```

The complete runnable synthetic example is emitted by the regression runner into its specified staging directory. The illustrative envelope above intentionally contains a placeholder, not an importable creature.

## Safety and recovery

- Limits: five creatures per batch, 200,000 characters of input JSON per Handout, 20 registration records per command, 1,000 saved image keys and 20 saved jobs. The importer retains its existing per-Character object/journal limits. Jobs are never automatically discarded.
- `batch_id` binds to the original Handout ID, page ID and exact canonical JSON of its items. Changes require a new explicit batch ID; existing Character names still prevent duplicates. Object keys/JSON formatting differences do not change identity. Image registration is separate, so a missing reference can be registered later and the same job retried.
- Matching uses the importer's case/whitespace/dash normalization. Parentheses, qualifiers and variant names remain meaningful. Duplicate normalized Character names in a batch block both items. Any same-name existing managed or unmanaged Character blocks new creation; there is no automatic adoption or update.
- Individual errors do not cancel unrelated ready items. A source/token created before failure is recorded and retained. An unverified or partially written Character is blocked on retry. Inspect `!d35import report`, then use the existing explicit `!d35import audit CHARACTER_ID` and review before resuming. Nothing rolls back or deletes existing campaign data.
- A restarted sandbox can rediscover a completed managed Character through its recorded source Handout ID, even if the batch completion callback was lost. Missing, edited or conflicting managed objects block instead of silently being replaced. Deleting the Mod state removes its recovery history; do not reset it.
- Source JSON is HTML-escaped when written to private source Handouts and read back before import/audit. Changed source content and player-visible/player-editable sources block. GM checks and a coordinator lock cover registration, input reads and serial processing; late blob reads are ignored after timeout.
- Stored-object verification is not proof of every sheet calculation or every roll formula. The underlying importer reports that distinction. Follow its existing live commissioning workflow for sheet behavior.

Only required import source Handouts, Characters and token graphics are automated. There is no Journal folder organization, lore/handout authoring, upload service, renderer, Drive integration, live-campaign deployment or release process here.

## Roll20 limitations and the smallest supported association step

The documented Mod API exposes game objects; it does not expose a supported Art Library enumeration or file-upload endpoint. Library filenames therefore cannot be discovered or matched by this Mod. Uploads remain manual through the ordinary multi-file uploader. Each uploaded asset needs one explicit association with a creature key, either through a URL manifest or through one bulk selection of already named staging tokens. The registry is game-local and does not upload/copy the underlying image.

For an existing collection of named tokens, bulk selection plus `register-selected` is the least work. For URLs already inventoried outside the sandbox, one pasted manifest avoids tabletop placement entirely; that is the live commissioning path. A browser can read URLs visible in the Art Library UI when preparing that manifest, but browser access is not part of this Mod and is not an undocumented Art Library API.

The prototype conservatively uses uploaded Library URLs normalized by the importer's existing `thumb` helper. It rejects external URLs, Marketplace references and missing query strings. Current sandbox v1.5 has additional Marketplace-copy helpers, but those are outside this prototype and are not required for compatibility with the existing importer. CDN size/host/query rewrites are compared by the importer's image-identity logic, not literal URL equality.

Official references:

- [Roll20 Mod Objects, image restrictions and asynchronous blob fields](https://help.roll20.net/hc/en-us/articles/360037772793-Mod-Scripts-Objects)
- [Roll20 Mod Functions, createObj and setDefaultTokenForCharacter](https://help.roll20.net/hc/en-us/articles/360037772833-Mod-Scripts-Function-Documentation)

## Local verification

From Area 01:

```powershell
node tests/roll20_mock/batch-tests.js 'UNIQUE_ABSOLUTE_AREA_03_REPORT_DIRECTORY'
node tests/roll20_mock/run-importer-tests.js --json-dir 'THAT_DIRECTORY\synthetic-corpus'
```

The first command uses the existing disposable Roll20 mock and emits a two-creature envelope, corpus and machine-readable evidence. It tests read-only preview, default tokens without selection, repeated/restarted scans, duplicate names, managed/unmanaged conflicts, image registration, missing refs, partial failures, concurrency, permission boundaries, malformed input and tampering. The second command runs the unchanged legacy corpus checks and all existing lifecycle scenarios against the development importer. These local tests do not substitute for the live disposable-game test recorded separately in Area 03.

## Verified behavior and compatibility

The bounded workflow passed clean-first-import live acceptance in a disposable Roll20 game on 2026-10-29 using two approved real-creature payloads and previously registered images. One preview and one apply created both Characters, source Handouts, avatars and reusable defaults without selected tokens or post-import repairs. Actual attacks, damage, a critical path, spell references and independent Smite/music enable states were exercised. A sandbox restart and unchanged retry retained IDs with zero issues and zero object/field changes. Private payloads, game IDs, image URLs and evidence remain outside the public repository.

The release integration changes version/label text, bundled copies, documentation and test/package entry points. It does not alter the accepted batch algorithm or the two accepted mechanical fixes. The core alone retains its selected-token workflow. Existing mapped actions remain compatible; explicit managed preview/update is needed to acquire construction fixes on an older Character.

Known limits: five items, 200,000 input characters, 20 registrations per command, 1,000 image keys and 20 retained jobs. Do not delete staging tokens or reset Mod state to reclaim limits. Missing or ambiguous names/images and altered/partial managed output are blocked for review. Extra weapons remain actions beyond the three NPC summary slots. The GM handles effect/resource/eligibility rules; Smite is still a shared melee/ranged flag. The built-in verification flag describes stored objects; live acceptance is separate evidence.
