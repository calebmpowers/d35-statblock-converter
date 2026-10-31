"""Review-first ordinary lighting polylines, relative to an approved managed map.

No tracing inference, uploads, page creation, or implicit review approval.
"""
import argparse
import base64
from copy import deepcopy
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import re
import struct
import uuid

from journal_formatter import keys, require
from map_page_package import validate_spec, build_package as map_package, text, identifier, number

SCHEMA = 'd35-dynamic-lighting/0.1'
LIGHTING = ('dynamic_lighting_enabled', 'daylight_mode_enabled', 'lightrestrictmove')


def stable_id(value):
    require(isinstance(value, str) and re.fullmatch(r'[a-z0-9][a-z0-9._:-]{2,159}', value),
            'Invalid stable identity')


def polyline(points):
    require(isinstance(points, list) and 2 <= len(points) <= 200, 'Supply 2..200 normalized points')
    for p in points:
        require(isinstance(p, list) and len(p) == 2, 'Expected a normalized [u,v] point')
        for v in p:
            number(v, 'normalized coordinate')
            require(v <= 1, 'Normalized coordinates must lie in [0,1]')
    segments = []
    for a, b in zip(points, points[1:]):
        require(a != b, 'Zero-length segment')
        segments.append((a, b))
    for i, (a, b) in enumerate(segments):
        for j in range(i + 1, len(segments)):
            c, d = segments[j]
            if j == i + 1:
                # Adjacent collinear segments must not double back.
                if abs(cross(a, b, d)) <= 1e-12:
                    require(sum((b[k]-a[k])*(d[k]-b[k]) for k in (0, 1)) > 0,
                            'Backtracking segment')
                continue
            if i == 0 and j == len(segments)-1 and points[0] == points[-1]:
                require(abs(cross(b, a, c)) > 1e-12 or
                        sum((a[k]-b[k])*(c[k]-a[k]) for k in (0, 1)) > 0,
                        'Backtracking closure')
                continue
            require(not intersects(a, b, c, d), 'Self-intersecting polyline')
    if points[0] == points[-1]:
        require(len(points) >= 4, 'Closed barriers need at least three distinct vertices')
    return points


def cross(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])


def intersects(a, b, c, d):
    def on(p, q, r):
        return abs(cross(p, q, r)) <= 1e-12 and all(
            min(p[k], q[k])-1e-12 <= r[k] <= max(p[k], q[k])+1e-12 for k in (0, 1))
    x, y, z, w = cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)
    return (x*y < 0 and z*w < 0) or on(a, b, c) or on(a, b, d) or on(c, d, a) or on(c, d, b)


def overlaps(a, b, c, d):
    if abs(cross(a, b, c)) > 1e-12 or abs(cross(a, b, d)) > 1e-12:
        return False
    k = 0 if abs(b[0]-a[0]) >= abs(b[1]-a[1]) else 1
    return min(max(a[k], b[k]), max(c[k], d[k])) - max(min(a[k], b[k]), min(c[k], d[k])) > 1e-12


def transform(points, placement):
    """Top-left normalized image coordinates -> unrotated page pixels."""
    polyline(points)
    return [[placement['left']-placement['width']/2 + u*placement['width'],
             placement['top']-placement['height']/2 + v*placement['height']] for u, v in points]


