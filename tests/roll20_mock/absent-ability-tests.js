'use strict';

const assert = require('assert');

function runAbsentAbilityTests(test, payload, verified) {
    const copy = (value) => JSON.parse(JSON.stringify(value));
    function absentPayload(ability = 'Int', notation = '-') {
        const data = payload();
        data.creature.statistics.abilities_line = data.creature.statistics.abilities_line.replace(new RegExp(ability + ' \\d+'), ability + ' ' + notation);
        return data;
    }
    function stored(h, id, name) { return h.world.findObjs({_type:'attribute', characterid:id, name})[0]; }
    function emulatePlaceholder(h, ability) {
        h.world.emulateRecalc = true;
        h.world.hooks.sheetWorker = (attr) => stored(h, attr.get('characterid'), ability).set('current', 10);
    }

    ['Str','Dex','Con','Int','Wis','Cha'].forEach((ability) => test('absent ' + ability + ' permits corroborated PC placeholder and unchanged updates do no writes', (h) => {
        const key = ability.toLowerCase();
        emulatePlaceholder(h, key);
        const c = h.create(absentPayload(ability));
        assert.strictEqual(h.report().checks.find((check) => check.path === 'attribute.'+key+'.current').representation,
            'corroborated-absent-ability-placeholder');
        assert.strictEqual(h.attr(c.character,key).get('current'), 10);
        assert.strictEqual(h.attr(c.character,'npc'+key).get('current'), '');
        assert.strictEqual(h.attr(c.character,key+'-base').get('current'), '');
        assert.ok(h.attr(c.character,'other').get('current').includes(ability + ' \u2014'));
        const before = h.objects(), owned = JSON.stringify(c.manifest.owned);
        verified(h.send('audit '+c.character.id));
        assert.strictEqual(h.send('preview '+c.character.id+' '+c.source.id).status, 'preview');
        verified(h.send('update '+c.character.id+' '+c.source.id));
        assert.strictEqual(h.report().touched.length, 0);
        assert.deepStrictEqual(h.objects(), before);
        assert.strictEqual(JSON.stringify(c.manifest.owned), owned);
        h.attr(c.character,key).set('current', 11);
        assert.ok(h.send('audit '+c.character.id).issues.some((issue) => issue.path === 'attribute.'+key+'.current'));
        const edited = h.objects();
        assert.strictEqual(h.send('update '+c.character.id+' '+c.source.id).status, 'conflict');
        assert.deepStrictEqual(h.objects(), edited);
    }));

    test('legacy blank Intelligence pending import recovers with audit in place, preserving every object', (h) => {
        const source = h.handout(absentPayload('Int',''));
        h.world.hooks.sheetWorker = (attr) => stored(h,attr.get('characterid'),'int').set('current', 11);
        const failed = h.send('import '+source.id,[h.token()]);
        assert.strictEqual(failed.status,'readback-failed');
        const id = failed.characterId, manifest = h.world.state.D35StatblockImporter.characters[id];
        manifest.importerVersion = '0.6.0';
        manifest.pending.plan.attributes.other.current = ''; // The legacy plan did not have the new explanatory note.
        stored(h,id,'other').set('current','');
        stored(h,id,'int').set('current',10); // Exact value observed in the live failure report.
        const before = h.objects(), pendingOwned = copy(manifest.pending.owned);
        verified(h.send('audit '+id));
        assert.deepStrictEqual(h.objects(),before);
        assert.ok(!manifest.pending);
        assert.strictEqual(manifest.revision,1);
        assert.deepStrictEqual(copy(manifest.owned.attributes),pendingOwned.attributes);
        assert.deepStrictEqual(copy(manifest.owned.abilities),pendingOwned.abilities);
        assert.strictEqual(h.world.findObjs({_type:'character'}).length,1);
        assert.strictEqual(manifest.baseline.attributes.int.current,'');
        verified(h.send('audit '+id));
    });

    ['int-base','npcint','int-mod','npcint-mod','int.max','duplicate-base','missing-base'].forEach((failure) =>
        test('placeholder exception retains strict guard for '+failure, (h) => {
            emulatePlaceholder(h,'int');
            const c = h.create(absentPayload());
            if (failure === 'int.max') { h.attr(c.character,'int').set('max',10); }
            else if (failure === 'duplicate-base') { h.world.createObj('attribute',{characterid:c.character.id,name:'int-base',current:''}); }
            else if (failure === 'missing-base') { h.attr(c.character,'int-base').remove(); }
            else { h.attr(c.character,failure).set('current', failure.includes('mod') ? 1 : 10); }
            const before = h.objects();
            const report = h.send('audit '+c.character.id);
            assert.strictEqual(report.status,'audit-failed');
            if (failure !== 'int.max') { assert.ok(report.issues.some((issue) => issue.path==='attribute.int.current')); }
            assert.deepStrictEqual(h.objects(),before);
        }));

    test('numeric Intelligence and ordinary empty attributes never receive the placeholder exception', (h) => {
        const c = h.create();
        h.attr(c.character,'int').set('current',10);
        h.attr(c.character,'gender').set('current',10);
        const report = h.send('audit '+c.character.id);
        ['attribute.int.current','attribute.gender.current'].forEach((path) => assert.ok(report.issues.some((issue) => issue.path===path)));
    });
}

module.exports = { runAbsentAbilityTests };
