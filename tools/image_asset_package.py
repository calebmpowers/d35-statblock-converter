"""Prepare an explicitly approved Player Handout image; never infer titles or folders."""
import argparse
from copy import deepcopy
import hashlib
from html import escape
import json
from pathlib import Path
import re
import struct
import uuid
import zlib

from journal_formatter import keys, require

PLAYER_ROOT = 'Savage Tide Player Handouts'
SOURCE_FIELDS = ('kind', 'asset_id', 'filename', 'url', 'sha256', 'pixel_width',
                 'pixel_height', 'authority')


def text(value, label, limit=240):
    require(isinstance(value, str) and value == value.strip() and 0 < len(value) <= limit
            and not any(ord(c) < 32 for c in value), 'Invalid ' + label)


def validate_spec(spec):
    keys(spec, ('kind', 'title', 'folder_path', 'visibility', 'source'),
         ('kind', 'title', 'folder_path', 'visibility', 'source'))
    require(spec['kind'] == 'player_handout', 'Standalone images are Player Handouts')
    require(spec['visibility'] == 'gm_only', 'Player Handouts must begin hidden')
    text(spec['title'], 'exact approved Handout title')
    path = spec['folder_path']
    require(isinstance(path, list) and 2 <= len(path) <= 12 and path[0] == PLAYER_ROOT,
            'Supply the exact established Player Handouts adventure folder path')
    for name in path:
        text(name, 'exact Journal folder name')
    source = spec['source']; keys(source, SOURCE_FIELDS, SOURCE_FIELDS)
    require(source['kind'] in ('drive', 'synthetic'), 'Unsupported source kind')
    text(source['asset_id'], 'source identity')
    require(re.fullmatch(r'[-A-Za-z0-9_]+', source['asset_id']), 'Invalid source identity')
    text(source['filename'], 'canonical filename')
    require(Path(source['filename']).name == source['filename'] and
            not any(c in source['filename'] for c in '\\/:*?"<>|'), 'Use a filename, not a path')
    text(source['url'], 'source reference', 2000)
    if source['kind'] == 'drive':
        require(source['url'] == 'https://drive.google.com/file/d/' + source['asset_id'] + '/view',
                'Canonical Drive URL must identify the exact approved asset')
    else:
        require(source['url'] == 'synthetic://' + source['asset_id'], 'Label synthetic fixtures explicitly')
    require(isinstance(source['sha256'], str) and re.fullmatch(r'[0-9a-f]{64}', source['sha256']),
            'Supply the approved source file SHA-256')
    for key in ('pixel_width', 'pixel_height'):
        require(type(source[key]) is int and 0 < source[key] <= 30000, 'Invalid source ' + key)
    text(source['authority'], 'approval and naming/folder authority', 4000)


def image_dimensions(data):
    """Read dimensions without re-encoding. v0.1 accepts static PNG and JPEG sources."""
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        offset, dimensions, saw_pixels = 8, None, False
        while offset + 12 <= len(data):
            size = int.from_bytes(data[offset:offset + 4], 'big')
            kind = data[offset + 4:offset + 8]; end = offset + 8 + size
            require(end + 4 <= len(data) and zlib.crc32(data[offset + 4:end]) ==
                    int.from_bytes(data[end:end + 4], 'big'), 'Truncated or corrupt PNG chunk')
            require(kind != b'acTL', 'Animated PNG is unsupported')
            if offset == 8:
                require(kind == b'IHDR' and size == 13, 'Invalid PNG header')
                dimensions = struct.unpack('>II', data[offset + 8:offset + 16])
            elif kind == b'IHDR':
                raise ValueError('Duplicated PNG header')
            saw_pixels = saw_pixels or kind == b'IDAT'
            offset = end + 4
            if kind == b'IEND':
                require(size == 0 and saw_pixels and offset == len(data), 'Invalid PNG ending')
                return dimensions
        raise ValueError('Truncated PNG')
    if data.startswith(b'\xff\xd8') and data.endswith(b'\xff\xd9'):
        offset = 2
        while offset + 4 <= len(data):
            require(data[offset] == 255, 'Invalid JPEG marker')
            while offset < len(data) and data[offset] == 255:
                offset += 1
            marker = data[offset]; offset += 1
            require(marker not in (0, 0xD9, 0xDA), 'JPEG dimensions were not found before image data')
            size = int.from_bytes(data[offset:offset + 2], 'big')
            require(size >= 2 and offset + size <= len(data), 'Invalid JPEG segment')
            if marker in (0xC0, 0xC1, 0xC2):
                require(size >= 8, 'Invalid JPEG frame')
                height, width = struct.unpack('>HH', data[offset + 3:offset + 7])
                return width, height
            offset += size
    raise ValueError('Use a static approved PNG or JPEG source; no image conversion is performed')


def build_package(spec, *, publication_id, image_path):
    validate_spec(spec)
    require(isinstance(publication_id, str) and
            re.fullmatch(r'[a-z0-9][a-z0-9._:-]{2,159}', publication_id), 'Invalid stable publication_id')
    image_path = Path(image_path)
    require(image_path.name == spec['source']['filename'], 'Local filename differs from approved source')
    data = image_path.read_bytes()
    require(hashlib.sha256(data).hexdigest() == spec['source']['sha256'], 'Source file SHA-256 differs')
    require(image_dimensions(data) == (spec['source']['pixel_width'], spec['source']['pixel_height']),
            'Source dimensions differ from the approved specification')
    return {'schema': 'd35-image-asset/0.1', 'publication_id': publication_id, **deepcopy(spec),
            'image': {'display_url': None}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--spec', type=Path, required=True)
    parser.add_argument('--image', type=Path, required=True)
    parser.add_argument('--publication-id', required=True)
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    staging = Path(__file__).resolve().parents[2] / '03-Import-Staging'
    require(args.output_root.resolve().is_relative_to(staging.resolve()), 'Output must be in Area 03')
    spec = json.loads(args.spec.read_text(encoding='utf-8-sig'))
    package = build_package(spec, publication_id=args.publication_id, image_path=args.image)
    output = args.output_root / ('image-asset-package-' + uuid.uuid4().hex)
    output.mkdir(parents=True, exist_ok=False)
    serialized = json.dumps(package, ensure_ascii=False, indent=2)
    (output / 'image-asset-package.json').write_text(serialized, encoding='utf-8')
    (output / 'transfer-gmnotes.html').write_text('<pre>' + escape(serialized) + '</pre>', encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
