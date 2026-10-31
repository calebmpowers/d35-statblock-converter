'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');
const directory=path.resolve(root,'../03-Import-Staging/Reports/image-asset-ui-tests-'+crypto.randomUUID());
fs.mkdirSync(directory,{recursive:true}); // Retained test artifacts; no deletion of workspace material.
const imagePath=path.join(directory,'approved-test.png'),packagePath=path.join(directory,'package.json');
fs.writeFileSync(imagePath,Buffer.from('synthetic upload bytes for orchestration tests'));
const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/image-asset.json'),'utf8'));
pkg.source.sha256=crypto.createHash('sha256').update(fs.readFileSync(imagePath)).digest('hex');pkg.image.display_url=null;
fs.writeFileSync(packagePath,JSON.stringify(pkg));
const clone=v=>JSON.parse(JSON.stringify(v));
function uploadHarness(){
    const state={body:['',''],uploaded:false,private:true,fullURL:'https://files.d20.io/images/901/approvedHash/max.png',previewURL:'https://files.d20.io/images/901/approvedHash/med.png',events:[],mode:'editor'};
    const body=n=>({innerText:async()=>state.body[n],fill:async s=>{state.body[n]=s;state.events.push('fill-'+n);},press:async k=>state.events.push(k),locator:()=>({count:async()=>0})});
    const editor={count:async()=>1,locator:s=>{
        if(s.startsWith('select.'))return{evaluateAll:async()=>[{kind:'inplayerjournals',selected:state.private?[]:['all']},{kind:'controlledby',selected:[]}]};
        if(s==='input.name')return{fill:async s=>{state.title=s;}};
        if(s==='.note-editable')return{count:async()=>2,nth:body};
        if(s==='.avatar img')return{waitFor:async()=>assert.ok(state.uploaded),getAttribute:async()=>state.previewURL};
        if(s==='.note-editable img,.avatar img')return{count:async()=>state.uploaded?1:0};
        throw Error('Unexpected editor selector '+s);
    },getByRole:(role,o)=>({click:async()=>{state.events.push(o.name);if(o.name==='Save Changes'||o.name==='Cancel')state.mode='viewer';if(o.name==='Choose a file...')assert.ok(state.events.includes('filechooser'));}})};
    const viewer={count:async()=>1,locator:s=>{assert.strictEqual(s,'a.lightly[href]');return{count:async()=>1,getAttribute:async()=>state.fullURL,locator:()=>({getAttribute:async()=>state.previewURL})};},
        getByRole:(role,o)=>({click:async()=>{assert.strictEqual(o.name,'Edit');state.mode='editor';state.events.push('Edit');}})};
    const tab={playwright:{getByRole:(role,o)=>{assert.strictEqual(role,'dialog');return typeof o.name==='string'&&o.name.startsWith('Edit ')?editor:viewer;},
        waitForEvent:async e=>{
            state.events.push(e);
            return {setFiles:async p=>{assert.strictEqual(p,imagePath);state.uploaded=true;state.events.push('setFiles');}};
        }}};
    return{tab,state,args:{dialogName:'Edit Mysterious Note',transferTitle:'D35 Image Transfer',packagePath,imagePath}};
}
function filingHarness(){
    const state={current:[],target:['r','a','v'],names:pkg.folder_path,expanded:true,drags:[],screenshots:0,visible:true,failedDrag:false,dialogs:0};
    const report={status:'pending_filing',objectId:'-HANDOUT',evidence:{handoutId:'-HANDOUT',folderIds:state.target,folderPath:state.names}};
    const ancestry=ids=>({ids,names:ids.length?state.names:[]});
    const box=top=>({left:100,top,width:200,height:40,viewportWidth:1280,viewportHeight:720});
    const item={count:async()=>1,evaluate:async fn=>fn.name==='rect'?box(state.visible?500:900):ancestry(state.current)};
    const destination={count:async()=>1,evaluate:async()=>ancestry(state.target),locator:()=>({evaluate:async()=>box(200)})};
    const panel={locator:s=>{
        if(s.startsWith('li[data-itemid'))return item;
        if(s==='li.dd-folder')return{evaluateAll:async()=>['r','existing']};
        if(s.includes('button[data-action'))return{isVisible:async()=>s.includes('existing')&&s.includes('expand')&&!state.expanded,
            click:async()=>{state.expanded=s.includes('expand');}};
        return destination;
    }};
    const tab={playwright:{getByRole:(role)=>{
        if(role==='dialog')return{filter:()=>({count:async()=>state.dialogs})};
        if(role==='tab')return{click:async()=>{}};
        if(role==='tabpanel')return panel;
        throw Error('Unexpected role '+role);
    }},getScreenshot:async()=>{state.screenshots++;},drag:async(a,b)=>{assert.ok(state.screenshots);state.drags.push([a,b]);if(!state.failedDrag)state.current=state.target.slice();}};
    return{tab,state,report};
}
async function main(){const api=await import(pathToFileURL(path.join(root,'tools/image_asset_ui.mjs')).href);let count=0;
    async function test(name,body){await body();count++;console.log('PASS '+name);}
    await test('native upload checks approved file hash and captures actual full-size viewer link',async()=>{const h=uploadHarness(),r=await api.prepareImageTransfer(h.tab,h.args);assert.strictEqual(r.status,'registered');assert.strictEqual(r.runtimePackage.image.display_url,h.state.fullURL);assert.strictEqual(h.state.events.filter(e=>e==='setFiles').length,1);assert.strictEqual(h.state.events.filter(e=>e==='Save Changes').length,2);assert.strictEqual(JSON.parse(h.state.body[1]).source.sha256,pkg.source.sha256);assert.deepStrictEqual(h.state.body[0],'');});
    await test('changed local bytes fail before any browser action',async()=>{const h=uploadHarness();const other=path.join(directory,'bad.json'),p=clone(pkg);p.source.sha256='b'.repeat(64);fs.writeFileSync(other,JSON.stringify(p));await assert.rejects(()=>api.prepareImageTransfer(h.tab,{...h.args,packagePath:other}),/SHA-256/);assert.strictEqual(h.state.events.length,0);});
    await test('player-accessible transfer is never edited or uploaded',async()=>{const h=uploadHarness();h.state.private=false;await assert.rejects(()=>api.prepareImageTransfer(h.tab,h.args),/GM-only/);assert.strictEqual(h.state.events.length,0);});
    await test('existing transfer content or upload is preserved',async()=>{for(const field of ['notes','image']){const h=uploadHarness();if(field==='notes')h.state.body[1]='Manual notes';else h.state.uploaded=true;await assert.rejects(()=>api.prepareImageTransfer(h.tab,h.args),/already contains/);assert.strictEqual(h.state.events.length,0);}});
    await test('registration repeats without upload or Notes writes',async()=>{const h=uploadHarness();h.state.body[1]=JSON.stringify({...pkg,image:{display_url:h.state.fullURL}});const r=await api.registerImageTransfer(h.tab,h.args);assert.strictEqual(r.status,'already_registered');assert.strictEqual(r.objectWrites,0);assert.deepStrictEqual(h.state.events,['Edit','Cancel']);});
    await test('registration rejects unrelated viewer image identity',async()=>{const h=uploadHarness();h.state.fullURL=h.state.fullURL.replace('/901/','/902/');await assert.rejects(()=>api.registerImageTransfer(h.tab,h.args),/differs/);assert.strictEqual(h.state.events.length,0);});
    await test('registration refuses a thumbnail or external full-size link',async()=>{for(const url of ['https://example.com/full.png','https://files.d20.io/images/901/approvedHash/med.png']){const h=uploadHarness();h.state.fullURL=url;await assert.rejects(()=>api.registerImageTransfer(h.tab,h.args));assert.strictEqual(h.state.events.length,0);}});
    await test('manually edited package is not replaced during image registration',async()=>{const h=uploadHarness();h.state.body[1]=JSON.stringify({...pkg,title:'Manual title'});await assert.rejects(()=>api.registerImageTransfer(h.tab,h.args),/Existing content preserved/);assert.ok(!h.state.events.includes('fill-1'));});
    await test('rich-editor padding is normalized without altering meaningful title whitespace',async()=>{const h=uploadHarness();h.state.body[1]=JSON.stringify(pkg,null,2).replace(/\n  /g,'\n\u00a0\u00a0');const r=await api.registerImageTransfer(h.tab,h.args);assert.strictEqual(r.status,'registered');assert.strictEqual(r.runtimePackage.title,pkg.title);});
    await test('native filing uses exact IDs and verifies destination after one drag',async()=>{const h=filingHarness();const r=await api.filePublishedHandout(h.tab,h.report);assert.strictEqual(r.status,'filed');assert.deepStrictEqual(h.state.drags,[[[190,520],[190,220]]]);assert.ok(h.state.expanded,'Unrelated folder UI restored');});
    await test('already filed object is left unchanged',async()=>{const h=filingHarness();h.state.current=h.state.target.slice();const r=await api.filePublishedHandout(h.tab,h.report);assert.strictEqual(r.status,'already_filed');assert.strictEqual(h.state.drags.length,0);});
    await test('manual move or completed root object is never automatically reorganized',async()=>{for(const prior of ['manual','verified']){const h=filingHarness();if(prior==='manual')h.state.current=['manual'];else h.report.status='verified';await assert.rejects(()=>api.filePublishedHandout(h.tab,h.report),/manual filing/);assert.strictEqual(h.state.drags.length,0);}});
    await test('unsafe selector identities and missing importer evidence fail before UI actions',async()=>{const h=filingHarness();h.report.evidence.folderIds[2]='"] unsafe';await assert.rejects(()=>api.filePublishedHandout(h.tab,h.report),/identities/);await assert.rejects(()=>api.filePublishedHandout(h.tab,{}),/actual importer/);assert.strictEqual(h.state.drags.length,0);});
    await test('offscreen drag endpoints are reported without guessing or moving',async()=>{const h=filingHarness();h.state.visible=false;await assert.rejects(()=>api.filePublishedHandout(h.tab,h.report),/viewport/);assert.strictEqual(h.state.drags.length,0);assert.ok(h.state.expanded);});
    await test('failed native filing is not blindly retried and UI expansion is restored',async()=>{const h=filingHarness();h.state.failedDrag=true;await assert.rejects(()=>api.filePublishedHandout(h.tab,h.report),/No automatic retry/);assert.strictEqual(h.state.drags.length,1);assert.ok(h.state.expanded);});
    await test('open dialogs prevent dragging through an overlay',async()=>{const h=filingHarness();h.state.dialogs=1;await assert.rejects(()=>api.filePublishedHandout(h.tab,h.report),/Close Handout dialogs/);assert.strictEqual(h.state.drags.length,0);});
    console.log('Image Asset UI: '+count+' checks passed.');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
