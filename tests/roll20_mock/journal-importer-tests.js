'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRoll20Mock } = require('./roll20-sandbox-mock');
const script = path.resolve(__dirname, '../../Roll20 Importer/D35_Journal_Importer.js');
const source = fs.readFileSync(script, 'utf8');
const clone = x => JSON.parse(JSON.stringify(x));
const hash = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const htmlEscape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pkg(html='<h3>Arrival &amp; Approach</h3><blockquote><p>First “read aloud.”</p><p>Second paragraph.</p></blockquote><p><strong>Creatures:</strong> An <em>exact</em> description. 100% intact.</p><table><tr><th><p>Roll</p></th><th><p>Result</p></th></tr><tr><td><p>1–2</p></td><td><p>Unchanged.</p></td></tr></table><ol><li>First.</li><li>Second.</li></ol>') {
    return { schema:'d35-journal/0.1',journal_id:'synthetic.arrival',handout:{
        name:'EX 1.1 — Arrival',notes:html,gmnotes:'',inplayerjournals:'',controlledby:'',
        source_html:html,navigation_html:'',source_sha256:hash(html) } };
}
function load(world) {
    const context = Object.assign({ console }, world.globals());
    vm.createContext(context); vm.runInContext(source, context, {filename:script});
    world.trigger('ready', {}); return context.D35JournalImporter;
}
function harness() {
    const w=createRoll20Mock(), api=load(w);
    const input=w.createObj('handout',{name:'Journal Transfer',inplayerjournals:'',controlledby:''});
    input.set('gmnotes',JSON.stringify(pkg()));
    async function drain() { for(let i=0;i<24;i++) { w.flush(); await Promise.resolve(); } }
    function trigger(text, playerid='-MOCKGM') { w.trigger('chat:message',{type:'api',playerid,content:'!d35journal '+text}); }
    async function send(command='import', ref=input.id, playerid='-MOCKGM') { trigger(command+' '+ref,playerid); await drain(); return report(); }
    function report() { return w.state.D35JournalImporter && w.state.D35JournalImporter.lastReport; }
    function set(data) { input.set('gmnotes',typeof data==='string' ? data : JSON.stringify(data)); }
    function destinations() { return w.findObjs({_type:'handout'}).filter(o=>o.id!==input.id); }
    return {w,api,input,send,set,report,drain,trigger,destinations};
}
// These original fixtures have no filing plan: content passes, publication stays pending.
function verified(r) { assert.strictEqual(r.status,'pending_filing',JSON.stringify(r)); assert.strictEqual(r.evidence.contentVerified,true); }
function error(r, pattern) { assert.strictEqual(r.status,'error',JSON.stringify(r)); if(pattern) assert.match(r.message,pattern); }
function snapshot(w) { return JSON.stringify(w.objects.map(o=>o.toJSON())); }