def validate_package(p):
    fields = ('schema', 'lighting_id', 'title', 'map', 'compatibility', 'review',
              'lighting', 'barriers', 'annotations')
    keys(p, fields, fields)
    require(p['schema'] == SCHEMA, 'Unsupported lighting schema')
    stable_id(p['lighting_id']); text(p['title'], 'lighting title')
    m = p['map']; keys(m, ('package', 'page_id', 'graphic_id', 'sha256'), ('package', 'page_id', 'graphic_id', 'sha256'))
    identifier(m['page_id'], 'explicit page ID'); identifier(m['graphic_id'], 'explicit map graphic ID')
    require(isinstance(m['sha256'], str) and re.fullmatch('[0-9a-f]{64}', m['sha256']), 'Missing original image SHA-256')
    mp = m['package']
    mf = ('schema', 'setup_id', 'title', 'source', 'target', 'image', 'page_settings', 'placement', 'crop', 'visibility')
    keys(mp, mf, mf); require(mp['schema'] == 'd35-map-page/0.1', 'Missing map-page package')
    keys(mp['target'], ('id', 'name'), ('id', 'name'))
    keys(mp['image'], ('mode', 'graphic_id'), ('mode', 'graphic_id'))
    spec = {k: mp[k] for k in ('title', 'source', 'page_settings', 'placement', 'crop', 'visibility')}
    validate_spec(spec)
    rebuilt = map_package(spec, setup_id=mp['setup_id'], page_name=mp['target']['name'],
                          page_id=mp['target']['id'], mode=mp['image']['mode'], graphic_id=mp['image']['graphic_id'])
    require(rebuilt == mp, 'Invalid embedded map package')
    require(mp['target']['id'] in (None, m['page_id']) and mp['image']['graphic_id'] in (None, m['graphic_id']) or
            (mp['image']['mode'] == 'copy' and mp['target']['id'] in (None, m['page_id'])), 'Map binding differs')
    c = p['compatibility']; keys(c, ('engine', 'native_path_id'), ('engine', 'native_path_id'))
    require(c['engine'] in ('classic', 'latest'), 'Select classic or latest engine explicitly')
    if c['native_path_id'] is not None:
        identifier(c['native_path_id'], 'native compatibility witness ID')
    r = p['review']; keys(r, ('status', 'by', 'rationale', 'decisions'), ('status', 'by', 'rationale', 'decisions'))
    require(r['status'] in ('proposed', 'approved'), 'Explicit review status required')
    text(r['rationale'], 'review rationale', 4000)
    require(isinstance(r['decisions'], list) and len(r['decisions']) <= 200, 'Invalid review decisions')
    did = set()
    for d in r['decisions']:
        keys(d, ('id', 'note', 'resolution'), ('id', 'note', 'resolution')); stable_id(d['id'])
        require(d['id'] not in did, 'Duplicate review decision'); did.add(d['id'])
        text(d['note'], 'review judgment', 2000)
        require(d['resolution'] in ('pending', 'accepted'), 'Invalid review resolution')
    if r['by'] is not None:
        text(r['by'], 'reviewer', 240)
    if r['status'] == 'approved':
        require(r['by'] is not None and all(d['resolution'] == 'accepted' for d in r['decisions']),
                'Approval requires a named reviewer and resolution of every judgment')
    l = p['lighting']; keys(l, ('before', 'after'), ('before', 'after'))
    keys(l['before'], LIGHTING, ()); keys(l['after'], LIGHTING, ())
    require(set(l['before']) == set(l['after']), 'Supply explicit before/after settings for the same fields')
    require(all(type(v) is bool for part in l.values() for v in part.values()), 'Lighting settings must be booleans')
    require(l['after'].get('lightrestrictmove', False) is False, 'v0.1 does not enable movement restriction')
    require(isinstance(p['barriers'], list) and len(p['barriers']) <= 200, 'Invalid barrier inventory')
    seen, segments, all_segments, total = set(), set(), [], 0
    for b in p['barriers']:
        keys(b, ('id', 'points', 'rationale', 'certainty'), ('id', 'points', 'rationale', 'certainty'))
        stable_id(b['id']); require(b['id'] not in seen, 'Duplicate barrier ID'); seen.add(b['id'])
        polyline(b['points']); total += len(b['points']); text(b['rationale'], 'barrier rationale', 2000)
        g = mp['placement']
        require(all(((z[0]-a[0])*g['width'])**2 + ((z[1]-a[1])*g['height'])**2 >= 0.01**2-1e-15
                    for a, z in zip(b['points'], b['points'][1:])), 'Barrier segment is below 0.01 page pixels')
        require(b['certainty'] in ('confirmed', 'interpretive'), 'Invalid geometry certainty')
        if b['certainty'] == 'interpretive':
            require(any(d['id'] == b['id'] for d in r['decisions']), 'Interpretive geometry needs a review decision')
        for a, z in zip(b['points'], b['points'][1:]):
            key = tuple(sorted((tuple(a), tuple(z))))
            require(key not in segments, 'Duplicated barrier segment'); segments.add(key)
            require(not any(overlaps(a, z, c, d) for c, d in all_segments), 'Overlapping barrier segments')
            all_segments.append((a, z))
    require(total <= 2000, 'Too many geometry vertices')
    require(isinstance(p['annotations'], list) and len(p['annotations']) <= 100, 'Invalid review annotations')
    aid = set()
    for a in p['annotations']:
        keys(a, ('id', 'points', 'label'), ('id', 'points', 'label')); stable_id(a['id'])
        require(a['id'] not in aid, 'Duplicate annotation ID'); aid.add(a['id'])
        polyline(a['points']); text(a['label'], 'review-only label', 1000)
    return p


