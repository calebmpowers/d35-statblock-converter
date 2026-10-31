/* D35 Journal Handout Importer v0.1.2. No Character, pin or folder writes.
 * Commands: !d35journal preview|import|audit <exact transfer Handout name or ID>
 * Persistent identity, create-or-verify only. No adoption, overwrite, or deletion.
 */
var D35JournalImporter = D35JournalImporter || (function () {
    'use strict';
    var busy = false, LIMIT = 1000000;
    function check(ok, message) { if (!ok) { throw new Error(message); } }
    function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function escape(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\[\]{}]/g,function(c) { return '&#'+c.charCodeAt(0)+';'; }); }
    function fields(o, required) {
        check(o && typeof o === 'object' && !Array.isArray(o), 'Expected object.');
        check(Object.keys(o).sort().join('|') === required.slice().sort().join('|'), 'Unexpected or missing package fields.');
    }
    function string(s) { check(typeof s === 'string' && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s), 'Invalid text.'); return s; }
    function store() {
        if (!state.D35JournalImporter) { state.D35JournalImporter = { version: 1, journals: {}, lastReport: null }; }
        var s = state.D35JournalImporter;
        check(s.version === 1 && s.journals && typeof s.journals === 'object' && !Array.isArray(s.journals), 'Unsupported Journal state; preserve for review.');
        return s;
    }
    // SHA-256 over UTF-8; no external libraries required in the Mod sandbox.
    function sha256(value) {
        var bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g,function(all,hex) { return String.fromCharCode(parseInt(hex,16)); }), words = [], i, j;
        var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
        var k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
        function rr(n, b) { return (n >>> b) | (n << (32-b)); }
        for (i=0; i<bytes.length; i++) { words[i>>2] = (words[i>>2] || 0) | bytes.charCodeAt(i) << (24-(i%4)*8); }
        words[bytes.length>>2] = (words[bytes.length>>2] || 0) | 0x80 << (24-(bytes.length%4)*8);
        var end = (((bytes.length+8)>>6)+1)*16;
        words[end-1] = bytes.length*8; words[end-2] = 0;
        for (i=0; i<end; i+=16) {
            var w=[], v=h.slice();
            for (j=0; j<64; j++) {
                w[j] = j<16 ? words[i+j] | 0 : ((rr(w[j-2],17)^rr(w[j-2],19)^(w[j-2]>>>10)) + w[j-7] +
                    (rr(w[j-15],7)^rr(w[j-15],18)^(w[j-15]>>>3)) + w[j-16]) | 0;
                var t = (v[7] + (rr(v[4],6)^rr(v[4],11)^rr(v[4],25)) + ((v[4]&v[5])^(~v[4]&v[6])) + k[j] + w[j]) | 0;
                var u = ((rr(v[0],2)^rr(v[0],13)^rr(v[0],22)) + ((v[0]&v[1])^(v[0]&v[2])^(v[1]&v[2]))) | 0;
                v = [(t+u)|0,v[0],v[1],v[2],(v[3]+t)|0,v[4],v[5],v[6]];
            }
            h = h.map(function (n, q) { return (n+v[q])|0; });
        }
        return h.map(function (n) { return ('00000000'+(n>>>0).toString(16)).slice(-8); }).join('');
    }
    function entities(s) {
        var named = { amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…' };
        return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, function (all, key) {
            if (key[0] === '#') {
                var n = key[1].toLowerCase()==='x' ? parseInt(key.slice(2),16) : parseInt(key.slice(1),10);
                check(n>0 && n<=0x10ffff && !(n>=0xd800 && n<=0xdfff), 'Invalid entity.');
                return String.fromCodePoint(n);
            }
            check(own(named,key), 'Unsupported HTML entity: '+all);
            return named[key];
        });
    }
    function attrs(raw) {
        var result={}, rest=raw, m;
        while (rest.trim()) {
            m = /^\s+([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(rest);
            check(m, 'Malformed HTML attributes.');
            var key=m[1].toLowerCase(), value=entities(m[2]===undefined ? m[3]===undefined ? m[4] : m[3] : m[2]);
            check(!own(result,key), 'Duplicate HTML attribute.'); result[key]=value; rest=rest.slice(m[0].length);
            check(/^(?:href|style|class|id|dir|title|target|rel|data-[\w-]+)$/.test(key), 'Unsupported HTML attribute: '+key);
            if (key==='href') { check(/^https?:\/\/journal\.roll20\.net\/handout\/[-\w]+(?:#[^\s<>]*)?$/.test(value), 'Unsafe or unsupported navigation URL.'); }
        }
        return result;
    }
    function styles(a, inherited) {
        var flags=Object.assign({},inherited);
        if (a.style) {
            a.style.split(';').filter(function (x) { return x.trim(); }).forEach(function (rule) {
                var m=/^\s*([\w-]+)\s*:\s*([^<>]+?)\s*$/.exec(rule);
                check(m && !/url\s*\(|expression|!important/i.test(m[2]), 'Unsupported HTML style.');
                var prop=m[1].toLowerCase(), val=m[2].toLowerCase();
                if (prop==='font-weight') { check(/^(normal|bold|400|700)$/.test(val),'Unsupported font weight.'); flags.bold=/^(bold|700)$/.test(val); }
                else if (prop==='font-style') { check(/^(normal|italic)$/.test(val),'Unsupported font style.'); flags.italic=val==='italic'; }
                else { check(/^(font-family|font-size|color|background-color|line-height|text-align)$/.test(prop), 'Unsupported HTML style: '+prop); }
            });
        }
        if (a.href) { flags.href=a.href; }
        return flags;
    }
    // Strict HTML subset, not a browser parser. Unknown/invalid markup fails closed.
    // Semantic output preserves blocks and every non-layout character with marks.
    function semantic(html) {
        string(html); check(html.length<=LIMIT, 'HTML exceeds size limit.');
        if (/^%3c/i.test(html.trim())) { html=decodeURIComponent(html.trim()); }
        var root={tag:'root',children:[],a:{}}, stack=[root], pos=0;
        var token=/<!--[\s\S]*?-->|<\/?[a-z][^>]*>|[^<]+/gi, match;
        var allowed=/^(p|h[1-6]|blockquote|table|tbody|thead|tfoot|tr|td|th|ul|ol|li|hr|br|strong|b|em|i|sup|sub|span|a|div)$/;
        while ((match=token.exec(html))) {
            check(match.index===pos, 'Malformed HTML.'); pos=token.lastIndex;
            var value=match[0], parent=stack[stack.length-1];
            if (value.startsWith('<!--')) { continue; }
            if (value[0]!=='<') { parent.children.push(entities(value)); continue; }
            var m=/^<(\/)?([a-z][\w]*)([\s\S]*?)>$/i.exec(value);
            check(m && allowed.test(m[2].toLowerCase()), 'Unsupported HTML tag.');
            var tag=m[2].toLowerCase();
            if (m[1]) {
                check(!m[3].trim() && stack.length>1 && parent.tag===tag, 'Unbalanced HTML.'); stack.pop();
            } else {
                var a=attrs(m[3].replace(/\/\s*$/, ''));
                check(!a.href || tag==='a', 'Link attribute outside anchor.');
                var node={tag:tag,a:a,children:[]}; parent.children.push(node);
                if (tag!=='br' && tag!=='hr') { check(!/\/\s*$/.test(m[3]), 'Unsupported self-closing element.'); stack.push(node); }
            }
        }
        check(pos===html.length && stack.length===1, 'Unbalanced or malformed HTML.');
        function content(children, inherited) {
            var chars=[];
            function walk(nodes, flags) {
                nodes.forEach(function (n) {
                    if (typeof n==='string') {
                        Array.from(n).forEach(function (c) {
                            var space=/^[ \t\r\n\f\u00a0]$/.test(c);
                            if (space && (!chars.length || chars[chars.length-1][0]===' ')) { return; }
                            chars.push([space ? ' ' : c, space ? '' : JSON.stringify([!!flags.bold,!!flags.italic,!!flags.sup,!!flags.sub,flags.href || ''])]);
                        });
                    } else {
                        check(/^(span|strong|b|em|i|sup|sub|a|br)$/.test(n.tag), 'Block changed into inline content or invalid nesting.');
                        var next=Object.assign({},flags);
                        if (/^(strong|b)$/.test(n.tag)) { next.bold=true; }
                        if (/^(em|i)$/.test(n.tag)) { next.italic=true; }
                        if (n.tag==='sup' || n.tag==='sub') { next[n.tag]=true; }
                        next=styles(n.a,next);
                        if (n.tag==='br') { chars.push(['\n','br']); } else { walk(n.children,next); }
                    }
                });
            }
            walk(children,inherited);
            while (chars.length && chars[chars.length-1][0]===' ') { chars.pop(); }
            var merged=[];
            chars.forEach(function (c) { var last=merged[merged.length-1]; if(last && last[1]===c[1]) { last[0]+=c[0]; } else { merged.push(c.slice()); } });
            return merged;
        }
        function blocks(children, parent, inherited) {
            var out=[];
            children.forEach(function (n) {
                if (typeof n==='string') { check(!n.trim(), 'Text outside paragraph.'); return; }
                var flags=styles(n.a,inherited);
                if (n.tag==='div' && parent==='root') { out=out.concat(blocks(n.children,'root',flags)); return; }
                if (/^(tbody|thead|tfoot)$/.test(n.tag) && parent==='table') { out=out.concat(blocks(n.children,'table',flags)); return; }
                var grammar={root:/^(p|h[1-6]|blockquote|table|ul|ol|hr)$/,blockquote:/^(p|h[1-6]|table|ul|ol)$/,table:/^tr$/,tr:/^(th|td)$/,ul:/^li$/,ol:/^li$/};
                check(own(grammar,parent) && grammar[parent].test(n.tag), 'Invalid block nesting.');
                if (/^(p|h[1-6]|li)$/.test(n.tag)) { out.push([n.tag,content(n.children,flags)]); }
                else if (n.tag==='th' || n.tag==='td') {
                    // Formatter cells contain paragraphs. Do not flatten them.
                    out.push([n.tag,blocks(n.children,'root',flags)]);
                } else { out.push([n.tag,blocks(n.children,n.tag==='hr' ? 'root' : n.tag,flags)]); }
            });
            return out;
        }
        return blocks(root.children,'root',{});
    }
    function equivalent(a,b) { return JSON.stringify(semantic(a))===JSON.stringify(semantic(b)); }
    function emptyBlob(s) {
        if (/^%3c/i.test(s.trim())) { s=decodeURIComponent(s.trim()); }
        // Roll20 reloads a persisted empty Handout blob as the string "null".
        // This exception applies only to expected-empty GM Notes, never source.
        if (s==='null') { return true; }
        if (!s.trim()) { return true; }
        // Empty rich-editor paragraph is harmless; any text or substantive tag fails.
        return /^(?:\s|<\/?(?:p|div|span)>|<br\s*\/?>|&nbsp;)*$/i.test(s);
    }
    function validate(pkg) {
        fields(pkg,own(pkg,'filing') ? ['schema','journal_id','handout','filing'] : ['schema','journal_id','handout']);
        check(pkg.schema==='d35-journal/0.1', 'Unsupported Journal package schema.');
        check(/^[a-z0-9][a-z0-9._:-]{2,159}$/.test(string(pkg.journal_id)), 'Invalid stable journal_id.');
        var h=pkg.handout;
        fields(h,['name','notes','gmnotes','inplayerjournals','controlledby','source_html','navigation_html','source_sha256']);
        Object.keys(h).forEach(function(k) { string(h[k]); });
        check(h.name.trim()===h.name && h.name.length>0 && h.name.length<=240 && !/[\r\n]/.test(h.name), 'Invalid exact Handout title.');
        check(h.gmnotes==='' && h.inplayerjournals==='' && h.controlledby==='', 'Package must be GM-only with empty GM Notes.');
        check(h.notes===h.source_html+h.navigation_html, 'Notes differ from source plus navigation.');
        check(sha256(h.source_html)===h.source_sha256, 'Source SHA-256 mismatch.');
        var source=semantic(h.source_html), whole=semantic(h.notes);
        check(source.length>0, 'Empty source.');
        semantic(h.navigation_html);
        // Store a content identity independent of harmless serialization changes.
        if (own(pkg,'filing')) { validateFiling(pkg.filing); }
        return { pkg:pkg, expected:whole, fingerprint:sha256(JSON.stringify([pkg.journal_id,h.name,whole])) };
    }
    function validateFiling(p) {
        fields(p,['kind','folder_path','folder_ids','legacy_source','authority']);
        check(p.kind==='gm_adventure','GM runtime filing cannot target Player Handouts.');
        function location(names,ids,min) {
            check(Array.isArray(names)&&Array.isArray(ids)&&names.length>=min&&names.length<=12&&names.length===ids.length,'Supply exact existing folder names and IDs.');
            names.forEach(function(n){check(typeof n==='string'&&n&&n===n.trim()&&n.length<=240&&!/[\x00-\x1f]/.test(n),'Invalid folder name.');});
            ids.forEach(function(id){check(typeof id==='string'&&/^[-A-Za-z0-9_]+$/.test(id),'Invalid folder ID.');});
        }
        location(p.folder_path,p.folder_ids,3);
        check(p.folder_path[0]==='Savage Tide Adventure Path','Use the established GM adventure root.');
        check(typeof p.authority==='string'&&p.authority&&p.authority===p.authority.trim()&&p.authority.length<=4000&&!/[\x00-\x1f]/.test(p.authority),'Supply approval/organization authority.');
        if(p.legacy_source!==null) {
            var old=p.legacy_source;fields(old,['handout_id','folder_path','folder_ids']);
            check(typeof old.handout_id==='string'&&/^[-A-Za-z0-9_]+$/.test(old.handout_id),'Invalid legacy Handout ID.');
            location(old.folder_path,old.folder_ids,0);
            check(!old.folder_path.length||['Savage Tide Adventure Path','Savage Tide Player Handouts'].indexOf(old.folder_path[0])===-1,'Legacy migration cannot reorganize existing adventure or Player Handout placement.');
        }
    }
    function filingFingerprint(p) {return sha256(JSON.stringify([p.kind,p.folder_path,p.folder_ids,p.legacy_source&&[p.legacy_source.handout_id,p.legacy_source.folder_path,p.legacy_source.folder_ids],p.authority]));}
    function filing(data,obj) {
        var p=data.pkg.filing,record=store().journals['journal:'+data.pkg.journal_id];
        if(!p) {
            check(!record||!record.filing,'Retain the bound filing plan; it cannot be removed silently.');
            return {contentVerified:!!obj,filed:false,handoutId:obj&&obj.id,folderPath:null,folderIds:null,sourceFolderPath:[],sourceFolderIds:[]};
        }
        // Reuse the existing image publisher's generic read-only folder resolver.
        check(typeof D35ImageAssetPublisher!=='undefined'&&typeof D35ImageAssetPublisher.folders==='function','Install the existing Image Asset Publisher for shared read-only Journal folder resolution.');
        var location=D35ImageAssetPublisher.folders(p.folder_path,obj&&obj.id),old=p.legacy_source;
        check(JSON.stringify(location.ids)===JSON.stringify(p.folder_ids),'Destination folder identity changed; no guessing or reorganization.');
        check(!record||!record.filing||record.filing.fingerprint===filingFingerprint(p),'Bound filing plan changed; existing placement preserved.');
        if(old) {
            check(obj&&obj.id===old.handout_id,'Legacy migration requires the exact existing managed Handout; no creation or adoption.');
        }
        var refs=location.references;
        check(refs.length<=1,'Duplicate Journal references; preserve for review.');
        var filed=!!obj&&refs.length===1&&JSON.stringify(refs[0])===JSON.stringify(p.folder_path);
        var sourcePath=old?old.folder_path:[],sourceIds=old?old.folder_ids:[];
        if(obj&&!filed) {
            check(!record||!record.filing||record.filing.status!=='verified','Previously filed Handout was manually moved; no automatic reorganization.');
            if(old&&old.folder_path.length) {check(JSON.stringify(D35ImageAssetPublisher.folders(old.folder_path).ids)===JSON.stringify(old.folder_ids),'Legacy source folder identity changed.');}
            check(JSON.stringify(refs.length?refs[0]:[])===JSON.stringify(sourcePath),'Unexpected manual placement; no automatic move.');
        }
        return {contentVerified:!!obj,filed:filed,handoutId:obj&&obj.id,folderPath:p.folder_path,folderIds:location.ids,sourceFolderPath:sourcePath,sourceFolderIds:sourceIds};
    }
    function completedReport(data,obj,action,command) {
        var evidence=filing(data,obj),record=store().journals['journal:'+data.pkg.journal_id];
        if(command!=='preview') {
            record.status=evidence.filed?'verified':'pending_filing';
            if(data.pkg.filing) {record.filing={fingerprint:filingFingerprint(data.pkg.filing),status:record.status,folderIds:evidence.folderIds,folderPath:evidence.folderPath};}
        }
        return {status:evidence.filed?'verified':'pending_filing',kind:'gm_adventure',action:action,objectId:obj.id,journal_id:data.pkg.journal_id,evidence:evidence,
            message:'Verified '+data.pkg.handout.name+' ['+obj.id+']: source text, formatting, headings, navigation, empty GM Notes and GM-only permissions. '+
                (evidence.filed?'Exact Journal folder verified.':'PUBLICATION INCOMPLETE: '+(data.pkg.filing?'native UI filing into '+evidence.folderPath.join(' / ')+' is pending.':'supply an approved existing adventure/Part filing plan.'))+
                (action==='preserve'?' No Handout writes.':'')};
    }
    function privateHandout(obj) { check(obj && obj.get('inplayerjournals')==='' && obj.get('controlledby')==='', 'Transfer Handout must be GM-only, with no player editors.'); }
    function read(obj, field) {
        return new Promise(function(resolve,reject) {
            var done=false, timer=setTimeout(function() { if(!done) { done=true; reject(new Error('Timed out reading '+field+' from '+obj.id+'. Object preserved; retry verification.')); } },10000);
            try { obj.get(field,function(value) {
                if(done) { return; }
                done=true; clearTimeout(timer);
                try { resolve(string(value)); } catch(e) { reject(e); }
            }); }
            catch(e) { if(!done) { done=true; clearTimeout(timer); reject(e); } }
        });
    }
    function transport(raw) {
        raw=string(raw).trim(); check(raw && raw.length<=LIMIT, 'Transfer JSON empty or exceeds 1,000,000 characters.');
        if (/^%(?:7b|3c)/i.test(raw)) { raw=decodeURIComponent(raw); }
        if (raw[0]==='<') {
            // JSON pasted through a rich editor is entity-escaped exactly once.
            // Only transport wrappers are removed, never tags from raw JSON.
            check(!/<\/?(?!p\b|div\b|span\b|pre\b|br\b)[a-z]/i.test(raw), 'Unsupported transfer wrapper; paste plain JSON.');
            raw=entities(raw.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|pre)>/gi,'\n').replace(/<[^>]*>/g,''));
        }
        // The rich editor preserves JSON indentation with NBSP. JSON.parse
        // rejects that character outside strings; source string values must
        // remain byte-for-byte unchanged for their checksum verification.
        var quoted=false, escaped=false, normalized='';
        for (var i=0; i<raw.length; i++) {
            var c=raw[i];
            normalized += c==='\u00a0' && !quoted ? ' ' : c;
            if (escaped) { escaped=false; }
            else if (quoted && c==='\\') { escaped=true; }
            else if (c==='"') { quoted=!quoted; }
        }
        return JSON.parse(normalized);
    }
    function transfer(reference) {
        var obj=getObj('handout',reference);
        if (!obj) { var list=findObjs({_type:'handout',name:reference}); check(list.length===1,'Transfer name missing or ambiguous; use its exact ID.'); obj=list[0]; }
        privateHandout(obj); return obj;
    }
    function choose(data, input) {
        var s=store(), h=data.pkg.handout, key='journal:'+data.pkg.journal_id;
        var names=findObjs({_type:'handout',name:h.name});
        check(names.length<=1,'Ambiguous destination title. Existing Handouts preserved.');
        var record=own(s.journals,key) ? s.journals[key] : null;
        if (record) {
            check(record.fingerprint===data.fingerprint && record.title===h.name, 'Stable key already binds a different package. No overwrite.');
            var obj=getObj('handout',record.objectId);
            check(obj,'Registered Handout missing; no automatic replacement. Preserve identity record for review.');
            check(obj.id!==input.id && obj.get('name')===h.name && names.length===1 && names[0].id===obj.id,'Registered destination identity/title conflict.');
            return obj;
        }
        check(names.length===0,'Destination title already exists but is unmanaged. No adoption or overwrite.');
        check(!Object.keys(s.journals).some(function(k) { return s.journals[k].title===h.name; }), 'Another stable key already owns this title.');
        return null;
    }
    function metadata(obj,h) {
        var live=getObj('handout',obj.id);
        check(live && live.id===obj.id,'Destination disappeared during verification.');
        check(obj.get('name')===h.name,'Destination title changed.');
        check(obj.get('inplayerjournals')==='' && obj.get('controlledby')==='', 'Destination permission mismatch. Object preserved for review.');
    }
    async function verify(obj,data) {
        metadata(obj,data.pkg.handout);
        var blobs=await Promise.all([read(obj,'notes'),read(obj,'gmnotes')]);
        metadata(obj,data.pkg.handout);
        check(JSON.stringify(semantic(blobs[0]))===JSON.stringify(data.expected),'Stored source text, formatting, structure, or navigation differs. Object preserved for review.');
        check(emptyBlob(blobs[1]),'Stored GM Notes are not empty. Object preserved for review.');
    }
    function explicitTarget(data,input,id) {
        check(data.pkg.filing && data.pkg.filing.legacy_source===null,'Folder-first target requires an approved destination without legacy migration.');
        check(!Object.keys(store().journals).some(function(k){return store().journals[k].objectId===id;}),'Target already has a managed identity; no adoption.');
        var obj=getObj('handout',id);
        check(obj && obj.id!==input.id,'Explicit target Handout missing or is the transfer.');
        var h=data.pkg.handout,names=findObjs({_type:'handout',name:h.name});
        check(names.length===1 && names[0].id===id,'Explicit target title missing or ambiguous.');
        metadata(obj,h);
        ['archived','avatar','tags','_tags'].forEach(function(field){
            var value=obj.get(field),emptyTags=(field==='tags'||field==='_tags') && (value==='[]'||Array.isArray(value)&&value.length===0);
            check(!value || emptyTags,'Target is not pristine: '+field+'='+JSON.stringify(value)+'.');
        });
        check(emptyBlob(obj.get('_pins')) || obj.get('_pins')==='[]','Target has pin references.');
        check(findObjs({_type:'pin',link:id}).length===0,'Target already has a linked pin.');
        check(filing(data,obj).filed,'Explicit target is not in the exact approved folder.');
        return obj;
    }
    async function pristineTarget(data,input,id) {
        var obj=explicitTarget(data,input,id);
        var first=await Promise.all([read(obj,'notes'),read(obj,'gmnotes')]);
        explicitTarget(data,input,id);
        check(first.every(emptyBlob),'Explicit target contains content; no overwrite.');
        var second=await Promise.all([read(obj,'notes'),read(obj,'gmnotes')]);
        explicitTarget(data,input,id);
        check(JSON.stringify(first)===JSON.stringify(second) && second.every(emptyBlob),'Explicit target changed during preflight; no overwrite.');
        return obj;
    }
    function report(value) {
        try { store().lastReport=value; } catch(e) { /* Never replace incompatible state. */ }
        log('D35_JOURNAL_REPORT '+JSON.stringify(value));
        sendChat('D35 Journal','/w gm '+escape(value.status.toUpperCase()+': '+value.message).replace(/[\r\n]+/g,' '));
    }
    async function command(msg) {
        if (msg.type!=='api' || !/^!d35journal(?:\s|$)/.test(msg.content)) { return; }
        if (!playerIsGM(msg.playerid)) { return; }
        var m=/^!d35journal\s+(preview|import|audit)\s+(.+?)(?:\s+--target\s+([-A-Za-z0-9_]+))?(?:\s+--request\s+([-A-Za-z0-9_.:]{1,80}))?\s*$/.exec(msg.content);
        if(!m) { report({status:'error',message:'Use !d35journal preview|import|audit TRANSFER [--target HANDOUT_ID] [--request NONCE].'}); return; }
        function emit(value) {value.operation=m[1];value.transferReference=m[2];value.requestId=m[4]||null;report(value);}
        if (busy) { emit({status:'error',message:'Journal command in progress; wait for its report.'}); return; }
        busy=true;
        var createdId=null, journalKey=null;
        try {
            var input=transfer(m[2]), data=validate(transport(await read(input,'gmnotes')));
            privateHandout(getObj('handout',input.id));
            var h=data.pkg.handout, existing=store().journals['journal:'+data.pkg.journal_id];
            if(m[3] && !existing) {
                check(m[1]!=='audit','Explicit target is unmanaged; audit never populates.');
                // Resolve ordinary key/title conflicts without adopting a title match.
                check(!Object.keys(store().journals).some(function(k){return store().journals[k].title===h.name;}),'Another managed identity owns this title.');
                var target=await pristineTarget(data,input,m[3]);
                if(m[1]==='preview') {emit({status:'preview',action:'populate',objectId:target.id,kind:'gm_adventure',message:'Would populate pristine folder-first Handout ['+target.id+']; exact folder and private permissions verified. No writes or identity reservation.'});return;}
                privateHandout(getObj('handout',input.id));explicitTarget(data,input,m[3]);
                journalKey='journal:'+data.pkg.journal_id;
                store().journals[journalKey]={objectId:target.id,title:h.name,fingerprint:data.fingerprint,status:'pending',folderFirst:true};
                createdId=target.id; // Reserve before blob writes; retain on any failure.
                target.set('notes',h.notes);target.set('gmnotes','');
                await verify(target,data);
                privateHandout(getObj('handout',input.id));choose(data,input);
                emit(completedReport(data,target,'populated',m[1]));return;
            }
            if(m[3]) {check(existing.folderFirst===true && existing.objectId===m[3],'Explicit target conflicts with an existing managed identity.');}
            var obj=choose(data,input);
            if (obj) {
                await verify(obj,data);
                // Check collisions/permissions again after asynchronous blob reads.
                privateHandout(getObj('handout',input.id)); choose(data,input);
                emit(completedReport(data,obj,'preserve',m[1]));
            } else if(m[1]==='preview') {
                filing(data,null);
                emit({status:'preview',action:'create',journal_id:data.pkg.journal_id,
                    message:'Would create '+h.name+' as GM-only. Source checksum and HTML validated. Native filing remains required. No destination created.'});
            } else {
                check(m[1]==='import','No managed Handout to audit; audit never creates.');
                filing(data,null);
                // Synchronous recheck immediately before creation; do not rely on preview.
                privateHandout(getObj('handout',input.id)); check(!choose(data,input),'Destination appeared during import; retry verification.');
                obj=createObj('handout',{name:h.name,inplayerjournals:'',controlledby:''});
                check(obj && obj.id,'Handout creation failed.'); createdId=obj.id;
                journalKey='journal:'+data.pkg.journal_id;
                store().journals[journalKey]={objectId:obj.id,title:h.name,fingerprint:data.fingerprint,status:'pending'};
                // Blob writes must happen after creation, in separate calls.
                obj.set('notes',h.notes); obj.set('gmnotes','');
                await verify(obj,data);
                privateHandout(getObj('handout',input.id)); choose(data,input);
                emit(completedReport(data,obj,'created',m[1]));
            }
        } catch(e) {
            emit({status:'error',objectId:createdId,message:String(e.message || e)+(createdId ? (m[3]?' Target Handout [':' Created object [')+createdId+'] retained; identity reserved. No retry will overwrite it or create a duplicate.' : '')});
        } finally { busy=false; }
    }
    on('ready',function() { on('chat:message',command); log('D35 Journal Handout Importer v0.1.2 ready (create-or-verify; native folder-first targets).'); });
    return { semantic:semantic,equivalent:equivalent,validate:validate,sha256:sha256 };
}());
