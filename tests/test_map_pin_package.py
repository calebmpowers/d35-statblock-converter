from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import journal_formatter as jf
from map_pin_package import build_package


class PinPackageTests(unittest.TestCase):
    def plan(self, quote=False):
        blocks = [{'id': 'h', 'kind': 'heading', 'level': 3, 'runs': [{'text': 'Heading'}]}]
        if quote:
            blocks.append({'id': 'quote', 'kind': 'read_aloud', 'paragraphs': [[{'text': 'Synthetic flavor.'}]]})
        intent = jf.pin_intent('EX 1.1 — Example', 'Heading', blocks)
        return {'intent': intent, 'status': 'needs_handout_id', 'properties': jf.pin_settings(intent)}

    def build(self, plan=None, **kwargs):
        args = dict(pin_id='example.pin', page_id='-page', page_name='Test map', x=0, y=210,
                    title='Example', handout_id='-handout')
        args.update(kwargs)
        return build_package(plan or self.plan(), **args)

    def test_existing_planner_output_preserved_and_resolved(self):
        plan = self.plan(); original = deepcopy(plan)
        p = self.build(plan)
        self.assertEqual(plan, original)
        self.assertEqual(p['plan']['intent'], original['intent'])
        self.assertEqual(p['plan']['properties']['link'], '-handout')
        self.assertEqual(p['plan']['properties']['subLink'], 'Heading')
        self.assertEqual(p['plan']['properties']['autoNotesType'], 'blockquote')

    def test_zero_is_valid_but_missing_nonfinite_and_negative_coordinates_fail(self):
        self.assertEqual(self.build()['x'], 0)
        for value in (None, True, '140', float('nan'), float('inf'), -1):
            with self.assertRaises(jf.FormatError): self.build(x=value)

    def test_explicit_page_identity_and_title_required(self):
        for args in ({'page_id': None}, {'page_id': ''}, {'page_name': ''}, {'title': ''}, {'pin_id': 'x'}, {'handout_id': None}):
            with self.assertRaises(jf.FormatError): self.build(**args)

    def test_resolved_plan_identity_cannot_be_overridden(self):
        plan = self.build()['plan']
        self.assertEqual(self.build(plan, handout_id=None)['plan'], plan)
        with self.assertRaises(jf.FormatError): self.build(plan, handout_id='-other')

    def test_visibility_and_custom_content_cannot_override_planner(self):
        for field, value in [('visibleTo', 'all'), ('notesVisibleTo', 'all'), ('notes', 'Invented'),
                             ('gmNotes', 'Summary'), ('notesDesynced', True), ('autoNotesType', '')]:
            plan = self.plan(); plan['properties'][field] = value
            with self.assertRaises(jf.FormatError): self.build(plan)

    def test_unresolved_partial_or_unknown_plan_fails(self):
        for change in ({'status': 'draft'}, {'extra': True}):
            plan = self.plan(); plan.update(change)
            with self.assertRaises(jf.FormatError): self.build(plan)

    def test_no_read_aloud_means_no_invented_text(self):
        p = self.build()
        self.assertIsNone(p['plan']['intent']['read_aloud_block_id'])
        self.assertEqual(p['plan']['properties']['notes'], '')
        self.assertEqual(p['plan']['properties']['gmNotes'], '')

    def test_synthetic_quote_retains_native_intent_only(self):
        p = self.build(self.plan(quote=True))
        self.assertEqual(p['plan']['intent']['read_aloud_block_id'], 'quote')
        self.assertEqual(p['plan']['properties']['notes'], '')
        self.assertEqual(p, self.build(self.plan(quote=True)))


if __name__ == '__main__': unittest.main()