def build_package(spec):
    p = deepcopy(spec)
    require(isinstance(p, dict) and ('schema' not in p or p['schema'] == SCHEMA), 'Unsupported lighting schema')
    p['schema'] = SCHEMA
    return validate_package(p)


def overlay_svg(p, image_bytes):
    """Embed the exact approved JPEG; annotations are not importable barriers."""
    validate_package(p)
    require(sha256(image_bytes).hexdigest() == p['map']['sha256'], 'Overlay image differs from approved source SHA-256')
    source = p['map']['package']['source']; w, h = source['pixel_width'], source['pixel_height']
    mime, size = image_dimensions(image_bytes)
    require(size == (w, h), 'Overlay image dimensions differ from approved source')
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
             '<title>'+escape(p['title'])+' — review overlay</title>',
             f'<image width="{w}" height="{h}" href="data:{mime};base64,{base64.b64encode(image_bytes).decode()}"/>']
    for group, color, dash in [('barriers', '#00e5ff', ''), ('annotations', '#ffc247', 'stroke-dasharray="18 12"')]:
        parts.append(f'<g id="{group}">')
        for item in p[group]:
            pts = ' '.join(f'{u*w},{v*h}' for u, v in item['points'])
            u, v = item['points'][0]
            parts.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="8" {dash}/>')
            parts.append(f'<text x="{u*w+12}" y="{v*h-16}" fill="{color}" stroke="#14212b" stroke-width="2" paint-order="stroke" font-family="sans-serif" font-size="38">{escape(item["id"])}</text>')
        parts.append('</g>')
    parts.extend([f'<g transform="scale({w/3500})">',
                  '<rect x="25" y="25" width="1560" height="245" rx="15" fill="#10202c" fill-opacity="0.94"/>',
                  '<g fill="white" font-family="sans-serif" font-size="40">',
                  f'<text x="50" y="83">{escape(p["title"])}</text>',
                  f'<text x="50" y="140">{len(p["barriers"])} proposed barriers — {escape(p["review"]["status"].upper())}; approval required</text>',
                  '<text x="50" y="197" fill="#ffc247">Dashed amber: review-only regions; NEVER applied</text>',
                  '<text x="50" y="247" font-size="30">Cyan: package barriers. Open water / deck details are not walls.</text></g></g></svg>'])
    return '\n'.join(parts)


def image_dimensions(data):
    """Read PNG/JPEG dimension headers without rewriting the source bytes."""
    if data.startswith(b'\x89PNG\r\n\x1a\n') and len(data) >= 24 and data[12:16] == b'IHDR':
        return 'image/png', struct.unpack('>II', data[16:24])
    if data.startswith(b'\xff\xd8'):
        pos = 2
        while pos + 4 <= len(data):
            require(data[pos] == 255, 'Invalid JPEG marker')
            while pos < len(data) and data[pos] == 255:
                pos += 1
            require(pos + 3 <= len(data), 'Truncated JPEG header')
            marker = data[pos]; pos += 1
            length = int.from_bytes(data[pos:pos+2], 'big')
            require(length >= 2 and pos+length <= len(data), 'Invalid JPEG segment')
            if marker in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
                require(length >= 7, 'Invalid JPEG dimensions')
                height, width = struct.unpack('>HH', data[pos+3:pos+7])
                return 'image/jpeg', (width, height)
            require(marker != 0xda, 'JPEG has no supported size header')
            pos += length
    raise ValueError('Review overlays require an original PNG or JPEG')


def write_bundle(spec, output_root, image=None):
    p = build_package(spec)
    root = Path(output_root).resolve()
    require('03-import-staging' in {x.lower() for x in root.parts}, 'Generated packages belong in Area03')
    svg = overlay_svg(p, Path(image).read_bytes()) if image else None
    dest = root / ('dynamic-lighting-' + uuid.uuid4().hex)
    dest.mkdir(parents=True, exist_ok=False)
    (dest/'lighting-package.json').write_text(json.dumps(p, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    if svg:
        (dest/'review-overlay.svg').write_text(svg, encoding='utf-8')
    return dest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('spec', type=Path); parser.add_argument('--output-root', required=True, type=Path)
    parser.add_argument('--image', type=Path, help='Exact original JPEG for a private review overlay')
    args = parser.parse_args()
    try:
        print(write_bundle(json.loads(args.spec.read_text(encoding='utf-8-sig')), args.output_root, args.image))
    except (ValueError, OSError) as error:
        parser.exit(2, str(error)+'\n')


if __name__ == '__main__':
    main()
