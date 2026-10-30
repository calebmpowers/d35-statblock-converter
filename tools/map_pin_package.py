"""Wrap an existing Journal pin plan with explicit placement; never invent positions."""
import argparse
from copy import deepcopy
from html import escape
import json
import math
from pathlib import Path
import re
import uuid

from journal_formatter import keys, pin_settings, require, resolve_pin


def nonempty(value, label):
    require(isinstance(value, str) and value and value == value.strip() and
            len(value) <= 240 and not any(ord(c) < 32 for c in value), 'Invalid ' + label)
    return value


def identifier(value, label):
    nonempty(value, label)
    require(re.fullmatch(r'[-A-Za-z0-9_]+', value), 'Invalid ' + label)
    return value


def build_package(plan, *, pin_id, page_id, page_name, x, y, title, handout_id=None):
    require(isinstance(pin_id, str) and re.fullmatch(r'[a-z0-9][a-z0-9._:-]{2,159}', pin_id), 'Invalid stable pin_id')
    identifier(page_id, 'explicit page ID'); nonempty(page_name, 'exact page name'); nonempty(title, 'pin title')
    for coordinate in (x, y):
        require(type(coordinate) in (int, float) and math.isfinite(coordinate) and coordinate >= 0,
                'Supply explicit finite nonnegative x and y pixel coordinates')
    keys(plan, ('intent', 'status', 'properties'), ('intent', 'status', 'properties'))
    intent = plan['intent']
    keys(intent, ('handout_title', 'heading', 'source_field', 'read_aloud_block_id', 'native_flavor_text', 'gm_only'),
         ('handout_title', 'heading', 'source_field', 'read_aloud_block_id', 'native_flavor_text', 'gm_only'))
    nonempty(intent['handout_title'], 'exact Handout title'); nonempty(intent['heading'], 'exact heading')
    require(intent['source_field'] == 'notes' and intent['native_flavor_text'] is True and intent['gm_only'] is True,
            'Only hidden Description & Notes heading pins with native extraction are supported')
    require(intent['read_aloud_block_id'] is None or isinstance(intent['read_aloud_block_id'], str) and intent['read_aloud_block_id'],
            'Invalid read-aloud source block ID')
    require(plan['status'] in ('resolved', 'needs_handout_id'), 'Unsupported planner status')
    require(isinstance(plan['properties'], dict), 'Missing planner properties')
    supplied = deepcopy(plan['properties'])
    supplied_id = supplied.pop('link', None)
    require(json.dumps(supplied, sort_keys=True) == json.dumps(pin_settings(intent), sort_keys=True),
            'Planner settings changed, unsafe visibility, or custom tooltip content')
    if plan['status'] == 'resolved':
        identifier(supplied_id, 'resolved Handout ID')
        require(handout_id is None or handout_id == supplied_id, 'Conflicting Handout ID')
        handout_id = supplied_id
    else:
        require(supplied_id is None, 'Unresolved plan already contains a Handout ID')
    identifier(handout_id, 'explicit Handout ID')
    properties = resolve_pin(intent, {intent['handout_title']: {'id': handout_id, 'headings': [intent['heading']]}})
    return {'schema': 'd35-map-pin/0.1', 'pin_id': pin_id,
            'page': {'id': page_id, 'name': page_name}, 'x': x, 'y': y, 'title': title,
            'plan': {'intent': deepcopy(intent), 'status': 'resolved', 'properties': properties}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True, help='Existing formatter pin-plans.json')
    parser.add_argument('--plan-index', type=int, default=0)
    for flag in ('pin-id', 'page-id', 'page-name', 'title'):
        parser.add_argument('--' + flag, required=True)
    parser.add_argument('--x', type=float, required=True)
    parser.add_argument('--y', type=float, required=True)
    parser.add_argument('--handout-id', help='Required only when planner output needs_handout_id')
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    staging = Path(__file__).resolve().parents[2] / '03-Import-Staging'
    require(args.output_root.resolve().is_relative_to(staging.resolve()), 'Output must be in Area 03')
    plans = json.loads(args.plan.read_text(encoding='utf-8-sig'))
    require(isinstance(plans, list) and 0 <= args.plan_index < len(plans), 'Plan index missing or outside planner output')
    package = build_package(plans[args.plan_index], pin_id=args.pin_id, page_id=args.page_id, page_name=args.page_name,
                            x=args.x, y=args.y, title=args.title, handout_id=args.handout_id)
    output = args.output_root / ('map-pin-package-' + uuid.uuid4().hex)
    output.mkdir(parents=True, exist_ok=False)
    raw = json.dumps(package, ensure_ascii=False, indent=2)
    (output / 'map-pin-package.json').write_text(raw, encoding='utf-8')
    (output / 'transfer-gmnotes.html').write_text('<pre>' + escape(raw) + '</pre>', encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
