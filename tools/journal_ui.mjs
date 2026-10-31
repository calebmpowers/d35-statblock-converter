/** Journal integration only; all folder movement uses the existing native UI helper. */
import {filePublishedHandout} from './image_asset_ui.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';

function check(ok, message) { if (!ok) throw new Error(message); }

async function prepareJournalHandout(gameTab, {packagePath, transferTitle, draftId = null}, runtimeTarget = false) {
    const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
    check(pkg.schema === 'd35-journal/0.1' && pkg.filing?.kind === 'gm_adventure' &&
        pkg.filing.folder_path[0] === 'Savage Tide Adventure Path' && typeof transferTitle === 'string' && transferTitle.trim() === transferTitle && transferTitle,
        'Supply a prepared GM adventure package and exact new transfer title.');
    const ids = pkg.filing.folder_ids;
    check(Array.isArray(ids) && ids.length >= 3 && ids.every(id => /^[-A-Za-z0-9_]+$/.test(id)), 'Use actual existing folder identities.');
    check(!runtimeTarget || pkg.filing.legacy_source===null && transferTitle===pkg.handout.name, 'Folder-first creation requires the package title and no legacy migration.');
    await gameTab.playwright.getByRole('tab', {name:'journalTab',exact:true}).click();
    const panel = gameTab.playwright.getByRole('tabpanel', {name:'journalTab',exact:true});
    check(await panel.getByText(transferTitle, {exact:true}).count() === 0, 'Transfer title already exists; preserve and reuse it.');
    const search = panel.getByRole('searchbox', {name:'Search by tag or name...',exact:true});
    await search.fill(''); await search.press('Enter');
    const folder = panel.locator('li[data-globalfolderid="' + ids.at(-1) + '"]');
    check(await folder.count() === 1, 'Existing Part folder missing or ambiguous.');
    const names = await folder.evaluate(el => {
        const names=[];for(let p=el;p;p=p.parentElement)if(p.matches('li.dd-folder'))names.unshift(p.querySelector(':scope >.dd-content>.folder-title')?.textContent);return names;
    });
    check(JSON.stringify(names) === JSON.stringify(pkg.filing.folder_path), 'Existing folder path differs from the approved plan.');
    const actualIds=await folder.evaluate(el=>{const result=[];for(let p=el;p;p=p.parentElement)if(p.matches('li.dd-folder'))result.unshift(p.getAttribute('data-globalfolderid'));return result;});
    check(JSON.stringify(actualIds)===JSON.stringify(ids),'Existing ancestor folder identities differ from the approved plan.');
    for(const id of ids) {
        const expand=panel.locator('li[data-globalfolderid="'+id+'"] >button[data-action="expand"]');
        if(await expand.isVisible())await expand.click();
    }
    let draft;
    if (draftId !== null) {
        check(typeof draftId === 'string' && /^[-A-Za-z0-9_]+$/.test(draftId), 'Invalid interrupted transfer draft identity.');
        draft = folder.locator('li.journalitem[data-itemid="' + draftId + '"]');
        check(await draft.count() === 1 && (await draft.locator('.namecontainer').innerText()) === 'Mysterious Note', 'Interrupted draft changed; preserve it for review.');
    } else {
        const existing = await folder.locator('li.journalitem[data-itemid]').evaluateAll(els=>els.map(e=>e.getAttribute('data-itemid')));
        check(existing.every(id=>/^[-A-Za-z0-9_]+$/.test(id)), 'Unsupported existing Journal identity.');
        const selector = 'li.journalitem[data-itemid]' + existing.map(id=>':not([data-itemid="'+id+'"])').join('');
        await folder.locator(':scope >.dd-content>.folder-title').click({button:'right'});
        await gameTab.playwright.getByText('Add Handout', {exact:true}).click();
        draft = folder.locator(selector);
        await draft.waitFor({state:'visible',timeoutMs:10000});
        check(await draft.count() === 1, 'New transfer draft missing or ambiguous; no automatic retry creation.');
    }
    // Folder-context Add Handout creates an item without opening its editor.
    await draft.locator('.namecontainer').click();
    const viewer = gameTab.playwright.getByRole('dialog', {name:/Mysterious Note/});
    await viewer.waitFor({state:'visible',timeoutMs:10000});
    await viewer.getByRole('button', {name:'Edit',exact:true}).click();
    const editor = gameTab.playwright.getByRole('dialog', {name:'Edit Mysterious Note',exact:true});
    await editor.waitFor({state:'visible',timeoutMs:10000});
    const permissions = await editor.locator('select.inplayerjournals,select.controlledby').evaluateAll(els=>els.map(s=>Array.from(s.selectedOptions).map(o=>o.value)));
    check(permissions.length === 2 && permissions.every(p=>p.length === 0), 'New transfer is not GM-only; preserve for review.');
    const bodies = editor.locator('.note-editable');
    check(await bodies.count() === 2 && (await bodies.nth(0).innerText()).trim() === '' && (await bodies.nth(1).innerText()).trim() === '' &&
        await editor.locator('.note-editable img,.avatar img').count() === 0, 'Draft contains existing content; no overwrite.');
    await editor.locator('input.name').fill(transferTitle);
    const objectId=await draft.getAttribute('data-itemid');
    if(!runtimeTarget) {
        const body = editor.locator('.note-editable').nth(1);
        await body.fill(JSON.stringify(pkg,null,2)); await body.press('End'); await body.press('Space'); await body.press('Backspace');
    }
    await editor.getByRole('button', {name:'Save Changes',exact:true}).click();
    check(await folder.locator('li.journalitem[data-itemid="'+objectId+'"]').count()===1,'Saved Handout lost its original folder placement.');
    return {status:'prepared',objectId,transferTitle,folderIds:ids,folderPath:names,next:runtimeTarget?'Close the viewer; preview/import TRANSFER --target '+objectId:'Close the transfer viewer and run importAndFileJournal; no runtime entry is created here.'};
}

