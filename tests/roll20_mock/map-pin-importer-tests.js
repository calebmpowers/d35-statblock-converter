'use strict';
const assert=require('assert'), fs=require('fs'), path=require('path'), vm=require('vm');
const {createRoll20Mock}=require('./roll20-sandbox-mock');
const {nativeFlavorText}=require('./pin-native-model');
const journalFile=path.resolve(__dirname,'../../Roll20 Importer/D35_Journal_Importer.js');
const pinFile=path.resolve(__dirname,'../../Roll20 Importer/D35_Map_Pin_Importer.js');
const journalSource=fs.readFileSync(journalFile,'utf8'), pinSource=fs.readFileSync(pinFile,'utf8');
const clone=v=>JSON.parse(JSON.stringify(v));
const visibility=['visibleTo','tooltipVisibleTo','tooltipTitleVisibleTo','nameplateVisibleTo','imageVisibleTo','notesVisibleTo','gmNotesVisibleTo'];
const syntheticFixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/map-pin-native-extraction.json'),'utf8'));
const syntheticHtml=syntheticFixture.source_html;

function load(w,withJournal=true) {
    const ctx=Object.assign({console},w.globals());vm.createContext(ctx);
    if(withJournal) vm.runInContext(journalSource,ctx,{filename:journalFile});
    vm.runInContext(pinSource,ctx,{filename:pinFile});w.trigger('ready',{});return ctx;
}
function harness() {
    const w=createRoll20Mock({strictPins:true}),ctx=load(w);
    const input=w.createObj('handout',{name:'D35 Pin Transfer',inplayerjournals:'',controlledby:''});
    const target=w.createObj('handout',{name:'EX 1.1 — Arrival',inplayerjournals:'',controlledby:''});target.set('notes',syntheticHtml);target.set('gmnotes','');
    function plan(quote=true) {
        const properties={link:target.id,linkType:'handout',subLink:'Arrival',subLinkType:'headerPlayer',autoNotesType:'blockquote',notes:'',gmNotes:'',notesDesynced:false,gmNotesDesynced:false,imageDesynced:false};
        visibility.forEach(k=>properties[k]='');
        return {schema:'d35-map-pin/0.1',pin_id:'example.arrival',page:{id:'-MOCKPAGE',name:'Mock tabletop'},x:140,y:210,title:'Arrival',plan:{status:'resolved',intent:{handout_title:target.get('name'),heading:'Arrival',source_field:'notes',read_aloud_block_id:quote?'quote':null,native_flavor_text:true,gm_only:true},properties}};
    }
    function set(p) {input.set('gmnotes',typeof p==='string'?p:JSON.stringify(p));}
    function trigger(action='import',ref=input.id,playerid='-MOCKGM') {w.trigger('chat:message',{type:'api',playerid,content:'!d35pin '+action+' '+ref});}
    async function drain() {for(let i=0;i<30;i++){w.flush();await Promise.resolve();}}
    async function send(action='import',ref=input.id,playerid='-MOCKGM'){trigger(action,ref,playerid);await drain();return report();}
    function report(){return w.state.D35MapPinImporter&&w.state.D35MapPinImporter.lastReport;}
    const pins=()=>w.findObjs({_type:'pin'});
    set(plan());return {w,ctx,input,target,plan,set,send,trigger,drain,report,pins};
}
function verified(r){assert.strictEqual(r.status,'verified',JSON.stringify(r));}
function error(r,re){assert.strictEqual(r.status,'error',JSON.stringify(r));if(re)assert.match(r.message,re);}
const snapshot=w=>JSON.stringify(w.objects.map(o=>o.toJSON()));

