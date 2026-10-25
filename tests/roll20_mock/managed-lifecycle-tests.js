'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { createRoll20Mock } = require('./roll20-sandbox-mock');
const { measureStateFootprint } = require('./state-footprint');

const copy = (value) => JSON.parse(JSON.stringify(value));
const attack = (raw) => ({ raw, fragments: [{ raw: raw.replace(/^(?:Melee|Ranged)\s+/, '') }] });

function payload() {
    return {
        schema_version: 1,
        creature: {
            name: 'Lifecycle Mage', cr: '3',
            header: { name: 'Lifecycle Mage', source_reference: 'Fixture reference', alignment_size_type: 'NE Medium humanoid (human)',
                init_line: 'Init +2', classes: [{ name: 'wizard', level: 3 }], languages_line: 'Languages Common' },
            defense: { ac_line: 'AC 15, touch 12, flat-footed 13', hp_line: 'hp 18 (3d4+6)',
                fort_ref_will_line: 'Fort +3, Ref +3, Will +4' },
            offense: { speed_line: 'Spd 30 ft.', base_attack_line: 'Base Atk +1; Grp +2',
                melee_lines: [attack('Melee dagger +2 (1d4+1/19-20)')],
                ranged_lines: [attack('Ranged light crossbow +3 (1d8/19-20)')],
                spell_sections: [{ type: 'Wizard Spells Prepared', caster_level: '3rd',
                    groups: [{ label: '1', spells: [{ name: 'Magic Missile', raw: 'magic missile', prepared_count: 2 },
                        { name: 'Shield', raw: 'shield' }] }] }],
                maneuvers: [{ name: 'Sapphire Nightmare Blade', level: 1, discipline: 'Diamond Mind',
                    description: 'Test maneuver', readied: true }] },
            statistics: { abilities_line: 'Abilities Str 12, Dex 14, Con 14, Int 16, Wis 12, Cha 10',
                feats: ['Combat Casting'], skills: ['Concentration +8'], possessions: [] },
            bio_notes: 'A fixture biography.'
        }, warnings: []
    };
}

function load(world, importer, source = fs.readFileSync(importer, 'utf8')) {
    const context = Object.assign({ console, Date, JSON, Math, RegExp, String, Number, Boolean, Array, Object,
        parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent }, world.globals());
    vm.createContext(context);
    vm.runInContext(source, context, { filename: importer });
    world.trigger('ready', {});
    return context;
}

function harness(importer) {
    const world = createRoll20Mock();
    const context = load(world, importer);
    function handout(data) {
        const result = world.createObj('handout', { name: 'Lifecycle input' });
        result.set('gmnotes', JSON.stringify(data));
        return result;
    }
    function send(text, selected = [], flush = true, playerid = '-MOCKGM') {
        world.trigger('chat:message', { type: 'api', playerid, content: '!d35import ' + text,
            selected: selected.map((token) => ({ _type: 'graphic', _id: token.id })) });
        if (flush) { world.flush(); }
        return world.state.D35StatblockImporter && world.state.D35StatblockImporter.lastReport;
    }
    function token() {
        return world.createObj('graphic', { pageid: '-MOCKPAGE',
            imgsrc: 'https://files.d20.io/images/12345/fixture/thumb.png?1', width: 70, height: 70,
            layer: 'objects', left: 210, top: 280, light_hassight: true, statusmarkers: '' });
    }
    function create(data = payload(), selected = [], flags = '') {
        const source = handout(data);
        const report = send('import ' + source.id + flags, selected);
        assert.ok(report && report.storedObjectsVerified, JSON.stringify(report && report.issues));
        const character = world.getObj('character', report.characterId);
        return { data, source, character, manifest: world.state.D35StatblockImporter.characters[character.id] };
    }
    function attr(character, name) {
        return world.findObjs({ _type: 'attribute', _characterid: character.id, name })[0];
    }
    function objects() { return copy(world.objects.map((obj) => obj.toJSON())); }
    return { world, context, handout, send, token, create, attr, objects,
        report: () => world.state.D35StatblockImporter.lastReport };
}

