from copy import deepcopy
from pathlib import Path
import json
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from journal_package import build_package
from journal_formatter import FormatError, format_handout


class PackageTests(unittest.TestCase):
    def source(self):
        return {'title': 'EX 1.1 — Arrival', 'blocks': [
            {'id': 'heading', 'kind': 'heading', 'level': 3, 'runs': [{'text': 'Arrival'}]},
            {'id': 'p', 'kind': 'paragraph', 'runs': [{'text': 'Creatures:', 'bold': True}, {'text': ' Unchanged.'}]}]}

    def test_unchanged_formatter_output_and_no_input_mutation(self):
        s = self.source(); before = deepcopy(s)
        pkg = build_package(s, 'example.arrival')
        self.assertEqual(pkg['handout'], format_handout(s['title'], s['blocks']))
        self.assertEqual(s, before)
        self.assertEqual(pkg['schema'], 'd35-journal/0.1')

    def test_repeated_build_has_stable_identity_and_content(self):
        self.assertEqual(build_package(self.source(), 'example.arrival'), build_package(self.source(), 'example.arrival'))

    def test_missing_or_unsafe_identity_rejected(self):
        for key in ['', 'UPPER', '../evil', 'a', None, 'word ']:
            with self.assertRaises(FormatError): build_package(self.source(), key)

    def test_invalid_source_not_packaged(self):
        s = self.source(); s['blocks'][1]['id'] = 'heading'
        with self.assertRaises(FormatError): build_package(s, 'example.arrival')

    def plan(self):
        return json.loads((Path(__file__).resolve().parent / 'roll20_mock/fixtures/journal-filing.json').read_text())

    def test_filing_preserves_exact_formatter_output_and_stable_identity(self):
        old = build_package(self.source(), 'example.arrival')
        p = self.plan(); before = deepcopy(p)
        new = build_package(self.source(), 'example.arrival', p)
        self.assertEqual(new['handout'], old['handout'])
        self.assertEqual(new['journal_id'], old['journal_id'])
        self.assertEqual(p, before)
        new['filing']['folder_ids'][0] = 'changed'
        self.assertEqual(p, before)

    def test_destination_names_and_native_ids_are_required_not_inferred(self):
        for key in ('folder_path', 'folder_ids', 'authority'):
            p = self.plan(); del p[key]
            with self.subTest(key=key), self.assertRaises(FormatError): build_package(self.source(), 'example.arrival', p)
        for value in ([], ['root'], ['root', 'adv', True]):
            p = self.plan(); p['folder_ids'] = value
            with self.subTest(value=value), self.assertRaises(FormatError): build_package(self.source(), 'example.arrival', p)

    def test_player_filing_and_wrong_roots_are_refused(self):
        p = self.plan(); p['folder_path'][0] = 'Savage Tide Player Handouts'
        with self.assertRaises(FormatError): build_package(self.source(), 'example.arrival', p)
        p = self.plan(); p['kind'] = 'player_handout'
        with self.assertRaises(FormatError): build_package(self.source(), 'example.arrival', p)

    def test_explicit_legacy_migration_keeps_original_object_and_source_location(self):
        p = self.plan(); p['legacy_source'] = {'handout_id': '-ORIGINAL', 'folder_path': ['Handouts'], 'folder_ids': ['stage']}
        self.assertEqual(build_package(self.source(), 'example.arrival', p)['filing'], p)

    def test_legacy_migration_cannot_authorize_existing_adventure_or_player_reorganization(self):
        for root in ('Savage Tide Player Handouts', 'Savage Tide Adventure Path'):
            p = self.plan(); p['legacy_source'] = {'handout_id': '-ORIGINAL', 'folder_path': [root], 'folder_ids': ['stage']}
            with self.subTest(root=root), self.assertRaises(FormatError): build_package(self.source(), 'example.arrival', p)

    def test_legacy_identity_and_unknown_fields_are_rejected(self):
        p = self.plan(); p['legacy_source'] = {'handout_id': '', 'folder_path': [], 'folder_ids': []}
        with self.assertRaises(FormatError): build_package(self.source(), 'example.arrival', p)
        p = self.plan(); p['invented_folder'] = 'not allowed'
        with self.assertRaises(FormatError): build_package(self.source(), 'example.arrival', p)


if __name__ == '__main__': unittest.main()
