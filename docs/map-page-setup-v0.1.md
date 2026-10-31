# D35 Map Page Setup v0.1

This separate Mod configures one existing, unassigned page and one explicitly
bound uploaded image. It uses the existing Journal importer's SHA-256 helper;
it does not change the Character, Token Builder, Journal, or Map Pin tools.
The Wreck of the Sea Wyvern configure-mode pilot **passed live commissioning in
disposable d35 on 2026-10-30**. Two bounded native compatibility corrections
accept observed queryless URLs for configure mode and normalize unchanged
numeric opacity after editor round-tripping. All 337 regression checks passed.
Private evidence is retained in Area 03 under
`Reports/Map-Page-Live-Acceptance-20261030-f61fbf8f/`. No release was published.

## Pilot authority and exact settings

Reviewed the current [Savage Tide Design Protocol](https://docs.google.com/document/d/1iazJkITw9kLhcMc_x6Hwn0XHnDQmy7lc5Ye8Zbn_080/edit)
and [Tides of Dread — Adventure Production](https://docs.google.com/spreadsheets/d/1gtPB_HW96bmD9TAuQQHNXgTI767bK412W6O_F_9ela0/edit)
read-only on 2026-10-30. Tracker!E11 marks Part Six Phase 4 Complete.
Inventory!E42 identifies the approved file and E43 specifies the grid and scale.
The approved image is in the adventure's `03 Assets / 01 Maps / Wreck of the Sea
Wyvern` folder.

The current tracker and map folder contain no detailed runtime crop, origin,
offset, snapping, or grid-visibility handoff. The user explicitly approved the
pilot settings below in this conversation. That approval supplements the current
canonical facts for this disposable pilot; no Drive document or tracker was edited.

| Setting | Value | Authority |
|---|---|---|
| Approved image | [Wreck of the Sea Wyvern - 1 - No Grid - 50x50.jpg](https://drive.google.com/file/d/1rSU1BhswGXmSmGjmmZaifmACgPhHb7cu/view) | Inventory!E42 and canonical asset folder |
| Original pixels | 3500 × 3500 | Drive Details and independently decoded original JPEG header |
| Page/grid extent | 50 × 50 squares | Inventory!E43 |
| Distance | 5 feet per square | Inventory!E43 |
| Crop | Entire approved image; no runtime crop | Explicit user pilot approval |
| Map-layer graphic | 3500 × 3500 pixels | Explicit user pilot approval |
| Graphic center | left=1750, top=1750 | Explicit user pilot approval |
| Rotation/flips | 0°, no horizontal or vertical flip | Approved full-image placement |
| Grid | square, visible, snapping increment 1 | Explicit user pilot approval |
| Grid offsets | x=0, y=0 | Explicit user pilot approval |
| Visibility | Off player ribbon and all per-player assignments | Explicit user pilot approval |

The downloaded original is 3,895,716 bytes, SHA-256
`54885172badf3ecff295400fc00f1c473147c4a79c1a07bf3e2c74f474e14af4`.
The original JPEG, current read-only protocol/tracker exports, technical spec,
and source provenance are retained only in Area 03 under
`Reports/Map-Page-Setup-Development-20261030-c8a4fd4e/`.

## Package generator

`tools/map_page_package.py` accepts a reviewed technical spec with explicit
source pixel dimensions, source grid extent/distance, page settings, and image
placement. It does not parse dimensions from filenames or infer a crop.
Required fields are represented by the entirely synthetic fixture at
`tests/roll20_mock/fixtures/map-page-setup.json`.

The prepared pilot was generated from Area 01 with:

```powershell
python tools/map_page_package.py `
  --spec '..\03-Import-Staging\Reports\Map-Page-Setup-Development-20261030-c8a4fd4e\wreck-of-sea-wyvern-spec.json' `
  --setup-id savage-tide.tod.part6.wreck-map-acceptance `
  --page-name 'Wreck of the Sea Wyvern — Page Setup Acceptance' `
  --mode configure `
  --output-root '..\03-Import-Staging\Reports\Map-Page-Setup-Development-20261030-c8a4fd4e'
```

The output is a new UUID directory containing `map-page-package.json` and an
escaped transport HTML representation. The builder restricts outputs to Area 03
and never overwrites older packages. The prepared package is in
`map-page-package-a182c39c16194bedb3200dcabba6262d/` beneath the pilot evidence folder.

An optional `--page-id=-ACTUAL_ID` strengthens the existing exact-name selector.
An optional `--graphic-id=-ACTUAL_ID` constrains which graphic may be bound.
Neither ID is invented. The pilot leaves both null until runtime binding:
the existing page must resolve uniquely by its exact name, and the GM selects
the uploaded graphic. Bind records both actual IDs before import.

The generator validates uniform image scaling, full-image bounds, grid-cell
counts, represented distance, positive numeric geometry, and supported settings.
At the documented 70-pixel base unit, grid cell width is
`70 × snapping_increment`; its represented distance is
`scale_number × snapping_increment`. The source grid and image aspect ratio
must match those quantities. See Roll20's [image specifications](https://roll20partners.zendesk.com/hc/en-us/articles/10828203014423-Image-Dimensions-Resolution-and-File-Type-Specifications)
and [Mod object reference](https://help.roll20.net/hc/en-us/articles/360037772793-Mod-Scripts-Objects).

## Commands and binding

Place the JSON in GM Notes of an exact-name GM-only transfer Handout. Leave
Description & Notes empty and both player visibility/editing lists empty.

```text
!d35map bind D35 Map Page Transfer
!d35map preview D35 Map Page Transfer
!d35map import D35 Map Page Transfer
!d35map audit D35 Map Page Transfer
```

Commands also accept the transfer's actual native ID. Binding requires exactly
one selected, existing, plain uploaded graphic. It reads `imgsrc` directly from
that object, validates its Roll20-hosted image identity, and records the actual
page and graphic IDs without changing either object. The GM must visually
confirm that the selected upload is the approved map. No URL transcription,
image URL invention, library enumeration, or upload occurs.

Two explicit package operations are supported:

- `configure`: use the selected graphic already on the target page. Preserve its
  native ID and name, and apply the specified placement and Map layer. This is
  the pilot's mode and needs no extra staging page.
- `copy`: read a selected source graphic from another existing page, preserve
  it completely, and create one new Map-layer graphic on the empty target page.
  Generate a separate package using `--mode copy`; do not change a bound package.

The source must be a plain image: no represented Character, player controls,
linked or populated token bars, or multi-sided token data. External and
Marketplace images are refused. Source binding uses the observed Library URL
unchanged. Configure mode accepts native queryless uploads (including Roll20's
JPEG-to-WebP conversion); it never creates an image or rewrites `imgsrc`. Copy
mode still requires the observed creation query string and refuses missing
queries rather than inventing one. Native storage rewrites are compared by upload
ID and hash rather than URL host, size variant, extension, or query text.
v0.1 recognizes `files.d20.io/images/...` and the legacy
`s3.amazonaws.com/files.d20.io/images/...` layout. Unknown CDN layouts are
refused for review rather than guessed or rewritten.

Native graphic-editor round-tripping can store unchanged `baseOpacity` as a
decimal string instead of a number. Snapshot comparisons normalize that numeric
representation without writing it back; changed opacity and malformed values
still produce conflicts.

Only explicitly specified page properties are written. Width, height, distance,
grid type, snapping, visibility of the grid, and zero offsets are required.
Optional diagonal measurement, grid opacity/color/labels, and background color
are used only when explicitly supplied. Unlisted styles, lighting flags, page
names, folders, and existing content are preserved.

## Identity, conflicts, and failed writes

`state.D35MapPageSetup` holds immutable package fingerprints, actual native IDs,
pre-bind snapshots, managed readback snapshots, and the latest GM report.
Reusing an identity with changed inputs, replacing a page under the same name,
changing a bound image, or manually editing owned properties causes a conflict.
Bind does not silently rebind an existing identity. Lost state requires explicit
review/binding; import never silently reconstructs a lost binding.

Initial setup refuses any other page-scoped object, including graphics, pins,
paths, text, lights, doors, windows, or unknown page objects. In configure mode,
only the explicitly selected map graphic is exempted. This version has no
populated-page override: such work requires a separately reviewed change plan.
After successful setup, later tokens/pins are allowed on repeat import/audit
because those commands verify and make zero object writes. Duplicate Map-layer
images of the same upload are reported as conflicts and preserved.

GM-only is an assignment check, not an invented `page.visibleTo` property.
The Mod refuses a target on the player ribbon or assigned to any player; it
never moves the ribbon, changes player assignments, archives a page, or reveals it.

Native writes are not transactional. The Mod reserves identity before writing,
verifies page readback before touching the graphic, then verifies the graphic
and page together. A write/readback failure preserves the partial result and
before/after plan for review, blocks automatic retries, and never rolls back
over possible manual changes or creates a replacement after an uncertain result.
Record the reported IDs and error; do not clear state and retry to force success.

## Exact disposable d35 live acceptance procedure

The pilot below was completed in **d35** on 2026-10-30. Use this procedure for
future authorized installation/live testing in **d35**, never Savage Tide.

1. Ensure an existing page named exactly
   **Wreck of the Sea Wyvern — Page Setup Acceptance** is available. If it does
   not exist, create one manually with that name and otherwise leave its default
   settings. Keep it off the player ribbon and all individual player assignments.
   Do not reuse populated `Clean a5e22769`: its tokens and pins must be preserved.
2. Ensure the exact approved JPEG is already in the Roll20 Art Library. If not,
   upload the original staged JPEG manually as a prerequisite; uploads are not
   part of this component. Drag that image once onto the target page, preferably
   on the GM layer, and select it. Do not resize, crop, mirror, rotate, or position
   it manually. The target must contain no other objects. Do not select a
   Character/default token as the binding source.
3. Leave the accepted Character, Journal, and Map Pin importers unchanged. Add
   `Roll20 Importer/D35_Map_Page_Setup.js` as a separate Mod named
   `D35 Map Page Setup v0.1`. It requires the existing Journal importer. Confirm
   a clean sandbox startup with its ready log.
4. Create **D35 Map Page Transfer**, with **In Players' Journals** and
   **Can Be Edited By** empty. Paste the prepared `map-page-package.json` into
   GM Notes and save. Reopen and confirm the JSON actually persisted. Normal
   rich-editor paragraph/entity/NBSP wrapping is supported; paste JSON, not raw
   escaped transport HTML. Background automation should generate a normal editor
   key event after filling Summernote before saving, as established in prior tests.
5. Select only the approved map graphic and run
   `!d35map bind D35 Map Page Transfer`. Require **BOUND**, the correct page ID,
   selected source graphic ID, and native image identity. Confirm visually that
   this is the approved file. Bind makes no page or graphic writes.
6. Run `!d35map preview D35 Map Page Transfer`. Require **PREVIEW** for the
   exact target, 50×50 page units, square visible grid, snapping 1, 5 ft per unit,
   zero offsets, and 3500×3500 Map placement centered at 1750,1750. The original
   graphic and default page settings must remain unchanged. Stop after any error.
7. Run `!d35map import D35 Map Page Transfer`, then
   `!d35map audit D35 Map Page Transfer`. Require **VERIFIED**, retain the native
   page/graphic IDs, and record the complete GM reports. Configure mode must
   preserve the original selected graphic ID; there must be one map image.
8. Inspect the actual native Page and graphic settings. Require the approved
   image, full uncropped bounds, no distortion, no rotation/flips, Map layer,
   3500×3500 dimensions, center 1750,1750, 50×50 page, square visible grid,
   snapping 1, 5 ft distance, and zero offsets. Measure one cell as 5 ft and the
   full map span as 250 ft. Inspect all four edges and source landmarks; a mock
   readback alone does not prove renderer alignment or image quality.
9. Close/reopen the page and restart the sandbox. Run import twice and audit
   again. Require the same page ID, graphic ID, image identity, one map image,
   **VERIFIED**, and `no object writes`/`objectWrites=0` on repeats.
10. In the native graphic editor, make a small reversible edit to only the new
    map (for example its name). Audit and import must report a conflict, retain
    that manual edit, and create no image. Restore the original value manually
    and require a passing audit. Do not reset state or edit an existing working
    object to force acceptance.
11. Verify the target remains off all player assignments. Use native player view
    and verify no unintended source information is exposed. A direct player-role
    check on this exact page can be performed by temporarily assigning only the
    disposable test party, rejoining as player, and inspecting the map; **do not
    run map commands while the page is player-assigned**. Restore assignments and
    GM role afterward, then audit again. Do not reveal existing Handouts or pins.
12. Save actual page/graphic IDs, readback reports, screenshots of the native
    settings and aligned map, ruler measurements, visibility checks, and restart
    results in a new Area 03 acceptance folder. Any native compatibility defect
    must be diagnosed before changing the implementation or existing objects.

## Automated checks and remaining limits

```powershell
python -m unittest discover -s tests -p test_map_page_package.py
node --check 'Roll20 Importer/D35_Map_Page_Setup.js'
node tests/roll20_mock/map-page-setup-tests.js `
  --package '..\03-Import-Staging\Reports\Map-Page-Setup-Development-20261030-c8a4fd4e\map-page-package-a182c39c16194bedb3200dcabba6262d\map-page-package.json'
```

Tests reuse the unchanged shared Roll20 mock and add only a source fixture and
component tests. Coverage includes initial configure/copy, zero-write repeats,
correct scaling, selected binding, failed preflight, protected Character data,
populated pages, changed manual settings, ambiguous destinations, readback
failures, CDN normalization, partial failures, restart, asynchronous races, and
coexistence with all completed Mod components.

v0.1 supports full-image square-grid layouts with zero grid offsets, no rotation
or mirroring, and explicit whole source cell counts. It refuses unsupported
crops, alignments, reveals, uploads, page creation, and populated-page setup.
Roll20's Mod API does not prove that a selected CDN upload has the same original
bytes as the Drive JPEG or that its CDN file is currently reachable. The GM's
explicit selection supplies that asset binding; actual rendering, full-image
bounds, source identity, ruler scale, image quality, and permission behavior
remain live acceptance gates for additional assets/layouts. The pilot's hosted
3500×3500 WebP was independently compared pixel by pixel with the approved JPEG;
the small compression differences are recorded in its private acceptance report.
Copy mode's create-new-graphic path has automated coverage but was not live-tested
in this commissioning run. Native UI-only crop/alignment features and unlisted
page styles are not changed or inferred by this component.

Minimum UI preparation is an existing blank/unassigned page, an uploaded image
dragged once onto it and selected, installation of the separate Mod, and one
GM-only transfer Handout. Then bind once, preview, and import. No manual page
settings, numeric image positioning, or image resizing are required.