async function main(){
    let count=0;
    async function test(name,body){try{await body(harness());count++;console.log('PASS '+name);}catch(e){e.message=name+': '+e.message;throw e;}}
    await test('preview reads destinations but creates no objects or identity records',async h=>{
        const before=snapshot(h.w);assert.strictEqual((await h.send('preview')).status,'preview');assert.strictEqual(snapshot(h.w),before);assert.deepStrictEqual(Object.keys(h.w.state.D35MapPinImporter.pins),[]);
    });
    await test('import creates native heading pin with exact page coordinates and hidden visibility',async h=>{
        const r=await h.send();verified(r);const pin=h.w.getObj('pin',r.pinId);
        assert.strictEqual(pin.get('_pageid'),'-MOCKPAGE');assert.strictEqual(pin.get('x'),140);assert.strictEqual(pin.get('y'),210);
        assert.strictEqual(pin.get('link'),h.target.id);assert.strictEqual(pin.get('subLink'),'Arrival');assert.strictEqual(pin.get('linkType'),'handout');assert.strictEqual(pin.get('subLinkType'),'headerPlayer');assert.strictEqual(pin.get('autoNotesType'),'blockquote');
        visibility.forEach(k=>assert.strictEqual(pin.get(k),''));assert.strictEqual(pin.get('notes'),'');assert.strictEqual(pin.get('gmNotes'),'');assert.strictEqual(pin.get('notesDesynced'),false);
    });
    await test('repeat import preview and audit preserve ID and never write an existing pin',async h=>{
        const first=await h.send();verified(first);const before=snapshot(h.w);h.w.hooks.beforeSet=()=>{throw Error('No writes');};
        for(const command of ['import','preview','audit']){const r=await h.send(command);verified(r);assert.strictEqual(r.pinId,first.pinId);assert.strictEqual(r.action,'preserve');}
        assert.strictEqual(snapshot(h.w),before);assert.strictEqual(h.pins().length,1);
    });
    await test('persistent identity survives sandbox restart',async h=>{
        const first=await h.send();verified(first);h.w.handlers.ready=[];h.w.handlers['chat:message']=[];load(h.w);
        const r=await h.send('audit');verified(r);assert.strictEqual(r.pinId,first.pinId);assert.strictEqual(h.pins().length,1);
    });
    await test('audit of missing managed identity never creates a pin',async h=>{error(await h.send('audit'),/No managed pin/);assert.strictEqual(h.pins().length,0);});
    await test('player and API messages are ignored without reports',async h=>{
        const before=snapshot(h.w);await h.send('import',h.input.id,'-PLAYER');await h.send('import',h.input.id,'API');assert.strictEqual(snapshot(h.w),before);assert.strictEqual(h.report(),undefined);assert.strictEqual(h.w.chat.length,0);
    });
    await test('existing Journal HTML verifier is required; no second importer is installed',async h=>{
        h.w.handlers.ready=[];h.w.handlers['chat:message']=[];load(h.w,false);error(await h.send(),/Journal Handout Importer/);assert.strictEqual(h.pins().length,0);
    });
    await test('transfer exact name works and ambiguous names require an ID',async h=>{
        assert.strictEqual((await h.send('preview','D35 Pin Transfer')).status,'preview');h.w.createObj('handout',{name:'D35 Pin Transfer'});error(await h.send('preview','D35 Pin Transfer'),/ambiguous/);verified(await h.send());
    });
    await test('shared transfer or player-edited target is rejected without changing permissions',async h=>{
        for(const obj of [h.input,h.target])for(const k of ['inplayerjournals','controlledby']){obj.set(k,'all');const before=snapshot(h.w);error(await h.send(),/GM-only/);assert.strictEqual(snapshot(h.w),before);obj.set(k,'');}
        assert.strictEqual(h.pins().length,0);
    });
    await test('unresolved page and incorrect page name fail before creation',async h=>{
        for(const change of [{id:'-missing',name:'Mock tabletop'},{id:'-MOCKPAGE',name:'Wrong'}]){const p=h.plan();p.page=change;h.set(p);error(await h.send(),/Page/);}assert.strictEqual(h.pins().length,0);
    });
    await test('duplicate page names are ambiguous even with an explicit ID',async h=>{
        h.w.createObj('page',{name:'Mock tabletop'});error(await h.send(),/Page name is ambiguous/);assert.strictEqual(h.pins().length,0);
    });
    await test('missing or mismatched Handout ID and ambiguous titles fail',async h=>{
        let p=h.plan();p.plan.properties.link='-missing';h.set(p);error(await h.send(),/Handout ID/);
        p=h.plan();p.plan.intent.handout_title='Wrong';h.set(p);error(await h.send(),/Handout ID/);
        h.set(h.plan());h.w.createObj('handout',{name:h.target.get('name')});error(await h.send(),/ambiguous/);assert.strictEqual(h.pins().length,0);
    });
    await test('missing duplicated or GM-Notes-only headings fail',async h=>{
        for(const html of ['<h3>Wrong</h3><p>Source.</p>',syntheticHtml+'<h3>Arrival</h3>','<p>No heading here.</p>']){h.target.set('notes',html);h.target.set('gmnotes',syntheticHtml);error(await h.send(),/Heading/);}assert.strictEqual(h.pins().length,0);
    });
    await test('unspecified invalid or nonnumeric coordinates and unsafe schema fail',async h=>{
        for(const key of ['x','y'])for(const value of [undefined,null,'140',-1,Infinity,NaN]){const p=h.plan();p[key]=value;h.set(p);error(await h.send());}
        const p=h.plan();p.schema='other';h.set(p);error(await h.send(),/schema/);assert.strictEqual(h.pins().length,0);
    });
    await test('zero coordinates are explicit valid coordinates',async h=>{const p=h.plan();p.x=0;p.y=0;h.set(p);verified(await h.send());assert.strictEqual(h.pins()[0].get('x'),0);});
    await test('all unsafe visibility settings are rejected; no reveal action exists',async h=>{
        for(const key of visibility){const p=h.plan();p.plan.properties[key]='all';h.set(p);error(await h.send(),/Unsafe visibility/);}assert.strictEqual(h.pins().length,0);
    });
    await test('custom tooltip summaries desync and wrong heading field are rejected',async h=>{
        for(const [key,value] of [['notes','Invented summary'],['gmNotes','Custom GM text'],['notesDesynced',true],['imageDesynced',true],['subLinkType','headerGM'],['subLink','Wrong'],['autoNotesType','']]){const p=h.plan();p.plan.properties[key]=value;h.set(p);error(await h.send());}assert.strictEqual(h.pins().length,0);
    });
    await test('unresolved planner output and changed source-field intent are rejected',async h=>{
        let p=h.plan();p.plan.status='needs_handout_id';h.set(p);error(await h.send(),/Resolve/);
        p=h.plan();p.plan.intent.source_field='gmnotes';h.set(p);error(await h.send(),/Description/);assert.strictEqual(h.pins().length,0);
    });
    await test('synthetic quote fixture uses native extraction with no copied or invented notes',async h=>{
        const r=await h.send();verified(r);const pin=h.pins()[0];assert.strictEqual(nativeFlavorText(h.w,h.ctx.D35JournalImporter,pin),syntheticFixture.expected_native_flavor);assert.strictEqual(pin.get('notes'),'');assert.strictEqual(pin.get('gmNotes'),'');
    });
    await test('native model uses the first applicable blockquote only',async h=>{
        h.target.set('notes',syntheticHtml.replace('<p><strong>Creatures:', '<blockquote><p>Later passage.</p></blockquote><p><strong>Creatures:'));
        verified(await h.send());assert.strictEqual(nativeFlavorText(h.w,h.ctx.D35JournalImporter,h.pins()[0]),syntheticFixture.expected_native_flavor);
    });
    await test('no quote gives empty native flavor without borrowing from the next heading',async h=>{
        h.target.set('notes','<h3>Arrival</h3><p>GM description only.</p><h3>Next</h3><blockquote><p>Other section.</p></blockquote>');h.set(h.plan(false));const r=await h.send();verified(r);assert.strictEqual(r.hasReadAloud,false);assert.strictEqual(nativeFlavorText(h.w,h.ctx.D35JournalImporter,h.pins()[0]),'');assert.strictEqual(h.pins()[0].get('notes'),'');
    });
    await test('mismatched source quote presence fails closed',async h=>{
        h.set(h.plan(false));error(await h.send(),/read-aloud presence/);assert.strictEqual(h.pins().length,0);
    });
    await test('unmanaged pin at planned position is preserved and never adopted',async h=>{
        h.w.createObj('pin',{pageid:'-MOCKPAGE',x:140,y:210,title:'Manual pin'});const before=snapshot(h.w);error(await h.send(),/unmanaged/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('two existing pins at planned position are preserved',async h=>{
        h.w.createObj('pin',{pageid:'-MOCKPAGE',x:140,y:210});h.w.createObj('pin',{pageid:'-MOCKPAGE',x:140,y:210});const before=snapshot(h.w);error(await h.send());assert.strictEqual(snapshot(h.w),before);
    });
    await test('changed plan under same stable identity refuses overwrite',async h=>{
        verified(await h.send());const p=h.plan();p.x=280;h.set(p);const before=snapshot(h.w);error(await h.send(),/different plan/);assert.strictEqual(snapshot(h.w),before);assert.strictEqual(h.pins().length,1);
    });
    await test('second stable key cannot duplicate the same placement',async h=>{
        verified(await h.send());const p=h.plan();p.pin_id='other.identity';h.set(p);error(await h.send(),/unmanaged|reserves/);assert.strictEqual(h.pins().length,1);
    });
    await test('manual moves are preserved and audited as conflicts',async h=>{
        const first=await h.send();h.w.getObj('pin',first.pinId).set('x',999);const before=snapshot(h.w);error(await h.send('audit'),/moved/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('manual title visibility notes and appearance changes are not overwritten',async h=>{
        for(const [key,value] of [['title','Manual title'],['visibleTo','all'],['notes','Manual notes'],['bgColor','#123456'],['scale',2]]){
            const x=harness();const first=await x.send();x.w.getObj('pin',first.pinId).set(key,value);const before=snapshot(x.w);error(await x.send('audit'));error(await x.send());assert.strictEqual(snapshot(x.w),before);
        }
    });
    await test('missing registered pin is never recreated',async h=>{const first=await h.send();h.w.getObj('pin',first.pinId).remove();error(await h.send(),/missing/);assert.strictEqual(h.pins().length,0);});
    await test('state loss does not adopt or duplicate an existing pin',async h=>{verified(await h.send());delete h.w.state.D35MapPinImporter;error(await h.send(),/unmanaged/);assert.strictEqual(h.pins().length,1);});
    await test('manual Handout source changes invalidate audit without changing any object',async h=>{
        verified(await h.send());h.target.set('notes',syntheticHtml.replace('GM detail.','Changed GM detail.'));const before=snapshot(h.w);error(await h.send('audit'),/Handout content changed/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('source Handout is rechecked after asynchronous reading',async h=>{
        const get=h.target.get.bind(h.target);h.target.get=(k,cb)=>k==='notes'?get(k,v=>{h.target.set('controlledby','all');cb(v);}):get(k,cb);error(await h.send(),/GM-only/);assert.strictEqual(h.pins().length,0);
    });
    await test('post-create wrong native property fails and reserves the same ID',async h=>{
        h.w.hooks.afterCreate=o=>{if(o.get('_type')==='pin')o._attrs.subLink='Wrong';};const r=await h.send();error(r,/property differs/);assert.ok(r.pinId);error(await h.send());assert.strictEqual(h.pins().length,1);assert.strictEqual(h.pins()[0].id,r.pinId);
    });
    await test('post-create read timeout reserves identity and retry verifies without writes',async h=>{
        h.w.hooks.afterCreate=o=>{if(o.get('_type')==='pin')h.w.suspendBlobs=true;};const r=await h.send();error(r,/Timed out/);assert.ok(r.pinId);h.w.suspendBlobs=false;h.w.hooks.beforeSet=()=>{throw Error('No writes');};verified(await h.send());assert.strictEqual(h.pins().length,1);
    });
    await test('concurrent commands create at most one pin',async h=>{h.trigger();h.trigger();await h.drain();verified(h.report());assert.strictEqual(h.pins().length,1);assert.ok(h.w.chat.some(c=>/in progress/.test(c.message)));});
    await test('transfer timeout releases lock and late callbacks cannot create a pin',async h=>{
        const get=h.input.get.bind(h.input);let late;h.input.get=(k,cb)=>k==='gmnotes'?(late=cb):get(k,cb);error(await h.send(),/Timed out/);late(JSON.stringify(h.plan()));await h.drain();assert.strictEqual(h.pins().length,0);h.input.get=get;verified(await h.send());
    });
    await test('schema unknown fields and malformed JSON fail without mutation',async h=>{for(const p of ['{bad',Object.assign(h.plan(),{description:'No custom prose'})]){h.set(p);error(await h.send());}assert.strictEqual(h.pins().length,0);});
    await test('rich-editor wrappers entities URI encoding and NBSP indentation preserve the plan',async h=>{
        const p=h.plan(),raw=JSON.stringify(p,null,2),escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        h.set('<pre>'+escape(raw).replace(/\n  /g,'\n&nbsp; ')+'</pre>');verified(await h.send());h.set(encodeURIComponent(JSON.stringify(p)));verified(await h.send('audit'));
    });
    await test('JSON object key order does not change stable plan identity',async h=>{verified(await h.send());const p=h.plan();h.set(Object.fromEntries(Object.entries(p).reverse()));verified(await h.send('audit'));});
    await test('unrelated pins Characters tokens and Handouts remain unchanged',async h=>{
        const keep=[h.w.createObj('pin',{pageid:'-MOCKPAGE',x:700,y:700}),h.w.createObj('character',{name:'Keep'}),h.w.createObj('graphic',{pageid:'-MOCKPAGE'}),h.target];const before=JSON.stringify(keep.map(o=>o.toJSON()));verified(await h.send());assert.strictEqual(JSON.stringify(keep.map(o=>o.toJSON())),before);
    });
    await test('strict mock rejects read-only pin creation and parent reassignment',async h=>{
        assert.throws(()=>h.w.createObj('pin',{_pageid:'-MOCKPAGE'}),/Read-only/);assert.throws(()=>h.w.createObj('pin',{}),/pageid/);const p=h.w.createObj('pin',{pageid:'-MOCKPAGE',x:0,y:0});assert.throws(()=>p.set('_pageid','other'),/read-only/);
    });
    await test('unsupported state is preserved and reports a GM-only error',async h=>{h.w.state.D35MapPinImporter={version:999,precious:'keep'};const before=JSON.stringify(h.w.state);await h.send();assert.strictEqual(JSON.stringify(h.w.state),before);assert.match(h.w.chat.at(-1).message,/Unsupported pin state/);});
    const arg=process.argv.indexOf('--handout-json'),plannerArg=process.argv.indexOf('--planner');
    if(arg!==-1&&plannerArg!==-1)await test('canonical Wrecked Wyvern consumes existing planner output with no invented flavor',async h=>{
        const handout=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8')),entry=JSON.parse(fs.readFileSync(process.argv[plannerArg+1],'utf8'))[0];
        h.target.set('name',handout.name);h.target.set('notes',handout.notes);
        const p=h.plan(false);p.title='The Wrecked Wyvern';p.pin_id='savage-tide.tod.6.1.wrecked-wyvern.test';p.plan=clone(entry);p.plan.status='resolved';p.plan.properties.link=h.target.id;
        h.set(p);const first=await h.send();verified(first);assert.strictEqual(h.pins()[0].get('subLink'),'The Wrecked Wyvern (EL 10)');assert.strictEqual(first.hasReadAloud,false);assert.strictEqual(nativeFlavorText(h.w,h.ctx.D35JournalImporter,h.pins()[0]),'');verified(await h.send('audit'));assert.strictEqual(h.pins().length,1);
    });
    const preparedArg=process.argv.indexOf('--prepared-package');
    if(preparedArg!==-1)await test('exact prepared package resolves seeded native identities and survives restart without writes',async h=>{
        assert.notStrictEqual(arg,-1,'Supply --handout-json for the prepared package destination');
        const p=JSON.parse(fs.readFileSync(process.argv[preparedArg+1],'utf8'));
        const handout=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8'));
        // Seed fixture identities only. No platform objects or exported package are changed.
        const page=h.w.getObj('page','-MOCKPAGE');page.id=p.page.id;page._attrs._id=p.page.id;page._attrs.id=p.page.id;page.set('name',p.page.name);
        h.target.id=p.plan.properties.link;h.target._attrs._id=h.target.id;h.target._attrs.id=h.target.id;
        h.target.set('name',handout.name);h.target.set('notes',handout.notes);h.set(p);
        const before=snapshot(h.w),targetBefore=JSON.stringify(h.target.toJSON());
        h.w.hooks.beforeSet=()=>{throw new Error('Unexpected object write after fixture setup');};
        assert.strictEqual((await h.send('preview')).status,'preview');assert.strictEqual(snapshot(h.w),before);
        const first=await h.send();verified(first);assert.strictEqual(first.hasReadAloud,false);assert.strictEqual(h.pins()[0].get('_pageid'),p.page.id);
        assert.strictEqual(h.pins()[0].get('link'),p.plan.properties.link);visibility.forEach(k=>assert.strictEqual(h.pins()[0].get(k),''));
        for(const action of ['import','audit']){const r=await h.send(action);verified(r);assert.strictEqual(r.pinId,first.pinId);}
        h.w.handlers.ready=[];h.w.handlers['chat:message']=[];load(h.w);
        for(const action of ['audit','import']){const r=await h.send(action);verified(r);assert.strictEqual(r.pinId,first.pinId);}
        assert.strictEqual(h.pins().length,1);assert.strictEqual(JSON.stringify(h.target.toJSON()),targetBefore);
        assert.strictEqual(nativeFlavorText(h.w,h.ctx.D35JournalImporter,h.pins()[0]),'');
    });
    console.log(JSON.stringify({status:'pass',tests:count,canonicalAcceptance:arg!==-1&&plannerArg!==-1,liveExtraction:'not verified; explicit mock oracle only'}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
