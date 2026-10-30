"""Synthetic fixtures only; canonical adventure text stays in Area 03."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
import uuid
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import journal_formatter as jf


def p(ident, value, kind='paragraph', **extra):
    return dict(id=ident, kind=kind, runs=[{'text': value}], **extra)


def fixture():
    return [p('h', 'Arrival & Approach', 'heading', level=2),
            {'id': 'q', 'kind': 'read_aloud', 'paragraphs': [[{'text': 'First “quoted” paragraph.'}],
                                                            [{'text': 'Second <literal> paragraph.'}]]},
            {'id': 'p', 'kind': 'paragraph', 'runs': [{'text': 'Creatures:', 'bold': True},
                                                     {'text': ' Keep this order. '},
                                                     {'text': 'Example', 'italic': True}]},
            {'id': 'table', 'kind': 'table', 'header_rows': 1,
             'rows': [[[[{'text': 'Result'}]], [[{'text': 'Effect'}]]],
                      [[[{'text': '1–2'}]], [[{'text': 'Unchanged & exact.'}], [{'text': 'Another paragraph.'}]]]]},
            {'id': 'list', 'kind': 'list', 'ordered': True, 'items': [[{'text': 'First.'}], [{'text': 'Second.'}]]},
            p('repeat1', 'Repeated source paragraph.'), p('repeat2', 'Repeated source paragraph.'),
            p('h2', 'Next section', 'heading', level=3), p('tail', 'GM-only runtime detail.')]


CATALOG = {'EX 1.1 — Arrival': {'id': '-syntheticHandout', 'headings': ['Arrival & Approach', 'Next section'],
                              'header_links': {'Arrival & Approach': 'https://journal.roll20.net/handout/-syntheticHandout#copied-header'}}}
TITLE = 'EX 1.1 — Arrival'


class FormatterTests(unittest.TestCase):
    def test_text_fidelity_paragraphs_sequence_and_duplicates(self):
        root = ET.fromstring('<root>' + jf.render_blocks(fixture()) + '</root>')
        self.assertEqual([e.tag for e in root], ['h2', 'blockquote', 'p', 'table', 'ol', 'p', 'p', 'h3', 'p'])
        self.assertEqual([''.join(e.itertext()) for e in root], [
            'Arrival & Approach', 'First “quoted” paragraph.Second <literal> paragraph.',
            'Creatures: Keep this order. Example', 'ResultEffect1–2Unchanged & exact.Another paragraph.',
            'First.Second.', 'Repeated source paragraph.', 'Repeated source paragraph.', 'Next section', 'GM-only runtime detail.'])
        self.assertEqual(len(root.findall('blockquote/p')), 2)
        self.assertEqual(root.find('p/strong').text, 'Creatures:')
        self.assertEqual(root.find('p/em').text, 'Example')
        self.assertEqual(len(root.findall('table/tr/th')), 2)
        self.assertEqual(len(root.findall('table/tr/td')), 2)

    def test_determinism_and_no_input_mutation(self):
        blocks = fixture(); before = deepcopy(blocks)
        self.assertEqual(jf.format_handout(TITLE, blocks), jf.format_handout(TITLE, blocks))
        self.assertEqual(blocks, before)

    def test_notes_permissions_and_empty_gmnotes(self):
        result = jf.format_handout(TITLE, fixture())
        self.assertEqual([result[k] for k in ('gmnotes', 'inplayerjournals', 'controlledby')], ['', '', ''])
        self.assertIn('GM-only runtime detail.', result['notes'])
        self.assertEqual(jf.audit_handout(fixture(), result)['status'], 'pass')

    def test_navigation_is_separate_exact_title_and_heading(self):
        links = [{'role': 'Related', 'title': TITLE, 'heading': 'Arrival & Approach'}]
        result = jf.format_handout(TITLE, fixture(), links, CATALOG)
        self.assertTrue(result['notes'].startswith(jf.render_blocks(fixture())))
        self.assertEqual(result['notes'], result['source_html'] + result['navigation_html'])
        nav = ET.fromstring('<root>' + result['navigation_html'] + '</root>')
        self.assertEqual(nav.find('ul/li/a').attrib['href'], CATALOG[TITLE]['header_links']['Arrival & Approach'])
        self.assertEqual(jf.audit_handout(fixture(), result, links, CATALOG)['status'], 'pass')

    def test_missing_and_ambiguous_targets_rejected(self):
        for title, heading in [('Wrong title', None), (TITLE, 'Wrong heading')]:
            with self.assertRaises(jf.FormatError):
                jf.navigation([{'role': 'Next', 'title': title, 'heading': heading}], CATALOG)
        catalog = deepcopy(CATALOG); catalog[TITLE]['headings'].append('Next section')
        with self.assertRaises(jf.FormatError):
            jf.destination(TITLE, 'Next section', catalog)

    def test_no_invented_header_urls(self):
        with self.assertRaises(jf.FormatError):
            jf.navigation([{'role': 'Next', 'title': TITLE, 'heading': 'Next section'}], CATALOG)
        self.assertIn('https://journal.roll20.net/handout/-syntheticHandout', jf.navigation([{'role': 'Index', 'title': TITLE}], CATALOG))

    def test_duplicate_navigation_rejected(self):
        link = {'role': 'Index', 'title': TITLE}
        with self.assertRaises(jf.FormatError):
            jf.navigation([link, link], CATALOG)

    def test_pin_uses_exact_native_fields_and_no_custom_text(self):
        intent = jf.pin_intent(TITLE, 'Arrival & Approach', fixture())
        self.assertEqual(intent['read_aloud_block_id'], 'q')
        pin = jf.resolve_pin(intent, CATALOG)
        self.assertEqual((pin['link'], pin['subLink'], pin['subLinkType'], pin['autoNotesType']),
                         ('-syntheticHandout', 'Arrival & Approach', 'headerPlayer', 'blockquote'))
        for field in ['visibleTo', 'notesVisibleTo', 'gmNotesVisibleTo', 'tooltipVisibleTo', 'notes', 'gmNotes']:
            self.assertEqual(pin[field], '')
        self.assertFalse(pin['notesDesynced'])
        self.assertFalse(pin['imageDesynced'])
        self.assertNotIn('description', pin)

    def test_first_quote_only_and_no_cross_section_fallback(self):
        blocks = fixture(); blocks.insert(2, {'id': 'q2', 'kind': 'read_aloud', 'paragraphs': [[{'text': 'Later quote.'}]]})
        self.assertEqual(jf.first_read_aloud(blocks, 'Arrival & Approach'), 'q')
        self.assertIsNone(jf.first_read_aloud(blocks, 'Next section'))
        blocks = [p('a', 'No quote here', 'heading', level=2)] + fixture()
        self.assertIsNone(jf.first_read_aloud(blocks, 'No quote here'))

    def test_absent_read_aloud_never_invented(self):
        blocks = [p('h', 'Heading', 'heading', level=3), p('p', 'Ordinary description.')]
        self.assertIsNone(jf.pin_intent(TITLE, 'Heading', blocks)['read_aloud_block_id'])
        self.assertNotIn('blockquote', jf.render_blocks(blocks))

    def test_duplicate_source_ids_and_heading_targets(self):
        blocks = fixture(); blocks.append(deepcopy(blocks[0]))
        with self.assertRaises(jf.FormatError): jf.render_blocks(blocks)
        blocks[-1]['id'] = 'different-id'
        with self.assertRaises(jf.FormatError): jf.pin_intent(TITLE, 'Arrival & Approach', blocks)

    def test_audit_detects_missing_duplicated_reordered_and_changed_text(self):
        original = jf.format_handout(TITLE, fixture())
        for altered in [original['notes'].replace('GM-only runtime detail.', ''),
                        original['notes'] + '<p>Extra</p>', original['notes'].replace('Creatures:', 'Tactics:'),
                        original['notes'].replace('<h3>Next section</h3>', ''),
                        original['notes'].replace('<p>GM-only runtime detail.</p>', '<p>GM-only runtime detail.</p>'*2)]:
            changed = deepcopy(original); changed['notes'] = altered
            with self.assertRaises(jf.FormatError): jf.audit_handout(fixture(), changed)

    def test_unsafe_or_unsupported_source_not_silently_dropped(self):
        for block in [p('x', 'text', mystery=True), {'id': 'x', 'kind': 'image'},
                      p('x', 'bad', 'heading', level=7), p('x', '\x00')]:
            with self.assertRaises(jf.FormatError): jf.render_blocks([block])
        self.assertEqual(ET.fromstring(jf.render_blocks([p('x', '<script>alert(1)</script>')])).text,
                         '<script>alert(1)</script>')

    def test_existing_work_preserved_and_proposals_keep_ids_and_snapshots(self):
        old = {'id': '-existing', 'name': TITLE, 'notes': 'Working notes', 'gmnotes': 'Prior GM notes', 'avatar': 'keep'}
        before = deepcopy(old)
        desired = jf.format_handout(TITLE, fixture())
        plan = jf.plan_existing(desired, [old])
        self.assertEqual(plan['action'], 'preserve'); self.assertEqual(plan['patch'], {})
        plan = jf.plan_existing(desired, [old], object_id='-existing', propose_update=True)
        self.assertEqual(plan['id'], '-existing'); self.assertEqual(plan['before'], before)
        self.assertNotIn('avatar', plan['patch']); self.assertNotIn('name', plan['patch'])
        self.assertEqual(old, before)

    def test_existing_ambiguity_missing_id_and_rename_rejected(self):
        desired = jf.format_handout(TITLE, fixture())
        with self.assertRaises(jf.FormatError): jf.plan_existing(desired, [{'id': 'a', 'name': TITLE}, {'id': 'b', 'name': TITLE}])
        with self.assertRaises(jf.FormatError): jf.plan_existing(desired, [], object_id='missing')
        with self.assertRaises(jf.FormatError): jf.plan_existing(desired, [{'id': 'a', 'name': 'Different'}], object_id='a')
        self.assertEqual(jf.plan_existing(desired, [])['action'], 'create_proposal')

    def test_existing_pin_preserves_identity_position_page_and_appearance(self):
        old = {'id': 'pin1', 'x': 123, 'y': 456, '_pageid': 'page1', 'bgColor': '#abcdef', 'notes': 'old'}
        before = deepcopy(old)
        intent = jf.pin_intent(TITLE, 'Arrival & Approach', fixture())
        self.assertEqual(jf.plan_existing_pin(intent, CATALOG, [old], 'pin1')['patch'], {})
        result = jf.plan_existing_pin(intent, CATALOG, [old], 'pin1', propose_update=True)
        self.assertEqual(result['before'], before)
        self.assertFalse(set(result['patch']) & {'id', '_pageid', 'x', 'y', 'bgColor'})
        self.assertEqual(old, before)


class DocxAdapterTests(unittest.TestCase):
    def document(self, middle):
        root = Path(__file__).resolve().parents[2] / '03-Import-Staging/Reports' / ('Journal-Adapter-Tests-' + uuid.uuid4().hex)
        root.mkdir(parents=True)
        path = root / 'synthetic.docx'
        def head(value):
            return '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>'+value+'</w:t></w:r></w:p>'
        xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + head('Start') + middle + head('End') + '</w:body></w:document>'
        with zipfile.ZipFile(path, 'x') as z:
            z.writestr('word/document.xml', xml)
        return path

    def test_explicit_read_aloud_styles_group_paragraphs_keep_runs(self):
        para = '<w:p><w:pPr><w:pStyle w:val="ApprovedReadAloud"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Exact &amp; text.</w:t></w:r></w:p>'
        path = self.document(para + para)
        blocks = jf.docx_section(path, 'Start', 'End', ['ApprovedReadAloud'])
        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[1]['kind'], 'read_aloud')
        self.assertEqual(len(blocks[1]['paragraphs']), 2)
        root = ET.fromstring('<root>'+jf.render_blocks(blocks)+'</root>')
        self.assertEqual([e.text for e in root.findall('blockquote/p/strong')], ['Exact & text.']*2)
        with self.assertRaises(jf.FormatError): jf.docx_section(path, 'Start', 'End')

    def test_italics_never_implicitly_read_aloud(self):
        path = self.document('<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Ordinary italic.</w:t></w:r></w:p>')
        blocks = jf.docx_section(path, 'Start', 'End')
        self.assertEqual(blocks[1]['kind'], 'paragraph')
        self.assertIn('<em>Ordinary italic.</em>', jf.render_blocks(blocks))

    def test_missing_reversed_and_duplicate_boundaries_rejected(self):
        path = self.document('')
        for a,b in [('Missing','End'), ('End','Start')]:
            with self.assertRaises(jf.FormatError): jf.docx_section(path,a,b)
        path = self.document('<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>Start</w:t></w:r></w:p>')
        with self.assertRaises(jf.FormatError): jf.docx_section(path,'Start','End')

    def test_unsupported_docx_content_fails_closed(self):
        for middle in ['<w:tbl/>', '<w:p><w:r><w:drawing/></w:r></w:p>',
                       '<w:p><w:hyperlink><w:r><w:t>Link</w:t></w:r></w:hyperlink></w:p>',
                       '<w:p><w:pPr><w:numPr/></w:pPr><w:r><w:t>List</w:t></w:r></w:p>']:
            path = self.document(middle)
            with self.assertRaises(jf.FormatError): jf.docx_section(path,'Start','End')


if __name__ == '__main__':
    unittest.main()
