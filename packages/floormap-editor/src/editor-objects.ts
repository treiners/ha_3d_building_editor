/**
 * Objects mode (`Floor plan | Site | Entities | Objects`), phase 2 of docs/V2.17-OBJECTS.md: place, move, rotate and delete appliances and
 * furniture. Own file like the site mode: `objectsCss`, `objSideHtml` (sidebar block) and `objectsJs` (script, appended after siteJs).
 * Objects are drawn in ALL modes (flat, above the rooms, never clickable outside Objects mode); rooms are read-only in Objects mode
 * (the core pointerdown returns early unless appMode is 'plan').
 * Globals used: g, $, svg, world, rec, render, ICON_TRASH, room, plus the entity script (appMode, entMsg, entEsc, entRd, entStep, entSetApp,
 * selE, selM, entUi) and the embedded pure functions of objects.ts (objectDefs, objectHost, objectFootprint, addObject, moveObject,
 * updateObject, removeObject, validateObjects). No backticks or dollar-brace inside objectsJs.
 */
const hide = 'body[data-app=objects]';
export const objectsCss =
  '.objside{display:none}body[data-app=objects] .objside{display:block}' +
  `${hide} .side>.modes,${hide} .side>#panel,${hide} .side>.sec,${hide} .side>details.card,${hide} .side>label.mini,${hide} .toolbar .seg.modern-only,${hide} #run-mapper,${hide} #close-gaps,${hide} #fit-room,${hide} #gap{display:none}` +
  `${hide} .port,${hide} .handle{pointer-events:none}${hide} .room,${hide} .label{opacity:.55}body[data-oplacing]:not([data-oplacing=""]) .canvas{cursor:crosshair}` +
  '.obj{pointer-events:none}body[data-app=objects] .obj{pointer-events:auto;cursor:grab}.obj polygon{fill:rgba(100,116,139,.22);stroke:#475569;stroke-width:.03}.obj.furn polygon{fill:rgba(180,140,90,.25);stroke:#92400e}' +
  '.obj.sel polygon{stroke:#f97316;stroke-width:.07}.obj.obj-bad polygon{stroke:#dc2626;stroke-dasharray:.12 .08}.obj-front{stroke:#0f172a;stroke-width:.07;stroke-linecap:round;pointer-events:none}' +
  '.obj-label{font-size:.26px;text-anchor:middle;dominant-baseline:middle;fill:#17202a;pointer-events:none;paint-order:stroke;stroke:#fff;stroke-width:.06}' +
  '.obj-h{fill:#fff;stroke:#f97316;stroke-width:.05;cursor:grab}.obj-hl{stroke:#f97316;stroke-width:.03;stroke-dasharray:.1 .08;pointer-events:none}.objside .pal{margin-bottom:6px}.obj-clr{fill:rgba(249,115,22,.08);stroke:#f97316;stroke-width:.02;stroke-dasharray:.1 .08;pointer-events:none}.obj-rs{fill:#fff;stroke:#f97316;stroke-width:.05;cursor:pointer}.objside [data-opane]{display:none}.objside[data-tab=place] [data-opane=place],.objside[data-tab=list] [data-opane=list],.objside[data-tab=types] [data-opane=types]{display:block}.etable tr[data-orow]{cursor:pointer}';

export const objSideHtml =
  '<div class="objside" data-tab="place"><div class="entbanner">Layout locked: rooms are read-only here. Objects are appliances and furniture.</div><div class="modes"><button data-otab="place" class="active">Place</button><button data-otab="list">List</button><button data-otab="types">Types</button></div><div data-opane="place"><div class="card"><h2>Add object</h2><div id="obj-pal"></div><label class="row"><input id="obj-snap" type="checkbox" checked> Snap to walls</label><label class="row"><input id="obj-clr" type="checkbox"> Show clearance zones</label><div id="obj-hint" class="mini"></div></div></div><div data-opane="list"><div class="card"><h2>Objects</h2><div class="efilters"><select id="obj-f-host"></select><select id="obj-f-type"></select></div><div id="obj-list"></div></div></div><div data-opane="types"><div class="card"><h2>Object types</h2><div id="obj-types"></div><button id="obj-t-new">New type</button></div><div id="obj-type-edit"></div></div><div id="obj-inspector"></div><div id="obj-count" class="mini"></div></div>';

