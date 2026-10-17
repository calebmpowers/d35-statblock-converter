# Managed Lifecycle v1 — importer 0.5.0

This milestone extends the existing PowerShell → schema version 1 handout → Roll20 Mod pipeline. The parser, converter JSON schema, local app, and stat-block authoring contract are unchanged.

The importer now follows **convert → validate → plan → apply → read back → report**. `buildWritePlan` contains the existing Character-sheet mappings. Creation, preview, update, adoption, and audit use those mappings or their last verified plan. There is no separate update mapper or reverse converter.

## Recovery and implementation branch

Implementation branch: `codex/managed-lifecycle-v1`, created from recovered HEAD `5a6977d`. The original branch `agent/docx-template-parser` was 21 commits ahead of its configured upstream. Its six existing modified files and all untracked/ignored recovery evidence were retained.

Before source edits, a byte-preserving ZIP checkpoint captured 11,318 files, including `.git`, uncommitted files, and ignored artifacts (248,074,877 uncompressed bytes):

- `.recovery-checkpoints/before-managed-lifecycle-20261012-112206.zip`
- `.recovery-checkpoints/before-managed-lifecycle-20261012-112206.manifest.json`

Each archived file was checked against its SHA-256 digest. The checkpoint folder is ignored to prevent accidental publication. Keep it with the recovered repository backup. Restore into a separate directory for inspection; do not extract it over subsequent working changes.

The attached audit brief described a prior read-only audit. The implementation request explicitly authorized this branch and source changes. No reset, clean, staging, commit, push, live installation, parser rewrite, or unrelated normalization was performed.

## Commands

All commands except help/ping require a GM player ID. Script-to-script messages do not bypass this requirement.

```text
!d35ping
!d35import help
!d35import --help

!d35import validate <handout name or id>
!d35import import <handout name or id> [--token <token-id>] [--avatar]
!d35import create <handout name or id> [--token <token-id>] [--avatar]
!d35import <handout name or id>

!d35import preview <character-id> <handout-id>
!d35import update <character-id> <handout-id>
!d35import adopt <character-id> <handout-id>
!d35import bind <character-id> [--token <token-id>] [--avatar]
!d35import audit <character-id>
!d35import report
```

`!d35` and `!d35importer` remain aliases. For managed operations, use IDs, not Character names. Import still accepts exact handout names; use IDs for names that contain option-like text.

`import`/`create` deliberately creates a new managed Character. Reconversion uses `preview` followed by `update` to retain the same Character ID. A handout's name or a Character's matching name never establishes ownership or causes an automatic upsert.

Import and bind accept one explicit token ID, or exactly one selected token. An explicit ID takes precedence over selection. Without a selected/explicit token, import creates a managed Character and reports that token setup was skipped. Binding requires a token. Portrait replacement requires `--avatar`; the default preserves the existing portrait.

Preview reads the current objects, reports conflicts, and includes the proposed plan in its JSON report. It does not change Roll20 objects or the verified manifest. It does replace the latest diagnostic report. Update performs a fresh preflight; preview is not a reservation or an approval token.

`report` exports the latest lifecycle report to one importer-created, GM-only handout. Open that handout's GM Notes to copy the JSON. Export reuses that handout, and refuses to overwrite it if its permissions were manually changed to share it. Run `audit <character-id>` immediately before `report` when a fresh report for a particular Character is needed.

## State and ownership

The state namespace is `state.D35StatblockImporter`:

```text
{
  version: 1,
  characters: {
    <character-id>: {
      manifestVersion: 1,
      characterId, sourceHandoutId, importerVersion,
      revision, verifiedAt,
      rows: { <logical-key>: <Roll20-row-id> },
      owned: {
        characterFields: [<field-name>, ...],
        attributes: { <attribute-name>: <object-id> },
        abilities: { <logical-key>: <object-id> }
      },
      baseline: <last successfully read-back write plan>,
      tokenPageId,
      lastOperation: { operation, startedAt, status, touched: [...] },
      pending: { plan, owned, sourceHandoutId } // only while unverified
    }
  },
  lastReport: <latest machine-readable lifecycle report>,
  reportHandoutId // after an explicit report export
}
```

Plans contain `character`, `attributes` (`current` and `max`), `abilities`, `rows`, `tokenPolicy`, and, when owned, a bound-token reference and reusable `defaultToken` template. `preservedCurrent` identifies live values left alone. Existing preserved live values are recorded as actually observed when a successful readback commits the baseline; they are excluded from ordinary source-value conflict enforcement.

