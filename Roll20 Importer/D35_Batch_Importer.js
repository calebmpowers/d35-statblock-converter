/* Optional batch companion to D35_Statblock_Importer.js v0.7.0.
 * No schema-to-sheet mappings live here. Install after the core importer. */
var D35BatchImporter = D35BatchImporter || (function () {
    'use strict';
    var active = false;
    var MAX_ITEMS = 5;
    var MAX_INPUT = 200000;
    function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj || {}, key); }
    function copy(value) { return JSON.parse(JSON.stringify(value)); }
    function escape(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    // Roll20 splits literal newlines into separate messages; every output must
    // remain one GM whisper, including JSON and names containing line breaks.
    function say(message) { sendChat('D35 Batch', '/w gm ' + String(message).replace(/[\r\n]+/g, ' ')); }
    function api() {
        if (typeof D35StatblockImporter === 'undefined' || !D35StatblockImporter.batchV1) {
            throw new Error('Install the v0.7.0 core importer with its batchV1 bridge first.');
        }
        return D35StatblockImporter.batchV1;
    }
    function store() {
        if (!state.D35BatchImporter) { state.D35BatchImporter = { version: 1, images: {}, batches: {}, lastReport: null }; }
        if (state.D35BatchImporter.version !== 1) { throw new Error('Unsupported batch state; preserve it for review.'); }
        return state.D35BatchImporter;
    }
    // Exact canonical JSON, rather than a collision-prone short hash, binds a job.
    function canonical(value) {
        if (Array.isArray(value)) { return '[' + value.map(canonical).join(',') + ']'; }
        if (value && typeof value === 'object') {
            return '{' + Object.keys(value).sort().map(function (key) {
                return JSON.stringify(key) + ':' + canonical(value[key]);
            }).join(',') + '}';
        }
        return JSON.stringify(value);
    }
    function key(value) {
        if (typeof value !== 'string' || !value.trim() || value.length > 100) { throw new Error('Keys must be nonempty strings, at most 100 characters.'); }
        return 'key:' + api().name(value);
    }
    function privateHandout(id) {
        var handout = getObj('handout', id);
        if (!handout || handout.get('inplayerjournals') || handout.get('controlledby')) {
            throw new Error('Use an existing GM-only Handout ID, with no player editors.');
        }
        return handout;
    }
    function read(handout, done) {
        var finished = false;
        var timeout = setTimeout(function () { finish(new Error('Timed out reading GM-only Handout.')); }, 15000);
        function finish(error, value) {
            if (finished) { return; }
            finished = true; clearTimeout(timeout); done(error, value);
        }
        try {
            api().read(handout, function (text) {
                if (finished) { return; }
                try {
                    if (!text || text.length > MAX_INPUT) { throw new Error('Handout JSON is empty or exceeds 200,000 characters.'); }
                    var parsed = JSON.parse(text);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        throw new Error('Expected a JSON object in the GM-only Handout.');
                    }
                    finish(null, parsed);
                } catch (error) { finish(error); }
            });
        } catch (error) { finish(error); }
    }
    function image(record) {
        if (!record || typeof record.imgsrc !== 'string') { throw new Error('Image reference requires imgsrc.'); }
        var url = api().image(record.imgsrc);
        var width = record.width === undefined ? 70 : record.width;
        var height = record.height === undefined ? 70 : record.height;
        if (!url || typeof width !== 'number' || typeof height !== 'number' ||
                width % 1 || height % 1 || width < 1 || height < 1 || width > 1400 || height > 1400) {
            throw new Error('Use an uploaded Roll20 Library image URL with its query string and integer dimensions 1–1400.');
        }
        return { imgsrc: url, width: width, height: height };
    }
    function register(records) {
        if (!Array.isArray(records) || !records.length || records.length > 20) { throw new Error('Register 1–20 named images at once.'); }
        var images = store().images;
        var proposed = {};
        records.forEach(function (record) {
            var id = key(record.key);
            var ref = image(record);
            if (own(proposed, id)) { throw new Error('Duplicate image key: ' + record.key); }
            if (own(images, id) && canonical(images[id]) !== canonical(ref)) {
                throw new Error('Image key already has a different reference: ' + record.key + '. Use a new explicit key.');
            }
            proposed[id] = ref;
        });
        if (Object.keys(images).length + Object.keys(proposed).filter(function (id) { return !own(images, id); }).length > 1000) {
            throw new Error('Registry limit reached; preserve/export state for review.');
        }
        Object.keys(proposed).forEach(function (id) { images[id] = proposed[id]; });
        say('Registered ' + records.length + ' image references. No images uploaded and no Characters changed.');
    }
    function envelope(data) {
        if (!data || data.batch_version !== 1 || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(data.batch_id || '') ||
                !Array.isArray(data.items) || !data.items.length || data.items.length > MAX_ITEMS) {
            throw new Error('Expected batch_version:1, a stable batch_id, and 1–5 items.');
        }
        if (!getObj('page', data.page_id)) { throw new Error('page_id must identify the intended GM staging page.'); }
        var seen = {};
        data.items.forEach(function (item) {
            if (!item || !item.payload) { throw new Error('Every item needs key, image_key and payload.'); }
            var id = key(item.key);
            key(item.image_key);
            if (own(seen, id)) { throw new Error('Duplicate item key: ' + item.key); }
            seen[id] = true;
        });
        return canonical({ batch_version: 1, batch_id: data.batch_id, page_id: data.page_id, items: data.items });
    }
    function sourceName(data, item, name) { return '[D35 Batch ' + data.batch_id + '/' + item.key + '] ' + name; }
    function manifests() { return state.D35StatblockImporter && state.D35StatblockImporter.characters || {}; }
    function plan(data, handoutId, msg) {
        var input = envelope(data);
        var job = store().batches['batch:' + data.batch_id];
        if (job && (job.input !== input || job.handoutId !== handoutId)) {
            throw new Error('This batch_id is bound to different input or another Handout. Preserve it and use a new batch_id.');
        }
        var rows = data.items.map(function (item) {
            var old = job && job.items[key(item.key)];
            var row = { key: item.key, imageKey: item.image_key, status: 'ready', name: '', reason: '' };
            try {
                row.image = store().images[key(item.image_key)] || null;
                row.proposed = api().prepare(item.payload, msg, row.image, data.page_id);
                row.name = row.proposed.name;
                if (!row.image) { throw new Error('Missing registered image reference: ' + item.image_key); }
                if (old) {
                    ['sourceHandoutId', 'tokenId', 'characterId'].forEach(function (field) { if (old[field]) { row[field] = old[field]; } });
                    if (old.sourceHandoutId) {
                        privateHandout(old.sourceHandoutId);
                        var recovered = Object.keys(manifests()).filter(function (id) {
                            return manifests()[id].sourceHandoutId === old.sourceHandoutId;
                        });
                        if (recovered.length > 1) { throw new Error('Multiple managed Characters claim this source.'); }
                        row.characterId = old.characterId || recovered[0];
                    }
                    if (old.tokenId && !getObj('graphic', old.tokenId)) { throw new Error('Recorded staging token is missing; review rather than recreate.'); }
                }
                var matches = findObjs({ _type: 'character' }).filter(function (obj) { return api().name(obj.get('name')) === api().name(row.name); });
                if (matches.some(function (obj) { return obj.id !== row.characterId; })) {
                    throw new Error('Existing ' + (matches.some(function (obj) { return !!manifests()[obj.id]; }) ? 'managed' : 'unmanaged') + ' Character name conflict; no automatic adoption/update.');
                }
                if (row.characterId) {
                    var manifest = manifests()[row.characterId];
                    if (!getObj('character', row.characterId) || !manifest || manifest.sourceHandoutId !== row.sourceHandoutId ||
                            !manifest.baseline || manifest.pending || !manifest.baseline.token || manifest.baseline.token.id !== row.tokenId) {
                        throw new Error('Existing partial/missing managed output requires explicit lifecycle audit/review; no second Character will be created.');
                    }
                    row.status = 'audit';
                    row.reason = 'Existing batch output: verify with the managed audit; do not import again.';
                }
                if (!row.sourceHandoutId && findObjs({ _type: 'handout' }).some(function (obj) {
                    return api().name(obj.get('name')) === api().name(sourceName(data, item, row.name));
                })) { throw new Error('Unclaimed source Handout name already exists; review it.'); }
                if (row.tokenId) {
                    var token = getObj('graphic', row.tokenId);
                    if (token.get('_pageid') !== data.page_id || token.get('layer') !== 'gmlayer' ||
                            !api().sameImage(token.get('imgsrc'), row.image.imgsrc) ||
                            Number(token.get('width')) !== row.image.width || Number(token.get('height')) !== row.image.height ||
                            String(token.get('represents') || '') !== String(row.characterId || '')) {
                        throw new Error('Recorded staging token changed; review rather than replace.');
                    }
                }
            } catch (error) { row.status = 'blocked'; row.reason = error.message; }
            return row;
        });
        rows.forEach(function (row) {
            if (row.name && rows.filter(function (other) { return api().name(other.name) === api().name(row.name); }).length > 1) {
                row.status = 'blocked'; row.reason = 'Duplicate normalized Character name within batch.';
            }
        });
        return { input: input, job: job, rows: rows };
    }
    function report(data, rows, operation) {
        var result = { batchId: data.batch_id, operation: operation, at: new Date().toISOString(),
            sheetCalculationsVerified: false, items: rows.map(function (row) {
                var result = copy(row); delete result.image; return result;
            }) };
        store().lastReport = result;
        say('<b>Batch ' + escape(data.batch_id) + ': ' + operation + '</b><br>' + result.items.map(function (row) {
            return escape(row.name || row.key) + ': <b>' + row.status + '</b>' +
                (row.reason ? ' — ' + escape(row.reason) : '') +
                (row.proposed ? ' (' + row.proposed.attributes + ' attributes, ' + row.proposed.abilities + ' abilities; HP ' +
                    escape(row.proposed.token.bar1_max) + ', AC ' + escape(row.proposed.token.bar2_value) + ')' : '');
        }).join('<br>') + '<br>Default tokens use the existing importer policy. Sheet calculations/rolls need live commissioning.');
        return result;
    }
    function apply(data, handout, msg, prepared, done) {
        var jobs = store().batches;
        if (!prepared.job && Object.keys(jobs).length >= 20) { throw new Error('20-job batch limit reached; preserve/export state for review.'); }
        var job = prepared.job || { input: prepared.input, handoutId: handout.id, items: {} };
        jobs['batch:' + data.batch_id] = job;
        var index = 0;
        function next() {
            if (index === data.items.length) { report(data, prepared.rows, 'apply'); done(); return; }
            var at = index++;
            var item = data.items[at];
            var row = prepared.rows[at];
            // Recheck names/ownership immediately before each mutation.
            var fresh;
            try { fresh = plan(data, handout.id, msg).rows[at]; }
            catch (error) { row.status = 'blocked'; row.reason = error.message; next(); return; }
            Object.keys(fresh).forEach(function (field) { row[field] = fresh[field]; });
            var record = job.items[key(item.key)] || {};
            job.items[key(item.key)] = record;
            if (row.status === 'blocked') { record.status = 'blocked'; record.reason = row.reason; next(); return; }
            record.status = 'running'; record.key = item.key; record.name = row.name;
            function failure(error) {
                row.status = 'failed'; row.reason = error.message;
                record.status = row.status; record.reason = row.reason; next();
            }
            function complete(result) {
                record.characterId = result.characterId || record.characterId;
                record.verification = { status: result.status, storedObjectsVerified: result.storedObjectsVerified,
                    sheetCalculationsVerified: false, at: result.at, issues: result.issues.slice(0, 32) };
                row.characterId = record.characterId;
                row.status = result.status === 'verified' && result.storedObjectsVerified ? 'succeeded' : 'failed';
                row.reason = row.status === 'succeeded' ? 'Managed stored-object readback verified.' :
                    'Managed ' + result.status + '; inspect !d35import report and audit before retrying a partial import.';
                record.status = row.status; record.reason = row.reason; next();
            }
            function run(source) {
                read(source, function (error, payload) {
                    if (error) { failure(error); return; }
                    if (canonical(payload) !== canonical(item.payload)) { failure(new Error('Source Handout differs from the immutable batch payload.')); return; }
                    try {
                        api().run(row.characterId ? 'audit' : 'import', row.characterId || null, source, msg, record.tokenId, complete);
                    } catch (runError) { failure(runError); }
                });
            }
            try {
                var source = record.sourceHandoutId && privateHandout(record.sourceHandoutId);
                if (!source) {
                    source = createObj('handout', { name: sourceName(data, item, row.name), inplayerjournals: '', controlledby: '' });
                    if (!source) { throw new Error('Source Handout creation failed.'); }
                    record.sourceHandoutId = source.id;
                    source.set('gmnotes', '<pre>' + escape(JSON.stringify(item.payload)) + '</pre>');
                }
                row.sourceHandoutId = source.id;
                if (!record.tokenId) {
                    var token = createObj('graphic', { pageid: data.page_id, layer: 'gmlayer',
                        imgsrc: row.image.imgsrc, width: row.image.width, height: row.image.height,
                        name: row.name, left: 140 + at * 140, top: 140 });
                    if (!token) { throw new Error('Library-token creation failed.'); }
                    record.tokenId = token.id;
                }
                row.tokenId = record.tokenId;
                run(source);
            } catch (error) { failure(error); }
        }
        next();
    }
    function handle(msg) {
        if (msg.type !== 'api' || !/^!d35batch(?:\s|$)/i.test(msg.content || '') || !playerIsGM(msg.playerid)) { return; }
        if (active) { say('Batch coordinator busy. Wait for its report.'); return; }
        var words = msg.content.trim().split(/\s+/);
        var command = (words[1] || 'help').toLowerCase();
        try {
            api();
            if (command === 'help') {
                say('Optional batch commands: !d35batch register HANDOUT_ID (images array), register-selected (named GM-layer Library tokens), ' +
                    'preview HANDOUT_ID, apply HANDOUT_ID, status. At most 5 creatures; one GM-only input Handout.<br>' +
                    'Available staging page IDs: ' + findObjs({ _type: 'page' }).slice(0, 20).map(function (page) {
                        return escape(page.get('name')) + ' [' + escape(page.id) + ']';
                    }).join('; ')); return;
            }
            if (command === 'status') { say('<pre>' + escape(JSON.stringify(store().lastReport)) + '</pre>'); return; }
            if (command === 'register-selected') {
                register((msg.selected || []).map(function (selected) {
                    var token = selected._type === 'graphic' && getObj('graphic', selected._id);
                    if (!token || token.get('_subtype') !== 'token' || token.get('layer') !== 'gmlayer') {
                        throw new Error('Bulk registration needs named GM-layer token graphics.');
                    }
                    return { key: token.get('name'), imgsrc: token.get('imgsrc'), width: Number(token.get('width')), height: Number(token.get('height')) };
                })); return;
            }
            if (['register', 'preview', 'apply'].indexOf(command) === -1 || words.length !== 3) { throw new Error('Use !d35batch help.'); }
            var handout = privateHandout(words[2]);
            active = true;
            read(handout, function (error, data) {
                function done() { active = false; }
                try {
                    if (error) { throw error; }
                    // Permissions can change while waiting for the asynchronous blob.
                    privateHandout(handout.id);
                    if (command === 'register') { register(data.images); done(); return; }
                    var prepared = plan(data, handout.id, msg);
                    if (command === 'preview') { report(data, prepared.rows, 'preview'); done(); }
                    else { apply(data, handout, msg, prepared, done); }
                } catch (readError) { done(); say('Blocked: ' + escape(readError.message)); }
            });
        } catch (error) { active = false; say('Blocked: ' + escape(error.message)); }
    }
    return { registerEventHandlers: function () { on('chat:message', handle); } };
}());
on('ready', function () {
    'use strict';
    D35BatchImporter.registerEventHandlers();
    sendChat('D35 Batch', '/w gm Optional batch companion v0.7.0 ready: !d35batch help. No library upload/enumeration.');
});
