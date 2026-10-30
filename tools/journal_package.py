"""Prepare a GM transfer package using the unchanged Journal Formatter."""
import argparse
from html import escape
import json
from pathlib import Path
import re
import uuid

from journal_formatter import audit_handout, format_handout, keys, require


def build_package(source, journal_id):
    require(isinstance(journal_id, str) and re.fullmatch(r'[a-z0-9][a-z0-9._:-]{2,159}', journal_id),
            'Supply a stable lowercase journal ID, 3–160 characters')
    keys(source, ('title', 'blocks', 'navigation', 'catalog', 'pin_headings', 'provenance'), ('title', 'blocks'))
    links, catalog = source.get('navigation', []), source.get('catalog', {})
    handout = format_handout(source['title'], source['blocks'], links, catalog)
    audit_handout(source['blocks'], handout, links, catalog)
    return {'schema': 'd35-journal/0.1', 'journal_id': journal_id, 'handout': handout}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Reviewed formatter source JSON')
    parser.add_argument('--journal-id', required=True, help='Stable section identity; retain across exports/imports')
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    staging = Path(__file__).resolve().parents[2] / '03-Import-Staging'
    require(args.output_root.resolve().is_relative_to(staging.resolve()), 'Output must be in Area 03')
    source = json.loads(args.source.read_text(encoding='utf-8-sig'))
    package = build_package(source, args.journal_id)
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
