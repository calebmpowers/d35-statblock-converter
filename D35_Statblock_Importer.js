var D35StatblockImporter = D35StatblockImporter || (function () {
    'use strict';

    var SCRIPT_NAME = 'D35 Statblock Importer';
    var VERSION = '0.4.1';
    var COMMAND = '!d35import';
    var COMMAND_ALIASES = ['!d35import', '!d35importer', '!d35'];
    var PING_COMMAND = '!d35ping';
    var MAX_PC_WEAPONS = 10;
    var MAX_NPC_ATTACKS = 3;
    var SIZE_MODIFIERS = {
        fine: 8,
        diminutive: 4,
        tiny: 2,
        small: 1,
        medium: 0,
        large: -1,
        huge: -2,
        gargantuan: -4,
        colossal: -8
    };
    var SIZE_WORDS = [
        'Fine',
        'Diminutive',
        'Tiny',
        'Small',
        'Medium',
        'Large',
        'Huge',
        'Gargantuan',
        'Colossal'
    ];
    var DIVINE_SECTION_KEYWORDS = [
        'cleric',
        'druid',
        'paladin',
        'ranger',
        'adept',
        'blackguard',
        'spirit shaman',
        'favored soul',
        'shugenja',
        'healer'
    ];
    var ARCANE_SECTION_KEYWORDS = [
        'sorcerer',
        'wizard',
        'bard',
        'beguiler',
        'duskblade',
        'warmage',
        'wu jen',
        'assassin',
        'trapsmith'
    ];
    var SPELL_LEVEL_SUFFIXES = {
        divine: {
            0: '01',
            1: '11',
            2: '21',
            3: '31',
            4: '41',
            5: '51',
            6: '61',
            7: '71',
            8: '81',
            9: '91'
        },
        arcane: {
            0: '02',
            1: '12',
            2: '22',
            3: '32',
            4: '42',
            5: '52',
            6: '62',
            7: '72',
            8: '82',
            9: '92'
        }
    };
    var AGE_QUALIFIER_WORDS = [
        'young adult',
        'middle-aged',
        'middle aged',
        'juvenile',
        'young',
        'adult',
        'old',
        'venerable'
    ];
    var ARMOR_ITEMS = [
        { key: 'studded leather armor', name: 'Studded Leather Armor', type: 'Light', bonus: 3, maxDex: 5, checkPenalty: -1, spellFailure: 15 },
        { key: 'padded armor', name: 'Padded Armor', type: 'Light', bonus: 1, maxDex: 8, checkPenalty: -1, spellFailure: 5 },
        { key: 'leather armor', name: 'Leather Armor', type: 'Light', bonus: 2, maxDex: 6, checkPenalty: 0, spellFailure: 10 },
        { key: 'chain shirt', name: 'Chain Shirt', type: 'Light', bonus: 4, maxDex: 4, checkPenalty: -2, spellFailure: 20 },
        { key: 'hide armor', name: 'Hide Armor', type: 'Medium', bonus: 4, maxDex: 4, checkPenalty: -3, spellFailure: 20 },
        { key: 'scale mail', name: 'Scale Mail', type: 'Medium', bonus: 4, maxDex: 3, checkPenalty: -4, spellFailure: 25 },
        { key: 'chainmail', name: 'Chainmail', type: 'Medium', bonus: 5, maxDex: 2, checkPenalty: -5, spellFailure: 30 },
        { key: 'breastplate', name: 'Breastplate', type: 'Medium', bonus: 5, maxDex: 3, checkPenalty: -4, spellFailure: 25 },
        { key: 'splint mail', name: 'Splint Mail', type: 'Heavy', bonus: 6, maxDex: 0, checkPenalty: -7, spellFailure: 40 },
        { key: 'banded mail', name: 'Banded Mail', type: 'Heavy', bonus: 6, maxDex: 1, checkPenalty: -6, spellFailure: 35 },
        { key: 'half-plate', name: 'Half-Plate', type: 'Heavy', bonus: 7, maxDex: 0, checkPenalty: -7, spellFailure: 40 },
        { key: 'half plate', name: 'Half-Plate', type: 'Heavy', bonus: 7, maxDex: 0, checkPenalty: -7, spellFailure: 40 },
        { key: 'full plate', name: 'Full Plate', type: 'Heavy', bonus: 8, maxDex: 1, checkPenalty: -6, spellFailure: 35 }
    ];
    var SHIELD_ITEMS = [
        { key: 'tower shield', name: 'Tower Shield', bonus: 4, checkPenalty: -10, spellFailure: 50 },
        { key: 'heavy steel shield', name: 'Heavy Steel Shield', bonus: 2, checkPenalty: -2, spellFailure: 15 },
        { key: 'heavy wooden shield', name: 'Heavy Wooden Shield', bonus: 2, checkPenalty: -2, spellFailure: 15 },
        { key: 'light steel shield', name: 'Light Steel Shield', bonus: 1, checkPenalty: -1, spellFailure: 5 },
        { key: 'light wooden shield', name: 'Light Wooden Shield', bonus: 1, checkPenalty: -1, spellFailure: 5 },
        { key: 'buckler', name: 'Buckler', bonus: 1, checkPenalty: -1, spellFailure: 5 }
    ];
    var SKILL_RULES = {
        appraise: { attr: 'appraise', ability: 'int' },
        autohypnosis: { attr: 'autohypnosis', ability: 'wis' },
        balance: { attr: 'balance', ability: 'dex', armorCheckMultiplier: 1 },
        bluff: { attr: 'bluff', ability: 'cha' },
        climb: { attr: 'climb', ability: 'str', armorCheckMultiplier: 1, statSelect: 'str' },
        concentration: { attr: 'concentration', ability: 'con' },
        diplomacy: { attr: 'diplomacy', ability: 'cha' },
        decipherscript: { attr: 'decipherscript', ability: 'int' },
        disabledevice: { attr: 'disabledevice', ability: 'int' },
        disguise: { attr: 'disguise', ability: 'cha' },
        escapeartist: { attr: 'escapeartist', ability: 'dex', armorCheckMultiplier: 1 },
        forgery: { attr: 'forgery', ability: 'int' },
        gatherinformation: { attr: 'gatherinformation', ability: 'cha' },
        handleanimal: { attr: 'handleanimal', ability: 'cha' },
        heal: { attr: 'heal', ability: 'wis' },
        hide: { attr: 'hide', ability: 'dex', armorCheckMultiplier: 1, hideSize: true },
        intimidate: { attr: 'intimidate', ability: 'cha' },
        jump: { attr: 'jump', ability: 'str', armorCheckMultiplier: 1, statSelect: 'str' },
        listen: { attr: 'listen', ability: 'wis' },
        martiallore: { attr: 'martiallore', ability: 'int', armorCheckMultiplier: 1 },
        movesilently: { attr: 'movesilent', ability: 'dex', armorCheckMultiplier: 1 },
        openlock: { attr: 'openlock', ability: 'dex' },
        psicraft: { attr: 'psicraft', ability: 'int' },
        ride: { attr: 'ride', ability: 'dex' },
        search: { attr: 'search', ability: 'int' },
        sensemotive: { attr: 'sensemotive', ability: 'wis' },
        sleightofhand: { attr: 'sleightofhand', ability: 'dex', armorCheckMultiplier: 1 },
        spellcraft: { attr: 'spellcraft', ability: 'int' },
        spot: { attr: 'spot', ability: 'wis' },
        survival: { attr: 'survival', ability: 'wis' },
        swim: { attr: 'swim', ability: 'str', armorCheckMultiplier: 2 },
        tumble: { attr: 'tumble', ability: 'dex', armorCheckMultiplier: 1 },
        truespeak: { attr: 'truespeak', ability: 'int', armorCheckMultiplier: 1 },
        usemagicdevice: { attr: 'usemagicdevice', ability: 'cha' },
        usepsionicdevice: { attr: 'usepsionicdevice', ability: 'cha' },
        userope: { attr: 'userope', ability: 'dex' }
    };
    var KNOWLEDGE_SKILL_RULES = {
        arcana: 'knowarcana',
        engineering: 'knowengineer',
        engineer: 'knowengineer',
        dungeoneering: 'knowdungeon',
        dungeon: 'knowdungeon',
        geography: 'knowgeography',
        history: 'knowhistory',
        local: 'knowlocal',
        nature: 'knownature',
        nobility: 'knownobility',
        psionics: 'knowpsionic',
        psionic: 'knowpsionic',
        religion: 'knowreligion',
        planes: 'knowplanes',
        'the planes': 'knowplanes'
    };
    var CUSTOM_SKILL_SLOTS = {
        craft: 3,
        perform: 3,
        profession: 3
    };
    var FEAT_SKILL_BONUSES = {
        acrobatic: [
            { skill: 'jump', bonus: 2 },
            { skill: 'tumble', bonus: 2 }
        ],
        agile: [
            { skill: 'balance', bonus: 2 },
            { skill: 'escapeartist', bonus: 2 }
        ],
        alertness: [
            { skill: 'listen', bonus: 2 },
            { skill: 'spot', bonus: 2 }
        ],
        animalaffinity: [
            { skill: 'handleanimal', bonus: 2 },
            { skill: 'ride', bonus: 2 }
        ],
        athletic: [
            { skill: 'climb', bonus: 2 },
            { skill: 'swim', bonus: 2 }
        ],
        deceitful: [
            { skill: 'disguise', bonus: 2 },
            { skill: 'forgery', bonus: 2 }
        ],
        defthands: [
            { skill: 'sleightofhand', bonus: 2 },
            { skill: 'userope', bonus: 2 }
        ],
        diligent: [
            { skill: 'appraise', bonus: 2 },
            { skill: 'decipherscript', bonus: 2 }
        ],
        investigator: [
            { skill: 'gatherinformation', bonus: 2 },
            { skill: 'search', bonus: 2 }
        ],
        magicalaptitude: [
            { skill: 'spellcraft', bonus: 2 },
            { skill: 'usemagicdevice', bonus: 2 }
        ],
        negotiator: [
            { skill: 'diplomacy', bonus: 2 },
            { skill: 'sensemotive', bonus: 2 }
        ],
        nimblefingers: [
            { skill: 'disabledevice', bonus: 2 },
            { skill: 'openlock', bonus: 2 }
        ],
        persuasive: [
            { skill: 'bluff', bonus: 2 },
            { skill: 'intimidate', bonus: 2 }
        ],
        selfsufficient: [
            { skill: 'heal', bonus: 2 },
            { skill: 'survival', bonus: 2 }
        ],
        stealthy: [
            { skill: 'hide', bonus: 2 },
            { skill: 'movesilently', bonus: 2 }
        ]
    };
    var FEAT_SAVE_BONUSES = {
        greatfortitude: { fort: 2, ref: 0, will: 0 },
        lightningreflexes: { fort: 0, ref: 2, will: 0 },
        ironwill: { fort: 0, ref: 0, will: 2 }
    };

    function sendGM(message) {
        sendChat(SCRIPT_NAME, '/w gm ' + message, null, { noarchive: true });
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderList(title, lines) {
        var html = '<div style="border:1px solid #444;background:#fff;padding:8px;">';
        html += '<div style="font-weight:bold;margin-bottom:6px;">' + escapeHtml(title) + '</div>';
        if (!lines || !lines.length) {
            html += '<div>(none)</div></div>';
            return html;
        }
        html += '<ul style="margin:0 0 0 18px;padding:0;">';
        lines.forEach(function (line) {
            html += '<li>' + escapeHtml(line) + '</li>';
        });
        html += '</ul></div>';
        return html;
    }

    function trim(value) {
        return String(value || '').replace(/^\s+|\s+$/g, '');
    }

    function asArray(value) {
        if (value === null || value === undefined || value === '') {
            return [];
        }
        if (!Array.isArray(value) && typeof value === 'object' && Object.keys(value).length === 0) {
            return [];
        }
        return Array.isArray(value) ? value : [value];
    }

    function displayCaseWord(word, forceUpper) {
        if (!word) {
            return word;
        }
        if (/^[IVXLCDM]+$/i.test(word)) {
            return word.toUpperCase();
        }
        if (/^[+-]?\d/.test(word)) {
            return word;
        }
        if (forceUpper) {
            return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
        }
        return word;
    }

    function toDisplayCase(value) {
        var cleaned = trim(normalizeText(value));
        var wordIndex = 0;
        if (!cleaned) {
            return '';
        }
        return cleaned.replace(/[A-Za-z][A-Za-z'’.-]*/g, function (word) {
            wordIndex += 1;
            return displayCaseWord(word, true);
        });
    }

    function normalizeLookupText(value) {
        return trim(normalizeText(value))
            .toLowerCase()
            .replace(/[^a-z0-9+()/ -]+/g, ' ')
            .replace(/\s+/g, ' ');
    }

    function repairText(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
            .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, '—')
            .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“/g, '–')
            .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢/g, '’')
            .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“/g, '‘')
            .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ/g, '“')
            .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â/g, '”')
            .replace(/Ã¢â‚¬â€/g, '—')
            .replace(/Ã¢â‚¬â€œ/g, '–')
            .replace(/Ã¢â‚¬â„¢/g, '’')
            .replace(/Ã¢â‚¬Ëœ/g, '‘')
            .replace(/Ã¢â‚¬Å“/g, '“')
            .replace(/Ã¢â‚¬Â/g, '”')
            .replace(/Ã¢â‚¬ï¿½/g, '”')
            .replace(/Ã¢â‚¬Â¦/g, '…')
            .replace(/â€™/g, '’')
            .replace(/â€˜/g, '‘')
            .replace(/â€œ/g, '“')
            .replace(/â€/g, '”')
            .replace(/â€”/g, '—')
            .replace(/â€“/g, '–')
            .replace(/â€¦/g, '…')
            .replace(/Ãƒâ€”/g, '×')
            .replace(/ÃƒÆ’Ã¢â‚¬â€/g, '×')
            .replace(/Ã—/g, '×')
            .replace(/Ã‚/g, '')
            .replace(/\u00A0/g, ' ')
            .replace(/\r\n/g, '\n');
    }

    function normalizeText(value) {
        return repairText(value)
            .replace(/[\u2018\u2019]/g, '\'')
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\u00D7/g, 'x')
            .replace(/\u2026/g, '...')
            .replace(/\u00A0/g, ' ')
            .replace(/\r\n/g, '\n');
    }

    function splitAndDisplayList(value) {
        return splitTopLevel(value).map(function (part) {
            return toDisplayCase(part);
        }).join(', ');
    }

    function decodeEntity(entity) {
        var entities = {
            nbsp: ' ',
            amp: '&',
            lt: '<',
            gt: '>',
            quot: '"',
            '#39': '\'',
            apos: '\''
        };
        if (entities.hasOwnProperty(entity)) {
            return entities[entity];
        }
        if (entity.charAt(0) === '#') {
            if (entity.charAt(1).toLowerCase() === 'x') {
                return String.fromCharCode(parseInt(entity.substring(2), 16));
            }
            return String.fromCharCode(parseInt(entity.substring(1), 10));
        }
        return '&' + entity + ';';
    }

    function decodeHtml(value) {
        return String(value || '').replace(/&([^;]+);/g, function (match, entity) {
            return decodeEntity(entity);
        });
    }

    function htmlToText(html) {
        return repairText(
            decodeHtml(String(html || '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/(div|p|li|tr|td|h1|h2|h3|h4|h5|h6)>/gi, '\n')
                .replace(/<li[^>]*>/gi, '- ')
                .replace(/<[^>]+>/g, '')
                .replace(/\u00a0/g, ' '))
        );
    }

    function normalizeNameTarget(value) {
        return trim(normalizeText(value));
    }

    function commandBoundaryMatches(content, command) {
        var nextChar;
        if (content.length < command.length || content.slice(0, command.length).toLowerCase() !== command.toLowerCase()) {
            return false;
        }
        nextChar = content.charAt(command.length);
        return !nextChar || /\s/.test(nextChar);
    }

    function getMatchedCommand(content) {
        var i;
        var raw = trim(content || '');
        if (commandBoundaryMatches(raw, PING_COMMAND)) {
            return PING_COMMAND;
        }
        for (i = 0; i < COMMAND_ALIASES.length; i += 1) {
            if (commandBoundaryMatches(raw, COMMAND_ALIASES[i])) {
                return COMMAND_ALIASES[i];
            }
        }
        return '';
    }

    function parseCommand(content, matchedCommand) {
        var body = trim(String(content || '').slice(matchedCommand.length));
        if (!body) {
            return { verb: 'help', target: '' };
        }

        var verbMatch = body.match(/^(\w+)(?:\s+(.+))?$/);
        if (!verbMatch) {
            return { verb: 'import', target: body };
        }

        var verb = verbMatch[1].toLowerCase();
        var target = trim(verbMatch[2] || '');
        if (verb === 'help' || verb === 'validate' || verb === 'import' || verb === 'bind') {
            return { verb: verb, target: target };
        }
        return { verb: 'import', target: body };
    }

    function describeHandout(handout) {
        return '"' + String(handout && handout.get ? handout.get('name') : '') + '" (' + String(handout && handout.id ? handout.id : '') + ')';
    }

    function resolveHandout(target, callback) {
        var normalized = normalizeNameTarget(target);
        if (!normalized) {
            callback({ handout: null, error: 'Handout name or id is required.', info: null });
            return;
        }

        var direct = getObj('handout', normalized);
        if (direct) {
            callback({ handout: direct, error: null, info: null });
            return;
        }

        var matches = findObjs({ _type: 'handout', name: normalized });
        if (!matches.length) {
            callback({ handout: null, error: 'No handout found with the exact name "' + normalized + '".', info: null });
            return;
        }
        if (matches.length === 1) {
            callback({ handout: matches[0], error: null, info: null });
            return;
        }

        chooseImportHandout(matches, function (validMatches) {
            if (validMatches.length === 1) {
                callback({
                    handout: validMatches[0],
                    error: null,
                    info: 'Multiple handouts matched "' + normalized + '". Using the only one that contains valid importer JSON: ' + describeHandout(validMatches[0]) + '.'
                });
                return;
            }

            var listed = (validMatches.length ? validMatches : matches).slice(0, 5).map(describeHandout);
            var suffix = (validMatches.length ? ' Multiple matching handouts contain valid importer JSON.' : ' None of the matching handouts contained valid importer JSON.');
            callback({
                handout: null,
                error: 'Multiple handouts match "' + normalized + '". Matching handouts: ' + listed.join(', ') + '.' + suffix + ' Please use the handout id instead.',
                info: null
            });
        });
    }

    function loadHandoutPayload(handout, callback) {
        handout.get('gmnotes', function (gmnotes) {
            var gmText = trim(htmlToText(gmnotes));
            if (gmText && gmText.indexOf('{') !== -1) {
                callback(gmText);
                return;
            }
            handout.get('notes', function (notes) {
                callback(trim(htmlToText(notes)));
            });
        });
    }

    function chooseImportHandout(matches, callback) {
        var pending = matches.length;
        var validMatches = [];

        matches.forEach(function (handout) {
            loadHandoutPayload(handout, function (payloadText) {
                try {
                    var payload = tryParsePayload(payloadText);
                    if (payload && payload.creature) {
                        validMatches.push(handout);
                    }
                } catch (ignore) {}

                pending -= 1;
                if (!pending) {
                    callback(validMatches);
                }
            });
        });
    }

    function tryParsePayload(text) {
        var cleaned = trim(repairText(text));
        return JSON.parse(cleaned);
    }

    function safeNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        var parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    }

    function abilityMod(score) {
        if (score === null || score === undefined) {
            return 0;
        }
        return Math.floor((score - 10) / 2);
    }

    function firstNumericMatch(pattern, text) {
        var match = String(text || '').match(pattern);
        return match ? safeNumber(match[1]) : null;
    }

    function splitTopLevel(value) {
        var items = [];
        var current = '';
        var depth = 0;
        String(value || '').split('').forEach(function (ch) {
            if (ch === '(') {
                depth += 1;
            } else if (ch === ')' && depth > 0) {
                depth -= 1;
            }
            if (ch === ',' && depth === 0) {
                if (trim(current)) {
                    items.push(trim(current));
                }
                current = '';
            } else {
                current += ch;
            }
        });
        if (trim(current)) {
            items.push(trim(current));
        }
        return items;
    }

    function parseAbilitiesLine(line) {
        var result = {};
        var regex = /\b(Str|Dex|Con|Int|Wis|Cha)\s+(-?\d+)/gi;
        var match;
        while ((match = regex.exec(String(line || '')))) {
            result[match[1].toLowerCase()] = safeNumber(match[2]);
        }
        return result;
    }

    function parseInitLine(line) {
        return {
            total: firstNumericMatch(/Init\s+([+-]?\d+)/i, line)
        };
    }

    function parseAcLine(line) {
        return {
            total: firstNumericMatch(/AC\*?\s+(-?\d+)/i, line),
            touch: firstNumericMatch(/touch\s+(-?\d+)/i, line),
            flat: firstNumericMatch(/flat-?footed\s+(-?\d+)/i, line),
            raw: trim(line)
        };
    }

    function parseHpLine(line) {
        var hp = firstNumericMatch(/\bhp\s+(\d+)/i, line);
        var hd = firstNumericMatch(/\((\d+)\s*HD\)/i, line);
        if (hd === null) {
            hd = firstNumericMatch(/\((\d+)\s*d\d+(?:[+-]\d+)?\)/i, line);
        }
        var current = firstNumericMatch(/currently\s+(\d+)/i, line);
        var drMatch = String(line || '').match(/;\s*DR\s+([^;]+)/i);
        return {
            current: current !== null ? current : hp,
            max: hp,
            hd: hd,
            dr: drMatch ? trim(drMatch[1]) : '',
            raw: trim(line)
        };
    }

    function parseSaveLine(line) {
        return {
            fort: firstNumericMatch(/Fort\s+([+-]?\d+)/i, line),
            ref: firstNumericMatch(/Ref\s+([+-]?\d+)/i, line),
            will: firstNumericMatch(/Will\s+([+-]?\d+)/i, line),
            raw: trim(line)
        };
    }

    function parseBaseAttackLine(line) {
        return {
            bab: firstNumericMatch(/Base Atk\s+([+-]?\d+)/i, line),
            grapple: firstNumericMatch(/Grp\s+([+-]?\d+)/i, line),
            raw: trim(line)
        };
    }

    function parseSpaceReachLine(line) {
        var match = String(line || '').match(/Space\s+([^;]+);\s*Reach\s+(.+)$/i);
        if (!match) {
            return { space: '', reach: '', raw: trim(line) };
        }
        return {
            space: trim(match[1]),
            reach: trim(match[2]),
            raw: trim(line)
        };
    }

    function parseSpeedLine(line) {
        var speedText = String(line || '').replace(/^Spd\s+/i, '').replace(/^Speed\s+/i, '');
        var semicolonIndex = speedText.indexOf(';');
        var result = {
            land: '',
            fly: '',
            flyManeuver: '',
            climb: '',
            swim: '',
            burrow: '',
            raw: trim(line)
        };
        if (semicolonIndex >= 0) {
            speedText = speedText.substring(0, semicolonIndex);
        }

        function extractSpeedValue(text) {
            var value = firstNumericMatch(/(\d+)/, text);
            return value !== null ? String(value) : '';
        }

        splitTopLevel(speedText).forEach(function (part) {
            var cleaned = trim(part);
            var flyMatch = cleaned.match(/^fly\s+([^()]+?)(?:\s*\(([^)]+)\))?$/i);
            if (flyMatch) {
                result.fly = extractSpeedValue(flyMatch[1]);
                result.flyManeuver = trim(flyMatch[2] || '');
                return;
            }
            var climbMatch = cleaned.match(/^climb\s+(.+)$/i);
            if (climbMatch) {
                result.climb = extractSpeedValue(climbMatch[1]);
                return;
            }
            var swimMatch = cleaned.match(/^swim\s+(.+)$/i);
            if (swimMatch) {
                result.swim = extractSpeedValue(swimMatch[1]);
                return;
            }
            var burrowMatch = cleaned.match(/^burrow\s+(.+)$/i);
            if (burrowMatch) {
                result.burrow = extractSpeedValue(burrowMatch[1]);
                return;
            }
            if (!result.land) {
                result.land = extractSpeedValue(cleaned);
            }
        });
        return result;
    }

    function parseLanguages(line) {
        return trim(String(line || '').replace(/^Languages\s+/i, '').split(';')[0] || '');
    }

    function extractLanguageHeaderExtras(line) {
        var cleaned = trim(String(line || '').replace(/^Languages\s+/i, ''));
        var separatorIndex = cleaned.indexOf(';');
        if (separatorIndex < 0) {
            return '';
        }
        return trim(cleaned.substring(separatorIndex + 1));
    }

    function stripPrefix(value, prefix) {
        return trim(String(value || '').replace(new RegExp('^' + prefix, 'i'), ''));
    }

    function extractInlineNotes(line) {
        return String(line || '')
            .split(';')
            .slice(1)
            .map(function (part) {
                return trim(normalizeText(part));
            })
            .filter(Boolean);
    }

    function looksLikeTypeLine(line) {
        var cleaned = trim(line);
        var i;
        if (/^(?:Always|Usually|Often|Rarely)?\s*(?:lawful|neutral|chaotic|good|evil|unaligned)\b/i.test(cleaned)) {
            return true;
        }
        for (i = 0; i < SIZE_WORDS.length; i += 1) {
            if (new RegExp('\\b' + SIZE_WORDS[i] + '\\b').test(cleaned)) {
                return true;
            }
        }
        return false;
    }

    function looksLikeSourceReference(line) {
        var cleaned = trim(line);
        return !!cleaned && /\d+$/.test(cleaned) && !looksLikeTypeLine(cleaned) && !/^Init\s/i.test(cleaned);
    }

    function splitAlignmentSizeType(line) {
        var cleaned = trim(line);
        var sizeWord = '';
        var sizeIndex = -1;
        SIZE_WORDS.forEach(function (candidate) {
            if (!sizeWord) {
                var index = cleaned.indexOf(candidate);
                if (index >= 0) {
                    sizeWord = candidate;
                    sizeIndex = index;
                }
            }
        });
        if (!sizeWord) {
            return {
                alignment: '',
                sizeWord: '',
                sizeMod: 0,
                typeText: cleaned
            };
        }
        return {
            alignment: trim(cleaned.substring(0, sizeIndex)),
            sizeWord: sizeWord,
            sizeMod: SIZE_MODIFIERS[sizeWord.toLowerCase()],
            typeText: trim(cleaned.substring(sizeIndex + sizeWord.length))
        };
    }

    function splitGenderAndDescriptor(line) {
        var cleaned = trim(line);
        var match = cleaned.match(/^(Male and female|Male or female|Male|Female)\s+(.+)$/i);
        if (!match) {
            return {
                gender: '',
                descriptor: cleaned
            };
        }
        return {
            gender: trim(match[1]),
            descriptor: trim(match[2])
        };
    }

    function splitBioAndMechanicalText(text) {
        var bioParts = [];
        var mechanicalParts = [];
        String(text || '').split(/\n\s*\n/).forEach(function (paragraph) {
            var cleaned = trim(paragraph);
            if (!cleaned) {
                return;
            }
            if (/^[A-Z][^.()]*\((Ex|Sp|Su)\)/.test(cleaned) || /^(?:Skills|Spells)\b/i.test(cleaned)) {
                mechanicalParts.push(cleaned);
            } else {
                bioParts.push(cleaned);
            }
        });
        return {
            bio: bioParts.join('\n\n'),
            mechanical: mechanicalParts.join('\n\n')
        };
    }

    function extractSkillBonuses(skills) {
        var map = {};
        (skills || []).forEach(function (entry) {
            var cleaned = trim(entry);
            var match = cleaned.match(/^(.+?)\s+([+-]?\d+)(?:\s*\(([^)]+)\))?$/);
            if (match) {
                map[match[1].toLowerCase()] = {
                    total: safeNumber(match[2]),
                    note: trim(match[3] || '')
                };
            }
        });
        return map;
    }

    function normalizeSituationalSkillCondition(text) {
        var condition = trim(normalizeText(text || ''));
        if (!condition) {
            return '';
        }
        condition = condition.replace(/^made\s+/i, '');
        condition = condition.replace(/^checks?\s+/i, '');
        condition = trim(condition.replace(/^[,;:.]+/, ''));
        if (!condition) {
            return '';
        }
        if (/^(?:because of|due to|from)\b/i.test(condition)) {
            return '';
        }
        if (!/^(?:while|when|against|on|for|to|under|within|during|if|as|in)\b/i.test(condition)) {
            return '';
        }
        return condition;
    }

    function appendUniqueNote(map, key, note) {
        if (!key || !note) {
            return;
        }
        if (!map[key]) {
            map[key] = [];
        }
        if (map[key].indexOf(note) === -1) {
            map[key].push(note);
        }
    }

    function extractSituationalSkillNotes(text, skillDetails) {
        var notes = {};
        String(text || '').split(/\n\s*\n/).forEach(function (paragraph) {
            var cleaned = trim(paragraph);
            var body;
            var regex;
            var match;
            if (!/^Skills\b/i.test(cleaned)) {
                return;
            }
            body = stripPrefix(cleaned, 'Skills\\s+');
            regex = /([+-]\d+)\s+(?:[a-z-]+\s+)?bonus on (?:any\s+)?(.+?)\s+checks?([^.;]*)/ig;
            while ((match = regex.exec(body))) {
                var bonus = safeNumber(match[1]);
                var descriptor = parseSkillDescriptor(match[2]);
                var condition = normalizeSituationalSkillCondition(match[3]);
                if (bonus === null || !descriptor || !condition) {
                    continue;
                }
                appendUniqueNote(notes, descriptor, '(' + (bonus >= 0 ? '+' : '') + bonus + ' ' + condition + ')');
            }
        });
        asArray(skillDetails).forEach(function (detail) {
            var descriptor = parseSkillDescriptor(detail && detail.skill || '');
            var condition = normalizeSituationalSkillCondition(detail && detail.condition || '');
            var modifierText = asArray(detail && detail.modifiers).map(function (modifier) {
                var bonus = safeNumber(modifier && modifier.bonus);
                var source = trim(modifier && modifier.source || '');
                var reason = trim(modifier && modifier.reason || '');
                if (bonus === null) {
                    return '';
                }
                return (bonus >= 0 ? '+' : '') + bonus +
                    (source ? ' from ' + source : '') +
                    (reason ? ' for ' + reason : '');
            }).filter(Boolean).join(', ');
            if (!descriptor || !condition || !modifierText) {
                return;
            }
            appendUniqueNote(notes, descriptor, '(' + modifierText + ' ' + condition + ')');
        });
        return notes;
    }

    function buildExplicitSkillBonusMap(skillBonuses) {
        var map = {};
        (skillBonuses || []).forEach(function (entry) {
            var bonus = safeNumber(entry && entry.bonus);
            if (bonus === null) {
                return;
            }
            asArray(entry.skills).forEach(function (skillName) {
                var descriptor = parseSkillDescriptor(skillName);
                if (!descriptor) {
                    return;
                }
                if (!map[descriptor]) {
                    map[descriptor] = 0;
                }
                map[descriptor] += bonus;
            });
        });
        return map;
    }

    function classifySpellSection(sectionType, identity) {
        var lowered = trim(sectionType).toLowerCase();
        var classNames = ((identity && identity.classes) || []).map(function (entry) {
            return String(entry.name || '').toLowerCase();
        }).join(' ');
        var i;
        if (lowered.indexOf('spell-like') !== -1 || lowered.indexOf('spell like') !== -1) {
            return 'special';
        }
        if (lowered.indexOf('imbued') !== -1) {
            return 'special';
        }
        for (i = 0; i < DIVINE_SECTION_KEYWORDS.length; i += 1) {
            if (lowered.indexOf(DIVINE_SECTION_KEYWORDS[i]) !== -1) {
                return 'divine';
            }
        }
        for (i = 0; i < ARCANE_SECTION_KEYWORDS.length; i += 1) {
            if (lowered.indexOf(ARCANE_SECTION_KEYWORDS[i]) !== -1) {
                return 'arcane';
            }
        }
        if (/^spells?\s+(prepared|known)\b/i.test(sectionType)) {
            for (i = 0; i < DIVINE_SECTION_KEYWORDS.length; i += 1) {
                if (classNames.indexOf(DIVINE_SECTION_KEYWORDS[i]) !== -1) {
                    return 'divine';
                }
            }
            for (i = 0; i < ARCANE_SECTION_KEYWORDS.length; i += 1) {
                if (classNames.indexOf(ARCANE_SECTION_KEYWORDS[i]) !== -1) {
                    return 'arcane';
                }
            }
        }
        return 'arcane';
    }

    function parseSpellLevelLabel(label) {
        var cleaned = trim(label);
        var match = cleaned.match(/^(\d+)(?:st|nd|rd|th)?(?:\s*\(([^)]+)\))?$/i);
        if (match) {
            return {
                level: safeNumber(match[1]),
                usage: trim(match[2] || '')
            };
        }
        return {
            level: null,
            usage: cleaned
        };
    }

    function buildSpellEntries(spellSections, modelWarnings, identity) {
        var entries = [];
        asArray(spellSections).forEach(function (section) {
            var sectionKind = classifySpellSection(section.type || '', identity);
            asArray(section.groups).forEach(function (group) {
                var labelInfo = parseSpellLevelLabel(group.label || '');
                asArray(group.spells).forEach(function (spell) {
                    entries.push({
                        sectionType: trim(section.type || ''),
                        sectionKind: sectionKind,
                        casterLevel: section.caster_level || '',
                        headerExtras: trim(section.extras || ''),
                        groupLabel: trim(group.label || ''),
                        level: labelInfo.level,
                        usage: labelInfo.usage,
                        spell: spell
                    });
                });
            });
        });

        if (!entries.length) {
            modelWarnings.push('No spell entries found in offense.spell_sections.');
        }
        return entries;
    }

    function parseCasterLevel(value) {
        return firstNumericMatch(/(\d+)/, value);
    }

    function extractSpellDc(spell) {
        var details = (spell && spell.details) || {};
        if (details.dc !== undefined) {
            return safeNumber(details.dc);
        }
        return null;
    }

    function extractSpellPreparedCount(entry) {
        var detailText = trim(entry.spell && entry.spell.details && entry.spell.details.detail || '');
        if (/^\d+$/.test(detailText)) {
            return detailText;
        }
        return '';
    }

    function extractSpellPerDayValue(entry) {
        var explicitUsage = trim(entry.usage || '');
        var match = explicitUsage.match(/^\d+/);
        return match ? match[0] : '';
    }

    function extractSpellDetailText(spell) {
        var detailText = trim(spell && spell.details && spell.details.detail || '');
        if (!detailText || /^\d+$/.test(detailText)) {
            return '';
        }
        return detailText;
    }

    function getSpellPreparedCount(entry) {
        if (entry.spell && entry.spell.details && entry.spell.details.prepared === false) {
            return 0;
        }
        if (/known|spellbook/i.test(entry.sectionType || '')) {
            return 0;
        }
        var explicitCount = safeNumber(extractSpellPreparedCount(entry));
        if (explicitCount !== null) {
            return explicitCount;
        }
        if (entry.sectionKind === 'special') {
            return 0;
        }
        return 1;
    }

    function collapseSpellEntriesForSheet(entries) {
        var collapsed = [];
        var grouped = {};

        (entries || []).forEach(function (entry) {
            var key;
            var clone;
            if (entry.sectionKind === 'special' || entry.level === null) {
                clone = Object.assign({}, entry);
                clone.preparedCount = getSpellPreparedCount(entry);
                collapsed.push(clone);
                return;
            }

            key = [
                entry.sectionKind,
                entry.sectionType,
                entry.level,
                normalizeLookupText(entry.spell && entry.spell.name || '')
            ].join('|');

            if (!grouped[key]) {
                clone = Object.assign({}, entry);
                clone.preparedCount = getSpellPreparedCount(entry);
                grouped[key] = clone;
                collapsed.push(clone);
                return;
            }

            grouped[key].preparedCount += getSpellPreparedCount(entry);
        });

        return collapsed;
    }

    function escapeMacroText(value) {
        return String(normalizeText(value || '')).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    }

    function buildFallbackSpellMacro(characterName, sectionEntry) {
        var spell = sectionEntry.spell;
        var notes = [];
        var dc = extractSpellDc(spell);
        var label = spell.name || 'Spell';
        var prepValue = sectionEntry.preparedCount ? String(sectionEntry.preparedCount) : '';
        var perDayValue = extractSpellPerDayValue(sectionEntry);
        var detailText = extractSpellDetailText(spell);
        notes.push(spell.raw || label);
        if (sectionEntry.casterLevel) {
            notes.push('Caster level ' + sectionEntry.casterLevel + '.');
        }
        if (sectionEntry.groupLabel) {
            notes.push('Usage: ' + sectionEntry.groupLabel + '.');
        }
        if (prepValue) {
            notes.push('Prepared: ' + prepValue + '.');
        }
        if (perDayValue) {
            notes.push('Slots per day: ' + perDayValue + '.');
        }
        if (dc !== null) {
            notes.push('Save DC ' + dc + '.');
        }
        if (detailText) {
            notes.push(detailText + '.');
        }
        return '&{template:DnD35StdRoll} ' +
            '{{spellflag=true}} ' +
            '{{name=' + escapeMacroText(characterName) + ' }} ' +
            '{{subtags=casts ' + escapeMacroText(label) + '.}} ' +
            '{{notes=' + escapeMacroText(notes.join(' ')) + ' }}';
    }

    function buildReferenceSpellMacro(characterName, sectionEntry) {
        var spell = sectionEntry.spell || {};
        var reference = spell.reference || {};
        var notes = [
            trim(reference.compact_rules || ''),
            trim(reference.body || '')
        ].filter(Boolean).join(' ');
        return '&{template:DnD35StdRoll} ' +
            '{{spellflag=true}} ' +
            '{{name=' + escapeMacroText(characterName) + ' }} ' +
            '{{subtags=casts ' + escapeMacroText(spell.name || reference.name || 'Spell') + '.}} ' +
            '{{notes=' + escapeMacroText(notes || reference.raw || spell.raw || '') + ' }}';
    }

    function rewriteSpellConcentrationSection(macro) {
        var compcheckMatch = macro.match(/\{\{compcheck=([\s\S]*?)\}\}/i);
        var queryMatch;
        var replacement;
        if (!compcheckMatch || compcheckMatch[1].indexOf('@{concentration}') === -1) {
            return macro;
        }

        queryMatch = compcheckMatch[1].match(/\?\{[^}]+\}/);
        replacement = '{{Concentration:= [[ 1d20 + [[ @{concentration} ]] ]] vs DC ' + (queryMatch ? queryMatch[0] : '?{Concentration DC|16}') + '}}';
        macro = macro.replace(compcheckMatch[0], replacement);
        macro = macro.replace(/\s*\{\{succeedcheck=[\s\S]*?\}\}/i, '');
        macro = macro.replace(/\s*\{\{failcheck=[\s\S]*?\}\}/i, '');
        return macro;
    }

    function adaptSpellMacro(sectionEntry) {
        var spell = sectionEntry.spell;
        var macro = normalizeText(spell.macro_text || '');
        var casterLevel = parseCasterLevel(sectionEntry.casterLevel);
        var dc = extractSpellDc(spell);

        if (spell.reference && (spell.reference.compact_rules || spell.reference.body || spell.reference.raw)) {
            return buildReferenceSpellMacro('@{character_name}', sectionEntry);
        }

        if (!macro) {
            return buildFallbackSpellMacro('@{character_name}', sectionEntry);
        }

        if (casterLevel !== null) {
            macro = macro
                .replace(/@\{casterlevel2\}/g, String(casterLevel))
                .replace(/@\{casterlevel\}/g, String(casterLevel))
                .replace(/@\{divinecasterlevel\}/g, String(casterLevel))
                .replace(/@\{arcanecasterlevel\}/g, String(casterLevel));
        }

        if (dc !== null) {
            macro = macro
                .replace(/@\{spelldc\d+\}/g, String(dc))
                .replace(/@\{divinespelldc\d+\}/g, String(dc))
                .replace(/@\{arcanespelldc\d+\}/g, String(dc));
        }

        macro = rewriteSpellConcentrationSection(macro);

        if (sectionEntry.sectionKind === 'special' && sectionEntry.groupLabel) {
            macro += ' {{notes=' + escapeMacroText(sectionEntry.groupLabel + (spell.raw ? ' - ' + spell.raw : '')) + ' }}';
        }
        return macro;
    }

    function normalizeHeader(header) {
        var ancestry = trim(header.ancestry || '');
        var typeLine = trim(header.alignment_size_type || '');
        var sourceReference = trim(header.source_reference || '');

        if (!typeLine && looksLikeTypeLine(ancestry)) {
            typeLine = ancestry;
            ancestry = '';
        } else if (looksLikeTypeLine(ancestry) && looksLikeSourceReference(typeLine)) {
            sourceReference = typeLine;
            typeLine = ancestry;
            ancestry = '';
        }

        var alignmentInfo = splitAlignmentSizeType(typeLine);
        var genderDescriptor = splitGenderAndDescriptor(ancestry);
        return {
            ancestry: ancestry,
            sourceReference: sourceReference,
            typeLine: typeLine,
            alignment: alignmentInfo.alignment,
            sizeWord: alignmentInfo.sizeWord || 'Medium',
            sizeMod: alignmentInfo.sizeMod || 0,
            typeText: alignmentInfo.typeText,
            gender: genderDescriptor.gender,
            descriptor: genderDescriptor.descriptor,
            classes: asArray(header.classes)
        };
    }

    function escapeRegExp(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function stripAgeQualifiers(text) {
        var result = trim(text);
        AGE_QUALIFIER_WORDS.forEach(function (qualifier) {
            var pattern = new RegExp('^' + escapeRegExp(qualifier) + '\\s+', 'i');
            result = trim(result.replace(pattern, ''));
        });
        return result;
    }

    function parseClassLevels(text) {
        var cleaned = trim(normalizeText(text));
        var match = cleaned.match(/^(.*?)(?:\s+)((?:[^/]+?\s+\d+(?:\s*\/\s*[^/]+?\s+\d+)*))$/);
        var classLevels = [];
        if (!match) {
            return {
                raceText: cleaned,
                classes: classLevels
            };
        }
        match[2].split(/\s*\/\s*/).forEach(function (segment) {
            var classMatch = trim(segment).match(/^(.*\D)\s+(\d+)$/);
            if (classMatch) {
                classLevels.push({
                    name: toDisplayCase(classMatch[1]),
                    level: safeNumber(classMatch[2]) || 0
                });
            }
        });
        if (!classLevels.length) {
            return {
                raceText: cleaned,
                classes: []
            };
        }
        return {
            raceText: trim(match[1]),
            classes: classLevels
        };
    }

    function parseIdentity(normalizedHeader, defaultRaceName) {
        var descriptor = trim(normalizedHeader.descriptor || '');
        var parsed = parseClassLevels(descriptor);
        var explicitClasses = asArray(normalizedHeader.classes).map(function (entry) {
            return {
                name: toDisplayCase(entry && entry.name || ''),
                level: safeNumber(entry && entry.level) || 0
            };
        }).filter(function (entry) {
            return entry.name && entry.level > 0;
        });
        var raceText = parsed.raceText || descriptor || trim(defaultRaceName || '') || normalizedHeader.typeText || '';
        var classes = explicitClasses.length ? explicitClasses : parsed.classes;
        if (classes.length) {
            raceText = stripAgeQualifiers(raceText);
        }
        return {
            race: toDisplayCase(raceText || trim(defaultRaceName || '') || normalizedHeader.typeText || ''),
            classes: classes
        };
    }

    function parseEnhancementBonus(text) {
        return firstNumericMatch(/(?:^|\s)\+(\d+)\b/, text);
    }

    function buildEquipmentProfile(itemText, template, category) {
        var cleaned = normalizeLookupText(itemText);
        var enhancement = parseEnhancementBonus(cleaned) || 0;
        var isMasterwork = enhancement > 0 || /\b(?:masterwork|mwk)\b/i.test(cleaned);
        var profile = {
            category: category,
            raw: trim(itemText),
            displayName: toDisplayCase(trim(itemText)),
            baseName: template.name,
            bonus: template.bonus + enhancement,
            type: template.type || '',
            maxDex: template.maxDex !== undefined ? template.maxDex : 20,
            checkPenalty: template.checkPenalty || 0,
            spellFailure: template.spellFailure || 0,
            properties: []
        };

        if (enhancement > 0) {
            profile.properties.push('+' + enhancement + ' enhancement');
        }
        if (isMasterwork && profile.checkPenalty < 0) {
            profile.checkPenalty = Math.min(0, profile.checkPenalty + 1);
            profile.properties.push('Masterwork');
        }
        if (/\bmithral\b/i.test(cleaned)) {
            profile.maxDex += 2;
            profile.checkPenalty = Math.min(0, profile.checkPenalty + 3);
            profile.spellFailure = Math.max(0, profile.spellFailure - 10);
            if (profile.type === 'Medium') {
                profile.type = 'Light';
            } else if (profile.type === 'Heavy') {
                profile.type = 'Medium';
            }
            profile.properties.push('Mithral');
        }
        profile.checkPenalty = Math.min(0, profile.checkPenalty);
        return profile;
    }

    function findEquipmentProfile(itemText, table, category) {
        var cleaned = normalizeLookupText(itemText);
        var i;
        for (i = 0; i < table.length; i += 1) {
            if (cleaned.indexOf(table[i].key) !== -1) {
                return buildEquipmentProfile(itemText, table[i], category);
            }
        }
        return null;
    }

    function analyzeEquipment(possessions) {
        var result = {
            armor: null,
            shield: null,
            totalArmorCheckPenalty: 0
        };
        (possessions || []).forEach(function (item) {
            if (!result.armor) {
                result.armor = findEquipmentProfile(item, ARMOR_ITEMS, 'armor');
            }
            if (!result.shield) {
                result.shield = findEquipmentProfile(item, SHIELD_ITEMS, 'shield');
            }
        });
        if (result.armor) {
            result.totalArmorCheckPenalty += result.armor.checkPenalty;
        }
        if (result.shield) {
            result.totalArmorCheckPenalty += result.shield.checkPenalty;
        }
        return result;
    }

    function effectiveDexBonusForAc(model) {
        var dexMod = abilityMod(model.abilities.dex || 10);
        var maxDex = model.equipment && model.equipment.armor ? model.equipment.armor.maxDex : 99;
        if (dexMod > maxDex) {
            return maxDex;
        }
        return dexMod;
    }

    function takeSharedPositive(a, b, c) {
        if (a <= 0 || b <= 0 || c <= 0) {
            return 0;
        }
        return Math.min(a, b, c);
    }

    function analyzeAcBreakdown(model) {
        var dexMod = effectiveDexBonusForAc(model);
        var sizeMod = model.normalizedHeader.sizeMod || 0;
        var armorBonus = model.equipment && model.equipment.armor ? model.equipment.armor.bonus : 0;
        var shieldBonus = model.equipment && model.equipment.shield ? model.equipment.shield.bonus : 0;
        var flatDex = dexMod < 0 ? dexMod : 0;
        var standardResidual = (model.ac.total !== null ? model.ac.total : 10 + dexMod + sizeMod + armorBonus + shieldBonus) - (10 + dexMod + sizeMod + armorBonus + shieldBonus);
        var touchResidual = (model.ac.touch !== null ? model.ac.touch : 10 + dexMod + sizeMod) - (10 + dexMod + sizeMod);
        var flatResidual = (model.ac.flat !== null ? model.ac.flat : 10 + flatDex + sizeMod + armorBonus + shieldBonus) - (10 + flatDex + sizeMod + armorBonus + shieldBonus);
        var commonBonus = takeSharedPositive(standardResidual, touchResidual, flatResidual);
        var naturalBonus;
        var dodgeBonus;

        standardResidual -= commonBonus;
        touchResidual -= commonBonus;
        flatResidual -= commonBonus;

        naturalBonus = takeSharedPositive(standardResidual, flatResidual, 9999);
        standardResidual -= naturalBonus;
        flatResidual -= naturalBonus;

        dodgeBonus = takeSharedPositive(standardResidual, touchResidual, 9999);
        standardResidual -= dodgeBonus;
        touchResidual -= dodgeBonus;

        return {
            armorBonus: armorBonus,
            shieldBonus: shieldBonus,
            commonBonus: commonBonus,
            naturalBonus: naturalBonus,
            dodgeBonus: dodgeBonus,
            standardOnlyBonus: standardResidual,
            touchOnlyBonus: touchResidual,
            flatOnlyBonus: flatResidual
        };
    }

    function formatSignedBonus(bonus, label) {
        return (bonus >= 0 ? '+' : '') + bonus + ' ' + label;
    }

    function buildAcInfoText(model) {
        var parts = ['10 base'];
        var dexMod = effectiveDexBonusForAc(model);
        if (dexMod) {
            parts.push(formatSignedBonus(dexMod, 'Dex'));
        }
        if (model.normalizedHeader.sizeMod) {
            parts.push(formatSignedBonus(model.normalizedHeader.sizeMod, 'size'));
        }
        if (model.equipment && model.equipment.armor) {
            parts.push(formatSignedBonus(model.equipment.armor.bonus, model.equipment.armor.baseName));
        }
        if (model.equipment && model.equipment.shield) {
            parts.push(formatSignedBonus(model.equipment.shield.bonus, model.equipment.shield.baseName));
        }
        if (model.acBreakdown.naturalBonus) {
            parts.push(formatSignedBonus(model.acBreakdown.naturalBonus, 'Natural Armor'));
        }
        if (model.acBreakdown.commonBonus) {
            parts.push(formatSignedBonus(model.acBreakdown.commonBonus, 'Deflection/Misc'));
        }
        if (model.acBreakdown.dodgeBonus) {
            parts.push(formatSignedBonus(model.acBreakdown.dodgeBonus, 'Dodge'));
        }
        if (model.acBreakdown.standardOnlyBonus) {
            parts.push(formatSignedBonus(model.acBreakdown.standardOnlyBonus, 'AC Only'));
        }
        return parts.join(', ');
    }

    function parseSkillEntry(raw) {
        var cleaned = trim(normalizeText(raw));
        var note = '';
        var match = cleaned.match(/^(.*?)\s+([+-]?\d+)\s+\(([^()]*)\)$/);
        var namePart;
        var specialtyMatch;
        if (!match) {
            match = cleaned.match(/^(.*?)\s+([+-]?\d+)$/);
        }
        if (!match) {
            return null;
        }
        if (match.length > 3) {
            note = trim(match[3] || '');
        }
        namePart = trim(match[1]);
        specialtyMatch = namePart.match(/^(.+?)\s*\(([^)]+)\)$/);
        return {
            raw: cleaned,
            namePart: namePart,
            total: safeNumber(match[2]),
            note: note,
            baseName: specialtyMatch ? trim(specialtyMatch[1]) : namePart,
            specialty: specialtyMatch ? trim(specialtyMatch[2]) : ''
        };
    }

    function canonicalSkillKey(value) {
        return normalizeLookupText(value).replace(/\s+/g, '');
    }

    function canonicalSkillDescriptor(baseName, specialty) {
        var baseKey = canonicalSkillKey(baseName);
        var specialtyKey = canonicalSkillKey(specialty);
        if (!baseKey) {
            return '';
        }
        if (specialtyKey && (baseKey === 'knowledge' || baseKey === 'craft' || baseKey === 'perform' || baseKey === 'profession')) {
            return baseKey + ':' + specialtyKey;
        }
        return baseKey;
    }

    function parseSkillDescriptor(value) {
        var cleaned = trim(normalizeText(value)).replace(/\[/g, '(').replace(/\]/g, ')');
        var match = cleaned.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (match) {
            return canonicalSkillDescriptor(match[1], match[2]);
        }
        return canonicalSkillDescriptor(cleaned, '');
    }

    function getFeatSkillBonus(feats, entry) {
        var entryBaseKey = canonicalSkillKey(entry.baseName);
        var entryDescriptor = canonicalSkillDescriptor(entry.baseName, entry.specialty);
        var totalBonus = 0;

        (feats || []).forEach(function (rawFeat) {
            var featText = trim(normalizeText(rawFeat));
            var featKey = canonicalSkillKey(featText);
            var mappings = FEAT_SKILL_BONUSES[featKey];
            var skillFocusMatch;

            if (mappings) {
                mappings.forEach(function (mapping) {
                    if (mapping.skill === entryBaseKey) {
                        totalBonus += mapping.bonus;
                    }
                });
            }

            skillFocusMatch = featText.match(/^skill\s*focus\s*[\(\[]?\s*(.+?)\s*[\)\]]?$/i);
            if (skillFocusMatch && parseSkillDescriptor(skillFocusMatch[1]) === entryDescriptor) {
                totalBonus += 3;
            }
        });

        return totalBonus;
    }

    function getFeatSaveBonuses(feats) {
        var totals = { fort: 0, ref: 0, will: 0 };

        (feats || []).forEach(function (rawFeat) {
            var featKey = canonicalSkillKey(rawFeat);
            var bonus = FEAT_SAVE_BONUSES[featKey];
            if (!bonus) {
                return;
            }
            totals.fort += bonus.fort || 0;
            totals.ref += bonus.ref || 0;
            totals.will += bonus.will || 0;
        });

        return totals;
    }

    function abilityModifierForSkill(model, abilityName) {
        return abilityMod(model.abilities[abilityName] || 10);
    }

    function formatSkillNote(entry) {
        var note = trim(entry && entry.note || '');
        var match;
        var altTotal;
        var delta;
        var descriptor;

        if (!note) {
            return '';
        }

        match = note.match(/^([+-]?\d+)\s+(.+)$/);
        if (!match) {
            return note;
        }

        altTotal = safeNumber(match[1]);
        if (altTotal === null || entry.total === null) {
            return note;
        }

        delta = altTotal - entry.total;
        if (!delta) {
            return '';
        }

        descriptor = trim(match[2] || '');
        if (descriptor && !/^(?:when|while|against|on|for|to|in|under|with|during|if|as|versus|vs\.?)\b/i.test(descriptor)) {
            descriptor = 'when ' + descriptor;
        }

        return '(' + (delta >= 0 ? '+' : '') + delta + (descriptor ? ' ' + descriptor : '') + ')';
    }

    function combineSkillNotes() {
        var combined = [];
        Array.prototype.slice.call(arguments).forEach(function (note) {
            var normalized = trim(note || '');
            if (normalized && combined.indexOf(normalized) === -1) {
                combined.push(normalized);
            }
        });
        return combined.join('; ');
    }

    function inferSkillRanks(residual, maxRanks) {
        if (residual <= 0) {
            return 0;
        }
        return Math.min(residual, Math.max(0, maxRanks));
    }

    function buildSkillImportData(model) {
        var attrs = {};
        var warnings = [];
        var customSlotsUsed = {
            craft: 0,
            perform: 0,
            profession: 0
        };
        var maxRanks = (model.hp.hd || 0) + 3;
        var hideSizeBonus = 4 * (model.normalizedHeader.sizeMod || 0);
        var armorPenalty = model.equipment ? model.equipment.totalArmorCheckPenalty : 0;

        function applySkill(attrBase, rule, entry) {
            var base = abilityModifierForSkill(model, rule.ability);
            var armorComponent = (rule.armorCheckMultiplier || 0) * armorPenalty;
            var residual;
            var nonRankResidual;
            var featBonus;
            var ranks;
            var misc;
            var note = formatSkillNote(entry);
            var specialty = entry.specialty || '';
            var descriptor = canonicalSkillDescriptor(entry.baseName, entry.specialty);
            var contextualNotes = (model.skillContextNotes && model.skillContextNotes[descriptor]) || [];
            var explicitMiscBonus = model.explicitSkillBonuses && model.explicitSkillBonuses[descriptor] || 0;

            if (rule.hideSize) {
                base += hideSizeBonus;
            }
            residual = entry.total - base - armorComponent;
            featBonus = getFeatSkillBonus(model.feats, entry);
            nonRankResidual = residual - featBonus - explicitMiscBonus;
            ranks = inferSkillRanks(nonRankResidual, maxRanks);
            misc = residual - ranks;

            attrs[attrBase + 'ranks'] = ranks;
            attrs[attrBase + 'miscmod'] = misc;
            attrs[attrBase + 'classskill'] = ranks > 0 ? 1 : 0;
            note = combineSkillNotes.apply(null, [note].concat(contextualNotes));
            if (note) {
                attrs[attrBase + 'note'] = note;
            }
            if (specialty) {
                attrs[attrBase + 'name'] = toDisplayCase(specialty);
            }
            if (rule.statSelect === 'str') {
                attrs[attrBase + 'stat'] = '@{str-mod} ';
            } else if (rule.statSelect === 'dex') {
                attrs[attrBase + 'stat'] = '@{dex-mod} ';
            }
        }

        (model.skills || []).forEach(function (rawSkill) {
            var entry = parseSkillEntry(rawSkill);
            var baseKey;
            var rule;
            var slotType;
            var slotNumber;
            var knowledgeKey;
            if (!entry || entry.total === null) {
                warnings.push('Could not parse skill entry: ' + rawSkill);
                return;
            }

            baseKey = canonicalSkillKey(entry.baseName);
            if (baseKey === 'knowledge') {
                var specialtyKey = normalizeLookupText(entry.specialty);
                knowledgeKey = KNOWLEDGE_SKILL_RULES[specialtyKey];
                if (!knowledgeKey) {
                    Object.keys(KNOWLEDGE_SKILL_RULES).forEach(function (candidate) {
                        if (!knowledgeKey && specialtyKey.indexOf(candidate) !== -1) {
                            knowledgeKey = KNOWLEDGE_SKILL_RULES[candidate];
                        }
                    });
                }
                if (!knowledgeKey) {
                    warnings.push('Unmapped Knowledge specialty: ' + entry.raw);
                    return;
                }
                applySkill(knowledgeKey, { attr: knowledgeKey, ability: 'int' }, entry);
                return;
            }

            if (baseKey === 'craft' || baseKey === 'perform' || baseKey === 'profession') {
                slotType = baseKey;
                customSlotsUsed[slotType] += 1;
                slotNumber = customSlotsUsed[slotType];
                if (slotNumber > CUSTOM_SKILL_SLOTS[slotType]) {
                    warnings.push('No open ' + slotType + ' slot for skill: ' + entry.raw);
                    return;
                }
                rule = {
                    ability: slotType === 'profession' ? 'wis' : (slotType === 'perform' ? 'cha' : 'int')
                };
                applySkill(slotType + slotNumber, rule, entry);
                return;
            }

            rule = SKILL_RULES[baseKey];
            if (!rule) {
                warnings.push('Unmapped skill entry: ' + entry.raw);
                return;
            }
            applySkill(rule.attr, rule, entry);
        });

        return {
            attrs: attrs,
            warnings: warnings
        };
    }

    function normalizeAbilitySummaryName(value) {
        return normalizeLookupText(
            trim(normalizeText(value || ''))
                .replace(/\((?:Ex|Sp|Su)\)/ig, '')
                .replace(/\([^)]*\)/g, '')
                .replace(/[:.;]+$/g, '')
        );
    }

    function splitAbilitySummaryText(value) {
        return String(value || '')
            .split(/\s*[;,]\s*/)
            .map(function (part) {
                return trim(part);
            })
            .filter(Boolean);
    }

    function buildKnownRacialAbilityNameSet(creature) {
        var known = {};
        asArray(creature.special_abilities).forEach(function (ability) {
            var key = normalizeAbilitySummaryName(ability && (ability.name || ability.raw));
            if (key) {
                known[key] = true;
            }
        });
        return known;
    }

    var CLASS_FEATURE_NAMES_BY_CLASS = {
        cleric: {
            'destruction domain': true,
            'fire domain': true,
            'rebuke undead': true,
            'spontaneous casting': true,
            'turn undead': true
        },
        druid: {
            'animal companion': true,
            'nature sense': true,
            'resist nature s lure': true,
            spells: true,
            'spontaneous casting': true,
            'trackless step': true,
            'wild empathy': true,
            'wild shape': true,
            'woodland stride': true
        },
        'dread pirate': {
            'fearsome reputation': true,
            seamanship: true,
            'sneak attack': true
        },
        monk: {
            evasion: true,
            'flurry of blows': true
        },
        ranger: {
            'favored enemy': true,
            'wild empathy': true
        },
        rogue: {
            evasion: true,
            'improved uncanny dodge': true,
            'sneak attack': true,
            'trap sense': true,
            trapfinding: true,
            'uncanny dodge': true
        },
        sorcerer: {
            familiar: true,
            'sorcerer spellcasting': true
        },
        tempest: {
            ambidexterity: true,
            'tempest defense': true
        }
    };

    function isClassFeatureEntry(entry, identity) {
        var entryKey = normalizeAbilitySummaryName(entry && entry.name);
        if (!entryKey) {
            return false;
        }
        return asArray(identity && identity.classes).some(function (classEntry) {
            var classKey = normalizeLookupText(classEntry && classEntry.name);
            return CLASS_FEATURE_NAMES_BY_CLASS[classKey] &&
                CLASS_FEATURE_NAMES_BY_CLASS[classKey][entryKey] === true;
        });
    }

    function shouldKeepHpInlineNoteInClassAbilities(note) {
        return !/^DR\b/i.test(trim(normalizeText(note || '')));
    }

    function filterDuplicateAbilitySummaries(value, knownAbilityNames, seenSummaryNames) {
        return splitAbilitySummaryText(value).filter(function (part) {
            var key = normalizeAbilitySummaryName(part);
            var duplicatesFullEntry = key && Object.keys(knownAbilityNames).some(function (knownKey) {
                return key === knownKey || key.indexOf(knownKey + ' ') === 0;
            });
            if (duplicatesFullEntry) {
                return false;
            }
            if (key && seenSummaryNames[key]) {
                return false;
            }
            if (key) {
                seenSummaryNames[key] = true;
            }
            return true;
        }).map(function (part) {
            return toDisplayCase(part);
        }).join(', ');
    }

    function buildTextBundles(creature, normalizedHeader, identity) {
        var defense = creature.defense || {};
        var offense = creature.offense || {};
        var stats = creature.statistics || {};
        var extra = splitBioAndMechanicalText(creature.bio_notes || '');
        var classAbilityParts = [];
        var racialAbilityParts = [];
        var otherParts = [];
        var bioParts = [];
        var knownRacialAbilityNames = buildKnownRacialAbilityNameSet(creature);
        var seenClassAbilityNames = {};
        var ordinaryEntries = asArray(creature.ordinary_entries);

        function pushClassAbilitySummary(value) {
            var filtered = filterDuplicateAbilitySummaries(value, knownRacialAbilityNames, seenClassAbilityNames);
            if (filtered) {
                classAbilityParts.push(filtered);
            }
        }

        if (stats.sq_line) {
            pushClassAbilitySummary(stripPrefix(stats.sq_line, 'SQ\\s+'));
        }
        extractInlineNotes(defense.ac_line).forEach(function (note) {
            pushClassAbilitySummary(note);
        });
        extractInlineNotes(defense.hp_line).forEach(function (note) {
            if (shouldKeepHpInlineNoteInClassAbilities(note)) {
                pushClassAbilitySummary(note);
            }
        });
        if (ordinaryEntries.length) {
            ordinaryEntries.forEach(function (entry) {
                if (!entry || !entry.raw || entry.type_style === 'bracketed') {
                    return;
                }
                if (normalizeLookupText(entry.name) === 'skills') {
                    otherParts.push(entry.raw);
                    return;
                }
                if (isClassFeatureEntry(entry, identity)) {
                    classAbilityParts.push(entry.raw);
                } else {
                    racialAbilityParts.push(entry.raw);
                }
            });
        } else {
            asArray(creature.special_abilities).forEach(function (ability) {
                if (ability && ability.raw) {
                    racialAbilityParts.push(ability.raw);
                }
            });
        }
        if (extra.mechanical) {
            racialAbilityParts.push(extra.mechanical);
        }

        asArray(creature.header && creature.header.aura_lines).forEach(function (line) {
            racialAbilityParts.push(stripPrefix(line, 'Aura\\s+'));
        });
        if (creature.header && creature.header.languages_line) {
            pushClassAbilitySummary(extractLanguageHeaderExtras(creature.header.languages_line));
        }
        if (offense.special_actions_line) {
            pushClassAbilitySummary(stripPrefix(offense.special_actions_line, 'Special Actions?\\s+'));
        }
        if (offense.attack_options_line) {
            pushClassAbilitySummary(stripPrefix(offense.attack_options_line, 'Atk Options\\s+'));
        }

        if (defense.immune_line) {
            otherParts.push(defense.immune_line);
        }
        if (defense.resist_line) {
            otherParts.push(defense.resist_line);
        }
        if (defense.weaknesses_line) {
            otherParts.push(defense.weaknesses_line);
        }
        if (offense.space_reach_line) {
            otherParts.push(offense.space_reach_line);
        }
        asArray(stats.other_lines).forEach(function (line) {
            otherParts.push(line);
        });
        asArray(offense.other_lines).forEach(function (line) {
            otherParts.push(line);
        });
        if (creature.lower_skills_entry && creature.lower_skills_entry.raw) {
            otherParts.push(creature.lower_skills_entry.raw);
        }
        if (creature.spell_reference && asArray(creature.spell_reference.levels).length) {
            var spellReferenceParts = [creature.spell_reference.heading || 'Spell Reference'];
            asArray(creature.spell_reference.levels).forEach(function (level) {
                spellReferenceParts.push(level.label || (String(level.level) + '-Level Spells'));
                asArray(level.spells).forEach(function (spell) {
                    spellReferenceParts.push(spell.raw || [
                        spell.name,
                        spell.compact_rules,
                        spell.body
                    ].filter(Boolean).join('\n'));
                });
            });
            otherParts.push(spellReferenceParts.join('\n\n'));
        }

        if (normalizedHeader.sourceReference) {
            bioParts.push('Source: ' + normalizedHeader.sourceReference);
        }
        if (extra.bio) {
            bioParts.push(extra.bio);
        }

        return {
            racialAbilities: trim(racialAbilityParts.join('\n\n')),
            classAbilities: trim(classAbilityParts.join('\n\n')),
            other: trim(otherParts.join('\n\n')),
            otherInfo: '',
            bio: trim(bioParts.join('\n\n'))
        };
    }

    function parseAttackFragment(raw, attackType) {
        var result = {
            raw: trim(raw),
            attackType: attackType,
            count: 1,
            touch: false,
            displayName: '',
            attackBonuses: [],
            damage: '',
            critMin: 20,
            critMultiplier: 2,
            notes: [],
            damageNotes: '',
            enhancementBonus: 0
        };
        var text = normalizeText(raw);
        var leadingCount = text.match(/^(\d+)\s+/);
        if (leadingCount) {
            result.count = safeNumber(leadingCount[1]) || 1;
        }

        var match = text.match(/^(.*?)\s+([+-]\d+(?:\/[+-]\d+)*)\b(.*)$/);
        if (!match) {
            result.displayName = toDisplayCase(trim(text));
            result.notes.push(text);
            return result;
        }

        result.displayName = trim(match[1].replace(/^\d+\s+/, ''));
        if (/claws$/i.test(result.displayName) && result.count > 1) {
            result.displayName = result.displayName.replace(/claws$/i, 'claw');
        }
        if (/bites$/i.test(result.displayName) && result.count > 1) {
            result.displayName = result.displayName.replace(/bites$/i, 'bite');
        }
        if (/slams$/i.test(result.displayName) && result.count > 1) {
            result.displayName = result.displayName.replace(/slams$/i, 'slam');
        }
        result.enhancementBonus = parseEnhancementBonus(result.displayName) || 0;
        result.displayName = toDisplayCase(result.displayName);
        result.attackBonuses = match[2].split('/').map(function (value) {
            return safeNumber(value);
        }).filter(function (value) {
            return value !== null;
        });

        var trailing = trim(match[3]);
        if (/touch/i.test(trailing)) {
            result.touch = true;
        }
        var parenMatch = trailing.match(/\(([^)]+)\)/);
        if (parenMatch) {
            parseDamageText(parenMatch[1], result);
        } else if (trailing) {
            result.notes.push(trailing);
        }
        if (result.count > 1) {
            result.notes.push('Normally used ' + result.count + ' times on a full attack.');
        }
        if (result.touch) {
            result.notes.push('Touch attack.');
        }
        if (!result.displayName) {
            result.displayName = trim(text);
        }
        return result;
    }

    function listHasNamedEntry(items, target) {
        var normalizedTarget = normalizeLookupText(target);
        return (items || []).some(function (item) {
            return normalizeLookupText(item) === normalizedTarget;
        });
    }

    function attackOptionsInclude(offense, target) {
        return normalizeLookupText(offense && offense.attack_options_line || '').indexOf(normalizeLookupText(target)) !== -1;
    }

    function isRapidShotVariant(weapon, feats, offense) {
        if (!weapon || weapon.attackType !== 'Ranged') {
            return false;
        }
        if (!weapon.attackBonuses || weapon.attackBonuses.length < 2) {
            return false;
        }
        if (weapon.attackBonuses[0] === null || weapon.attackBonuses[1] === null) {
            return false;
        }
        if (weapon.attackBonuses[0] !== weapon.attackBonuses[1]) {
            return false;
        }
        return listHasNamedEntry(feats, 'Rapid Shot') || attackOptionsInclude(offense, 'Rapid Shot');
    }

    function dedupeWeaponNames(weapons, feats, offense) {
        var counts = {};
        weapons.forEach(function (weapon) {
            var baseName = weapon.displayName;
            if (counts[baseName] === undefined) {
                counts[baseName] = 0;
            }
            counts[baseName] += 1;
            if (counts[baseName] > 1) {
                if (isRapidShotVariant(weapon, feats, offense)) {
                    weapon.displayName = baseName + ' (Rapid Shot x' + weapon.attackBonuses.length + ')';
                    if (weapon.notes.indexOf('Rapid Shot full attack routine.') === -1) {
                        weapon.notes.push('Rapid Shot full attack routine.');
                    }
                } else if (weapon.attackBonuses && weapon.attackBonuses.length > 1) {
                    weapon.displayName = baseName + ' (Full Attack x' + weapon.attackBonuses.length + ')';
                } else {
                    weapon.displayName = baseName + ' (' + weapon.attackType + ')';
                }
            }
        });
        return weapons;
    }

    function parseDamageText(text, result) {
        var cleaned = trim(normalizeText(text));
        var damageMatch = cleaned.match(/^(\d+d\d+(?:[+-]\d+)?)(?:\s*\/\s*((?:\d+(?:-20)?(?:\/x\d+)?)|(?:x\d+)))?(.*)$/i);
        if (damageMatch) {
            result.damage = trim(damageMatch[1]);
            var critChunk = trim(damageMatch[2] || '');
            if (critChunk) {
                var critRangeMatch = critChunk.match(/^(\d+)-20(?:\/x(\d+))?$/);
                var critMultMatch = critChunk.match(/^x(\d+)$/i);
                if (critRangeMatch) {
                    result.critMin = safeNumber(critRangeMatch[1]) || 20;
                    result.critMultiplier = safeNumber(critRangeMatch[2]) || 2;
                } else if (critMultMatch) {
                    result.critMultiplier = safeNumber(critMultMatch[1]) || 2;
                } else if (/^\d+$/.test(critChunk)) {
                    result.critMin = safeNumber(critChunk) || 20;
                }
            }
            if (trim(damageMatch[3] || '')) {
                result.damageNotes = trim(damageMatch[3]).replace(/^[;/,]+/, '');
            }
            return;
        }
        if (/^[+-]?\d+$/.test(cleaned)) {
            result.damage = cleaned;
            return;
        }
        result.damageNotes = cleaned;
    }

    function buildWeaponList(offense, feats) {
        var weapons = [];

        function pushFromLines(lines, attackType) {
            asArray(lines).forEach(function (lineEntry) {
                asArray(lineEntry.fragments).forEach(function (fragment) {
                    weapons.push(parseAttackFragment(fragment.raw, attackType));
                });
            });
        }

        pushFromLines(offense.melee_lines, 'Melee');
        pushFromLines(offense.ranged_lines, 'Ranged');
        return dedupeWeaponNames(weapons, feats, offense);
    }

    function buildCritDamage(damage, critMultiplier) {
        if (!damage) {
            return '0';
        }
        if (critMultiplier <= 2) {
            return damage;
        }
        return '((' + damage + ')*' + (critMultiplier - 1) + ')';
    }

    function splitDamageExpression(damage) {
        var cleaned = trim(damage || '');
        var match = cleaned.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
        if (/^[+-]?\d+$/.test(cleaned)) {
            return {
                diceNumber: 0,
                diceType: 0,
                flatBonus: safeNumber(cleaned) || 0
            };
        }
        if (!match) {
            return {
                diceNumber: 0,
                diceType: 0,
                flatBonus: 0
            };
        }
        return {
            diceNumber: safeNumber(match[1]) || 0,
            diceType: safeNumber(match[2]) || 0,
            flatBonus: safeNumber(match[3]) || 0
        };
    }

    function hasNamedFeat(model, featName) {
        var target = normalizeLookupText(featName);
        return (model.feats || []).some(function (feat) {
            return normalizeLookupText(feat) === target;
        });
    }

    function normalizedWeaponBaseName(weapon) {
        return normalizeLookupText(weapon.displayName || weapon.raw || '')
            .replace(/\bmasterwork\b/g, ' ')
            .replace(/\bmwk\b/g, ' ')
            .replace(/\+\d+\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isNaturalWeaponName(baseName) {
        return /^(?:slam|claw|bite|gore|hoof|tail slap|tentacle|sting|pincer|talon|wing|slam \(melee\)|claw \(melee\)|bite \(melee\))$/.test(baseName);
    }

    function isWeaponFinesseEligible(weapon) {
        var baseName = normalizedWeaponBaseName(weapon);
        var finesseWeapons = {
            dagger: true,
            'punching dagger': true,
            'spiked gauntlet': true,
            gauntlet: true,
            'unarmed strike': true,
            sickle: true,
            club: false,
            handaxe: true,
            kukri: true,
            'light hammer': true,
            'light mace': true,
            'light pick': true,
            sap: true,
            shortsword: true,
            'short sword': true,
            rapier: true,
            whip: true,
            'spiked chain': true
        };
        if (isNaturalWeaponName(baseName)) {
            return true;
        }
        return !!finesseWeapons[baseName];
    }

    function resolveWeaponAttackAbilityMod(model, weapon) {
        var strMod = abilityMod(model.abilities.str || 10);
        var dexMod = abilityMod(model.abilities.dex || 10);

        if (weapon.attackType === 'Ranged') {
            return dexMod;
        }
        if (usesDexForWeaponAttack(model, weapon)) {
            return dexMod;
        }
        return strMod;
    }

    function usesDexForWeaponAttack(model, weapon) {
        var strMod = abilityMod(model.abilities.str || 10);
        var dexMod = abilityMod(model.abilities.dex || 10);
        var firstBonus = weapon.attackBonuses.length ? weapon.attackBonuses[0] : 0;
        var baseAttack = (model.bab.bab || 0) + (model.normalizedHeader.sizeMod || 0) + (weapon.enhancementBonus || 0);
        var strResidual;
        var dexResidual;

        if (weapon.attackType === 'Ranged') {
            return true;
        }
        if (!hasNamedFeat(model, 'Weapon Finesse') || !isWeaponFinesseEligible(weapon)) {
            return false;
        }

        strResidual = Math.abs(firstBonus - (baseAttack + strMod));
        dexResidual = Math.abs(firstBonus - (baseAttack + dexMod));
        if (dexResidual < strResidual) {
            return true;
        }
        if (dexResidual === strResidual && dexMod > strMod) {
            return true;
        }
        return false;
    }

    function resolveWeaponAttackStat(model, weapon) {
        return usesDexForWeaponAttack(model, weapon) ? '@{dex-mod} ' : '@{str-mod} ';
    }

    function resolveWeaponDamageProfile(model, weapon, damageBits) {
        var enhancement = weapon.enhancementBonus || 0;
        var baseFlat = damageBits.flatBonus - enhancement;
        var strMod = abilityMod(model.abilities.str || 10);
        var halfStr = Math.floor(strMod / 2);
        var oneAndHalfStr = strMod + halfStr;
        var candidates;
        var best;

        if (weapon.attackType !== 'Melee') {
            return {
                expr: '0',
                value: 0
            };
        }

        candidates = [
            { expr: '@{str-mod} ', value: strMod },
            { expr: '(floor(@{str-mod}/2))', value: halfStr },
            { expr: '(@{str-mod} +floor(@{str-mod}/2))', value: oneAndHalfStr },
            { expr: '0', value: 0 }
        ];

        best = candidates[0];
        candidates.forEach(function (candidate) {
            var candidateDistance = Math.abs(baseFlat - candidate.value);
            var bestDistance = Math.abs(baseFlat - best.value);
            if (candidateDistance < bestDistance) {
                best = candidate;
                return;
            }
            if (candidateDistance === bestDistance && candidate.value > best.value) {
                best = candidate;
            }
        });

        return best;
    }

    function buildWeaponAttackCalc(prefix, attackStatExpr) {
        var isNpc = /^npcattack/.test(prefix);
        return "1d20cs>@{" + prefix + "critmin} + " +
            (isNpc ? "@{npcbaseatt}[BAB]" : "@{bab}[BAB] + @{epicattackbonus}[Epic AB]") +
            " + " + attackStatExpr + "[Ability] + " +
            (isNpc ? "@{npcsize}[size]" : "@{size}[size]") +
            " + @{" + prefix + "enh}[Weapon Enh] + @{" + prefix + "focus}[Weapon Focus] + " +
            (isNpc ? "@{npcGlobalAttackBonus}[Global Bonus]" : "@{globalAttackBonus}[Global bonus]") +
            " + @{flankEnabled}[Flank]";
    }

    function buildWeaponDamageCalc(prefix) {
        var isNpc = /^npcattack/.test(prefix);
        return "@{" + prefix + "statdamage}[Dmg] + @{" + prefix + "damagestat}[Weapon Dmg Ability] + @{" + prefix + "enh}[Weapon Enh] + @{" + prefix + "specialize}[Weapon Spec] + " +
            (isNpc ? "@{npcGlobalDamageBonus}[Global Bonus]" : "@{globalDamageBonus}[Global bonus]") +
            " + @{" + prefix + "vardamage}[Var Dmg]";
    }

    function buildWeaponCritCalc(prefix) {
        var isNpc = /^npcattack/.test(prefix);
        return "(@{" + prefix + "critmult}-1) * (@{" + prefix + "statdamage}[Dmg] + @{" + prefix + "damagestat}[Weapon Dmg Ability] + @{" + prefix + "enh}[Weapon Enh] + @{" + prefix + "specialize}[Weapon Spec] + " +
            (isNpc ? "@{npcGlobalDamageBonus}[Global Bonus]" : "@{globalDamageBonus}[Global bonus]") +
            ")";
    }

    function buildWeaponSingleAttackMacro(prefix, isNpc) {
        return "&{template:DnD35Attack} {{pcflag=true}} {{name=" + (isNpc ? "@{npcname}" : "@{character_name}") + "}} {{subtags=Attacks with the @{" + prefix + "name} }} {{attack1=Hitting AC [[ @{" + prefix + "attackcalc} ]] }} {{notes=@{" + prefix + "specialproperties} }}";
    }

    function buildWeaponAttackMacro(prefix, isNpc) {
        return "&{template:DnD35Attack} {{pcflag=true}} {{name=" + (isNpc ? "@{npcname}" : "@{character_name}") + "}} {{subtags=Attacks with a @{" + prefix + "name} }} {{attack1=hitting AC [[ @{" + prefix + "attackcalc} ]] }} {{critconfirm1=Crit?: [[ @{" + prefix + "attackcalc} ]] }} {{fumbleroll=Fumble: [[ d20 ]] }} {{damage1=for [[ @{" + prefix + "damage} ]] dmg}} {{critdmg1=+ [[ @{" + prefix + "crit} ]] crit dmg}} {{fullattackflag= [[ 0d1 ]] }} {{notes=@{" + prefix + "specialproperties} }}";
    }

    function buildWeaponFullAttackMacro(prefix, isNpc) {
        return "&{template:DnD35Attack} {{pcflag=true}} {{name=" + (isNpc ? "@{npcname}" : "@{character_name}") + "}} {{subtags=attacks with a @{" + prefix + "name} }} {{attack1=A1: [[ @{" + prefix + "attackcalc} ]] }} {{critconfirm1=Crit?: [[ @{" + prefix + "attackcalc} ]] }} {{fumbleroll=Fumble: [[ d20 ]] }} {{damage1=D1: [[ @{" + prefix + "damage} ]] }} {{critdmg1=+ [[ @{" + prefix + "crit} ]] }} {{attack2=A2: [[ @{" + prefix + "attackcalc}-5 ]] }} {{critconfirm2=Crit!: [[ @{" + prefix + "attackcalc}-5 ]] }} {{damage2=D2: [[ @{" + prefix + "damage} ]] }} {{critdmg2=+ [[ @{" + prefix + "crit} ]] }} {{attack3=A3: [[ @{" + prefix + "attackcalc}-10 ]] }} {{critconfirm3=Crit!: [[ @{" + prefix + "attackcalc}-10 ]] }} {{damage3=D3: [[ @{" + prefix + "damage} ]] }} {{critdmg3=+ [[ @{" + prefix + "crit} ]] }} {{attack4=A4: [[ @{" + prefix + "attackcalc}-15 ]] }} {{critconfirm4=Crit!: [[ @{" + prefix + "attackcalc}-15 ]] }} {{damage4=D4: [[ @{" + prefix + "damage} ]] }} {{critdmg4=+ [[ @{" + prefix + "crit} ]] }} {{fullattackflag= [[ d1 ]] }} {{notes=@{" + prefix + "specialproperties} }}";
    }

    function buildWeaponDamageMacro(prefix, isNpc) {
        return "&{template:DnD35Damage} {{pcflag=true}} {{name=" + (isNpc ? "@{npcname}" : "@{character_name}") + " }} {{subtags=Damages with the @{" + prefix + "name} }} {{damage1=Damage: [[ @{" + prefix + "damage} ]] dmg }} {{notes=@{" + prefix + "specialproperties} }}";
    }

    function buildWeaponCritMacro(prefix, isNpc) {
        return "&{template:DnD35Damage} {{pcflag=true}} {{name=" + (isNpc ? "@{npcname}" : "@{character_name}") + " }} {{subtags=Damages with the @{" + prefix + "name} }} {{damage1=Damage: [[ @{" + prefix + "damage} ]] + [[ @{" + prefix + "crit} ]] crit dmg }} {{notes=@{" + prefix + "specialproperties} }}";
    }

    function getCountBasedFullAttackBonuses(weapon) {
        var bonuses = [];
        var firstBonus = weapon && weapon.attackBonuses && weapon.attackBonuses.length ? weapon.attackBonuses[0] : 0;
        var i;
        if (!weapon || !weapon.count || weapon.count <= 1) {
            return bonuses;
        }
        if (weapon.attackBonuses && weapon.attackBonuses.length > 1) {
            return bonuses;
        }
        for (i = 0; i < weapon.count; i += 1) {
            bonuses.push(firstBonus);
        }
        return bonuses;
    }

    function shouldCreateWeaponTokenAction(weapon) {
        return !!(weapon && (!weapon.touch || weapon.attackType === 'Melee'));
    }

    function countWeaponTokenActions(model) {
        var count = 0;
        (model && model.weapons || []).forEach(function (weapon) {
            if (!shouldCreateWeaponTokenAction(weapon)) {
                return;
            }
            count += 1;
            if (getCountBasedFullAttackBonuses(weapon).length) {
                count += 1;
            }
        });
        return count;
    }

    function buildTokenActionMacro(characterName, weapon, model, attackBonusesOverride, subtagOverride) {
        var notes = [weapon.damageNotes].concat(weapon.notes).filter(Boolean).join(' ');
        var normalizedName = normalizedWeaponBaseName(weapon);
        var isNatural = isNaturalWeaponName(normalizedName);
        var isRanged = weapon.attackType === 'Ranged';
        var damageBits = splitDamageExpression(weapon.damage || '');
        var attackStatExpr = resolveWeaponAttackStat(model, weapon);
        var damageProfile = resolveWeaponDamageProfile(model, weapon, damageBits);
        var attackAbility = resolveWeaponAttackAbilityMod(model, weapon);
        var attackResidual = (weapon.attackBonuses.length ? weapon.attackBonuses[0] : 0) -
            ((model.bab.bab || 0) + attackAbility + (model.normalizedHeader.sizeMod || 0) + (weapon.enhancementBonus || 0));
        var damageResidual = damageBits.flatBonus - damageProfile.value - (weapon.enhancementBonus || 0);
        var baseDamage = '';
        var attackBonuses = (attackBonusesOverride && attackBonusesOverride.length ? attackBonusesOverride : (weapon.attackBonuses && weapon.attackBonuses.length ? weapon.attackBonuses : [0])).slice();
        var firstBonus = attackBonuses[0] || 0;
        var attackBonusTerms = [
            '@{globalAttackBonus}[Global bonus]',
            '@{flankEnabled}[Flank]',
            '@{higherGroundEnabled}[Higher Ground]',
            '@{bardicMusicAttackBonus}[Music]',
            '@{spellsAttackBonus}[Spells]',
            '@{powersAttackBonus}[Powers]',
            '@{maneuversStancesAttackBonus}[Man./Sta.]',
            '@{featsAttackBonus}[Feats]',
            '@{totalAttackConditionsBonus}[Conditions]',
            '(@{fightingDefensivelyEnabled}*@{fightingDefensivelyAttackBonus})[Fi. De.]',
            '(@{combatExpertiseEnabled}*@{combatExpertiseAttackBonus})[Co. Ex.]',
            '@{smiteEvilAttackBonus}[Smite]'
        ];
        var damageBonusTerms = [
            '@{globalDamageBonus}[Global bonus]',
            '@{bardicMusicDamageBonus}[Music]',
            '@{spellsDamageBonus}[Spells]',
            '@{powersDamageBonus}[Powers]',
            '@{maneuversStancesDamageBonus}[Man./Sta.]',
            '@{featsDamageBonus}[Feats]',
            '@{totalDamageConditionsBonus}[Conditions]',
            '(@{fightingDefensivelyEnabled}*@{fightingDefensivelyDamageBonus})[Fi. De.]',
            '(@{combatExpertiseEnabled}*@{combatExpertiseDamageBonus})[Co. Ex.]',
            '@{smiteEvilDamageBonus}[Smite]'
        ];

        if (isRanged) {
            attackBonusTerms.push('@{rangeIncrement}[R. Inc.]');
            attackBonusTerms.push('(@{rapidShotEnabled}*@{rapidShotAttackBonus})[Rapid]');
            attackBonusTerms.push('(@{manyShotEnabled}*@{manyShotAttackBonus})[Manyshot]');
        } else {
            attackBonusTerms.push('(@{twoWeaponsEnabled}*@{primaryHandAttackBonus})[Pr. Ha.]');
            attackBonusTerms.push('(@{flurryBlowsEnabled}*@{flurryBlowsAttackBonus})[Flurry]');
            attackBonusTerms.push('@{powerAttackAttackBonus}[Pow. Att.]');
            if (isNatural) {
                damageBonusTerms.push('@{lightDamageBonus}[Pow. Att.]');
            }
        }

        if (damageBits.diceNumber && damageBits.diceType) {
            baseDamage = damageBits.diceNumber + 'd' + damageBits.diceType;
            if (damageResidual > 0) {
                baseDamage += '+' + damageResidual;
            } else if (damageResidual < 0) {
                baseDamage += damageResidual;
            }
        } else {
            baseDamage = String(damageResidual || 0);
        }

        return attackBonuses.reduce(function (messages, bonus, index) {
            var chunkIndex = Math.floor(index / 4);
            var slot = (index % 4) + 1;
            var overallSlot = index + 1;
            var delta = bonus - firstBonus;
            var attackCalc = '1d20cs>' + (weapon.critMin || 20) + ' + @{bab}[BAB] + @{epicattackbonus}[Epic AB] + ' + attackStatExpr + '[Ability] + @{size}[size] + ' + (weapon.enhancementBonus || 0) + '[Weapon Enh] + ' + attackResidual + '[Weapon Focus] + ' + attackBonusTerms.join(' + ') + (delta ? ' + ' + delta + '[Routine]' : '');
            var damageCalc = baseDamage + '[Dmg] + ' + damageProfile.expr + '[Weapon Dmg Ability] + ' + (weapon.enhancementBonus || 0) + '[Weapon Enh] + ' + damageBonusTerms.join(' + ') + '';
            var critCalc = '(' + ((weapon.critMultiplier || 2) - 1) + ') * (' + damageCalc + ')';

            if (!messages[chunkIndex]) {
                messages[chunkIndex] = [
                    '&{template:DnD35Attack}',
                    '{{pcflag=true}}',
                    '{{name=' + escapeMacroText(characterName) + '}}',
                    '{{subtags=' + escapeMacroText(subtagOverride || ('Attacks with ' + weapon.displayName)) + '}}'
                ];
            }

            if (attackBonuses.length > 1) {
                messages[chunkIndex].push('{{attack' + slot + '=A' + overallSlot + ': [[ ' + attackCalc + ' ]] }}');
                messages[chunkIndex].push('{{critconfirm' + slot + '=Crit?: [[ ' + attackCalc + ' ]] }}');
                messages[chunkIndex].push('{{damage' + slot + '=D' + overallSlot + ': [[ ' + damageCalc + ' ]] dmg}}');
                messages[chunkIndex].push('{{critdmg' + slot + '=+ [[ ' + critCalc + ' ]] crit dmg}}');
            } else {
                messages[chunkIndex].push('{{attack1=Hitting AC [[ ' + attackCalc + ' ]] }}');
                messages[chunkIndex].push('{{critconfirm1=Crit?: [[ ' + attackCalc + ' ]] }}');
                messages[chunkIndex].push('{{damage1=for [[ ' + damageCalc + ' ]] dmg}}');
                messages[chunkIndex].push('{{critdmg1=+ [[ ' + critCalc + ' ]] crit dmg}}');
            }

            return messages;
        }, []).map(function (parts, index) {
            parts.push('{{fumbleroll=Fumble: [[ d20 ]] }}');
            parts.push('{{fullattackflag=' + (attackBonuses.length > 1 ? '[[ d1 ]]' : '[[0d1]]') + '}}');
            if (index === 0 && notes) {
                parts.push('{{notes=' + escapeMacroText(notes) + '}}');
            }
            return parts.join(' ');
        }).join('\n');
    }

    function buildWeaponAttrs(prefix, characterName, weapon, model) {
        var firstBonus = weapon.attackBonuses.length ? weapon.attackBonuses[0] : 0;
        var damageBits = splitDamageExpression(weapon.damage || '');
        var attackAbility = resolveWeaponAttackAbilityMod(model, weapon);
        var attackStatExpr = resolveWeaponAttackStat(model, weapon);
        var damageProfile = resolveWeaponDamageProfile(model, weapon, damageBits);
        var attackResidual = firstBonus - ((model.bab.bab || 0) + attackAbility + (model.normalizedHeader.sizeMod || 0) + (weapon.enhancementBonus || 0));
        var damageResidual = damageBits.flatBonus - damageProfile.value - (weapon.enhancementBonus || 0);
        var damageBase = '';
        var isNpc = /^npcattack/.test(prefix);
        var attrs = {};

        if (damageBits.diceNumber && damageBits.diceType) {
            damageBase = damageBits.diceNumber + 'd' + damageBits.diceType;
            if (damageResidual > 0) {
                damageBase += '+' + damageResidual;
            } else if (damageResidual < 0) {
                damageBase += damageResidual;
            }
        } else {
            damageBase = String(damageResidual || 0);
        }

        attrs[prefix + 'name'] = weapon.displayName;
        attrs[prefix + 'type'] = weapon.attackType;
        attrs[prefix + 'enh'] = weapon.enhancementBonus || 0;
        attrs[prefix + 'focus'] = attackResidual;
        attrs[prefix + 'specialize'] = 0;
        attrs[prefix + 'critmin'] = weapon.critMin || 20;
        attrs[prefix + 'critmult'] = weapon.critMultiplier || 2;
        attrs[prefix + 'stat'] = attackStatExpr;
        attrs[prefix + 'damagestat'] = damageProfile.expr;
        attrs[prefix + 'dicenumber'] = damageBits.diceNumber;
        attrs[prefix + 'dicetype'] = damageBits.diceType;
        attrs[prefix + 'bonusdamage'] = damageResidual;
        attrs[prefix + 'statdamage'] = damageBase;
        attrs[prefix + 'vardamage'] = 0;
        attrs[prefix + 'attackcalc'] = buildWeaponAttackCalc(prefix, attackStatExpr);
        attrs[prefix + 'damage'] = buildWeaponDamageCalc(prefix);
        attrs[prefix + 'damagesplitted'] = buildWeaponDamageCalc(prefix);
        attrs[prefix + 'crit'] = buildWeaponCritCalc(prefix);
        attrs[prefix + 'critrerollsplitted'] = buildWeaponCritCalc(prefix);
        attrs[prefix + 'critmultiplyunited'] = buildWeaponCritCalc(prefix);
        attrs[prefix + 'critmultiplysplitted'] = buildWeaponCritCalc(prefix);
        attrs[prefix + 'specialproperties'] = [weapon.damageNotes].concat(weapon.notes).filter(Boolean).join(' ');
        attrs[prefix + 'singleattackmacro'] = buildWeaponSingleAttackMacro(prefix, isNpc);
        attrs[prefix + 'attackmacro'] = buildWeaponAttackMacro(prefix, isNpc);
        var countBasedFullAttackBonuses = getCountBasedFullAttackBonuses(weapon);
        attrs[prefix + 'fullattackmacro'] = countBasedFullAttackBonuses.length ?
            buildTokenActionMacro(characterName, weapon, model, countBasedFullAttackBonuses, 'Full Attack with ' + weapon.displayName) :
            buildWeaponFullAttackMacro(prefix, isNpc);
        attrs[prefix + 'damagemacro'] = buildWeaponDamageMacro(prefix, isNpc);
        attrs[prefix + 'criticmacro'] = buildWeaponCritMacro(prefix, isNpc);
        return attrs;
    }

    function buildPcWeaponAttrs(characterName, weapon, slot, model) {
        return buildWeaponAttrs('weapon' + slot, characterName, weapon, model);
    }

    function buildNpcWeaponAttrs(characterName, weapon, slot, model) {
        return buildWeaponAttrs('npcattack' + slot, characterName, weapon, model);
    }

    function buildModel(payload) {
        payload = payload || {};
        var creature = payload.creature || {};
        var header = creature.header || {};
        var defense = creature.defense || {};
        var offense = creature.offense || {};
        var stats = creature.statistics || {};
        var warnings = (payload.warnings || []).slice();
        var normalizedHeader = normalizeHeader(header);
        var creatureName = trim(creature.name || header.name || payload.roll20_hints && payload.roll20_hints.character_name || '');
        var identity = parseIdentity(normalizedHeader, creatureName);
        var abilities = parseAbilitiesLine(stats.abilities_line || '');
        var ac = parseAcLine(defense.ac_line || '');
        var hp = parseHpLine(defense.hp_line || '');
        var saves = parseSaveLine(defense.fort_ref_will_line || '');
        var initiative = parseInitLine(header.init_line || '');
        var speed = parseSpeedLine(offense.speed_line || '');
        var bab = parseBaseAttackLine(offense.base_attack_line || '');
        var spaceReach = parseSpaceReachLine(offense.space_reach_line || '');
        var skillBonuses = extractSkillBonuses(stats.skills || []);
        var skillContextNotes = extractSituationalSkillNotes(creature.bio_notes || '', stats.skill_details || []);
        var weapons = buildWeaponList(offense, stats.feats || []);
        var spellEntries = buildSpellEntries(offense.spell_sections || [], warnings, identity);
        var maneuvers = asArray(offense.maneuvers || creature.maneuvers);
        var textBundles = buildTextBundles(creature, normalizedHeader, identity);
        var possessions = []
            .concat(stats.possessions || [])
            .concat(offense.combat_gear_line ? [stripPrefix(offense.combat_gear_line, 'Combat Gear\\s+')] : []);
        var equipment = analyzeEquipment(possessions);
        var concentration = skillBonuses.concentration || null;
        var meleePrimary = weapons.filter(function (weapon) {
            return weapon.attackType === 'Melee' && weapon.attackBonuses.length;
        })[0];
        var rangedPrimary = weapons.filter(function (weapon) {
            return weapon.attackType === 'Ranged' && weapon.attackBonuses.length;
        })[0];
        var model = {
            payload: payload,
            creature: creature,
            headerSection: header,
            defenseSection: defense,
            offenseSection: offense,
            statisticsSection: stats,
            warnings: warnings,
            name: creatureName,
            cr: trim(creature.cr || header.cr || ''),
            normalizedHeader: normalizedHeader,
            identity: identity,
            abilities: abilities,
            ac: ac,
            hp: hp,
            saves: saves,
            initiative: initiative,
            speed: speed,
            bab: bab,
            spaceReach: spaceReach,
            skills: stats.skills || [],
            explicitSkillBonuses: buildExplicitSkillBonusMap(stats.skill_bonuses || []),
            feats: stats.feats || [],
            featDetails: stats.feat_details || creature.feat_details || [],
            possessions: possessions,
            languages: parseLanguages(header.languages_line || ''),
            weapons: weapons,
            spellEntries: spellEntries,
            maneuvers: maneuvers,
            textBundles: textBundles,
            skillContextNotes: skillContextNotes,
            concentration: concentration,
            meleePrimary: meleePrimary,
            rangedPrimary: rangedPrimary,
            equipment: equipment
        };
        var skillImport = buildSkillImportData(model);

        model.skillImport = skillImport;
        model.warnings = warnings.concat(skillImport.warnings || []);
        model.acBreakdown = analyzeAcBreakdown(model);
        model.acInfoText = buildAcInfoText(model);
        return model;
    }

    function buildFeatSectionText(feats, featDetails) {
        var parts = [];
        var detailsByName = {};
        var usedDetails = [];

        asArray(featDetails).forEach(function (feat) {
            var key = normalizeLookupText(feat && feat.name);
            if (!key || !feat || !feat.raw) {
                return;
            }
            detailsByName[key] = detailsByName[key] || [];
            detailsByName[key].push(feat);
        });

        asArray(feats).filter(Boolean).forEach(function (featName) {
            var key = normalizeLookupText(featName);
            var matches = detailsByName[key] || [];
            var detail = matches.shift();
            if (detail) {
                usedDetails.push(detail);
                parts.push(detail.raw);
            } else {
                parts.push(featName);
            }
        });

        asArray(featDetails).forEach(function (feat) {
            if (feat && feat.raw && usedDetails.indexOf(feat) === -1) {
                parts.push(feat.raw);
            }
        });
        return parts.join('\n\n');
    }

    function validateModel(model) {
        var issues = [];
        if (!model.name) {
            issues.push('Creature name is missing.');
        }
        if (!model.payload || model.payload.schema_version !== 1) {
            issues.push('Unsupported or missing schema_version. Expected 1.');
        }
        if (!model.creature || !model.creature.header || !model.defenseSection || !model.offenseSection || !model.statisticsSection) {
            issues.push('Unsupported JSON structure. Expected a converted payload with creature.header, creature.defense, creature.offense, and creature.statistics.');
        }
        if (!model.hp.max) {
            issues.push('HP could not be parsed from defense.hp_line.');
        }
        if (model.weapons.length > MAX_PC_WEAPONS) {
            issues.push('Found ' + model.weapons.length + ' weapon fragments; only the first ' + MAX_PC_WEAPONS + ' will be loaded into PC weapon slots.');
        }
        if (model.weapons.length > MAX_NPC_ATTACKS) {
            issues.push('Found ' + model.weapons.length + ' weapon fragments; only the first ' + MAX_NPC_ATTACKS + ' will be loaded into NPC attack slots.');
        }
        return issues.concat(model.warnings || []);
    }

    function hasFatalValidationIssue(model) {
        return !model ||
            !model.name ||
            !model.payload ||
            model.payload.schema_version !== 1 ||
            !model.creature ||
            !model.creature.header ||
            !model.defenseSection ||
            !model.offenseSection ||
            !model.statisticsSection ||
            !model.hp.max;
    }

    function findOrCreateAttr(characterId, name) {
        var attr = findObjs({
            _type: 'attribute',
            characterid: characterId,
            name: name
        })[0];
        if (attr) {
            return attr;
        }
        return createObj('attribute', {
            characterid: characterId,
            name: name,
            current: ''
        });
    }

    function setAttr(characterId, name, current, max) {
        var attr = findOrCreateAttr(characterId, name);
        attr.set('current', current === null || current === undefined ? '' : current);
        if (max !== undefined) {
            attr.set('max', max === null || max === undefined ? '' : max);
        }
        return attr;
    }

    function bulkSetAttrs(characterId, attrs) {
        Object.keys(attrs).forEach(function (name) {
            setAttr(characterId, name, attrs[name]);
        });
    }

    function createAbility(characterId, name, action, tokenAction) {
        return createObj('ability', {
            _characterid: characterId,
            characterid: characterId,
            name: name,
            action: action,
            istokenaction: tokenAction ? true : false
        });
    }

    function buildAcSlotAttrs(model) {
        var attrs = {
            armorworn: model.equipment && model.equipment.armor ? 1 : 0,
            acitem: model.equipment && model.equipment.armor ? model.equipment.armor.displayName : '',
            acitemtype: model.equipment && model.equipment.armor ? model.equipment.armor.type : '',
            acitembonus: model.equipment && model.equipment.armor ? model.equipment.armor.bonus : 0,
            acitemdex: model.equipment && model.equipment.armor ? model.equipment.armor.maxDex : 20,
            acitemcheckpenalty: model.equipment && model.equipment.armor ? model.equipment.armor.checkPenalty : 0,
            acitemspellfailure: model.equipment && model.equipment.armor ? model.equipment.armor.spellFailure : 0,
            acitemproperties: model.equipment && model.equipment.armor ? model.equipment.armor.properties.join(', ') : '',
            armorbonusname: model.equipment && model.equipment.armor ? model.equipment.armor.baseName : '',
            armorbonusnotes: model.equipment && model.equipment.armor ? model.equipment.armor.displayName : '',
            shieldworn: model.equipment && model.equipment.shield ? 1 : 0,
            shield: model.equipment && model.equipment.shield ? model.equipment.shield.displayName : '',
            shieldbonus: model.equipment && model.equipment.shield ? model.equipment.shield.bonus : 0,
            shieldcheckpenalty: model.equipment && model.equipment.shield ? model.equipment.shield.checkPenalty : 0,
            shieldspellfailure: model.equipment && model.equipment.shield ? model.equipment.shield.spellFailure : 0,
            shieldproperties: model.equipment && model.equipment.shield ? model.equipment.shield.properties.join(', ') : '',
            shieldbonusname: model.equipment && model.equipment.shield ? model.equipment.shield.baseName : '',
            shieldbonusnotes: model.equipment && model.equipment.shield ? model.equipment.shield.displayName : '',
            armorclassnaturalarmor: model.acBreakdown.naturalBonus || 0,
            naturalarmor1inuse: model.acBreakdown.naturalBonus ? 1 : 0,
            naturalarmor1name: model.acBreakdown.naturalBonus ? 'Natural Armor' : '',
            naturalarmor1bonus: model.acBreakdown.naturalBonus || 0,
            naturalarmor1notes: model.acBreakdown.naturalBonus ? 'Derived from imported AC values.' : '',
            miscac1inuse: 0,
            miscac1name: '',
            miscac1bonus: 0,
            miscac1stdac: 1,
            miscac1touchac: 1,
            miscac1ffac: 1,
            miscac1immoblac: 1,
            miscac2inuse: 0,
            miscac2name: '',
            miscac2bonus: 0,
            miscac2stdac: 1,
            miscac2touchac: 1,
            miscac2ffac: 1,
            miscac2immoblac: 1,
            miscac3inuse: 0,
            miscac3name: '',
            miscac3bonus: 0,
            miscac3stdac: 1,
            miscac3touchac: 1,
            miscac3ffac: 1,
            miscac3immoblac: 1,
            miscac4inuse: 0,
            miscac4name: '',
            miscac4bonus: 0,
            miscac4stdac: 1,
            miscac4touchac: 1,
            miscac4ffac: 1,
            miscac4immoblac: 1,
            miscac5inuse: 0,
            miscac5name: '',
            miscac5bonus: 0,
            miscac5stdac: 1,
            miscac5touchac: 1,
            miscac5ffac: 1,
            miscac5immoblac: 1
        };
        var slots = [];

        function pushSlot(name, bonus, std, touch, ff) {
            if (!bonus) {
                return;
            }
            slots.push({
                name: name,
                bonus: bonus,
                stdac: std ? 1 : 0,
                touchac: touch ? 1 : 0,
                ffac: ff ? 1 : 0,
                immoblac: ff ? 1 : 0
            });
        }

        pushSlot('Deflection/Misc', model.acBreakdown.commonBonus, true, true, true);
        pushSlot('Dodge', model.acBreakdown.dodgeBonus, true, true, false);
        pushSlot('AC Only', model.acBreakdown.standardOnlyBonus, true, false, false);
        pushSlot('Touch Only', model.acBreakdown.touchOnlyBonus, false, true, false);
        pushSlot('Flat-Footed Only', model.acBreakdown.flatOnlyBonus, false, false, true);

        slots.forEach(function (slot, index) {
            var prefix = 'miscac' + (index + 1);
            attrs[prefix + 'inuse'] = 1;
            attrs[prefix + 'name'] = slot.name;
            attrs[prefix + 'bonus'] = slot.bonus;
            attrs[prefix + 'stdac'] = slot.stdac;
            attrs[prefix + 'touchac'] = slot.touchac;
            attrs[prefix + 'ffac'] = slot.ffac;
            attrs[prefix + 'immoblac'] = slot.immoblac;
        });

        return attrs;
    }

    function inferCastingStat(sectionType, abilities) {
        var lowered = String(sectionType || '').toLowerCase();
        if (lowered.indexOf('wizard') !== -1 || lowered.indexOf('beguiler') !== -1 || lowered.indexOf('wu jen') !== -1) {
            return '@{int-mod}';
        }
        if (lowered.indexOf('cleric') !== -1 || lowered.indexOf('druid') !== -1 || lowered.indexOf('paladin') !== -1 || lowered.indexOf('ranger') !== -1 || lowered.indexOf('adept') !== -1) {
            return '@{wis-mod}';
        }
        if (lowered.indexOf('sorcerer') !== -1 || lowered.indexOf('bard') !== -1) {
            return '@{cha-mod}';
        }
        if ((abilities.cha || 0) >= (abilities.int || 0) && (abilities.cha || 0) >= (abilities.wis || 0)) {
            return '@{cha-mod}';
        }
        if ((abilities.int || 0) >= (abilities.wis || 0)) {
            return '@{int-mod}';
        }
        return '@{wis-mod}';
    }

    function buildSpellAttrs(model) {
        var attrs = {
            spellmode: 2
        };
        var highestArcane = null;
        var highestDivine = null;
        var genericCaster = null;
        var spellEntries = collapseSpellEntriesForSheet(model.spellEntries);
        var slotsPerDay = {};

        spellEntries.forEach(function (entry) {
            var casterLevel = parseCasterLevel(entry.casterLevel);
            var spell = entry.spell;
            var suffix;
            var rowId = generateRowId();
            var level = entry.level;
            var preparedCount = entry.preparedCount ? String(entry.preparedCount) : '';
            var perDayValue = extractSpellPerDayValue(entry);
            var detailText = extractSpellDetailText(spell);
            var referenceCompact = trim(spell.reference && spell.reference.compact_rules || '');
            var dc = extractSpellDc(spell);

            if (casterLevel !== null) {
                genericCaster = genericCaster === null ? casterLevel : Math.max(genericCaster, casterLevel);
            }
            if (entry.sectionKind === 'arcane' && casterLevel !== null) {
                highestArcane = highestArcane === null ? casterLevel : Math.max(highestArcane, casterLevel);
            }
            if (entry.sectionKind === 'divine' && casterLevel !== null) {
                highestDivine = highestDivine === null ? casterLevel : Math.max(highestDivine, casterLevel);
            }

            if (entry.sectionKind !== 'special' && level !== null && perDayValue) {
                if (!slotsPerDay.hasOwnProperty(level)) {
                    slotsPerDay[level] = perDayValue;
                } else if (safeNumber(perDayValue) !== null && safeNumber(slotsPerDay[level]) !== null) {
                    slotsPerDay[level] = String(Math.max(safeNumber(slotsPerDay[level]), safeNumber(perDayValue)));
                }
            }

            if (entry.sectionKind === 'special' || level === null || !SPELL_LEVEL_SUFFIXES[entry.sectionKind] || !SPELL_LEVEL_SUFFIXES[entry.sectionKind].hasOwnProperty(level)) {
                suffix = '16';
                attrs['repeating_spells16_' + rowId + '_spellused16'] = '0';
                attrs['repeating_spells16_' + rowId + '_spellprep16'] = preparedCount;
                attrs['repeating_spells16_' + rowId + '_spelldc16'] = dc !== null ? dc : '';
                attrs['repeating_spells16_' + rowId + '_spellname16'] = spell.name || '';
                attrs['repeating_spells16_' + rowId + '_spelltype16'] = trim(entry.sectionType + (level !== null ? ' ' + level : ''));
                attrs['repeating_spells16_' + rowId + '_spellduration16'] = referenceCompact || detailText;
                attrs['repeating_spells16_' + rowId + '_spellrange16'] = entry.headerExtras || '';
                attrs['repeating_spells16_' + rowId + '_spellmacro16'] = adaptSpellMacro(entry);
                attrs['repeating_spells16_' + rowId + '_spellst16'] = dc !== null ? 'DC ' + dc : '';
                return;
            }

            suffix = SPELL_LEVEL_SUFFIXES[entry.sectionKind][level];
            attrs['repeating_spells' + suffix + '_' + rowId + '_spellused' + suffix] = '0';
            attrs['repeating_spells' + suffix + '_' + rowId + '_spellprep' + suffix] = preparedCount;
            attrs['repeating_spells' + suffix + '_' + rowId + '_spellname' + suffix] = spell.name || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_spelllevel' + suffix] = level;
            attrs['repeating_spells' + suffix + '_' + rowId + '_spellmacro' + suffix] = adaptSpellMacro(entry);
            if (dc !== null) {
                attrs['repeating_spells' + suffix + '_' + rowId + '_spellst' + suffix] = 'DC ' + dc;
            }
            if (referenceCompact || detailText) {
                attrs['repeating_spells' + suffix + '_' + rowId + '_spellduration' + suffix] = referenceCompact || detailText;
            }
        });

        Object.keys(slotsPerDay).forEach(function (level) {
            attrs['spells' + level] = slotsPerDay[level];
        });

        attrs.casterlevel = genericCaster !== null ? genericCaster : '';
        attrs.casterlevel2 = genericCaster !== null ? genericCaster : '';
        if (highestArcane !== null) {
            attrs.arcanecasterlevel = highestArcane;
            attrs.arcanecastingstat = inferCastingStat('arcane', model.abilities);
        }
        if (highestDivine !== null) {
            attrs.divinecasterlevel = highestDivine;
            attrs.divinecastingstat = inferCastingStat('divine', model.abilities);
        }

        return attrs;
    }

    function buildManeuverAttrs(model) {
        var attrs = {};
        asArray(model.maneuvers).forEach(function (maneuver) {
            var rowId = generateRowId();
            var name = trim(maneuver.name || '');
            var macro = trim(maneuver.macro_text || maneuver.macro || '');
            var suffix = '45';

            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuvername' + suffix] = name;
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuverlevel' + suffix] = maneuver.level || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuverschool' + suffix] = maneuver.discipline || maneuver.school || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuvertype' + suffix] = maneuver.type || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuverinitiation' + suffix] = maneuver.initiation || maneuver.action || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuverrange' + suffix] = maneuver.range || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuvertarget' + suffix] = maneuver.target || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuverduration' + suffix] = maneuver.duration || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuverdescription' + suffix] = maneuver.description || maneuver.notes || '';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuvermacro' + suffix] = macro;
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuverused' + suffix] = maneuver.used ? '1' : '0';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuverreadied' + suffix] = maneuver.readied === false ? '0' : '1';
            attrs['repeating_spells' + suffix + '_' + rowId + '_maneuvergranted' + suffix] = maneuver.granted ? '1' : '0';
        });
        return attrs;
    }

    function extractSpellResistance(defense) {
        var text = trim((defense && defense.resist_line) || '');
        var match = text.match(/\bSR\s+(\d+)/i);
        return match ? safeNumber(match[1]) : '';
    }

    function buildImportedItemsText(model) {
        return (model.possessions || []).filter(function (item) {
            return normalizeLookupText(item) !== 'combat gear';
        }).join(', ');
    }

    function applyModelToCharacter(character, model) {
        var characterId = character.id;
        var header = model.normalizedHeader;
        var identity = model.identity || { race: '', classes: [] };
        var strMod = abilityMod(model.abilities.str || 10);
        var dexMod = abilityMod(model.abilities.dex || 10);
        var conMod = abilityMod(model.abilities.con || 10);
        var wisMod = abilityMod(model.abilities.wis || 10);
        var meleeTarget = model.meleePrimary && model.meleePrimary.attackBonuses.length ? model.meleePrimary.attackBonuses[0] : null;
        var rangedTarget = model.rangedPrimary && model.rangedPrimary.attackBonuses.length ? model.rangedPrimary.attackBonuses[0] : null;
        var meleeAbility = model.meleePrimary ? resolveWeaponAttackAbilityMod(model, model.meleePrimary) : strMod;
        var meleeMisc = model.bab.bab !== null && meleeTarget !== null ? meleeTarget - (model.bab.bab + meleeAbility + header.sizeMod) : 0;
        var rangedMisc = model.bab.bab !== null && rangedTarget !== null ? rangedTarget - (model.bab.bab + dexMod + header.sizeMod) : 0;
        var grappleMisc = model.bab.bab !== null && model.bab.grapple !== null ? model.bab.grapple - (model.bab.bab + strMod + header.sizeMod) : 0;
        var saveFeatBonuses = getFeatSaveBonuses(model.feats);
        var totalClassLevels = identity.classes.reduce(function (sum, entry) {
            return sum + (entry.level || 0);
        }, 0);
        var importedHp = model.hp.current || model.hp.max || '';
        var importedItems = buildImportedItemsText(model);
        var pcAttrs;
        var npcAttrs;
        var i;

        pcAttrs = {
            'npc-show': 1,
            character_name: model.name,
            race: identity.race || toDisplayCase(header.typeText || ''),
            racetype: toDisplayCase(header.typeText || ''),
            alignment: header.alignment || '',
            size: header.sizeMod,
            gender: header.gender || '',
            level: totalClassLevels || model.hp.hd || '',
            hitdie: model.hp.hd || '',
            hitpoint: importedHp,
            hitpoints: importedHp,
            hitpoints_max: importedHp,
            speed: model.speed.land || '',
            'fly-speed': model.speed.fly || '',
            'fly-maneuver': model.speed.flyManeuver || '',
            'climb-speed': model.speed.climb || '',
            'swim-speed': model.speed.swim || '',
            'burrow-speed': model.speed.burrow || '',
            initmiscmod: model.initiative.total !== null ? model.initiative.total - dexMod : 0,
            bab: model.bab.bab !== null ? model.bab.bab : '',
            grapplemiscmod: grappleMisc,
            mabmiscmod: meleeMisc,
            rabmiscmod: rangedMisc,
            fortitudebase: model.saves.fort !== null ? model.saves.fort - conMod - saveFeatBonuses.fort : '',
            fortitudemiscmod: saveFeatBonuses.fort,
            reflexbase: model.saves.ref !== null ? model.saves.ref - dexMod - saveFeatBonuses.ref : '',
            reflexmiscmod: saveFeatBonuses.ref,
            willbase: model.saves.will !== null ? model.saves.will - wisMod - saveFeatBonuses.will : '',
            willmiscmod: saveFeatBonuses.will,
            damagereduction: model.hp.dr || '',
            spellresistance: extractSpellResistance(model.defenseSection || {}),
            languages: splitAndDisplayList(model.languages || ''),
            racialabilities: model.textBundles.racialAbilities || '',
            classabilities: model.textBundles.classAbilities || '',
            feats: buildFeatSectionText(model.feats, model.featDetails),
            other: model.textBundles.other || '',
            otheritems: '',
            otherinfo: importedItems,
            recalc: 1,
            str: model.abilities.str || '',
            'str-mod': strMod,
            'str-base': model.abilities.str || '',
            dex: model.abilities.dex || '',
            'dex-mod': dexMod,
            'dex-base': model.abilities.dex || '',
            con: model.abilities.con || '',
            'con-mod': conMod,
            'con-base': model.abilities.con || '',
            int: model.abilities.int || '',
            'int-mod': abilityMod(model.abilities.int || 10),
            'int-base': model.abilities.int || '',
            wis: model.abilities.wis || '',
            'wis-mod': wisMod,
            'wis-base': model.abilities.wis || '',
            cha: model.abilities.cha || '',
            'cha-mod': abilityMod(model.abilities.cha || 10),
            'cha-base': model.abilities.cha || ''
        };

        npcAttrs = {
            npcname: model.name,
            npcrace: identity.race || '',
            npctype: toDisplayCase(header.typeText || ''),
            npcsize: header.sizeMod,
            npcalignment: header.alignment || '',
            npcgender: header.gender || '',
            npchitdie: model.hp.hd || '',
            npchitpoints: importedHp,
            npchitpoints_max: importedHp,
            npcinit: model.initiative.total !== null ? model.initiative.total : '',
            npcspeed: model.speed.raw || '',
            npcarmorclass: model.ac.total !== null ? model.ac.total : '',
            npctoucharmorclass: model.ac.touch !== null ? model.ac.touch : '',
            npcflatfootarmorclass: model.ac.flat !== null ? model.ac.flat : '',
            npcarmorclassinfo: model.acInfoText || model.ac.raw || '',
            npcbaseatt: model.bab.bab !== null ? model.bab.bab : '',
            npcgrapple: model.bab.grapple !== null ? model.bab.grapple : '',
            npcspace: model.spaceReach.space || '',
            npcreach: model.spaceReach.reach || '',
            npcspecialattacks: [stripPrefix(model.offenseSection.attack_options_line || '', 'Atk Options\\s+'), stripPrefix(model.offenseSection.special_actions_line || '', 'Special Actions\\s+')].filter(Boolean).join('; '),
            npcspecialqualities: [stripPrefix(model.statisticsSection.sq_line || '', 'SQ\\s+'), model.defenseSection.immune_line || '', model.defenseSection.resist_line || '', model.defenseSection.weaknesses_line || ''].filter(Boolean).join('; '),
            npcfortsave: model.saves.fort !== null ? model.saves.fort : '',
            npcrefsave: model.saves.ref !== null ? model.saves.ref : '',
            npcwillsave: model.saves.will !== null ? model.saves.will : '',
            npcstr: model.abilities.str || '',
            'npcstr-mod': strMod,
            npcdex: model.abilities.dex || '',
            'npcdex-mod': dexMod,
            npccon: model.abilities.con || '',
            'npccon-mod': conMod,
            npcint: model.abilities.int || '',
            'npcint-mod': abilityMod(model.abilities.int || 10),
            npcwis: model.abilities.wis || '',
            'npcwis-mod': wisMod,
            npccha: model.abilities.cha || '',
            'npccha-mod': abilityMod(model.abilities.cha || 10),
            npcskills: (model.skills || []).map(function (skill) { return toDisplayCase(skill); }).join(', '),
            npcfeats: buildFeatSectionText(model.feats, model.featDetails),
            npccr: model.cr || '',
            npctreasure: (model.possessions || []).map(function (item) { return toDisplayCase(item); }).join(', '),
            npcdescr: model.textBundles.bio || '',
            npccombatdescr: model.textBundles.classAbilities || ''
        };

        identity.classes.forEach(function (entry, index) {
            var slot = index + 1;
            pcAttrs['class' + slot] = entry.name;
            pcAttrs['level' + slot] = entry.level;
            npcAttrs['npcclass' + slot] = entry.name;
            npcAttrs['npclevel' + slot] = entry.level;
        });

        bulkSetAttrs(characterId, pcAttrs);
        bulkSetAttrs(characterId, npcAttrs);
        bulkSetAttrs(characterId, buildAcSlotAttrs(model));
        bulkSetAttrs(characterId, model.skillImport.attrs || {});
        bulkSetAttrs(characterId, buildSpellAttrs(model));
        bulkSetAttrs(characterId, buildManeuverAttrs(model));
        setAttr(characterId, 'hitpoints', importedHp, importedHp);
        setAttr(characterId, 'npchitpoints', importedHp, importedHp);
        for (i = 0; i < Math.min(model.weapons.length, MAX_PC_WEAPONS); i += 1) {
            bulkSetAttrs(characterId, buildPcWeaponAttrs(model.name, model.weapons[i], i + 1, model));
        }
        for (i = 0; i < Math.min(model.weapons.length, MAX_NPC_ATTACKS); i += 1) {
            bulkSetAttrs(characterId, buildNpcWeaponAttrs(model.name, model.weapons[i], i + 1, model));
        }

        model.weapons.forEach(function (weapon, index) {
            var prefix = index < MAX_PC_WEAPONS ? 'weapon' + (index + 1) : null;
            var countBasedFullAttackBonuses = getCountBasedFullAttackBonuses(weapon);
            if (prefix) {
                if (shouldCreateWeaponTokenAction(weapon)) {
                    createAbility(characterId, weapon.displayName, buildTokenActionMacro(model.name, weapon, model), true);
                }
                if (shouldCreateWeaponTokenAction(weapon) && countBasedFullAttackBonuses.length) {
                    createAbility(characterId, weapon.displayName + ' Full Attack', buildTokenActionMacro(model.name, weapon, model, countBasedFullAttackBonuses, 'Full Attack with ' + weapon.displayName), true);
                }
            }
        });

        if (model.textBundles.bio) {
            character.set('bio', model.textBundles.bio);
        }
    }

    function generateRowId() {
        return '-' + Date.now().toString(36) + Math.floor(Math.random() * 999999).toString(36);
    }

    function getSelectedGraphic(msg) {
        if (!msg.selected || !msg.selected.length) {
            return null;
        }
        return getObj('graphic', msg.selected[0]._id);
    }

    function normalizeRoll20ImageUrl(imgsrc, size) {
        var parts = String(imgsrc || '').match(/^(https?:\/\/(?:s3\.amazonaws\.com\/)?files(?:\.staging)?\.d20\.io\/images\/.*\/)(thumb|med|max|original)([^?]*(?:\?.+)?)$/i);
        if (!parts) {
            return '';
        }
        return parts[1] + (size || parts[2]) + parts[3];
    }

    function cleanImgsrc(imgsrc) {
        return normalizeRoll20ImageUrl(imgsrc, 'thumb') || imgsrc;
    }

    function buildAvatarImgsrc(imgsrc) {
        return normalizeRoll20ImageUrl(imgsrc, 'med') ||
            normalizeRoll20ImageUrl(imgsrc, 'original') ||
            normalizeRoll20ImageUrl(imgsrc, 'thumb') ||
            cleanImgsrc(imgsrc) ||
            String(imgsrc || '');
    }

    function configureTokenForCharacter(token, character, hpValue, acValue, characterName) {
        var rawImgsrc = token.get('imgsrc');
        var imgsrc = cleanImgsrc(rawImgsrc);
        var avatarImgsrc = buildAvatarImgsrc(rawImgsrc);
        var tokenData;
        if (!imgsrc) {
            return { ok: false, reason: 'Selected token does not have a usable image source.' };
        }

        token.set({
            name: characterName,
            represents: character.id,
            bar1_link: '',
            bar1_value: hpValue || '',
            bar1_max: hpValue || '',
            bar2_link: '',
            bar2_value: acValue || '',
            bar2_max: '',
            showname: false,
            showplayers_name: false,
            showplayers_bar1: false,
            showplayers_bar2: false
        });

        if (avatarImgsrc) {
            character.set('avatar', avatarImgsrc);
        }

        tokenData = {
            imgsrc: imgsrc,
            name: characterName,
            represents: character.id,
            width: token.get('width'),
            height: token.get('height'),
            layer: 'objects',
            bar1_link: '',
            bar1_value: hpValue || '',
            bar1_max: hpValue || '',
            bar2_link: '',
            bar2_value: acValue || '',
            bar2_max: '',
            showname: false,
            showplayers_name: false,
            light_hassight: token.get('light_hassight'),
            showplayers_bar1: false,
            showplayers_bar2: false,
            tint_color: token.get('tint_color')
        };
        if (typeof setDefaultTokenForCharacter === 'function') {
            setDefaultTokenForCharacter(character, token);
        } else {
            character.set('defaulttoken', JSON.stringify(tokenData));
        }
        return {
            ok: true,
            avatarSet: !!avatarImgsrc,
            avatarReason: avatarImgsrc ? '' : 'Selected token does not have a usable image source for the avatar field.'
        };
    }

    function summarizeModel(model) {
        return [
            'Creature: ' + model.name,
            'CR: ' + (model.cr || '?'),
            'Weapons: ' + model.weapons.length,
            'Weapon token actions: ' + countWeaponTokenActions(model),
            'Spells: ' + model.spellEntries.length,
            'Maneuvers: ' + model.maneuvers.length,
            'HP: ' + (model.hp.current || model.hp.max || '?'),
            'AC: ' + (model.ac.total !== null ? model.ac.total : '?')
        ];
    }

    function importModelFromHandout(handout, msg) {
        loadHandoutPayload(handout, function (payloadText) {
            var payload;
            var model;
            var issues;
            var character;
            var selectedToken;
            var bindResult;

            if (!payloadText) {
                sendGM(renderList('Import Failed', ['The handout is empty or does not contain JSON.']));
                return;
            }

            try {
                payload = tryParsePayload(payloadText);
            } catch (error) {
                sendGM(renderList('Import Failed', ['JSON parse error: ' + error.message]));
                return;
            }

            model = buildModel(payload);
            issues = validateModel(model);
            if (hasFatalValidationIssue(model)) {
                sendGM(renderList('Import Failed', summarizeModel(model).concat(issues)));
                return;
            }
            character = createObj('character', {
                name: model.name
            });

            applyModelToCharacter(character, model);
            selectedToken = getSelectedGraphic(msg);
            if (selectedToken) {
                bindResult = configureTokenForCharacter(selectedToken, character, model.hp.current || model.hp.max, model.ac.total, model.name);
                if (!bindResult.ok) {
                    issues.push('Character imported, but selected token could not be bound: ' + bindResult.reason);
                } else if (!bindResult.avatarSet && bindResult.avatarReason) {
                    issues.push('Token bound, but avatar was not copied: ' + bindResult.avatarReason);
                }
            } else {
                issues.push('No token was selected during import, so default token creation was skipped.');
            }

            sendGM(renderList('Import Complete', summarizeModel(model).concat(['Character id: ' + character.id]).concat(issues)));
        });
    }

    function validateHandout(handout) {
        loadHandoutPayload(handout, function (payloadText) {
            var payload;
            var model;
            var issues;
            if (!payloadText) {
                sendGM(renderList('Validation Failed', ['The handout is empty or does not contain JSON.']));
                return;
            }

            try {
                payload = tryParsePayload(payloadText);
            } catch (error) {
                sendGM(renderList('Validation Failed', ['JSON parse error: ' + error.message]));
                return;
            }

            model = buildModel(payload);
            issues = validateModel(model);
            sendGM(renderList('Validation Summary', summarizeModel(model).concat(issues)));
        });
    }

    function resolveCharacter(target) {
        var normalized = normalizeNameTarget(target);
        var direct = getObj('character', normalized);
        if (direct) {
            return { character: direct, error: null };
        }
        var matches = findObjs({
            _type: 'character',
            name: normalized
        });
        if (!matches.length) {
            return { character: null, error: 'No character found with the exact name "' + normalized + '".' };
        }
        if (matches.length > 1) {
            return { character: null, error: 'Multiple characters match "' + normalized + '". Please use the character id instead.' };
        }
        return { character: matches[0], error: null };
    }

    function getAttrCurrent(characterId, name) {
        var attr = findObjs({
            _type: 'attribute',
            characterid: characterId,
            name: name
        })[0];
        return attr ? attr.get('current') : '';
    }

    function bindSelectedTokenToCharacter(target, msg) {
        var resolved = resolveCharacter(target);
        var token = getSelectedGraphic(msg);
        var hp = '';
        var ac = '';
        var result;

        if (resolved.error) {
            sendGM(renderList('Bind Failed', [resolved.error]));
            return;
        }
        if (!token) {
            sendGM(renderList('Bind Failed', ['Select a token on the tabletop first.']));
            return;
        }

        hp = getAttrCurrent(resolved.character.id, 'hitpoints_max') ||
            getAttrCurrent(resolved.character.id, 'npchitpoints_max') ||
            getAttrCurrent(resolved.character.id, 'hitpoint');
        ac = getAttrCurrent(resolved.character.id, 'armorclass') ||
            getAttrCurrent(resolved.character.id, 'npcarmorclass');

        result = configureTokenForCharacter(token, resolved.character, hp, ac, resolved.character.get('name'));
        if (!result.ok) {
            sendGM(renderList('Bind Failed', [result.reason]));
            return;
        }

        sendGM(renderList('Token Bound', [
            'Character: ' + resolved.character.get('name'),
            'Bar 1 set to HP: ' + hp,
            'Bar 2 set to AC: ' + ac,
            result.avatarSet ? 'Avatar copied from selected token image.' : 'Avatar not copied: ' + result.avatarReason
        ]));
    }

    function showHelp() {
        sendGM(
            '<div style="border:1px solid #444;background:#fff;padding:8px;">' +
            '<div style="font-weight:bold;margin-bottom:6px;">' + escapeHtml(SCRIPT_NAME + ' v' + VERSION) + '</div>' +
            '<div><code>' + escapeHtml(PING_COMMAND) + '</code> checks that the Roll20 API listener is hearing commands.</div>' +
            '<div><code>' + escapeHtml(COMMAND + ' validate Handout Name') + '</code></div>' +
            '<div><code>' + escapeHtml(COMMAND + ' import Handout Name') + '</code></div>' +
            '<div><code>' + escapeHtml(COMMAND + ' Handout Name') + '</code> (same as import)</div>' +
            '<div><code>' + escapeHtml(COMMAND + ' bind Character Name') + '</code> with a token selected</div>' +
            '<div style="margin-top:8px;">Aliases: <code>!d35importer</code> and <code>!d35</code>.</div>' +
            '<div style="margin-top:8px;">If you select a token before running import, the script will try to bind it as the character&apos;s default token, copy its image to the avatar, and set Bar 1 = HP and Bar 2 = AC.</div>' +
            '</div>'
        );
    }

    function handleInput(msg) {
        var matchedCommand;
        var parsed;
        var resolved;

        if (msg.type !== 'api') {
            return;
        }

        matchedCommand = getMatchedCommand(msg.content);
        if (!matchedCommand) {
            return;
        }

        if (matchedCommand === PING_COMMAND) {
            sendGM(renderList('API Listener Check', [
                SCRIPT_NAME + ' heard ' + PING_COMMAND + '.',
                'Use ' + COMMAND + ' help to show importer commands.'
            ]));
            return;
        }

        parsed = parseCommand(msg.content, matchedCommand);
        if (parsed.verb === 'help') {
            showHelp();
            return;
        }
        if (parsed.verb === 'bind') {
            bindSelectedTokenToCharacter(parsed.target, msg);
            return;
        }
        if (!parsed.target) {
            showHelp();
            return;
        }

        resolveHandout(parsed.target, function (resolvedResult) {
            resolved = resolvedResult;
            if (resolved.info) {
                sendGM(renderList('Import Notice', [resolved.info]));
            }
            if (resolved.error) {
                sendGM(renderList('Command Failed', [resolved.error]));
                return;
            }

            if (parsed.verb === 'validate') {
                validateHandout(resolved.handout);
                return;
            }

            importModelFromHandout(resolved.handout, msg);
        });
    }

    function registerEventHandlers() {
        on('chat:message', handleInput);
    }

    return {
        registerEventHandlers: registerEventHandlers
    };
}());

on('ready', function () {
    'use strict';
    D35StatblockImporter.registerEventHandlers();
    sendChat('D35 Statblock Importer', '/w gm D35 Statblock Importer is ready. Test with !d35ping or !d35import help.');
});
