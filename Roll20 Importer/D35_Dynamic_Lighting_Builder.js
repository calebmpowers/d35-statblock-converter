/* D35 Dynamic Lighting Builder v0.1.1 — review-first, ordinary opaque polylines.
 * Requires existing D35 Journal Importer and D35 Map Page Setup.
 * !d35light preview|audit TRANSFER
 * !d35light apply TRANSFER --confirm PREVIEW_TOKEN
 * Never deletes, repairs, uploads, reveals, traces, or creates pages.
 */
var D35DynamicLightingBuilder = D35DynamicLightingBuilder || (function () {
    'use strict';
    var busy=false, lighting=['dynamic_lighting_enabled','daylight_mode_enabled','lightrestrictmove'];
    var pageExtra=['explorer_mode','daylightModeOpacity','lightupdatedrop','darknessEffect'];
    var pathExtra=['fadeOnOverlap','fadeOpacity','renderAsScenery','interactionManualReset','interactionTriggered'];
    function check(ok,s){if(!ok){throw new Error(s);}}
    function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
    function fields(o,allowed,required){check(o && typeof o==='object' && !Array.isArray(o),'Expected specification object.');check(Object.keys(o).every(function(k){return allowed.indexOf(k)!==-1;}) && (required||allowed).every(function(k){return own(o,k);}), 'Unexpected or missing specification fields.');}
    function text(v,label,max){check(typeof v==='string' && v && v===v.trim() && v.length<=(max||240) && !/[\x00-\x1f]/.test(v),'Invalid '+label+'.');}
    function id(v){text(v,'explicit object identity');check(/^[-A-Za-z0-9_]+$/.test(v),'Invalid object identity.');}
    function stable(v){check(typeof v==='string' && /^[a-z0-9][a-z0-9._:-]{2,159}$/.test(v),'Invalid stable identity.');}
    function canonical(v){if(Array.isArray(v)){return '['+v.map(canonical).join(',')+']';}if(v && typeof v==='object'){return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}';}return JSON.stringify(v);}
    function hash(v){check(typeof D35JournalImporter!=='undefined' && typeof D35JournalImporter.sha256==='function','Install the existing D35 Journal importer first.');return D35JournalImporter.sha256(canonical(v));}
    function equal(a,b){return canonical(a)===canonical(b);}
    function near(a,b){return Math.abs(a-b)<=1e-6;}
    function same(a,b){if(typeof a==='number' && typeof b==='number'){return near(a,b);}if(Array.isArray(a)&&Array.isArray(b)){return a.length===b.length && a.every(function(x,i){return same(x,b[i]);});}if(a && b && typeof a==='object' && typeof b==='object'){return equal(Object.keys(a).sort(),Object.keys(b).sort()) && Object.keys(a).every(function(k){return same(a[k],b[k]);});}return a===b;}
    function numeric(v){check((typeof v==='number'||typeof v==='string'&&/^-?(?:\d+\.?\d*|\.\d+)$/.test(v.trim())) && Number.isFinite(Number(v)),'Unsupported native numeric property.');return Number(v);}
    function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
    function intersects(a,b,c,d){function on(p,q,r){return Math.abs(cross(p,q,r))<=1e-12 && [0,1].every(function(k){return r[k]>=Math.min(p[k],q[k])-1e-12 && r[k]<=Math.max(p[k],q[k])+1e-12;});}return cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0 || on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
    function overlaps(a,b,c,d){if(Math.abs(cross(a,b,c))>1e-12||Math.abs(cross(a,b,d))>1e-12){return false;}var k=Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1])?0:1;return Math.min(Math.max(a[k],b[k]),Math.max(c[k],d[k]))-Math.max(Math.min(a[k],b[k]),Math.min(c[k],d[k]))>1e-12;}
    function polyline(ps){
        check(Array.isArray(ps)&&ps.length>=2&&ps.length<=200,'Supply 2..200 normalized points.');
        ps.forEach(function(p){check(Array.isArray(p)&&p.length===2&&p.every(function(x){return typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;}),'Coordinates must be finite normalized [u,v] in [0,1].');});
        for(var i=0;i<ps.length-1;i++){
            var a=ps[i],b=ps[i+1];check(!equal(a,b),'Zero-length segment.');
            for(var j=i+1;j<ps.length-1;j++){
                var c=ps[j],d=ps[j+1];
                if(j===i+1){if(Math.abs(cross(a,b,d))<=1e-12){check((b[0]-a[0])*(d[0]-b[0])+(b[1]-a[1])*(d[1]-b[1])>0,'Backtracking segment.');}continue;}
                if(i===0&&j===ps.length-2&&equal(ps[0],ps[ps.length-1])){check(Math.abs(cross(b,a,c))>1e-12||(a[0]-b[0])*(c[0]-a[0])+(a[1]-b[1])*(c[1]-a[1])>0,'Backtracking closure.');continue;}
                check(!intersects(a,b,c,d),'Self-intersecting polyline.');
            }
        }
        check(!equal(ps[0],ps[ps.length-1])||ps.length>=4,'Closed barriers need three distinct vertices.');
    }
    function validate(p){
        fields(p,['schema','lighting_id','title','map','compatibility','review','lighting','barriers','annotations']);
        check(p.schema==='d35-dynamic-lighting/0.1','Unsupported lighting schema.');stable(p.lighting_id);text(p.title,'lighting title');
        fields(p.map,['package','page_id','graphic_id','sha256']);id(p.map.page_id);id(p.map.graphic_id);check(typeof p.map.sha256==='string'&&/^[a-f0-9]{64}$/.test(p.map.sha256),'Missing original image SHA-256.');
        check(typeof D35MapPageSetup!=='undefined' && typeof D35MapPageSetup.validate==='function' && typeof D35MapPageSetup.imageIdentity==='function','Install the existing D35 Map Page Setup first.');
        var md=D35MapPageSetup.validate(p.map.package),mp=p.map.package;
        check(mp.target.id===null||mp.target.id===p.map.page_id,'Map package page binding differs.');
        check(mp.image.mode==='copy'||mp.image.graphic_id===null||mp.image.graphic_id===p.map.graphic_id,'Map package graphic binding differs.');
        fields(p.compatibility,['engine','native_path_id']);check(['classic','latest'].indexOf(p.compatibility.engine)!==-1,'Select classic or latest engine explicitly.');if(p.compatibility.native_path_id!==null){id(p.compatibility.native_path_id);}
        var r=p.review;fields(r,['status','by','rationale','decisions']);check(['proposed','approved'].indexOf(r.status)!==-1,'Explicit review status required.');text(r.rationale,'review rationale',4000);
        check(Array.isArray(r.decisions)&&r.decisions.length<=200,'Invalid review decisions.');var decisions={};
        r.decisions.forEach(function(d){fields(d,['id','note','resolution']);stable(d.id);check(!own(decisions,d.id),'Duplicate review decision.');decisions[d.id]=d;text(d.note,'review judgment',2000);check(['pending','accepted'].indexOf(d.resolution)!==-1,'Invalid review resolution.');});
        if(r.by!==null){text(r.by,'reviewer');}if(r.status==='approved'){check(r.by!==null&&r.decisions.every(function(d){return d.resolution==='accepted';}),'Approval requires a reviewer and resolution of every judgment.');}
        fields(p.lighting,['before','after']);fields(p.lighting.before,lighting,[]);fields(p.lighting.after,lighting,[]);check(equal(Object.keys(p.lighting.before).sort(),Object.keys(p.lighting.after).sort()),'Supply explicit before/after settings for the same fields.');
        ['before','after'].forEach(function(k){Object.keys(p.lighting[k]).forEach(function(f){check(typeof p.lighting[k][f]==='boolean','Lighting settings must be booleans.');});});check(p.lighting.after.lightrestrictmove!==true,'v0.1 does not enable movement restriction.');
        check(Array.isArray(p.barriers)&&p.barriers.length<=200,'Invalid barrier inventory.');var ids={},segments={},allSegments=[],count=0;
        p.barriers.forEach(function(b){fields(b,['id','points','rationale','certainty']);stable(b.id);check(!own(ids,b.id),'Duplicate barrier ID.');ids[b.id]=true;polyline(b.points);count+=b.points.length;text(b.rationale,'barrier rationale',2000);check(['confirmed','interpretive'].indexOf(b.certainty)!==-1,'Invalid geometry certainty.');if(b.certainty==='interpretive'){check(own(decisions,b.id),'Interpretive geometry needs a review decision.');}
            b.points.slice(1).forEach(function(z,i){var a=b.points[i],g=mp.placement,dx=(z[0]-a[0])*g.width,dy=(z[1]-a[1])*g.height;check(dx*dx+dy*dy>=0.01*0.01-1e-15,'Barrier segment is below 0.01 page pixels.');var key=canonical([a,z].sort(function(a,b){return canonical(a)<canonical(b)?-1:1;}));check(!own(segments,key),'Duplicated barrier segment.');segments[key]=true;check(!allSegments.some(function(s){return overlaps(a,z,s[0],s[1]);}),'Overlapping barrier segments.');allSegments.push([a,z]);});});check(count<=2000,'Too many geometry vertices.');
        check(Array.isArray(p.annotations)&&p.annotations.length<=100,'Invalid review annotations.');var annotations={};p.annotations.forEach(function(a){fields(a,['id','points','label']);stable(a.id);check(!own(annotations,a.id),'Duplicate annotation ID.');annotations[a.id]=true;polyline(a.points);text(a.label,'review-only label',1000);});
        return {pkg:p,key:'lighting:'+p.lighting_id,fingerprint:hash(p),mapData:md};
    }
    function transform(ps,g){polyline(ps);return ps.map(function(p){return [g.left-g.width/2+p[0]*g.width,g.top-g.height/2+p[1]*g.height];});}
    function descriptor(b,p){
        var ps=transform(b.points,p.map.package.placement),xs=ps.map(function(x){return x[0];}),ys=ps.map(function(x){return x[1];});
        var xmin=Math.min.apply(null,xs),xmax=Math.max.apply(null,xs),ymin=Math.min.apply(null,ys),ymax=Math.max.apply(null,ys),x=(xmin+xmax)/2,y=(ymin+ymax)/2;
        var props={pageid:p.map.page_id,fill:'transparent',stroke:'#00ccff',rotation:0,layer:'walls',stroke_width:5,controlledby:'',barrierType:'wall',oneWayReversed:false};
        if(p.compatibility.engine==='latest'){
            props.shape='pol';props.points=JSON.stringify(ps.map(function(a){return [a[0]-xmin,a[1]-ymin];}));props.x=x;props.y=y;
            return {id:b.id,type:'pathv2',props:props};
        }
        // A one-pixel symmetric box keeps horizontal/vertical classic paths nonzero
        // without moving their centerline or scaling the approved coordinates.
        var w=Math.max(1,xmax-xmin),h=Math.max(1,ymax-ymin);
        props.path=JSON.stringify(ps.map(function(a,i){return [i?'L':'M',a[0]-(x-w/2),a[1]-(y-h/2)];}));
        Object.assign(props,{width:w,height:h,left:x,top:y,scaleX:1,scaleY:1});return {id:b.id,type:'path',props:props};
    }
    function store(){if(!own(state,'D35DynamicLightingBuilder')){state.D35DynamicLightingBuilder={version:1,plans:{},previews:{},lastReport:null};}var s=state.D35DynamicLightingBuilder;check(s && s.version===1 && s.plans && s.previews && typeof s.plans==='object' && typeof s.previews==='object' && !Array.isArray(s.plans) && !Array.isArray(s.previews),'Unsupported lighting state; preserve for review.');Object.keys(s.plans).forEach(function(k){var r=s.plans[k];check(r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.pageId==='string'&&typeof r.fingerprint==='string','Unsupported lighting record; preserve for review.');});return s;}
    function pageSnapshot(pg){var out={};lighting.forEach(function(k){check(typeof pg.get(k)==='boolean','Native page lighting property unavailable: '+k+'.');out[k]=pg.get(k);});pageExtra.forEach(function(k){var v=pg.get(k);out[k]=v===undefined?null:k==='daylightModeOpacity'&&v!==null&&v!==''?numeric(v):v;});return out;}
    function privatePage(pg){
        var c=Campaign(),r=c.get('playerpageid'),o=c.get('playerspecificpages');check((typeof r==='string'||r===false)&&r!==pg.id,'Target page is assigned to players or ribbon state is unsupported.');
        if(typeof o==='string'&&o){o=JSON.parse(o);}if(o && typeof o==='object'&&!Array.isArray(o)){check(Object.keys(o).every(function(k){return typeof o[k]==='string'&&o[k]!==pg.id;}),'Target has a player assignment or unsupported override.');}else{check(o===false||o===null||o===undefined||o==='','Unsupported player assignments.');}
    }
    function map(data){
        var p=data.pkg,mp=p.map.package,s=state.D35MapPageSetup,k=data.mapData.key;
        check(s&&s.version===1&&s.bindings&&s.setups,'Missing verified Map Page Setup state.');var b=s.bindings[k],r=s.setups[k];
        check(b&&r&&b.fingerprint===data.mapData.fingerprint&&r.fingerprint===data.mapData.fingerprint&&r.status==='verified','Map package differs from the verified managed setup; no inferred adoption.');
        var pg=getObj('page',p.map.page_id),g=getObj('graphic',p.map.graphic_id);check(pg&&g,'Map page or approved graphic missing.');
        check(b.pageId===pg.id&&r.pageId===pg.id&&r.graphicId===g.id&&g.get('_pageid')===pg.id,'Managed map identity or page binding differs.');
        var matches=findObjs({_type:'page',name:mp.target.name});check(matches.length===1&&matches[0].id===pg.id,'Map page name missing, changed or ambiguous.');privatePage(pg);
        check(findObjs({_type:'graphic',_pageid:pg.id,layer:'map'}).every(function(o){return o.id===g.id;}),'Additional Map-layer graphics require a separate review; no lighting guess.');
        Object.keys(mp.page_settings).forEach(function(f){var v=pg.get(f),want=mp.page_settings[f];if(typeof want==='number'){v=numeric(v);}check(v===want,'Managed map page changed: '+f+'.');});
        check(r.graphicSnapshot&&r.graphicSnapshot.imageIdentity===b.imageIdentity,'Invalid managed map snapshot.');
        Object.keys(r.graphicSnapshot).forEach(function(f){var want=r.graphicSnapshot[f],v=f==='imageIdentity'?D35MapPageSetup.imageIdentity(g.get('imgsrc')):g.get(f);if(v===undefined){v=null;}if(typeof want==='number'){v=numeric(v);}check(same(v,want),'Manual map graphic change: '+f+'.');});
        return {page:pg,graphic:g,imageIdentity:b.imageIdentity};
    }
    function pathSnapshot(obj,d){
        check(obj&&obj.get('_type')===d.type,'Managed lighting path missing or type changed; no replacement.');var out={};
        Object.keys(d.props).forEach(function(k){var f=k==='pageid'?'_pageid':k==='path'?'_path':k,v=obj.get(f),want=d.props[k];
            if(k==='path'||k==='points'){check(typeof v==='string','Native path geometry unavailable.');v=JSON.parse(v);want=JSON.parse(want);}
            else if(typeof want==='number'){v=numeric(v);}else if(k==='fill'||k==='stroke'){v=typeof v==='string'?v.toLowerCase():v;}
            check(same(v,want),'Lighting path readback/manual change differs: '+d.id+' '+f+'.');out[f]=v;});
        pathExtra.forEach(function(k){var v=obj.get(k);out[k]=v===undefined?null:k==='fadeOpacity'&&v!==null&&v!==''?numeric(v):v;});return out;
    }
    function compatibility(p,witnessId){
        var v=Campaign().sandboxVersion;check(v==='1.0'||v==='1.5','Unknown Mod sandbox version; no compatibility guess.');
        var result={sandboxVersion:v,engine:p.compatibility.engine,witnessId:witnessId||null};
        if(!p.barriers.length){return result;}
        var type=p.compatibility.engine==='latest'?'pathv2':'path',w=witnessId&&getObj(type,witnessId);
        check(w&&w.get('_pageid')===p.map.page_id&&w.get('layer')==='gmlayer'&&w.get('controlledby')==='','Missing native GM-layer polyline witness: select one native GM-layer line during preview, or supply its explicit native_path_id.');
        var points=JSON.parse(w.get(type==='pathv2'?'points':'_path'));
        check(Array.isArray(points)&&points.length>=2,'Native witness geometry unavailable.');
        if(type==='pathv2'){check(w.get('shape')==='pol'&&points.every(function(a){return Array.isArray(a)&&a.length===2&&a.every(function(n){return typeof n==='number'&&Number.isFinite(n);});}),'Unsupported native pathv2 witness.');numeric(w.get('x'));numeric(w.get('y'));}
        else{check(points.every(function(a,i){return Array.isArray(a)&&a.length===3&&a[0]===(i?'L':'M')&&typeof a[1]==='number'&&Number.isFinite(a[1])&&typeof a[2]==='number'&&Number.isFinite(a[2]);}),'Unsupported native classic witness.');['width','height','left','top','scaleX','scaleY'].forEach(function(f){numeric(w.get(f));});}
        check(w.get('barrierType')==='wall','Native ordinary barrier property unavailable.');result.witness={points:points,barrierType:w.get('barrierType')};return result;
    }
    function walls(pg){return getAllObjs().filter(function(o){return o.get('_pageid')===pg.id&&((['path','pathv2'].indexOf(o.get('_type'))!==-1&&o.get('layer')==='walls')||['door','window'].indexOf(o.get('_type'))!==-1);});}
    function resolve(data,r,selectedWitness){
        var s=store(),p=data.pkg,m=map(data),paths=p.barriers.map(function(b){return descriptor(b,p);}),page=pageSnapshot(m.page),prior=s.previews[data.key];
        var witness=r?r.nativePathId:selectedWitness||p.compatibility.native_path_id||(prior&&prior.fingerprint===data.fingerprint?prior.witnessId:null),compat=compatibility(p,witness);
        Object.keys(s.plans).forEach(function(k){check(k===data.key||s.plans[k].pageId!==m.page.id,'Another managed lighting plan reserves this page.');});
        if(r){check(r.fingerprint===data.fingerprint&&r.pageId===m.page.id&&r.graphicId===m.graphic.id,'Managed lighting identity/package changed.');check(r.status==='verified','Partial apply retained for review; no automatic rollback, recreation or retry writes.');check(same(r.pageSnapshot,page),'Manual page lighting change detected; preserved.');
            check(r.paths&&Object.keys(r.paths).length===paths.length,'Managed path inventory differs.');paths.forEach(function(d){var saved=r.paths[d.id];check(saved&&saved.id,'Managed path identity missing.');check(same(pathSnapshot(getObj(d.type,saved.id),d),saved.snapshot),'Manual lighting path change detected; preserved.');});
        }else{
            Object.keys(p.lighting.before).forEach(function(k){check(page[k]===p.lighting.before[k],'Page lighting precondition differs: '+k+'.');});
            var desired=Object.assign({},page,p.lighting.after);if(paths.length){check(desired.dynamic_lighting_enabled===true,'Barriers require explicitly enabled Dynamic Lighting.');check(desired.lightrestrictmove===false,'Ordinary vision-only barriers require movement restriction disabled.');}
        }
        var ids=r?Object.keys(r.paths).map(function(k){return r.paths[k].id;}):[];
        check(walls(m.page).every(function(o){return ids.indexOf(o.id)!==-1;}),'Unmanaged lighting, doors or windows present; preserve them and review separately.');
        return {page:m.page,map:m,paths:paths,pageSnapshot:page,compatibility:compat};
    }
    function transfer(ref){var h=getObj('handout',ref);if(!h){var all=findObjs({_type:'handout',name:ref});check(all.length===1,'Transfer missing or ambiguous; use its ID.');h=all[0];}check(h&&h.get('inplayerjournals')===''&&h.get('controlledby')==='','Use a GM-only transfer without player editors.');return h;}
    function read(h){return new Promise(function(resolve,reject){var done=false,t=setTimeout(function(){if(!done){done=true;reject(new Error('Transfer read timed out; no writes.'));}},10000);try{h.get('gmnotes',function(raw){if(done){return;}done=true;clearTimeout(t);resolve(raw);});}catch(e){if(!done){done=true;clearTimeout(t);reject(e);}}});}
    function transport(raw){
        check(typeof raw==='string'&&raw.length<=1000000,'Invalid/oversized transfer.');raw=raw.trim();if(/^%(7b|3c)/i.test(raw)){raw=decodeURIComponent(raw);}
        if(raw[0]==='<'){
            check(!/<\/?(?!p\b|div\b|span\b|pre\b|br\b)[a-z]/i.test(raw),'Unsupported transfer wrapper; paste plain JSON.');raw=raw.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|pre)>/gi,'\n').replace(/<[^>]*>/g,'');
            var e={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};raw=raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,function(all,k){if(k[0]==='#'){var n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);check(n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff),'Invalid entity.');return String.fromCodePoint(n);}check(own(e,k),'Unsupported transfer entity.');return e[k];});
        }
        var out='',quoted=false,escaped=false;for(var i=0;i<raw.length;i++){var c=raw[i];out+=c==='\u00a0'&&!quoted?' ':c;if(escaped){escaped=false;}else if(quoted&&c==='\\'){escaped=true;}else if(c==='"'){quoted=!quoted;}}return JSON.parse(out);
    }
    function report(r){try{store().lastReport=r;}catch(e){/* Preserve incompatible state; still report privately. */}var msg=String(r.message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');sendChat('D35 Lighting','/w gm '+msg);}
    async function command(msg){
        if(msg.type!=='api'||!/^!d35light(?:\s|$)/.test(msg.content)){return;}if(!playerIsGM(msg.playerid)){return;}if(busy){report({status:'error',objectWrites:0,message:'Another lighting operation is pending; no writes.'});return;}
        var match=/^!d35light\s+(preview|apply|audit)\s+(.+?)(?:\s+--confirm\s+([a-f0-9]{64}))?\s*$/.exec(msg.content);
        if(!match){report({status:'error',objectWrites:0,message:'Use !d35light preview|audit TRANSFER or !d35light apply TRANSFER --confirm PREVIEW_TOKEN.'});return;}
        busy=true;var record=null,writes=0,reserved=false;
        try{
            var h=transfer(match[2]),raw=await read(h);transfer(h.id);
            var data=validate(transport(raw)),p=data.pkg,s=store();
            record=own(s.plans,data.key)?s.plans[data.key]:null;
            var selectedWitness=null;
            if(!record&&match[1]==='preview'&&p.barriers.length&&Array.isArray(msg.selected)&&msg.selected.length){
                check(msg.selected.length===1&&msg.selected[0]._type===(p.compatibility.engine==='latest'?'pathv2':'path'),'Select exactly one native polyline matching the declared engine.');selectedWitness=msg.selected[0]._id;id(selectedWitness);
                check(p.compatibility.native_path_id===null||p.compatibility.native_path_id===selectedWitness,'Selected witness differs from the explicit package identity.');
            }
            var resolved=resolve(data,record,selectedWitness),summary={pageId:resolved.page.id,graphicId:resolved.map.graphic.id,barrierCount:resolved.paths.length,compatibility:resolved.compatibility,objectWrites:0};
            if(record){report(Object.assign(summary,{status:'verified',action:'unchanged',pathIds:Object.keys(record.paths).map(function(k){return record.paths[k].id;}),message:'Verified existing managed lighting; same map/page/path identities, settings and geometry. No writes.'}));return;}
            check(match[1]!=='audit','No managed lighting plan; audit never applies objects.');
            var baseline=hash({page:resolved.pageSnapshot,compatibility:resolved.compatibility,map:data.mapData.fingerprint}),token=hash({package:data.fingerprint,baseline:baseline});
            var changes={};Object.keys(p.lighting.after).forEach(function(k){if(resolved.pageSnapshot[k]!==p.lighting.after[k]){changes[k]=p.lighting.after[k];}});
            if(match[1]==='preview'){
                s.previews[data.key]={fingerprint:data.fingerprint,baseline:baseline,token:token,witnessId:resolved.compatibility.witnessId};
                report(Object.assign(summary,{status:'preview',reviewStatus:p.review.status,applyToken:token,pageChanges:changes,currentLighting:resolved.pageSnapshot,paths:resolved.paths,message:'Preview only: page ['+summary.pageId+'], map ['+summary.graphicId+']; '+resolved.paths.length+' ordinary barriers; '+p.annotations.length+' review-only annotations will NOT be imported. Declared '+p.compatibility.engine+' engine, observed sandbox '+resolved.compatibility.sandboxVersion+', native witness '+(resolved.compatibility.witnessId||'not required for zero barriers')+'. Lighting changes '+canonical(changes)+'; current lighting '+canonical(resolved.pageSnapshot)+'. Review '+p.review.status+'. Apply requires approval and --confirm '+token+'. No writes.'}));return;
            }
            check(p.review.status==='approved','Interpretation is not approved. No lighting writes.');var preview=s.previews[data.key];
            check(preview&&preview.fingerprint===data.fingerprint&&preview.baseline===baseline&&preview.token===match[3],'Run preview for this exact approved package and baseline, then use its --confirm token.');
            // Repeat every preflight immediately before reserving identities or writing.
            resolved=resolve(data,null);check(hash({page:resolved.pageSnapshot,compatibility:resolved.compatibility,map:data.mapData.fingerprint})===baseline,'Preflight changed after preview.');
            record={fingerprint:data.fingerprint,pageId:resolved.page.id,graphicId:resolved.map.graphic.id,nativePathId:resolved.compatibility.witnessId,status:'applying',paths:{},pageSnapshot:null};s.plans[data.key]=record;reserved=true;
            for(var i=0;i<resolved.paths.length;i++){
                privatePage(resolved.page);map(data);check(same(pageSnapshot(resolved.page),resolved.pageSnapshot),'Page lighting changed during apply.');check(!walls(resolved.page).some(function(o){return !Object.keys(record.paths).some(function(k){return record.paths[k].id===o.id;});}),'Unmanaged lighting appeared during apply.');
                var d=resolved.paths[i];record.paths[d.id]={id:null,snapshot:null};
                // Native createObj enriches its input with internal bookkeeping.
                // Keep the reviewed readback expectations independent of that mutation.
                var obj=createObj(d.type,Object.assign({},d.props));check(obj&&obj.id,'Path creation failed; reserved partial operation retained.');record.paths[d.id].id=obj.id;writes++;
                record.paths[d.id].snapshot=pathSnapshot(obj,d);
            }
            privatePage(resolved.page);map(data);check(same(pageSnapshot(resolved.page),resolved.pageSnapshot),'Page lighting changed during apply.');
            if(Object.keys(changes).length){resolved.page.set(changes);writes++;}
            var after=pageSnapshot(resolved.page);check(same(after,Object.assign({},resolved.pageSnapshot,p.lighting.after)),'Page lighting readback differs.');
            record.pageSnapshot=after;record.status='verified';resolve(data,record);
            report(Object.assign(summary,{status:'verified',action:'applied',objectWrites:writes,pathIds:Object.keys(record.paths).map(function(k){return record.paths[k].id;}),message:'Applied and read-back verified '+resolved.paths.length+' barriers. Page ['+record.pageId+']; no map, token, pin, Handout or permission changes. '+(resolved.paths.length?'Live player-vision verification remains required.':'Zero-barrier plan; no manufactured geometry.')}));
        }catch(e){if(reserved&&record){record.status='blocked';record.failure=String(e.message||e);}report({status:'error',partial:reserved,objectWrites:writes,message:String(e.message||e)+(reserved?' Reserved identities and any completed writes retained for review; no automatic rollback or retry creation.':'')});}
        finally{busy=false;}
    }
    on('ready',function(){on('chat:message',command);log('D35 Dynamic Lighting Builder v0.1.1 ready; review-first.');});
    return {validate:validate,transform:transform,descriptor:descriptor};
}());
