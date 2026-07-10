'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRoll20Mock } = require('./roll20-sandbox-mock');

const repoRoot = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
    const options = {
        importer: path.join(repoRoot, 'D35_Statblock_Importer.js'),
        jsonDir: path.join(repoRoot, 'Converted JSON'),
        limit: 0,
        verbose: false
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--importer') {
            options.importer = path.resolve(argv[++i]);
        } else if (arg === '--json-dir') {
            options.jsonDir = path.resolve(argv[++i]);
        } else if (arg === '--limit') {
            options.limit = Number(argv[++i]) || 0;
        } else if (arg === '--verbose') {
            options.verbose = true;
        } else if (arg === '--help') {
            options.help = true;
        } else {
            throw new Error('Unknown argument: ' + arg);
        }
    }
    return options;
}

function printHelp() {
    console.log([
        'Usage: node tests/roll20_mock/run-importer-tests.js [options]',
        '',
        'Options:',
        '  --importer <path>   Roll20 importer script. Defaults to D35_Statblock_Importer.js.',
        '  --json-dir <path>   Directory of *.json payloads. Defaults to Converted JSON.',
        '  --limit <count>     Test only the first N payloads.',
        '  --verbose           Print each imported creature.'
    ].join('\n'));
}

function readJsonFiles(jsonDir, limit) {
    const files = fs.readdirSync(jsonDir)
        .filter((name) => name.toLowerCase().endsWith('.json'))
        .sort()
        .map((name) => path.join(jsonDir, name));

    if (!files.length) {
        throw new Error('No JSON files found in ' + jsonDir);
    }

    return limit > 0 ? files.slice(0, limit) : files;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function loadImporter(world, importerPath) {
    const context = {
        console,
        Date,
        JSON,
        Math,
        RegExp,
        String,
        Number,
        Boolean,
        Array,
        Object,
        parseInt,
        parseFloat,
        isNaN,
        encodeURIComponent,
        decodeURIComponent
    };
    Object.assign(context, world.globals());
    context.global = context;

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(importerPath, 'utf8'), context, {
        filename: importerPath
    });
    world.trigger('ready', {});
    return context;
}

function attrsFor(world, characterId) {
    const result = {};
    world.findObjs({ _type: 'attribute', characterid: characterId }).forEach((attr) => {
        result[attr.get('name')] = {
            current: attr.get('current'),
            max: attr.get('max')
        };
    });
    return result;
}

function abilitiesFor(world, characterId) {
    return world.findObjs({ _type: 'ability', characterid: characterId });
}

function attrCurrent(attrs, name) {
    return attrs[name] ? attrs[name].current : undefined;
}

function spellNameAttrs(attrs) {
    return Object.keys(attrs)
        .filter((name) => /^repeating_spells\d+_.+_spellname\d+$/.test(name))
        .map((name) => String(attrs[name].current || ''))
        .filter(Boolean);
}

function spellPrepAttrs(attrs) {
    return Object.keys(attrs)
        .filter((name) => /^repeating_spells\d+_.+_spellprep\d+$/.test(name))
        .map((name) => attrs[name].current);
}

function expectedSpellCount(payload) {
    const sections = payload.creature && payload.creature.offense && payload.creature.offense.spell_sections || [];
    return sections.reduce((total, section) => {
        return total + (section.groups || []).reduce((groupTotal, group) => {
            return groupTotal + (group.spells || []).length;
        }, 0);
    }, 0);
}

function hasSpellbook(payload) {
    const spellbook = payload.creature && payload.creature.statistics && payload.creature.statistics.spellbook;
    return Array.isArray(spellbook) && spellbook.length > 0;
}

function createHandout(world, name, jsonText) {
    const handout = world.createObj('handout', {
        name,
        notes: '',
        gmnotes: jsonText
    });
    return handout;
}

function createToken(world) {
    return world.createObj('graphic', {
        _pageid: '-MOCKPAGE',
        subtype: 'token',
        imgsrc: 'https://files.d20.io/images/123456/thumb.png?1',
        width: 70,
        height: 70,
        layer: 'objects',
        light_hassight: false,
        tint_color: 'transparent'
    });
}

