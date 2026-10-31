# D35 Dynamic Lighting Builder v0.1

Prepare reviewed ordinary vision barriers against an approved, already configured
map. This component creates only opaque lighting paths and explicitly requested
lighting settings on an existing private page. **Synthetic live acceptance passed
in disposable d35 on 2026-10-31 with patch v0.1.1, latest VTT and sandbox 1.5.**
The Wreck production interpretation remains proposed, unapproved and unapplied.

## Files and dependencies

- `tools/dynamic_lighting_package.py`: strict specification validation, normalized
  coordinate conversion, unique Area03 packages, and exact-image SVG review overlays.
- `Roll20 Importer/D35_Dynamic_Lighting_Builder.js`: separate Mod, depending on
  the existing Journal importer's SHA-256 helper and Map Page Setup's validator
  and verified version-1 managed map state. Neither dependency is modified.
- `tests/roll20_mock/fixtures/dynamic-lighting.json`: entirely synthetic geometry.
- `tests/test_dynamic_lighting_package.py` and
  `tests/roll20_mock/dynamic-lighting-tests.js`: mechanical and conflict tests.
- The existing mock gains documented path parent/geometry aliases, defaults, and
  opt-in strict path creation checks. Player Handout filing and other tools remain unchanged.

An unmanaged or manually configured map cannot be silently adopted. Supply its
exact original Map Page Setup package and the already verified page/graphic IDs.
The Mod checks that package's fingerprint against its existing binding and setup,
then reads the actual map properties again. It does not rerun Map Page Setup,
resize the page, reposition the image, or edit its dependency state.

## Specification and generation

The synthetic JSON fixture documents the complete schema. A specification supplies:

- `lighting_id`, title, exact embedded `map.package`, explicit `map.page_id` and
  `map.graphic_id`, and the approved original image `map.sha256`.
- `compatibility.engine`: explicitly `classic` or `latest`; `native_path_id` is
  an explicit native GM-layer polyline ID, or null for selection during preview.
- `review`: proposed/approved status, named reviewer for approval, rationale,
  and pending/accepted decisions. Every interpretive barrier needs its own
  decision with the same ID. All decisions must be accepted before approval.
- `lighting.before` / `lighting.after`: identical sets of explicitly supplied
  boolean fields. Supported fields are `dynamic_lighting_enabled`,
  `daylight_mode_enabled`, and `lightrestrictmove`. Empty objects preserve settings.
  Explicitly requesting `lightrestrictmove: true` is rejected. The legacy raw
  value `false` does not guarantee unrestricted movement in the latest VTT;
  see the native movement observation below.
- `barriers`: stable IDs, normalized `[u,v]` polylines, rationale, and confirmed
  or interpretive certainty. An empty list is valid. A closed polygon repeats
  its first point. Separate discontinuous walls use separate IDs.
- `annotations`: labeled normalized review regions. **Never imported as barriers.**

Run from Area01, with the specification and approved original in Area03:

```powershell
python tools/dynamic_lighting_package.py "<Area03>\lighting-spec.json" --output-root "<Area03>\Reports" --image "<Area03>\approved-map.jpg"
```

The new unique `dynamic-lighting-<uuid>` directory contains `lighting-package.json`
and, with `--image`, `review-overlay.svg`. It never overwrites an older bundle.
SVG embeds the exact PNG/JPEG bytes after checking their SHA-256 and dimensions;
the original asset is not rewritten. Other overlay raster formats are unsupported.

Coordinates have origin at the approved full image's top left, with both axes
increasing right/down and values in `[0,1]`. For the verified unrotated placement:

```text
page_x = map.left - map.width/2 + u * map.width
page_y = map.top  - map.height/2 + v * map.height
```

The approved map frame, scale and grid are reused, not inferred from its title.
Crops, rotation, mirroring and nonzero grid offsets are outside this version.
Validation rejects nonfinite/out-of-bounds coordinates, zero-length segments,
self-intersections, backtracking, duplicate identities and overlapping collinear
segments. Adjacent endpoints and intersections between distinct walls are valid.
Limits: 200 paths, 200 vertices per path, 2,000 barrier vertices total.
Segments shorter than 0.01 page pixels are refused so readback tolerance cannot
conceal a collapsed microscopic barrier.

## Compatibility checks

