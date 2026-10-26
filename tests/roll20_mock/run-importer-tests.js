'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { createRoll20Mock } = require('./roll20-sandbox-mock');
const { runLifecycleTests } = require('./managed-lifecycle-tests');
const { measureStateFootprint } = require('./state-footprint');

const repoRoot = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
    const options = {
        importer: path.join(repoRoot, 'D35_Statblock_Importer.js'),
        jsonDir: path.join(repoRoot, 'Converted JSON'),
        jsonDirs: [],
        footprintJson: null,
        limit: 0,
        verbose: false
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--importer') {
            options.importer = path.resolve(argv[++i]);
        } else if (arg === '--json-dir') {
            options.jsonDirs.push(path.resolve(argv[++i]));
        } else if (arg === '--footprint-json') {
            options.footprintJson = path.resolve(argv[++i]);
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
        '  --json-dir <path>   Directory of *.json payloads; repeat to combine corpora in one state.',
        '                     Defaults to Converted JSON when omitted.',
        '  --footprint-json <path>  Save diagnostic state-size measurements (always printed).',
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

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countRenderedFeatEntries(sectionText, featNames) {
    return (featNames || []).reduce((count, featName) => {
        const heading = new RegExp('(?:^|\\n\\n)' + escapeRegExp(featName) + '(?=\\s|\\[|$)', 'gi');
        return count + (String(sectionText || '').match(heading) || []).length;
    }, 0);
}

function normalizeFeatMatchKey(value) {
    return String(value || '')
        .trim()
        .replace(/\u1D2E\s*$/, '')
        .replace(/\s*\((?=[^)]*[+\-\d])[^)]*\)\s*$/, '')
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function renderedFeatHeadings(featNames, featDetails) {
    const unusedDetails = (featDetails || []).slice();
    return (featNames || []).map((featName) => {
        const key = normalizeFeatMatchKey(featName);
        const detailIndex = unusedDetails.findIndex((feat) => normalizeFeatMatchKey(feat && feat.name) === key);
        if (detailIndex === -1) {
            return featName;
        }
        return unusedDetails.splice(detailIndex, 1)[0].name;
    });
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
    // Structural macro assertions inspect the verified roll template behind
    // runtime-dispatched actions; dispatch itself has dedicated lifecycle tests.
    const manifest = world.state.D35StatblockImporter.characters[characterId];
    const templates = manifest && manifest.baseline && manifest.baseline.attackMacros || {};
    return world.findObjs({ _type: 'ability', characterid: characterId }).map((ability) => ({
        get: (field) => {
            const action = ability.get('action');
            const match = String(action || '').match(/^!d35import roll @\{character_id\} (\S+) \d+$/);
            return field === 'action' && match ? templates[decodeURIComponent(match[1])] : ability.get(field);
        }
    }));
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
        name
    });
    handout.set('gmnotes', jsonText);
    return handout;
}

