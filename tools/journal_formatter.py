"""Local, deterministic Journal formatting and pin plans; never contacts Roll20.

Input is an ordered, reviewed transcription, or a bounded DOCX section. Read-aloud
is explicit source semantics, never inferred from prose, italics, or indentation.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
from html import escape
import json
from pathlib import Path
import re
import uuid
import xml.etree.ElementTree as ET
import zipfile


class FormatError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise FormatError(message)


def keys(obj, allowed, required):
    require(isinstance(obj, dict), "Expected an object")
    require(set(obj) <= set(allowed), "Unsupported fields: " + str(set(obj) - set(allowed)))
    require(set(required) <= set(obj), "Missing required fields")


def text(value):
    require(isinstance(value, str), "Text must be a string")
    require(not any(ord(c) < 32 and c not in '\n\t\r' for c in value), "Control character")
    return value


def inline(runs):
    require(isinstance(runs, list) and runs, "Expected nonempty runs")
    result = []
    for run in runs:
        keys(run, ('text', 'bold', 'italic', 'sup', 'sub'), ('text',))
        for flag in set(run) - {'text'}:
            require(type(run[flag]) is bool, "Formatting flags must be boolean")
        require(not (run.get('sup') and run.get('sub')), "Conflicting vertical alignment")
        value = escape(text(run['text']))
        for flag, tag in [('sub', 'sub'), ('sup', 'sup'), ('italic', 'em'), ('bold', 'strong')]:
            if run.get(flag):
                value = f'<{tag}>{value}</{tag}>'
        result.append(value)
    return ''.join(result)


def plain(runs):
    return ''.join(r['text'] for r in runs)


def render_blocks(blocks):
    require(isinstance(blocks, list) and blocks, "No source blocks")
    seen = set()

    def render(block):
        keys(block, ('id', 'kind', 'runs', 'level', 'paragraphs', 'rows', 'header_rows', 'items', 'ordered'),
             ('id', 'kind'))
        ident = text(block['id'])
        require(ident and ident not in seen, "Missing or duplicated source block ID")
        seen.add(ident)
        kind = block['kind']
        if kind in ('paragraph', 'heading'):
            require(set(block) == {'id', 'kind', 'runs'} | ({'level'} if kind == 'heading' else set()),
                    "Unexpected block fields")
            tag = 'p'
            if kind == 'heading':
                require(type(block['level']) is int and 1 <= block['level'] <= 6, "Invalid heading level")
                require(plain(block['runs']).strip(), "Empty heading")
                tag = 'h' + str(block['level'])
            return f'<{tag}>{inline(block["runs"])}</{tag}>'
        if kind == 'read_aloud':
            require(set(block) == {'id', 'kind', 'paragraphs'}, "Unexpected read-aloud fields")
            require(block['paragraphs'], "Empty read-aloud passage")
            return '<blockquote>' + ''.join('<p>' + inline(r) + '</p>' for r in block['paragraphs']) + '</blockquote>'
        if kind == 'table':
            require(set(block) == {'id', 'kind', 'rows', 'header_rows'}, "Unexpected table fields")
            rows = block['rows']
            require(isinstance(rows, list) and rows and rows[0], "Empty table")
            require(type(block['header_rows']) is int and 0 <= block['header_rows'] <= len(rows), "Invalid header rows")
            require(all(len(row) == len(rows[0]) for row in rows), "Ragged table")
            out = []
            for i, row in enumerate(rows):
                tag = 'th' if i < block['header_rows'] else 'td'
                require(all(cell for cell in row), "Cells must contain paragraphs")
                out.append('<tr>' + ''.join(f'<{tag}>' + ''.join('<p>' + inline(r) + '</p>' for r in cell) + f'</{tag}>' for cell in row) + '</tr>')
            return '<table>' + ''.join(out) + '</table>'
        if kind == 'list':
            require(set(block) == {'id', 'kind', 'items', 'ordered'}, "Unexpected list fields")
            require(type(block['ordered']) is bool and block['items'], "Invalid list")
            tag = 'ol' if block['ordered'] else 'ul'
            return f'<{tag}>' + ''.join('<li>' + inline(r) + '</li>' for r in block['items']) + f'</{tag}>'
        raise FormatError('Unsupported block kind: ' + str(kind))

    return ''.join(render(b) for b in blocks)


def headings(blocks):
    return [plain(b['runs']) for b in blocks if b['kind'] == 'heading']


def first_read_aloud(blocks, heading):
    matches = [i for i, b in enumerate(blocks) if b['kind'] == 'heading' and plain(b['runs']) == heading]
    require(len(matches) == 1, 'Heading missing or ambiguous: ' + heading)
    # Conservative section boundary: never borrow flavor from any later heading.
    for block in blocks[matches[0] + 1:]:
        if block['kind'] == 'heading':
            break
        if block['kind'] == 'read_aloud':
            return block['id']
    return None


def destination(title, heading, catalog):
    require(title in catalog, 'Unknown exact Handout title: ' + title)
    entry = catalog[title]
    require(isinstance(entry.get('id'), str) and re.fullmatch(r'[-A-Za-z0-9_]+', entry['id']), 'Invalid Handout ID')
    require(sum(e.get('id') == entry['id'] for e in catalog.values()) == 1, 'Handout ID reused across titles')
    if heading is not None:
        require(entry.get('headings', []).count(heading) == 1, 'Destination heading missing or ambiguous')
    return entry


def navigation(links, catalog):
    out = []
    seen = set()
    for link in links:
        keys(link, ('role', 'title', 'heading'), ('role', 'title'))
        require(link['role'] in ('Previous', 'Next', 'Related', 'Index'), 'Invalid navigation role')
        heading = link.get('heading')
        entry = destination(link['title'], heading, catalog)
        identity = (link['role'], link['title'], heading)
        require(identity not in seen, 'Duplicated navigation link')
        seen.add(identity)
        href = 'https://journal.roll20.net/handout/' + entry['id']
        if heading is not None:
            # Roll20 owns heading link serialization. Require its copied URL;
            # never invent a slug from heading text.
            href = entry.get('header_links', {}).get(heading, '')
            require(href.startswith(('https://journal.roll20.net/handout/' + entry['id'] + '#',
                                     'http://journal.roll20.net/handout/' + entry['id'] + '#')),
                    'Supply the exact Copy Header Link URL')
            require(len(href.split('#', 1)[1]) > 0, 'Empty header fragment')
        label = link['title'] + (' / ' + heading if heading is not None else '')
        out.append('<li>' + link['role'] + ': <a href="' + escape(href, quote=True) + '">' + escape(label) + '</a></li>')
    return '<hr/><h2>Navigation</h2><ul>' + ''.join(out) + '</ul>' if out else ''


def format_handout(title, blocks, links=(), catalog=None):
    require(text(title).strip(), 'Empty title')
    source = render_blocks(blocks)
    nav = navigation(links, catalog or {})
    return {'name': title, 'notes': source + nav, 'gmnotes': '', 'inplayerjournals': '',
            'controlledby': '', 'source_html': source, 'navigation_html': nav,
            'source_sha256': hashlib.sha256(source.encode('utf-8')).hexdigest()}


def audit_handout(blocks, handout, links=(), catalog=None):
    """Compare ordered structure and every character, including repeated paragraphs.

    Source completeness is relative to the supplied bounded source, not an
    assertion that an arbitrary transcription matches its canonical manuscript.
    """
    expected = render_blocks(blocks)
    nav = navigation(links, catalog or {})
    require(handout.get('notes') == expected + nav, 'Missing, duplicated, reordered, or changed HTML/content')
    require(handout.get('source_html') == expected and handout.get('navigation_html') == nav, 'Section mismatch')
    require(handout.get('source_sha256') == hashlib.sha256(expected.encode('utf-8')).hexdigest(), 'Digest mismatch')
    require(all(handout.get(k) == '' for k in ('gmnotes', 'inplayerjournals', 'controlledby')), 'Unsafe Handout fields')
    ET.fromstring('<root>' + handout['notes'].replace('&nbsp;', '&#160;') + '</root>')
    return {'status': 'pass', 'source_blocks': len(blocks), 'headings': headings(blocks),
            'source_sha256': handout['source_sha256']}


def pin_intent(title, heading, blocks):
    render_blocks(blocks)
    return {'handout_title': title, 'heading': heading, 'source_field': 'notes',
            'read_aloud_block_id': first_read_aloud(blocks, heading),
            'native_flavor_text': True, 'gm_only': True}


def resolve_pin(intent, catalog):
    entry = destination(intent['handout_title'], intent['heading'], catalog)
    return {'link': entry['id'], **pin_settings(intent)}


def pin_settings(intent):
    """Native settings template, NOT deployable until an exact Handout ID resolves."""
    return {'linkType': 'handout', 'subLink': intent['heading'],
            'subLinkType': 'headerPlayer', 'autoNotesType': 'blockquote',
            'notes': '', 'gmNotes': '', 'notesDesynced': False,
            'gmNotesDesynced': False, 'imageDesynced': False,
            **{k: '' for k in ('visibleTo', 'tooltipVisibleTo', 'tooltipTitleVisibleTo',
                               'nameplateVisibleTo', 'imageVisibleTo', 'notesVisibleTo', 'gmNotesVisibleTo')}}


def plan_existing(handout, existing, object_id=None, propose_update=False):
    """Offline plan only. Default preserves working objects; never deletes/renames.

    Existing snapshots include full notes/gmnotes for review and rollback. A later
    executor must re-read and compare the before snapshot before applying a patch.
    """
    matches = [e for e in existing if e.get('id') == object_id] if object_id else [e for e in existing if e.get('name') == handout['name']]
    require(len(matches) <= 1, 'Ambiguous existing Handout; supply exact ID')
    require(not object_id or matches, 'Explicit existing ID not found')
    if not matches:
        return {'action': 'create_proposal', 'after': deepcopy(handout)}
    old = matches[0]
    require(old.get('name') == handout['name'], 'Existing title differs; do not rename working objects')
    return {'action': 'update_proposal' if propose_update else 'preserve', 'id': old['id'],
            'before': deepcopy(old),
            'patch': {k: handout[k] for k in ('notes', 'gmnotes', 'inplayerjournals', 'controlledby')}
            if propose_update else {}}


def plan_existing_pin(intent, catalog, existing, object_id, propose_update=False):
    """Use an explicit pin ID; preserve page, position, appearance and all other pins."""
    matches = [p for p in existing if p.get('id') == object_id]
    require(len(matches) == 1, 'Existing pin ID missing or ambiguous')
    return {'action': 'update_proposal' if propose_update else 'preserve', 'id': object_id,
            'before': deepcopy(matches[0]),
            'patch': resolve_pin(intent, catalog) if propose_update else {}}


W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def docx_section(path, start_heading, end_heading, read_aloud_styles=()):
    """Extract [start, end) by unique exact heading text from a current export.

    Narrow adapter deliberately rejects unsupported selected content instead of
    silently flattening it. Explicit quote style IDs must come from source review.
    """
    with zipfile.ZipFile(path) as archive:
        body = ET.fromstring(archive.read('word/document.xml')).find(W + 'body')
    children = list(body)

    def label(el):
        return ''.join(t.text or '' for t in el.iter(W + 't'))

    def boundary(value):
        found = [i for i, el in enumerate(children) if el.tag == W + 'p' and
                 el.find(W + 'pPr/' + W + 'pStyle') is not None and label(el) == value]
        require(len(found) == 1, 'Section boundary missing or ambiguous: ' + value)
        return found[0]

    start, end = boundary(start_heading), boundary(end_heading)
    require(start < end, 'Reversed or empty source scope')

    def runs(p):
        require(all(c.tag in {W+'pPr', W+'r', W+'bookmarkStart', W+'bookmarkEnd'} for c in p),
                'Unsupported paragraph content (link, revision, field, etc.)')
        out = []
        for r in p.findall(W + 'r'):
            require(all(c.tag in {W+'rPr', W+'t', W+'tab', W+'br'} for c in r), 'Unsupported run content')
            value = ''.join((c.text or '') if c.tag == W+'t' else '\t' if c.tag == W+'tab' else '\n' if c.tag == W+'br' else '' for c in r)
            if not value:
                continue
            item = {'text': value}
            for prop, flag in [('b', 'bold'), ('i', 'italic')]:
                el = r.find(W+'rPr/'+W+prop)
                if el is not None and el.get(W+'val', '1') not in ('0', 'false', 'off'):
                    item[flag] = True
            require(r.find(W+'rPr/'+W+'rStyle') is None, 'Character style needs explicit transcription')
            for unsupported in ('u', 'strike', 'dstrike', 'vertAlign'):
                require(r.find(W+'rPr/'+W+unsupported) is None, 'Unsupported semantic run format: '+unsupported)
            out.append(item)
        return out or [{'text': ''}]

    blocks = []
    for i in range(start, end):
        el = children[i]
        ident = 'docx-body-' + str(i)
        require(el.tag == W+'p', 'Selected non-paragraph requires reviewed structured transcription')
        require(el.find(W+'pPr/'+W+'numPr') is None, 'List requires reviewed structured transcription')
        for prop in ('b', 'i', 'rStyle'):
            require(el.find(W+'pPr/'+W+'rPr/'+W+prop) is None,
                    'Paragraph-level run semantics require reviewed transcription')
        style = el.find(W+'pPr/'+W+'pStyle')
        style = style.get(W+'val') if style is not None else ''
        r = runs(el)
        if re.fullmatch(r'Heading[1-6]', style):
            block = {'id': ident, 'kind': 'heading', 'level': int(style[-1]), 'runs': r}
        elif style in read_aloud_styles:
            block = {'id': ident, 'kind': 'read_aloud', 'paragraphs': [r]}
            if blocks and blocks[-1]['kind'] == 'read_aloud':
                blocks[-1]['paragraphs'].append(r)
                continue
        else:
            require(style in ('', 'Normal', 'BodyText'), 'Unmapped paragraph style: ' + style)
            block = {'id': ident, 'kind': 'paragraph', 'runs': r}
        blocks.append(block)
    render_blocks(blocks)
    return blocks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Reviewed JSON: title, blocks, navigation, catalog, pin_headings')
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    staging = Path(__file__).resolve().parents[2] / '03-Import-Staging'
    require(args.output_root.resolve().is_relative_to(staging.resolve()), 'Output must be in Area 03')
    source = json.loads(args.source.read_text(encoding='utf-8-sig'))
    keys(source, ('title', 'blocks', 'navigation', 'catalog', 'pin_headings', 'provenance'), ('title', 'blocks'))
    handout = format_handout(source['title'], source['blocks'], source.get('navigation', []), source.get('catalog', {}))
    audit = audit_handout(source['blocks'], handout, source.get('navigation', []), source.get('catalog', {}))
    pins = [pin_intent(source['title'], h, source['blocks']) for h in source.get('pin_headings', [])]
    plans = [{'intent': pin, 'status': 'resolved' if source['title'] in source.get('catalog', {}) else 'needs_handout_id',
              'properties': resolve_pin(pin, source['catalog']) if source['title'] in source.get('catalog', {}) else pin_settings(pin)}
             for pin in pins]
    output = args.output_root / ('journal-' + uuid.uuid4().hex)
    output.mkdir(parents=True, exist_ok=False)
    for name, obj in [('handout.json', handout), ('audit.json', audit), ('pin-intents.json', pins), ('pin-plans.json', plans)]:
        (output / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')
    (output / 'description-notes.html').write_text(handout['notes'], encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