The adapters use the documented
[Roll20 Mod object API](https://help.roll20.net/hc/en-us/articles/360037772793-Mod-Scripts-Objects):
classic `path` with create-time `path`/read-only `_path`, or latest-engine `pathv2`
with `shape: "pol"` and JSON points. Both use `layer: "walls"`,
`barrierType: "wall"`, no player controllers, zero rotation and no one-way behavior.
Local points and their page center are computed from the reviewed coordinates.
Classic horizontal/vertical paths use a symmetric one-pixel bounding box without
moving the line's centerline.

The documented `Campaign().sandboxVersion` must be 1.0 or 1.5. Both are accepted;
the [function documentation](https://help.roll20.net/hc/en-us/articles/360037772833-Mod-Scripts-Function-Documentation)
lists both path create types without a sandbox-1.5 restriction. No sandbox upgrade
is performed or inferred, and no sandbox-1.5-only instance methods are used.
There is no documented global engine-version detector in the
referenced API. The GM must verify the chosen engine in the game UI. For a
nonempty plan, preview additionally requires a native, uncontrolled GM-layer
polyline of the matching object type on the target page. It reads that actual
object and its ordinary-barrier property; it never creates a compatibility probe
or silently falls back to a different backend.

Select exactly one suitable native line when previewing if `native_path_id` is
null. Its ID is recorded without manual transcription and retained for audit
and restart. An explicit conflicting ID/selection is refused. The witness is
preserved and never moved to the lighting layer. Zero-barrier plans need no
path witness because they create no path objects.

Live commissioning exposed native `createObj` augmentation of its input object
with internal bookkeeping such as `_type`. Patch v0.1.1 passes a shallow copy
of creation attributes so those additions cannot contaminate the reviewed
readback expectations. Required properties, identity checks and partial-failure
protections remain strict; the original failed object is retained for evidence.

A witness and API readback cannot prove native rendering/line-of-sight semantics.
The latest adapter passed the synthetic visual and actual player-role tests
below. The classic adapter and sandbox 1.0 remain unverified live.

## Commands and safety

Create a private `D35 Lighting Transfer` Handout with the complete package in
GM Notes. Leave both player-viewer and player-editor permissions empty.

```text
!d35light preview D35 Lighting Transfer
!d35light apply D35 Lighting Transfer --confirm <64-character token from preview>
!d35light audit D35 Lighting Transfer
```

Commands also accept the transfer Handout ID. Reports are GM whispers. Preview
shows exact target IDs, counts, engine declaration, observed sandbox, native
witness, current lighting, planned changes and a confirmation token. It makes
no native writes. The token binds the package and the observed preflight baseline.
Changing approval status, geometry, settings or that baseline requires a new preview.

Apply requires an approved specification and the matching token. The target must
remain off the party ribbon and all player-specific assignments. Existing map
identity, dimensions, placement and recorded properties are verified; additional
Map-layer graphics require a separate review. Existing tokens, pins, drawings,
Handouts, Characters and other objects are preserved. Unmanaged lighting paths,
doors or windows are refused, rather than adopted, overwritten or removed.
Nonempty plans require enabled Dynamic Lighting and the raw
`lightrestrictmove: false` value. This is not a guarantee that native walls
allow tokens to move through them.

One managed lighting plan reserves each page. State retains each path's native ID
and readback snapshot. Repeating preview/apply/audit on a verified identical plan
performs no native writes and preserves all identities; no confirmation token is
needed for this verification-only repeat. Manual edits, missing paths, changed
packages or unsafe permissions cause an error, never repair or replacement.
Path JSON whitespace, numeric property strings, hex-color case, and numeric
readback variation up to one millionth of a pixel are normalized for comparison.

If a write fails, completed objects and reserved identities remain available for
inspection. Retrying a partial operation refuses further creation; it cannot
duplicate earlier paths. There is no rollback, force/update, delete or repair
command. An acknowledgment lost during creation can leave a native object whose
ID was not returned: stop for native inspection instead of retrying under a new
identity. Error write counts describe acknowledged writes, not proof that no
unacknowledged server operation occurred.

Audit never applies a plan. It verifies the managed map, page lighting, exact
managed path IDs, geometry, properties, inventory, native witness and privacy.
It compares metadata, not the bytes of a Roll20-reencoded upload; approved image
identity comes from the existing verified Map Page Setup binding. Original-image
SHA-256 is review provenance and is checked locally for the overlay.

## Wreck of the Sea Wyvern proposal

Current canonical manuscript, Design Protocol, production tracker, and Drive
image metadata were consulted read-only. Exact source exports, provenance,
approved original, proposed package and overlays remain in private Area03.
The approved frame is 3,500×3,500 pixels, 50×50 squares, five feet per square,
full image, center 1,750/1,750, zero rotation/mirroring/offsets, using the previously
approved pilot placement. No lighting interpretation was inherited from that approval.

The initial proposal has **zero confirmed ordinary barriers and no page lighting
changes**. This remains pending review; it is not a finding that rock or hull
occlusion can never matter. Open water, surface texture, loose debris, spars and
exposed railings do not justify an opaque hull outline for every viewpoint.
The SVG separates four amber rock review regions, exposed deck (`d01`) and
submerged aft (`u01`) from importable cyan barriers. Rock outlines are approximate
visible review footprints, not approved wall traces or inferred hidden boundaries.

The reviewer must resolve rock heights/observer elevation, hull sightlines at
deck versus water level, underwater/hold visibility, ambient lighting, and the
manuscript's reef/drydock/tide/nearby-beach description versus this water-only
image. Ordinary 2D barriers cannot represent vertical occlusion. Do not add an
invented shoreline, trace the translucent submerged hull as a surface wall, or
enable darkness/daylight silently. Do not apply this Wreck package while proposed.

## Live acceptance status

Synthetic commissioning verified the native elbow at `(70,56) → (350,56) →
(350,336)`, actual player vision from left, right and above, private page
assignments, sandbox restart, stable identities, unchanged path counts and
zero-write repeat application. Native daylight edits were rejected by both
audit and apply, preserved without writes, then restored through native UI;
audit passed again. Independent live dragging of a managed barrier was not
performed; geometry-edit conflict coverage remains automated.

The first attempt exposed native input-attribute augmentation. Its partial
object and blocked reservation were retained; a fresh synthetic page passed
after the bounded v0.1.1 correction. A private, page-locked test Mod created
the compatibility witness and observer through documented APIs after native
pen gestures did not persist. Actual player rendering, rather than that
witness alone, established sight blocking. The private write-capable fixture
helper was disabled after commissioning. Evidence and native IDs are in Area03.

Native movement observation: the latest VTT displayed the preserved raw
`lightrestrictmove: false` value as **When Lighting Is On (default)**. The
player token respected the wall and was routed around its open endpoint to
test the opposite side. v0.1 does not implement other movement modes or promise
unrestricted movement; review that native behavior separately before production.

Wreck geometry/configuration interpretation and approval remain pending. No
Wreck lighting plan was applied. Synthetic success grants no production approval.

## Live acceptance procedure in disposable d35

Synthetic steps 4–8 passed as recorded above. Wreck-specific steps 1 and 3
remain separate future work requiring explicit approval. Do not use production.

1. Review the private Wreck overlay and resolve the five judgments. Keep the
   zero-barrier proposal or supply corrected, approved geometry/configuration;
   record the reviewer and accepted decisions, then regenerate the package.
2. Install this file as a separate Mod alongside the unchanged Journal and Map
   Page Setup scripts. Confirm the selected VTT engine in native UI and sandbox
   version. Preserve existing installations and objects.
3. For Wreck, reuse the existing verified Page Setup pilot and uploaded map.
   Create the private transfer, paste the package, and preview. Verify its actual
   IDs against the saved Map Page Setup acceptance record. With an approved empty
   plan, apply must report zero barriers and zero page/path writes. Audit it.
4. Independently exercise real wall creation on a new disposable **synthetic**
   blank page. Use the prepared private synthetic PNG and map-page package
   template, establish the map through existing `!d35map bind/preview/import/audit`,
   and fill the lighting template's two explicit target IDs from those reports.
   These placeholder IDs cannot resolve in a real game. No production identity
   or geometry is substituted. Select one small native GM-layer polyline and
   preview the nonempty synthetic lighting package. That selection supplies
   the compatibility witness ID; leave it on GM layer.
5. Inspect the synthetic preview: the source's reference elbow should transform
   to page points `(70,56) → (350,56) → (350,336)` at the standard fixture frame.
   Apply with its exact token, then audit. Inspect native lighting-layer position,
   opaque-wall behavior, Map-layer image preservation and page settings. Check
   horizontal/vertical centerlines and page-boundary cases on this scratch page
   before relying on the corresponding backend in production.
6. Use a disposable sight-enabled test token and an actual player-role view to
   verify blocked versus unblocked sight across the elbow. Check both sides and
   the endpoints, with daylight enabled as specified for this synthetic test.
   The builder does not configure tokens, vision or player assignments. If a
   temporary test assignment is needed, restore the page's unassigned state
   before running importer commands again; audit enforces private-page safety.
7. Restart the Mod sandbox. Repeat audit and apply on the same packages; expect
   identical map/page/path IDs, unchanged path counts and zero native writes.
8. On the synthetic page only, toggle an already recorded daylight setting
   through native UI. Audit/apply must reject the manual change and preserve it.
   Restore exactly that setting and audit again. Test moving a managed barrier
   safely on scratch geometry if independent live movement-conflict proof is
   needed; automated tests alone do not establish live canvas-drag behavior.

Record native object IDs, before/after properties and counts, actual player-view
screenshots, engine/sandbox, restart/no-write reports and any normalization or
compatibility errors in Area03. Stop on incompatibility; retain partial objects
and evidence rather than clearing state or forcing another import.

## Automated verification

```powershell
python -m unittest discover -s tests -p test_dynamic_lighting_package.py
node tests/roll20_mock/dynamic-lighting-tests.js
node tests/roll20_mock/dynamic-lighting-tests.js --prepared-package "<Area03>\lighting-package.json"
```

The public suite has 51 Mod scenarios and 32 Python tests. Supplying the private
Wreck package adds an exact-package, review-gating scenario. The established
504-check component regression matrix must also pass with the extended mock.
These automated tests do not establish live rendering, Dynamic Lighting
entitlement or actual player vision. Those properties were checked separately
in the synthetic latest-VTT/sandbox-1.5 commissioning described above. The full
matrix passed 588 checks: the existing 587 plus the native-argument regression.
