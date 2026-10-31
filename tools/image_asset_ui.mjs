/** Narrow native-UI operations for a caller-supplied authenticated CUA Tab.
 * No browser connection, API requests, page scripts, or application-model writes.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

function check(ok, message) { if (!ok) throw new Error(message); }
// Native capture can be shorter than an emulated DOM viewport. Input must fit
// the captured surface; documentElement.clientHeight alone is insufficient.
function screenshotSize(bytes) {
    const b = Buffer.from(bytes || []);
    if (b.length >= 24 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
        return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
    if (b.length >= 4 && b[0] === 255 && b[1] === 216) {
        for (let i=2;i+3<b.length;) {
            if (b[i++] !== 255) continue;
            const marker=b[i++], length=b.readUInt16BE(i);
            if ([192,193,194].includes(marker) && i+7<=b.length)
                return {width:b.readUInt16BE(i+5),height:b.readUInt16BE(i+3)};
            if (length<2 || i+length>b.length) break;
            i+=length;
        }
    }
    throw new Error('Cannot verify captured browser surface dimensions. No move attempted.');
}
function imageId(url) {
    const match = /^https:\/\/(?:files\.d20\.io|s3\.amazonaws\.com\/files\.d20\.io)\/images\/(\d+)\/([A-Za-z0-9_-]+)\/(?:thumb|med|max|original)\.(?:png|jpe?g|gif|webp)(?:\?[^#\s"'<>]+)?$/i.exec(url || '');
    check(match, 'Native viewer does not reference a supported Library image.'); return match[1] + '/' + match[2];
}
function normalizePadding(raw) {
    let result = '', quoted = false, escaped = false;
    for (const c of raw) {
        result += c === '\u00a0' && !quoted ? ' ' : c;
        if (escaped) escaped = false; else if (quoted && c === '\\') escaped = true; else if (c === '"') quoted = !quoted;
    }
    return result;
}
function canonical(o) {
    if (Array.isArray(o)) return o.map(canonical);
    if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map(k => [k, canonical(o[k])]));
    return o;
}
function privateEditor(editor) {
    return editor.locator('select.inplayerjournals,select.controlledby').evaluateAll(els =>
        els.map(el => ({kind: el.className.split(' ')[0], selected: Array.from(el.selectedOptions).map(o => o.value)})));
}

export async function registerImageTransfer(tab, {transferTitle, packagePath}) {
    const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
    check(pkg.schema === 'd35-image-asset/0.1' && pkg.kind === 'player_handout' && pkg.visibility === 'gm_only', 'Use the prepared hidden Player Handout package.');
    const namePattern = new RegExp(transferTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const viewer = tab.playwright.getByRole('dialog', {name: namePattern});
    check(await viewer.count() === 1, 'Open the saved transfer Handout viewer first.');
    const link = viewer.locator('a.lightly[href]');
    check(await link.count() === 1, 'Native full-size image link missing or ambiguous.');
    const displayURL = await link.getAttribute('href'), previewURL = await link.locator('img').getAttribute('src');
    check(imageId(displayURL) === imageId(previewURL) && /\/(?:max|original)\.(?:png|jpe?g|gif|webp)(?:\?|$)/i.test(displayURL),
        'Native full-size viewer link differs from the uploaded image or is a thumbnail.');
    await viewer.getByRole('button', {name: 'Edit', exact: true}).click();
    const editor = tab.playwright.getByRole('dialog', {name: 'Edit ' + transferTitle, exact: true});
    const permissions = await privateEditor(editor);
    check(permissions.length === 2 && permissions.every(p => p.selected.length === 0), 'Transfer is not GM-only; existing permissions preserved.');
    const bodies = editor.locator('.note-editable');
    const existing = JSON.parse(normalizePadding(await bodies.nth(1).innerText()));
    const comparable = JSON.parse(JSON.stringify(existing)); comparable.image = {display_url: null};
    const expected = JSON.parse(JSON.stringify(pkg)); expected.image = {display_url: null};
    check(JSON.stringify(canonical(comparable)) === JSON.stringify(canonical(expected)) &&
        (await bodies.nth(0).innerText()).trim() === '' && await bodies.nth(0).locator('img').count() === 0,
        'Saved transfer package or Notes differ. Existing content preserved.');
    if (existing.image?.display_url) {
        check(imageId(existing.image.display_url) === imageId(displayURL) && /\/(?:max|original)\./.test(existing.image.display_url), 'Registered image was manually changed.');
        await editor.getByRole('button', {name: 'Cancel', exact: true}).click();
        return {status: 'already_registered', runtimePackage: existing, displayURL: existing.image.display_url, objectWrites: 0};
    }
    const runtimePackage = {...pkg, image: {display_url: displayURL}};
    await bodies.nth(1).fill(JSON.stringify(runtimePackage, null, 2));
    await bodies.nth(1).press('End'); await bodies.nth(1).press('Space'); await bodies.nth(1).press('Backspace');
    await editor.getByRole('button', {name: 'Save Changes', exact: true}).click();
    return {status: 'registered', runtimePackage, displayURL, previewURL, next: 'Run bind and preview. Native Journal filing and audit are required before publication is complete.'};
}

export async function prepareImageTransfer(tab, {dialogName, transferTitle, packagePath, imagePath}) {
    const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
    check(pkg.schema === 'd35-image-asset/0.1' && pkg.kind === 'player_handout' && pkg.visibility === 'gm_only', 'Use the prepared hidden Player Handout package.');
    check(path.isAbsolute(imagePath) && path.basename(imagePath) === pkg.source.filename, 'Use the exact approved local image path.');
    check(createHash('sha256').update(await readFile(imagePath)).digest('hex') === pkg.source.sha256, 'Local image SHA-256 differs from the prepared package.');
    check(typeof transferTitle === 'string' && transferTitle.trim() === transferTitle && transferTitle.length > 0, 'Supply an exact transfer title.');
    const editor = tab.playwright.getByRole('dialog', {name: dialogName, exact: true});
    check(await editor.count() === 1, 'Open the new transfer Handout editor first.');
    const permissions = await privateEditor(editor);
    check(permissions.length === 2 && permissions.every(p => p.selected.length === 0), 'Transfer is not GM-only; existing permissions preserved.');
    const bodies = editor.locator('.note-editable');
    check(await bodies.count() === 2 && (await bodies.nth(0).innerText()).trim() === '' &&
        (await bodies.nth(1).innerText()).trim() === '' && await editor.locator('.note-editable img,.avatar img').count() === 0,
        'Transfer already contains content or an uploaded image. Preserve it; use bind/audit instead of re-uploading.');
    await editor.locator('input.name').fill(transferTitle);
    await bodies.nth(1).fill(JSON.stringify(pkg, null, 2));
    // Summernote needs a native input event after fill; preserve exact JSON contents.
    await bodies.nth(1).press('End'); await bodies.nth(1).press('Space'); await bodies.nth(1).press('Backspace');
    const chooserPromise = tab.playwright.waitForEvent('filechooser', {timeoutMs: 10000});
    await editor.getByRole('button', {name: 'Choose a file...', exact: true}).click();
    const chooser = await chooserPromise; await chooser.setFiles(imagePath);
    await editor.locator('.avatar img').waitFor({state: 'visible', timeoutMs: 30000});
    const previewURL = await editor.locator('.avatar img').getAttribute('src');
    check(typeof previewURL === 'string' && /^https:\/\/(?:files\.d20\.io|s3\.amazonaws\.com\/files\.d20\.io)\/images\//.test(previewURL), 'Native upload has not produced a Library image; preserve the editor for review.');
    await editor.getByRole('button', {name: 'Save Changes', exact: true}).click();
    return {...await registerImageTransfer(tab, {transferTitle, packagePath}), transferTitle, sourceSHA256: pkg.source.sha256};
}

/** File only an importer-owned root item, using its actual pending report.
 * Native drag is followed by DOM verification; callers must still run Mod audit.
 */
