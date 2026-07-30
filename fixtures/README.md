# Fixture Library

This folder contains raw stat block inputs used by the regression tests.

## Active Fixtures

Active fixtures live in `statblocks` and are exercised by `tests/smoke_test.ps1`.

Focused current-template fixtures cover baseline Power Attack, conditional upper skills and lower Skills rules, prepared and spontaneous Spell References, unmatched spell warnings, multi-paragraph bodies, and a representative DOCX with bold entry names and italic compact spell lines. `tests\New-DocxFixture.py` regenerates the DOCX for maintainers; end users do not need Python.

- `Advanced Ochre Jelly.txt`
- `Ashen Grave Swarm.txt`
- `Avatar of the Black Spinner.txt`
- `Chittrik, Black Spinner Shaman.txt`
- `Crystal Mindhunter.txt`
- `Dire Ape Veteran.txt`
- `Ettercap Hunter.txt`
- `Ettercap.txt`
- `Goblin Raider.txt`
- `Ochre Jelly.txt`
- `Reach Grappler.txt`
- `Temple Adept.txt`
- `Vancian Necromancer.txt`
- `Xochitona.txt`

Expected values for these fixtures are stored in `tests/fixture_manifest.json`.
Coverage notes are stored in `coverage.md`.

## Fixture Policy

Each fixture should represent a real parser case worth protecting. When adding a fixture:

1. Add the raw stat block text to `fixtures/statblocks`.
2. Convert it with `Convert-D35StatBlock.ps1`.
3. Add or update the expected fields in `tests/fixture_manifest.json`.
4. Run `tests/smoke_test.ps1`.

The tests intentionally assert key fields instead of entire JSON files because generated timestamps and source paths can change between runs.