The importer currently owns the existing mapped sheet Attributes, generated weapon Abilities, Character name, and biography when the source supplies it. It does not claim Character GM Notes or permissions. Portrait ownership is acquired only by explicit `--avatar`. Unowned nonempty biography text blocks an update that would newly introduce source biography text.

Spell row keys use spell family, normalized section label, level, normalized spell name, special-spell usage group where applicable, and occurrence. Maneuver keys use name, level, discipline/school, and occurrence. Existing keys reuse their saved row IDs. New keys receive new IDs. Ability keys use the existing generated, normalized display names. Changes to attack bonuses or macro content retain an Ability's ID when its name is unchanged.

Renaming a spell, changing its level/family/usage identity, or changing a maneuver's name/level/discipline creates a new logical row and initializes its use state. Truly identical repeated identities use occurrence order; their identity cannot be recovered independently of that order from the current schema. Ambiguous existing rows are refused during adoption. A renamed generated Ability is treated as an obsolete owned Ability plus a new Ability.

Adoption is conservative and performs no sheet writes. The explicit Character ID must already contain the proposed mapped static values, unique matching rows, and unique matching Abilities. Live current HP and use/readiness values may differ. Extra manual content remains unowned. Missing, different, or ambiguous mapped content refuses adoption. Adoption does not claim an existing portrait or saved default token; an explicit bind handles token ownership afterward.

## Conflict and preservation rules

For static managed values, preflight compares the previous verified value, current Roll20 value, and proposed value. A current value different from the verified baseline blocks the whole ordinary operation, including when the proposed value happens to equal the manual edit. There is no force-overwrite flag or automatic conflict resolution.

Missing or renamed owned objects, duplicate managed names, copied logical rows, and new mappings that collide with unowned objects also block mutation. Cleanup checks old values first and deletes only known owned object IDs. Obsolete weapon/class Attributes, spell/maneuver row Attributes, and generated Abilities are removed; unrelated fields on the same repeating row remain untouched. This can leave an otherwise empty row containing a manual annotation.

Ordinary updates preserve:

- Current `hitpoint`, `hitpoints`, and `npchitpoints` values. The mapped HP maxima remain managed and may change.
- Repeating `spellused`, `maneuverused`, `maneuverreadied`, and `maneuvergranted` current values on existing rows. New rows initialize and verify them.
- Unowned Attributes and Abilities, permissions, Character GM Notes, and unowned portrait/biography content.
- Encounter-token position, page, layer, dimensions, rotation, current HP, lighting, tint, status markers, and other properties outside the token policy. Updates do not write the bound encounter token.
- Unowned properties of an existing saved default token, including configured vision/lighting.

The saved reusable token can receive the new baseline HP, AC, and name. The existing encounter token remains as it was until an explicit bind. Rebinding a token that already represents the Character preserves its current HP; binding an unbound token initializes it. Bars remain unlinked, and the project's existing name/player-visibility defaults remain false.

Only the most recently bound token is retained as the audit reference. A token already representing another Character is rejected. If the reference token is deleted, bind a new token before ordinary updates. There is no campaign-wide token fanout.

## Readback, failure handling, and evidence

### Transient recalculation control

