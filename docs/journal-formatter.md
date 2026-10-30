# Journal formatter and map-pin conventions

`tools/journal_formatter.py` is a standalone Python standard-library formatter.
It does not load the Character importer or token builder, contact Roll20, or
modify Drive. It produces local HTML, Handout fields, audits, and pin plans.

## Authorities and boundaries

Reviewed the current [Savage Tide Design Protocol](https://docs.google.com/document/d/1iazJkITw9kLhcMc_x6Hwn0XHnDQmy7lc5Ye8Zbn_080/edit)
and [Adventure Manuscript](https://docs.google.com/document/d/1Gn87h3CrwLCnsRdp7hYut32_T5AKaXBSvsX_ABoS23Q/edit)
through fresh read-only Google Docs exports on 2026-10-30. The Protocol's Phase 6
sections govern titles, runtime entry scope, exact destinations, navigation, and
GM-only defaults. This task's explicit rules preserve manuscript sequence and
paragraphing and put ordinary runtime text in Description & Notes.

No live game, existing Journal inventory, or production tracker was inspected or
changed. Existing live titles, numbering, links, and IDs must be supplied in an
offline catalog before resolving deployed targets. Do not infer them from an
entry's proposed name. This tooling task does not mark Phase 6 production complete.

## Fixed behavior

- Source blocks retain their order, wording, punctuation, whitespace, paragraph
  boundaries, heading levels, bold/italic runs, tables, and lists. Repeated source
  paragraphs remain repeated; duplicate block IDs fail validation.
- Explicit published read-aloud becomes `<blockquote><p>…</p></blockquote>`.
  Consecutive paragraphs in one passage stay within the same blockquote. Italics,
  indentation, monster descriptions, and other suggestive prose never establish
  read-aloud status.
- Short bold run-in categories stay inside ordinary paragraphs. The formatter
  neither promotes them into headings nor moves creature-reference lines.
- All source HTML goes in Handout `notes` (Description & Notes). `gmnotes`,
  `inplayerjournals`, and `controlledby` are empty. GM-only visibility is controlled
  by permissions, not by moving the source to GM Notes.
- Previous, Next, Related, and Index links occupy a separate final Navigation
  section. Exact destination title and ID must resolve through the catalog;
  heading links additionally require the native Copy Header Link URL. No guessed
  slugs, fuzzy matching, summary text, or rewritten source cross-references.
- Pin properties use `link` = exact Handout ID, `linkType=handout`, `subLink` =
  exact heading text, `subLinkType=headerPlayer`, `autoNotesType=blockquote`, and
  all three desync flags false. Custom `notes` and `gmNotes` remain empty.
  `visibleTo` and every tooltip/nameplate/image/notes visibility field are empty.
  A missing source blockquote has no invented fallback.

These pin fields follow [Roll20's object documentation](https://help.roll20.net/hc/en-us/articles/360037772793-Mod-Scripts-Objects).
The [Map Pins guide](https://help.roll20.net/hc/en-us/articles/36271267343639-Map-Pins)
documents first-blockquote flavor extraction and its default being OFF for
Description & Notes heading pins. The explicit property enables it. Local source
analysis conservatively stops at the next heading; Roll20's exact nested-heading
behavior still requires live verification. Pins are layerless; no token layer is
used as a visibility substitute.

## Reusable API and input

Use `format_handout(title, blocks, links, catalog)` and `audit_handout(...)`.
The audit requires exact ordered HTML and content equality against the supplied
source, correct permissions, and parseable HTML structure. It detects dropped,
duplicated, reordered, and altered output. It cannot establish whether an
unreviewed transcription itself is complete or canonical.

Block kinds are `heading` (`level`, `runs`), `paragraph` (`runs`), `read_aloud`
(`paragraphs`, a list of run lists), `table` (`header_rows`, `rows`, each cell a
list of paragraph run lists), and `list` (`ordered`, `items`, each a run list).
Each block has a unique `id`. Runs have `text` and optional boolean `bold`,
`italic`, `sup`, `sub`. Text is escaped, never accepted as executable HTML.
Unsupported source constructs fail instead of disappearing silently.

`docx_section(path, start_heading, end_heading, read_aloud_styles=())` extracts
the exact start heading inclusive through the exact end heading exclusive. Both
boundaries must be unique. It retains direct bold/italic runs and Heading1–6.
Quote style IDs must be explicitly identified from source review. The narrow
adapter rejects selected DOCX tables, lists, drawings, hyperlinks, revisions,
fields, inherited character styles, and unmapped paragraph styles. Such material
requires reviewed structured input; tables and lists are supported by the core
renderer. Arbitrary DOCX layout conversion is outside this adapter's scope.

Catalog shape (illustrative IDs only):

```json
{
  "EX 1.1 — Arrival": {
    "id": "-actualObservedHandoutID",
    "headings": ["Arrival"],
    "header_links": {"Arrival": "https://journal.roll20.net/handout/-actualObservedHandoutID#actualCopiedFragment"}
  }
}
```

Navigation items contain `role`, exact `title`, and optional exact `heading`.
`pin_intent(title, heading, blocks)` validates the source heading and records the
first applicable source quote ID, or null. `pin_settings(intent)` produces an
unresolved native settings template. `resolve_pin(intent, catalog)` requires the
destination ID and heading and returns native properties. Page ID, coordinates,
and pin appearance are placement concerns and are not guessed here.

## CLI and local example

From Area 01:

```powershell
python -m unittest discover -s tests -p test_journal_formatter.py -v
python tools/journal_formatter.py --source "..\03-Import-Staging\Reports\Journal-Formatter-20261030-baed8608\wrecked-wyvern-source.json" --output-root "..\03-Import-Staging\Reports"
```

The CLI requires a reviewed JSON object with `title`, `blocks`, optional
`navigation`, `catalog`, `pin_headings`, and `provenance`. It writes a new
`journal-<UUID>` directory under Area 03; it never overwrites prior output.
`handout.json` includes review fields (`source_html`, `navigation_html`, digest)
that are not Roll20 object properties. A future writer should allowlist only the
five native Handout fields. Pin plans marked `needs_handout_id` are not deployable.

The first canonical example is `ToD 6.1 — The Wrecked Wyvern`, retaining the
published internal heading `The Wrecked Wyvern (EL 10)`. The fresh source scope
contains that heading and seven paragraphs, ending before `Repairing the Sea
Wyvern ` (including the source heading's trailing space). It includes both
creature-reference lines in their manuscript positions. The Part Six overview
and subsequent repair section are separate source sections, not omissions from
this runtime entry. There are **no marked read-aloud passages or tables** in this
source section. Consequently the example contains no blockquote, and the native
pin setting has no flavor passage to extract. Source text is not repurposed to
manufacture one. Synthetic fixtures verify quote/table behavior separately.

The retained Area 03 example contains current source exports, source JSON,
Description & Notes HTML, Handout JSON, fidelity audit, and pin intent/settings.
No actual existing Handout ID or adjacent implemented title was retrieved, so
the example has no fabricated navigation links or resolved pin ID.

## Preserving working objects and later verification

`plan_existing` preserves matching Handouts by default. An explicit ID resolves
duplicate names. Opt-in update proposals retain the original ID and complete
before snapshot and patch only notes and permissions; they never rename,
delete, or replace objects. `plan_existing_pin` likewise requires an explicit
existing pin ID and preserves page, coordinates, and appearance. Both are pure
offline planners. No executor or automatic live migration is installed.

Before any later authorized application, review the proposal, back up prior
notes including GM Notes, re-read the object, and require equality with the
before snapshot to prevent overwriting intervening work. A separately authorized
live check must confirm HTML editor round-tripping, exact heading navigation,
native extraction for Description & Notes heading pins (including no-quote and
nested-heading cases), persistence of synced fields, and GM/player visibility.
Only then should production inventory and tracker status change.
