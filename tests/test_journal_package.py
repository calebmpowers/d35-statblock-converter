from copy import deepcopy
from pathlib import Path
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


if __name__ == '__main__': unittest.main()