The D&D 3.5 sheet defines `recalc` as an ability-score recalculation checkbox. Its `sheet:opened change:recalc` handler calls `StartingSetup`, which recalculates ability scores/modifiers and returns `recalc` to `0` when the request is `1`. See the [sheet source](https://github.com/Roll20/roll20-character-sheets/blob/master/D%26D_3-5/charsheet_3-5.html) (checkbox near line 7901 and worker near lines 13184–13227, inspected 2026-10-16); [sheet.json](https://github.com/Roll20/roll20-character-sheets/blob/master/D%26D_3-5/sheet.json) selects that HTML file.

The v1 plan retains `recalc: 1` as request intent, and ownership of the same Attribute remains intact. Only `attribute.recalc.current` accepts either numeric/string `0` or `1` during preflight, adoption, and readback. Missing/renamed owned objects, duplicates, invalid control values, and `max` mismatches still fail; ordinary managed statistics retain strict comparisons. Existing verified baselines containing `1` need no migration. Audit and preview make no object writes or baseline changes. A successful import/update records the observed control state in the verified baseline.

No-change updates and explicit token binds do not reset or retrigger the control. When application creates, changes, or removes mapped sheet Attributes other than `recalc`, it requests recalculation once after all ordinary writes and default-token capture. A new control starts idle; an existing active control is silently reset with ordinary `set` before a fresh `setWithWorker({ current: 1 })` request. This conservatively includes any mapped sheet-Attribute changes, not just ability scores; live HP/use-state differences alone cause no writes and no request. [Roll20 documents `setWithWorker` for Attributes](https://wiki.roll20.net/Mod%3AFunction/Roll20_object) and [registering `onSheetWorkerCompleted` before the request](https://help.roll20.net/hc/en-us/articles/360037772833-Mod-Scripts-Function-Documentation). The existing operation lock and timeout cover worker completion before storage readback; timeout retains pending evidence for audit.

The mock models request ordering, completion, and optional `1` → `0` consumption, not the sheet's actual calculations. Storage verification still reports `sheetCalculationsVerified: false`. Live commissioning must confirm the installed sheet's worker behavior, correct resulting ability scores/modifiers and rolls, and preservation of HP, expenditure, and encounter state after a real changed-source update. Worker edits to ordinary managed values remain readback failures rather than being silently accepted.

After separately installing the correction, resume the existing Character with `!d35import audit -P4636RiQPYRw2w9RtBP`, then `!d35import report`. Use `!d35import preview -P4636RiQPYRw2w9RtBP <handout-id>` and `!d35import update -P4636RiQPYRw2w9RtBP <handout-id>` with the unchanged source first; expect zero writes and no recalculation request. For changed-source commissioning, preview and update using the deliberately revised handout, allow workers to settle, audit again, and check sheet calculations/rolls manually. Reimport is unnecessary.

Readback checks real Attribute objects (including `current` and `max`), Ability IDs and fields, mapped Character fields/text, repeating-row identities, the bound token, saved default-token fields, and known retired object IDs. It does not use sheet-default lookup values as evidence that an Attribute object exists.

Character `bio`, `gmnotes`, and `_defaulttoken` reads use callbacks with timeouts. Numeric strings and numbers are compared equivalently; image URLs are compared by library image identity across CDN/rendition/query rewrites. Empty text is not treated as numeric zero.

Saved default-token visibility fields `showname`, `showplayers_name`, `showplayers_bar1`, and `showplayers_bar2` may be omitted or null when disabled. Only these saved fields compare omitted/null values as false; explicitly enabled values still fail verification against a disabled plan. Bound tokens, Attributes, Abilities, and other saved-token fields retain their existing comparisons. This also lets `audit` verify an existing pending import whose only readback failures were these disabled flags, advancing its verified baseline without recreating the Character or rewriting its sheet. After installing the correction, run `!d35import audit <character-id>`; all other pending checks must still pass.

Default-token capture uses only `setDefaultTokenForCharacter`. The importer creates a temporary graphic off-map using the create-time `pageid` parent property. It removes read-only underscore-prefixed graphic properties and identity aliases from saved-token data, preserves writable unowned properties, combines them with the managed reusable template, captures it, reads the actual saved blob back, and removes the temporary graphic before committing the baseline. It does not temporarily heal or relocate the encounter token. Unsupported capture, invalid library images, or missing token pages fail preflight.

A per-Character lock prevents overlapping importer operations; concurrent creates from the same handout are also locked. The lock covers asynchronous input/readback. A pending operation is persisted before object application. A partial write failure or unsuccessful readback keeps the old verified baseline and blocks further updates/binds until audit verifies the pending candidate. Audit does not repair objects. After a deliberate manual correction, audit can verify and commit the pending candidate.

Each Character retains only its latest operation journal. Entries identify touched object IDs, paths, and intended actions, including attempted writes and temporary capture graphics. Limits are 2,500 managed Attributes, 256 Abilities, 512 rows, a 1 MB input handout, and 5,000 journal entries; the projected journal size is checked before mutation. Only the latest full diagnostic report is retained, rather than an accumulating campaign history.

Reports include expected/observed values, previous values during preflight, issues, preservation decisions, warnings, and touched objects. `storedObjectsVerified` becomes true only after successful readback. `sheetCalculationsVerified` is always false: matching stored data does not prove sheet workers, macros, or rolls work in production.

Roll20 does not offer an importer-wide transaction. Other Mods and user edits are not covered by the local operation lock. A partial operation may require manual correction or campaign-backup recovery; there is no automatic rollback, force mode, or general repair command. A changed state-version is rejected rather than migrated implicitly.

## Local verification

Run the existing release gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\Test-ReleaseReadiness.ps1
```

The regular mock runner now also updates every imported fixture and verifies its owned object IDs and row IDs remain stable. The lifecycle suite covers adoption, conflicts, cleanup, preserved play state, token ambiguity, asynchronous reads, read-only default-token behavior, failed capture/removal/readback, operation locking, sandbox restart, normalization, and GM/report permissions.

The mock does not emulate real sheet workers, Roll20 storage/network timing, library-image rewriting, other installed Mods, or token drag-out behavior. Local success is evidence of stored-object logic, not live commissioning.

Verified locally on 2026-10-12: the full release-readiness gate (PowerShell syntax, duplicate helpers, mirrored importer bytes, conversion/fixture checks, mock imports and updates, and saved-payload validation), 30 freshly converted fixture payloads, 36 saved payloads, and 39 lifecycle scenarios. The recovered baseline also passed its full release tests before implementation. `git diff --check` passed; the remaining recovered changes outside this milestone match the checkpoint hashes.

## Proposed live acceptance test — not performed

1. Make a backup/copy of a test campaign using the actual compatible D&D 3.5 sheet. Record its sandbox version and other installed Mods. Use a disposable test page and library-uploaded token image.
2. After explicitly authorizing installation, paste the bundled 0.5.0 script. Run `!d35ping` and `!d35import help`. Confirm a non-GM cannot import, update, bind, adopt, or export reports.
3. Convert a representative caster with attacks, multiple spells, and lower rules using the unchanged local app. Place the JSON in a handout. Import with one selected token and `--avatar`. Record the reported Character ID.
4. Run `audit <character-id>` and then `report`. Confirm the JSON shows stored-object verification, correct current/max Attributes, Abilities/rows, portrait, and default-token fields, while sheet-calculation verification remains false.
5. Drag the Character onto a fresh page. Check represented Character, image, dimensions, name visibility, unlinked HP/AC bars, full baseline HP, and reusable token settings. Confirm no temporary capture graphic remains.
6. Damage the original encounter token and Character HP, spend a spell, change maneuver readiness if present, add a status marker, move/rotate the token, and change its lighting/tint/layer. Add a manual Attribute and Ability, set permissions, and add unowned saved-token vision settings.
7. Edit the source: change baseline HP/AC, change an attack bonus, remove one attack and one spell, and add a new spell. Reconvert into a new handout. Run preview, inspect the report, then update using the same Character ID.
8. Confirm there is still one managed Character; unchanged rows and actions retain IDs; obsolete owned data is gone; new rows initialize correctly; manual additions, current HP/use expenditure, permissions, and encounter state survive. Drag a new token out and confirm the reusable baseline HP/AC changed.
9. Manually edit a managed static Attribute, generated Ability action, or owned biography. Preview and update must report a conflict and perform no object writes. Restore the previous value, then update successfully. Add a duplicate managed Attribute and repeat the refusal/audit check.
10. Test two selected tokens (rejected), an explicit token ID with multiple selected tokens (only that ID is used), repeat binding of a damaged token (HP survives), and binding to a token representing another Character (rejected). Confirm portrait changes only with `--avatar`.
11. For an existing unmanaged Character, attempt update first (rejected). Adopt using an exact matching converted payload. Confirm adoption changes no sheet values, then perform a managed update. Test a mismatch/ambiguous row and confirm adoption refuses it.
12. In the disposable copy only, use a deliberately failing capture helper or test build to simulate failed default-token capture. Confirm readback failure, unchanged verified revision/baseline, retained pending evidence, and blocked further updates. Correct the saved data deliberately, audit the pending candidate, and confirm it advances only after verification. Restore the production script afterward.
13. Open the real sheet, allow its workers to settle, and check HP/AC, saves, skills, prepared/used spells, lower rules, and spell details. Roll representative initiative, weapon/full attacks, damage/crit, saves, skills, and spells. Compare results with the canonical source. Record these live checks separately from the importer report.
14. Restart the API sandbox, audit again, repeat a no-change update, and confirm ownership/IDs persist. Commission the release only after all observations are recorded and unexpected worker or Mod interactions are resolved.

## Pre-commissioning compatibility and diagnostics

The scratch-graphic compatibility follow-up keeps the v1 state architecture unchanged. The stricter mock rejects read-only graphic create properties and requires a real page via `pageid`; resulting graphics expose `_pageid`. See [the state-footprint measurements](state-footprint-2026-10-12.md) for the shared-corpus diagnostic, assumptions, and projections.
