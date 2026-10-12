# Managed Lifecycle v1 — pre-commissioning compatibility and state footprint

This follow-up reviews commit `e1be6b9d7a4551140f34fe66259cd3e5fbbfa3b5` and changes graphic creation compatibility plus diagnostic tests. The importer remains version 0.5.0, uses schema version 1, and retains the existing state architecture.

## Compatibility change

`captureDefaultToken()` preserves writable, unowned saved-token properties, strips underscore-prefixed read-only fields and the `id`, `type`, `subtype`, and `cardid` identity aliases, and supplies `pageid: plan.tokenPageId`. It no longer passes `_pageid` or saved identity/card metadata to `createObj('graphic', ...)`. See [Roll20's graphic object properties](https://help.roll20.net/hc/en-us/articles/360037772793-Mod-Scripts-Objects) and [createObj's parent-property convention](https://help.roll20.net/hc/en-us/articles/360037772833-Mod-Scripts-Function-Documentation).

The stricter mock rejects read-only create properties, requires an existing page ID, and stores the resulting parent as `_pageid`. Tests verify import/update/bind capture, writable legacy/current vision and lighting, aura, tooltip, third-bar data, rotation, flip, status markers, notes, and default-token controls. Existing encounter tokens remain untouched during ordinary updates; capture graphics are removed.

## Measurement method

The runner already imports the corpus into one shared mock world and updates every new Character once. Measurement occurs after the full corpus and the isolated lifecycle tests finish. The latter use independent worlds and cannot reset or pollute the measured namespace. Different input files create separate managed Characters even if their creature names overlap.

Only `state.D35StatblockImporter` is serialized with compact `JSON.stringify`, without indentation or a trailing newline. Byte counts use UTF-8 `Buffer.byteLength`; character counts use JavaScript UTF-16 code units (`json.length`), not Unicode code points. Average total state per Character includes the amortized namespace and latest-report overhead. Largest manifest excludes its outer Character-ID key.

The new `state-footprint.js` helper only reads data; it stores no measurements in production state. The runner always prints a summary and can export the full diagnostic, importer hash, timestamp, and payload SHA-256 fingerprints with `--footprint-json`. Repeat `--json-dir` to combine corpora.

## Complete recovered working-tree corpus

Measured at `2026-10-12T19:42:42.412Z` using the 36 saved payloads in `Converted JSON` plus all 30 freshly converted release fixtures in `_smoke_ps_out_20261012_124137`. Every payload was imported with a token and updated once. The 30-fixture set includes the pre-existing, uncommitted Compound Natural Iteratives recovery fixture; that fixture and its recovery changes are not part of this follow-up commit.

| Measurement | UTF-8 bytes | UTF-16 code units |
| --- | ---: | ---: |
| Whole namespace, 66 managed Characters | 4,057,609 | 4,057,474 |
| Average whole-state share per Character | 61,478.92 | 61,476.88 |
| Average Character entry, including its key/colon | 57,681.77 | 57,679.73 |
| Largest individual manifest: Tonatiuh | 141,058 | 141,015 |
| `lastReport` | 250,504 | 250,504 |
| Fixed namespace/latest-report overhead with empty `characters` | 250,547 | 250,547 |

Reproduction from the repository root, after running the release-readiness suite (substitute that run's fresh output directory):

```powershell
node tests\roll20_mock\run-importer-tests.js --json-dir "Converted JSON" --json-dir "_smoke_ps_out_20261012_124137" --footprint-json "<existing output directory>\working-corpus-66.json"
```

## Rough linear projections — not Roll20 limits

These are projections from the measured workload, not measured campaign capacity or guaranteed Roll20 limits. They hold the latest report/fixed overhead constant and scale the mean Character-entry size:

`projected bytes(N) = 250547 + N × 57681.77272727273 + (N - 1)`

| Managed Characters | Projected UTF-8 bytes | Projected UTF-16 code units |
| ---: | ---: | ---: |
| 50 | 3,134,685 | 3,134,582 |
| 100 | 6,018,823 | 6,018,619 |
| 200 | 11,787,101 | 11,786,691 |

The projection assumes the same creature/plan mix, mock ID lengths, latest report, and verified post-update journals. Creation journals, pending/failed operations, a larger latest report, more elaborate creatures, real Roll20 ID lengths, and different serialization/storage accounting can increase the footprint. Timestamps and generated row IDs can change exact counts slightly between runs. No storage optimization, state migration, or limit-based policy is introduced here.

## Verification

The exact proposed second-commit snapshot was tested independently of the uncommitted recovered work. Its tracked release corpus contains 29 fixtures; adding the same 36 saved payloads yields 65 managed Characters in one namespace. Measured at `2026-10-12T19:45:37.604Z`, that source-only combined run produced:

| Measurement | UTF-8 bytes | UTF-16 code units |
| --- | ---: | ---: |
| Whole namespace, 65 managed Characters | 3,946,524 | 3,946,389 |
| Average whole-state share per Character | 60,715.75 | 60,713.68 |
| Average Character entry | 56,860.20 | 56,858.12 |
| Largest individual manifest: Tonatiuh | 141,028 | 140,985 |
| `lastReport` | 250,504 | 250,504 |

Using this source-only mix and the same fixed-overhead method, rough projections are 3,093,606 bytes / 3,093,502 UTF-16 code units at 50 Characters; 5,936,666 / 5,936,458 at 100; and 11,622,786 / 11,622,371 at 200. These remain projections, not Roll20 limits.

The full recovered working-tree release gate passed 30 converted fixture imports/updates, 36 saved-payload validations, and all 42 lifecycle scenarios. The complete shared-state corpus run passed all 66 imports/updates plus the same 42 scenarios. The three added scenarios cover strict graphic creation, saved-token writable-property preservation through update/rebind, and non-mutating UTF-8/UTF-16 footprint accounting.

The exact commit snapshot also passed the complete release-readiness gate with its 29 tracked fixture imports/updates and all 42 lifecycle scenarios, followed by all 65 combined corpus imports/updates and the same 42 scenarios. Importer mirrors match, and whitespace checks pass.

The source-control checkpoint excludes pre-existing recovered hunks in the two importer copies and existing test runner, and leaves the parser/module/fixture recovery changes uncommitted. No merge, release tag, or live Roll20 installation is performed. Real API storage timing, sheet workers, image rewriting, and default-token drag-out still require commissioning.
