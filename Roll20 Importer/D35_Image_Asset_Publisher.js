/* D35 Image Asset Publisher v0.1.0. Requires the unchanged D35 Journal Importer.
 * Upload and Journal filing are native UI operations. This Mod never writes folders.
 */
var D35ImageAssetPublisher = (function () {
    'use strict';
    var busy = false, root = 'Savage Tide Player Handouts';
    function check(ok, message) { if (!ok) { throw new Error(message); } }
    function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fields(o, names) {
        check(o && typeof o === 'object' && !Array.isArray(o) &&
            Object.keys(o).length === names.length && names.every(function (k) { return own(o, k); }), 'Unexpected or missing package fields.');
    }
    function text(s, label, max) {
        check(typeof s === 'string' && s.length > 0 && s.length <= (max || 240) && s === s.trim() && !/[\x00-\x1f]/.test(s), 'Invalid ' + label + '.');
    }
    function canonical(o) {
        if (Array.isArray(o)) { return o.map(canonical); }
        if (o && typeof o === 'object') { var result = {}; Object.keys(o).sort().forEach(function (k) { result[k] = canonical(o[k]); }); return result; }
        return o;
    }
    function hash(o) {
        check(typeof D35JournalImporter !== 'undefined' && typeof D35JournalImporter.sha256 === 'function', 'Install the existing D35 Journal Importer first.');
        return D35JournalImporter.sha256(JSON.stringify(canonical(o)));
    }
    function validate(p) {
        fields(p, ['schema', 'publication_id', 'kind', 'title', 'folder_path', 'visibility', 'source', 'image']);
        check(p.schema === 'd35-image-asset/0.1' && p.kind === 'player_handout', 'Unsupported Player Handout image package.');
        check(typeof p.publication_id === 'string' && /^[a-z0-9][a-z0-9._:-]{2,159}$/.test(p.publication_id), 'Invalid stable publication identity.');
        check(p.visibility === 'gm_only', 'Player Handouts must begin hidden.'); text(p.title, 'exact title');
        check(Array.isArray(p.folder_path) && p.folder_path.length >= 2 && p.folder_path.length <= 12 && p.folder_path[0] === root,
            'Supply the exact established Player Handouts adventure folder path.');
        p.folder_path.forEach(function (n) { text(n, 'exact folder name'); });
        var s = p.source;
        fields(s, ['kind', 'asset_id', 'filename', 'url', 'sha256', 'pixel_width', 'pixel_height', 'authority']);
        check(['drive', 'synthetic'].indexOf(s.kind) !== -1, 'Unsupported source kind.');
        check(typeof s.asset_id === 'string' && /^[-A-Za-z0-9_]{1,240}$/.test(s.asset_id), 'Invalid source identity.');
        text(s.filename, 'canonical filename'); check(!/[\\/:*?"<>|]/.test(s.filename), 'Use a filename, not a path.');
        check(s.url === (s.kind === 'drive' ? 'https://drive.google.com/file/d/' + s.asset_id + '/view' : 'synthetic://' + s.asset_id), 'Source reference differs from asset identity.');
        check(typeof s.sha256 === 'string' && /^[0-9a-f]{64}$/.test(s.sha256), 'Missing approved source SHA-256.');
        ['pixel_width', 'pixel_height'].forEach(function (k) { check(Number.isInteger(s[k]) && s[k] > 0 && s[k] <= 30000, 'Invalid source dimensions.'); });
        text(s.authority, 'approval and naming/folder authority', 4000);
        fields(p.image, ['display_url']);
        if (p.image.display_url !== null) {
            imageIdentity(p.image.display_url);
            check(/\/(?:max|original)\.(?:png|jpe?g|gif|webp)(?:\?|$)/i.test(p.image.display_url),
                'Use the actual full-size image link from the native Handout viewer, not its thumbnail.');
        }
        return {pkg: p, key: 'asset:' + p.publication_id, fingerprint: hash(p)};
    }
    // Same Library image identity rule as Map Page Setup, including queryless uploads.
    function imageIdentity(url) {
        var m = typeof url === 'string' && /^https:\/\/(?:files\.d20\.io|s3\.amazonaws\.com\/files\.d20\.io)\/images\/(\d+)\/([A-Za-z0-9_-]+)\/(?:thumb|med|max|original)\.(?:png|jpe?g|gif|webp)(?:\?[^#\s"'<>]+)?$/i.exec(url);
        check(m, 'Upload the approved image through the native UI; use a Roll20 Library image, not an external or invented URL.');
        return m[1] + '/' + m[2];
    }
    function escape(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function decode(s) {
        var entities = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0'};
        return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (all, k) {
            if (k[0] !== '#') { check(own(entities, k.toLowerCase()), 'Unsupported HTML entity.'); return entities[k.toLowerCase()]; }
            var n = k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
            check(n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff), 'Invalid HTML entity.'); return String.fromCodePoint(n);
        });
    }
    function transport(raw) {
        check(typeof raw === 'string' && raw.length <= 1000000, 'Invalid or oversized transfer.'); raw = raw.trim();
        if (/^%(7b|3c)/i.test(raw)) { raw = decodeURIComponent(raw); }
        if (raw[0] === '<') {
            check(!/<\/?(?!p\b|div\b|span\b|pre\b|br\b)[a-z]/i.test(raw), 'Unsupported transfer wrapper; paste plain JSON.');
            raw = decode(raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|pre)>/gi, '\n').replace(/<[^>]*>/g, ''));
        }
        var out = '', quoted = false, escaped = false;
        for (var i = 0; i < raw.length; i++) {
            var c = raw[i]; out += c === '\u00a0' && !quoted ? ' ' : c;
            if (escaped) { escaped = false; } else if (quoted && c === '\\') { escaped = true; } else if (c === '"') { quoted = !quoted; }
        }
        return JSON.parse(out);
    }
    function store() {
        if (!state.D35ImageAssetPublisher) { state.D35ImageAssetPublisher = {version: 1, bindings: {}, publications: {}, lastReport: null}; }
        var s = state.D35ImageAssetPublisher;
        check(s.version === 1 && s.bindings && s.publications && typeof s.bindings === 'object' && typeof s.publications === 'object' &&
            !Array.isArray(s.bindings) && !Array.isArray(s.publications), 'Unsupported image-publisher state; preserve it for review.'); return s;
    }
    function privateHandout(h) {
        check(h && h.get('inplayerjournals') === '' && h.get('controlledby') === '', 'Use a GM-only transfer with no player editors.'); return h;
    }
    function transfer(ref) {
        var h = getObj('handout', ref);
        if (!h) { var matches = findObjs({_type: 'handout', name: ref}); check(matches.length === 1, 'Transfer missing or ambiguous; use its ID.'); h = matches[0]; }
        return privateHandout(h);
    }
    function read(h, prop) {
        return new Promise(function (resolve, reject) {
            var done = false, timer = setTimeout(function () { if (!done) { done = true; reject(new Error('Handout read timed out. No automatic retry writes.')); } }, 10000);
            try { h.get(prop, function (value) { if (!done) { done = true; clearTimeout(timer); resolve(value); } }); }
            catch (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } }
        });
    }
    function folders(path, objectId) {
        var raw = Campaign().get('_journalfolder');
        check(typeof raw === 'string' && raw.length <= 4000000, 'Journal folder readback unavailable.');
        var tree = JSON.parse(raw || '[]'), found = [], references = [], ids = {};
        function walk(items, names, chain) {
            check(Array.isArray(items), 'Unsupported Journal folder structure.');
            items.forEach(function (item) {
                if (typeof item === 'string') { if (item === objectId) { references.push(names); } return; }
                check(item && typeof item.n === 'string' && Array.isArray(item.i) &&
                    (typeof item.id === 'string' || typeof item.id === 'number'), 'Unsupported Journal folder identity; no folder writes.');
                var id = String(item.id); check(id && !own(ids, 'folder:' + id), 'Duplicate Journal folder identity.'); ids['folder:' + id] = true;
                var next = names.concat(item.n), nextIds = chain.concat(id);
                if (JSON.stringify(next) === JSON.stringify(path)) { found.push(nextIds); }
                walk(item.i, next, nextIds);
            });
        }
        walk(tree, [], []); check(found.length === 1, 'Exact destination folder missing or ambiguous. Create/select the established folder through the native UI.');
        return {ids: found[0], references: references};
    }
    function binding(data, input) {
        privateHandout(getObj('handout', input.id)); var s = store(), b = s.bindings[data.key];
        var currentImage = imageIdentity(input.get('avatar')), currentFolders = folders(data.pkg.folder_path);
        check(b && b.fingerprint === data.fingerprint && b.transferId === input.id, 'Bind this exact prepared package and transfer first; source, title and destination changes are conflicts.');
        check(currentImage === b.imageId && imageIdentity(b.url) === b.imageId && b.url === data.pkg.image.display_url &&
            JSON.stringify(currentFolders.ids) === JSON.stringify(b.folderIds), 'Uploaded image or destination folder identity changed; existing work preserved.');
        return b;
    }
    function choose(data, input) {
        var s = store(), record = s.publications[data.key], matches = findObjs({_type: 'handout', name: data.pkg.title});
        if (record) {
            var h = getObj('handout', record.handoutId);
            check(h && h.id !== input.id && record.fingerprint === data.fingerprint && matches.length === 1 && matches[0].id === h.id,
                'Managed destination missing, renamed, ambiguous, or package changed. No replacement or overwrite.'); return h;
        }
        check(matches.length === 0 && !Object.keys(s.publications).some(function (k) { return s.publications[k].title === data.pkg.title; }),
            'Destination title already exists or is managed by another identity. No automatic adoption.'); return null;
    }
    function notes(data, url) {
        var p = data.pkg;
        return '<p><img src="' + escape(url) + '" alt="' + escape(p.title) + '" width="' + p.source.pixel_width +
            '" height="' + p.source.pixel_height + '" style="max-width:100%;height:auto;"></p>';
    }
    function empty(raw) { return raw === null || raw === 'null' || typeof raw === 'string' && /^\s*$/.test(decode(raw.replace(/<\/?(?:p|div|span)\b[^>]*>|<br\s*\/?>/gi, ''))); }
    function imageHTML(raw, data, bound) {
        check(typeof raw === 'string' && raw.length <= 100000, 'Invalid image Notes.');
        var tokens = raw.match(/<[^>]*>|[^<]+/g) || [], stack = [], count = 0;
        check(tokens.join('') === raw, 'Malformed image HTML.');
        tokens.forEach(function (token) {
            if (token[0] !== '<') { check(/^\s*$/.test(decode(token)), 'Unexpected prose in image Handout.'); return; }
            var m = /^<(\/)?([a-z][a-z0-9]*)([\s\S]*?)\s*(\/?)>$/i.exec(token);
            check(m, 'Unsupported image HTML.'); var tag = m[2].toLowerCase(), closing = !!m[1];
            check(['p', 'div', 'span', 'br', 'img'].indexOf(tag) !== -1, 'Unexpected image HTML element.');
            if (closing) { check(!m[3].trim() && !m[4] && stack.pop() === tag, 'Unbalanced image HTML.'); return; }
            var attrs = {}, rest = m[3], a;
            while (rest.trim()) {
                a = /^\s+([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rest);
                check(a && !own(attrs, a[1].toLowerCase()), 'Invalid or duplicate image attribute.');
                attrs[a[1].toLowerCase()] = decode(a[2] === undefined ? a[3] : a[2]); rest = rest.slice(a[0].length);
            }
            if (tag === 'img') {
                count++; check(count === 1 && imageIdentity(attrs.src) === bound.imageId &&
                    /\/(?:max|original)\.(?:png|jpe?g|gif|webp)(?:\?|$)/i.test(attrs.src) && attrs.alt === data.pkg.title, 'Missing, duplicated or changed full-size source image/title.');
                check(Object.keys(attrs).every(function (k) { return ['src', 'alt', 'width', 'height', 'style'].indexOf(k) !== -1; }), 'Unexpected image attribute.');
                check(attrs.width === String(data.pkg.source.pixel_width) && attrs.height === String(data.pkg.source.pixel_height), 'Image dimensions changed.');
                var style = {};
                (attrs.style || '').split(';').filter(function (s) { return s.trim(); }).forEach(function (rule) {
                    var pair = rule.split(':'); check(pair.length === 2 && !own(style, pair[0].trim().toLowerCase()), 'Invalid image style.'); style[pair[0].trim().toLowerCase()] = pair[1].trim().toLowerCase();
                });
                check(Object.keys(style).length === 2 && style['max-width'] === '100%' && style.height === 'auto', 'Image scaling/crop style changed.');
            } else {
                check(Object.keys(attrs).length === 0, 'Unexpected wrapper attributes.');
                if (tag !== 'br') { check(!m[4], 'Unsupported self-closing wrapper.'); stack.push(tag); }
            }
        });
        check(count === 1 && stack.length === 0, 'Missing image or unbalanced Notes.'); return true;
    }
    function metadata(h, data) {
        check(getObj('handout', h.id) && h.get('name') === data.pkg.title && h.get('avatar') === '' && h.get('archived') === false &&
            h.get('inplayerjournals') === '' && h.get('controlledby') === '', 'Handout identity, presentation or permissions changed. Existing work preserved.');
    }
    async function verify(h, data, input, bound) {
        metadata(h, data); var blobs = await Promise.all([read(h, 'notes'), read(h, 'gmnotes')]);
        metadata(h, data); binding(data, input); choose(data, input);
        imageHTML(blobs[0], data, bound); check(empty(blobs[1]), 'GM Notes are not empty; no overwrite.');
        var location = folders(data.pkg.folder_path, h.id), refs = location.references, r = store().publications[data.key];
        check(refs.length <= 1, 'Handout appears more than once in the Journal; review filing.');
        var filed = refs.length === 1 && JSON.stringify(refs[0]) === JSON.stringify(data.pkg.folder_path);
        check(filed || r.status !== 'verified' && (refs.length === 0 || refs[0].length === 0), 'Handout was moved or filed in a different folder; no automatic reorganization.');
        return {filed: filed, handoutId: h.id, folderIds: location.ids, folderPath: data.pkg.folder_path,
            imageId: bound.imageId, sourceSHA256: data.pkg.source.sha256, notes: blobs[0], gmnotesEmpty: true,
            inplayerjournals: h.get('inplayerjournals'), controlledby: h.get('controlledby'), avatar: h.get('avatar'), archived: h.get('archived')};
    }
    function report(value) {
        try { store().lastReport = value; } catch (e) { /* Preserve incompatible state. */ }
        log('D35_IMAGE_ASSET_REPORT ' + JSON.stringify(value));
        sendChat('D35 Image Asset', '/w gm ' + escape(value.status.toUpperCase() + ': ' + value.message));
    }
    async function command(msg) {
        if (msg.type !== 'api' || !/^!d35asset(?:\s|$)/.test(msg.content) || !playerIsGM(msg.playerid)) { return; }
        if (busy) { report({status: 'error', message: 'Image publication in progress; wait for its report.'}); return; }
        var m = /^!d35asset\s+(bind|preview|import|audit)\s+(.+?)\s*$/.exec(msg.content);
        if (!m) { report({status: 'error', message: 'Use !d35asset bind|preview|import|audit TRANSFER (exact name or ID).'}); return; }
        busy = true; var createdId = null;
        try {
            var input = transfer(m[2]), data = validate(transport(await read(input, 'gmnotes'))), s = store();
            privateHandout(getObj('handout', input.id));
            if (m[1] === 'bind') {
                check(data.pkg.image.display_url !== null, 'Register the actual full-size link from the native viewer first; avatar URLs may be thumbnails.');
                check(imageIdentity(data.pkg.image.display_url) === imageIdentity(input.get('avatar')), 'Full-size display link differs from the uploaded transfer image.');
                var proposed = {fingerprint: data.fingerprint, transferId: input.id, url: data.pkg.image.display_url,
                    imageId: imageIdentity(input.get('avatar')), folderIds: folders(data.pkg.folder_path).ids};
                var previous = s.bindings[data.key];
                check(!previous || previous.fingerprint === proposed.fingerprint && previous.transferId === proposed.transferId &&
                    previous.imageId === proposed.imageId && JSON.stringify(previous.folderIds) === JSON.stringify(proposed.folderIds), 'Binding changed; existing source and objects preserved.');
                choose(data, input); if (!previous) { s.bindings[data.key] = proposed; }
                report({status: 'bound', action: previous ? 'preserve' : 'bind', binding: s.bindings[data.key], message: 'Bound the uploaded Library image and exact existing Journal folder. No Handout created.'});
            } else {
                var bound = binding(data, input), h = choose(data, input), action = 'preserve';
                if (!h && m[1] === 'preview') {
                    report({status: 'preview', action: 'create', binding: bound, message: 'Would create hidden Player Handout ' + data.pkg.title + '. Native UI filing into ' + data.pkg.folder_path.join(' / ') + ' is required before completion.'}); return;
                }
                check(h || m[1] === 'import', 'No managed Handout to audit; preview and import first.');
                if (!h) {
                    binding(data, input); check(!choose(data, input), 'Destination appeared; retry verification.');
                    h = createObj('handout', {name: data.pkg.title, avatar: '', archived: false, inplayerjournals: '', controlledby: ''});
                    check(h && h.id, 'Handout creation failed.'); createdId = h.id; action = 'created';
                    s.publications[data.key] = {handoutId: h.id, title: data.pkg.title, fingerprint: data.fingerprint, status: 'pending_filing'};
                    h.set('notes', notes(data, bound.url)); h.set('gmnotes', '');
                }
                var evidence = await verify(h, data, input, bound);
                if (evidence.filed) { s.publications[data.key].status = 'verified'; }
                report({status: evidence.filed ? 'verified' : 'pending_filing', action: action, objectId: h.id, evidence: evidence,
                    message: evidence.filed ? 'Verified ' + data.pkg.title + ' [' + h.id + ']: exact source image, presentation, empty GM Notes, hidden permissions and Journal folder. ' + (action === 'preserve' ? 'No Handout writes.' : '') :
                        'Handout [' + h.id + '] is hidden and its image passed readback. PUBLICATION INCOMPLETE: use the native UI to file it into ' + data.pkg.folder_path.join(' / ') + ', then run audit. Repeat import preserves this ID.'});
            }
        } catch (e) { report({status: 'error', objectId: createdId, message: String(e.message || e) + (createdId ? ' Created Handout retained and identity reserved; no replacement or overwrite on retry.' : '')}); }
        finally { busy = false; }
    }
    on('ready', function () { on('chat:message', command); log('D35 Image Asset Publisher v0.1.0 ready. Native upload and filing required; hidden by default.'); });
    return {validate: validate, imageIdentity: imageIdentity, imageHTML: imageHTML, notes: notes, folders: folders, transport: transport};
}());
