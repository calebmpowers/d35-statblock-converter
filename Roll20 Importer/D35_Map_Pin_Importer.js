/* D35 Map Pin Importer v0.1.0. Requires the existing D35 Journal Importer.
 * !d35pin preview|import|audit <GM-only transfer Handout name or ID>
 * Hidden heading pins only; no Handout writes, custom prose, moves or overwrites.
 */
var D35MapPinImporter = D35MapPinImporter || (function () {
    'use strict';
    var busy=false, LIMIT=1000000;
    var visibility=['visibleTo','tooltipVisibleTo','tooltipTitleVisibleTo','nameplateVisibleTo','imageVisibleTo','notesVisibleTo','gmNotesVisibleTo'];
    var settings={linkType:'handout',subLinkType:'headerPlayer',autoNotesType:'blockquote',notes:'',gmNotes:'',notesDesynced:false,gmNotesDesynced:false,imageDesynced:false};
    visibility.forEach(function(k) { settings[k]=''; });
    var appearance=['bgColor','shape','icon','pinImage','customizationType','useTextIcon','iconText','tooltipImageSize','tooltipImage','scale'];
    function check(ok,message) { if(!ok) { throw new Error(message); } }
    function own(o,k) { return Object.prototype.hasOwnProperty.call(o,k); }
    function fields(o,names) { check(o && typeof o==='object' && !Array.isArray(o) && Object.keys(o).sort().join('|')===names.slice().sort().join('|'),'Unexpected or missing plan fields.'); }
    function text(s) { check(typeof s==='string' && s && s===s.trim() && s.length<=240 && !/[\x00-\x1f]/.test(s),'Expected exact nonempty text.'); return s; }
    function id(s) { check(/^[-A-Za-z0-9_]+$/.test(text(s)),'Invalid explicit object ID.'); return s; }
    function api() { check(typeof D35JournalImporter!=='undefined' && typeof D35JournalImporter.semantic==='function' && typeof D35JournalImporter.sha256==='function','Install the existing D35 Journal Handout Importer v0.1 first.'); return D35JournalImporter; }
    function canonical(v) {
        if(Array.isArray(v)) { return '['+v.map(canonical).join(',')+']'; }
        if(v && typeof v==='object') { return '{'+Object.keys(v).sort().map(function(k) { return JSON.stringify(k)+':'+canonical(v[k]); }).join(',')+'}'; }
        return JSON.stringify(v);
    }
    function store() {
        if(!state.D35MapPinImporter) { state.D35MapPinImporter={version:1,pins:{},lastReport:null}; }
        var s=state.D35MapPinImporter;
        check(s.version===1 && s.pins && typeof s.pins==='object' && !Array.isArray(s.pins),'Unsupported pin state; preserve it for review.');
        return s;
    }
    function privateHandout(h) { check(h && h.get('inplayerjournals')==='' && h.get('controlledby')==='','Use a GM-only Handout without player editors.'); }
    function read(h,field) {
        return new Promise(function(resolve,reject) {
            var done=false,timer=setTimeout(function() { if(!done) { done=true;reject(new Error('Timed out reading '+field+'. No automatic repair.')); } },10000);
            try { h.get(field,function(v) { if(done) { return; } done=true;clearTimeout(timer); if(typeof v==='string') { resolve(v); } else { reject(new Error('Invalid Handout blob.')); } }); }
            catch(e) { if(!done) { done=true;clearTimeout(timer);reject(e); } }
        });
    }
    function transport(raw) {
        check(typeof raw==='string' && raw.length<=LIMIT,'Invalid or oversized pin transfer.'); raw=raw.trim();
        if(/^%(7b|3c)/i.test(raw)) { raw=decodeURIComponent(raw); }
        if(raw[0]==='<') {
            check(!/<\/?(?!p\b|div\b|span\b|pre\b|br\b)[a-z]/i.test(raw),'Unsupported transfer wrapper; paste plain JSON.');
            raw=raw.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|pre)>/gi,'\n').replace(/<[^>]*>/g,'');
            var entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
            raw=raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,function(all,k) {
                if(k[0]==='#') { var n=k[1].toLowerCase()==='x' ? parseInt(k.slice(2),16) : parseInt(k.slice(1),10);check(n>0 && n<=0x10ffff && !(n>=0xd800 && n<=0xdfff),'Invalid entity.');return String.fromCodePoint(n); }
                check(own(entities,k),'Unsupported transfer entity.');return entities[k];
            });
        }
        var normalized='',quoted=false,escaped=false;
        for(var i=0;i<raw.length;i++) { var c=raw[i]; normalized+=c==='\u00a0'&&!quoted?' ':c; if(escaped) { escaped=false; } else if(quoted&&c==='\\') { escaped=true; } else if(c==='"') { quoted=!quoted; } }
        return JSON.parse(normalized);
    }
    function validate(p) {
        api();fields(p,['schema','pin_id','page','x','y','title','plan']);
        check(p.schema==='d35-map-pin/0.1','Unsupported pin package schema.');
        check(typeof p.pin_id==='string' && /^[a-z0-9][a-z0-9._:-]{2,159}$/.test(p.pin_id),'Invalid stable pin_id.');
        fields(p.page,['id','name']);id(p.page.id);text(p.page.name);text(p.title);
        ['x','y'].forEach(function(k) { check(typeof p[k]==='number' && Number.isFinite(p[k]) && p[k]>=0,'Explicit finite nonnegative x and y coordinates are required.'); });
        fields(p.plan,['intent','status','properties']);check(p.plan.status==='resolved','Resolve the actual Handout ID before import.');
        var intent=p.plan.intent;
        fields(intent,['handout_title','heading','source_field','read_aloud_block_id','native_flavor_text','gm_only']);
        text(intent.handout_title);text(intent.heading);
        check(intent.source_field==='notes' && intent.native_flavor_text===true && intent.gm_only===true,'Only hidden Description & Notes heading pins with native extraction are supported.');
        check(intent.read_aloud_block_id===null || typeof intent.read_aloud_block_id==='string' && intent.read_aloud_block_id.length>0,'Invalid source read-aloud block ID.');
        var expected=Object.assign({},settings,{link:id(p.plan.properties && p.plan.properties.link),subLink:intent.heading});
        fields(p.plan.properties,Object.keys(expected));
        check(canonical(p.plan.properties)===canonical(expected),'Unsafe visibility, changed planner settings or custom tooltip text.');
        return {pkg:p,props:Object.assign({x:p.x,y:p.y,title:p.title},expected),fingerprint:api().sha256(canonical(p))};
    }
    function transfer(ref) {
        var h=getObj('handout',ref);
        if(!h) { var matches=findObjs({_type:'handout',name:ref});check(matches.length===1,'Transfer name missing or ambiguous; use its ID.');h=matches[0]; }
        privateHandout(h);return h;
    }
    function objects(data,input) {
        var p=data.pkg,page=getObj('page',p.page.id),h=getObj('handout',data.props.link);
        check(page && page.get('name')===p.page.name,'Page ID missing or exact page name differs.');
        var pages=findObjs({_type:'page',name:p.page.name});check(pages.length===1 && pages[0].id===page.id,'Page name is ambiguous.');
        check(h && h.id!==input.id && h.get('name')===p.plan.intent.handout_title,'Handout ID missing or exact title differs.');
        var matches=findObjs({_type:'handout',name:p.plan.intent.handout_title});check(matches.length===1 && matches[0].id===h.id,'Handout destination is ambiguous.');
        privateHandout(h);privateHandout(getObj('handout',input.id));
        return {page:page,handout:h};
    }
    async function destination(data,input) {
        var target=objects(data,input),html=await read(target.handout,'notes');objects(data,input);
        var tree=api().semantic(html),heading=data.pkg.plan.intent.heading;
        var indexes=[];tree.forEach(function(b,i) { if(/^h[1-6]$/.test(b[0]) && b[1].map(function(r) { return r[0]; }).join('')===heading) { indexes.push(i); } });
        check(indexes.length===1,'Heading missing or ambiguous in Description & Notes.');
        var quote=false;
        for(var i=indexes[0]+1;i<tree.length;i++) { if(/^h[1-6]$/.test(tree[i][0])) { break; } if(tree[i][0]==='blockquote') { quote=true;break; } }
        check(quote===(data.pkg.plan.intent.read_aloud_block_id!==null),'Source read-aloud presence differs from the planner. Review the source; no fallback text generated.');
        return {fingerprint:api().sha256(canonical(tree)),hasReadAloud:quote};
    }
    function choose(data,input) {
        objects(data,input);
        var p=data.pkg,s=store(),key='pin:'+p.pin_id,record=own(s.pins,key)?s.pins[key]:null;
        var atPosition=findObjs({_type:'pin'}).filter(function(pin) { return pin.get('_pageid')===p.page.id && pin.get('x')===p.x && pin.get('y')===p.y; });
        if(record) {
            check(record.fingerprint===data.fingerprint,'Stable pin ID already binds a different plan. No overwrite.');
            var pin=getObj('pin',record.objectId);check(pin,'Registered pin missing; no automatic replacement.');
            check(atPosition.length===1 && atPosition[0].id===pin.id,'Managed pin moved or position is ambiguous. No overwrite.');
            return {pin:pin,record:record};
        }
        check(!atPosition.length,'An unmanaged pin already occupies this position. Preserve it; choose an explicit unused position.');
        check(!Object.keys(s.pins).some(function(k) { var r=s.pins[k];return r.pageId===p.page.id && r.x===p.x && r.y===p.y; }),'Another managed identity reserves this position.');
        return null;
    }
    function snapshot(pin) {
        var out={};['_pageid','x','y','title','link','subLink'].concat(Object.keys(settings),appearance).forEach(function(k) { out[k]=pin.get(k); });return out;
    }
    function verify(pin,data,record,source) {
        check(getObj('pin',pin.id),'Pin disappeared during verification.');
        check(pin.get('_pageid')===data.pkg.page.id,'Stored pin page differs.');
        Object.keys(data.props).forEach(function(k) { check(pin.get(k)===data.props[k],'Stored pin property differs: '+k+'. No overwrite.'); });
        if(record) {
            check(record.sourceFingerprint===source.fingerprint,'Linked Handout content changed since import; review it.');
            check(canonical(snapshot(pin))===canonical(record.snapshot),'Manual pin changes detected. Pin preserved.');
        }
    }
    function report(r) {
        try { store().lastReport=r; } catch(e) { /* Preserve incompatible state. */ }
        var message=(r.status.toUpperCase()+': '+r.message).replace(/[\r\n]+/g,' ')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\[\]{}]/g,function(c) { return '&#'+c.charCodeAt(0)+';'; });
        sendChat('D35 Map Pin','/w gm '+message);
    }
    async function command(msg) {
        if(msg.type!=='api' || !/^!d35pin(?:\s|$)/.test(msg.content) || !playerIsGM(msg.playerid)) { return; }
        if(busy) { report({status:'error',message:'Pin command in progress; wait for its report.'});return; }
        var m=/^!d35pin\s+(preview|import|audit)\s+(.+?)\s*$/.exec(msg.content);
        if(!m) { report({status:'error',message:'Use !d35pin preview|import|audit TRANSFER (exact name or ID).'});return; }
        busy=true;var created=null;
        try {
            var input=transfer(m[2]),data=validate(transport(await read(input,'gmnotes'))),source=await destination(data,input);
            var chosen=choose(data,input),p=data.pkg,key='pin:'+p.pin_id;
            if(chosen) {
                verify(chosen.pin,data,chosen.record,source);
                report({status:'verified',action:'preserve',pinId:chosen.pin.id,pin_id:p.pin_id,hasReadAloud:source.hasReadAloud,
                    message:'Verified existing pin '+p.title+' ['+chosen.pin.id+']; no pin or Handout writes.'});
            } else if(m[1]==='audit') { throw new Error('No managed pin for this plan; audit never creates objects.'); }
            else if(m[1]==='preview') {
                report({status:'preview',action:'create',pin_id:p.pin_id,hasReadAloud:source.hasReadAloud,
                    message:'Would create hidden pin '+p.title+' on '+p.page.name+' at x='+p.x+', y='+p.y+' linked to '+p.plan.intent.handout_title+' / '+p.plan.intent.heading+'. '+(source.hasReadAloud?'Native blockquote extraction enabled.':'No source blockquote; no invented flavor text.')});
            } else {
                check(!choose(data,input),'Position changed during import. Retry preview.');
                var pin=createObj('pin',Object.assign({pageid:p.page.id},data.props));check(pin && pin.id,'Pin creation failed.');created=pin.id;
                var record={objectId:pin.id,fingerprint:data.fingerprint,sourceFingerprint:source.fingerprint,pageId:p.page.id,x:p.x,y:p.y,status:'pending',snapshot:snapshot(pin)};
                store().pins[key]=record;
                // Native rendering/extraction remains Roll20's responsibility.
                var finalSource=await destination(data,input);choose(data,input);verify(pin,data,record,finalSource);
                record.status='verified';
                report({status:'verified',action:'created',pinId:pin.id,pin_id:p.pin_id,hasReadAloud:source.hasReadAloud,
                    message:'Created and read-back verified hidden pin '+p.title+' ['+pin.id+']; exact page, coordinates, Handout, heading, native settings and visibility passed.'});
            }
        } catch(e) { report({status:'error',pinId:created,message:String(e.message||e)+(created?' Pin ['+created+'] retained and identity reserved; no automatic replacement.':'')}); }
        finally { busy=false; }
    }
    on('ready',function() { on('chat:message',command);log('D35 Map Pin Importer v0.1.0 ready.'); });
    return {validate:validate};
}());
