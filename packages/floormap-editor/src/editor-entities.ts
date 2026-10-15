import { entityCatalog } from './entities.js';

/**
 * Entity mode of the editor (place lights, motion sensors, door contacts). Kept in its own file so editor.ts only
 * needs a few hooks: `entityCss` (all selectors scoped, no bare element selectors), `entitySwitchHtml` (header
 * switch), `entitySideHtml` (sidebar block) and `entityJs` (script, appended last inside the editor script).
 * The script relies on the editor globals: g, $, svg, sel, selPort, mode, active, world, port, ports, linkFor, room,
 * rec, render, ICON_TRASH, plus the embedded pure functions of entities.ts. No backticks or dollar-brace in entityJs.
 * The floor plan is read-only in this mode: the editor's own pointerdown handler returns early (hook in editor.ts).
 */
const ICONS: Record<string, string> = {
  light: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.4.4.5 1 .5 1.6h6c0-.6.1-1.2.5-1.6A6 6 0 0012 3z',
  'motion-sensor': 'M5 13a7 7 0 0114 0M8.5 13a3.5 3.5 0 017 0M12 17v.01',
  'door-contact': 'M4 7h6v10H4zM14 7h6v10h-6zM11 12h2',
  'window-contact': 'M5 4h14v16H5zM12 4v16M5 12h14',
  'water-leak': 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  'environment-sensor': 'M10 14.5V5a2 2 0 014 0v9.5a4 4 0 11-4 0z',
  'smoke-detector': 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z',
  camera: 'M4 7h11a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2zM17 11l5-3v8l-5-3',
  thermostat: 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 12l3-3',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  cover: 'M4 4h16v4H4zM4 11h16M4 14h16M4 17h16M12 17v3',
};

export const entityCss =
  '.appsw{display:flex;margin:8px 0}.appsw button{flex:1;margin:0;border:1px solid #cbd5e1;background:#fff}.appsw .active{background:#17202a;color:#fff}' +
  '.entside{display:none}body[data-app=entities] .entside{display:block}' +
  '.entbanner{background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:6px;padding:4px 8px;font-size:12px;margin:6px 0}' +
  '.pal{display:flex;gap:6px;flex-wrap:wrap}.pal button{margin:0;border:1px solid #cbd5e1;background:#fff}.pal button.active{background:#17202a;color:#fff}' +
  '.erow{display:flex;justify-content:space-between;align-items:center;gap:6px;margin:4px 0}.erow input{width:58%}.erow input.sm{width:70px}.erow2{display:flex;gap:10px;margin:4px 0}.emulti{flex-wrap:wrap}.erow2 label{display:flex;gap:4px;align-items:center}.erow2 input{width:70px}.ewarn{color:#b91c1c;font-size:12px;margin-top:4px}' +
  'body[data-app=entities] .side>.modes,body[data-app=entities] .side>#panel,body[data-app=entities] .side>.sec,body[data-app=entities] .side>details.card,body[data-app=entities] .side>label.mini,body[data-app=entities] .toolbar .seg.modern-only,body[data-app=entities] #run-mapper,body[data-app=entities] #close-gaps,body[data-app=entities] #fit-room,body[data-app=entities] #gap{display:none}' +
  'body[data-app=entities] .port,body[data-app=entities] .handle{pointer-events:none}body[data-app=entities] .room,body[data-app=entities] .label{opacity:.55}body[data-placing]:not([data-placing=""]) .canvas{cursor:crosshair}' +
  '.ent{cursor:grab}.ent circle{fill:#fff;stroke:#17202a;stroke-width:.04}.ent path{fill:none;stroke:#17202a;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ent.sel circle{stroke:#f97316;stroke-width:.07}.ent.bad circle{stroke:#dc2626}' +
  '.ent-label{font-size:.34px;text-anchor:middle;fill:#17202a;pointer-events:none;paint-order:stroke;stroke:#fff;stroke-width:.08}.ent-cone{fill:rgba(20,184,166,.14);stroke:#0d9488;stroke-width:.02;pointer-events:none}.ent-cone.sel{fill:rgba(20,184,166,.28);stroke-width:.04}' +
  '.ent-h{fill:#fff;stroke:#0d9488;stroke-width:.05;cursor:grab}.ent-hl{stroke:#0d9488;stroke-width:.03;stroke-dasharray:.1 .08;pointer-events:none}.ent-target{fill:rgba(249,115,22,.18);stroke:#f97316;stroke-width:.05;pointer-events:none}.ent-outside{fill:none;stroke:#94a3b8;stroke-dasharray:.2 .15;stroke-width:.04;pointer-events:none}' +
  '.ent-ring{fill:none;stroke:#f97316;stroke-width:.05;stroke-dasharray:.1 .08;pointer-events:none}.entside [data-epane]{display:none}.entside[data-tab=place] [data-epane=place],.entside[data-tab=list] [data-epane=list]{display:block}' +
  '.etable{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0}.etable td,.etable th{padding:3px 4px;border-bottom:1px solid #e2e8f0;text-align:left}.etable tr[data-erow]{cursor:pointer}.etable tr.on{background:#fff1c9}.etable .w{color:#b91c1c}.efilters{display:flex;gap:6px}.efilters select{flex:1}.entside .ewarn[data-erow]{cursor:pointer}';