async function main() {
    let count=0;
    async function test(name,body) {
        try { await body(harness()); count++; console.log('PASS '+name); }
        catch(e) { e.message=name+': '+e.message; throw e; }
    }
    await test('SHA-256 matches Node UTF-8 including Unicode and padding boundaries', async h=>{
        for(const value of ['', 'abc', 'A'.repeat(55),'A'.repeat(56),'A'.repeat(64),'“Sea Wyvern” — é 🐉']) assert.strictEqual(h.api.sha256(value),hash(value));
    });
    await test('preview validates without creating or reserving identity', async h=>{
        const before=snapshot(h.w); const r=await h.send('preview'); assert.strictEqual(r.status,'preview');
        assert.strictEqual(snapshot(h.w),before); assert.deepStrictEqual(Object.keys(h.w.state.D35JournalImporter.journals),[]);
    });
    await test('creation uses native fields and async readback verifies structure and permissions', async h=>{
        const r=await h.send(); verified(r); assert.strictEqual(r.action,'created');
        const obj=h.w.getObj('handout',r.objectId); assert.strictEqual(obj._attrs.notes,pkg().handout.notes);
        for(const key of ['gmnotes','inplayerjournals','controlledby']) assert.strictEqual(obj._attrs[key],'');
        assert.strictEqual(obj._attrs.source_html,undefined); assert.strictEqual(h.destinations().length,1);
        assert.ok(h.w.chat.every(c=>c.message.startsWith('/w gm ')));
    });
    await test('repeat import and preview preserve object ID without writes', async h=>{
        const first=await h.send(); verified(first); const before=snapshot(h.w);
        h.w.hooks.beforeSet=()=>{ throw Error('No existing writes allowed'); };
        for(const action of ['import','preview']) { const r=await h.send(action); verified(r); assert.strictEqual(r.objectId,first.objectId); assert.strictEqual(r.action,'preserve'); }
        assert.strictEqual(snapshot(h.w),before);
    });
    await test('persistent identity survives sandbox restart', async h=>{
        const first=await h.send(); verified(first);
        h.w.handlers.ready=[]; h.w.handlers['chat:message']=[]; load(h.w);
        const r=await h.send(); verified(r); assert.strictEqual(r.objectId,first.objectId); assert.strictEqual(h.destinations().length,1);
    });
    await test('non-GM and API-origin commands cannot read or create', async h=>{
        const before=snapshot(h.w); await h.send('import',h.input.id,'-PLAYER'); await h.send('import',h.input.id,'API');
        assert.strictEqual(h.report(),undefined); assert.strictEqual(snapshot(h.w),before); assert.strictEqual(h.w.chat.length,0);
    });
    await test('transfer supports exact name or exact ID', async h=>{ verified(await h.send('import','Journal Transfer')); verified(await h.send('import',h.input.id)); });
    await test('duplicate transfer names require ID', async h=>{
        h.w.createObj('handout',{name:'Journal Transfer'}); error(await h.send('preview','Journal Transfer'),/ambiguous/); verified(await h.send());
    });
    await test('shared or player-editable transfer rejected', async h=>{
        for(const key of ['inplayerjournals','controlledby']) { h.input.set(key,'all'); error(await h.send(),/GM-only/); h.input.set(key,''); }
        assert.strictEqual(h.destinations().length,0);
    });
    await test('transfer permissions rechecked after blob read', async h=>{
        const get=h.input.get.bind(h.input); h.input.get=(key,cb)=>key==='gmnotes' ? get(key,v=>{h.input.set('inplayerjournals','all');cb(v);}) : get(key,cb);
        error(await h.send(),/GM-only/); assert.strictEqual(h.destinations().length,0);
    });
    await test('malformed JSON unsupported schema fields and shared package fail before create', async h=>{
        const variants=['{broken', Object.assign(pkg(),{schema:'wrong'}),Object.assign(pkg(),{extra:true})];
        for(const key of ['gmnotes','inplayerjournals','controlledby']) {const p=pkg();p.handout[key]='unsafe';variants.push(p);}
        for(const data of variants) {h.set(data);error(await h.send());}
        assert.strictEqual(h.destinations().length,0);
    });
    await test('stable keys validate and prototype names cannot corrupt state', async h=>{
        for(const key of ['', '../x','UPPER','a']) {const p=pkg();p.journal_id=key;h.set(p);error(await h.send());}
        const p=pkg();p.journal_id='constructor';h.set(p);verified(await h.send());
        assert.ok(h.w.state.D35JournalImporter.journals['journal:constructor']);
    });
    await test('source checksum and source/navigation concatenation validated', async h=>{
        let p=pkg(); p.handout.source_sha256='0'.repeat(64);h.set(p);error(await h.send(),/SHA-256/);
        p=pkg();p.handout.notes+='<p>Invented</p>';h.set(p);error(await h.send(),/differ/);
        assert.strictEqual(h.destinations().length,0);
    });
    await test('unmanaged existing title preserved and not adopted', async h=>{
        h.w.createObj('handout',{name:pkg().handout.name});const before=snapshot(h.w);
        error(await h.send(),/unmanaged/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('ambiguous destination preserved', async h=>{
        h.w.createObj('handout',{name:pkg().handout.name});h.w.createObj('handout',{name:pkg().handout.name});
        const before=snapshot(h.w);error(await h.send(),/Ambiguous/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('same key changed package rejects overwrite', async h=>{
        verified(await h.send()); const before=snapshot(h.w);h.set(pkg('<h3>Changed source</h3>'));
        const afterTransfer=snapshot(h.w);error(await h.send(),/different package/);assert.strictEqual(snapshot(h.w),afterTransfer);assert.notStrictEqual(before,afterTransfer);
    });
    await test('different key same title rejects duplicate', async h=>{
        verified(await h.send());const p=pkg();p.journal_id='another.key';h.set(p);error(await h.send());assert.strictEqual(h.destinations().length,1);
    });
    await test('deleted registered destination never automatically recreated', async h=>{
        const first=await h.send();h.w.getObj('handout',first.objectId).remove();error(await h.send(),/missing/);assert.strictEqual(h.destinations().length,0);
    });
    await test('renamed registered destination never replaced or renamed back', async h=>{
        const first=await h.send();h.w.getObj('handout',first.objectId).set('name','User rename');
        const before=snapshot(h.w);error(await h.send(),/identity\/title/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('state loss fails safely on title collision', async h=>{
        verified(await h.send());delete h.w.state.D35JournalImporter;error(await h.send(),/unmanaged/);assert.strictEqual(h.destinations().length,1);
    });
    await test('unsupported state version preserved', async h=>{
        h.w.state.D35JournalImporter={version:999,precious:'retain'};const before=JSON.stringify(h.w.state);
        await h.send();assert.match(h.w.chat[h.w.chat.length-1].message,/ERROR: Unsupported Journal state/);
        assert.strictEqual(JSON.stringify(h.w.state),before);assert.strictEqual(h.destinations().length,0);
    });
    await test('normalization accepts entities inline synonyms spans attribute order and tbody', async h=>{
        h.w.hooks.afterSet=(obj,changes)=>{if(obj.id!==h.input.id && changes.notes) obj._attrs.notes=changes.notes
            .replace('<h3>','<H3 data-editor="yes" id="heading1">').replace('</h3>','</H3>')
            .replace(/<strong>/g,'<span style="font-weight: 700">').replace(/<\/strong>/g,'</span>')
            .replace(/<em>/g,'<i>').replace(/<\/em>/g,'</i>')
            .replace('“','&ldquo;').replace('”','&#8221;').replace(' description.','&nbsp;description.')
            .replace('<table>','<table>\n<tbody>').replace('</table>','</tbody></table>');};
        verified(await h.send());verified(await h.send('preview'));
    });
    await test('harmless rich editor empty GM Notes accepted', async h=>{
        h.w.hooks.afterSet=(obj,changes)=>{if(obj.id!==h.input.id && 'gmnotes' in changes) obj._attrs.gmnotes='<p><br></p>';};
        verified(await h.send());
    });
    await test('URI-encoded stored blobs verify without altering source text', async h=>{
        h.w.hooks.afterSet=(o,c)=>{if(o.id!==h.input.id && 'notes' in c)o._attrs.notes=encodeURIComponent(c.notes);
            if(o.id!==h.input.id && 'gmnotes' in c)o._attrs.gmnotes=encodeURIComponent('<p><br></p>');};
        verified(await h.send());verified(await h.send('preview'));
    });
    await test('lookup wrappers are compared by stable ID rather than JS reference', async h=>{
        const w=createRoll20Mock(), get=w.getObj;
        w.getObj=(type,id)=>{const o=get(type,id);return o ? {id:o.id,get:o.get.bind(o),set:o.set.bind(o)} : null;};
        load(w);const input=w.createObj('handout',{name:'Transfer',inplayerjournals:'',controlledby:''});input.set('gmnotes',JSON.stringify(pkg()));
        w.trigger('chat:message',{type:'api',playerid:'-MOCKGM',content:'!d35journal import '+input.id});
        for(let i=0;i<24;i++) {w.flush();await Promise.resolve();}
        verified(w.state.D35JournalImporter.lastReport);
    });
    await test('changed dropped duplicated or reordered text rejected on readback', async h=>{
        for(const alter of [s=>s.replace('description.','summary.'),s=>s.replace('description.',''),s=>s+'<p>Extra.</p>',
                            s=>s.replace('<li>First.</li><li>Second.</li>','<li>Second.</li><li>First.</li>')]) {
            const x=harness();x.w.hooks.afterSet=(o,c)=>{if(o.id!==x.input.id && c.notes)o._attrs.notes=alter(c.notes);};
            error(await x.send(),/differs/);const first=x.destinations()[0].id;error(await x.send(),/differs/);assert.strictEqual(x.destinations()[0].id,first);
        }
    });
    await test('lost blockquote bold heading table and paragraph boundaries rejected', async h=>{
        for(const alter of [s=>s.replace(/<\/?blockquote>/g,''),s=>s.replace(/<\/?strong>/g,''),
                            s=>s.replace(/h3/g,'p'),s=>s.replace(/th/g,'td'),s=>s.replace('</p><p>Second',' Second')]) {
            const x=harness();x.w.hooks.afterSet=(o,c)=>{if(o.id!==x.input.id && c.notes)o._attrs.notes=alter(c.notes);};error(await x.send());
        }
    });
    await test('post-create verification detects permissions and nonempty GM Notes', async h=>{
        for(const field of ['inplayerjournals','controlledby','gmnotes']) {
            const x=harness();x.w.hooks.afterSet=(o,c)=>{if(o.id!==x.input.id && 'gmnotes' in c)o._attrs[field]='all';};
            error(await x.send());assert.strictEqual(x.destinations().length,1);
        }
    });
    await test('drift on managed objects audited without repairing or rewriting', async h=>{
        const r=await h.send();const obj=h.w.getObj('handout',r.objectId);obj.set('notes','<p>User edit</p>');const before=snapshot(h.w);
        error(await h.send('preview'),/differs/);error(await h.send(),/differs/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('partial write failure retains identity and never retries destructive write', async h=>{
        h.w.hooks.beforeSet=(o,c)=>{if(o.id!==h.input.id && 'gmnotes' in c) throw Error('Injected write failure');};
        const r=await h.send();error(r,/write failure/);assert.ok(r.objectId);
        const old=h.w.getObj('handout',r.objectId);const before=snapshot(h.w);h.w.hooks.beforeSet=()=>{throw Error('No writes');};
        // Mock's absent GM Notes defaults to empty; repeat verifies instead of writing.
        verified(await h.send());assert.strictEqual(snapshot(h.w),before);assert.strictEqual(h.destinations()[0],old);
    });
    await test('failed source write cannot cause a duplicate or overwrite on retry', async h=>{
        h.w.hooks.beforeSet=(o,c)=>{if(o.id!==h.input.id && 'notes' in c)throw Error('No write');};
        error(await h.send());error(await h.send(),/differs/);assert.strictEqual(h.destinations().length,1);
    });
    await test('blob timeout reports error and clears command lock', async h=>{
        h.w.suspendBlobs=true;error(await h.send(),/Timed out/);assert.strictEqual(h.destinations().length,0);
        h.w.suspendBlobs=false;verified(await h.send());
    });
    await test('post-create read timeout reserves identity and recovers with verification only', async h=>{
        h.w.hooks.afterSet=(o,c)=>{if(o.id!==h.input.id && 'gmnotes' in c)h.w.suspendBlobs=true;};
        const r=await h.send();error(r,/Timed out/);assert.ok(r.objectId);h.w.suspendBlobs=false;
        verified(await h.send());assert.strictEqual(h.destinations().length,1);
    });
    await test('late transfer callback after timeout cannot resume an import', async h=>{
        const get=h.input.get.bind(h.input);let late;
        h.input.get=(key,cb)=>key==='gmnotes' ? (late=cb) : get(key,cb);
        error(await h.send(),/Timed out/);late(JSON.stringify(pkg()));await h.drain();
        assert.strictEqual(h.destinations().length,0);h.input.get=get;verified(await h.send());
    });
    await test('invalid asynchronous blob values report errors and release the lock', async h=>{
        const get=h.input.get.bind(h.input);
        h.input.get=(key,cb)=>key==='gmnotes' ? get(key,()=>cb(null)) : get(key,cb);
        error(await h.send(),/Invalid text/);assert.strictEqual(h.destinations().length,0);
        h.input.get=get;verified(await h.send());
    });
    await test('permissions changed during destination blob reads are caught', async h=>{
        const first=await h.send();const obj=h.w.getObj('handout',first.objectId);const get=obj.get.bind(obj);
        obj.get=(key,cb)=>key==='notes' ? get(key,v=>{obj.set('controlledby','all');cb(v);}) : get(key,cb);
        error(await h.send('preview'),/permission mismatch/);assert.strictEqual(h.destinations().length,1);
    });
    await test('destination appearing after transfer read blocks creation', async h=>{
        const get=h.input.get.bind(h.input);
        h.input.get=(key,cb)=>key==='gmnotes' ? get(key,v=>{h.w.createObj('handout',{name:pkg().handout.name});cb(v);}) : get(key,cb);
        error(await h.send(),/unmanaged/);assert.strictEqual(h.destinations().length,1);
    });
    await test('concurrent imports serialize and create at most once', async h=>{
        h.trigger('import '+h.input.id);h.trigger('import '+h.input.id);await h.drain();verified(h.report());
        assert.strictEqual(h.destinations().length,1);assert.ok(h.w.chat.some(c=>/in progress/.test(c.message)));
    });
    await test('transfer raw escaped and URI-encoded JSON preserve percent and source HTML', async h=>{
        for(const encode of [s=>s,s=>'<pre>'+htmlEscape(s)+'</pre>',s=>'<p>'+htmlEscape(s)+'</p>',s=>encodeURIComponent(s),s=>encodeURIComponent('<pre>'+htmlEscape(s)+'</pre>')]) {
            const x=harness();x.set(encode(JSON.stringify(pkg())));verified(await x.send());assert.strictEqual(x.destinations()[0]._attrs.notes,pkg().handout.notes);
        }
    });
    await test('live rich-editor NBSP indentation parses without changing source string values', async h=>{
        const p=pkg('<h3>Heading</h3><p>A\u00a0B; literal \\"quote\\"; backslash \\ retained.</p>');
        const raw=JSON.stringify(p,null,2);
        const html=raw.split('\n').map(line=>'<p>'+htmlEscape(line).replace(/^ +/,spaces=>'&nbsp;'.repeat(spaces.length))+'</p>').join('');
        h.set(html);verified(await h.send());assert.strictEqual(h.destinations()[0]._attrs.notes,p.handout.notes);
    });
    await test('live-style alternating NBSP and space indentation passes without compact workaround', async h=>{
        // The synthetic equivalent reproduces the actual first two lines and
        // alternating NBSP/space indentation, without embedding adventure text.
        const raw=JSON.stringify(pkg(),null,2);
        h.set(raw.split('\n').map(line=>'<p>'+htmlEscape(line).replace(/^ +/,spaces=>spaces.replace(/  /g,'&nbsp; '))+'</p>').join(''));
        verified(await h.send());
    });
    await test('persisted empty GM Notes null sentinel survives a sandbox restart', async h=>{
        const first=await h.send();verified(first);const obj=h.w.getObj('handout',first.objectId);
        obj._attrs.gmnotes='null';h.w.handlers.ready=[];h.w.handlers['chat:message']=[];load(h.w);
        const before=snapshot(h.w);const r=await h.send();verified(r);assert.strictEqual(r.objectId,first.objectId);
        assert.strictEqual(snapshot(h.w),before);
    });
    await test('null text in source is substantive and cannot bypass source fidelity', async h=>{
        const p=pkg('<h3>Heading</h3><p>null</p>');h.set(p);const r=await h.send();verified(r);
        h.w.getObj('handout',r.objectId)._attrs.notes='<h3>Heading</h3><p></p>';
        error(await h.send(),/differs/);
    });
    await test('unsafe HTML malformed markup and changed link destinations rejected', async h=>{
        for(const html of ['<p><script>alert(1)</script></p>','<p onclick="x()">Text</p>','<p style="display:none">Hidden</p>',
                           '<h3>Wrong close</p>','<p><a href="javascript:x()">Link</a></p>','<p><img src="x"/></p>']) {
            h.set(pkg(html));error(await h.send());
        }
        assert.strictEqual(h.destinations().length,0);
        const a='<p><a href="https://journal.roll20.net/handout/-abc#heading">Related</a></p>';
        assert.strictEqual(h.api.equivalent(a,a.replace('-abc','-def')),false);
    });
    await test('source layout whitespace normalizes without erasing words punctuation or inline marks', async h=>{
        assert.ok(h.api.equivalent('<p>A <strong>bold</strong> word.</p>','<p> A\n <b>bold</b>&nbsp;word. </p>'));
        assert.ok(!h.api.equivalent('<p>A B</p>','<p>AB</p>'));
        assert.ok(!h.api.equivalent('<p>A.</p>','<p>A!</p>'));
        assert.ok(!h.api.equivalent('<p><em>word</em></p>','<p>word</p>'));
    });
    await test('separate navigation survives import and changed targets fail audit', async h=>{
        const p=pkg('<h3>Heading</h3><p>Exact source.</p>');
        p.handout.navigation_html='<hr/><h2>Navigation</h2><ul><li>Related: <a href="https://journal.roll20.net/handout/-reference#exact-heading">EX 2.1 — Reference</a></li></ul>';
        p.handout.notes=p.handout.source_html+p.handout.navigation_html;h.set(p);const r=await h.send();verified(r);
        const obj=h.w.getObj('handout',r.objectId);obj.set('notes',obj._attrs.notes.replace('#exact-heading','#wrong-heading'));
        const before=snapshot(h.w);error(await h.send('preview'),/differs/);assert.strictEqual(snapshot(h.w),before);
    });
    await test('empty source oversized input and bad commands produce clear errors', async h=>{
        h.set(pkg(''));error(await h.send(),/Empty source/);h.set('x'.repeat(1000001));error(await h.send(),/size|exceeds/);
        h.trigger('overwrite anything');await h.drain();error(h.report(),/Use !d35journal/);
    });
    await test('unrelated Character token pin and Handout objects preserved', async h=>{
        const keep=[h.w.createObj('character',{name:'Keep'}),h.w.createObj('graphic',{pageid:'-MOCKPAGE',name:'Keep token'}),
            h.w.createObj('pin',{name:'Keep pin'}),h.w.createObj('handout',{name:'Keep reference'})];
        const before=keep.map(o=>o.toJSON());verified(await h.send());assert.deepStrictEqual(keep.map(o=>o.toJSON()),before);
        assert.strictEqual(h.w.findObjs({_type:'pin'}).length,1);
    });
    const arg=process.argv.indexOf('--package');
    if(arg!==-1) {
        await test('canonical Wrecked Wyvern package imports and survives normalized editor round-trip', async h=>{
            const data=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8'));
            assert.strictEqual(data.handout.name,'ToD 6.1 — The Wrecked Wyvern');
            assert.strictEqual((data.handout.source_html.match(/<p>/g)||[]).length,7);
            assert.strictEqual((data.handout.source_html.match(/<h3>/g)||[]).length,1);
            assert.ok(!data.handout.source_html.includes('<blockquote>'));
            h.set(data);const r=await h.send();verified(r);const obj=h.w.getObj('handout',r.objectId);
            assert.strictEqual(obj._attrs.notes,data.handout.notes);
            const expected=process.argv.indexOf('--expected-html');
            if(expected!==-1) assert.strictEqual(obj._attrs.notes,fs.readFileSync(process.argv[expected+1],'utf8'));
            obj.set('notes',obj._attrs.notes.replace(/<em>/g,'<i>').replace(/<\/em>/g,'</i>').replace(/<strong>/g,'<b>').replace(/<\/strong>/g,'</b>').replace('’','&#8217;'));
            const second=await h.send('preview');verified(second);assert.strictEqual(second.objectId,r.objectId);
        });
    }
    const storedArg=process.argv.indexOf('--stored-transfer');
    if(storedArg!==-1) {
        await test('actual captured Roll20 transfer markup imports the canonical package', async h=>{
            assert.notStrictEqual(arg,-1,'Supply --package for the captured transfer comparison');
            const expected=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8'));
            h.set(fs.readFileSync(process.argv[storedArg+1],'utf8'));
            const r=await h.send();verified(r);
            assert.strictEqual(h.w.getObj('handout',r.objectId)._attrs.notes,expected.handout.notes);
        });
    }
    console.log(JSON.stringify({status:'pass',tests:count,canonicalAcceptance:arg!==-1,mod:'v0.1.2'}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
