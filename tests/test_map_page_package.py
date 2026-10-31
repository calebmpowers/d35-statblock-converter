from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from journal_formatter import FormatError
from map_page_package import build_package


class MapPagePackageTests(unittest.TestCase):
    def spec(self):
        return json.loads((ROOT / 'tests/roll20_mock/fixtures/map-page-setup.json').read_text(encoding='utf-8'))

    def build(self, spec=None, **kwargs):
        args = dict(setup_id='example.map', page_name='Exact Existing Page')
        args.update(kwargs)
        return build_package(self.spec() if spec is None else spec, **args)

    def test_explicit_spec_and_binding_preserved_without_input_mutation(self):
        spec = self.spec(); before = deepcopy(spec)
        p = self.build(spec)
        self.assertEqual(spec, before)
        self.assertEqual(p['source'], spec['source'])
        self.assertEqual(p['placement'], spec['placement'])
        self.assertEqual(p['image'], {'mode': 'configure', 'graphic_id': None})
        self.assertEqual(p['target'], {'id': None, 'name': 'Exact Existing Page'})
        self.assertEqual(p['schema'], 'd35-map-page/0.1')

    def test_stable_repeated_output_and_optional_explicit_native_ids(self):
        self.assertEqual(self.build(), self.build())
        p = self.build(mode='copy', page_id='-page', graphic_id='-source')
        self.assertEqual(p['image']['graphic_id'], '-source')
        self.assertEqual(p['target']['id'], '-page')

    def test_page_and_binding_identity_required_not_inferred(self):
        for args in ({'page_name': ''}, {'page_id': 'https://wrong'}, {'graphic_id': ''},
                     {'setup_id': '../x'}, {'setup_id': 'UPPER'}, {'mode': 'upload'}):
            with self.assertRaises(FormatError): self.build(**args)

    def test_missing_explicit_geometry_grid_or_authority_rejected(self):
        for section, key in [('source', 'authority'), ('source', 'pixel_width'), ('placement', 'left'),
                             ('page_settings', 'snapping_increment'), ('page_settings', 'showgrid')]:
            s = self.spec(); del s[section][key]
            with self.assertRaises(FormatError): self.build(s)

    def test_unsupported_crop_rotation_offsets_mirroring_and_grid_rejected(self):
        for section, key, value in [('placement', 'rotation', 90), ('placement', 'layer', 'objects'),
                                    ('placement', 'fliph', True), ('page_settings', 'grid_type', 'hex'),
                                    ('page_settings', 'grid_offset_x', 5)]:
            s = self.spec(); s[section][key] = value
            with self.assertRaises(FormatError): self.build(s)
        s = self.spec(); s['crop'] = 'auto'
        with self.assertRaises(FormatError): self.build(s)

    def test_negative_missing_nonfinite_boolean_geometry_rejected(self):
        for value in [None, '350', True, float('nan'), float('inf'), -1]:
            s = self.spec(); s['placement']['left'] = value
            with self.assertRaises(FormatError): self.build(s)

    def test_distortion_wrong_grid_scale_and_clipping_rejected(self):
        for width, height in [(699, 560), (1400, 1120)]:
            s = self.spec(); s['placement'].update(width=width, height=height)
            with self.assertRaises(FormatError): self.build(s)
        s = self.spec(); s['placement']['left'] = 349
        with self.assertRaises(FormatError): self.build(s)

    def test_distance_and_units_must_match_approved_grid(self):
        for key, value in [('scale_number', 10), ('scale_units', 'm'), ('snapping_increment', 0), ('width', 5)]:
            s = self.spec(); s['page_settings'][key] = value
            with self.assertRaises(FormatError): self.build(s)

    def test_correct_scaling_with_explicit_fractional_snapping(self):
        s = self.spec()
        s['page_settings'].update(scale_number=10, snapping_increment=0.5)
        s['placement'].update(width=350, height=280, left=175, top=140)
        self.assertEqual(self.build(s)['placement']['width'], 350)

    def test_reveal_and_unsupported_geometry_operations_refused(self):
        s = self.spec(); s['visibility'] = 'players'
        with self.assertRaises(FormatError): self.build(s)
        for section, key in [('page_settings', 'dynamic_lighting_enabled'), ('placement', 'imgsrc')]:
            s = self.spec(); s[section][key] = True
            with self.assertRaises(FormatError): self.build(s)

    def test_optional_controls_are_explicit_validated_and_not_defaulted(self):
        s = self.spec(); s['page_settings'].update(diagonaltype='threefive', grid_opacity=0.2,
                                                 gridcolor='#AaBbCc', gridlabels=False, background_color='#ffffff')
        self.assertEqual(self.build(s)['page_settings'], s['page_settings'])
        self.assertNotIn('diagonaltype', self.build()['page_settings'])
        for key, value in [('diagonaltype', 'guess'), ('grid_opacity', 2), ('gridlabels', 'false'), ('gridcolor', 'red')]:
            bad = deepcopy(s); bad['page_settings'][key] = value
            with self.assertRaises(FormatError): self.build(bad)


if __name__ == '__main__':
    unittest.main()