export const objectsJs = `
const objUi={sel:null,selT:null,placing:null,act:null,snap:true,clr:false,clip:null,ptr:null,tab:'place',fHost:'',fType:''};
const objGet=id=>(g.objects||[]).find(o=>o.id===id);
function objCenter(o){const h=objectHost(g,o);return h?{x:h.x+o.position[0],y:h.y+o.position[1]}:null}
function objLayer(){
const os=g.objects||[];if(!os.length)return'';
const defs=objectDefs(g),bad=new Set(validateObjects(g).map(i=>i.id)),on=appMode==='objects';let s='',hd='',cz='';
for(const o of os){const h=objectHost(g,o);if(!h)continue;const d=defs[o.type]||{},p=objectFootprint(o,defs).map(q=>[q[0]+h.x,q[1]+h.y]),sl=on&&o.id===objUi.sel,c={x:h.x+o.position[0],y:h.y+o.position[1]};
s+='<g class="obj '+(d.category==='furniture'?'furn':'appl')+(sl?' sel':'')+(bad.has(o.id)?' obj-bad':'')+'" data-obj="'+entEsc(o.id)+'"><polygon points="'+p.map(q=>q.join(',')).join(' ')+'"/><line class="obj-front" x1="'+p[0][0]+'" y1="'+p[0][1]+'" x2="'+p[1][0]+'" y2="'+p[1][1]+'"/><text class="obj-label" x="'+c.x+'" y="'+c.y+'">'+entEsc(o.name||d.label||o.type)+'</text></g>';
if(sl||(on&&objUi.clr)){const z=objectClearance(o,defs);if(z.length)cz+='<polygon class="obj-clr" points="'+z.map(q=>(q[0]+h.x)+','+(q[1]+h.y)).join(' ')+'"/>'}
if(sl){const a=(o.facingDegrees||0)*Math.PI/180,dist=(o.depth??d.depth??.5)/2+.4,hx=c.x+dist*Math.sin(a),hy=c.y-dist*Math.cos(a);
hd+='<line class="obj-hl" x1="'+c.x+'" y1="'+c.y+'" x2="'+hx+'" y2="'+hy+'"/><circle class="obj-h" data-ohandle="rot" cx="'+hx+'" cy="'+hy+'" r=".12"><title>Rotate (Alt = free)</title></circle>';const ww=o.width??d.width??.5,dd=o.depth??d.depth??.5,ca=Math.cos(a),sa=Math.sin(a);for(const k of[['r',ca*ww/2,sa*ww/2],['l',-ca*ww/2,-sa*ww/2],['b',-sa*dd/2,ca*dd/2],['f',sa*dd/2,-ca*dd/2]])hd+='<circle class="obj-rs" data-ohandle="rs-'+k[0]+'" cx="'+(c.x+k[1])+'" cy="'+(c.y+k[2])+'" r=".09"><title>Resize (Alt = free)</title></circle>'}}
return'<g class="objlayer">'+cz+s+hd+'</g>'}
function objHostName(o){const h=objectHost(g,o);if(!h)return'missing';return h.kind==='room'?(room(h.id)||{}).name||h.id:(((g.areas||[]).find(a=>a.id===h.id)||{}).name||h.id)+' (area)'}
function objList(){const defs=objectDefs(g),os=g.objects||[],iss={};for(const i of validateObjects(g))(iss[i.id]=iss[i.id]||[]).push(i.message);
const hk=o=>o.areaId?'area:'+o.areaId:o.roomId||'',hs=[...new Set(os.map(hk))];if(objUi.fHost&&hs.indexOf(objUi.fHost)<0)objUi.fHost='';
$('obj-f-host').innerHTML='<option value="">All rooms</option>'+hs.map(k=>'<option value="'+entEsc(k)+'"'+(k===objUi.fHost?' selected':'')+'>'+entEsc(objHostName(os.find(x=>hk(x)===k)))+'</option>').join('');
$('obj-f-type').innerHTML='<option value="">All types</option>'+Object.keys(defs).map(k=>'<option value="'+entEsc(k)+'"'+(k===objUi.fType?' selected':'')+'>'+entEsc(defs[k].label||k)+'</option>').join('');
const rows=os.filter(o=>(!objUi.fHost||hk(o)===objUi.fHost)&&(!objUi.fType||o.type===objUi.fType));
$('obj-list').innerHTML=rows.length?'<table class="etable"><tr><th>Name</th><th>Type</th><th>In</th><th></th></tr>'+rows.map(o=>'<tr data-orow="'+entEsc(o.id)+'"'+(o.id===objUi.sel?' class="on"':'')+'><td>'+entEsc(o.name||(defs[o.type]||{}).label||o.id)+'</td><td>'+entEsc((defs[o.type]||{}).label||o.type)+'</td><td>'+entEsc(objHostName(o))+'</td><td class="w" title="'+entEsc((iss[o.id]||[]).join(' '))+'">'+(iss[o.id]?'!':'')+'</td></tr>').join('')+'</table>':'<div class="mini">No objects'+(os.length?' match the filters':' yet')+'.</div>'}
function objTypesPanel(){const defs=objectDefs(g),cat=objectCatalog(),own=new Set((g.objectTypes||[]).map(t=>t.id)),used={};for(const o of g.objects||[])used[o.type]=(used[o.type]||0)+1;
if(objUi.selT&&!defs[objUi.selT])objUi.selT=null;
$('obj-types').innerHTML='<table class="etable"><tr><th>Type</th><th>Category</th><th>W x D</th><th></th></tr>'+Object.keys(defs).map(k=>{const t=defs[k];return'<tr data-otrow="'+entEsc(k)+'"'+(k===objUi.selT?' class="on"':'')+'><td>'+entEsc(t.label||k)+'</td><td>'+(t.category==='furniture'?'furniture':'appliance')+'</td><td>'+entRd(t.width)+' x '+entRd(t.depth)+'</td><td class="mini">'+(!cat[k]?'custom':own.has(k)?'edited':'')+'</td></tr>'}).join('')+'</table>';
const k=objUi.selT,t=k&&defs[k],el=$('obj-type-edit');if(!t){el.innerHTML='';return}
const n=used[k]||0,f=(key,l,v)=>'<label class="erow">'+l+' <input class="sm" data-tf="'+key+'" value="'+entRd(v)+'"></label>';
el.innerHTML='<div class="card"><h2>'+entEsc(t.label||k)+'</h2><label class="erow">Name <input data-tf="label" value="'+entEsc(t.label||'')+'"></label><label class="erow">Category <select data-tf="category"><option value="appliance"'+(t.category!=='furniture'?' selected':'')+'>appliance</option><option value="furniture"'+(t.category==='furniture'?' selected':'')+'>furniture</option></select></label>'+f('width','Width m',t.width)+f('depth','Depth m',t.depth)+f('height','Height m',t.height)+f('elevation','Elevation m',t.elevation||0)+f('clearance','Clearance m',t.clearance||0)+'<div class="mini">'+n+(n===1?' object uses':' objects use')+' this type. Objects without their own size follow these values.</div><div class="row"><button id="obj-t-copy">Copy as new type</button>'+(!cat[k]?'<button id="obj-t-del">Delete type</button>':own.has(k)?'<button id="obj-t-del">Reset to default</button>':'')+'</div></div>'}
function objPanel(){objList();objTypesPanel();
const defs=objectDefs(g),keys=Object.keys(defs),grp=c=>keys.filter(k=>(defs[k].category||'appliance')===c);
$('obj-pal').innerHTML=['appliance','furniture'].map(c=>'<div class="mini">'+(c==='appliance'?'Appliances':'Furniture')+'</div><div class="pal">'+grp(c).map(k=>'<button data-otype="'+entEsc(k)+'"'+(k===objUi.placing?' class="active"':'')+'>'+entEsc(defs[k].label||k)+'</button>').join('')+'</div>').join('');
$('obj-hint').textContent=objUi.placing?'Click inside a room or area to place the '+String((defs[objUi.placing]||{}).label||objUi.placing).toLowerCase()+' (Alt = free position, Shift = keep placing, Esc = cancel).':'Click an object to select it. Drag to move (edges snap to walls, Alt = free), edge handles resize, the round handle rotates (R = 90 degrees), arrows nudge, Ctrl+C / Ctrl+V copy and paste, Delete removes.';
const n=(g.objects||[]).length;$('obj-count').textContent=n+(n===1?' object':' objects')+' placed';
if(objUi.sel&&!objGet(objUi.sel))objUi.sel=null;const o=objGet(objUi.sel),el=$('obj-inspector');if(!o){el.innerHTML='';return}
const d=defs[o.type]||{},h=objectHost(g,o),hn=h?(h.kind==='room'?(room(h.id)||{}).name:((g.areas||[]).find(a=>a.id===h.id)||{}).name+' (area)'):'missing',
nr=(k,l,v)=>'<label class="erow">'+l+' <input class="sm" data-of="'+k+'" value="'+entRd(v)+'"></label>',
opts=keys.map(k=>'<option value="'+entEsc(k)+'"'+(k===o.type?' selected':'')+'>'+entEsc(defs[k].label||k)+'</option>').join(''),
warn=validateObjects(g).filter(i=>i.id===o.id).map(i=>'<div class="ewarn">'+entEsc(i.message)+'</div>').join('');
el.innerHTML='<div class="nm"><h2>'+entEsc(o.name||d.label||o.id)+'</h2><button id="obj-del" class="ib" title="Delete this object">'+ICON_TRASH+'</button></div><div class="card"><label class="erow">Name <input data-of="name" value="'+entEsc(o.name||'')+'" placeholder="'+entEsc(d.label||'')+'"></label><label class="erow">Type <select data-of="type">'+opts+'</select></label><div class="erow"><span>In</span><span>'+entEsc(hn||'')+'</span></div>'+
'<div class="erow2"><label>X <input class="sm" data-of="x" value="'+entRd(o.position[0])+'"></label><label>Y <input class="sm" data-of="y" value="'+entRd(o.position[1])+'"></label><span class="mini">centre, m from corner</span></div>'+
nr('width','Width m',o.width??d.width??.5)+nr('depth','Depth m',o.depth??d.depth??.5)+nr('height','Height m',o.height??d.height??.5)+nr('elevation','Elevation m',o.elevation??d.elevation??0)+nr('facingDegrees','Facing \\u00b0',o.facingDegrees??0)+warn+'</div>'+objEntHtml(o)}
function objEntHtml(o){const cat=entityCatalog(),en=(g.entityPlacements||[]).filter(e=>e.objectId===o.id),sg=entitySuggestions(o.type);
return'<div class="card"><h2>Entities</h2>'+(en.length?en.map(e=>'<div class="erow"><span>'+entEsc(e.name||(cat[e.type]||{}).label||e.type)+'</span><button class="ib" data-oent-del="'+entEsc(e.id)+'" title="Remove this entity">'+ICON_TRASH+'</button></div>').join(''):'<div class="mini">None on this object yet.</div>')+'<div class="pal">'+sg.map(t=>'<button data-oent-add="'+t+'">+ '+entEsc(cat[t].label)+'</button>').join('')+'</div><div class="mini">Move them inside the object in Entities mode; they follow the object.</div></div>'}
function objApply(r,hb){entMsg(r.message);if(!r.ok)return false;g=r.graph;if(r.id)objUi.sel=r.id;if(JSON.stringify(g)!==hb)rec(hb);return true}
function objSetPlacing(t){objUi.placing=t;document.body.dataset.oplacing=t||''}
function objPlace(P,e){const st=e.altKey?0:entStep(),sn=v=>st?Math.round(v/st)*st:v,hb=JSON.stringify(g);let r=addObject({graph:g,type:objUi.placing,wx:sn(P.x),wy:sn(P.y)});if(r.ok&&objUi.snap&&!e.altKey){const s0=objectSnap({graph:r.graph,id:r.id,wx:sn(P.x),wy:sn(P.y)});if(s0.snapped){const m=moveObject({graph:r.graph,id:r.id,wx:s0.wx,wy:s0.wy});if(m.ok)r={...r,graph:m.graph}}}if(objApply(r,hb)&&!e.shiftKey)objSetPlacing(null);render()}
function objCopy(){const o=objGet(objUi.sel),c=o&&objCenter(o);if(!o||!c){entMsg('Select an object to copy.');return}objUi.clip={o:JSON.parse(JSON.stringify(o)),x:c.x,y:c.y};entMsg('Copied '+(o.name||o.type)+'.')}
function objPaste(){const k=objUi.clip;if(!k){entMsg('Nothing copied yet.');return}const hb=JSON.stringify(g),st=entStep(),sn=v=>Math.round(v/st)*st,P=objUi.ptr,o=k.o;let r=addObject({graph:g,type:o.type,wx:P?sn(P.x):k.x+.3,wy:P?sn(P.y):k.y+.3,facingDegrees:o.facingDegrees||0});
if(r.ok){const patch={};for(const f of ['name','width','depth','height','elevation','category'])if(o[f]!==undefined)patch[f]=o[f];const u=updateObject({graph:r.graph,id:r.id,patch});if(u.ok)r={...r,graph:u.graph}}
if(objApply(r,hb))render()}
function objDelete(){if(!objUi.sel)return;const hb=JSON.stringify(g);if(objApply(removeObject({graph:g,id:objUi.sel}),hb)){objUi.sel=null;render()}}
svg.addEventListener('pointerdown',e=>{if(appMode!=='objects')return;const hd=e.target.closest('[data-ohandle]'),n=e.target.closest('[data-obj]'),P=world(e),hb=JSON.stringify(g);
if(hd&&objUi.sel){const k=hd.dataset.ohandle,o=objGet(objUi.sel),d=objectDefs(g)[o.type]||{};objUi.act={kind:k==='rot'?'rot':'rs',edge:k.slice(3),id:objUi.sel,c0:objCenter(o),w0:o.width??d.width??.5,d0:o.depth??d.depth??.5,pid:e.pointerId,before:hb};svg.setPointerCapture(e.pointerId);return}
if(n){objSetPlacing(null);const id=n.dataset.obj,c=objCenter(objGet(id));objUi.sel=id;objUi.act={kind:'move',id,dx:c?c.x-P.x:0,dy:c?c.y-P.y:0,pid:e.pointerId,before:hb};svg.setPointerCapture(e.pointerId);render();return}
if(objUi.placing){objPlace(P,e);return}
if(objUi.sel){objUi.sel=null;render()}});
svg.addEventListener('pointermove',e=>{if(appMode!=='objects'||!objUi.act||objUi.act.pid!==e.pointerId)return;const a=objUi.act,P=world(e);
if(a.kind==='move'){const st=e.altKey?0:entStep(),sn=v=>st?Math.round(v/st)*st:v,s0=objUi.snap&&!e.altKey?objectSnap({graph:g,id:a.id,wx:sn(P.x+a.dx),wy:sn(P.y+a.dy)}):{wx:sn(P.x+a.dx),wy:sn(P.y+a.dy)},r=moveObject({graph:g,id:a.id,wx:s0.wx,wy:s0.wy});if(r.ok)g=r.graph}
else if(a.kind==='rs'){const o=objGet(a.id),h=o&&objectHost(g,o);if(!o||!h)return;const f=(o.facingDegrees||0)*Math.PI/180,ca=Math.cos(f),sa=Math.sin(f),wd=a.edge==='r'||a.edge==='l',A=wd?[ca,sa]:[-sa,ca],s=a.edge==='r'||a.edge==='b'?1:-1,half=(wd?a.w0:a.d0)/2,an=[a.c0.x-s*A[0]*half,a.c0.y-s*A[1]*half],t=s*((P.x-an[0])*A[0]+(P.y-an[1])*A[1]),n=Math.min(10,Math.max(.1,e.altKey?t:+(Math.round(t/.05)*.05).toFixed(3))),C=[an[0]+s*A[0]*n/2,an[1]+s*A[1]*n/2],patch={position:[C[0]-h.x,C[1]-h.y]};patch[wd?'width':'depth']=n;const r=updateObject({graph:g,id:a.id,patch});if(r.ok)g=r.graph}
else{const o=objGet(a.id),c=o&&objCenter(o);if(!c)return;const ang=Math.atan2(P.x-c.x,-(P.y-c.y))*180/Math.PI,f=e.altKey?ang:Math.round(ang/15)*15,r=updateObject({graph:g,id:a.id,patch:{facingDegrees:(f+360)%360}});if(r.ok)g=r.graph}
render()});
function objEnd(e){if(appMode!=='objects'||!objUi.act||objUi.act.pid!==e.pointerId)return;const a=objUi.act;objUi.act=null;if(JSON.stringify(g)!==a.before)rec(a.before);render()}
svg.addEventListener('pointerup',objEnd);svg.addEventListener('pointercancel',objEnd);
document.addEventListener('keydown',e=>{if(appMode!=='objects'||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;
if(e.ctrlKey||e.metaKey){const k=e.key.toLowerCase();if(k==='c'){e.preventDefault();objCopy()}else if(k==='v'){e.preventDefault();objPaste()}return}
if(e.key==='Escape'){objSetPlacing(null);objUi.sel=null;objUi.act=null;render();return}
const o=objGet(objUi.sel);if(!o)return;
if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();objDelete();return}
const hb=JSON.stringify(g);
if(e.key.toLowerCase()==='r'){e.preventDefault();if(objApply(updateObject({graph:g,id:o.id,patch:{facingDegrees:(o.facingDegrees||0)+(e.shiftKey?-90:90)}}),hb))render();return}
const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key],c=objCenter(o);
if(d&&c){e.preventDefault();const s=entStep()*(e.shiftKey?5:1);if(objApply(moveObject({graph:g,id:o.id,wx:c.x+d[0]*s,wy:c.y+d[1]*s}),hb))render()}});
$('obj-inspector').addEventListener('change',e=>{const t=e.target.closest('[data-of]');if(!t||!objUi.sel)return;const k=t.dataset.of,hb=JSON.stringify(g),q=m=>parseFloat(t.closest('.card').querySelector('[data-of='+m+']').value);let patch={};
if(k==='x'||k==='y')patch.position=[q('x'),q('y')];else if(k==='name'||k==='type')patch[k]=t.value;else patch[k]=parseFloat(t.value);
objApply(updateObject({graph:g,id:objUi.sel,patch}),hb);render()});
$('obj-inspector').addEventListener('click',e=>{if(e.target.closest('#obj-del'))return objDelete();const a=e.target.closest('[data-oent-add]'),d=e.target.closest('[data-oent-del]'),hb=JSON.stringify(g);
if(a&&objUi.sel){const r=addEntity({graph:g,type:a.dataset.oentAdd,objectId:objUi.sel,step:entStep()});entMsg(r.message);if(r.ok){g=r.graph;rec(hb);render()}}
else if(d){const r=removeEntity({graph:g,id:d.dataset.oentDel});entMsg(r.message);if(r.ok){g=r.graph;rec(hb);render()}}});
$('obj-pal').addEventListener('click',e=>{const b=e.target.closest('[data-otype]');if(!b)return;objSetPlacing(objUi.placing===b.dataset.otype?null:b.dataset.otype);objUi.sel=null;render()});
svg.addEventListener('pointermove',e=>{if(appMode==='objects')objUi.ptr=world(e)});
$('obj-snap').onchange=e=>{objUi.snap=e.target.checked};$('obj-clr').onchange=e=>{objUi.clr=e.target.checked;render()};
$('obj-list').onclick=e=>{const r=e.target.closest('[data-orow]');if(r){objSetPlacing(null);objUi.sel=r.dataset.orow;render()}};
$('obj-f-host').onchange=e=>{objUi.fHost=e.target.value;render()};$('obj-f-type').onchange=e=>{objUi.fType=e.target.value;render()};
document.querySelectorAll('[data-otab]').forEach(b=>b.onclick=()=>{objUi.tab=b.dataset.otab;document.querySelector('.objside').dataset.tab=objUi.tab;document.querySelectorAll('[data-otab]').forEach(x=>x.classList.toggle('active',x===b))});
$('obj-types').onclick=e=>{const r=e.target.closest('[data-otrow]');if(r){objUi.selT=r.dataset.otrow;render()}};
$('obj-type-edit').addEventListener('change',e=>{const t=e.target.closest('[data-tf]');if(!t||!objUi.selT)return;const k=t.dataset.tf,hb=JSON.stringify(g),patch={};patch[k]=k==='label'||k==='category'?t.value:parseFloat(t.value);const r=updateObjectType({graph:g,id:objUi.selT,patch});entMsg(r.message);if(r.ok){g=r.graph;rec(hb)}render()});
$('obj-type-edit').addEventListener('click',e=>{const hb=JSON.stringify(g);if(e.target.closest('#obj-t-del')){const r=removeObjectType({graph:g,id:objUi.selT});entMsg(r.message);if(r.ok){g=r.graph;if(!objectDefs(g)[objUi.selT])objUi.selT=null;rec(hb);render()}}else if(e.target.closest('#obj-t-copy')){const r=addObjectType({graph:g,from:objUi.selT});entMsg(r.message);if(r.ok){g=r.graph;objUi.selT=r.id;rec(hb);render()}}});
$('obj-t-new').onclick=()=>{const hb=JSON.stringify(g),r=addObjectType({graph:g,label:'New type'});entMsg(r.message);if(r.ok){g=r.graph;objUi.selT=r.id;rec(hb);render()}};
onBeforeAppMode(m=>{objSetPlacing(null);objUi.sel=null;objUi.act=null;if(m==='objects'){selE=null;selM=new Set()}});
onRender(()=>{const h=objLayer();if(h){const l=svg.querySelector('.entlayer');if(l)l.insertAdjacentHTML('beforebegin',h);else svg.insertAdjacentHTML('beforeend',h)}if(appMode==='objects'){svg.querySelectorAll('.handle,[data-wall]').forEach(n=>n.remove());objPanel()}});
`;