export const entitySwitchHtml = '<div class="appsw"><button data-app-btn="plan" class="active">Floor plan</button><button data-app-btn="entities">Entities</button></div>';

const cat = entityCatalog();
export const entitySideHtml =
  '<div class="entside" data-tab="place"><div class="entbanner">Layout locked: the floor plan is read-only in this mode.</div><div class="modes"><button data-etab="place" class="active">Place</button><button data-etab="list">List</button></div><div data-epane="place"><h2>Place</h2><div class="pal">' +
  Object.keys(cat).map(k => '<button data-ptype="' + k + '" title="Place a ' + cat[k].label.toLowerCase() + '"><svg class="ic" viewBox="0 0 24 24"><path d="' + ICONS[k] + '"/></svg> ' + cat[k].label + '</button>').join('') +
  '</div><div id="ent-hint" class="mini"></div><label class="row"><input id="ent-cov" type="checkbox"> Show coverage of all sensors</label><label class="row">On room resize <select id="ent-resize"><option value="proportional">scale proportionally</option><option value="anchor">keep distance to corner</option></select></label></div><div data-epane="list"><h2>Entities</h2><div class="efilters"><select id="ent-f-room"></select><select id="ent-f-type"></select></div><div id="ent-list"></div><details id="ent-diag" class="card"><summary id="ent-diag-sum"></summary><div id="ent-diag-body"></div></details></div><div id="ent-inspector"></div><div id="ent-count" class="mini"></div></div>';

