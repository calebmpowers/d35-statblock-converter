from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import struct
import subprocess
import sys
import unittest
import uuid
import xml.etree.ElementTree as ET
import zlib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'tools'))
from dynamic_lighting_package import (build_package, image_dimensions, overlay_svg,
                                      polyline, transform, validate_package, write_bundle)


def synthetic_png(width=1000, height=800):
    def chunk(kind, data):
        return struct.pack('>I', len(data))+kind+data+struct.pack('>I', zlib.crc32(kind+data))
    return (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))+
            chunk(b'IDAT', zlib.compress((b'\0'+b'\xff\xff\xff'*width)*height))+chunk(b'IEND', b''))


class DynamicLightingPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Area03 evidence is retained; never recursively delete workspace/test data.
        cls.stage = ROOT.parent/'03-Import-Staging/Reports'/('Dynamic-Lighting-Tests-'+uuid.uuid4().hex)
        cls.stage.mkdir(parents=True, exist_ok=False)

    def spec(self):
        return json.loads((ROOT/'tests/roll20_mock/fixtures/dynamic-lighting.json').read_text(encoding='utf-8'))

    def reject(self, p):
        with self.assertRaises(ValueError):
            validate_package(p)

    def test_build_is_deterministic_and_preserves_review_without_mutating_input(self):
        p = self.spec(); before = deepcopy(p)
        self.assertEqual(build_package(p), build_package(p)); self.assertEqual(p, before)

    def test_source_identity_and_exact_map_package_are_retained(self):
        p = self.spec(); self.assertEqual(build_package(p)['map'], p['map'])

    def test_transform_uses_image_top_left_and_independent_dimensions(self):
        self.assertEqual(transform([[0, 0], [1, 1]], dict(left=500, top=400, width=700, height=560)),
                         [[150, 120], [850, 680]])

    def test_transform_is_not_assumed_to_use_source_image_pixel_size(self):
        p = self.spec(); self.assertEqual(transform([[0.1, 0.1], [0.5, 0.6]], p['map']['package']['placement']),
                                         [[70, 56], [350, 336]])

    def test_valid_boundary_horizontal_vertical_and_closed_paths(self):
        for points in ([[0, 0], [1, 0]], [[1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [0, 0]]):
            self.assertEqual(polyline(points), points)

    def test_nonfinite_boolean_and_out_of_bounds_coordinates_are_rejected(self):
        for v in (-0.01, 1.01, float('nan'), float('inf'), True, '0.1', None):
            with self.subTest(v=v), self.assertRaises(ValueError):
                polyline([[0, 0], [v, 1]])

    def test_missing_zero_length_and_wrongly_shaped_geometry_is_rejected(self):
        for points in ([], [[0, 0]], [[0, 0], [0, 0]], [[0, 0], [1]], [[0, 0], [1, 1, 2]]):
            with self.subTest(points=points), self.assertRaises(ValueError):
                polyline(points)

    def test_self_crossing_and_backtracking_paths_are_rejected(self):
        for points in ([[0, 0], [1, 1], [0, 1], [1, 0]], [[0, 0], [1, 0], [0.5, 0]],
                       [[0, 0], [0.5, 0], [1, 0], [0, 0]]):
            with self.subTest(points=points), self.assertRaises(ValueError):
                polyline(points)

    def test_geometry_limits_are_enforced(self):
        with self.assertRaises(ValueError):
            polyline([[n/201, 0] for n in range(201)])
        p = self.spec(); p['barriers'][0]['points'] = [[0, 0], [1e-12, 1e-12]]; self.reject(p)

    def test_duplicate_barrier_identity_is_rejected(self):
        p = self.spec(); p['barriers'].append(deepcopy(p['barriers'][0])); self.reject(p)

    def test_duplicated_reversed_segments_are_rejected(self):
        p = self.spec(); b = deepcopy(p['barriers'][0]); b['id'] = 'second.wall'; b['points'].reverse()
        p['barriers'].append(b); self.reject(p)

    def test_partially_overlapping_collinear_segments_are_rejected(self):
        p = self.spec(); b = deepcopy(p['barriers'][0]); b['id'] = 'second.wall'; b['points'] = [[0.3, 0.1], [0.7, 0.1]]
        p['barriers'].append(b); self.reject(p)

    def test_shared_endpoints_and_crossings_between_distinct_barriers_are_valid(self):
        p = self.spec(); b = deepcopy(p['barriers'][0]); b['id'] = 'second.wall'; b['points'] = [[0.5, 0.6], [0.9, 0.9]]
        p['barriers'].append(b); validate_package(p)

    def test_zero_barriers_and_preserved_lighting_are_supported(self):
        p = self.spec(); p['barriers'] = []; p['lighting'] = {'before': {}, 'after': {}}
        p['compatibility']['native_path_id'] = None; validate_package(p)

    def test_proposal_stays_proposed(self):
        p = self.spec(); p['review'].update(status='proposed', by=None)
        self.assertEqual(build_package(p)['review']['status'], 'proposed')

    def test_approval_requires_reviewer_and_resolved_judgments(self):
        p = self.spec(); p['review']['by'] = None; self.reject(p)
        p = self.spec(); p['review']['decisions'] = [{'id': 'rock.height', 'note': 'Height uncertain', 'resolution': 'pending'}]
        self.reject(p)

    def test_interpretive_geometry_requires_an_explicit_review_decision(self):
        p = self.spec(); p['barriers'][0]['certainty'] = 'interpretive'; self.reject(p)
        p['review']['decisions'] = [{'id': p['barriers'][0]['id'], 'note': 'Reviewed height', 'resolution': 'accepted'}]
        validate_package(p)

    def test_duplicate_decisions_and_annotations_are_rejected(self):
        p = self.spec(); p['annotations'].append(deepcopy(p['annotations'][0])); self.reject(p)
        p = self.spec(); p['review']['decisions'] = [{'id': 'rock.height', 'note': 'Height', 'resolution': 'accepted'}]*2
        self.reject(p)

    def test_newer_engine_is_never_inferred(self):
        p = self.spec(); p['compatibility']['engine'] = 'automatic'; self.reject(p)

    def test_explicit_page_graphic_and_image_identities_are_required(self):
        for k, v in [('page_id', None), ('graphic_id', ''), ('sha256', 'unknown')]:
            p = self.spec(); p['map'][k] = v; self.reject(p)

    def test_conflicting_embedded_map_bindings_are_rejected(self):
        p = self.spec(); p['map']['package']['target']['id'] = 'another-page'; self.reject(p)
        p = self.spec(); p['map']['package']['image']['graphic_id'] = 'another-graphic'; self.reject(p)

    def test_rotated_cropped_or_distorted_map_frames_are_rejected(self):
        for field, value in [('rotation', 10), ('fliph', True), ('width', 701)]:
            p = self.spec(); p['map']['package']['placement'][field] = value; self.reject(p)
        p = self.spec(); p['map']['package']['crop'] = 'automatic'; self.reject(p)

    def test_before_after_keys_and_boolean_settings_are_explicit(self):
        p = self.spec(); del p['lighting']['before']['daylight_mode_enabled']; self.reject(p)
        p = self.spec(); p['lighting']['after']['daylight_mode_enabled'] = 'true'; self.reject(p)

    def test_movement_restrictions_and_unrelated_page_changes_are_refused(self):
        p = self.spec(); p['lighting']['after']['lightrestrictmove'] = True; self.reject(p)
        p = self.spec(); p['lighting']['after']['width'] = 50; self.reject(p)

    def test_unknown_fields_and_out_of_scope_features_are_refused(self):
        p = self.spec(); p['schema'] = 'd35-dynamic-lighting/9.0'
        with self.assertRaises(ValueError): build_package(p)
        for part, k in [('barriers', 'door'), ('compatibility', 'fallback'), ('map', 'new_page')]:
            p = self.spec(); target = p[part][0] if isinstance(p[part], list) else p[part]; target[k] = True; self.reject(p)
        for part in ('target', 'image'):
            p = self.spec(); p['map']['package'][part] = None; self.reject(p)

    def test_overlay_embeds_exact_source_and_keeps_annotations_separate(self):
        p = self.spec(); raw = synthetic_png(); p['map']['sha256'] = sha256(raw).hexdigest()
        svg = overlay_svg(p, raw); tree = ET.fromstring(svg); ns = {'s': 'http://www.w3.org/2000/svg'}
        import base64
        image = tree.find('s:image', ns)
        self.assertEqual(base64.b64decode(image.attrib['href'].split(',', 1)[1]), raw)
        lines = tree.findall('.//s:polyline', ns); self.assertEqual(len(lines), 2)
        self.assertNotIn('stroke-dasharray', lines[0].attrib); self.assertIn('stroke-dasharray', lines[1].attrib)
        self.assertIn('NEVER applied', svg)

    def test_overlay_escapes_untrusted_labels(self):
        p = self.spec(); raw = synthetic_png(); p['map']['sha256'] = sha256(raw).hexdigest()
        p['title'] = '<script>unsafe</script>'; p['annotations'][0]['id'] = 'safe.id'
        svg = overlay_svg(p, raw); self.assertNotIn('<script>', svg); ET.fromstring(svg)

    def test_wrong_image_hash_and_size_are_rejected(self):
        p = self.spec(); raw = synthetic_png()
        with self.assertRaises(ValueError): overlay_svg(p, raw)
        p['map']['sha256'] = sha256(raw).hexdigest(); p['map']['package']['source']['pixel_width'] = 2000
        # Preserve aspect ratio in metadata; the actual raster is still the wrong size.
        p['map']['package']['source']['pixel_height'] = 1600
        with self.assertRaisesRegex(ValueError, 'dimensions'): overlay_svg(p, raw)

    def test_png_header_reader_and_unsupported_formats(self):
        self.assertEqual(image_dimensions(synthetic_png(2, 3)), ('image/png', (2, 3)))
        for raw in (b'GIF89a', b'\xff\xd8\xff', b'\xff\xd8\xff\xe0\0\1'):
            with self.assertRaises(ValueError): image_dimensions(raw)

    def test_bundle_outputs_are_unique_and_input_is_preserved(self):
        p = self.spec(); before = deepcopy(p)
        a = write_bundle(p, self.stage); original = (a/'lighting-package.json').read_bytes()
        b = write_bundle(p, self.stage)
        self.assertNotEqual(a, b); self.assertEqual((b/'lighting-package.json').read_bytes(), original)
        self.assertEqual((a/'lighting-package.json').read_bytes(), original)
        self.assertEqual(p, before)

    def test_generated_outputs_outside_staging_are_refused(self):
        with self.assertRaises(ValueError): write_bundle(self.spec(), ROOT/'tests/not-a-staging-directory')

    def test_cli_produces_an_equivalent_valid_package(self):
        result = subprocess.run([sys.executable, str(ROOT/'tools/dynamic_lighting_package.py'),
                                 str(ROOT/'tests/roll20_mock/fixtures/dynamic-lighting.json'),
                                 '--output-root', str(self.stage)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads((Path(result.stdout.strip())/'lighting-package.json').read_text()), self.spec())


if __name__ == '__main__':
    unittest.main()
