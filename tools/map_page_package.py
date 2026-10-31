"""Package explicit approved map specifications; never infer a crop or alignment."""
import argparse
from copy import deepcopy
from html import escape
import json
import math
from pathlib import Path
import re
import uuid

from journal_formatter import keys, require

PAGE_REQUIRED = ('width', 'height', 'scale_number', 'scale_units', 'grid_type',
                 'snapping_increment', 'showgrid', 'grid_offset_x', 'grid_offset_y')
PAGE_OPTIONAL = ('diagonaltype', 'grid_opacity', 'gridcolor', 'gridlabels', 'background_color')
PLACEMENT = ('width', 'height', 'left', 'top', 'rotation', 'layer', 'fliph', 'flipv')
SOURCE = ('asset_id', 'filename', 'url', 'pixel_width', 'pixel_height', 'columns', 'rows',
          'distance_per_cell', 'units', 'authority')


def text(value, label, limit=240):
    require(isinstance(value, str) and value and value == value.strip() and len(value) <= limit and
            not any(ord(c) < 32 for c in value), 'Invalid ' + label)
    return value


def identifier(value, label):
    text(value, label)
    require(re.fullmatch(r'[-A-Za-z0-9_]+', value), 'Invalid ' + label)


def number(value, label, positive=False, integer=False):
    require(type(value) in (int, float) and math.isfinite(value) and
            (value > 0 if positive else value >= 0) and value <= 1000000 and
            (not integer or value == int(value)), 'Invalid explicit ' + label)


def validate_spec(spec):
    keys(spec, ('title', 'source', 'page_settings', 'placement', 'crop', 'visibility'),
         ('title', 'source', 'page_settings', 'placement', 'crop', 'visibility'))
    text(spec['title'], 'map title')
    require(spec['crop'] == 'full', 'v0.1 requires an explicitly approved full image; runtime crops are unsupported')
    require(spec['visibility'] == 'gm_only', 'v0.1 only configures pages kept off all player assignments')
    s = spec['source']; keys(s, SOURCE, SOURCE)
    identifier(s['asset_id'], 'approved source asset identity')
    text(s['filename'], 'approved filename'); text(s['url'], 'canonical asset URL', 2000)
    require(s['url'].startswith('https://'), 'Use an explicit canonical HTTPS asset reference')
    text(s['authority'], 'specification and placement authority', 4000)
    for k in ('pixel_width', 'pixel_height', 'columns', 'rows'):
        number(s[k], 'source ' + k, positive=True, integer=True)
    number(s['distance_per_cell'], 'source distance per cell', positive=True)
    text(s['units'], 'source distance units', 20)
    p = spec['page_settings']; keys(p, PAGE_REQUIRED + PAGE_OPTIONAL, PAGE_REQUIRED)
    for k in ('width', 'height'):
        number(p[k], 'page ' + k, positive=True, integer=True)
    for k in ('scale_number', 'snapping_increment'):
        number(p[k], k, positive=True)
    for k in ('grid_offset_x', 'grid_offset_y'):
        number(p[k], k)
        require(p[k] == 0, 'Nonzero grid offsets need separate live verification; v0.1 refuses them')
    require(p['grid_type'] == 'square', 'v0.1 supports square grids only')
    require(type(p['showgrid']) is bool, 'Supply explicit grid visibility')
    text(p['scale_units'], 'page scale units', 20)
    require(p['scale_units'] == s['units'] and
            math.isclose(p['scale_number'] * p['snapping_increment'], s['distance_per_cell'], rel_tol=1e-9),
            'Page distance and snapping do not match the approved source cell scale')
    if 'gridlabels' in p:
        require(type(p['gridlabels']) is bool, 'Invalid gridlabels')
    if 'grid_opacity' in p:
        number(p['grid_opacity'], 'grid opacity'); require(p['grid_opacity'] <= 1, 'Invalid grid opacity')
    if 'diagonaltype' in p:
        require(p['diagonaltype'] in ('foure', 'pythagorean', 'threefive', 'manhattan'), 'Unsupported diagonal measurement')
    for k in ('gridcolor', 'background_color'):
        if k in p:
            require(isinstance(p[k], str) and re.fullmatch(r'#[0-9a-fA-F]{6}', p[k]), 'Invalid ' + k)
    g = spec['placement']; keys(g, PLACEMENT, PLACEMENT)
    for k in ('width', 'height'):
        number(g[k], 'graphic ' + k, positive=True)
    for k in ('left', 'top'):
        number(g[k], 'graphic center ' + k)
    require(type(g['rotation']) in (int, float) and g['rotation'] == 0 and
            g['layer'] == 'map' and g['fliph'] is False and g['flipv'] is False,
            'Only unrotated, unmirrored full-image placement on the Map layer is supported')
    require(math.isclose(g['width'] / s['pixel_width'], g['height'] / s['pixel_height'], rel_tol=1e-9),
            'Placement distorts the approved image aspect ratio')
    cell = 70 * p['snapping_increment']
    require(math.isclose(g['width'] / cell, s['columns'], rel_tol=1e-9) and
            math.isclose(g['height'] / cell, s['rows'], rel_tol=1e-9),
            'Placement and snapping do not reproduce the approved source grid')
    require(g['left'] - g['width'] / 2 >= 0 and g['top'] - g['height'] / 2 >= 0 and
            g['left'] + g['width'] / 2 <= 70 * p['width'] and
            g['top'] + g['height'] / 2 <= 70 * p['height'],
            'Placement would clip the full image outside the page')


def build_package(spec, *, setup_id, page_name, page_id=None, mode='configure', graphic_id=None):
    validate_spec(spec)
    require(isinstance(setup_id, str) and re.fullmatch(r'[a-z0-9][a-z0-9._:-]{2,159}', setup_id), 'Invalid stable setup_id')
    text(page_name, 'exact existing page name')
    if page_id is not None:
        identifier(page_id, 'explicit page ID')
    if graphic_id is not None:
        identifier(graphic_id, 'explicit uploaded graphic ID')
    require(mode in ('configure', 'copy'), 'Unsupported image binding operation')
    return {'schema': 'd35-map-page/0.1', 'setup_id': setup_id, **deepcopy(spec),
            'target': {'id': page_id, 'name': page_name}, 'image': {'mode': mode, 'graphic_id': graphic_id}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--spec', type=Path, required=True)
    parser.add_argument('--setup-id', required=True)
    parser.add_argument('--page-name', required=True)
    parser.add_argument('--page-id')
    parser.add_argument('--mode', choices=('configure', 'copy'), default='configure')
    parser.add_argument('--graphic-id')
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    staging = Path(__file__).resolve().parents[2] / '03-Import-Staging'
    require(args.output_root.resolve().is_relative_to(staging.resolve()), 'Output must be in Area 03')
    spec = json.loads(args.spec.read_text(encoding='utf-8-sig'))
    package = build_package(spec, setup_id=args.setup_id, page_name=args.page_name, page_id=args.page_id,
                            mode=args.mode, graphic_id=args.graphic_id)
    output = args.output_root / ('map-page-package-' + uuid.uuid4().hex)
    output.mkdir(parents=True, exist_ok=False)
    serialized = json.dumps(package, ensure_ascii=False, indent=2)
    (output / 'map-page-package.json').write_text(serialized, encoding='utf-8')
    (output / 'transfer-gmnotes.html').write_text('<pre>' + escape(serialized) + '</pre>', encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
