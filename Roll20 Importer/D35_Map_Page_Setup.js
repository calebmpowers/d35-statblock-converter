/* D35 Map Page Setup v0.1.0. Requires the existing Journal importer's SHA-256 helper.
 * !d35map bind|preview|import|audit GM_TRANSFER_NAME_OR_ID
 * No page creation, uploads, reveal, lighting geometry, pins, or encounter tokens.
 */
var D35MapPageSetup = D35MapPageSetup || (function () {
    'use strict';
    var busy=false;
    var required=['width','height','scale_number','scale_units','grid_type','snapping_increment','showgrid','grid_offset_x','grid_offset_y'];
    var optional=['diagonaltype','grid_opacity','gridcolor','gridlabels','background_color'];
    var placement=['width','height','left','top','rotation','layer','fliph','flipv'];
    var numeric=['width','height','left','top','rotation','scale_number','snapping_increment','grid_offset_x','grid_offset_y','grid_opacity'];
    var graphicFields=['_pageid','layer','width','height','left','top','rotation','fliph','flipv','name','represents','controlledby',
        'isdrawing','showname','showplayers_name','show_tooltip','tooltip','gm_only_tooltip','sides','statusmarkers','tint_color',
        'aura1_radius','aura2_radius','lockMovement','baseOpacity','bar1_link','bar2_link','bar3_link','bar1_value','bar2_value','bar3_value'];
    function check(ok,s) { if(!ok) { throw new Error(s); } }
    function own(o,k) { return Object.prototype.hasOwnProperty.call(o,k); }
    function fields(o,allowed,mandatory) {
        check(o && typeof o==='object' && !Array.isArray(o),'Expected a specification object.');
        check(Object.keys(o).every(function(k){return allowed.indexOf(k)!==-1;}) && (mandatory||allowed).every(function(k){return own(o,k);}), 'Unexpected or missing specification fields.');
    }
    function text(v,label,max) { check(typeof v==='string' && v && v===v.trim() && v.length<=(max||240) && !/[\x00-\x1f]/.test(v),'Invalid '+label+'.'); return v; }
    function id(v) { check(/^[-A-Za-z0-9_]+$/.test(text(v,'explicit object identity')),'Invalid object identity.');return v; }
    function number(v,label,positive,integer) { check(typeof v==='number' && Number.isFinite(v) && (positive?v>0:v>=0) && v<=1000000 && (!integer||Number.isInteger(v)),'Invalid explicit '+label+'.'); }
    function canonical(v) {
        if(Array.isArray(v)) { return '['+v.map(canonical).join(',')+']'; }
        if(v && typeof v==='object') { return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}'; }
        return JSON.stringify(v);
    }
    function hash(v) { check(typeof D35JournalImporter!=='undefined' && typeof D35JournalImporter.sha256==='function','Install the existing D35 Journal importer first.');return D35JournalImporter.sha256(canonical(v)); }
    function equal(a,b) { return canonical(a)===canonical(b); }
    function close(a,b) { return Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b)); }
    function validate(p) {
        fields(p,['schema','setup_id','title','source','target','image','page_settings','placement','crop','visibility']);
        check(p.schema==='d35-map-page/0.1','Unsupported map-page package schema.');
        check(typeof p.setup_id==='string' && /^[a-z0-9][a-z0-9._:-]{2,159}$/.test(p.setup_id),'Invalid stable setup_id.');
        text(p.title,'map title');check(p.crop==='full','Runtime crop is unsupported; use the exact approved full image.');
        check(p.visibility==='gm_only','v0.1 only supports pages kept off all player assignments.');
        var s=p.source;fields(s,['asset_id','filename','url','pixel_width','pixel_height','columns','rows','distance_per_cell','units','authority']);
        id(s.asset_id);text(s.filename,'approved filename');text(s.url,'canonical source URL',2000);check(/^https:\/\//.test(s.url),'Use a canonical HTTPS asset reference.');
        text(s.authority,'specification and placement authority',4000);text(s.units,'source units',20);
        ['pixel_width','pixel_height','columns','rows'].forEach(function(k){number(s[k],'source '+k,true,true);});number(s.distance_per_cell,'source cell distance',true);
        fields(p.target,['id','name']);if(p.target.id!==null) { id(p.target.id); } text(p.target.name,'exact existing page name');
        fields(p.image,['mode','graphic_id']);check(['configure','copy'].indexOf(p.image.mode)!==-1,'Unsupported image operation.');if(p.image.graphic_id!==null) { id(p.image.graphic_id); }
        var a=p.page_settings;fields(a,required.concat(optional),required);
        ['width','height'].forEach(function(k){number(a[k],'page '+k,true,true);});
        ['scale_number','snapping_increment'].forEach(function(k){number(a[k],k,true);});
        ['grid_offset_x','grid_offset_y'].forEach(function(k){number(a[k],k);check(a[k]===0,'Nonzero grid offsets need separate live verification; v0.1 refuses them.');});
        check(a.grid_type==='square','v0.1 supports square grids only.');check(typeof a.showgrid==='boolean','Supply explicit grid visibility.');
        text(a.scale_units,'page scale units',20);check(a.scale_units===s.units && close(a.scale_number*a.snapping_increment,s.distance_per_cell),'Page distance/snapping differs from the approved source scale.');
        if(own(a,'gridlabels')) { check(typeof a.gridlabels==='boolean','Invalid gridlabels.'); }
        if(own(a,'grid_opacity')) { number(a.grid_opacity,'grid opacity');check(a.grid_opacity<=1,'Invalid grid opacity.'); }
        if(own(a,'diagonaltype')) { check(['foure','pythagorean','threefive','manhattan'].indexOf(a.diagonaltype)!==-1,'Unsupported diagonal measurement.'); }
        ['gridcolor','background_color'].forEach(function(k){if(own(a,k)){check(typeof a[k]==='string' && /^#[0-9a-f]{6}$/i.test(a[k]),'Invalid '+k+'.');}});
        var g=p.placement;fields(g,placement);
        ['width','height'].forEach(function(k){number(g[k],'graphic '+k,true);});['left','top'].forEach(function(k){number(g[k],'graphic center '+k);});
        check(g.rotation===0 && g.layer==='map' && g.fliph===false && g.flipv===false,'Only unrotated, unmirrored full-image Map-layer placement is supported.');
        check(close(g.width/s.pixel_width,g.height/s.pixel_height),'Placement distorts source aspect ratio.');
        check(close(g.width/(70*a.snapping_increment),s.columns) && close(g.height/(70*a.snapping_increment),s.rows),'Placement/snapping does not reproduce the approved source grid.');
        check(g.left-g.width/2>=0 && g.top-g.height/2>=0 && g.left+g.width/2<=70*a.width && g.top+g.height/2<=70*a.height,'Placement would clip the full image outside the page.');
        return {pkg:p,key:'setup:'+p.setup_id,fingerprint:hash(p)};
    }
    function imageIdentity(url,requireQuery) {
        check(typeof url==='string','Missing uploaded map image.');
        var m=/^https:\/\/(?:files\.d20\.io|s3\.amazonaws\.com\/files\.d20\.io)\/images\/(\d+)\/([A-Za-z0-9_-]+)\/(?:thumb|med|max|original)\.(?:png|jpe?g|gif|webp)(\?[^#\s]+)?$/i.exec(url);
        check(m&&(!requireQuery||m[3]),'Use an existing uploaded Roll20 Library image with its query string for binding; external/Marketplace images are unsupported.');
        return m[1]+'/'+m[2];
    }
    function store() {
        if(!state.D35MapPageSetup) { state.D35MapPageSetup={version:1,bindings:{},setups:{},lastReport:null}; }
        var s=state.D35MapPageSetup;check(s.version===1 && s.bindings && s.setups && typeof s.bindings==='object' && typeof s.setups==='object' && !Array.isArray(s.bindings) && !Array.isArray(s.setups),'Unsupported map-page state; preserve it for review.');return s;
    }
    function privateTransfer(ref) {
        var h=getObj('handout',ref);if(!h){var hs=findObjs({_type:'handout',name:ref});check(hs.length===1,'Transfer missing or ambiguous; use its ID.');h=hs[0];}
        check(h && h.get('inplayerjournals')==='' && h.get('controlledby')==='','Use a GM-only transfer Handout without player editors.');return h;
    }
    function read(h) {
        return new Promise(function(resolve,reject){var done=false,timer=setTimeout(function(){if(!done){done=true;reject(new Error('Transfer read timed out. No automatic retry writes.'));}},10000);
            try { h.get('gmnotes',function(raw){if(done){return;}done=true;clearTimeout(timer);if(typeof raw==='string'){resolve(raw);}else{reject(new Error('Invalid transfer blob.'));}}); }
            catch(e){if(!done){done=true;clearTimeout(timer);reject(e);}}
        });
    }
    function transport(raw) {
        check(typeof raw==='string' && raw.length<=1000000,'Invalid or oversized transfer.');raw=raw.trim();if(/^%(7b|3c)/i.test(raw)){raw=decodeURIComponent(raw);}
        if(raw[0]==='<'){
            check(!/<\/?(?!p\b|div\b|span\b|pre\b|br\b)[a-z]/i.test(raw),'Unsupported transfer wrapper; paste plain JSON.');
            raw=raw.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|pre)>/gi,'\n').replace(/<[^>]*>/g,'');
            var entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
            raw=raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,function(all,k){if(k[0]==='#'){var n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);check(n>0 && n<=0x10ffff && !(n>=0xd800&&n<=0xdfff),'Invalid entity.');return String.fromCodePoint(n);}check(own(entities,k),'Unsupported transfer entity.');return entities[k];});
        }
        var out='',quoted=false,escaped=false;for(var i=0;i<raw.length;i++){var c=raw[i];out+=c==='\u00a0'&&!quoted?' ':c;if(escaped){escaped=false;}else if(quoted&&c==='\\'){escaped=true;}else if(c==='"'){quoted=!quoted;}}return JSON.parse(out);
    }
    function page(data,binding) {
        var p=data.pkg,matches=findObjs({_type:'page',name:p.target.name});check(matches.length===1,'Existing page missing or exact name is ambiguous; no page is created.');
        var pg=matches[0];check((p.target.id===null||p.target.id===pg.id) && (!binding||binding.pageId===pg.id),'Page identity changed or explicit page ID differs.');
        var campaign=Campaign(),ribbon=campaign.get('playerpageid'),overrides=campaign.get('playerspecificpages');
        check((typeof ribbon==='string'||ribbon===false) && ribbon!==pg.id,'Target is on the player ribbon or ribbon state is unsupported; visibility is never changed automatically.');
        if(typeof overrides==='string' && overrides){overrides=JSON.parse(overrides);}
        if(overrides && typeof overrides==='object' && !Array.isArray(overrides)){check(Object.keys(overrides).every(function(k){return typeof overrides[k]==='string' && overrides[k]!==pg.id;}),'Target has a player assignment or unsupported player-page override.');}
        else{check(overrides===false||overrides===null||overrides===undefined||overrides==='','Unsupported player-page assignments; no visibility guess.');}
        return pg;
    }
    function value(v,expected,k) {
        if(typeof expected==='number') { check((typeof v==='number'||typeof v==='string'&&/^-?(?:\d+\.?\d*|\.\d+)$/.test(v.trim())) && Number.isFinite(Number(v)),'Unsupported native numeric property '+k+'.');return Number(v); }
        if(typeof expected==='boolean') {check(typeof v==='boolean','Unsupported native boolean property '+k+'.');}
        if(typeof expected==='string') {check(typeof v==='string','Unsupported native text property '+k+'.');}
        if(k==='gridcolor'||k==='background_color') {return typeof v==='string'?v.toLowerCase():v;}
        return v;
    }
    function pageSnapshot(pg,p) {var o={};Object.keys(p.page_settings).forEach(function(k){o[k]=value(pg.get(k),p.page_settings[k],k);});return o;}
    function wantedPage(p) {var o={};Object.keys(p.page_settings).forEach(function(k){o[k]=value(p.page_settings[k],p.page_settings[k],k);});return o;}
    function graphicSnapshot(g) {var o={};graphicFields.forEach(function(k){var v=g.get(k);if(k==='baseOpacity'&&v!==undefined&&v!==null&&v!==''){v=value(v,0,k);}o[k]=numeric.indexOf(k)!==-1?value(v,0,k):(v===undefined?null:v);});o.imageIdentity=imageIdentity(g.get('imgsrc'));return o;}
    function safeSource(g,requireQuery) {
        check(g && g.get('_subtype')==='token' && getObj('page',g.get('_pageid')),'Selected uploaded graphic or its page is missing.');
        check(g.get('represents')==='' && g.get('controlledby')==='' && !g.get('sides'),'Choose a plain unlinked, uncontrolled map graphic; Character/token bindings are protected.');
        ['bar1_link','bar2_link','bar3_link','bar1_value','bar2_value','bar3_value'].forEach(function(k){check(g.get(k)==='','Graphic has token bars or linked sheet data; preserve it.');});
        return imageIdentity(g.get('imgsrc'),requireQuery);
    }
    function occupied(pg,except) {return getAllObjs().filter(function(o){return o.id!==except && o.get('_pageid')===pg.id;});}
    function claims(data,pg) {var s=store();Object.keys(s.bindings).concat(Object.keys(s.setups)).forEach(function(k){var r=s.bindings[k]||s.setups[k];check(k===data.key||r.pageId!==pg.id,'Another managed setup reserves this page.');});}
    function binding(data,msg,bind) {
        var s=store(),p=data.pkg,b=own(s.bindings,data.key)?s.bindings[data.key]:null;
        if(b){check(b.fingerprint===data.fingerprint,'Stable setup already binds a different package. No overwrite.');}
        check(b||bind,'No image binding. Select the approved uploaded graphic and run !d35map bind TRANSFER; saved bindings are never silently reconstructed.');
        var pg=page(data,b);claims(data,pg);
        var selected=null;
        if(bind){check(Array.isArray(msg.selected)&&msg.selected.length===1 && msg.selected[0]._type==='graphic','Select exactly one approved uploaded map graphic, then run !d35map bind TRANSFER.');selected=id(msg.selected[0]._id);}
        var sourceId=selected||(b&&b.sourceId)||p.image.graphic_id;
        check(sourceId,'No image binding. Select the approved uploaded graphic and run !d35map bind TRANSFER.');
        if(p.image.graphic_id!==null){check(sourceId===p.image.graphic_id,'Selected graphic differs from the explicit package binding.');}
        if(b){check(sourceId===b.sourceId,'Binding already identifies another graphic; no silent rebind.');return {page:pg,binding:b};}
        var g=getObj('graphic',sourceId),identity=safeSource(g,p.image.mode==='copy');
        check(p.image.mode!=='configure'||g.get('_pageid')===pg.id,'Configure mode requires the selected graphic on the exact target page.');
        b={fingerprint:data.fingerprint,pageId:pg.id,sourceId:g.id,imageIdentity:identity,imgsrc:g.get('imgsrc'),pageBefore:pageSnapshot(pg,p),sourceBefore:graphicSnapshot(g)};
        return {page:pg,binding:b};
    }
    function preflight(data,resolved) {
        var p=data.pkg,b=resolved.binding,pg=page(data,b),g=getObj('graphic',b.sourceId);claims(data,pg);
        check(safeSource(g,p.image.mode==='copy')===b.imageIdentity && equal(graphicSnapshot(g),b.sourceBefore),'Bound graphic changed after binding; preserve manual edits.');
        check(equal(pageSnapshot(pg,p),b.pageBefore),'Page settings changed after binding; preserve manual edits.');
        check(!occupied(pg,p.image.mode==='configure'?g.id:null).length,'Populated page: initial setup refuses other graphics, pins, paths, text, lights, doors or windows. A separately reviewed change plan is required.');
        return {page:pg,source:g};
    }
    function changes(before,wanted) {var d={};Object.keys(wanted).forEach(function(k){var v=value(before[k],wanted[k],k);if(!equal(v,value(wanted[k],wanted[k],k))){d[k]=wanted[k];}});return d;}
    function desiredGraphic(p) {return Object.assign({},p.placement);}
    function verify(data,b,record) {
        var pg=page(data,b),p=data.pkg,g=getObj('graphic',record.graphicId);claims(data,pg);
        check(record.status==='verified','Partial setup retained for review; no automatic repair or replacement.');
        check(g && g.get('_pageid')===pg.id,'Managed map graphic missing or moved to another page; no replacement.');
        check(equal(pageSnapshot(pg,p),wantedPage(p)),'Managed page settings changed or readback differs. No overwrite.');
        var snap=graphicSnapshot(g),wanted=desiredGraphic(p);
        Object.keys(wanted).forEach(function(k){check(equal(value(g.get(k),wanted[k],k),wanted[k]),'Map graphic readback differs: '+k+'. No overwrite.');});
        check(snap.imageIdentity===b.imageIdentity,'Managed map image identity differs.');
        check(equal(snap,record.graphicSnapshot),'Manual map graphic changes detected; preserved.');
        var duplicates=occupied(pg,g.id).filter(function(o){if(o.get('_type')!=='graphic'||o.get('layer')!=='map'){return false;}try{return imageIdentity(o.get('imgsrc'))===b.imageIdentity;}catch(e){return false;}});
        check(!duplicates.length,'Another Map-layer graphic has the same image identity; preserve ambiguous duplicates.');
        return {page:pg,graphic:g};
    }
    function report(r) {
        try{store().lastReport=r;}catch(e){/* Preserve incompatible state. */}
        var message=(r.status.toUpperCase()+': '+r.message).replace(/[\r\n]+/g,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\[\]{}]/g,function(c){return '&#'+c.charCodeAt(0)+';';});
        sendChat('D35 Map Page','/w gm '+message);
    }
    async function command(msg) {
        if(msg.type!=='api'||!/^!d35map(?:\s|$)/.test(msg.content)||!playerIsGM(msg.playerid)){return;}
        if(busy){report({status:'error',message:'Map-page command in progress; wait for its report.'});return;}
        var m=/^!d35map\s+(bind|preview|import|audit)\s+(.+?)\s*$/.exec(msg.content);
        if(!m){report({status:'error',message:'Use !d35map bind|preview|import|audit TRANSFER (exact name or ID).'});return;}
        busy=true;var touched=false,record=null;
        try{
            var h=privateTransfer(m[2]),data=validate(transport(await read(h)));privateTransfer(h.id);
            var resolved=binding(data,msg,m[1]==='bind'),b=resolved.binding,p=data.pkg,s=store();
            var old=own(s.setups,data.key)?s.setups[data.key]:null;
            if(old){check(old.fingerprint===data.fingerprint,'Managed setup package changed. No overwrite.');var current=verify(data,b,old);
                report({status:'verified',action:'preserve',pageId:current.page.id,graphicId:current.graphic.id,objectWrites:0,message:'Verified existing map '+p.title+'; page ['+current.page.id+'], graphic ['+current.graphic.id+']; no object writes.'});
            }else{
                var checked=preflight(data,resolved);
                if(m[1]==='bind'){
                    if(!own(s.bindings,data.key)){s.bindings[data.key]=b;}
                    report({status:'bound',pageId:b.pageId,graphicId:b.sourceId,imageIdentity:b.imageIdentity,objectWrites:0,message:'Bound selected uploaded graphic ['+b.sourceId+'], native image '+b.imageIdentity+', as approved asset '+p.source.filename+' on page ['+b.pageId+']; no page or graphic writes. Preview before import.'});
                }else if(m[1]==='audit'){throw new Error('No managed setup; audit never creates or configures objects.');}
                else if(m[1]==='preview'){
                    report({status:'preview',pageId:b.pageId,sourceId:b.sourceId,imageIdentity:b.imageIdentity,objectWrites:0,
                        pageChanges:changes(pageSnapshot(checked.page,p),p.page_settings),graphicChanges:p.image.mode==='configure'?changes(graphicSnapshot(checked.source),desiredGraphic(p)):desiredGraphic(p),
                        message:'Would configure existing page '+p.target.name+' ['+b.pageId+'] and '+p.image.mode+' approved image ['+b.sourceId+'] at '+p.placement.width+'x'+p.placement.height+', center '+p.placement.left+','+p.placement.top+' on Map layer; '+p.page_settings.width+'x'+p.page_settings.height+' page units, '+p.page_settings.scale_number+' '+p.page_settings.scale_units+' per unit; '+p.page_settings.grid_type+' grid '+(p.page_settings.showgrid?'visible':'hidden')+', snapping '+p.page_settings.snapping_increment+', offsets '+p.page_settings.grid_offset_x+','+p.page_settings.grid_offset_y+'. GM-only assignment check passed; no writes.'});
                }else{
                    checked=preflight(data,resolved);s.bindings[data.key]=b;
                    record={fingerprint:data.fingerprint,pageId:b.pageId,graphicId:p.image.mode==='configure'?b.sourceId:null,status:'applying',pageBefore:b.pageBefore,sourceBefore:b.sourceBefore,plannedPage:p.page_settings,plannedGraphic:p.placement,graphicSnapshot:null};s.setups[data.key]=record;
                    var pd=changes(pageSnapshot(checked.page,p),p.page_settings),writes=0;
                    if(Object.keys(pd).length){touched=true;checked.page.set(pd);writes++;}
                    check(equal(pageSnapshot(checked.page,p),wantedPage(p)),'Page settings readback differs; stop before graphic writes.');
                    // Recheck visibility, population and source after the page write, before touching the image.
                    page(data,b);check(!occupied(checked.page,p.image.mode==='configure'?b.sourceId:null).length,'Page became populated during setup; stop for review.');
                    check(safeSource(checked.source,p.image.mode==='copy')===b.imageIdentity && equal(graphicSnapshot(checked.source),b.sourceBefore),'Source changed during setup; stop for review.');
                    var graphic;
                    if(p.image.mode==='configure'){
                        graphic=checked.source;var gd=changes(graphicSnapshot(graphic),desiredGraphic(p));
                        if(Object.keys(gd).length){touched=true;graphic.set(gd);writes++;}
                    }else{
                        touched=true;record.status='creation_started';
                        graphic=createObj('graphic',Object.assign({pageid:b.pageId,imgsrc:b.imgsrc,name:p.source.filename,represents:'',controlledby:'',showname:false,showplayers_name:false,show_tooltip:false,tooltip:'',isdrawing:true},desiredGraphic(p)));
                        check(graphic&&graphic.id,'Graphic creation failed; preserve the reserved setup for review.');record.graphicId=graphic.id;writes++;
                    }
                    record.graphicSnapshot=graphicSnapshot(graphic);record.status='verified';
                    verify(data,b,record);
                    report({status:'verified',action:'configured',pageId:b.pageId,graphicId:graphic.id,objectWrites:writes,imageIdentity:b.imageIdentity,
                        message:'Configured and read-back verified '+p.title+'; page ['+b.pageId+'], Map graphic ['+graphic.id+']; dimensions, scale, grid, placement, image identity and GM-only assignments passed.'});
                }
            }
        }catch(e){if(record){record.status='blocked';record.failure=String(e.message||e);}report({status:'error',pageId:record&&record.pageId,graphicId:record&&record.graphicId,partial:!!record,
            message:String(e.message||e)+(record?' Setup/identities retained for review; no automatic rollback, replacement or retry writes.':'')+(touched?' Some native writes may have completed.':'')});}
        finally{busy=false;}
    }
    on('ready',function(){on('chat:message',command);log('D35 Map Page Setup v0.1.0 ready.');});
    return {validate:validate,imageIdentity:imageIdentity};
}());
