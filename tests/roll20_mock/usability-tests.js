'use strict';

const assert = require('assert');
const vm = require('vm');

function set(h, c, name, value) {
    const attr = h.attr(c.character, name);
    if (attr) { attr.set('current', value); }
    else { h.world.createObj('attribute', { characterid: c.character.id, name, current: value }); }
}

function click(h, c, key) {
    const ability = h.world.getObj('ability', c.manifest.owned.abilities[key]);
    const start = h.world.chat.length;
    h.send(ability.get('action').replace('@{character_id}', c.character.id).replace(/^!d35import /, ''));
    return h.world.chat.slice(start).filter((entry) => entry.who === 'character|' + c.character.id).map((entry) => {
        // API-originated chat must be roll-ready without the test harness
        // performing attribute substitution that Roll20 did not perform live.
        assert.ok(!entry.message.includes('@{'), entry.message);
        assert.ok(!entry.message.includes(c.character.id), entry.message);
        return entry.message;
    }).join('\n');
}

// Independent deterministic roll oracle: substitute each die with 1 or its
// maximum, resolve live attributes recursively, then evaluate arithmetic only.
function values(h, c, macro, field, maximum) {
    function expand(text, depth = 0) {
        assert.ok(depth < 15, 'recursive test attribute');
        return text.replace(/@\{(?:[^|}]+\|)?([^}]+)\}/g, (all, name) =>
            '(' + expand(String(h.world.getAttrByName(c.character.id, name) || 0), depth + 1) + ')');
    }
    const pattern = new RegExp('\\{\\{' + field + '\\d+=[\\s\\S]*?\\[\\[([\\s\\S]*?)\\]\\]', 'g');
    return [...macro.matchAll(pattern)].map((match) => {
        const expression = expand(match[1]).replace(/\[[^\]]*\]/g, '')
            .replace(/(\d*)d(\d+)(?:cs>\d+)?/g, (all, count, sides) => Number(count || 1) * (maximum ? Number(sides) : 1))
            .replace(/\b(floor|ceil|round|abs)\(/g, 'Math.$1(');
        assert.match(expression, /^[\d\s.+*/()\-Mathfloorceibsun]+$/);
        return vm.runInNewContext(expression, { Math });
    });
}