export async function prepareJournalTransfer(gameTab, options) {return prepareJournalHandout(gameTab,options);}
export async function prepareJournalTarget(gameTab, {packagePath,draftId=null}) {
    const pkg=JSON.parse(await readFile(packagePath,'utf8'));
    return prepareJournalHandout(gameTab,{packagePath,transferTitle:pkg.handout.name,draftId},true);
}

export async function readJournalReport(consoleTab, requestId = null) {
    const lines = await consoleTab.playwright.locator('#apiconsole .ace_line').allTextContents({timeoutMs: 3000});
    const reports = [];
    for (const line of lines) {
        try {
            const message = JSON.parse(line);
            if (typeof message === 'string' && message.startsWith('D35_JOURNAL_REPORT ')) reports.push(JSON.parse(message.slice(19)));
        } catch { /* Console also contains unrelated sandbox diagnostics. */ }
    }
    return reports.filter(r => requestId === null || r.requestId === requestId).at(-1);
}

export async function importAndFileJournal(gameTab, consoleTab, transferReference, options = {}) {
    check(typeof transferReference === 'string' && transferReference.trim() === transferReference &&
        transferReference.length > 0 && !/[\r\n]/.test(transferReference), 'Supply an exact GM transfer name or ID.');
    check(options.targetId===undefined || typeof options.targetId==='string' && /^[-A-Za-z0-9_]+$/.test(options.targetId), 'Supply an exact explicit target ID.');
    async function command(action) {
        const requestId = randomUUID();
        await gameTab.playwright.getByRole('tab', {name: 'chatTab', exact: true}).click();
        const sender = gameTab.playwright.getByText('(From D35 Journal):', {exact: true});
        const previous = await sender.count();
        const input = gameTab.playwright.getByRole('textbox', {name: 'Text Chat Input', exact: true});
        await input.fill('!d35journal ' + action + ' ' + transferReference + (options.targetId?' --target '+options.targetId:'') + ' --request ' + requestId); await input.press('Enter');
        await sender.nth(previous).waitFor({state: 'visible', timeoutMs: 15000});
        await consoleTab.playwright.locator('#apiconsole .ace_line').filter({hasText: requestId}).last().waitFor({state: 'visible', timeoutMs: 15000});
        const report = await readJournalReport(consoleTab, requestId);
        check(report && report.operation === action && report.transferReference === transferReference &&
            report.kind === 'gm_adventure' && ['pending_filing', 'verified'].includes(report.status),
            report?.message || 'No successful current Journal readback; inspect chat and console.');
        return report;
    }
    // Only a caller-supplied, explicitly approved viewport is used. Never open a
    // browser or infer permission to change its size. Restore it on every exit.
    const resize = options.viewport !== undefined || options.viewportSize !== undefined;
    check(!resize || options.viewport && typeof options.viewport.set === 'function' && typeof options.viewport.reset === 'function' &&
        options.viewportSize && Number.isInteger(options.viewportSize.width) && Number.isInteger(options.viewportSize.height) &&
        options.viewportSize.width >= 400 && options.viewportSize.width <= 4000 && options.viewportSize.height >= 400 && options.viewportSize.height <= 6000,
        'Supply both the supported viewport capability and explicit approved dimensions.');
    try {
        if (resize) await options.viewport.set(options.viewportSize);
        const imported = await command('import');
        check(imported.evidence && Array.isArray(imported.evidence.folderIds), 'Publication pending: supply an approved existing adventure/Part filing plan first.');
        const moved = await filePublishedHandout(gameTab, imported);
        const audited = await command('audit');
        check(audited.status === 'verified' && audited.objectId === imported.objectId &&
            JSON.stringify(audited.evidence.folderIds) === JSON.stringify(imported.evidence.folderIds),
            'Filing audit did not verify the original Handout and exact folder; no automatic retry.');
        return {status: 'verified', handoutId: audited.objectId, filing: moved, audit: audited};
    } finally { if (resize) await options.viewport.reset(); }
}
