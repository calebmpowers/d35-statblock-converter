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

function spellFieldValues(attrs, fieldName) {
    const pattern = new RegExp('^repeating_spells\\d+_.+_' + fieldName + '\\d+$');
    return Object.keys(attrs)
        .filter((name) => pattern.test(name))
        .map((name) => String(attrs[name].current || ''))
        .filter(Boolean);
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
    const statistics = payload.creature && payload.creature.statistics || {};
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

    assert.strictEqual(
        tokenActions.filter((ability) => /^initiative$/i.test(ability.get('name'))).length,
        0,
        sourceName + ': importer should rely on the sheet Initiative action instead of creating a duplicate'
    );

    ['racialabilities', 'classabilities', 'other'].forEach((fieldName) => {
        assert.ok(
            !String(attrCurrent(attrs, fieldName) || '').includes('[object Object]'),
            sourceName + ': empty structured value leaked into ' + fieldName
        );
    });

    const fullSneakAttack = (payload.creature.ordinary_entries || []).find((entry) => {
        return entry && String(entry.name || '').toLowerCase() === 'sneak attack' && entry.raw;
    });
    if (fullSneakAttack && (payload.creature.header.classes || []).some((entry) => {
        return /^(rogue|dread pirate)$/i.test(String(entry && entry.name || ''));
    })) {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        assert.strictEqual(
            classAbilities.split(/\n\n/).filter((entry) => /^Sneak Attack\b/i.test(entry)).length,
            1,
            sourceName + ': Sneak Attack should have exactly one class-ability entry'
        );
        assert.ok(
            classAbilities.includes(fullSneakAttack.raw),
            sourceName + ': full Sneak Attack text missing from class abilities'
        );
    }

    const fullRage = (payload.creature.ordinary_entries || []).find((entry) => {
        return entry && String(entry.name || '').toLowerCase() === 'rage' && entry.raw;
    });
    if (fullRage && (payload.creature.header.classes || []).some((entry) => {
        return /^barbarian$/i.test(String(entry && entry.name || ''));
    })) {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        assert.strictEqual(
            classAbilities.split(/\n\n/).filter((entry) => /^Rage\b/i.test(entry)).length,
            1,
            sourceName + ': Rage should have exactly one class-ability entry'
        );
        assert.ok(
            classAbilities.includes(fullRage.raw),
            sourceName + ': full Rage text missing from class abilities'
        );
        assert.ok(
            !racialAbilities.includes(fullRage.raw),
            sourceName + ': full Rage text should not appear in racial abilities'
        );
    }

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

    const featDetails = statistics.feat_details || [];
    if (featDetails.length > 0) {
        const featSection = String(attrCurrent(attrs, 'feats') || '');
        const npcFeatSection = String(attrCurrent(attrs, 'npcfeats') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const consolidatedFeatList = (statistics.feats || []).join(', ');
        assert.notStrictEqual(
            featSection.split(/\n\n/)[0],
            consolidatedFeatList,
            sourceName + ': consolidated feat list should not precede the individual feat entries'
        );
        assert.notStrictEqual(
            npcFeatSection.split(/\n\n/)[0],
            consolidatedFeatList,
            sourceName + ': consolidated NPC feat list should not precede the individual feat entries'
        );
        assert.strictEqual(
            featSection.split(/\n\n/).filter(Boolean).length,
            (statistics.feats || []).length,
            sourceName + ': feats should render as exactly one ordered entry per listed feat'
        );
        assert.strictEqual(
            npcFeatSection.split(/\n\n/).filter(Boolean).length,
            (statistics.feats || []).length,
            sourceName + ': NPC feats should render as exactly one ordered entry per listed feat'
        );
        featDetails.forEach((feat) => {
            assert.ok(
                featSection.includes(feat.raw),
                sourceName + ': expanded feat text missing from feats: ' + feat.name
            );
            assert.ok(
                npcFeatSection.includes(feat.raw),
                sourceName + ': expanded feat text missing from npcfeats: ' + feat.name
            );
            assert.ok(
                !racialAbilities.includes(feat.raw),
                sourceName + ': expanded feat text should not be in racialabilities: ' + feat.name
            );
        });
    }

    if (sourceName === 'Expanded Feat Monster.dnd35.json') {
        assert.strictEqual(
            Number(attrCurrent(attrs, 'diplomacymiscmod')),
            2,
            sourceName + ': Diplomacy synergy should populate the skill misc modifier'
        );
        assert.ok(
            String(attrCurrent(attrs, 'spellcraftnote') || '').includes('deciphering scrolls'),
            sourceName + ': conditional Spellcraft synergy should populate the skill note'
        );
        assert.ok(
            String(attrCurrent(attrs, 'racialabilities') || '').includes('Spells The expanded feat monster'),
            sourceName + ': expanded spellcasting rules should populate racialabilities'
        );
    }

    if (sourceName === 'Baseline Power Brute.dnd35.json') {
        assert.strictEqual(
            Number(attrCurrent(attrs, 'npcattack1focus')),
            0,
            sourceName + ': Power Attack must not be imported as a fixed attack penalty'
        );
        assert.ok(
            tokenActions.some((ability) => String(ability.get('action') || '').includes('powerAttackAttackBonus')),
            sourceName + ': melee token action should retain the sheet dynamic Power Attack control'
        );
        assert.ok(
            String(attrCurrent(attrs, 'feats') || '').includes('No fixed value is included'),
            sourceName + ': complete Power Attack rules text missing from feats'
        );
    }

    if (sourceName === 'Conditional Skill Scout.dnd35.json') {
        assert.strictEqual(
            Number(attrCurrent(attrs, 'movesilentmiscmod')),
            1,
            sourceName + ': conditional +4 must not be added to the baseline skill modifier'
        );
        assert.ok(
            String(attrCurrent(attrs, 'movesilentnote') || '').includes('forested areas'),
            sourceName + ': parenthetical conditional skill total missing from skill notes'
        );
        assert.ok(
            String(attrCurrent(attrs, 'other') || '').includes('does not replace or add'),
            sourceName + ': lower Skills rules text missing from the sheet reference area'
        );
    }

    if (sourceName === 'Prepared Reference Mage.dnd35.json') {
        assert.strictEqual(
            spellNameAttrs(attrs).filter((name) => name === 'Fireball S').length,
            1,
            sourceName + ': duplicate prepared spell should collapse to one repeating spell'
        );
        assert.ok(
            spellPrepAttrs(attrs).some((value) => String(value) === '2'),
            sourceName + ': duplicate prepared count was not retained'
        );
        assert.ok(
            spellFieldValues(attrs, 'spellmacro').some((value) => value.includes('7d6 points of fire damage')),
            sourceName + ': authoritative Spell Reference body missing from the spell macro'
        );
        assert.ok(
            spellFieldValues(attrs, 'spellduration').some((value) => value.includes('Long (680 ft.)')),
            sourceName + ': compact Spell Reference line missing from repeating spell details'
        );
        assert.ok(
            String(attrCurrent(attrs, 'other') || '').includes('Phantom Spell'),
            sourceName + ': unmatched Spell Reference entry was not preserved'
        );
        assert.ok(
            String(attrCurrent(attrs, 'racialabilities') || '').includes('Last Defense'),
            sourceName + ': final ordinary lower entry missing from rules text'
        );
        assert.ok(
            !String(attrCurrent(attrs, 'racialabilities') || '').includes('3rd-Level Spells'),
            sourceName + ': Spell Reference was appended to the final ordinary ability'
        );
    }

    if (sourceName === 'Spontaneous Reference Adept.dnd35.json') {
        ['Mirror Image', 'Magic Missile', 'Silent Image', 'Detect Magic', 'Light'].forEach((name) => {
            assert.strictEqual(
                spellNameAttrs(attrs).filter((value) => value === name).length,
                1,
                sourceName + ': known spell should be imported once: ' + name
            );
        });
    }

    if (sourceName === 'Class Feature Pirate.dnd35.json') {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const featSection = String(attrCurrent(attrs, 'feats') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        assert.ok(
            classAbilities.includes('Sneak Attack (Ex) The pirate deals an extra 1d6'),
            sourceName + ': full Sneak Attack entry missing from class abilities'
        );
        assert.ok(
            classAbilities.includes('Trapfinding (Ex) The pirate can use Search'),
            sourceName + ': full Trapfinding entry missing from class abilities'
        );
        assert.ok(
            !racialAbilities.includes('Sneak Attack') && !racialAbilities.includes('Trapfinding'),
            sourceName + ': rogue class features should not be duplicated in racial abilities'
        );
        assert.strictEqual(
            classAbilities.split(/\n\n/).filter((entry) => /^Sneak Attack\b/i.test(entry)).length,
            1,
            sourceName + ': Sneak Attack should have exactly one class-ability entry'
        );
        assert.ok(
            !classAbilities.includes('Sneak Attack +1d6'),
            sourceName + ': abbreviated Sneak Attack summary should be suppressed'
        );
        assert.strictEqual(
            (featSection.match(/Improved Toughness/gi) || []).length,
            1,
            sourceName + ': annotated feat name should match its full entry without duplication'
        );
        assert.ok(
            featSection.includes('Improved Toughness [General] The pirate gains 1 hit point per Hit Die.'),
            sourceName + ': full annotated feat entry missing'
        );
        assert.ok(
            !racialAbilities.includes('Blur The pirate carries a potion'),
            sourceName + ': combat-gear rules should not be placed in racial abilities'
        );
        assert.ok(
            other.includes('Blur The pirate carries a potion'),
            sourceName + ': combat-gear rules should be preserved in the Other reference field'
        );
        assert.ok(
            !(statistics.possessions || []).some((item) => /^combat gear$/i.test(String(item))),
            sourceName + ': the combat gear reference marker should not become an item'
        );
        assert.ok(
            featSection.includes('Two-Weapon Fighting The pirate reduces its two-weapon attack penalties'),
            sourceName + ': an untyped lower entry matching the feat list should supply the full feat text'
        );
        assert.ok(
            !featSection.includes('Acrobatic Backstab'),
            sourceName + ': a Movement Skill Trick should not be imported as a feat'
        );
        assert.ok(
            other.includes('Acrobatic Backstab [Movement Skill Trick]'),
            sourceName + ': the full skill-trick entry should be preserved in Other'
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