function runUsabilityTests(test, payload, verified) {
    test('one-command uppercase alias and spaced handout configures all stored objects', (h) => {
        const source = h.handout(payload()); source.set('name', 'Example Mage With Spaces');
        const token = h.token();
        h.world.trigger('chat:message', { type: 'api', playerid: '-MOCKGM', content: '!D35 Example Mage With Spaces',
            selected: [{ _type: 'graphic', _id: token.id }] });
        h.world.flush();
        const report = h.report(); verified(report);
        const character = h.world.getObj('character', report.characterId);
        assert.ok(character.get('avatar').includes('/med.png'));
        assert.strictEqual(token.get('represents'), character.id);
        const saved = JSON.parse(character._attrs._defaulttoken);
        for (const object of [token.toJSON(), saved]) {
            assert.strictEqual(object.represents, character.id);
            assert.strictEqual(Number(object.bar1_value), 18);
            assert.strictEqual(Number(object.bar1_max), 18);
            assert.strictEqual(Number(object.bar2_value), 15);
            // Roll20 omits disabled flags from the saved blob; token properties
            // themselves must be explicitly false.
            ['showname', 'showplayers_name', 'showplayers_bar1', 'showplayers_bar2'].forEach((field) => assert.strictEqual(object[field] === undefined ? false : object[field], false));
        }
        assert.ok(h.world.findObjs({ _type: 'ability', characterid: character.id }).some((ability) => ability.get('istokenaction')));
        assert.strictEqual(report.storedObjectsVerified, true);
    });

    ['none', 'multiple', 'missing', 'drawing', 'image', 'dimensions', 'ambiguous', 'invalid-json', 'bound'].forEach((failure) =>
        test('simple import rejects ' + failure + ' before creating a Character', (h) => {
            const source = h.handout(payload()); source.set('name', 'Safe Import');
            const token = h.token(); let selection = [{ _type: 'graphic', _id: token.id }];
            if (failure === 'none') { selection = []; }
            if (failure === 'multiple') { selection.push({ _type: 'graphic', _id: h.token().id }); }
            if (failure === 'missing') { selection[0]._id = '-MISSING'; }
            if (failure === 'drawing') { selection[0]._type = 'path'; }
            if (failure === 'image') { token.set('imgsrc', 'data:image/png;base64,invalid'); }
            if (failure === 'dimensions') { token.set('width', 0); }
            if (failure === 'ambiguous') { const duplicate = h.handout(payload()); duplicate.set({name:'Safe Import', gmnotes:'invalid'}); }
            if (failure === 'invalid-json') { source.set('gmnotes', '{bad json'); }
            if (failure === 'bound') { token.set('represents', '-ANOTHER'); }
            const before = h.objects();
            h.world.trigger('chat:message', { type:'api', playerid:'-MOCKGM', content:'!D35 Safe Import', selected:selection });
            h.world.flush();
            assert.deepStrictEqual(h.objects(), before);
            assert.strictEqual(h.world.findObjs({_type:'character'}).length, 0);
            assert.ok(h.world.chat.length);
        }));

    [true, false].forEach((sourcePresent) => test('source-only biography migrates legacy owned text, source=' + sourcePresent, (h) => {
        const data = payload();
        if (sourcePresent) { data.creature.header.source_reference = 'Dungeon Magazine #143, page 42'; }
        else { delete data.creature.header.source_reference; }
        data.creature.bio_notes = 'Unclassified rule: deal +2 damage against marked foes.\n\nPoison (Ex) Fort DC 14 negates.';
        const c = h.create(data);
        const reference = sourcePresent ? 'Source: Dungeon Magazine #143, page 42' : '';
        assert.strictEqual(c.character._attrs.bio || '', reference);
        assert.strictEqual(h.attr(c.character, 'npcdescr').get('current'), reference);
        assert.ok(h.attr(c.character, 'other').get('current').includes('marked foes'));
        assert.ok(h.attr(c.character, 'racialabilities').get('current').includes('Fort DC 14'));
        // Simulate the verified legacy mapper owning excessive text.
        c.character.set('bio', 'Legacy stat block');
        h.attr(c.character, 'npcdescr').set('current', 'Legacy stat block');
        c.manifest.baseline.character.bio = 'Legacy stat block';
        if (!c.manifest.owned.characterFields.includes('bio')) { c.manifest.owned.characterFields.push('bio'); }
        c.manifest.baseline.attributes.npcdescr.current = 'Legacy stat block';
        const owned = JSON.stringify(c.manifest.owned);
        verified(h.send('update ' + c.character.id + ' ' + c.source.id));
        assert.strictEqual(c.character._attrs.bio, reference);
        assert.strictEqual(h.attr(c.character, 'npcdescr').get('current'), reference);
        assert.strictEqual(JSON.stringify(c.manifest.owned), owned);
        assert.strictEqual(h.world.findObjs({_type:'character'}).length, 1);
        c.character.set('bio', 'Manual narrative');
        const before = h.objects();
        assert.strictEqual(h.send('update ' + c.character.id + ' ' + c.source.id).status, 'conflict');
        assert.deepStrictEqual(h.objects(), before);
    }));

    const scenarios = [
        { name:'melee iterative', line:'Melee +2 longsword +12/+7 (1d8+6/19-20)', key:'+2 longsword', bonuses:[12,7], dice:[1,8], flat:6, crit:2, threat:19 },
        { name:'ranged', line:'Ranged longbow +8/+3 (1d8+2/x3)', key:'longbow', bonuses:[8,3], dice:[1,8], flat:2, crit:3, threat:20 },
        { name:'natural full attack', line:'Melee 2 claws +9 (1d6+4)', key:'claw full attack', bonuses:[9,9], dice:[1,6], flat:4, crit:2, threat:20 },
        { name:'five iteratives', line:'Melee tentacle +15/+10/+5/+0/-5 (2d6+4)', key:'tentacle', bonuses:[15,10,5,0,-5], dice:[2,6], flat:4, crit:2, threat:20 }
    ];
    scenarios.forEach((s) => test('roll mathematics match source and unfiltered template: ' + s.name, (h) => {
        const data = payload();
        data.creature.offense.melee_lines = s.line.startsWith('Melee') ? [{raw:s.line, fragments:[{raw:s.line.slice(6)}]}] : [];
        data.creature.offense.ranged_lines = s.line.startsWith('Ranged') ? [{raw:s.line, fragments:[{raw:s.line.slice(7)}]}] : [];
        const c = h.create(data);
        const key = Object.keys(c.manifest.baseline.attackMacros).find((name) => name === s.key);
        assert.ok(key, JSON.stringify(Object.keys(c.manifest.baseline.attackMacros)));
        const original = c.manifest.baseline.attackMacros[key];
        const compact = click(h, c, key);
        assert.ok(compact.includes('cs>' + s.threat));
        assert.ok(!compact.includes('0[Weapon Enh]'));
        [false, true].forEach((maximum) => {
            const damage = s.dice[0] * (maximum ? s.dice[1] : 1) + s.flat;
            assert.deepStrictEqual(values(h,c,compact,'attack',maximum), s.bonuses.map((bonus) => bonus + (maximum ? 20 : 1)));
            assert.deepStrictEqual(values(h,c,compact,'critconfirm',maximum), values(h,c,compact,'attack',maximum));
            assert.deepStrictEqual(values(h,c,compact,'damage',maximum), s.bonuses.map(() => damage));
            assert.deepStrictEqual(values(h,c,compact,'critdmg',maximum), s.bonuses.map(() => damage * (s.crit - 1)));
            ['attack','damage','critconfirm','critdmg'].forEach((field) => assert.deepStrictEqual(values(h,c,compact,field,maximum), values(h,c,original,field,maximum)));
        });
        const ids = JSON.stringify(c.manifest.owned.abilities);
        set(h,c,'globalAttackBonus', 2); set(h,c,'globalDamageBonus', 3);
        set(h,c,'combatExpertiseAttackBonus', -4); set(h,c,'combatExpertiseEnabled', 1);
        const conditional = click(h,c,key);
        assert.deepStrictEqual(values(h,c,conditional,'attack',false), s.bonuses.map((bonus) => bonus - 1));
        assert.deepStrictEqual(values(h,c,conditional,'damage',false), s.bonuses.map(() => s.dice[0] + s.flat + 3));
        assert.deepStrictEqual(values(h,c,conditional,'critdmg',false), s.bonuses.map(() => (s.dice[0] + s.flat + 3) * (s.crit - 1)));
        // Runtime modifier changes require neither an update nor new Ability IDs.
        assert.strictEqual(JSON.stringify(c.manifest.owned.abilities), ids);
    }));

    test('unsupported conditional formulas fail visibly and legacy Ability IDs survive regeneration', (h) => {
        const c = h.create();
        const ability = h.world.getObj('ability', c.manifest.owned.abilities.dagger);
        const originalId = ability.id;
        const legacy = c.manifest.baseline.attackMacros.dagger;
        ability.set('action', legacy);
        c.manifest.baseline.abilities.dagger.action = legacy;
        verified(h.send('update ' + c.character.id + ' ' + c.source.id));
        assert.strictEqual(c.manifest.owned.abilities.dagger, originalId);
        assert.ok(ability.get('action').startsWith('!d35import roll '));
        assert.strictEqual(h.world.findObjs({_type:'ability', characterid:c.character.id, name:'Dagger'}).length, 1);
        ['?{Situational bonus|0}', '@{Other Character|situational}', '@{globalAttackBonus}', '1d6'].forEach((formula) => {
            set(h,c,'globalAttackBonus', formula);
            assert.strictEqual(click(h,c,'dagger'), '');
            assert.ok(h.world.chat.at(-1).message.includes('Cannot evaluate attack modifier'));
        });
        set(h,c,'globalAttackBonus', 'floor(@{situational}/2)');
        set(h,c,'situational', 0);
        assert.ok(!click(h,c,'dagger').includes('[Global bonus]'));
        set(h,c,'situational', 5);
        assert.strictEqual(values(h,c,click(h,c,'dagger'),'attack',false)[0], 5);
    });

    test('unchecked Smite and bardic music add nothing; enabling them affects attack, confirmation and damage', (h) => {
        const c = h.create();
        const original = click(h,c,'dagger');
        const baseline = field => values(h,c,original,field,false)[0];
        set(h,c,'smiteEvilAttackBonus',2); set(h,c,'smiteEvilDamageBonus',3);
        set(h,c,'bardicMusicAttackBonus',1); set(h,c,'bardicMusicDamageBonus',1);
        [false,true,false].forEach(enabled => {
            set(h,c,'smiteEvilBonusEnabled',enabled ? 1 : 0);
            set(h,c,'bardicMusicBonusEnabled',enabled ? 1 : 0);
            const macro = click(h,c,'dagger');
            ['attack','critconfirm','damage','critdmg'].forEach(field => {
                const extra = enabled ? (/^(attack|critconfirm)$/.test(field) ? 3 : 4) : 0;
                assert.strictEqual(values(h,c,macro,field,false)[0],baseline(field)+extra);
            });
        });
    });

    test('ranged attacks exclude melee conditions while later ranged toggles affect rolls', (h) => {
        const c = h.create();
        const key = 'light crossbow';
        set(h,c,'flankEnabled', 2); set(h,c,'higherGroundEnabled', 1);
        set(h,c,'rapidShotEnabled', 1); set(h,c,'rapidShotAttackBonus', -2);
        const macro = click(h,c,key);
        assert.ok(!macro.includes('[Flank]') && !macro.includes('[Higher Ground]'));
        assert.ok(macro.includes('[Rapid]'));
        assert.deepStrictEqual(values(h,c,macro,'attack',false), [2]);
    });

    test('live Ochre Jelly attack contains labeled numbers and needs no chat attribute expansion', (h) => {
        const data = payload();
        data.creature.name = data.creature.header.name = 'Ochre Jelly';
        data.creature.header.alignment_size_type = 'Always neutral Large ooze';
        data.creature.statistics.abilities_line = 'Abilities Str 15, Dex 1, Con 22, Int -, Wis 1, Cha 1';
        data.creature.offense.base_attack_line = 'Base Atk +4; Grp +10';
        data.creature.offense.melee_lines = [{raw:'Melee slam +5 (2d4+3 plus 1d4 acid)',fragments:[{raw:'slam +5 (2d4+3 plus 1d4 acid)'}]}];
        data.creature.offense.ranged_lines = [];
        const c = h.create(data);
        const macro = click(h,c,'slam');
        assert.ok(macro.includes('4[BAB] + 2[Strength] - 1[Size]'), macro);
        assert.ok(macro.includes('2d4[Dmg] + 3[Strength damage]'), macro);
        assert.deepStrictEqual(values(h,c,macro,'attack',false), [6]);
        assert.deepStrictEqual(values(h,c,macro,'damage',false), [5]);
        assert.deepStrictEqual(values(h,c,macro,'critdmg',false), [5]);
        assert.ok(macro.includes('plus 1d4 acid'));
        set(h,c,'globalAttackBonus',2);
        assert.deepStrictEqual(values(h,c,click(h,c,'slam'),'attack',false),[8]);
    });
}

module.exports = { runUsabilityTests };
