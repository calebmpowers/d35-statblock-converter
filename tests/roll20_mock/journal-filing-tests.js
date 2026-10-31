'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const {createRoll20Mock}=require('./roll20-sandbox-mock');
const root=path.resolve(__dirname,'../..'),clone=x=>JSON.parse(JSON.stringify(x));
const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/journal-filing.json'),'utf8'));
const journal=fs.readFileSync(path.join(root,'Roll20 Importer/D35_Journal_Importer.js'),'utf8');
const image=fs.readFileSync(path.join(root,'Roll20 Importer/D35_Image_Asset_Publisher.js'),'utf8');
function load(w,images=true){const ctx=Object.assign({console},w.globals());vm.createContext(ctx);vm.runInContext(journal,ctx);if(images)vm.runInContext(image,ctx);w.trigger('ready',{});return ctx;}
function harness(){
    const w=createRoll20Mock();let tree=[{id:'root',n:plan.folder_path[0],i:[{id:'adventure',n:plan.folder_path[1],i:[{id:'part',n:plan.folder_path[2],i:[]}]}]},{id:'stage',n:'Handouts',i:[]}];
    w.Campaign=()=>({get:k=>k==='_journalfolder'?JSON.stringify(tree):'',set:()=>{throw Error('No Mod folder writes');}});
    const ctx=load(w),html='<h3>Exact Heading</h3><p><strong>Creatures:</strong> Exact canonical words.</p>';
    const pkg={schema:'d35-journal/0.1',journal_id:'example.arrival',handout:{name:'EX 1.1 — Arrival',notes:html,source_html:html,navigation_html:'',source_sha256:crypto.createHash('sha256').update(html).digest('hex'),gmnotes:'',inplayerjournals:'',controlledby:''},filing:clone(plan)};
    const input=w.createObj('handout',{name:'Journal Filing Transfer',inplayerjournals:'',controlledby:''});
    function set(p=pkg){input.set('gmnotes',JSON.stringify(p));}set();
    const report=()=>w.state.D35JournalImporter?.lastReport;
    async function send(action='import',reference=input.id,playerid='-MOCKGM'){w.trigger('chat:message',{type:'api',playerid,content:'!d35journal '+action+' '+reference});for(let n=0;n<40;n++){w.flush();await Promise.resolve();}return report();}
    const target=()=>w.getObj('handout',w.state.D35JournalImporter.journals['journal:'+pkg.journal_id].objectId);
    function file(){tree[1].i=[];tree[0].i[0].i[0].i=[target().id];}
    function seedLegacy(stage=false){
        const h=w.createObj('handout',{name:pkg.handout.name,inplayerjournals:'',controlledby:''});h.set('notes',html);h.set('gmnotes','');
        w.state.D35JournalImporter={version:1,journals:{['journal:'+pkg.journal_id]:{objectId:h.id,title:pkg.handout.name,fingerprint:ctx.D35JournalImporter.validate(pkg).fingerprint,status:'verified'}},lastReport:null};
        if(stage){tree[1].i=[h.id];pkg.filing.legacy_source={handout_id:h.id,folder_path:['Handouts'],folder_ids:['stage']};set();}
        return h;
    }
    return{w,ctx,pkg,input,set,send,report,target,file,seedLegacy,tree:()=>tree,setTree:t=>{tree=t;},snapshot:()=>JSON.stringify(w.objects.map(o=>o.toJSON()))};
}
function status(r,s){assert.strictEqual(r.status,s,JSON.stringify(r));}function error(r,re){status(r,'error');if(re)assert.match(r.message,re);}
async function main(){let count=0;async function test(name,body){try{await body(harness());count++;console.log('PASS '+name);}catch(e){e.message=name+': '+e.message;throw e;}}
    await test('new creation stays pending until exact native filing is verified',async h=>{const r=await h.send();status(r,'pending_filing');assert.strictEqual(r.kind,'gm_adventure');assert.strictEqual(r.evidence.contentVerified,true);assert.match(r.message,/PUBLICATION INCOMPLETE/);h.file();const a=await h.send('audit');status(a,'verified');assert.strictEqual(a.objectId,r.objectId);});
    await test('missing plan preserves content import but never claims full implementation',async h=>{delete h.pkg.filing;h.set();status(await h.send(),'pending_filing');assert.strictEqual(h.target()._attrs.notes,h.pkg.handout.notes);assert.strictEqual(h.w.state.D35JournalImporter.journals['journal:example.arrival'].status,'pending_filing');});
    await test('preview with a plan resolves identities but creates and binds nothing',async h=>{const before=h.snapshot();status(await h.send('preview'),'preview');assert.strictEqual(h.snapshot(),before);assert.deepStrictEqual(Object.keys(h.w.state.D35JournalImporter.journals),[]);});
    await test('original content fingerprint is unchanged by filing metadata',async h=>{const before=h.ctx.D35JournalImporter.validate(h.pkg).fingerprint;const p=clone(h.pkg);delete p.filing;assert.strictEqual(h.ctx.D35JournalImporter.validate(p).fingerprint,before);});
    await test('legacy managed root object is recognized without adoption or rewriting',async h=>{const old=h.seedLegacy(),before=h.snapshot();h.w.hooks.beforeSet=()=>{throw Error('No content writes');};status(await h.send(),'pending_filing');assert.strictEqual(h.target().id,old.id);assert.strictEqual(h.snapshot(),before);h.file();status(await h.send('audit'),'verified');assert.strictEqual(h.snapshot(),before);});
    await test('explicit legacy staging approval binds exact current source folder and object',async h=>{const old=h.seedLegacy(true),before=h.snapshot();const r=await h.send();status(r,'pending_filing');assert.deepStrictEqual(Array.from(r.evidence.sourceFolderIds),['stage']);assert.strictEqual(r.objectId,old.id);h.file();status(await h.send('audit'),'verified');assert.strictEqual(h.snapshot(),before);});
    await test('unexpected legacy placement is not guessed from a generic folder name',async h=>{const old=h.seedLegacy();h.tree()[1].i=[old.id];error(await h.send(),/Unexpected manual placement/);});
    await test('wrong explicit legacy Handout ID is rejected',async h=>{h.seedLegacy(true);h.pkg.filing.legacy_source.handout_id='-WRONG';h.set();error(await h.send(),/exact existing managed/);});
    await test('explicit migration never creates a missing destination',async h=>{h.pkg.filing.legacy_source={handout_id:'-OLD',folder_path:[],folder_ids:[]};h.set();const before=h.snapshot();error(await h.send(),/no creation/);assert.strictEqual(h.snapshot(),before);});
    await test('unmanaged existing title cannot be adopted during filing',async h=>{h.w.createObj('handout',{name:h.pkg.handout.name});error(await h.send(),/unmanaged/);});
    await test('missing or ambiguous folders fail preflight without object creation',async h=>{h.setTree([]);const before=h.snapshot();error(await h.send(),/missing or ambiguous/);assert.strictEqual(h.snapshot(),before);});
    await test('duplicate destination folder paths are refused',async h=>{h.tree()[0].i[0].i.push({id:'another',n:plan.folder_path[2],i:[]});error(await h.send('preview'),/ambiguous/);});
    await test('same-name replacement folder fails exact identity check',async h=>{h.tree()[0].i[0].i[0].id='replacement';error(await h.send(),/identity changed/);});
    await test('different destination plan is refused after binding',async h=>{await h.send();h.pkg.filing.authority='Changed approval';h.set();error(await h.send(),/Bound filing plan changed/);});
    await test('bound plan cannot disappear from the package',async h=>{await h.send();delete h.pkg.filing;h.set();error(await h.send(),/Retain the bound/);});
    await test('manual move after successful filing is preserved and refused',async h=>{await h.send();h.file();status(await h.send('audit'),'verified');h.tree()[0].i[0].i[0].i=[];h.tree()[1].i=[h.target().id];const before=h.snapshot();error(await h.send(),/manually moved/);assert.strictEqual(h.snapshot(),before);});
    await test('manual return to root cannot reuse a one-time legacy migration',async h=>{h.seedLegacy(true);await h.send();h.file();await h.send('audit');h.tree()[0].i[0].i[0].i=[];error(await h.send(),/manually moved/);});
    await test('existing correct placement is preserved even if legacy staging folder is later removed',async h=>{h.seedLegacy(true);await h.send();h.file();await h.send('audit');h.tree().splice(1,1);status(await h.send('audit'),'verified');});
    await test('duplicate Journal references are never treated as filed',async h=>{await h.send();h.file();h.tree().push(h.target().id);error(await h.send('audit'),/Duplicate Journal references/);});
    await test('manual source text changes prevent all filing reports',async h=>{h.seedLegacy(true).set('notes','<p>Manual change</p>');error(await h.send(),/Stored source text/);});
    await test('manual permissions and GM annotations are never repaired',async h=>{await h.send();h.target().set('controlledby','all');error(await h.send('audit'),/permission/);h.target().set('controlledby','');h.target().set('gmnotes','Private annotation');error(await h.send('audit'),/GM Notes/);});
    await test('repeat operations preserve ID content navigation and linked pin objects without writes',async h=>{await h.send();h.file();await h.send('audit');const id=h.target().id;const pin=h.w.createObj('pin',{pageid:'-MOCKPAGE',link:id,subLink:'Exact Heading',linkType:'handout',subLinkType:'headerPlayer',visibleTo:'gm'});const before=h.snapshot();h.w.hooks.beforeSet=()=>{throw Error('Unnecessary write');};for(const action of ['import','audit','preview']){const r=await h.send(action);status(r,'verified');assert.strictEqual(r.objectId,id);}assert.strictEqual(h.snapshot(),before);assert.strictEqual(pin.get('link'),id);});
    await test('restart preserves bound folder identity and duplicate-safe behavior',async h=>{await h.send();h.file();await h.send('audit');const id=h.target().id;Object.keys(h.w.handlers).forEach(k=>{h.w.handlers[k]=[];});load(h.w);status(await h.send('audit'),'verified');assert.strictEqual(h.target().id,id);});
    await test('audit cannot create a runtime entry',async h=>{const before=h.snapshot();error(await h.send('audit'),/audit never creates/);assert.strictEqual(h.snapshot(),before);});
    await test('filing dependency error is clear and leaves all existing work intact',async h=>{Object.keys(h.w.handlers).forEach(k=>{h.w.handlers[k]=[];});load(h.w,false);const before=h.snapshot();error(await h.send(),/Image Asset Publisher/);assert.strictEqual(h.snapshot(),before);});
    await test('Player Handouts and existing adventure folders cannot be migration sources',async h=>{for(const name of ['Savage Tide Player Handouts','Savage Tide Adventure Path']){h.pkg.filing.legacy_source={handout_id:'-OLD',folder_path:[name],folder_ids:['old']};h.set();error(await h.send(),/cannot reorganize/);}});
    await test('GM workflow cannot target Player Handouts',async h=>{h.pkg.filing.folder_path[0]='Savage Tide Player Handouts';h.set();error(await h.send(),/GM adventure root/);});
    await test('caller request nonce identifies the actual command response',async h=>{const r=await h.send('import',h.input.id+' --request request-123');status(r,'pending_filing');assert.strictEqual(r.requestId,'request-123');assert.strictEqual(r.transferReference,h.input.id);assert.strictEqual(r.operation,'import');});
    await test('non-GM cannot import, audit or obtain filing metadata',async h=>{const before=h.snapshot();for(const action of ['preview','import','audit'])await h.send(action,h.input.id,'-PLAYER');assert.strictEqual(h.snapshot(),before);assert.strictEqual(h.report(),undefined);});
    console.log('Journal filing: '+count+' checks passed.');
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={harness,load};