function runLifecycleTests(importer) {
    let count = 0;
    function test(name, body) {
        try { body(harness(importer)); count += 1; }
        catch (error) { error.message = name + ': ' + error.message; throw error; }
    }
    function verified(report) { assert.strictEqual(report.status, 'verified', JSON.stringify(report.issues)); }
    function issue(report, code) { assert.ok(report.issues.some((item) => item.code === code), JSON.stringify(report.issues)); }

    require('./usability-tests').runUsabilityTests(test, payload, verified);

    ['V\u2019sesslin (Campaign Variant)', 'Yuan\u2011ti\u00a0Halfblood (Campaign Variant)'].forEach((name) =>
        test('handout name lookup normalizes both sides: ' + name, (h) => {
            const source = h.handout(payload()); source.set('name', name);
            verified(h.send('import ' + name.replace(/\u2019/g, "'").replace(/\u2011/g, '-').replace(/\u00a0/g, ' ')));
        }));

    test('live attack rolls omit inactive modifiers and respond to later toggles', (h) => {
        const c = h.create();
        const ability = h.world.getObj('ability', c.manifest.owned.abilities.dagger);
        const command = ability.get('action').replace('@{character_id}', c.character.id).replace(/^!d35import /, '');
        function roll() {
            h.send(command);
            return h.world.chat.filter((entry) => entry.who === 'character|' + c.character.id).slice(-1)[0].message;
        }
        function total(message, field) {
            const expression = message.match(new RegExp('\\{\\{' + field + '=[\\s\\S]*?\\[\\[([\\s\\S]*?)\\]\\]'))[1]
                .replace(/@\{[^|}]+\|([^}]+)\}/g, (all, name) => '(' + (h.world.getAttrByName(c.character.id, name) || 0) + ')')
                .replace(/\[[^\]]*\]/g, '').replace(/\d*d\d+(?:cs>\d+)?/g, '0').replace(/floor\(/g, 'Math.floor(');
            return vm.runInNewContext(expression, {Math});
        }
        const inactive = roll();
        assert.strictEqual(total(inactive, 'attack1'), 2);
        assert.strictEqual(total(inactive, 'damage1'), 1);
        ['[Epic AB]', '[Global bonus]', '[Flank]', '[Pow. Att.]', '[Smite]', '[Pr. Ha.]', '[Flurry]'].forEach((label) => assert.ok(!inactive.includes(label), label + ': ' + inactive));
        function set(name, value) {
            const attr = h.attr(c.character, name);
            if (attr) { attr.set('current', value); }
            else { h.world.createObj('attribute', {characterid:c.character.id, name, current:value}); }
        }
        set('globalAttackBonus', 2); set('flankEnabled', 2); set('powerAttackAttackBonus', -3);
        set('fightingDefensivelyAttackBonus', -4); set('fightingDefensivelyEnabled', 0);
        const active = roll();
        assert.strictEqual(total(active, 'attack1'), 3);
        ['[Global bonus]', '[Flank]', '[Pow. Att.]'].forEach((label) => assert.ok(active.includes(label), label));
        assert.ok(!active.includes('[Fi. De.]'));
        set('fightingDefensivelyEnabled', 1); const defensive = roll(); assert.ok(defensive.includes('[Fi. De.]'));
        assert.strictEqual(total(defensive, 'attack1'), -1);
        set('globalAttackBonus', 0); set('flankEnabled', 0); set('powerAttackAttackBonus', 0); set('fightingDefensivelyEnabled', 0);
        assert.strictEqual(roll(), inactive);
        const before = h.world.chat.length;
        h.send(command, [], true, '-NOT-CONTROLLER');
        assert.ok(!h.world.chat.slice(before).some((entry) => entry.who === 'character|' + c.character.id));
        c.character.set('controlledby', '-CONTROLLER');
        h.send(command, [], true, '-CONTROLLER');
        assert.strictEqual(h.world.chat.slice(-1)[0].who, 'character|' + c.character.id);
    });

    test('refresh updates the selected managed Character by handout name without duplicates', (h) => {
        const token = h.token(), c = h.create(payload(), [token]);
        c.source.set('name', 'V\u2019sesslin (Campaign Variant)');
        const changed = copy(c.data); changed.creature.defense.hp_line = 'hp 27 (3d4+15)';
        c.source.set('gmnotes', JSON.stringify(changed));
        h.attr(c.character, 'hitpoints').set('current', 3); token.set('bar1_value', 3);
        verified(h.send("refresh V'sesslin (Campaign Variant)", [token]));
        assert.strictEqual(h.world.findObjs({_type:'character'}).length, 1);
        assert.strictEqual(h.attr(c.character, 'hitpoints').get('current'), 3);
        assert.strictEqual(h.attr(c.character, 'hitpoints').get('max'), 27);
        assert.strictEqual(token.get('bar1_value'), 3);
        const before = h.objects();
        h.send('refresh ' + c.source.id, []); assert.deepStrictEqual(h.objects(), before);
        token.set('represents', ''); const unlinked = h.objects();
        h.send('refresh ' + c.source.id, [token]); assert.deepStrictEqual(h.objects(), unlinked);
    });

    test('duplicate weapon profiles collapse while two-weapon routine bonuses remain exact', (h) => {
        const data = payload();
        data.creature.offense.melee_lines = [{ raw:'Melee rapier +8 (1d6+2/18-20) or rapier +6 (1d6+2/18-20) and dagger +5 (1d4+1/19-20)',
            fragments:[{raw:'rapier +8 (1d6+2/18-20)'},{raw:'rapier +6 (1d6+2/18-20)'},{raw:'dagger +5 (1d4+1/19-20)'},{raw:'dagger +5 (1d4+1/19-20)'}]}];
        const c = h.create(data);
        assert.strictEqual(h.attr(c.character, 'weapon1name').get('current'), 'Rapier');
        assert.strictEqual(h.attr(c.character, 'weapon2name').get('current'), 'Dagger');
        assert.strictEqual(h.attr(c.character, 'weapon3name').get('current'), 'Light Crossbow');
        assert.strictEqual(h.attr(c.character, 'weapon4name'), undefined);
        const macros = c.manifest.baseline.attackMacros;
        assert.ok(macros['melee routine 2']);
        const names = h.world.findObjs({_type:'ability', characterid:c.character.id}).map((ability) => ability.get('name'));
        assert.strictEqual(names.filter((name) => name==='Rapier').length, 1);
        assert.ok(!names.includes('Rapier (Melee)'));
    });

    [false, true].forEach((consume) => test('initial recalc request verifies with worker consumption=' + consume, (h) => {
        h.world.emulateRecalc = consume;
        h.world.workerDelay = 25;
        const c = h.create();
        const recalc = h.attr(c.character, 'recalc');
        assert.strictEqual(h.world.workerWrites.length, 1);
        assert.strictEqual(h.world.workerWrites[0].id, recalc.id);
        assert.strictEqual(h.world.workerWrites[0].previous, 0);
        assert.deepStrictEqual(h.world.workerWrites[0].changes, { current: 1 });
        assert.strictEqual(String(c.manifest.baseline.attributes.recalc.current), consume ? '0' : '1');
        assert.strictEqual(h.report().sheetCalculationsVerified, false);
        verified(h.send('audit ' + c.character.id));
    }));

    test('legacy recalc baseline tolerates sheet idle through audit, preview, no-change and changed-source updates', (h) => {
        const data = payload();
        data.creature.defense.hp_line = 'hp 31 (5d4+19)';
        data.creature.defense.ac_line = 'AC 16, touch 12, flat-footed 14';
        data.creature.offense.spell_sections[0].groups[0].spells[0] = { name: 'Dimension Door', raw: 'dimension door' };
        const token = h.token();
        const c = h.create(data, [token]);
        const recalc = h.attr(c.character, 'recalc');
        assert.strictEqual(c.manifest.baseline.attributes.recalc.current, 1, 'legacy verified baseline');
        const owned = copy(c.manifest.owned);
        recalc.set('current', '0'); // Normal sheet interaction consumes the control.
        ['hitpoint', 'hitpoints', 'npchitpoints'].forEach((name) => h.attr(c.character, name).set('current', 23));
        const spellName = Object.keys(c.manifest.baseline.attributes).find((name) => /_spellname\d+$/.test(name) &&
            /dimension door/i.test(String(c.manifest.baseline.attributes[name].current)));
        assert.ok(spellName);
        const used = spellName.replace('_spellname', '_spellused');
        h.attr(c.character, used).set('current', 1);
        const manual = h.world.createObj('attribute', { characterid: c.character.id, name: 'campaign_note', current: 'Keep' });
        const ability = h.world.createObj('ability', { characterid: c.character.id, name: 'Manual action', action: '/em keep' });
        token.set({ bar1_value: 19, left: 800, top: 900, rotation: 45, statusmarkers: 'red',
            layer: 'gmlayer', tint_color: '#ff0000', light_hassight: true, bright_light_distance: 30 });
        const encounter = copy(token.toJSON());
        const before = h.objects();
        const baseline = copy(c.manifest.baseline);
        const writes = h.world.workerWrites.length;
        verified(h.send('audit ' + c.character.id));
        assert.deepStrictEqual(copy(c.manifest.baseline), baseline, 'audit must not migrate the old baseline');
        const preview = h.send('preview ' + c.character.id + ' ' + c.source.id);
        assert.strictEqual(preview.status, 'preview');
        assert.strictEqual(preview.issues.length, 0);
        assert.deepStrictEqual(h.objects(), before);
        verified(h.send('update ' + c.character.id + ' ' + c.source.id));
        assert.strictEqual(h.report().touched.length, 0);
        assert.strictEqual(h.world.workerWrites.length, writes);
        assert.deepStrictEqual(h.objects(), before);
        assert.strictEqual(c.manifest.baseline.attributes.recalc.current, '0');
        h.world.emulateRecalc = true;
        h.world.hooks.sheetWorker = () => {
            assert.strictEqual(h.attr(c.character, 'str-base').get('current'), 14, 'request must follow sheet writes');
            assert.strictEqual(h.attr(c.character, 'hitpoints').get('max'), 40);
        };
        const changed = copy(data);
        changed.creature.defense.hp_line = 'hp 40 (8d4+20)';
        changed.creature.statistics.abilities_line = changed.creature.statistics.abilities_line.replace('Str 12', 'Str 14');
        const changedSource = h.handout(changed);
        verified(h.send('update ' + c.character.id + ' ' + changedSource.id));
        assert.strictEqual(h.world.workerWrites.length, writes + 1);
        assert.strictEqual(h.world.workerWrites.at(-1).previous, '0');
        assert.strictEqual(c.manifest.baseline.attributes.recalc.current, '0');
        assert.strictEqual(recalc.id, c.manifest.owned.attributes.recalc);
        assert.deepStrictEqual(copy(c.manifest.owned), owned);
        ['hitpoint', 'hitpoints', 'npchitpoints'].forEach((name) => assert.strictEqual(h.attr(c.character, name).get('current'), 23));
        assert.strictEqual(h.attr(c.character, used).get('current'), 1);
        assert.strictEqual(manual.get('current'), 'Keep');
        assert.strictEqual(ability.get('action'), '/em keep');
        assert.deepStrictEqual(copy(token.toJSON()), encounter);
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 1);
        assert.strictEqual(c.manifest.manifestVersion, 1);
        assert.strictEqual(h.world.state.D35StatblockImporter.version, 1);
        assert.strictEqual(h.report().sheetCalculationsVerified, false);
        verified(h.send('audit ' + c.character.id));
        verified(h.send('update ' + c.character.id + ' ' + changedSource.id));
        assert.strictEqual(h.report().touched.length, 0);
        assert.strictEqual(h.world.workerWrites.length, writes + 1);
        h.attr(c.character, 'npcarmorclass').set('current', 99);
        const conflictBefore = h.objects();
        issue(h.send('audit ' + c.character.id), 'mismatch');
        issue(h.send('preview ' + c.character.id + ' ' + changedSource.id), 'conflict');
        issue(h.send('update ' + c.character.id + ' ' + changedSource.id), 'conflict');
        assert.deepStrictEqual(h.objects(), conflictBefore);
        assert.strictEqual(h.world.workerWrites.length, writes + 1);
    });

    test('changed source retriggers a still-pending recalc request with a fresh edge', (h) => {
        const c = h.create();
        assert.strictEqual(h.attr(c.character, 'recalc').get('current'), 1);
        const changed = copy(c.data);
        changed.creature.statistics.abilities_line = changed.creature.statistics.abilities_line.replace('Str 12', 'Str 14');
        verified(h.send('update ' + c.character.id + ' ' + h.handout(changed).id));
        assert.strictEqual(h.world.workerWrites.length, 2);
        assert.strictEqual(h.world.workerWrites[1].previous, 0);
        assert.ok(h.report().touched.some((item) => item.path === 'recalc.current' && item.action === 'setWithWorker'));
    });

    test('explicit bind does not request recalc', (h) => {
        const c = h.create();
        h.attr(c.character, 'recalc').set('current', 0);
        verified(h.send('bind ' + c.character.id, [h.token()]));
        assert.strictEqual(h.world.workerWrites.length, 1);
        assert.strictEqual(h.attr(c.character, 'recalc').get('current'), 0);
    });

    [null, undefined, '', 2, 'true', false].forEach((value) => test('invalid recalc current ' + String(value) + ' is not silently accepted', (h) => {
        const c = h.create();
        h.attr(c.character, 'recalc')._attrs.current = value;
        const before = h.objects();
        const report = h.send('audit ' + c.character.id);
        assert.ok(report.issues.some((item) => item.path === 'attribute.recalc.current' && item.code === 'mismatch'));
        issue(h.send('update ' + c.character.id + ' ' + c.source.id), 'conflict');
        assert.deepStrictEqual(h.objects(), before);
        assert.strictEqual(h.world.workerWrites.length, 1);
    }));

    ['missing', 'duplicate', 'renamed', 'max'].forEach((failure) => test('recalc ' + failure + ' ownership/field guard remains strict', (h) => {
        const c = h.create();
        const recalc = h.attr(c.character, 'recalc');
        recalc.set('current', 0);
        if (failure === 'missing') { recalc.remove(); }
        if (failure === 'duplicate') { h.world.createObj('attribute', { characterid: c.character.id, name: 'recalc', current: 0, max: '' }); }
        if (failure === 'renamed') { recalc.set('name', 'manual_recalc'); }
        if (failure === 'max') { recalc.set('max', 99); }
        assert.strictEqual(h.send('audit ' + c.character.id).status, 'audit-failed');
        const before = h.objects();
        assert.strictEqual(h.send('update ' + c.character.id + ' ' + c.source.id).status, 'conflict');
        assert.deepStrictEqual(h.objects(), before);
    }));

    test('worker changes to ordinary managed statistics still fail readback', (h) => {
        const c = h.create();
        const baseline = copy(c.manifest.baseline);
        h.world.emulateRecalc = true;
        h.world.hooks.sheetWorker = () => h.attr(c.character, 'npcarmorclass').set('current', 99);
        const changed = copy(c.data);
        changed.creature.defense.hp_line = 'hp 36 (6d4+12)';
        const report = h.send('update ' + c.character.id + ' ' + h.handout(changed).id);
        assert.strictEqual(report.status, 'readback-failed');
        assert.ok(report.issues.some((item) => item.path === 'attribute.npcarmorclass.current' && item.code === 'mismatch'));
        assert.deepStrictEqual(copy(c.manifest.baseline), baseline);
        assert.ok(c.manifest.pending);
        assert.strictEqual(report.sheetCalculationsVerified, false);
    });

    test('worker completion timeout retains pending evidence and releases the lifecycle lock', (h) => {
        const c = h.create();
        const baseline = copy(c.manifest.baseline);
        h.world.suspendWorkers = true;
        const changed = copy(c.data);
        changed.creature.defense.hp_line = 'hp 36 (6d4+12)';
        const source = h.handout(changed);
        const report = h.send('update ' + c.character.id + ' ' + source.id);
        assert.strictEqual(report.status, 'partial-failure');
        assert.strictEqual(report.storedObjectsVerified, false);
        assert.deepStrictEqual(copy(c.manifest.baseline), baseline);
        assert.ok(c.manifest.pending);
        h.attr(c.character, 'recalc').set('current', 0);
        verified(h.send('audit ' + c.character.id));
        assert.strictEqual(c.manifest.revision, 2);
        assert.strictEqual(c.manifest.baseline.attributes.recalc.current, 0);
        assert.ok(!c.manifest.pending);
    });

    test('managed update retains Character, Attribute, Ability and row IDs', (h) => {
        const c = h.create();
        const beforeOwned = copy(c.manifest.owned);
        const beforeRows = copy(c.manifest.rows);
        const nextSource = h.handout(c.data);
        verified(h.send('update ' + c.character.id + ' ' + nextSource.id));
        assert.strictEqual(h.report().touched.length, 0, 'no-change update should not issue object writes');
        verified(h.send('update ' + c.character.id + ' ' + nextSource.id));
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 1);
        assert.strictEqual(c.manifest.characterId, c.character.id);
        assert.deepStrictEqual(copy(c.manifest.owned), beforeOwned);
        assert.deepStrictEqual(copy(c.manifest.rows), beforeRows);
        assert.strictEqual(c.manifest.sourceHandoutId, nextSource.id);
        assert.strictEqual(c.manifest.revision, 3);
    });

    test('source spell order and content changes retain logical row identity', (h) => {
        const c = h.create();
        const rows = copy(c.manifest.rows);
        const changed = copy(c.data);
        changed.creature.offense.spell_sections[0].groups[0].spells.reverse();
        changed.creature.offense.spell_sections[0].caster_level = '5th';
        changed.creature.offense.maneuvers[0].description = 'Changed description';
        verified(h.send('update ' + c.character.id + ' ' + h.handout(changed).id));
        assert.deepStrictEqual(copy(c.manifest.rows), rows);
    });

    test('preview uses shared mappings without mutating Roll20 objects or verified baseline', (h) => {
        const c = h.create();
        const changed = copy(c.data);
        changed.creature.defense.hp_line = 'hp 36 (6d4+12)';
        const source = h.handout(changed);
        const before = h.objects();
        const baseline = copy(c.manifest);
        const report = h.send('preview ' + c.character.id + ' ' + source.id);
        assert.strictEqual(report.status, 'preview');
        assert.strictEqual(report.plan.attributes.hitpoints.max, 36);
        assert.strictEqual(report.storedObjectsVerified, false);
        assert.deepStrictEqual(h.objects(), before);
        assert.deepStrictEqual(copy(c.manifest), baseline);
        const check = report.checks.find((item) => item.path === 'attribute.hitpoints.max');
        assert.strictEqual(check.previous, 18);
        assert.strictEqual(check.observed, 18);
        assert.strictEqual(check.expected, 36);
    });

    test('obsolete owned rows, attacks, classes and Abilities are removed; manual content survives', (h) => {
        const c = h.create();
        const removedRow = Object.keys(c.manifest.rows).find((key) => key.includes('shield'));
        const oldRowId = c.manifest.rows[removedRow];
        const manual = h.world.createObj('attribute', { characterid: c.character.id, name: 'campaign_note', current: 'Keep me' });
        const manualRowField = h.world.createObj('attribute', { characterid: c.character.id,
            name: 'repeating_spells01_' + oldRowId + '_campaignnote', current: 'Manual row annotation' });
        const ability = h.world.createObj('ability', { characterid: c.character.id, name: 'Manual Action', action: '/em hello', istokenaction: true });
        const changed = copy(c.data);
        changed.creature.header.classes = [];
        changed.creature.offense.ranged_lines = [];
        changed.creature.offense.spell_sections[0].groups[0].spells.pop();
        verified(h.send('update ' + c.character.id + ' ' + h.handout(changed).id));
        assert.ok(!h.attr(c.character, 'weapon2name'));
        assert.ok(!h.attr(c.character, 'class1'));
        assert.ok(!has(c.manifest.rows, removedRow));
        assert.ok(h.world.getObj('attribute', manual.id));
        assert.ok(h.world.getObj('attribute', manualRowField.id));
        assert.ok(h.world.getObj('ability', ability.id));
        assert.strictEqual(h.world.findObjs({ _type: 'ability', _characterid: c.character.id }).length, 2);
        verified(h.send('audit ' + c.character.id));
    });

    test('Ability content updates in place', (h) => {
        const c = h.create();
        const key = Object.keys(c.manifest.owned.abilities)[0];
        const id = c.manifest.owned.abilities[key];
        const before = h.world.getObj('ability', id).get('action');
        const changed = copy(c.data);
        changed.creature.offense.melee_lines = [attack('Melee dagger +5 (1d4+2/19-20)')];
        verified(h.send('update ' + c.character.id + ' ' + h.handout(changed).id));
        assert.strictEqual(c.manifest.owned.abilities[key], id);
        assert.notStrictEqual(h.world.getObj('ability', id).get('action'), before);
    });

    test('live play state, permissions and unowned default-token vision survive', (h) => {
        const token = h.token();
        const c = h.create(payload(), [token]);
        ['hitpoint', 'hitpoints', 'npchitpoints'].forEach((name) => h.attr(c.character, name).set('current', 4));
        const usedNames = Object.keys(c.manifest.baseline.attributes).filter((name) => /_(?:spellused|maneuverused|maneuverreadied|maneuvergranted)\d+$/.test(name));
        assert.ok(usedNames.length >= 5);
        usedNames.forEach((name) => h.attr(c.character, name).set('current', 7));
        c.character.set({ controlledby: 'player-one', inplayerjournals: 'player-two' });
        token.set({ bar1_value: 4, left: 900, top: 1000, rotation: 45, statusmarkers: 'dead',
            light_hassight: false, bright_light_distance: 30, tint_color: '#ff0000', layer: 'gmlayer' });
        const defaultData = JSON.parse(c.character._attrs._defaulttoken);
        defaultData.light_hassight = true;
        defaultData.bright_light_distance = 60;
        c.character._attrs._defaulttoken = JSON.stringify(defaultData);
        const beforeToken = copy(token.toJSON());
        const changed = copy(c.data);
        changed.creature.defense.hp_line = 'hp 36 (6d4+12)';
        verified(h.send('update ' + c.character.id + ' ' + h.handout(changed).id));
        ['hitpoint', 'hitpoints', 'npchitpoints'].forEach((name) => assert.strictEqual(h.attr(c.character, name).get('current'), 4));
        usedNames.forEach((name) => assert.strictEqual(h.attr(c.character, name).get('current'), 7));
        assert.strictEqual(h.attr(c.character, 'hitpoints').get('max'), 36);
        assert.strictEqual(c.character.get('controlledby'), 'player-one');
        assert.strictEqual(c.character.get('inplayerjournals'), 'player-two');
        assert.deepStrictEqual(copy(token.toJSON()), beforeToken);
        const saved = JSON.parse(c.character._attrs._defaulttoken);
        assert.strictEqual(saved.bar1_value, 36);
        assert.strictEqual(saved.light_hassight, true);
        assert.strictEqual(saved.bright_light_distance, 60);
        assert.strictEqual(h.report().sheetCalculationsVerified, false);
    });

    test('manual edits to managed values block the entire update and preserve baseline', (h) => {
        const c = h.create();
        h.attr(c.character, 'str').set('current', 99);
        const baseline = copy(c.manifest.baseline);
        const before = h.objects();
        const report = h.send('update ' + c.character.id + ' ' + c.source.id);
        issue(report, 'conflict');
        assert.strictEqual(report.status, 'conflict');
        assert.deepStrictEqual(h.objects(), before);
        assert.deepStrictEqual(copy(c.manifest.baseline), baseline);
        assert.strictEqual(c.manifest.revision, 1);
        const conflict = report.issues.find((item) => item.path === 'attribute.str.current');
        assert.strictEqual(conflict.expected, 12);
        assert.strictEqual(conflict.observed, 99);
    });

    test('edited owned Ability, biography, and obsolete fields conflict before cleanup', (h) => {
        const c = h.create();
        const id = Object.values(c.manifest.owned.abilities)[0];
        h.world.getObj('ability', id).set('action', '/em manually changed');
        c.character.set('bio', 'Manual biography');
        h.attr(c.character, 'weapon2name').set('current', 'Manual weapon');
        const changed = copy(c.data);
        changed.creature.offense.ranged_lines = [];
        const report = h.send('update ' + c.character.id + ' ' + h.handout(changed).id);
        assert.ok(report.issues.filter((item) => item.code === 'conflict').length >= 3);
        assert.ok(h.world.getObj('ability', id));
        assert.ok(h.attr(c.character, 'weapon2name'));
    });

    test('new mappings cannot claim an unowned Attribute or Ability', (h) => {
        const c = h.create();
        h.world.createObj('attribute', { characterid: c.character.id, name: 'class2', current: 'Manual Class' });
        h.world.createObj('ability', { characterid: c.character.id, name: 'Longsword', action: 'manual' });
        const changed = copy(c.data);
        changed.creature.header.classes.push({ name: 'fighter', level: 1 });
        changed.creature.offense.melee_lines.push(attack('Melee longsword +3 (1d8+1/19-20)'));
        const report = h.send('update ' + c.character.id + ' ' + h.handout(changed).id);
        issue(report, 'unowned-collision');
        assert.strictEqual(h.attr(c.character, 'class2').get('current'), 'Manual Class');
    });

    test('adoption explicitly claims only matching mapped objects with no sheet writes', (h) => {
        const c = h.create();
        const oldRows = copy(c.manifest.rows);
        delete h.world.state.D35StatblockImporter.characters[c.character.id];
        const before = h.objects();
        verified(h.send('adopt ' + c.character.id + ' ' + c.source.id));
        assert.deepStrictEqual(h.objects(), before);
        const adopted = h.world.state.D35StatblockImporter.characters[c.character.id];
        assert.deepStrictEqual(copy(adopted.rows), oldRows);
        verified(h.send('update ' + c.character.id + ' ' + c.source.id));
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 1);
    });

    test('adoption mismatch and ambiguous existing repeating rows are rejected', (h) => {
        const c = h.create();
        delete h.world.state.D35StatblockImporter.characters[c.character.id];
        h.attr(c.character, 'str').set('current', 99);
        issue(h.send('adopt ' + c.character.id + ' ' + c.source.id), 'adoption-mismatch');
        assert.ok(!h.world.state.D35StatblockImporter.characters[c.character.id]);
        h.attr(c.character, 'str').set('current', 12);
        const spellName = Object.keys(c.manifest.baseline.attributes).find((name) => /_spellname\d+$/.test(name));
        h.world.createObj('attribute', { characterid: c.character.id, name: spellName.replace(/_-[^_]+_/, '_-MANUALCOPY_'),
            current: h.attr(c.character, spellName).get('current') });
        assert.strictEqual(h.send('adopt ' + c.character.id + ' ' + c.source.id).status, 'blocked');
        assert.ok(!h.world.state.D35StatblockImporter.characters[c.character.id]);
    });

    test('names cannot establish ownership or target updates', (h) => {
        const c = h.create();
        const before = h.objects();
        assert.strictEqual(h.send('update LifecycleMage ' + c.source.id).status, 'blocked');
        delete h.world.state.D35StatblockImporter.characters[c.character.id];
        assert.strictEqual(h.send('update ' + c.character.id + ' ' + c.source.id).status, 'blocked');
        assert.deepStrictEqual(h.objects(), before);
        const another = h.create(c.data);
        assert.notStrictEqual(another.character.id, c.character.id);
    });

    test('token selection is unambiguous and explicit ID takes precedence', (h) => {
        const a = h.token();
        const b = h.token();
        const source = h.handout(payload());
        assert.strictEqual(h.send('import ' + source.id, [a, b]).status, 'blocked');
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 0);
        verified(h.send('import ' + source.id + ' --token ' + a.id, [a, b]));
        assert.strictEqual(a.get('represents'), h.report().characterId);
        assert.strictEqual(b.get('represents'), '');
    });

    test('binding repeats safely, preserves current HP, and portrait replacement is explicit', (h) => {
        const c = h.create();
        c.character.set('avatar', 'https://files.d20.io/images/999/portrait/med.png?1');
        const token = h.token();
        verified(h.send('bind ' + c.character.id, [token]));
        assert.strictEqual(c.character.get('avatar'), 'https://files.d20.io/images/999/portrait/med.png?1');
        token.set('bar1_value', 3);
        verified(h.send('bind ' + c.character.id + ' --token ' + token.id + ' --avatar'));
        assert.strictEqual(token.get('bar1_value'), 3);
        assert.strictEqual(token.get('bar1_link'), '');
        assert.strictEqual(token.get('bar2_link'), '');
        assert.strictEqual(c.character.get('avatar'), 'https://files.d20.io/images/12345/fixture/med.png?1');
        assert.strictEqual(JSON.parse(c.character._attrs._defaulttoken).bar1_value, 18);
        assert.strictEqual(h.world.findObjs({ _type: 'graphic' }).length, 1, 'capture graphic leaked');
    });

    test('invalid images, token types and other-Character bindings fail before mutation', (h) => {
        const source = h.handout(payload());
        const token = h.token();
        token.set('represents', '-OTHER');
        assert.strictEqual(h.send('import ' + source.id, [token]).status, 'blocked');
        token.set({ represents: '', imgsrc: '' });
        assert.strictEqual(h.send('import ' + source.id, [token]).status, 'blocked');
        token.set({ imgsrc: 'https://files.d20.io/images/12345/fixture/thumb.png?1' });
        token._attrs._subtype = 'card'; // Simulate a backend-created card, not a writable token property.
        assert.strictEqual(h.send('import ' + source.id, [token]).status, 'blocked');
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 0);
    });

    const visibilityFields = ['showname', 'showplayers_name', 'showplayers_bar1', 'showplayers_bar2'];

    [
        'https://files.d20.io/images/12345/fixture/thumb.png',
        'https://files.d20.io/marketplace/12345/fixture/thumb.png?1',
        'https://cdn.example.com/existing-token.png'
    ].forEach((image) => test('existing token image imports and binds without cloning: ' + image, (h) => {
        const token = h.token();
        token.set('imgsrc', image);
        h.world.hooks.beforeCreate = (type) => {
            if (type === 'graphic') { throw new Error('This existing image cannot be cloned by the API.'); }
        };
        const c = h.create(payload(), [token]);
        assert.strictEqual(token.get('imgsrc'), image);
        assert.strictEqual(token.get('represents'), c.character.id);
        const avatar = image.includes('/images/') ? image.replace('/thumb.', '/med.') : image;
        assert.strictEqual(c.character.get('avatar'), avatar);
        assert.strictEqual(JSON.parse(c.character._attrs._defaulttoken).imgsrc, image);
        assert.strictEqual(h.world.findObjs({ _type: 'graphic' }).length, 1);
        verified(h.send('audit ' + c.character.id));
        verified(h.send('update ' + c.character.id + ' ' + c.source.id));
        assert.strictEqual(c.character.get('avatar'), avatar);
        verified(h.send('bind ' + c.character.id, [token]));
    }));

    test('new import copies the selected library token to the avatar without a flag', (h) => {
        const token = h.token();
        const c = h.create(payload(), [token]);
        assert.strictEqual(c.character.get('avatar'), 'https://files.d20.io/images/12345/fixture/med.png?1');
        verified(h.send('audit ' + c.character.id));
    });

    test('omitted disabled saved visibility flags verify import, audit and no-change update', (h) => {
        const c = h.create(payload(), [h.token()]);
        const saved = JSON.parse(c.character._attrs._defaulttoken);
        visibilityFields.forEach((field) => {
            assert.ok(!has(saved, field), field + ' should be omitted by mock capture');
            assert.strictEqual(c.manifest.baseline.defaultToken[field], false);
            const check = h.report().checks.find((item) => item.path === 'defaultToken.' + field);
            assert.strictEqual(check.observed, null, 'report must retain the raw observation');
        });
        verified(h.send('audit ' + c.character.id));
        const before = h.objects();
        verified(h.send('update ' + c.character.id + ' ' + c.source.id));
        assert.deepStrictEqual(h.objects(), before);
        assert.strictEqual(h.report().touched.length, 0, 'omitted flags must not trigger recapture');
    });

    test('null disabled saved visibility flags verify without rewriting objects', (h) => {
        const c = h.create(payload(), [h.token()]);
        const saved = JSON.parse(c.character._attrs._defaulttoken);
        visibilityFields.forEach((field) => { saved[field] = null; });
        c.character._attrs._defaulttoken = JSON.stringify(saved);
        const before = h.objects();
        verified(h.send('audit ' + c.character.id));
        verified(h.send('update ' + c.character.id + ' ' + c.source.id));
        assert.deepStrictEqual(h.objects(), before);
        assert.strictEqual(h.report().touched.length, 0);
    });

    visibilityFields.forEach((field) => {
        [true, 'true', 1, '1'].forEach((enabled) => test('saved ' + field + '=' + JSON.stringify(enabled) + ' remains a conflict', (h) => {
            const c = h.create(payload(), [h.token()]);
            const saved = JSON.parse(c.character._attrs._defaulttoken);
            saved[field] = enabled;
            c.character._attrs._defaulttoken = JSON.stringify(saved);
            const before = h.objects();
            const report = h.send('audit ' + c.character.id);
            assert.ok(report.issues.some((item) => item.code === 'mismatch' && item.path === 'defaultToken.' + field));
            const update = h.send('update ' + c.character.id + ' ' + c.source.id);
            assert.strictEqual(update.status, 'conflict');
            assert.ok(update.issues.some((item) => item.code === 'conflict' && item.path === 'defaultToken.' + field));
            assert.deepStrictEqual(h.objects(), before);
            assert.strictEqual(c.manifest.revision, 1);
        }));

        test('bound token ' + field + ' null remains a mismatch', (h) => {
            const token = h.token();
            const c = h.create(payload(), [token]);
            token.set(field, null);
            const report = h.send('audit ' + c.character.id);
            assert.ok(report.issues.some((item) => item.code === 'mismatch' && item.path === 'token.' + field));
        });
    });

    test('null other default-token, Attribute and Ability fields remain mismatches', (h) => {
        const c = h.create(payload(), [h.token()]);
        const saved = JSON.parse(c.character._attrs._defaulttoken);
        saved.represents = null;
        c.character._attrs._defaulttoken = JSON.stringify(saved);
        h.attr(c.character, 'npcarmorclass').set('current', null);
        const key = Object.keys(c.manifest.owned.abilities)[0];
        h.world.getObj('ability', c.manifest.owned.abilities[key]).set('istokenaction', null);
        const report = h.send('audit ' + c.character.id);
        ['defaultToken.represents', 'attribute.npcarmorclass.current', 'ability.' + key + '.istokenaction'].forEach((path) => {
            assert.ok(report.issues.some((item) => item.code === 'mismatch' && item.path === path), path);
        });
    });

    test('audit recovers the old strict-readback pending import after sandbox restart without object writes', (h) => {
        // Reproduce the previous comparator against the same omitted-flag mock storage.
        const strictSource = fs.readFileSync(importer, 'utf8').replace(
            'false, sameDefaultTokenValue);', 'false, sameValue);');
        assert.notStrictEqual(strictSource, fs.readFileSync(importer, 'utf8'));
        h.world.handlers.ready = [];
        h.world.handlers['chat:message'] = [];
        load(h.world, importer, strictSource);
        const data = payload();
        data.creature.defense.hp_line = 'hp 31 (5d4+19)';
        data.creature.defense.ac_line = 'AC 16, touch 12, flat-footed 14';
        const source = h.handout(data);
        const token = h.token();
        const failed = h.send('import ' + source.id, [token]);
        assert.strictEqual(failed.status, 'readback-failed');
        assert.deepStrictEqual(copy(failed.issues).map((item) => item.path).sort(), visibilityFields.map((field) => 'defaultToken.' + field).sort());
        const character = h.world.getObj('character', failed.characterId);
        const manifest = h.world.state.D35StatblockImporter.characters[character.id];
        assert.strictEqual(manifest.baseline, null);
        assert.strictEqual(manifest.revision, 0);
        const pending = copy(manifest.pending);
        const before = h.objects();
        h.world.handlers.ready = [];
        h.world.handlers['chat:message'] = [];
        load(h.world, importer);
        h.world.hooks.beforeCreate = () => { throw new Error('Audit must not create objects'); };
        h.world.hooks.beforeSet = () => { throw new Error('Audit must not rewrite objects'); };
        h.world.hooks.beforeRemove = () => { throw new Error('Audit must not remove objects'); };
        verified(h.send('audit ' + character.id));
        assert.deepStrictEqual(h.objects(), before);
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 1);
        assert.strictEqual(manifest.characterId, character.id);
        assert.strictEqual(manifest.revision, 1);
        assert.ok(manifest.verifiedAt);
        assert.ok(!manifest.pending);
        const expectedBaseline = copy(pending.plan);
        delete expectedBaseline.bindToken;
        delete expectedBaseline.replaceAvatar;
        assert.deepStrictEqual(copy(manifest.baseline), expectedBaseline);
        assert.deepStrictEqual(copy(manifest.owned.attributes), pending.owned.attributes);
        assert.deepStrictEqual(copy(manifest.owned.abilities), pending.owned.abilities);
        assert.strictEqual(manifest.baseline.defaultToken.represents, character.id);
        assert.strictEqual(manifest.baseline.defaultToken.bar1_value, 31);
        assert.strictEqual(manifest.baseline.defaultToken.bar2_value, 16);
        verified(h.send('audit ' + character.id));
        assert.strictEqual(manifest.revision, 1, 'repeat audit must not advance an already verified baseline');
    });

    ['missing', 'incorrect'].forEach((failure) => test('default-token ' + failure + ' capture fails readback', (h) => {
        h.world.defaultCapture = failure;
        const source = h.handout(payload());
        const report = h.send('import ' + source.id, [h.token()]);
        assert.strictEqual(report.status, 'readback-failed');
        assert.strictEqual(report.storedObjectsVerified, false);
        const manifest = h.world.state.D35StatblockImporter.characters[report.characterId];
        assert.strictEqual(manifest.baseline, null);
        assert.strictEqual(manifest.revision, 0);
        assert.ok(manifest.pending);
        assert.strictEqual(h.world.findObjs({ _type: 'graphic' }).length, 1);
    }));

    test('failed update readback retains verified baseline and can be audited after correction', (h) => {
        const token = h.token();
        const c = h.create(payload(), [token]);
        const baseline = copy(c.manifest.baseline);
        const changed = copy(c.data);
        changed.creature.defense.hp_line = 'hp 36 (6d4+12)';
        const source = h.handout(changed);
        h.world.defaultCapture = 'missing';
        assert.strictEqual(h.send('update ' + c.character.id + ' ' + source.id).status, 'readback-failed');
        assert.deepStrictEqual(copy(c.manifest.baseline), baseline);
        assert.strictEqual(c.manifest.revision, 1);
        assert.strictEqual(h.send('update ' + c.character.id + ' ' + source.id).status, 'blocked');
        c.character._attrs._defaulttoken = JSON.stringify(c.manifest.pending.plan.defaultToken);
        verified(h.send('audit ' + c.character.id));
        assert.strictEqual(c.manifest.revision, 2);
        assert.ok(!c.manifest.pending);
        h.world.defaultCapture = 'normal';
        verified(h.send('update ' + c.character.id + ' ' + source.id));
    });

    test('audit detects missing, duplicate and mismatched Attributes and Abilities', (h) => {
        const c = h.create();
        h.attr(c.character, 'str').remove();
        const dex = h.attr(c.character, 'dex');
        h.world.createObj('attribute', { characterid: c.character.id, name: 'dex', current: dex.get('current'), max: '' });
        h.attr(c.character, 'npcarmorclass').set('current', 99);
        const ability = h.world.getObj('ability', Object.values(c.manifest.owned.abilities)[0]);
        h.world.createObj('ability', { characterid: c.character.id, name: ability.get('name'), action: ability.get('action'), istokenaction: true });
        const report = h.send('audit ' + c.character.id);
        issue(report, 'missing');
        issue(report, 'duplicate');
        issue(report, 'mismatch');
        assert.strictEqual(c.manifest.revision, 1);
        assert.strictEqual(report.status, 'audit-failed');
    });

    test('audit detects copied logical repeating rows', (h) => {
        const c = h.create();
        const name = Object.keys(c.manifest.baseline.attributes).find((field) => /_spellname\d+$/.test(field));
        h.world.createObj('attribute', { characterid: c.character.id, name: name.replace(/_-[^_]+_/, '_-COPY_'),
            current: c.manifest.baseline.attributes[name].current });
        issue(h.send('audit ' + c.character.id), 'duplicate-row');
    });

    test('failed removal is reported as stale and does not advance the baseline', (h) => {
        const c = h.create();
        const staleId = c.manifest.owned.attributes.weapon2name;
        const changed = copy(c.data);
        changed.creature.offense.ranged_lines = [];
        h.world.hooks.beforeRemove = (obj) => obj.id === staleId ? false : undefined;
        const report = h.send('update ' + c.character.id + ' ' + h.handout(changed).id);
        issue(report, 'stale');
        assert.strictEqual(c.manifest.revision, 1);
        issue(h.send('audit ' + c.character.id), 'stale');
    });

    test('partial write failure is journaled and retains the previous baseline', (h) => {
        const c = h.create();
        const before = copy(c.manifest.baseline);
        h.world.hooks.beforeSet = (obj) => { if (obj.get('_type') === 'attribute' && obj.get('name') === 'npcstr') { throw new Error('Injected write failure'); } };
        const changed = copy(c.data);
        changed.creature.statistics.abilities_line = changed.creature.statistics.abilities_line.replace('Str 12', 'Str 14');
        const report = h.send('update ' + c.character.id + ' ' + h.handout(changed).id);
        assert.strictEqual(report.status, 'partial-failure');
        assert.ok(report.touched.length > 0 && report.touched.length <= 5000);
        assert.ok(c.manifest.pending);
        assert.deepStrictEqual(copy(c.manifest.baseline), before);
        assert.strictEqual(c.manifest.revision, 1);
    });

    test('per-Character lock prevents overlapping updates', (h) => {
        const c = h.create();
        h.send('update ' + c.character.id + ' ' + c.source.id, [], false);
        const second = h.send('update ' + c.character.id + ' ' + c.source.id, [], false);
        assert.strictEqual(second.status, 'busy');
        h.world.flush();
        verified(h.report());
        assert.strictEqual(c.manifest.revision, 2);
    });

    test('overlapping creates on one source are locked', (h) => {
        const source = h.handout(payload());
        h.send('import ' + source.id, [], false);
        assert.strictEqual(h.send('import ' + source.id, [], false).status, 'busy');
        h.world.flush();
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 1);
    });

    test('asynchronous read timeout releases operation lock without writes', (h) => {
        const c = h.create();
        const before = h.objects();
        h.world.suspendBlobs = true;
        assert.strictEqual(h.send('update ' + c.character.id + ' ' + c.source.id).status, 'blocked');
        assert.deepStrictEqual(h.objects(), before);
        h.world.suspendBlobs = false;
        verified(h.send('update ' + c.character.id + ' ' + c.source.id));
    });

    test('state survives sandbox restart and failed pending operations remain guarded', (h) => {
        const token = h.token();
        const c = h.create(payload(), [token]);
        token.set('width', 140); // Require a new default-token capture rather than a no-op bind.
        h.world.defaultCapture = 'incorrect';
        assert.strictEqual(h.send('bind ' + c.character.id, [token]).status, 'readback-failed');
        h.world.handlers.ready = [];
        h.world.handlers['chat:message'] = [];
        load(h.world, importer);
        assert.strictEqual(h.send('update ' + c.character.id + ' ' + c.source.id).status, 'blocked');
        assert.strictEqual(c.manifest.revision, 1);
    });

    test('numeric and image URL normalization accepts equivalent stored representations', (h) => {
        const token = h.token();
        const c = h.create(payload(), [token], ' --avatar');
        h.world.findObjs({ _type: 'attribute', _characterid: c.character.id }).forEach((attr) => {
            attr.set({ current: String(attr.get('current')), max: String(attr.get('max')) });
        });
        const saved = JSON.parse(c.character._attrs._defaulttoken);
        saved.imgsrc = saved.imgsrc.replace('https://files.d20.io/', 'https://s3.amazonaws.com/files.d20.io/').replace('/thumb.', '/max.').replace('?1', '?999');
        saved.width = String(saved.width);
        c.character._attrs._defaulttoken = JSON.stringify(saved);
        c.character.set('avatar', c.character.get('avatar').replace('/med.', '/original.').replace('?1', '?20'));
        verified(h.send('audit ' + c.character.id));
    });

    test('GM authorization gates mutating commands and report exports', (h) => {
        const c = h.create();
        const before = h.objects();
        ['update ' + c.character.id + ' ' + c.source.id, 'adopt ' + c.character.id + ' ' + c.source.id,
            'bind ' + c.character.id, 'import ' + c.source.id, 'report'].forEach((command) => h.send(command, [], true, '-PLAYER'));
        assert.deepStrictEqual(h.objects(), before);
        assert.ok(h.world.chat.filter((entry) => /GM authorization is required/.test(entry.message)).length >= 5);
    });

    test('report export contains expected and observed JSON in a GM-only handout', (h) => {
        const c = h.create();
        h.send('audit ' + c.character.id);
        h.send('report');
        const reportHandout = h.world.getObj('handout', h.world.state.D35StatblockImporter.reportHandoutId);
        assert.strictEqual(reportHandout.get('inplayerjournals'), '');
        assert.strictEqual(reportHandout.get('controlledby'), '');
        assert.ok(reportHandout._attrs.gmnotes.includes('&quot;expected&quot;'));
        assert.ok(reportHandout._attrs.gmnotes.includes('&quot;observed&quot;'));
        reportHandout.set('inplayerjournals', 'all');
        const before = reportHandout._attrs.gmnotes;
        h.send('report');
        assert.strictEqual(reportHandout._attrs.gmnotes, before);
        assert.ok(h.world.chat.some((entry) => /shared manually/.test(entry.message)));
    });

    test('mock enforces asynchronous blobs and supported default-token writes', (h) => {
        const c = h.create();
        assert.throws(() => c.character.get('bio'), /callback/);
        assert.throws(() => c.character.get('_defaulttoken'), /callback/);
        assert.throws(() => c.character.set('defaulttoken', '{}'), /read-only/);
        assert.throws(() => c.character.set('_defaulttoken', '{}'), /read-only/);
        h.context.setDefaultTokenForCharacter = undefined;
        const source = h.handout(payload());
        assert.strictEqual(h.send('import ' + source.id, [h.token()]).status, 'blocked');
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 1);
    });

    test('malformed required schema sections fail preflight', (h) => {
        const data = payload();
        delete data.creature.offense;
        const report = h.send('import ' + h.handout(data).id);
        assert.strictEqual(report.status, 'blocked');
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 0);
    });

    test('newly mapped biography cannot overwrite unowned manual text', (h) => {
        const data = payload();
        delete data.creature.header.source_reference;
        data.creature.bio_notes = '';
        const c = h.create(data);
        assert.ok(!has(c.manifest.baseline.character, 'bio'));
        c.character.set('bio', 'Manual narrative');
        const changed = copy(data);
        changed.creature.header.source_reference = 'Fixture reference';
        const report = h.send('update ' + c.character.id + ' ' + h.handout(changed).id);
        issue(report, 'unowned-collision');
        assert.strictEqual(c.character._attrs.bio, 'Manual narrative');
        assert.strictEqual(c.manifest.revision, 1);
    });

    test('new row expenditure is initialized and read back on an update', (h) => {
        const c = h.create();
        const changed = copy(c.data);
        changed.creature.offense.spell_sections[0].groups[0].spells.push({ name: 'Mage Armor', raw: 'mage armor' });
        h.world.hooks.afterCreate = (obj) => {
            if (obj.get('_type') === 'attribute' && /_spellused\d+$/.test(obj.get('name'))) { obj._attrs.current = '99'; }
        };
        const report = h.send('update ' + c.character.id + ' ' + h.handout(changed).id);
        issue(report, 'mismatch');
        assert.strictEqual(report.status, 'readback-failed');
        assert.strictEqual(c.manifest.revision, 1);
    });

    test('default capture failure cleans up its temporary graphic and journals the failure', (h) => {
        const c = h.create();
        const token = h.token();
        token.set('layer', 'gmlayer'); // Force a scratch capture; the reusable policy uses objects.
        h.world.defaultCapture = 'throw';
        const report = h.send('bind ' + c.character.id, [token]);
        assert.strictEqual(report.status, 'partial-failure');
        assert.strictEqual(h.world.findObjs({ _type: 'graphic' }).length, 1);
        assert.ok(report.touched.some((entry) => entry.action === 'temporary-create'));
        assert.ok(report.touched.some((entry) => entry.action === 'temporary-remove'));
        assert.strictEqual(c.manifest.revision, 1);
    });

    test('missing token page is rejected before Character creation', (h) => {
        const token = h.token();
        h.world.getObj('page', '-MOCKPAGE').remove();
        assert.strictEqual(h.send('import ' + h.handout(payload()).id, [token]).status, 'blocked');
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 0);
    });

    test('a token rebound by another Mod after preflight is not overwritten', (h) => {
        const token = h.token();
        h.world.hooks.afterCreate = (obj) => {
            if (obj.get('_type') === 'character') { token.set('represents', '-OTHER-CHARACTER'); }
        };
        const report = h.send('import ' + h.handout(payload()).id, [token]);
        assert.strictEqual(report.status, 'partial-failure');
        assert.strictEqual(token.get('represents'), '-OTHER-CHARACTER');
        const manifest = h.world.state.D35StatblockImporter.characters[report.characterId];
        assert.ok(manifest.pending);
        assert.strictEqual(manifest.baseline, null);
    });

    test('array-shaped required sections are rejected before mutation', (h) => {
        const data = payload();
        data.creature.offense = [];
        assert.strictEqual(h.send('import ' + h.handout(data).id).status, 'blocked');
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 0);
    });

    test('legacy import retains exact handout-name spacing', (h) => {
        const source = h.handout(payload());
        source.set('name', 'Fixture  with  double spaces');
        verified(h.send('import Fixture  with  double spaces'));
        assert.strictEqual(h.world.findObjs({ _type: 'character' }).length, 1);
    });

    test('special-spell usage groups have stable independent row identities', (h) => {
        const data = payload();
        data.creature.offense.spell_sections.push({ type: 'Spell-Like Abilities', caster_level: '3rd', groups: [
            { label: 'At will', spells: [{ name: 'Detect Magic', raw: 'detect magic' }] },
            { label: '3/day', spells: [{ name: 'Detect Magic', raw: 'detect magic' }] }
        ] });
        const c = h.create(data);
        const rows = copy(c.manifest.rows);
        const keys = Object.keys(rows).filter((key) => key.includes('detect magic'));
        assert.strictEqual(keys.length, 2);
        assert.ok(keys.some((key) => key.includes('at will')));
        assert.ok(keys.some((key) => key.includes('3/day')));
        const changed = copy(data);
        changed.creature.offense.spell_sections[1].groups.reverse();
        verified(h.send('update ' + c.character.id + ' ' + h.handout(changed).id));
        assert.deepStrictEqual(copy(c.manifest.rows), rows);
    });

    test('graphic creation rejects read-only properties and requires a valid create-time pageid', (h) => {
        const props = { pageid: '-MOCKPAGE', imgsrc: 'https://files.d20.io/images/12345/fixture/thumb.png?1' };
        ['_pageid', '_id', '_type', '_subtype', '_cardid', 'id', 'type', 'subtype', 'cardid'].forEach((field) => {
            assert.throws(() => h.world.createObj('graphic', { ...props, [field]: 'forbidden' }), /Read-only graphic/);
        });
        [undefined, '', '-MISSING', 42].forEach((pageid) => {
            assert.throws(() => h.world.createObj('graphic', { imgsrc: props.imgsrc, pageid }), /valid pageid/);
        });
        assert.strictEqual(h.world.findObjs({ _type: 'graphic' }).length, 0);
        const graphic = h.world.createObj('graphic', props);
        assert.strictEqual(graphic.get('_pageid'), '-MOCKPAGE');
        assert.strictEqual(graphic.get('_subtype'), 'token');
        assert.ok(!has(graphic.toJSON(), 'pageid'), 'Store the parent using live Roll20 _pageid semantics');
    });

    test('scratch capture strips read-only metadata and preserves every writable unowned saved setting', (h) => {
        const token = h.token();
        const c = h.create(payload(), [token]);
        const unowned = {
            light_hassight: true, light_radius: '60', light_dimradius: '20',
            emits_bright_light: true, bright_light_distance: 40, emits_low_light: true, low_light_distance: 20,
            has_bright_light_vision: true, has_night_vision: true, night_vision_distance: 90,
            light_sensitivity_multiplier: 100, aura1_radius: '5', aura1_color: '#00ff00',
            tooltip: 'Keep this tooltip', show_tooltip: true, bar3_value: 'manual', bar3_max: '7',
            bar3_link: '', rotation: 17, fliph: true, isdrawing: false, statusmarkers: 'blue',
            gmnotes: 'Unowned default-token notes: Ω', controlledby: 'test-player'
        };
        const readOnly = { _id: '-OLD-ID', id: '-OLD-ID', _type: 'graphic', type: 'graphic',
            _pageid: '-OLD-PAGE', _subtype: 'token', subtype: 'token', _cardid: '-OLD-CARD', cardid: '-OLD-CARD' };
        c.character._attrs._defaulttoken = JSON.stringify({ ...JSON.parse(c.character._attrs._defaulttoken), ...unowned, ...readOnly });
        let captureProps;
        h.world.hooks.beforeCreate = (type, attrs) => { if (type === 'graphic') { captureProps = copy(attrs); } };
        const encounterBefore = copy(token.toJSON());
        const changed = copy(c.data);
        changed.creature.defense.hp_line = 'hp 36 (6d4+12)';
        verified(h.send('update ' + c.character.id + ' ' + h.handout(changed).id));
        assert.ok(captureProps, 'Changing reusable HP must actually exercise scratch capture');
        assert.strictEqual(captureProps.pageid, '-MOCKPAGE');
        Object.keys(readOnly).forEach((field) => assert.ok(!has(captureProps, field), field + ' leaked into createObj'));
        const saved = JSON.parse(c.character._attrs._defaulttoken);
        Object.keys(unowned).forEach((field) => {
            assert.deepStrictEqual(captureProps[field], unowned[field], field + ' changed before capture');
            assert.deepStrictEqual(saved[field], unowned[field], field + ' changed in saved token');
        });
        assert.strictEqual(saved._pageid, '-MOCKPAGE');
        assert.strictEqual(saved.bar1_value, 36);
        assert.deepStrictEqual(copy(token.toJSON()), encounterBefore);
        assert.strictEqual(h.world.findObjs({ _type: 'graphic' }).length, 1, 'Scratch graphic must be removed');
        verified(h.send('bind ' + c.character.id, [token]));
        const rebound = JSON.parse(c.character._attrs._defaulttoken);
        Object.keys(unowned).forEach((field) => assert.deepStrictEqual(rebound[field], unowned[field]));
    });

    test('footprint measurement counts only the importer namespace and does not mutate state', (h) => {
        const data = payload();
        data.creature.name = data.creature.header.name = 'Mage Ω 🐉';
        h.create(data);
        h.create();
        h.world.state.OtherMod = { unrelated: 'x'.repeat(10000) };
        const before = JSON.stringify(h.world.state);
        const namespace = h.world.state.D35StatblockImporter;
        const json = JSON.stringify(namespace);
        const measured = measureStateFootprint(namespace);
        assert.strictEqual(measured.managedCharacters, 2);
        assert.strictEqual(measured.total.utf8Bytes, Buffer.byteLength(json, 'utf8'));
        assert.strictEqual(measured.total.utf16CodeUnits, json.length);
        assert.ok(measured.total.utf8Bytes > measured.total.utf16CodeUnits);
        assert.strictEqual(measured.lastReport.utf8Bytes, Buffer.byteLength(JSON.stringify(namespace.lastReport), 'utf8'));
        assert.strictEqual(measured.averageStatePerCharacter.utf8Bytes, measured.total.utf8Bytes / 2);
        const sizes = Object.values(namespace.characters).map((manifest) => Buffer.byteLength(JSON.stringify(manifest), 'utf8'));
        assert.strictEqual(measured.largestManifest.utf8Bytes, Math.max(...sizes));
        assert.strictEqual(measured.fixedNamespaceAndReportOverhead.utf8Bytes +
            measured.averageCharacterEntry.utf8Bytes * 2 + 1, measured.total.utf8Bytes);
        assert.deepStrictEqual(measured.projection.estimates.map((entry) => entry.managedCharacters), [50, 100, 200]);
        assert.strictEqual(JSON.stringify(h.world.state), before);
    });

    console.log('Managed lifecycle tests passed: ' + count + ' scenario(s).');
    return count;
}

function has(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }

module.exports = { runLifecycleTests };
