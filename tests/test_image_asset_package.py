from copy import deepcopy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import unittest
import uuid
import zlib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from journal_formatter import FormatError
from image_asset_package import build_package, image_dimensions


def png(width=16, height=24):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) +
            chunk(b'IDAT', zlib.compress((b'\0' + b'\x30\x70\xb0' * width) * height)) + chunk(b'IEND', b''))


class ImageAssetPackageTests(unittest.TestCase):
    def setUp(self):
        # Keep unique staging artifacts; do not delete workspace/recovery material.
        self.directory = ROOT.parent / '03-Import-Staging' / 'Reports' / ('image-asset-package-tests-' + uuid.uuid4().hex)
        self.directory.mkdir(parents=True, exist_ok=False)
        self.path = self.directory / 'approved-test.png'
        self.path.write_bytes(png())
        self.spec = json.loads((ROOT / 'tests/roll20_mock/fixtures/image-asset.json').read_text(encoding='utf-8'))
        del self.spec['schema']; del self.spec['publication_id']; del self.spec['image']
        self.spec['source']['sha256'] = hashlib.sha256(self.path.read_bytes()).hexdigest()

    def build(self, spec=None, **kwargs):
        args = dict(publication_id='example.visual', image_path=self.path); args.update(kwargs)
        return build_package(self.spec if spec is None else spec, **args)

    def test_exact_source_title_and_folder_preserved_without_input_mutation(self):
        before = deepcopy(self.spec)
        p = self.build()
        self.assertEqual(self.spec, before)
        for key in before:
            self.assertEqual(p[key], before[key])
        self.assertEqual(p['schema'], 'd35-image-asset/0.1')
        self.assertEqual(p['image'], {'display_url': None})

    def test_repeated_package_is_deterministic_and_source_bytes_unchanged(self):
        before = self.path.read_bytes()
        self.assertEqual(self.build(), self.build())
        self.assertEqual(self.path.read_bytes(), before)

    def test_file_must_match_approved_source_checksum(self):
        self.path.write_bytes(png(17, 24))
        with self.assertRaisesRegex(FormatError, 'SHA-256'):
            self.build()

    def test_dimensions_must_match_explicit_source(self):
        self.spec['source']['pixel_width'] = 17
        with self.assertRaisesRegex(FormatError, 'dimensions'):
            self.build()

    def test_no_implicit_title_folder_approval_or_visibility(self):
        for key in ('title', 'folder_path', 'source', 'visibility', 'kind'):
            s = deepcopy(self.spec); del s[key]
            with self.subTest(key=key), self.assertRaises(FormatError): self.build(s)
        for key in ('authority', 'asset_id', 'sha256', 'pixel_height'):
            s = deepcopy(self.spec); del s['source'][key]
            with self.subTest(key=key), self.assertRaises(FormatError): self.build(s)

    def test_standalone_images_cannot_be_gm_entries_or_auto_revealed(self):
        for key, value in [('kind', 'journal'), ('visibility', 'all'),
                           ('folder_path', ['Handouts', 'Adventure']), ('folder_path', ['Savage Tide Player Handouts'])]:
            s = deepcopy(self.spec); s[key] = value
            with self.subTest(key=key), self.assertRaises(FormatError): self.build(s)

    def test_source_identity_and_url_must_agree(self):
        self.spec['source'].update(kind='drive', url='https://drive.google.com/file/d/example-approved-visual/view')
        self.build()
        self.spec['source']['url'] = 'https://drive.google.com/file/d/wrong/view'
        with self.assertRaisesRegex(FormatError, 'exact approved asset'): self.build()

    def test_paths_controls_invalid_numbers_and_unknown_fields_rejected(self):
        for key, value in [('filename', '../image.png'), ('filename', '..\\image.png'),
                           ('pixel_width', True), ('pixel_height', 0), ('sha256', 'a' * 63), ('authority', 'A\nB')]:
            s = deepcopy(self.spec); s['source'][key] = value
            with self.subTest(key=key), self.assertRaises(FormatError): self.build(s)
        s = deepcopy(self.spec); s['invented_prose'] = 'Do not publish'
        with self.assertRaises(FormatError): self.build(s)
        for value in ('', '../unsafe', '__proto__', 'UPPER'):
            with self.subTest(identity=value), self.assertRaises(FormatError): self.build(publication_id=value)

    def test_filename_is_not_silently_substituted(self):
        self.spec['source']['filename'] = 'Other approved file.png'
        with self.assertRaisesRegex(FormatError, 'filename'): self.build()

    def test_corrupt_animated_and_unsupported_source_formats_are_refused(self):
        for data in (b'', png()[:-12], b'GIF89a' + b'\0' * 50, png()[:33] + b'acTL' + png()[33:]):
            with self.subTest(data=data[:10]), self.assertRaises((ValueError, FormatError)): image_dimensions(data)

    def test_png_and_jpeg_dimensions_use_source_pixels_not_title(self):
        self.assertEqual(image_dimensions(png()), (16, 24))
        jpeg = b'\xff\xd8\xff\xc0\0\x0b\x08\0\x18\0\x10\x01\x01\x11\0\xff\xd9'
        self.assertEqual(image_dimensions(jpeg), (16, 24))

    def test_png_animation_detection_uses_chunk_type_not_incidental_text(self):
        value = b'Description\0A literal acTL string in ordinary metadata'
        chunk = struct.pack('>I', len(value)) + b'tEXt' + value + struct.pack('>I', zlib.crc32(b'tEXt' + value))
        data = png(); self.assertEqual(image_dimensions(data[:33] + chunk + data[33:]), (16, 24))

    def test_corrupt_png_chunk_checksum_is_rejected(self):
        data = bytearray(png()); data[20] ^= 1
        with self.assertRaisesRegex(FormatError, 'corrupt PNG'): image_dimensions(bytes(data))

    def test_cli_refuses_output_outside_staging_without_writing(self):
        spec = self.directory / 'spec.json'; spec.write_text(json.dumps(self.spec), encoding='utf-8')
        out = ROOT / ('_forbidden_image_output_' + uuid.uuid4().hex)
        result = subprocess.run([sys.executable, str(ROOT / 'tools/image_asset_package.py'), '--spec', str(spec),
                                 '--image', str(self.path), '--publication-id', 'test.visual', '--output-root', str(out)],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Output must be in Area 03', result.stderr)
        self.assertFalse(out.exists())


if __name__ == '__main__':
    unittest.main()
