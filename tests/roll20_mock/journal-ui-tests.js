'use strict';
const assert=require('assert'),path=require('path');
const {pathToFileURL}=require('url');
const {filingHarness}=require('./image-asset-ui-tests');
function harness(){
    const h=filingHarness();h.state.names[0]='Savage Tide Adventure Path';h.report.kind='gm_adventure';h.report.evidence.contentVerified=true;
    const state={lines:[],commands:[],last:'',stale:false,failImport:false,failAudit:false,missingPlan:false,changedAuditId:false};
    const originalRole=h.tab.playwright.getByRole;
    h.tab.playwright.getByText=()=>({count:async()=>state.commands.length,nth:()=>({waitFor:async()=>{}})});
    h.tab.playwright.getByRole=(role,o)=>role==='textbox'?{fill:async s=>{state.last=s;},press:async()=>{
        const m=/^!d35journal (import|audit) (.+?)(?: --target ([-A-Za-z0-9_]+))? --request ([-a-z0-9]+)$/.exec(state.last);assert.ok(m);state.commands.push(m[1]);(state.targetIds||=[]).push(m[3]||null);
        const r=JSON.parse(JSON.stringify(h.report));r.operation=m[1];r.transferReference=m[2];r.requestId=state.stale?'old-request':m[4];
        r.status=h.state.current.length?'verified':'pending_filing';
        if(state.failImport&&m[1]==='import'||state.failAudit&&m[1]==='audit'){r.status='error';r.message='Actual native refusal';}
        if(state.missingPlan)r.evidence.folderIds=null;
        if(state.changedAuditId&&m[1]==='audit')r.objectId='-DIFFERENT';
        state.lines.push(JSON.stringify('D35_JOURNAL_REPORT '+JSON.stringify(r)));
    }}:originalRole(role,o);
    const consoleTab={playwright:{locator:()=>({allTextContents:async()=>['not JSON',JSON.stringify('Other Mod log'),...state.lines],filter:({hasText})=>({last:()=>({waitFor:async()=>{if(!state.lines.some(l=>l.includes(hasText)))throw Error('No current correlated report');}})})})}};
    return{...h,consoleTab,control:state};
}
async function main(){const api=await import(pathToFileURL(path.resolve(__dirname,'../../tools/journal_ui.mjs')).href);let count=0;
    async function test(name,body){await body(harness());count++;console.log('PASS '+name);}
    await test('one call imports, uses the shared native filing helper and audits the original identity',async h=>{const r=await api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer');assert.strictEqual(r.status,'verified');assert.strictEqual(r.handoutId,'-HANDOUT');assert.deepStrictEqual(h.control.commands,['import','audit']);assert.strictEqual(h.state.drags.length,1);assert.deepStrictEqual(h.state.current,h.state.target);});
    await test('repeat publication preserves already-correct placement without drag',async h=>{h.state.current=[];await api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer');const before=JSON.stringify(h.state.current);await api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer');assert.deepStrictEqual(h.control.commands,['import','audit','import','audit']);assert.strictEqual(h.state.drags.length,1);assert.strictEqual(JSON.stringify(h.state.current),before);});
    await test('current native refusal cannot be replaced by an older successful report',async h=>{h.control.failImport=true;await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer'),/Actual native refusal/);assert.deepStrictEqual(h.control.commands,['import']);});
    await test('missing or stale correlation fails before filing',async h=>{h.control.stale=true;await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer'),/correlated report/);assert.deepStrictEqual(h.control.commands,['import']);});
    await test('no approved folder plan cannot be declared implemented',async h=>{h.control.missingPlan=true;await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer'),/approved existing/);assert.deepStrictEqual(h.control.commands,['import']);});
    await test('failed final audit reports error without retrying import or moving again',async h=>{h.control.failAudit=true;await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer'),/Actual native refusal/);assert.deepStrictEqual(h.control.commands,['import','audit']);});
    await test('changed audit identity can never be reported as completed',async h=>{h.control.changedAuditId=true;await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer'),/original Handout/);});
    await test('command injection and blank transfer names are refused without UI operations',async h=>{for(const ref of ['', 'bad\n!other command',' name '])await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,ref),/exact GM transfer/);assert.strictEqual(h.control.commands.length,0);});
    await test('console reader skips unrelated logs and requires the exact request ID',async h=>{h.control.lines.push(JSON.stringify('D35_JOURNAL_REPORT '+JSON.stringify({requestId:'exact',status:'verified'})));assert.strictEqual((await api.readJournalReport(h.consoleTab,'exact')).status,'verified');assert.strictEqual(await api.readJournalReport(h.consoleTab,'different'),undefined);});
    await test('explicit temporary viewport is restored after successful filing',async h=>{const calls=[];const viewport={set:async size=>calls.push(size),reset:async()=>calls.push('reset')};await api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer',{viewport,viewportSize:{width:1280,height:2400}});assert.deepStrictEqual(calls,[{width:1280,height:2400},'reset']);});
    await test('temporary viewport is restored after a native import refusal',async h=>{h.control.failImport=true;const calls=[];const viewport={set:async()=>calls.push('set'),reset:async()=>calls.push('reset')};await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer',{viewport,viewportSize:{width:1280,height:2400}}),/Actual native refusal/);assert.deepStrictEqual(calls,['set','reset']);});
    await test('incomplete viewport options fail before any game operation',async h=>{await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer',{viewportSize:{width:1280,height:2400}}),/Supply both/);assert.deepStrictEqual(h.control.commands,[]);});
    await test('folder-first target is sent to import and audit without a drag when already placed',async h=>{h.state.current=h.state.target.slice();const r=await api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer',{targetId:'-HANDOUT'});assert.strictEqual(r.status,'verified');assert.strictEqual(r.filing.status,'already_filed');assert.deepStrictEqual(h.control.targetIds,['-HANDOUT','-HANDOUT']);assert.strictEqual(h.state.drags.length,0);});
    await test('unsafe explicit target ID fails before any UI action',async h=>{await assert.rejects(()=>api.importAndFileJournal(h.tab,h.consoleTab,'Journal Transfer',{targetId:'bad --request injected'}),/explicit target ID/);assert.deepStrictEqual(h.control.commands,[]);});
    console.log('Journal UI: '+count+' checks passed.');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
