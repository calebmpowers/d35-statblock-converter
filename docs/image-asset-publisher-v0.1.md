# D35 Image Asset Publisher v0.1

Publishes one approved visual as a hidden **Player Handout**, with one full-size image in Description & Notes, empty GM Notes, and its exact existing adventure folder. Illustrations, portraits, scenes, letters, notes and clues all use this Player Handout workflow. It does not create Characters, assign Character avatars, invent prose, infer titles, create folders, or reveal anything.

This companion requires the existing D35 Journal Importer for its tested SHA-256 implementation. Neither that importer nor the formatter is changed. The Library image identity rule follows Map Page Setup, including queryless uploaded URLs; Map Page Setup need not be installed. The existing Character image registry is deliberately not repurposed: token image restrictions and source-artwork presentation differ.

## Authorities and naming

Consult the current Savage Tide Design Protocol, the current production inventory, canonical asset folder, and implemented Journal before preparing a spec. Supply the exact approved title and path; filenames alone do not establish either. The established root is `Savage Tide Player Handouts`; adventure and subordinate names are explicit inputs. Never create a Part Six Player Handout merely because that part was an earlier automation pilot.

The initial real-asset acceptance case uses the existing canonical `Malfus Fairwind.png` (1086×1448), the already implemented title `Malfus Fairwind - Portrait`, and:

`Savage Tide Player Handouts → 05 Tides of Dread → Character Portraits`

The current tracker records Phase 3 complete for the relevant Tides of Dread material. Private exports, asset identity/checksum, organization observations and actual acceptance evidence belong in Area 03, not Git. In a disposable game missing this hierarchy, create those exact established folder names through the native UI as a test prerequisite. The publisher itself refuses a missing folder.

## Prepare the package

Use `tools/image_asset_package.py`. It reuses the formatter's strict field validation, preserves explicit inputs, verifies the local file's approved SHA-256 and dimensions, and writes a unique Area 03 directory. It does not download, edit, convert or upload images. Static PNG and baseline/progressive JPEG headers are supported; animated PNG and other source formats are refused. Source dimensions come from the file and approved spec, never its title. JPEG metadata/rotation and Roll20 resampling require independent presentation checks; no orientation correction is performed.

The synthetic schema fixture is `tests/roll20_mock/fixtures/image-asset.json`. For a generator spec, remove its `schema`, `publication_id` and runtime `image` fields. Replace all synthetic source fields with the approved asset metadata. `source.kind` is `drive` or explicitly `synthetic`; Drive references must identify `source.asset_id`. Supply an actual approval/naming/folder authority, SHA-256, filename and pixel dimensions. Do not treat the mock fixture's placeholder checksum or URL as production material.

```powershell
python tools/image_asset_package.py --spec "..\03-Import-Staging\approved-image-spec.json" --image "..\03-Import-Staging\approved-image.png" --publication-id adventure.approved-image.v1 --output-root "..\03-Import-Staging\Reports"
```

The initial package contains `image.display_url: null`. Upload registration fills this using a link **actually rendered by Roll20**, not a guessed image URL. Preserve the generated package and write any captured runtime package under a new staging filename.

## Install and publish in disposable d35

1. Confirm the game is **d35**. Preserve its installed scripts and objects. Add `Roll20 Importer/D35_Image_Asset_Publisher.js` as a separate Mod after the Journal Importer. Wait for the sandbox to be ready.
2. Confirm the exact destination folders already exist and have no ambiguous siblings. Do not rename or move existing production content to accommodate a package.
3. Create a new `D35 Image Transfer` Handout. Leave **In Player's Journals** and **Can Be Edited By** empty. Leave Description & Notes empty. Paste the prepared package into GM Notes and upload the exact approved local file through its native image control. Save.
4. Open the saved transfer viewer's full-size image link. The API avatar/preview may be a **med thumbnail**; the pilot's thumbnail was 384×512 despite its 1086×1448 source. Register the actual viewer link (`max`/`original`), retaining the same uploaded image identity, as `image.display_url` in the transfer JSON. Do not transcribe or fabricate URLs when background UI automation is available.
5. Run each command after reading the preceding result:

   ```text
   !d35asset bind D35 Image Transfer
   !d35asset preview D35 Image Transfer
   !d35asset import D35 Image Transfer
   ```

6. Import creates one hidden Handout and reads it back. At the Journal root it reports **PENDING_FILING / PUBLICATION INCOMPLETE**. Use native Journal drag-and-drop to put that exact Handout inside the approved existing folder, then run:

   ```text
   !d35asset audit D35 Image Transfer
   ```

7. Require **VERIFIED** with the actual Handout ID, full folder ID chain and hidden permissions. Open the resulting Handout and independently inspect its loaded image, dimensions/aspect ratio, readability, and lack of unintended prose. Mod verification establishes the native image identity and HTML structure; it cannot inspect remote image bytes or certify the rendered pixels.