function importPayload(world, payload, sourceName) {
    const handoutName = 'Import Test - ' + sourceName;
    const token = createToken(world);
    const beforeCharacters = world.findObjs({ _type: 'character' }).length;
    const handout = createHandout(world, handoutName, JSON.stringify(payload));

    world.trigger('chat:message', {
        type: 'api',
        playerid: '-MOCKGM',
        content: '!d35import import ' + handout.id,
        selected: [{ _id: token.id, _type: 'graphic' }]
    });

    const characters = world.findObjs({ _type: 'character' });
    assert.strictEqual(
        characters.length,
        beforeCharacters + 1,
        sourceName + ': expected exactly one new character'
    );
    return {
        character: characters[characters.length - 1],
        token
    };
}

function assertImport(world, payload, filePath) {
    const sourceName = path.basename(filePath);
    const expectedName = payload.creature && payload.creature.name;
    const expectedCr = payload.creature && payload.creature.cr;
    const defense = payload.creature && payload.creature.defense || {};
    const offense = payload.creature && payload.creature.offense || {};
    const imported = importPayload(world, payload, sourceName);
    const character = imported.character;
    const attrs = attrsFor(world, character.id);
    const abilities = abilitiesFor(world, character.id);
    const tokenActions = abilities.filter((ability) => ability.get('istokenaction') === true);
    const weaponLineCount = []
        .concat(offense.melee_lines || [])
        .concat(offense.ranged_lines || []).length;

    assert.strictEqual(character.get('name'), expectedName, sourceName + ': character name mismatch');
    assert.strictEqual(String(attrCurrent(attrs, 'npccr') || ''), String(expectedCr || ''), sourceName + ': CR mismatch');
    assert.ok(attrCurrent(attrs, 'npcarmorclass'), sourceName + ': missing NPC AC');
    assert.ok(attrCurrent(attrs, 'npchitpoints'), sourceName + ': missing NPC HP');
    assert.ok(attrCurrent(attrs, 'npcfortsave') !== undefined, sourceName + ': missing Fort save');
    assert.ok(attrCurrent(attrs, 'npcrefsave') !== undefined, sourceName + ': missing Ref save');
    assert.ok(attrCurrent(attrs, 'npcwillsave') !== undefined, sourceName + ': missing Will save');
    assert.ok(attrCurrent(attrs, 'npctreasure') !== undefined, sourceName + ': missing possessions/treasure attribute');
    assert.ok(imported.token.get('represents') === character.id, sourceName + ': selected token was not bound');
    assert.ok(imported.token.get('bar1_value'), sourceName + ': token HP bar was not set');
    assert.ok(imported.token.get('bar2_value'), sourceName + ': token AC bar was not set');

    if ((defense.hp_line || '').trim()) {
        assert.ok(Number(attrCurrent(attrs, 'npchitpoints')) > 0, sourceName + ': HP did not parse to a positive number');
    }

    if (weaponLineCount > 0) {
        assert.ok(tokenActions.length > 0, sourceName + ': expected at least one token action for weapon attacks');
    }

    assert.ok(
        tokenActions.some((ability) => /^initiative$/i.test(ability.get('name'))),
        sourceName + ': missing Initiative token action'
    );

    const expectedSpells = expectedSpellCount(payload);
    if (expectedSpells > 0 || hasSpellbook(payload)) {
        assert.ok(spellNameAttrs(attrs).length > 0, sourceName + ': expected spell attributes');
    }

    if (hasSpellbook(payload)) {
        assert.ok(
            spellPrepAttrs(attrs).some((value) => String(value) === '0'),
            sourceName + ': spellbook spells should include unprepared entries'
        );
    }
}

function main() {
    const options = parseArgs(process.argv);
    if (options.help) {
        printHelp();
        return;
    }

    const files = readJsonFiles(options.jsonDir, options.limit);
    const world = createRoll20Mock();
    loadImporter(world, options.importer);

    files.forEach((file) => {
        const payload = readJson(file);
        assertImport(world, payload, file);
        if (options.verbose) {
            console.log('OK: ' + path.basename(file));
        }
    });

    const failures = world.chat.filter((entry) => /Import Failed|Command Failed|Validation Failed/i.test(entry.message));
    assert.strictEqual(failures.length, 0, 'Importer reported failures: ' + JSON.stringify(failures));
    console.log('Roll20 mock importer tests passed for ' + files.length + ' payload(s).');
}

main();