export const entityJs = `
let appMode='plan',selE=null,placing=null,eact=null,entCov=false,entTab='place',fRoom='',fType='',entSizes=null;
const ENT_ICONS=${JSON.stringify(ICONS)};
const entEsc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),entRd=v=>+(+v).toFixed(3);
const entList=()=>g.entityPlacements||[],entGet=id=>entList().find(e=>e.id===id);
const entStep=()=>{const s=g.entitySettings&&+g.entitySettings.gridStep;return s>0?s:.1};
function entLoad(){if(g.entitySettings&&g.entitySettings.coordinates==='plan')g=convertEntityCoordinates(g,'room');selE=null;entSizes=null}
entLoad();
function entMsg(t){$('status').textContent=t}
function entApply(res,hb,keepSel){entMsg(res.message);if(!res.ok)return false;g=res.graph;if(!keepSel)selE=res.id;rec(hb);return true}
function entPartnerHas(t,cid){const l=linkFor(cid),ids=[cid];if(l)ids.push(l.connectorA===cid?l.connectorB:l.connectorA);return entList().some(e=>e.type===t&&ids.includes(e.connectorId))}
function entSetApp(m){appMode=m;document.body.dataset.app=m;for(const b of document.querySelectorAll('[data-app-btn]'))b.classList.toggle('active',b.dataset.appBtn===m);placing=null;eact=null;active=null;document.body.dataset.placing='';if(m==='entities'){sel.clear();selPort=null;mode='mapping';$('mapping').classList.add('active');$('gap').classList.remove('active');$('tool').value='rooms';entMsg('Entities: the floor plan is locked. Pick a type to place, or click an entity.')}else{selE=null;entMsg('Floor plan editing.')}render()}
function entLayer(){
if(appMode!=='entities')return'';
if(selE&&!entGet(selE))selE=null;
const cat=entityCatalog(),bad=new Set(validateEntities(g).map(i=>i.id));let ou='',cone='',mk='',hd='',tg='';
for(const r of g.rooms)if(r.layout&&r.name.toLowerCase()==='outside')ou+='<rect class="ent-outside" x="'+r.layout.x+'" y="'+r.layout.y+'" width="'+r.layout.width+'" height="'+r.layout.height+'"/>';
for(const e of entList()){const w=entityWorld(g,e);if(!w)continue;const c=cat[e.type]||{},s=e.id===selE;
if(c.directional&&(s||entCov)){const p=coverageSector(w.x,w.y,e.facingDegrees??0,e.fieldOfViewDegrees??100,e.range??3.5);cone+='<polygon class="ent-cone'+(s?' sel':'')+'" points="'+p.map(q=>q.join(',')).join(' ')+'"/>'}
mk+='<g class="ent'+(s?' sel':'')+(bad.has(e.id)?' bad':'')+'" data-ent="'+entEsc(e.id)+'" transform="translate('+w.x+','+w.y+')"><circle r=".24"/><path d="'+(ENT_ICONS[e.type]||'M12 12v.01')+'" transform="scale(.018) translate(-12,-12)"/></g>';
if(s)mk+='<circle class="ent-ring" cx="'+w.x+'" cy="'+w.y+'" r=".42"/>';if(s)mk+='<text class="ent-label" x="'+w.x+'" y="'+(w.y+.55)+'">'+entEsc(e.name||e.id)+'</text>';
if(s&&c.directional){const f=e.facingDegrees||0,fv=e.fieldOfViewDegrees||100,rg=e.range||3.5,pt=(a,d)=>[w.x+d*Math.sin(a*Math.PI/180),w.y-d*Math.cos(a*Math.PI/180)],hf=pt(f,Math.min(.6,rg*.6)),hr=pt(f,rg),hv=pt(f+fv/2,rg);
hd+='<line class="ent-hl" x1="'+w.x+'" y1="'+w.y+'" x2="'+hr[0]+'" y2="'+hr[1]+'"/><circle class="ent-h" data-ehandle="facing" cx="'+hf[0]+'" cy="'+hf[1]+'" r=".12"><title>Facing</title></circle><circle class="ent-h" data-ehandle="range" cx="'+hr[0]+'" cy="'+hr[1]+'" r=".1"><title>Range</title></circle><circle class="ent-h" data-ehandle="fov" cx="'+hv[0]+'" cy="'+hv[1]+'" r=".1"><title>Field of view</title></circle>'}}
if(placing&&cat[placing].anchor==='connector')for(const p of ports()){if(cat[placing].connectorTypes.indexOf(p.type)<0||entPartnerHas(placing,p.id))continue;const w=entityWorld(g,{connectorId:p.id});if(w)tg+='<circle class="ent-target" cx="'+w.x+'" cy="'+w.y+'" r=".34"/>'}
return'<g class="entlayer">'+ou+cone+mk+hd+tg+'</g>'}
function entParent(e){if(e.roomId){const r=room(e.roomId);return r?r.name:e.roomId+' (missing)'}const p=port(e.connectorId);return p?room(p.roomId).name+': '+p.side+' '+p.type:e.connectorId+' (missing)'}
function entListPanel(){
const cat=entityCatalog(),issues=validateEntities(g),bad=new Set(issues.map(i=>i.id)),own=e=>e.roomId||(port(e.connectorId)||{}).roomId,rooms=[...new Set(entList().map(own).filter(Boolean))];
if(fRoom&&rooms.indexOf(fRoom)<0)fRoom='';
$('ent-f-room').innerHTML='<option value="">All rooms</option>'+rooms.map(id=>'<option value="'+entEsc(id)+'"'+(id===fRoom?' selected':'')+'>'+entEsc((room(id)||{name:id}).name)+'</option>').join('');
$('ent-f-type').innerHTML='<option value="">All types</option>'+Object.keys(cat).map(k=>'<option value="'+k+'"'+(k===fType?' selected':'')+'>'+cat[k].label+'</option>').join('');
const rows=entList().filter(e=>(!fRoom||own(e)===fRoom)&&(!fType||e.type===fType));
$('ent-list').innerHTML=rows.length?'<table class="etable"><tr><th>Name</th><th>Type</th><th>Parent</th><th>HA</th><th></th></tr>'+rows.map(e=>'<tr data-erow="'+entEsc(e.id)+'"'+(e.id===selE?' class="on"':'')+'><td>'+entEsc(e.name||e.id)+'</td><td>'+entEsc((cat[e.type]||{}).label||e.type)+'</td><td>'+entEsc(entParent(e))+'</td><td>'+entEsc(e.haEntityId||'')+'</td><td class="w">'+(bad.has(e.id)?'\\u26a0':'')+'</td></tr>').join('')+'</table>':'<div class="mini">No entities'+(entList().length?' match the filters':' yet')+'.</div>';
$('ent-diag-sum').textContent='Diagnostics ('+issues.length+')';
$('ent-diag-body').innerHTML=issues.length?issues.map(i=>'<div class="ewarn" data-erow="'+entEsc(i.id)+'">'+entEsc(i.id+': '+i.message)+'</div>').join(''):'<div class="mini">No problems found.</div>'}
function entPanel(){entListPanel();$('ent-resize').value=(g.entitySettings&&g.entitySettings.resize)||'proportional';
document.querySelectorAll('[data-ptype]').forEach(b=>b.classList.toggle('active',b.dataset.ptype===placing));
const cat=entityCatalog();
$('ent-hint').textContent=placing?(cat[placing].anchor==='room'?'Click inside a room to place the '+cat[placing].label.toLowerCase()+' (Alt = free position, Shift = keep placing, Esc = cancel).':'Click a highlighted '+cat[placing].connectorTypes.join(' or ')+' (Esc = cancel).'):'';
const n=entList().length;$('ent-count').textContent=n+(n===1?' entity':' entities')+' placed';
const el=$('ent-inspector'),e=entGet(selE);
if(!e){el.innerHTML='';return}
const c=cat[e.type]||{},tx=(k,l,v,ph)=>'<label class="erow">'+l+' <input data-ef="'+k+'" value="'+entEsc(v??'')+'" placeholder="'+(ph||'')+'"></label>',nm=(k,l,v)=>'<label>'+l+' <input class="sm" data-ef="'+k+'" value="'+v+'"></label>',nr=(k,l,v)=>'<label class="erow">'+l+' <input class="sm" data-ef="'+k+'" value="'+v+'"></label>';
let parent;if(e.roomId){const r=room(e.roomId);parent=r?r.name:e.roomId+' (missing)'}else{const p=port(e.connectorId);parent=p?room(p.roomId).name+': '+p.side+' '+p.type:e.connectorId+' (missing)'}
const w=issues=>issues.map(i=>'<div class="ewarn">'+entEsc(i.message)+'</div>').join('');
el.innerHTML='<div class="nm"><h2>'+entEsc(e.name||e.id)+'</h2><button id="ent-del" class="ib" title="Remove this entity">'+ICON_TRASH+'</button></div><div class="card">'+tx('name','Name',e.name,'optional')+tx('id','Id',e.id)+tx('haEntityId','HA entity',e.haEntityId,'light.living_ceiling')+'<div class="erow"><span>Type</span><span>'+entEsc(c.label||e.type)+'</span></div><div class="erow"><span>Parent</span><span>'+entEsc(parent)+'</span></div>'+
(e.roomId?'<div class="erow2">'+nm('x','X',e.position?entRd(e.position[0]):0)+nm('y','Y',e.position?entRd(e.position[1]):0)+'<span class="mini">m from corner</span></div>'+nr('height','Height m',e.height??''):'')+
(c.directional?nr('facingDegrees','Facing \\u00b0',e.facingDegrees??0)+nr('fieldOfViewDegrees','Field of view \\u00b0',e.fieldOfViewDegrees??100)+nr('range','Range m',e.range??3.5):'')+(c.multi?'<div class="mini">Measures</div><div class="erow2 emulti">'+c.multi.options.map(o=>'<label><input type="checkbox" data-em="'+c.multi.field+'" data-opt="'+o+'"'+((e[c.multi.field]||[]).indexOf(o)>=0?' checked':'')+'> '+o+'</label>').join('')+'</div>':'')+(e.roomId&&g.entitySettings&&g.entitySettings.resize==='anchor'?'<label class="erow">Anchor corner <select data-ef="anchorCorner"><option value="">auto</option>'+['tl','tr','bl','br'].map(k=>'<option'+(e.anchorCorner===k?' selected':'')+'>'+k+'</option>').join('')+'</select></label>':'')+w(validateEntities(g).filter(i=>i.id===e.id))+'</div>'}
function entField(t){const e=entGet(selE);if(!e)return;const k=t.dataset.ef,hb=JSON.stringify(g),q=n=>parseFloat(t.closest('.card').querySelector('[data-ef='+n+']').value);let patch={};
if(k==='x'||k==='y')patch.position=[q('x'),q('y')];else if(k==='name'||k==='id'||k==='haEntityId'||k==='anchorCorner')patch[k]=t.value;else patch[k]=parseFloat(t.value);
const r=updateEntity({graph:g,id:e.id,patch});if(entApply(r,hb))selE=r.id;render()}
function entDelete(){const hb=JSON.stringify(g);if(entApply(removeEntity({graph:g,id:selE}),hb,true)){selE=null;render()}}
function entPlace(P,e){const t=placing,hb=JSON.stringify(g),a=nearestAnchor(g,t,P.x,P.y,.8);
if(!a){entMsg('Click a highlighted '+entityCatalog()[t].connectorTypes.join(' or ')+'.');return}
let res;if(a.connectorId){if(entPartnerHas(t,a.connectorId)){entMsg('This '+entityCatalog()[t].connectorTypes.join(' or ')+' already has a '+entityCatalog()[t].label.toLowerCase()+'.');return}res=addEntity({graph:g,type:t,connectorId:a.connectorId})}else res=addEntity({graph:g,type:t,roomId:a.roomId,at:P,step:e.altKey?0:entStep()});
if(entApply(res,hb)&&!e.shiftKey)placing=null;document.body.dataset.placing=placing||'';render()}
function entDown(e){const h=e.target.closest('[data-ehandle]'),n=e.target.closest('[data-ent]');
if(h&&selE){eact={kind:'handle',h:h.dataset.ehandle,pid:e.pointerId,before:JSON.stringify(g)};svg.setPointerCapture(e.pointerId);return}
if(n){selE=n.dataset.ent;placing=null;document.body.dataset.placing='';const en=entGet(selE);eact={kind:'move',id:selE,pid:e.pointerId,before:JSON.stringify(g),fixed:!!(en&&en.connectorId)};svg.setPointerCapture(e.pointerId);render();return}
const P=world(e);if(placing){entPlace(P,e);return}
if(selE){selE=null;render()}}
function entMove(e){if(appMode!=='entities'||!eact||eact.pid!==e.pointerId)return;const P=world(e),st=e.altKey?0:entStep();
if(eact.kind==='move'){if(eact.fixed)return;const r=moveEntity({graph:g,id:eact.id,x:P.x,y:P.y,step:st});if(r.ok){g=r.graph;entMsg(r.message)}}
else{const en=entGet(selE),w=en&&entityWorld(g,en);if(!w)return;const dx=P.x-w.x,dy=P.y-w.y,ang=Math.atan2(dx,-dy)*180/Math.PI,k=eact.h,a5=v=>e.altKey?v:Math.round(v/5)*5;let patch={};
if(k==='facing')patch.facingDegrees=a5((ang+360)%360);else if(k==='range')patch.range=Math.round(Math.hypot(dx,dy)*10)/10;else if(k==='fov')patch.fieldOfViewDegrees=a5(Math.abs(((ang-(en.facingDegrees||0))%360+540)%360-180)*2);
const r=updateEntity({graph:g,id:selE,patch});if(r.ok)g=r.graph}
render()}
function entEnd(e){if(appMode!=='entities'||!eact||eact.pid!==e.pointerId)return;const b=eact.before;eact=null;rec(b);render()}
svg.addEventListener('pointerdown',e=>{if(appMode==='entities')entDown(e)});svg.addEventListener('pointermove',entMove);svg.addEventListener('pointerup',entEnd);svg.addEventListener('pointercancel',entEnd);
document.addEventListener('keydown',e=>{if(appMode!=='entities'||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.ctrlKey||e.metaKey)return;
if(e.key==='Escape'){placing=null;document.body.dataset.placing='';selE=null;render();return}
const en=entGet(selE);if(!en)return;
if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();entDelete();return}
const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
if(d&&en.roomId){e.preventDefault();const w=entityWorld(g,en),s=entStep()*(e.shiftKey?5:1),hb=JSON.stringify(g);if(entApply(moveEntity({graph:g,id:en.id,x:w.x+d[0]*s,y:w.y+d[1]*s,step:entStep()}),hb,true))render()}});
$('ent-inspector').addEventListener('change',e=>{const t=e.target.closest('[data-ef]');if(t)return entField(t);const m=e.target.closest('[data-em]'),en=m&&entGet(selE);if(en){const hb=JSON.stringify(g),f=m.dataset.em,v=[...document.querySelectorAll('[data-em='+f+']')].filter(x=>x.checked).map(x=>x.dataset.opt);entApply(updateEntity({graph:g,id:en.id,patch:{[f]:v}}),hb,true);render()}});
$('ent-resize').onchange=e=>{const hb=JSON.stringify(g);g.entitySettings={...(g.entitySettings||{}),resize:e.target.value};rec(hb);render()};
$('ent-inspector').addEventListener('click',e=>{if(e.target.closest('#ent-del'))entDelete()});
document.querySelectorAll('[data-ptype]').forEach(b=>b.onclick=()=>{placing=placing===b.dataset.ptype?null:b.dataset.ptype;selE=null;document.body.dataset.placing=placing||'';render()});
document.querySelectorAll('[data-app-btn]').forEach(b=>b.onclick=()=>entSetApp(b.dataset.appBtn));
document.querySelectorAll('[data-etab]').forEach(b=>b.onclick=()=>{entTab=b.dataset.etab;document.querySelector('.entside').dataset.tab=entTab;document.querySelectorAll('[data-etab]').forEach(x=>x.classList.toggle('active',x===b))});
$('ent-list').onclick=$('ent-diag-body').onclick=e=>{const r=e.target.closest('[data-erow]');if(r){selE=r.dataset.erow;placing=null;document.body.dataset.placing='';render()}};
$('ent-f-room').onchange=e=>{fRoom=e.target.value;render()};$('ent-f-type').onchange=e=>{fType=e.target.value;render()};
$('ent-cov').onchange=e=>{entCov=e.target.checked;render()};
{const rs0=restore;restore=function(s,l){entSizes=null;rs0(s,l)};const r0=render;render=function(){const sy=syncEntitySizes(g,entSizes);if(sy.changed)g=sy.graph;entSizes=sy.sizes;r0();if(appMode!=='entities')return;svg.querySelectorAll('.handle,[data-wall]').forEach(n=>n.remove());svg.insertAdjacentHTML('beforeend',entLayer());entPanel()}}
`;