Commands accept an exact transfer name containing spaces or its actual ID. Ambiguous names, unmanaged destinations, changed sources/bindings/folders, missing managed objects, manual edits, altered permissions and malformed readback are errors. There is no adoption, overwrite, automatic repair, delete or automatic retry of a partial creation.

## Reusable background UI operations

`tools/image_asset_ui.mjs` accepts an existing authenticated CUA Tab. It neither launches a browser nor uses private Roll20 state or application-model writes. Its functions use native controls and supported background browser actions:

- `prepareImageTransfer(tab, {dialogName, transferTitle, packagePath, imagePath})`: with a new empty GM-only transfer editor open, verifies the approved local SHA-256, uses its native file chooser, saves, and automatically registers the native full-size viewer link. Existing content/uploads are preserved and refused.
- `registerImageTransfer(tab, {transferTitle, packagePath})`: with the saved transfer viewer open, captures the actual full-size link, confirms its upload identity and the unchanged package, and writes only the runtime binding into GM Notes. Repetition preserves an existing correct registration without writes or uploads.
- `filePublishedHandout(tab, nativeReport)`: accepts the fresh structured `pending_filing` report from the immediately preceding Mod import. With dialogs closed, verifies exact DOM folder IDs/path and drags only that managed root item into its destination. It verifies the result, restores unrelated folder expansion controls, and requires a subsequent Mod audit. Already-correct filing is a no-op; manual moves, overlays, offscreen endpoints or a failed drop are reported rather than guessed or repeatedly retried. Rerun Mod preflight after an interruption or intervening manual changes; native filing is not an atomic transaction with the Mod sandbox.

Import the module from a supported CUA JavaScript session, passing absolute paths. The caller supplies the authenticated Tab and reads the actual `D35_IMAGE_ASSET_REPORT` JSON from the native Mod console; no browser connection or deployment framework is introduced. For example:

```javascript
const ui = await import('file:///C:/Users/Xcart/Documents/CODEX%20PROJECTS/d35-importer/01-Development-Repository/tools/image_asset_ui.mjs');
await ui.prepareImageTransfer(tab, {
  dialogName: 'Edit Mysterious Note', transferTitle: 'D35 Image Transfer',
  packagePath: preparedPackageAbsolutePath, imagePath: approvedImageAbsolutePath
});
// Save the returned runtimePackage privately. Run bind, preview and import through chat.
await ui.filePublishedHandout(tab, actualNativeImportReport);
// Run audit, then inspect the loaded runtime Notes image through the native viewer.
```

Read the Computer Use file-upload documentation before using these helpers. The viewport must accommodate the source item and target folder. Deep/unusual Journal layouts may need a small native UI arrangement; the helper never guesses offscreen drop positions.

## Full live acceptance

Record actual IDs, commands, native readback, screenshots and limitations in a unique `03-Import-Staging/Reports` directory.

- Verify approved source checksum before upload. Verify the runtime image is loaded at the approved natural dimensions, with an undistorted rendered aspect ratio and no crop or extra description. A `max` link may be resampled for larger sources; fail presentation acceptance if the actual image is inadequate. Never silently use a thumbnail.
- Verify exact title and one image in Description & Notes, empty GM Notes, blank visibility/editor lists and unarchived state. An empty avatar prevents a duplicate cover image.
- Verify the native Journal folder path and folder IDs, not just title/search visibility. **Root placement never completes publication.**
- Close/reopen, open Edit, save, reopen, and re-audit. Native harmless HTML spacing, tag case, empty-GM-Notes sentinels, and equivalent full-size CDN variants are accepted; missing/duplicated images, prose, lower-resolution variants, changed dimensions, unsafe attributes and changed scaling styles are refused.
- Repeat bind, preview, import and audit. Require the same Handout ID, one exact-title destination, preserved content and no Handout writes.
- Restart the actual Mod sandbox, then repeat audit/import. Require the same managed identity and image/folder readback.
- Safely add a temporary **private GM annotation to this new test Handout**, import, and verify an error preserves it. Restore its previously empty GM Notes through the editor and re-audit. Do not change player visibility to test conflicts.
- Re-join d35 as player. Confirm the new Handout and transfer are absent from Journal and cannot be found through its search. Do not reveal the Handout merely to test rendering. Restore GM role afterwards. Record whether this used the owner's player role or an independent account.

Roll20 documents Handout properties, asynchronous Notes reads, uploaded-image restrictions, and readable—but unwritable—Journal folder data in [Mod Scripts: Objects](https://help.roll20.net/hc/en-us/articles/360037772793-Mod-Scripts-Objects). Upload and folder writes remain native UI operations.

## Automated verification

```powershell
python -m unittest discover -s tests -p test_image_asset_package.py
node tests/roll20_mock/image-asset-publisher-tests.js
node tests/roll20_mock/image-asset-ui-tests.js
```

Run the existing Journal, Pin, Map Page, Character managed-lifecycle and Batch suites as well. The new tests reuse the existing Roll20 mock without changing it. Retain unique test artifacts in Area 03; do not publish images, generated packages, acceptance reports or temporary data. Do not commit, push, merge or release without the user's separate authorization.