function createToken(world) {
    return world.createObj('graphic', {
        pageid: '-MOCKPAGE',
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
    world.flush();
    assert.strictEqual(world.state.D35StatblockImporter.lastReport.storedObjectsVerified, true,
        sourceName + ': managed import readback did not verify');

    const characters = world.findObjs({ _type: 'character' });
    assert.strictEqual(
        characters.length,
        beforeCharacters + 1,
        sourceName + ': expected exactly one new character'
    );
    let bio;
    characters[characters.length - 1].get('bio', (value) => { bio = value; });
    world.flush();
    return {
        character: characters[characters.length - 1],
        token,
        bio
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

    if (String(payload.creature && payload.creature.name || '') === 'Lavinia Vanderboren') {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        ['Dodge Bonus', 'Grace', 'Insightful Strike'].forEach((entryName) => {
            assert.ok(
                classAbilities.includes(entryName),
                sourceName + ': Lavinia class feature missing from Class Abilities: ' + entryName
            );
        });
        assert.strictEqual(
            racialAbilities,
            '',
            sourceName + ': Lavinia should have no Racial Abilities entries'
        );
        assert.ok(
            other.includes('Dawn Council Affiliation'),
            sourceName + ': Lavinia affiliation entry should be in Other'
        );
    }

    if (/^(?:Dwarf Expert|Dranys Sellis)$/.test(String(payload.creature && payload.creature.name || ''))) {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const possessions = statistics.possessions || [];
        assert.strictEqual(
            classAbilities,
            '',
            sourceName + ': expanded dwarf traits should suppress their abbreviated class-ability summaries'
        );
        assert.strictEqual(
            racialAbilities.split(/\n\n/).filter(Boolean).length,
            1,
            sourceName + ': dwarf racial rules should import as one full Racial Abilities entry'
        );
        assert.ok(
            racialAbilities.startsWith('Dwarf Traits '),
            sourceName + ': full Dwarf Traits entry missing from Racial Abilities'
        );
        assert.ok(
            possessions.some((item) => /masterwork artisan['’]s tools for armorsmithing, carpentry, and weaponsmithing/i.test(String(item))),
            sourceName + ': comma-separated artisan tool specialties should remain one possession'
        );
        assert.ok(
            !possessions.some((item) => /^(?:carpentry|and weaponsmithing)$/i.test(String(item))),
            sourceName + ': artisan tool specialties should not become standalone possessions'
        );
        assert.ok(
            !/^(?:Listen|Spot)\s+[+-]?\d+/m.test(String(imported.bio || '')),
            sourceName + ': Listen and Spot totals duplicated from the skill list into the biography'
        );
        if (String(payload.creature.name) === 'Dranys Sellis') {
            const other = String(attrCurrent(attrs, 'other') || '');
            assert.ok(
                other.includes('Light Crossbow Loading a light crossbow'),
                sourceName + ': light crossbow rules should be preserved in Other'
            );
            assert.ok(
                other.includes('Masterwork Artisan’s Tools'),
                sourceName + ': artisan tool rules should be preserved in Other'
            );
        }
    }

    if (/^(?:Temple Adept|Farshore Acolyte)$/.test(String(payload.creature && payload.creature.name || ''))) {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        assert.strictEqual(
            String(payload.creature.header.ancestry || '').toLowerCase(),
            'human',
            sourceName + ': male-or-female identity prefix should not become part of ancestry'
        );
        ['Aura', 'Cleric Spellcasting', 'Good Domain', 'Spontaneous Casting', 'Turn Undead'].forEach((entryName) => {
            assert.ok(
                classAbilities.includes(entryName),
                sourceName + ': cleric feature missing from Class Abilities: ' + entryName
            );
            assert.ok(
                !racialAbilities.includes(entryName),
                sourceName + ': cleric feature should not be in Racial Abilities: ' + entryName
            );
        });
        assert.ok(
            !String(imported.bio || '').includes('Domain spell'),
            sourceName + ': domain-spell footnote should not leak into biography text'
        );
        if (String(payload.creature.name) === 'Farshore Acolyte') {
            const farshorePreparedSpells = (payload.creature.offense.spell_sections || []).flatMap((section) => {
                return (section.groups || []).flatMap((group) => {
                    return (group.spells || []).map((spell) => String(spell.name || ''));
                });
            }).filter(Boolean);
            farshorePreparedSpells.forEach((spellName) => {
                assert.ok(
                    spellNameAttrs(attrs).includes(spellName),
                    sourceName + ': prepared spell missing or malformed: ' + spellName
                );
            });
            assert.ok(
                classAbilities.includes('Healing Domain'),
                sourceName + ': Healing Domain should be in Class Abilities'
            );
            assert.strictEqual(
                racialAbilities,
                '',
                sourceName + ': human cleric with only class/item entries should have no Racial Abilities'
            );
            assert.ok(
                String(attrCurrent(attrs, 'other') || '').includes('Healer’s Kit'),
                sourceName + ': healer kit rules should be preserved in Other'
            );
        }
    }

    if (String(payload.creature && payload.creature.name || '') === 'Farshore Guard') {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        assert.strictEqual(
            classAbilities,
            '',
            sourceName + ': equipment-derived spear option should not populate Class Abilities'
        );
        assert.strictEqual(
            racialAbilities,
            '',
            sourceName + ': human warrior with feat and equipment entries should have no Racial Abilities'
        );
        assert.ok(
            other.includes('Spear') && other.includes('deals double damage'),
            sourceName + ': full spear rule should be preserved in Other'
        );
        assert.ok(
            other.includes('Light Crossbow'),
            sourceName + ': full light crossbow rule should be preserved in Other'
        );
    }

    if (['Equipment Trip Commoner', 'Hilde Swenten'].includes(
        String(payload.creature && payload.creature.name || '')
    )) {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        assert.strictEqual(
            classAbilities,
            '',
            sourceName + ': equipment-derived trip option should not populate Class Abilities'
        );
        assert.strictEqual(
            racialAbilities,
            '',
            sourceName + ': human commoner with feat and equipment entries should have no Racial Abilities'
        );
        assert.ok(
            other.includes('Sickle') && other.includes('trip attacks'),
            sourceName + ': full sickle trip rule should be preserved in Other'
        );
    }

    if (['Multilevel Wizard Rogue', 'Jeran Emrikad'].includes(
        String(payload.creature && payload.creature.name || '')
    )) {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        const bio = String(imported.bio || '');
        ['Sneak Attack', 'Summon Familiar', 'Trapfinding', 'Wizard Spellcasting'].forEach((entryName) => {
            assert.ok(
                classAbilities.includes(entryName),
                sourceName + ': wizard/rogue class feature missing from Class Abilities: ' + entryName
            );
        });
        assert.strictEqual(
            racialAbilities,
            '',
            sourceName + ': human wizard/rogue should have no Racial Abilities entries'
        );
        assert.ok(
            other.includes('The Seekers Affiliation'),
            sourceName + ': full Seekers affiliation should be preserved in Other'
        );
        assert.ok(
            !other.includes('Affiliation The Seekers 4'),
            sourceName + ': upper affiliation summary should not duplicate the full entry'
        );
        assert.ok(
            !/affiliation|bonus feat/i.test(bio),
            sourceName + ': affiliation and bonus-feat notation should not populate Biography'
        );
        if (String(payload.creature && payload.creature.name || '') === 'Jeran Emrikad') {
            assert.strictEqual(bio, '', sourceName + ': Jeran Biography should be empty');
        }
        ['Alarm', 'Unseen Servant', 'Detect Magic', 'Light'].forEach((spellName) => {
            assert.ok(
                spellNameAttrs(attrs).includes(spellName),
                sourceName + ': multilevel prepared spell missing or malformed: ' + spellName
            );
        });
    }

    if (['Tight Bracket Feats', 'Lord Manthalay Meravanchi'].includes(
        String(payload.creature && payload.creature.name || '')
    )) {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const featSection = String(attrCurrent(attrs, 'feats') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        ['Power Attack [General]', 'Weapon Specialization (longsword) [General]'].forEach((featText) => {
            assert.ok(
                featSection.includes(featText),
                sourceName + ': tightly spaced feat heading was not normalized: ' + featText
            );
        });
        assert.strictEqual(
            classAbilities,
            '',
            sourceName + ': feat-derived attack options should not populate Class Abilities'
        );
        assert.strictEqual(
            racialAbilities,
            '',
            sourceName + ': human fighter with feat and equipment entries should have no Racial Abilities'
        );
        assert.ok(
            other.includes('Heavy Steel Shield +1'),
            sourceName + ': suffix-form enhancement heading should match prefix-form possession text'
        );
        if (String(payload.creature && payload.creature.name || '') === 'Lord Manthalay Meravanchi') {
            const bio = String(imported.bio || '');
            assert.ok(
                other.includes('Dawn Council Affiliation') && other.includes('Mithral Chainmail +1'),
                sourceName + ': affiliation and equipment rules should be preserved in Other'
            );
            assert.strictEqual(bio, '', sourceName + ': Manthalay Biography should be empty');
        }
    }

    if (['Troglodyte', 'Parenthesized Save Option'].includes(
        String(payload.creature && payload.creature.name || '')
    )) {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const specialAttacks = String(attrCurrent(attrs, 'npcspecialattacks') || '');
        const bio = String(imported.bio || '');
        const stenchSave = String(offense.attack_options_line || '').match(/stench \(Fort DC \d+\)/i);
        assert.strictEqual(
            classAbilities,
            '',
            sourceName + ': racial stench should not populate Class Abilities'
        );
        assert.ok(
            racialAbilities.includes('Darkvision') && racialAbilities.includes('Stench (Ex)'),
            sourceName + ': full troglodyte racial abilities should be preserved'
        );
        assert.ok(
            stenchSave && specialAttacks.toLowerCase().includes(stenchSave[0].toLowerCase()),
            sourceName + ': parenthesized Fortitude DC was split from the attack option'
        );
        assert.ok(
            !/(?:Listen|Spot)\s+[+\-]?\d+|Fort DC \d+\)/.test(bio),
            sourceName + ': senses totals or save-DC fragments should not populate Biography'
        );
        if ((offense.melee_lines || []).some((line) => /2 claws/i.test(String(line && line.raw || '')))) {
            const actionNames = tokenActions.map((ability) => String(ability.get('name') || ''));
            assert.strictEqual(
                actionNames.filter((name) => name === 'Claw').length,
                1,
                sourceName + ': alternate natural routines should produce one clean Claw action'
            );
            assert.strictEqual(
                actionNames.filter((name) => name === 'Bite').length,
                1,
                sourceName + ': repeated Bite fragments should produce one clean Bite action'
            );
            assert.ok(
                actionNames.includes('Claw Full Attack'),
                sourceName + ': the two-claw full attack action should be preserved'
            );
            assert.ok(
                !actionNames.some((name) => /^(?:Claw|Bite) \(Melee\)$/.test(name)),
                sourceName + ': same-type natural actions should not use redundant Melee parentheticals'
            );
        }
    }

    if (String(payload.creature && payload.creature.name || '') === 'Monitor Lizard') {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const bio = String(imported.bio || '');
        assert.strictEqual(classAbilities, '', sourceName + ': animal should have no Class Abilities');
        assert.strictEqual(
            racialAbilities.split(/\n\n/).filter((entry) => /^Low-Light Vision\b/i.test(entry)).length,
            1,
            sourceName + ': Low-Light Vision should appear once in Racial Abilities'
        );
        assert.ok(
            !/(?:Listen|Spot)\s+[+\-]?\d+/.test(bio),
            sourceName + ': senses totals should not populate Biography'
        );
    }

    if ((offense.melee_lines || []).some((line) => (line.fragments || []).some((fragment) =>
        /^6 slam \+29\/\+29\/\+24\/\+19\/\+14\/\+9 \(4d6\+12\)$/i.test(String(fragment && fragment.raw || ''))
    ))) {
        const actionNames = tokenActions.map((ability) => String(ability.get('name') || ''));
        const singleSlam = tokenActions.find((ability) => ability.get('name') === 'Slam');
        const fullSlam = tokenActions.find((ability) => ability.get('name') === 'Slam Full Attack');
        assert.strictEqual(attrCurrent(attrs, 'weapon1name'), 'Slam', sourceName + ': expected one normalized Slam weapon');
        assert.strictEqual(attrCurrent(attrs, 'weapon2name'), undefined, sourceName + ': compound slams should not consume a second weapon slot');
        assert.ok(actionNames.includes('Slam'), sourceName + ': missing standalone Slam action');
        assert.ok(actionNames.includes('Slam Full Attack'), sourceName + ': missing six-attack Slam full action');
        assert.ok(!String(singleSlam && singleSlam.get('action') || '').includes('{{attack2='), sourceName + ': standalone Slam should contain one attack');
        assert.ok(String(fullSlam && fullSlam.get('action') || '').includes('A6:'), sourceName + ': Slam full action should contain all six attacks');
        assert.ok(String(attrCurrent(attrs, 'weapon1fullattackmacro') || '').includes('A6:'), sourceName + ': weapon full-attack macro should contain all six attacks');
    }

    if (['Mixed Weapon Natural Alternatives', 'Phanaton Tar-Gatherer'].includes(
        String(payload.creature && payload.creature.name || '')
    )) {
        const actionNames = tokenActions.map((ability) => String(ability.get('name') || ''));
        const biteActions = tokenActions.filter((ability) => String(ability.get('name') || '') === 'Bite');
        assert.strictEqual(
            actionNames.filter((name) => name === 'Bite').length,
            1,
            sourceName + ': primary and secondary Bite profiles should collapse to one standalone action'
        );
        assert.ok(
            !actionNames.includes('Bite (Melee)'),
            sourceName + ': natural Bite should not carry a redundant Melee parenthetical'
        );
        assert.ok(
            String(biteActions[0] && biteActions[0].get('action') || '').includes('@{str-mod}'),
            sourceName + ': the strongest primary Bite damage profile should be retained'
        );
        ['Dagger', 'Dagger (Ranged)', 'Spear', 'Spear (Ranged)'].forEach((actionName) => {
            assert.ok(
                actionNames.includes(actionName),
                sourceName + ': missing clean alternative weapon action: ' + actionName
            );
        });
    }

    if (String(payload.creature && payload.creature.name || '') === 'Fire Bat') {
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        ['Attach', 'Blindsense', 'Burn (Ex)', 'Devour', 'Elemental Traits', 'Regeneration', 'Water Vulnerability'].forEach((entryName) => {
            assert.ok(racialAbilities.includes(entryName), sourceName + ': Fire Bat racial ability missing: ' + entryName);
        });
        assert.strictEqual(classAbilities, '', sourceName + ': Fire Bat should have no Class Abilities');
    }

    if (String(payload.creature && payload.creature.name || '') === 'Lirith Veldirose') {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        ['Evasion', 'Sneak Attack', 'Trapfinding'].forEach((entryName) => {
            assert.ok(classAbilities.includes(entryName), sourceName + ': Lirith class feature missing: ' + entryName);
        });
        assert.strictEqual(racialAbilities, '', sourceName + ': Lirith should have no Racial Abilities');
        ['Church of the Whirling Fury Affiliation', 'Masterwork Weapons', 'Ring of Protection +1'].forEach((entryName) => {
            assert.ok(other.includes(entryName), sourceName + ': Lirith Other entry missing: ' + entryName);
        });
    }

    if (String(payload.creature && payload.creature.name || '') === 'Mvembi') {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        ['Cleric Spellcasting', 'Death Domain', 'Death Touch', 'Protection Domain', 'Protective Ward', 'Rebuke Undead', 'Spontaneous Casting'].forEach((entryName) => {
            assert.ok(classAbilities.includes(entryName), sourceName + ': Mvembi class feature missing: ' + entryName);
        });
        assert.strictEqual(racialAbilities, '', sourceName + ': Mvembi should have no Racial Abilities');
        ['Cloak of Resistance +1', 'Heavy Wooden Shield +1', 'Hide Armor +1', 'Masterwork Spear', 'Wand of Cure Light Wounds'].forEach((entryName) => {
            assert.ok(other.includes(entryName), sourceName + ': Mvembi Other entry missing: ' + entryName);
        });
    }

    if (String(payload.creature && payload.creature.name || '') === 'J’kal') {
        const classAbilities = String(attrCurrent(attrs, 'classabilities') || '');
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        ['Animal Companion', 'Combat Style', 'Favored Enemy', 'Improved Combat Style', 'Ranger Spellcasting', 'Wild Empathy'].forEach((entryName) => {
            assert.ok(classAbilities.includes(entryName), sourceName + ': J’kal class feature missing: ' + entryName);
        });
        assert.strictEqual(racialAbilities, '', sourceName + ': J’kal should have no Racial Abilities');
        ['Age (Old)', 'Olman Tribes Affiliation', 'Cloak of Resistance +1', '+1 Kaua’koi'].forEach((entryName) => {
            assert.ok(other.includes(entryName), sourceName + ': J’kal Other entry missing: ' + entryName);
        });
    }

    if (['Olman Hunter', 'Olman War Party Warrior'].includes(String(payload.creature && payload.creature.name || ''))) {
        const racialAbilities = String(attrCurrent(attrs, 'racialabilities') || '');
        const other = String(attrCurrent(attrs, 'other') || '');
        assert.strictEqual(racialAbilities, '', sourceName + ': human Olman NPC should have no Racial Abilities');
        assert.ok(other.includes('Olman Tribes Affiliation'), sourceName + ': Olman affiliation should be preserved in Other');
    }

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
        const featHeadings = renderedFeatHeadings(statistics.feats || [], featDetails);
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
            countRenderedFeatEntries(featSection, featHeadings),
            (statistics.feats || []).length,
            sourceName + ': feats should render as exactly one ordered entry per listed feat'
        );
        assert.strictEqual(
            countRenderedFeatEntries(npcFeatSection, featHeadings),
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

    if (sourceName === 'Avatar of the Black Spinner.dnd35.json') {
        const daggerRoutine = tokenActions.find((ability) => ability.get('name') === 'Daggers Full Attack');
        assert.ok(daggerRoutine, sourceName + ': expected the two-dagger full attack action');
        const action = String(daggerRoutine.get('action') || '');
        assert.ok(
            action.includes('{{damage1=') && action.includes('{{damage2=') && action.includes('(floor(@{str-mod}/2))[Weapon Dmg Ability]'),
            sourceName + ': two-dagger full attack should retain distinct primary- and off-hand damage'
        );
    }

    if (String(payload.creature && payload.creature.name || '') === 'Olman War Party Warrior') {
        const kauaKoiRoutine = tokenActions.find((ability) => /Kaua.*Full Attack/i.test(ability.get('name')));
        assert.ok(kauaKoiRoutine, sourceName + ': expected the two-weapon kaua’koi routine');
        const action = String(kauaKoiRoutine.get('action') || '');
        assert.ok(
            action.includes('{{damage1=') && action.includes('{{damage2=') && action.includes('(floor(@{str-mod}/2))[Weapon Dmg Ability]'),
            sourceName + ': kaua’koi full attack should retain +2 primary and +1 off-hand damage totals'
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
        ['Cloak of Resistance', 'Keen'].forEach((entryName) => {
            assert.ok(
                !racialAbilities.includes(entryName),
                sourceName + ': owned-item rule should not be placed in racial abilities: ' + entryName
            );
            assert.ok(
                other.includes(entryName),
                sourceName + ': owned-item rule should be preserved in Other: ' + entryName
            );
        });
        assert.ok(
            classAbilities.includes('Grace (Ex) The swashbuckler gains a +1 competence bonus'),
            sourceName + ': full swashbuckler feature missing from class abilities'
        );
        assert.ok(
            !racialAbilities.includes('Grace (Ex)'),
            sourceName + ': swashbuckler feature should not be placed in racial abilities'
        );
        assert.ok(
            other.includes('Potion of Haste') && other.includes('Spd 60 ft.') &&
                other.includes('Ref +4') && other.includes('Melee scimitar +5') &&
                other.includes('Haste Full Attack') && other.includes('Ranged spear +4') &&
                other.includes('Skills Tumble +9'),
            sourceName + ': temporary stat lines should remain attached to the potion reference in Other'
        );
        assert.ok(
            !racialAbilities.split(/\n\n/).some((entry) => /^(?:Spd|AC|Fort|Ref|Will|Melee|Ranged|Skills|Haste Full Attack)\b/.test(entry)),
            sourceName + ': temporary potion stat lines should not become racial-ability entries'
        );
        assert.ok(
            other.includes('Dawn Council Affiliation'),
            sourceName + ': affiliation rules should be preserved in Other'
        );
        assert.ok(
            !racialAbilities.includes('Dawn Council Affiliation'),
            sourceName + ': affiliation rules should not be placed in racial abilities'
        );
        assert.ok(
            featSection.includes('Dodge [General] The pirate designates one opponent'),
            sourceName + ': full Dodge feat entry missing from feats'
        );
        assert.ok(
            !classAbilities.split(/\n\n/).some((entry) => /^Dodge\s+\+1$/i.test(entry.trim())),
            sourceName + ': feat-derived Dodge summary should not be imported as a class ability'
        );
        assert.strictEqual(
            racialAbilities,
            '',
            sourceName + ': class-, feat-, affiliation-, skill-trick-, and item-only NPC should have no racial abilities'
        );
        assert.ok(
            other.includes('Spear A readied spear deals double damage'),
            sourceName + ': full spear equipment rule should be preserved in Other'
        );
        assert.ok(
            !classAbilities.includes('Set Spear Against Charge'),
            sourceName + ': abbreviated spear attack option should not become a class ability'
        );
    }
}

function main() {
    const options = parseArgs(process.argv);
    if (options.help) {
        printHelp();
        return;
    }

    const directories = Array.from(new Set(options.jsonDirs.length ? options.jsonDirs : [options.jsonDir]));
    let files = directories.flatMap((directory) => readJsonFiles(directory, 0));
    if (options.limit > 0) { files = files.slice(0, options.limit); }
    const world = createRoll20Mock();
    loadImporter(world, options.importer);

    files.forEach((file) => {
        const payload = readJson(file);
        assertImport(world, payload, file);
        const managed = world.state.D35StatblockImporter.characters[world.state.D35StatblockImporter.lastReport.characterId];
        const ownedBefore = JSON.stringify(managed.owned);
        const rowsBefore = JSON.stringify(managed.rows);
        world.trigger('chat:message', {
            type: 'api', playerid: '-MOCKGM',
            content: '!d35import update ' + managed.characterId + ' ' + managed.sourceHandoutId
        });
        world.flush();
        assert.strictEqual(world.state.D35StatblockImporter.lastReport.storedObjectsVerified, true,
            path.basename(file) + ': managed update readback did not verify');
        assert.strictEqual(JSON.stringify(managed.owned), ownedBefore, path.basename(file) + ': update changed owned IDs');
        assert.strictEqual(JSON.stringify(managed.rows), rowsBefore, path.basename(file) + ': update changed row IDs');
        Object.keys(managed.baseline.attackMacros || {}).forEach((key) => {
            const ability = world.getObj('ability', managed.owned.abilities[key]);
            const beforeRoll = world.chat.length;
            world.trigger('chat:message', {type:'api', playerid:'-MOCKGM',
                content:ability.get('action').replace('@{character_id}', managed.characterId)});
            world.flush();
            const rolls = world.chat.slice(beforeRoll).filter((entry) => entry.who === 'character|' + managed.characterId);
            assert.strictEqual(rolls.length, managed.baseline.attackMacros[key].split('\n').length,
                path.basename(file) + ': attack dispatcher did not emit the complete routine: ' + key);
            rolls.forEach((entry) => {
                assert.ok(!entry.message.includes('@{') && !entry.message.includes(managed.characterId),
                    path.basename(file) + ': unresolved attribute or Character ID reached roll output: ' + entry.message);
            });
        });
        if (options.verbose) {
            console.log('OK: ' + path.basename(file));
        }
    });

    const failures = world.chat.filter((entry) => /Import Failed|Command Failed|Validation Failed|Attack Failed/i.test(entry.message));
    assert.strictEqual(failures.length, 0, 'Importer reported failures: ' + JSON.stringify(failures));
    console.log('Roll20 mock importer tests passed for ' + files.length + ' payload(s).');
    runLifecycleTests(options.importer);
    // The corpus world remains shared across all creatures; isolated lifecycle/fault
    // scenarios use separate worlds and do not reset or pollute this measurement.
    const footprint = measureStateFootprint(world.state.D35StatblockImporter);
    assert.strictEqual(footprint.managedCharacters, files.length, 'Every corpus import must remain managed');
    footprint.corpus = {
        measuredAt: new Date().toISOString(),
        directories,
        payloadCount: files.length,
        workload: 'Each payload imported once with a token, then updated once; isolated fault scenarios excluded',
        importerSha256: crypto.createHash('sha256').update(fs.readFileSync(options.importer)).digest('hex'),
        payloads: files.map((file) => ({ file: path.basename(file),
            sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }))
    };
    const summary = { ...footprint, corpus: { ...footprint.corpus, payloads: undefined } };
    console.log('D35_STATE_FOOTPRINT ' + JSON.stringify(summary));
    if (options.footprintJson) { fs.writeFileSync(options.footprintJson, JSON.stringify(footprint, null, 2) + '\n'); }
}

main();
