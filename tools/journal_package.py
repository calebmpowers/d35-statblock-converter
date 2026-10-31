"""Prepare a GM transfer package using the unchanged Journal Formatter."""
import argparse
from html import escape
import json
from pathlib import Path
import re
import uuid

from journal_formatter import audit_handout, format_handout, keys, require


def validate_filing(plan):
    keys(plan, ('kind', 'folder_path', 'folder_ids', 'legacy_source', 'authority'),
         ('kind', 'folder_path', 'folder_ids', 'legacy_source', 'authority'))
    require(plan['kind'] == 'gm_adventure', 'GM runtime filing cannot target Player Handouts')
    def location(names, ids, minimum):
        require(isinstance(names, list) and isinstance(ids, list) and
                minimum <= len(names) <= 12 and len(names) == len(ids), 'Supply exact existing folder names and IDs')
        for name in names:
            require(isinstance(name, str) and name and name == name.strip() and len(name) <= 240 and
                    not any(ord(c) < 32 for c in name), 'Invalid folder name')
        for identifier in ids:
            require(isinstance(identifier, str) and re.fullmatch(r'[-A-Za-z0-9_]+', identifier), 'Invalid folder ID')
    location(plan['folder_path'], plan['folder_ids'], 3)
    require(plan['folder_path'][0] == 'Savage Tide Adventure Path', 'Use the established GM adventure root')
    require(isinstance(plan['authority'], str) and plan['authority'].strip() == plan['authority'] and
            0 < len(plan['authority']) <= 4000 and not any(ord(c) < 32 for c in plan['authority']), 'Supply approval/organization authority')
    old = plan['legacy_source']
    if old is not None:
        keys(old, ('handout_id', 'folder_path', 'folder_ids'), ('handout_id', 'folder_path', 'folder_ids'))
        require(isinstance(old['handout_id'], str) and re.fullmatch(r'[-A-Za-z0-9_]+', old['handout_id']), 'Invalid legacy Handout ID')
        location(old['folder_path'], old['folder_ids'], 0)
        require(not old['folder_path'] or old['folder_path'][0] not in
                ('Savage Tide Adventure Path', 'Savage Tide Player Handouts'),
                'Legacy migration cannot reorganize existing adventure or Player Handout placement')


def build_package(source, journal_id, filing=None):
    require(isinstance(journal_id, str) and re.fullmatch(r'[a-z0-9][a-z0-9._:-]{2,159}', journal_id),
            'Supply a stable lowercase journal ID, 3–160 characters')
    keys(source, ('title', 'blocks', 'navigation', 'catalog', 'pin_headings', 'provenance'), ('title', 'blocks'))
    links, catalog = source.get('navigation', []), source.get('catalog', {})
    handout = format_handout(source['title'], source['blocks'], links, catalog)
    audit_handout(source['blocks'], handout, links, catalog)
    result = {'schema': 'd35-journal/0.1', 'journal_id': journal_id, 'handout': handout}
    if filing is not None:
        from copy import deepcopy
        validate_filing(filing)
        result['filing'] = deepcopy(filing)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Reviewed formatter source JSON')
    parser.add_argument('--journal-id', required=True, help='Stable section identity; retain across exports/imports')
    parser.add_argument('--output-root', type=Path, required=True)
    parser.add_argument('--filing-spec', type=Path, help='Approved existing adventure/Part names and native folder IDs')
    args = parser.parse_args()
    staging = Path(__file__).resolve().parents[2] / '03-Import-Staging'
    require(args.output_root.resolve().is_relative_to(staging.resolve()), 'Output must be in Area 03')
    source = json.loads(args.source.read_text(encoding='utf-8-sig'))
    filing = json.loads(args.filing_spec.read_text(encoding='utf-8-sig')) if args.filing_spec else None
    package = build_package(source, args.journal_id, filing)
    output = args.output_root / ('journal-package-' + uuid.uuid4().hex)
    output.mkdir(parents=True, exist_ok=False)
    serialized = json.dumps(package, ensure_ascii=False, indent=2)
    (output / 'journal-package.json').write_text(serialized, encoding='utf-8')
    (output / 'transfer-gmnotes.html').write_text('<pre>' + escape(serialized) + '</pre>', encoding='utf-8')
    (output / 'description-notes.html').write_text(package['handout']['notes'], encoding='utf-8')
    (output / 'provenance.json').write_text(json.dumps(source.get('provenance', {}), ensure_ascii=False, indent=2), encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
