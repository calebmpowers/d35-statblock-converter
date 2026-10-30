'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRoll20Mock } = require('./roll20-sandbox-mock');
const root = path.resolve(__dirname, '../..');
const copy = value => JSON.parse(JSON.stringify(value));
function payload(name, hp, ac, strength) {
    return { schema_version: 1, creature: {
        name, cr: '2', header: { name, alignment_size_type: 'N Medium humanoid (human)', init_line: 'Init +2' },
        defense: { ac_line: 'AC ' + ac + ', touch 12, flat-footed ' + (ac - 2), hp_line: 'hp ' + hp + ' (4d8+8)', fort_ref_will_line: 'Fort +4, Ref +3, Will +1' },
        offense: { speed_line: 'Spd 30 ft.', base_attack_line: 'Base Atk +3; Grp +5',
            melee_lines: [{ raw: 'Melee longsword +5 (1d8+2/19-20)', fragments: [{ raw: 'longsword +5 (1d8+2/19-20)' }] }] },
        statistics: { abilities_line: 'Abilities Str ' + strength + ', Dex 14, Con 14, Int 10, Wis 10, Cha 10', feats: [], skills: [], possessions: [] },
        bio_notes: 'Synthetic batch commissioning fixture; not campaign content.'
    }, warnings: [] };
}
function example(pageId = '-MOCKPAGE') {
    return { batch_version: 1, batch_id: 'commission-e461', page_id: pageId,
        images: ['alpha', 'beta'].map((key, i) => ({ key, imgsrc: 'https://files.d20.io/images/' + (12345 + i) + '/fixture/thumb.png?1', width: 70, height: 70 })),
        items: [ { key: 'alpha', image_key: 'alpha', payload: payload('D35 Batch Test Alpha e461', 24, 15, 14) },
            { key: 'beta', image_key: 'beta', payload: payload('D35 Batch Test Beta e461', 32, 18, 18) } ] };
}
function harness() {
    const world = createRoll20Mock();
    function load() {
        Object.keys(world.handlers).forEach(k => delete world.handlers[k]);
        const context = vm.createContext(Object.assign({ console }, world.globals()));
        ['D35_Statblock_Importer.js', 'D35_Batch_Importer.js'].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }));
        world.trigger('ready', {});
        return context;
    }
    let context = load();
    function handout(data) {
        const obj = world.createObj('handout', { name: 'GM batch input', inplayerjournals: '', controlledby: '' });
        obj.set('gmnotes', JSON.stringify(data)); return obj;
    }
    function send(command, flush = true, playerid = '-MOCKGM', selected) {
        world.trigger('chat:message', { type: 'api', content: '!d35batch ' + command, playerid, selected });
        if (flush) world.flush();
        const report = world.state.D35BatchImporter && world.state.D35BatchImporter.lastReport;
        return report ? copy(report) : report;
    }
    return { world, handout, send, context, reload() { context = load(); },
        count: type => world.findObjs({ _type: type }).length,
        messages: () => world.chat.map(c => c.message).join('\n') };
}
function runTests(outputDirectory) {
    let count = 0;
    const results = [];
    function test(name, fn) { fn(); count++; results.push(name); console.log('PASS ' + name); }
    let commissioning;
    test('one apply creates two verified Characters/default tokens with no selected tokens; preview is read-only', () => {
        const h = harness(), data = example(), input = h.handout(data);
        h.send('register ' + input.id);
        const before = JSON.stringify(h.world.objects);
        const preview = h.send('preview ' + input.id);
        assert.deepStrictEqual(preview.items.map(i => i.status), ['ready', 'ready']);
        assert.strictEqual(JSON.stringify(h.world.objects), before);
        assert.strictEqual(h.world.state.D35StatblockImporter, undefined, 'preview must not initialize managed state');
        const result = h.send('apply ' + input.id);
        assert.deepStrictEqual(result.items.map(i => i.status), ['succeeded', 'succeeded']);
        assert.strictEqual(h.count('character'), 2);
        assert.strictEqual(h.count('handout'), 3);
        assert.strictEqual(h.count('graphic'), 2, 'capture scratch tokens must be removed');
        result.items.forEach((item, i) => {
            const character = h.world.getObj('character', item.characterId);
            const token = h.world.getObj('graphic', item.tokenId);
            const manifest = h.world.state.D35StatblockImporter.characters[character.id];
            const saved = JSON.parse(character._attrs._defaulttoken);
            assert.strictEqual(manifest.pending, undefined);
            assert.strictEqual(saved.represents, character.id);
            assert.strictEqual(saved.layer, 'objects');
            assert.strictEqual(saved.imgsrc, data.images[i].imgsrc);
            assert.strictEqual(saved.width, 70); assert.strictEqual(saved.height, 70);
            assert.strictEqual(Number(saved.bar1_value), i ? 32 : 24);
            assert.strictEqual(Number(saved.bar2_value), i ? 18 : 15);
            assert.strictEqual(saved.bar1_link, ''); assert.strictEqual(saved.bar2_link, '');
            assert.ok(!saved.showplayers_name && !saved.showplayers_bar1 && !saved.showplayers_bar2);
            assert.strictEqual(token.get('layer'), 'gmlayer');
            assert.strictEqual(token.get('represents'), character.id);
            assert.ok(character.get('avatar').includes('/med.png'));
            assert.strictEqual(h.world.getObj('handout', item.sourceHandoutId).get('inplayerjournals'), '');
            assert.ok(h.world.findObjs({ _type: 'attribute', _characterid: character.id, name: 'str-base' }).some(a => Number(a.get('current')) === (i ? 18 : 14)));
        });
        commissioning = { data, report: copy(result), state: copy(h.world.state), objects: h.world.objects.map(o => o.toJSON()) };
        const ids = result.items.map(i => i.characterId);
        h.reload();
        const retry = h.send('apply ' + input.id);
        assert.deepStrictEqual(retry.items.map(i => i.characterId), ids);
        assert.strictEqual(h.count('character'), 2); assert.strictEqual(h.count('handout'), 3); assert.strictEqual(h.count('graphic'), 2);
        assert.deepStrictEqual(retry.items.map(i => i.status), ['succeeded', 'succeeded']);
    });
    test('missing reference blocks only that item, then resumes without duplicating a completed Character', () => {
        const h = harness(), data = example();
        data.images = data.images.slice(0, 1);
        const input = h.handout(data);
        h.send('register ' + input.id);
        assert.deepStrictEqual(h.send('apply ' + input.id).items.map(i => i.status), ['succeeded', 'blocked']);
        input.set('gmnotes', JSON.stringify(example()));
        h.send('register ' + input.id);
        assert.deepStrictEqual(h.send('apply ' + input.id).items.map(i => i.status), ['succeeded', 'succeeded']);
        assert.strictEqual(h.count('character'), 2);
    });
    test('existing unmanaged Character and duplicate normalized batch names block, preserving all existing objects', () => {
        const h = harness(), data = example();
        h.world.createObj('character', { name: data.items[0].payload.creature.name.toUpperCase() });
        const input = h.handout(data); h.send('register ' + input.id);
        assert.strictEqual(h.send('apply ' + input.id).items[0].status, 'blocked');
        assert.strictEqual(h.count('character'), 2, 'only nonconflicting beta may be added');
        data.batch_id = 'duplicate-test'; data.items[1].payload.creature.name = '  ' + data.items[0].payload.creature.name.toUpperCase() + '  ';
        const dup = h.handout(data), before = h.count('character');
        assert.deepStrictEqual(h.send('apply ' + dup.id).items.map(i => i.status), ['blocked', 'blocked']);
        assert.strictEqual(h.count('character'), before);
    });
    test('a different batch cannot duplicate existing managed Characters or reuse a job ID with changed input', () => {
        const h = harness(), data = example(), input = h.handout(data);
        h.send('register ' + input.id); h.send('apply ' + input.id);
        data.batch_id = 'another-batch'; const other = h.handout(data);
        assert.deepStrictEqual(h.send('apply ' + other.id).items.map(i => i.status), ['blocked', 'blocked']);
        data.batch_id = example().batch_id; data.items[0].payload.creature.defense.hp_line = 'hp 99 (10d8+54)';
        input.set('gmnotes', JSON.stringify(data)); h.send('apply ' + input.id);
        assert.match(h.messages(), /bound to different input/);
        assert.strictEqual(h.count('character'), 2);
    });
    test('partial write failure persists blocked identity, proceeds to next item, and never creates a duplicate on retry', () => {
        const h = harness(), input = h.handout(example()); h.send('register ' + input.id);
        let fail = true;
        h.world.hooks.beforeCreate = type => { if (fail && type === 'attribute') { fail = false; throw Error('Injected attribute failure'); } };
        const result = h.send('apply ' + input.id);
        assert.deepStrictEqual(result.items.map(i => i.status), ['failed', 'succeeded']);
        assert.ok(result.items[0].characterId);
        h.reload();
        assert.deepStrictEqual(h.send('apply ' + input.id).items.map(i => i.status), ['blocked', 'succeeded']);
        assert.strictEqual(h.count('character'), 2);
    });
    test('concurrent apply commands cannot race or duplicate and non-GM/API-origin commands do nothing', () => {
        const h = harness(), input = h.handout(example());
        h.send('register ' + input.id, true, 'API'); assert.strictEqual(h.world.state.D35BatchImporter, undefined);
        h.send('register ' + input.id); h.send('apply ' + input.id, false); h.send('apply ' + input.id, false);
        h.world.flush(); assert.strictEqual(h.count('character'), 2); assert.match(h.messages(), /coordinator busy/);
    });
    test('shared Handouts, missing pages, oversized batches and unsupported payloads are blocked', () => {
        const h = harness(), data = example(), input = h.handout(data);
        input.set('inplayerjournals', 'all'); h.send('apply ' + input.id); assert.match(h.messages(), /GM-only/);
        input.set('inplayerjournals', ''); data.page_id = '-MISSING'; input.set('gmnotes', JSON.stringify(data)); h.send('apply ' + input.id);
        assert.match(h.messages(), /staging page/);
        data.page_id = '-MOCKPAGE'; data.items = Array.from({ length: 6 }, (_, i) => ({ ...copy(data.items[0]), key: String(i) }));
        input.set('gmnotes', JSON.stringify(data)); h.send('apply ' + input.id); assert.match(h.messages(), /1–5 items/);
        const invalid = example(); invalid.items[0].payload.schema_version = 2; input.set('gmnotes', JSON.stringify(invalid)); h.send('register ' + input.id);
        assert.strictEqual(h.send('preview ' + input.id).items[0].status, 'blocked'); assert.strictEqual(h.count('character'), 0);
    });
    test('atomic registration rejects duplicate/different keys, external URLs, Marketplace images, and missing query strings', () => {
        const h = harness(), data = example(), input = h.handout(data);
        data.images[1].imgsrc = 'https://example.com/x.png'; input.set('gmnotes', JSON.stringify(data)); h.send('register ' + input.id);
        assert.strictEqual(Object.keys(h.world.state.D35BatchImporter.images).length, 0);
        for (const bad of ['https://marketplace.roll20.net/image/thumb.png?1', 'https://files.d20.io/images/12345/fixture/thumb.png']) {
            data.images[1].imgsrc = bad; input.set('gmnotes', JSON.stringify(data)); h.send('register ' + input.id);
            assert.strictEqual(Object.keys(h.world.state.D35BatchImporter.images).length, 0);
        }
        input.set('gmnotes', JSON.stringify(example())); h.send('register ' + input.id);
        const before = JSON.stringify(h.world.state.D35BatchImporter.images);
        data.images[1] = copy(data.images[0]); input.set('gmnotes', JSON.stringify(data)); h.send('register ' + input.id);
        assert.strictEqual(JSON.stringify(h.world.state.D35BatchImporter.images), before);
        data.images = [ { ...example().images[0], width: 140 } ]; input.set('gmnotes', JSON.stringify(data)); h.send('register ' + input.id);
        assert.strictEqual(JSON.stringify(h.world.state.D35BatchImporter.images), before);
    });
    test('one bulk selection registers multiple named GM tokens; variant names remain separate', () => {
        const h = harness();
        const tokens = example().images.map((ref, i) => h.world.createObj('graphic', { pageid: '-MOCKPAGE', layer: 'gmlayer',
            name: i ? 'Test (Campaign Variant)' : 'Test', imgsrc: ref.imgsrc, width: 70, height: 70 }));
        h.send('register-selected', true, '-MOCKGM', tokens.map(t => ({ _type: 'graphic', _id: t.id })));
        assert.strictEqual(Object.keys(h.world.state.D35BatchImporter.images).length, 2);
    });
    test('read timeouts release batch lock and ignore late reads', () => {
        const h = harness(), input = h.handout(example()); h.world.suspendBlobs = true;
        h.send('apply ' + input.id); assert.match(h.messages(), /Timed out reading/);
        h.world.suspendBlobs = false; h.send('register ' + input.id);
        assert.deepStrictEqual(h.send('apply ' + input.id).items.map(i => i.status), ['succeeded', 'succeeded']);
    });
    test('empty Roll20 notes represented as null produce a useful blocked report and no mutations', () => {
        const h = harness(), input = h.handout(null);
        input.set('notes', 'null');
        h.send('register ' + input.id);
        assert.match(h.messages(), /Expected a JSON object/);
        assert.strictEqual(h.count('character'), 0);
        input.set('gmnotes', JSON.stringify(example())); h.send('register ' + input.id);
        assert.deepStrictEqual(h.send('preview ' + input.id).items.map(i => i.status), ['ready', 'ready']);
    });
    test('retry detects source tampering, deleted output and managed token drift without recreating anything', () => {
        const h = harness(), input = h.handout(example()); h.send('register ' + input.id);
        const first = h.send('apply ' + input.id);
        h.world.getObj('handout', first.items[0].sourceHandoutId).set('gmnotes', JSON.stringify(payload('Changed', 10, 10, 10)));
        h.world.getObj('graphic', first.items[1].tokenId).set('width', 140);
        assert.deepStrictEqual(h.send('apply ' + input.id).items.map(i => i.status), ['failed', 'blocked']);
        h.world.getObj('character', first.items[0].characterId).remove();
        assert.strictEqual(h.send('apply ' + input.id).items[0].status, 'blocked');
        assert.strictEqual(h.count('character'), 1);
    });
    test('recovery rediscovers a verified Character by source identity after a lost completion callback', () => {
        const h = harness(), input = h.handout(example()); h.send('register ' + input.id); h.send('apply ' + input.id);
        const records = h.world.state.D35BatchImporter.batches['batch:commission-e461'].items;
        Object.values(records).forEach(record => { delete record.characterId; record.status = 'running'; }); h.reload();
        assert.deepStrictEqual(h.send('apply ' + input.id).items.map(i => i.status), ['succeeded', 'succeeded']);
        assert.strictEqual(h.count('character'), 2);
    });
    test('status JSON is a single GM whisper, avoiding Roll20 newline splitting', () => {
        const h = harness(), input = h.handout(example()); h.send('register ' + input.id); h.send('apply ' + input.id);
        const before = h.world.chat.length; h.send('status');
        assert.strictEqual(h.world.chat.length, before + 1);
        const message = h.world.chat.at(-1).message;
        assert.ok(message.startsWith('/w gm <pre>'));
        assert.ok(!/[\r\n]/.test(message));
        assert.match(message, /"batchId":"commission-e461"/);
    });
    if (outputDirectory) {
        fs.mkdirSync(outputDirectory, { recursive: true });
        fs.writeFileSync(path.join(outputDirectory, 'mock-commissioning.json'), JSON.stringify({ tests: count, scenarios: results, commissioning }, null, 2) + '\n', { flag: 'wx' });
        fs.writeFileSync(path.join(outputDirectory, 'synthetic-batch-template.json'), JSON.stringify(example(), null, 2) + '\n', { flag: 'wx' });
        const corpus = path.join(outputDirectory, 'synthetic-corpus'); fs.mkdirSync(corpus);
        example().items.forEach(item => fs.writeFileSync(path.join(corpus, item.key + '.json'), JSON.stringify(item.payload, null, 2) + '\n', { flag: 'wx' }));
    }
    console.log('Batch prototype tests passed: ' + count + ' scenarios. Mock stored-object verification; not live sheet calculations.');
    return count;
}
if (require.main === module) runTests(process.argv[2]);
module.exports = { runTests, example };
