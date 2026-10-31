'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const {createRoll20Mock}=require('./roll20-sandbox-mock');
const root=path.resolve(__dirname,'../..'),clone=v=>JSON.parse(JSON.stringify(v));
const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/map-page-setup.json'),'utf8'));
const journal=fs.readFileSync(path.join(root,'Roll20 Importer/D35_Journal_Importer.js'),'utf8');
const source=fs.readFileSync(path.join(root,'Roll20 Importer/D35_Map_Page_Setup.js'),'utf8');
const snapshot=w=>JSON.stringify(w.objects.map(o=>o.toJSON()));
function load(w,withJournal=true){const ctx=Object.assign({console},w.globals());vm.createContext(ctx);if(withJournal)vm.runInContext(journal,ctx);vm.runInContext(source,ctx);w.trigger('ready',{});return ctx;}
function harness(){
    const w=createRoll20Mock({strictPins:true});let overrides=false,ribbon='-MOCKPAGE';w.Campaign=()=>({get:k=>k==='playerpageid'?ribbon:k==='playerspecificpages'?overrides:''});
    const ctx=load(w),page=w.createObj('page',{name:'Exact Existing Page',width:25,height:25,scale_number:5,scale_units:'ft',grid_type:'square',snapping_increment:1,showgrid:true,grid_offset_x:0,grid_offset_y:0,gridcolor:'#c0c0c0',grid_opacity:0.5,diagonaltype:'foure',gridlabels:false,background_color:'#ffffff',dynamic_lighting_enabled:false});
    const image=w.createObj('graphic',{pageid:page.id,imgsrc:'https://files.d20.io/images/9001/approvedMapHash/original.jpg?1',width:70,height:70,left:35,top:35,rotation:0,fliph:false,flipv:false,layer:'gmlayer',name:'Approved source name',represents:'',controlledby:'',isdrawing:false,showname:false,showplayers_name:false,show_tooltip:false,tooltip:'',bar1_value:'',bar2_value:'',bar3_value:'',bar1_link:'',bar2_link:'',bar3_link:''});
    const transfer=w.createObj('handout',{name:'D35 Map Page Transfer',inplayerjournals:'',controlledby:''});
    const pkg={schema:'d35-map-page/0.1',setup_id:'example.map',...clone(spec),target:{id:null,name:page.get('name')},image:{mode:'configure',graphic_id:null}};
    function set(p=pkg){transfer.set('gmnotes',typeof p==='string'?p:JSON.stringify(p));}
    function trigger(action='import',ref=transfer.id,selected=[],playerid='-MOCKGM'){w.trigger('chat:message',{type:'api',playerid,content:'!d35map '+action+' '+ref,selected});}
    async function drain(){for(let i=0;i<40;i++){w.flush();await Promise.resolve();}}
    const report=()=>w.state.D35MapPageSetup&&w.state.D35MapPageSetup.lastReport;
    async function send(action='import',ref=transfer.id,selected=[],playerid='-MOCKGM'){trigger(action,ref,selected,playerid);await drain();return report();}
    const bind=()=>send('bind',transfer.id,[{_type:'graphic',_id:image.id}]);
    function copyMode(){pkg.image.mode='copy';image._attrs._pageid='-MOCKPAGE';set();}
    // Seed native fixture parent metadata for unrelated types; the Mod never creates these objects.
    function occupant(type){const o=w.createObj(type,type==='pin'?{pageid:page.id}:type==='graphic'?{pageid:page.id}:{});o._attrs._pageid=page.id;return o;}
    set();return {w,ctx,page,image,transfer,pkg,set,trigger,drain,send,bind,report,copyMode,occupant,ribbon:v=>{ribbon=v;},overrides:v=>{overrides=v;}};
}
function verified(r){assert.strictEqual(r.status,'verified',JSON.stringify(r));}
function error(r,re){assert.strictEqual(r.status,'error',JSON.stringify(r));if(re)assert.match(r.message,re);}
async function main(){let count=0;
    async function test(name,body){try{await body(harness());count++;console.log('PASS '+name);}catch(e){e.message=name+': '+e.message;throw e;}}
    await test('missing binding fails preflight without page or graphic writes',async h=>{const before=snapshot(h.w);error(await h.send(),/No image binding/);assert.strictEqual(snapshot(h.w),before);});
    await test('binding derives the real uploaded URL and identity from one selected graphic without writes',async h=>{
        const before=snapshot(h.w);const r=await h.bind();assert.strictEqual(r.status,'bound');assert.strictEqual(r.imageIdentity,'9001/approvedMapHash');assert.strictEqual(snapshot(h.w),before);
        const b=h.w.state.D35MapPageSetup.bindings['setup:example.map'];assert.strictEqual(b.imgsrc,h.image.get('imgsrc'));assert.strictEqual(b.sourceId,h.image.id);
    });
    await test('preview produces an explicit settings and placement delta without mutation',async h=>{await h.bind();const before=snapshot(h.w);const r=await h.send('preview');assert.strictEqual(r.status,'preview');assert.strictEqual(r.pageChanges.width,10);assert.strictEqual(r.graphicChanges.width,700);assert.strictEqual(snapshot(h.w),before);});
    await test('initial configure preserves the exact page and image IDs and sets the correct scale and placement',async h=>{
        await h.bind();const id=h.image.id,pid=h.page.id,r=await h.send();verified(r);assert.strictEqual(r.pageId,pid);assert.strictEqual(r.graphicId,id);assert.strictEqual(r.objectWrites,2);
        Object.entries(h.pkg.page_settings).forEach(([k,v])=>assert.strictEqual(h.page.get(k),v));Object.entries(h.pkg.placement).forEach(([k,v])=>assert.strictEqual(h.image.get(k),v));assert.strictEqual(h.image.get('name'),'Approved source name');assert.strictEqual(h.w.findObjs({_type:'graphic'}).length,1);
    });
    await test('copy creates exactly one Map-layer image and preserves its source graphic',async h=>{
        h.copyMode();await h.bind();const before=JSON.stringify(h.image.toJSON());const r=await h.send();verified(r);assert.notStrictEqual(r.graphicId,h.image.id);assert.strictEqual(JSON.stringify(h.image.toJSON()),before);assert.strictEqual(h.w.getObj('graphic',r.graphicId).get('_pageid'),h.page.id);assert.strictEqual(h.w.findObjs({_type:'graphic'}).length,2);
    });
    await test('repeat bind preview import and audit preserve IDs and perform no unnecessary writes',async h=>{
        await h.bind();const first=await h.send();verified(first);const before=snapshot(h.w);h.w.hooks.beforeSet=()=>{throw Error('Unexpected write');};h.w.hooks.beforeCreate=()=>{throw Error('Unexpected creation');};
        for(const action of ['bind','preview','import','audit']){const r=action==='bind'?await h.bind():await h.send(action);verified(r);assert.strictEqual(r.graphicId,first.graphicId);assert.strictEqual(r.objectWrites,0);}assert.strictEqual(snapshot(h.w),before);
    });
    await test('setup already equal to the specification makes zero native writes',async h=>{
        h.page.set(h.pkg.page_settings);h.image.set(h.pkg.placement);await h.bind();h.w.hooks.beforeSet=()=>{throw Error('Unnecessary write');};const r=await h.send();verified(r);assert.strictEqual(r.objectWrites,0);
    });
    await test('explicit image and page IDs are checked during binding without manual URL copying',async h=>{h.pkg.target.id=h.page.id;h.pkg.image.graphic_id=h.image.id;h.set();await h.bind();verified(await h.send());});
    await test('restart retains binding setup and exact identity without writes',async h=>{await h.bind();const r=await h.send();verified(r);const before=snapshot(h.w);h.w.state=clone(h.w.state);h.w.handlers.ready=[];h.w.handlers['chat:message']=[];load(h.w);const r2=await h.send();verified(r2);assert.strictEqual(r2.graphicId,r.graphicId);assert.strictEqual(snapshot(h.w),before);});
    await test('absent optional native fields survive real JSON state serialization without invented object writes',async h=>{
        const get=h.image.get.bind(h.image);h.image.get=(k,cb)=>k==='lockMovement'?undefined:get(k,cb);await h.bind();verified(await h.send());h.w.state=clone(h.w.state);h.w.handlers.ready=[];h.w.handlers['chat:message']=[];load(h.w);h.w.hooks.beforeSet=()=>{throw Error('Unexpected write');};verified(await h.send());
    });
    await test('later encounter objects are preserved when the verified setup is only audited',async h=>{
        await h.bind();verified(await h.send());for(const type of ['pin','graphic','path','pathv2','text','door','window'])h.occupant(type);const before=snapshot(h.w);verified(await h.send());verified(await h.send('audit'));assert.strictEqual(snapshot(h.w),before);
    });
    await test('every populated initial page fails before writes even when settings already match',async h=>{
        for(const type of ['pin','graphic','path','pathv2','text','door','window','unknownPageObject']){const extra=h.occupant(type),before=snapshot(h.w);error(await h.bind(),/Populated page/);assert.strictEqual(snapshot(h.w),before);extra.remove();}
        h.page.set(h.pkg.page_settings);h.occupant('pin');const before=snapshot(h.w);error(await h.bind(),/Populated page/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('unsafe player ribbon or explicit player-page override is rejected without changing assignments',async h=>{
        h.ribbon(h.page.id);error(await h.bind(),/player ribbon/);h.ribbon('-MOCKPAGE');h.overrides({'-player':h.page.id});error(await h.bind(),/player assignment/);h.overrides(JSON.stringify({'-player':h.page.id}));error(await h.bind(),/player assignment/);h.overrides({'-player':['unexpected']});error(await h.bind(),/unsupported/i);h.overrides('bad JSON');error(await h.bind());
        assert.strictEqual(h.page.get('width'),25);
    });
    await test('duplicate missing renamed and mismatched pages are refused',async h=>{
        let p=clone(h.pkg);p.target.name='Missing';h.set(p);error(await h.bind(),/Existing page missing/);p=clone(h.pkg);p.target.id='-wrong';h.set(p);error(await h.bind(),/identity/);h.set();const other=h.w.createObj('page',{name:h.page.get('name')});error(await h.bind(),/ambiguous/);other.remove();await h.bind();h.page.set('name','Renamed');error(await h.send(),/missing/);
    });
    await test('page-name reuse cannot retarget an existing stable binding',async h=>{
        await h.bind();h.page.set('name','Original renamed');h.w.createObj('page',{name:h.pkg.target.name});error(await h.send(),/identity changed/);assert.strictEqual(h.w.state.D35MapPageSetup.setups['setup:example.map'],undefined);
    });
    await test('binding requires one real plain uploaded graphic and matching configure page',async h=>{
        for(const selection of [[],[{_type:'graphic',_id:h.image.id},{_type:'graphic',_id:h.image.id}],[{_type:'character',_id:'-x'}],[{_type:'graphic',_id:'-missing'}]])error(await h.send('bind',h.transfer.id,selection));
        h.image._attrs._pageid='-MOCKPAGE';error(await h.bind(),/exact target page/);
    });
    await test('an explicit package graphic ID cannot be substituted by a selected image',async h=>{
        h.pkg.image.graphic_id='-some-other-graphic';h.set();const before=snapshot(h.w);error(await h.bind(),/differs from the explicit package binding/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('Character bindings controls bars and multi-sided tokens are protected',async h=>{
        for(const [k,v] of [['represents','-character'],['controlledby','all'],['bar1_link','-attribute'],['bar2_value',0],['sides','table-image']]){const old=h.image.get(k);h.image.set(k,v);const before=snapshot(h.w);error(await h.bind(),/protected|token|bars/);assert.strictEqual(snapshot(h.w),before);h.image.set(k,old);}
    });
    await test('external Marketplace and missing-image bindings are refused',async h=>{
        const urls=['https://example.invalid/map.jpg?1','https://files.d20.io/marketplace/1/map.jpg?1','', 'https://files.d20.io/images/9001/hash/../../wrong.jpg?1'];
        for(const url of urls){h.image.set('imgsrc',url);const before=snapshot(h.w);error(await h.bind(),/uploaded Roll20/);assert.strictEqual(snapshot(h.w),before);}
    });
    await test('native queryless WebP upload configures the existing graphic without inventing or writing its URL',async h=>{
        const url='https://files.d20.io/images/9001/approvedMapHash/original.webp';h.image.set('imgsrc',url);await h.bind();assert.strictEqual(h.w.state.D35MapPageSetup.bindings['setup:example.map'].imgsrc,url);verified(await h.send());verified(await h.send('audit'));verified(await h.send());assert.strictEqual(h.image.get('imgsrc'),url);
    });
    await test('copy mode still refuses a missing creation query without guessing or writing',async h=>{
        h.copyMode();h.image.set('imgsrc','https://files.d20.io/images/9001/approvedMapHash/original.webp');const before=snapshot(h.w);error(await h.bind(),/query string/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('CDN host size extension and query normalization preserve real image identity',async h=>{
        h.copyMode();await h.bind();h.w.hooks.afterCreate=g=>{if(g.get('_type')==='graphic')g._attrs.imgsrc='https://s3.amazonaws.com/files.d20.io/images/9001/approvedMapHash/thumb.webp?rewritten=2';};const r=await h.send();verified(r);verified(await h.send('audit'));assert.strictEqual(r.imageIdentity,'9001/approvedMapHash');
    });
    await test('native stored query removal is harmless while binding still requires the observed creation query',async h=>{
        h.copyMode();await h.bind();h.w.hooks.afterCreate=g=>{if(g.get('_type')==='graphic')g._attrs.imgsrc='https://files.d20.io/images/9001/approvedMapHash/thumb.webp';};verified(await h.send());verified(await h.send('audit'));
    });
    await test('wrong readback image identity retains the new object and blocks duplicate retry',async h=>{
        h.copyMode();await h.bind();h.w.hooks.afterCreate=g=>{if(g.get('_type')==='graphic')g._attrs.imgsrc='https://files.d20.io/images/9002/wrongMapHash/thumb.jpg?1';};error(await h.send(),/image identity/);const id=h.w.state.D35MapPageSetup.setups['setup:example.map'].graphicId,count=h.w.findObjs({_type:'graphic'}).length;error(await h.send(),/Partial setup/);assert.strictEqual(h.w.state.D35MapPageSetup.setups['setup:example.map'].graphicId,id);assert.strictEqual(h.w.findObjs({_type:'graphic'}).length,count);
    });
    await test('manual source or page edits after binding are preserved and cannot be silently rebound',async h=>{
        await h.bind();h.image.set('left',40);const before=snapshot(h.w);error(await h.send(),/changed after binding/);error(await h.bind(),/changed after binding/);assert.strictEqual(snapshot(h.w),before);h.image.set('left',35);h.page.set('scale_number',10);error(await h.send(),/Page settings changed/);
    });
    await test('manual managed geometry layer image title style and page changes fail audit without overwrite',async h=>{
        await h.bind();verified(await h.send());
        for(const [obj,k,v] of [[h.image,'left',400],[h.image,'layer','objects'],[h.image,'name','Manual map name'],[h.image,'tint_color','#ff0000'],[h.image,'imgsrc','https://files.d20.io/images/8888/otherHash/thumb.jpg?1'],[h.page,'width',11],[h.page,'showgrid',false]]){
            const old=obj.get(k);obj.set(k,v);const before=snapshot(h.w);error(await h.send('audit'));error(await h.send());assert.strictEqual(snapshot(h.w),before);obj.set(k,old);
        }
        verified(await h.send('audit'));
    });
    await test('live editor number-to-string opacity normalization survives name restoration and JSON restart without writes',async h=>{
        h.image.set('baseOpacity',1);await h.bind();verified(await h.send());h.image.set({name:'Manual map name',baseOpacity:'1'});error(await h.send('audit'),/Manual map graphic/);h.image.set('name','Approved source name');const before=snapshot(h.w);verified(await h.send('audit'));h.w.state=clone(h.w.state);h.w.handlers.ready=[];h.w.handlers['chat:message']=[];load(h.w);verified(await h.send());assert.strictEqual(snapshot(h.w),before);assert.strictEqual(h.image.get('baseOpacity'),'1');
    });
    await test('real opacity changes and malformed native opacity remain protected',async h=>{
        h.image.set('baseOpacity',1);await h.bind();verified(await h.send());for(const v of ['0.5','NaN','0x1']){h.image.set('baseOpacity',v);const before=snapshot(h.w);error(await h.send('audit'));error(await h.send());assert.strictEqual(snapshot(h.w),before);}h.image.set('baseOpacity',1);verified(await h.send('audit'));
    });
    await test('unowned page lighting background and other objects are never rewritten',async h=>{
        h.page.set({background_color:'#aabbcc',dynamic_lighting_enabled:true,diagonaltype:'threefive'});await h.bind();verified(await h.send());h.page.set('background_color','#112233');const before=snapshot(h.w);verified(await h.send());assert.strictEqual(snapshot(h.w),before);assert.strictEqual(h.page.get('dynamic_lighting_enabled'),true);assert.strictEqual(h.page.get('diagonaltype'),'threefive');
    });
    await test('stable identity rejects changed placement plans and another setup reserving the same page',async h=>{
        await h.bind();let p=clone(h.pkg);p.title='Changed';h.set(p);error(await h.send(),/different package/);p=clone(h.pkg);p.setup_id='other.setup';h.set(p);error(await h.bind(),/reserves this page/);
    });
    await test('a different selected graphic never silently replaces a binding',async h=>{
        h.copyMode();await h.bind();const other=h.w.createObj('graphic',{pageid:'-MOCKPAGE'});error(await h.send('bind',h.transfer.id,[{_type:'graphic',_id:other.id}]),/no silent rebind/);
    });
    await test('deleted managed graphic is never recreated',async h=>{await h.bind();verified(await h.send());h.image.remove();const before=snapshot(h.w);error(await h.send(),/missing/);assert.strictEqual(snapshot(h.w),before);});
    await test('deleted copy source does not break an intact managed map',async h=>{h.copyMode();await h.bind();verified(await h.send());h.image.remove();verified(await h.send());});
    await test('same-image unmanaged duplicates cause conflicts and remain untouched',async h=>{
        await h.bind();verified(await h.send());const g=h.w.createObj('graphic',{pageid:h.page.id,layer:'map',imgsrc:h.image.get('imgsrc')});const before=snapshot(h.w);error(await h.send(),/ambiguous duplicates/);assert.strictEqual(snapshot(h.w),before);g.remove();verified(await h.send('audit'));
    });
    await test('lost copy registry cannot adopt or duplicate an existing map automatically',async h=>{
        h.copyMode();h.pkg.image.graphic_id=h.image.id;h.set();await h.bind();verified(await h.send());delete h.w.state.D35MapPageSetup;const before=snapshot(h.w);error(await h.send(),/No image binding/);assert.strictEqual(snapshot(h.w),before);error(await h.bind(),/Populated/);
    });
    await test('failed creation reserves partial setup and never retries page writes or duplication',async h=>{
        h.copyMode();await h.bind();h.w.hooks.beforeCreate=t=>{if(t==='graphic')throw Error('Injected creation failure');};error(await h.send(),/Injected creation failure/);assert.strictEqual(h.page.get('width'),10);const before=snapshot(h.w);h.w.hooks.beforeCreate=null;error(await h.send(),/Partial setup/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('wrong native dimensions or page readback is detected with retained object identity',async h=>{
        await h.bind();h.w.hooks.afterSet=(obj,changes)=>{if(obj===h.image&&'width'in changes)obj._attrs.width=701;};error(await h.send(),/readback differs: width/);assert.strictEqual(h.w.state.D35MapPageSetup.setups['setup:example.map'].graphicId,h.image.id);assert.strictEqual(h.w.state.D35MapPageSetup.setups['setup:example.map'].status,'blocked');
    });
    await test('failed page setting readback stops before map placement and never repairs automatically',async h=>{
        await h.bind();h.w.hooks.afterSet=(obj,changes)=>{if(obj===h.page&&'width'in changes)obj._attrs.width=11;};error(await h.send(),/Page settings readback differs/);assert.strictEqual(h.image.get('width'),70);const before=snapshot(h.w);error(await h.send(),/Partial setup/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('an object added during page writes stops further writes and preserves the unexpected object',async h=>{
        await h.bind();h.w.hooks.afterSet=(obj,changes)=>{if(obj===h.page&&'width'in changes)h.occupant('pin');};error(await h.send(),/became populated/);assert.strictEqual(h.image.get('width'),70);assert.strictEqual(h.w.findObjs({_type:'pin'}).length,1);
    });
    await test('fractional snapping has correct represented distance and graphic scale',async h=>{
        h.pkg.page_settings.scale_number=10;h.pkg.page_settings.snapping_increment=0.5;h.pkg.placement={...h.pkg.placement,width:350,height:280,left:175,top:140};h.set();await h.bind();verified(await h.send());assert.strictEqual(h.image.get('width'),350);assert.strictEqual(h.page.get('scale_number')*h.page.get('snapping_increment'),5);
    });
    await test('optional specified grid controls are configured and read back with harmless numeric/color normalization',async h=>{
        h.pkg.page_settings={...h.pkg.page_settings,diagonaltype:'threefive',grid_opacity:0.2,gridcolor:'#AaBbCc',background_color:'#FFFFFF',gridlabels:false};h.set();await h.bind();verified(await h.send());
        h.page._attrs.width='10';h.page._attrs.gridcolor='#aabbcc';h.page._attrs.background_color='#ffffff';h.image._attrs.width='700';verified(await h.send());
    });
    await test('unsupported native numeric encodings and assignment formats fail closed',async h=>{
        h.page._attrs.width='0x19';error(await h.bind(),/Unsupported native numeric/);h.page._attrs.width=25;
        h.page._attrs.grid_type=false;error(await h.bind(),/Unsupported native text/);h.page._attrs.grid_type='square';
        h.overrides(0);error(await h.bind(),/Unsupported player-page assignments/);h.overrides(false);h.ribbon(123);error(await h.bind(),/ribbon state is unsupported/);
    });
    await test('malformed unsupported missing and unsafe specifications fail preflight without writes',async h=>{
        const bad=[];for(const [section,k,v] of [['placement','rotation',90],['placement','fliph',true],['placement','width',699],['page_settings','grid_offset_x',1],['page_settings','snapping_increment',0],['page_settings','grid_type','hex'],['page_settings','dynamic_lighting_enabled',true]]){const p=clone(h.pkg);p[section][k]=v;bad.push(p);}const crop=clone(h.pkg);crop.crop='auto';bad.push(crop);const reveal=clone(h.pkg);reveal.visibility='all';bad.push(reveal);const missing=clone(h.pkg);delete missing.source.authority;bad.push(missing);bad.push('{bad');
        for(const p of bad){h.set(p);const before=snapshot(h.w);error(await h.send());assert.strictEqual(snapshot(h.w),before);}
    });
    await test('shared and ambiguous transfer Handouts are refused and exact IDs remain usable',async h=>{
        for(const k of ['inplayerjournals','controlledby']){h.transfer.set(k,'all');error(await h.bind(),/GM-only/);h.transfer.set(k,'');}
        h.w.createObj('handout',{name:h.transfer.get('name')});error(await h.send('preview','D35 Map Page Transfer'),/ambiguous/);assert.strictEqual((await h.bind()).status,'bound');
    });
    await test('rich-editor wrappers URI escapes and NBSP outside strings preserve the exact package',async h=>{
        const raw=JSON.stringify(h.pkg,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');h.set('<pre>'+raw.replace(/\n  /g,'\n&nbsp; ')+'</pre>');await h.bind();verified(await h.send());h.set(encodeURIComponent(JSON.stringify(h.pkg)));verified(await h.send('audit'));
    });
    await test('canonical key ordering preserves deterministic package identity',async h=>{await h.bind();verified(await h.send());h.set(Object.fromEntries(Object.entries(h.pkg).reverse()));verified(await h.send());});
    await test('GM-only commands and invalid syntax never expose bindings or write objects for players',async h=>{
        const before=snapshot(h.w);await h.send('bind',h.transfer.id,[{_type:'graphic',_id:h.image.id}],'-PLAYER');assert.strictEqual(h.w.chat.length,0);await h.send('bind',h.transfer.id,[],'API');assert.strictEqual(snapshot(h.w),before);h.w.trigger('chat:message',{type:'api',playerid:'-MOCKGM',content:'!d35map delete anything'});error(h.report(),/Use !d35map/);
    });
    await test('transfer timeout releases the command lock and late callbacks cannot configure a page',async h=>{
        let late;const get=h.transfer.get.bind(h.transfer);h.transfer.get=(k,cb)=>k==='gmnotes'?(late=cb):get(k,cb);error(await h.bind(),/timed out/);late(JSON.stringify(h.pkg));await h.drain();assert.strictEqual(h.page.get('width'),25);h.transfer.get=get;await h.bind();verified(await h.send());
    });
    await test('concurrent commands create at most one map graphic',async h=>{
        h.copyMode();await h.bind();h.trigger();h.trigger();await h.drain();assert.strictEqual(h.w.findObjs({_type:'graphic'}).length,2);verified(h.report());
    });
    await test('dependency and incompatible state failures preserve existing objects and state',async h=>{
        h.w.handlers.ready=[];h.w.handlers['chat:message']=[];load(h.w,false);error(await h.bind(),/Journal importer/);assert.strictEqual(h.page.get('width'),25);
        h.w.state.D35MapPageSetup={version:999,precious:'keep'};const before=JSON.stringify(h.w.state);await h.bind();assert.strictEqual(JSON.stringify(h.w.state),before);
    });
    await test('all existing Mod components coexist without changes to unrelated objects or their state',async h=>{
        h.w.handlers.ready=[];h.w.handlers['chat:message']=[];const ctx=Object.assign({console},h.w.globals());vm.createContext(ctx);
        for(const file of ['D35_Statblock_Importer.js','D35_Batch_Importer.js','D35_Journal_Importer.js','D35_Map_Pin_Importer.js','D35_Map_Page_Setup.js'])vm.runInContext(fs.readFileSync(path.join(root,'Roll20 Importer',file),'utf8'),ctx);
        h.w.trigger('ready',{});
        const keep=[h.w.createObj('character',{name:'Protected Character'}),h.w.createObj('graphic',{pageid:'-MOCKPAGE',name:'Protected token'}),h.w.createObj('pin',{pageid:'-MOCKPAGE',x:30,y:40}),h.w.createObj('handout',{name:'Protected reference'})];
        const before=JSON.stringify(keep.map(o=>o.toJSON())),oldStates=JSON.stringify(Object.fromEntries(Object.entries(h.w.state).filter(([k])=>k!=='D35MapPageSetup')));
        await h.bind();verified(await h.send());verified(await h.send('audit'));assert.strictEqual(JSON.stringify(keep.map(o=>o.toJSON())),before);assert.strictEqual(JSON.stringify(Object.fromEntries(Object.entries(h.w.state).filter(([k])=>k!=='D35MapPageSetup'))),oldStates);
    });
    const arg=process.argv.indexOf('--package');
    if(arg!==-1)await test('prepared Wreck of the Sea Wyvern package configures exact approved geometry and remains repeatable',async h=>{
        const p=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8'));h.page.set('name',p.target.name);h.pkg.target.name=p.target.name;h.set(p);await h.bind();const first=await h.send();verified(first);assert.strictEqual(h.page.get('width'),50);assert.strictEqual(h.page.get('height'),50);assert.strictEqual(h.image.get('width'),3500);assert.strictEqual(h.image.get('height'),3500);assert.strictEqual(h.image.get('left'),1750);assert.strictEqual(h.image.get('top'),1750);verified(await h.send('audit'));const again=await h.send();verified(again);assert.strictEqual(again.graphicId,first.graphicId);assert.strictEqual(again.objectWrites,0);
    });
    console.log(JSON.stringify({status:'pass',tests:count,pilotAcceptance:arg!==-1,liveAcceptance:'not installed or performed'}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