export async function filePublishedHandout(tab, report) {
    check(report && ['pending_filing', 'verified'].includes(report.status) && report.evidence &&
        report.objectId === report.evidence.handoutId, 'Use the actual importer readback report.');
    const {folderIds, folderPath} = report.evidence, id = report.objectId;
    const gm = report.kind === 'gm_adventure';
    check(Array.isArray(folderIds) && Array.isArray(folderPath) && folderIds.length === folderPath.length &&
        folderPath[0] === (gm ? 'Savage Tide Adventure Path' : 'Savage Tide Player Handouts') && [id, ...folderIds].every(s => typeof s === 'string' && /^[-A-Za-z0-9_]+$/.test(s)),
        'Missing or unsupported exact Journal identities.');
    check(await tab.playwright.getByRole('dialog').filter({visible: true}).count() === 0, 'Close Handout dialogs before native filing.');
    await tab.playwright.getByRole('tab', {name: 'journalTab', exact: true}).click();
    const panel = tab.playwright.getByRole('tabpanel', {name: 'journalTab', exact: true});
    const item = panel.locator('li[data-itemid="' + id + '"]');
    const destination = panel.locator('li[data-globalfolderid="' + folderIds.at(-1) + '"]');
    check(await item.count() === 1 && await destination.count() === 1, 'Native source or destination is missing or ambiguous.');
    const ancestry = element => {
        const names = [], ids = [];
        for (let a = element; a; a = a.parentElement) {
            if (a.matches('li.dd-folder')) { ids.unshift(a.getAttribute('data-globalfolderid')); names.unshift(a.querySelector(':scope >.dd-content>.folder-title')?.textContent); }
        }
        return {ids, names};
    };
    const target = await destination.evaluate(ancestry), current = await item.evaluate(ancestry);
    check(JSON.stringify(target.ids) === JSON.stringify(folderIds) && JSON.stringify(target.names) === JSON.stringify(folderPath), 'Native destination path differs from Mod readback.');
    if (JSON.stringify(current.ids) === JSON.stringify(folderIds)) return {status: 'already_filed', objectId: id, folderPath, objectWrites: 0};
    const sourceIds = gm ? report.evidence.sourceFolderIds || [] : [];
    const sourcePath = gm ? report.evidence.sourceFolderPath || [] : [];
    check(report.status === 'pending_filing' && JSON.stringify(current.ids) === JSON.stringify(sourceIds) &&
        JSON.stringify(current.names) === JSON.stringify(sourcePath), 'Existing manual filing/move preserved; review rather than automatically reorganizing.');
    const collapsed = [];
    try {
        // Expand only the intended path. Temporarily collapse unrelated long lists
        // so both drag endpoints fit the viewport, then restore those UI controls.
        for (const folderId of folderIds) {
            const expand = panel.locator('li[data-globalfolderid="' + folderId + '"] > button[data-action="expand"]');
            if (await expand.isVisible()) await expand.click();
        }
        const others = await panel.locator('li.dd-folder').evaluateAll(els => els.filter(el =>
            !el.parentElement.closest('li.dd-folder') && el.querySelector(':scope > button[data-action="collapse"]')?.style.display !== 'none')
            .map(el => el.getAttribute('data-globalfolderid')));
        for (const other of others.filter(value => !folderIds.includes(value) && !sourceIds.includes(value))) {
            check(typeof other === 'string' && /^[-A-Za-z0-9_]+$/.test(other), 'Unsupported Journal folder identity.');
            const collapse = panel.locator('li[data-globalfolderid="' + other + '"] > button[data-action="collapse"]');
            if (await collapse.isVisible()) { await collapse.click(); collapsed.push(other); }
        }
        const rect = element => {
            const box = element.getBoundingClientRect();
            return {left: box.left, top: box.top, width: box.width, height: box.height,
                viewportWidth: element.ownerDocument.documentElement.clientWidth, viewportHeight: element.ownerDocument.documentElement.clientHeight};
        };
        // Native folder collapse animates. Let screenshot capture settle layout
        // before measuring, otherwise a previously valid row can move mid-drag.
        await tab.getScreenshot({emit: false});
        const from = await item.evaluate(rect), to = await destination.locator(':scope >.dd-content').evaluate(rect);
        const point = r => [r.left + Math.min(90, r.width / 2), r.top + r.height / 2];
        const a = point(from), b = point(to);
        check([from, to].every((r, n) => r.width > 0 && r.height > 0 && [a, b][n][0] >= 0 && [a, b][n][0] < r.viewportWidth &&
            [a, b][n][1] >= 0 && [a, b][n][1] < r.viewportHeight), 'Drag endpoints do not fit the native viewport; arrange the Journal pane and retry. No move attempted.');
        const captured = screenshotSize(await tab.getScreenshot({emit: false}));
        check([from,to].every(r=>r.viewportWidth===captured.width) &&
            [a,b].every(p=>p[0]>=0 && p[0]<captured.width && p[1]>=0 && p[1]<captured.height),
            'Drag endpoints do not fit the captured browser surface ('+captured.width+'x'+captured.height+'). DOM viewport bounds are insufficient. No move attempted.');
        await tab.drag(a, b);
        try { await destination.locator('li[data-itemid="' + id + '"]').waitFor({state: 'attached', timeoutMs: 5000}); }
        catch { /* Verify the actual ancestry below, including unsuccessful drops. */ }
        const actual = await item.evaluate(ancestry);
        check(JSON.stringify(actual.ids) === JSON.stringify(folderIds), 'Native filing did not reach the exact destination. No automatic retry; inspect and audit.');
        return {status: 'filed', objectId: id, folderPath, next: 'Run ' + (gm ? '!d35journal' : '!d35asset') + ' audit TRANSFER; native DOM filing alone is not completion.'};
    } finally {
        for (const other of collapsed) {
            const expand = panel.locator('li[data-globalfolderid="' + other + '"] > button[data-action="expand"]');
            if (await expand.isVisible()) await expand.click();
        }
    }
}
