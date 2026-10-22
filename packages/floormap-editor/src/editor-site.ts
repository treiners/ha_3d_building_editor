import { areaKinds } from './areas.js';

/**
 * Site mode (`Floor plan | Site | Entities`): draw and edit the outside areas (deck, driveway, garden / plot, pond, path). Rooms and the floor plan are read-only here.
 * Own file like the entity mode: `siteCss`, `siteSideHtml` (sidebar block) and `siteJs` (script, appended after entityJs). Areas are drawn in ALL modes, flat and
 * below the rooms; they are only clickable in Site mode. Entities in an area follow it when it is moved or resized (syncEntitySizes, see entities.ts).
 * Globals used: g, $, svg, world, step, mode, view, rect, sel, selPort, active, rec, render, fit, ICON_TRASH, plus the entity script (appMode, entMsg, entEsc,
 * entSetApp, selE, selM) and the embedded pure functions of areas.ts. No backticks or dollar-brace inside siteJs.
 */
const hide = 'body[data-app=site]';
export const siteCss =
  '.siteside{display:none}body[data-app=site] .siteside{display:block}' +
  `${hide} .side>.modes,${hide} .side>#panel,${hide} .side>.sec,${hide} .side>details.card,${hide} .side>label.mini,${hide} .toolbar .seg.modern-only,${hide} #run-mapper,${hide} #close-gaps,${hide} #fit-room,${hide} #gap{display:none}` +
  `${hide} .port,${hide} .handle{pointer-events:none}${hide} .room,${hide} .label{opacity:.55}body[data-akind]:not([data-akind=""]) .canvas{cursor:crosshair}` +
  '.apal button.active{background:#17202a;color:#fff}.area{stroke-width:.05;pointer-events:none}.area.bad{stroke:#dc2626;stroke-dasharray:.2 .1}.area.sel{stroke:#f97316;stroke-width:.1}.area-label{font-size:.38px;text-anchor:middle;fill:#475569;pointer-events:none}' +
  '.ahandle{fill:#fff;stroke:#f97316;stroke-width:.06;cursor:nwse-resize}.area-draw{fill:rgba(37,99,235,.1);stroke:#2563eb;stroke-dasharray:.12 .08;stroke-width:.04;pointer-events:none}.siteside .row.mini{margin:4px 0}';

const K = areaKinds();
export const siteSideHtml =
  '<div class="siteside"><div class="entbanner">Layout locked: rooms are read-only here. Areas are flat footprints outside the house.</div><div class="card"><h2>Add area</h2><div class="pal apal">' +
  Object.keys(K).map(k => '<button data-ak="' + k + '" title="Add a ' + K[k].label.toLowerCase() + '">' + K[k].label + '</button>').join('') +
  '</div><div id="site-hint" class="mini"></div></div><div id="site-inspector"></div><div id="site-count" class="mini"></div></div>';

export const siteJs = `
const siteUi={selA:null,siteKind:null,sact:null};
const siteGet=id=>(g.areas||[]).find(a=>a.id===id);
function siteSetKind(k){siteUi.siteKind=k&&siteUi.siteKind!==k?k:null;siteUi.selA=null;siteUi.sact=null;document.body.dataset.akind=siteUi.siteKind||'';render()}
function siteLayer(){
const K=areaKinds(),as=g.areas||[],drawing=appMode==='site'&&siteUi.sact&&siteUi.sact.kind==='draw';if(!as.length&&!drawing)return'';
const bad=new Set(validateAreas(g).map(i=>i.id));
let s='<g class="arealayer"><defs><pattern id="roofhatch" width=".3" height=".3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2=".3" stroke="#64748b" stroke-width=".05" opacity=".55"/></pattern></defs>';
for(const a of as){const L=a.layout;if(!L)continue;const k=K[a.kind]||K.other,sel=appMode==='site'&&a.id===siteUi.selA,cx=L.x+L.width/2,cy=L.y+L.height/2,cls='area'+(sel?' sel':'')+(bad.has(a.id)?' bad':'');
const shape=(c,f,st)=>a.shape==='ellipse'?'<ellipse class="'+c+'" cx="'+cx+'" cy="'+cy+'" rx="'+L.width/2+'" ry="'+L.height/2+'"'+f+st+'/>':'<rect class="'+c+'" x="'+L.x+'" y="'+L.y+'" width="'+L.width+'" height="'+L.height+'" rx=".05"'+f+st+'/>';
s+=shape(cls,' fill="'+k.fill+'"',' stroke="'+k.stroke+'"');if(a.roofed)s+=shape('area-roof',' fill="url(#roofhatch)"',' stroke="none" pointer-events="none"');
s+='<text class="area-label" x="'+cx+'" y="'+(cy+.12)+'">'+entEsc(a.name||k.label)+'</text>';
if(sel){for(const c of[['tl',L.x,L.y],['tr',L.x+L.width,L.y],['bl',L.x,L.y+L.height],['br',L.x+L.width,L.y+L.height]])s+='<circle class="ahandle" data-ahandle="'+c[0]+'" cx="'+c[1]+'" cy="'+c[2]+'" r=".14"/>'}}
if(drawing)s+='<rect class="area-draw" x="'+Math.min(siteUi.sact.x0,siteUi.sact.x1)+'" y="'+Math.min(siteUi.sact.y0,siteUi.sact.y1)+'" width="'+Math.abs(siteUi.sact.x1-siteUi.sact.x0)+'" height="'+Math.abs(siteUi.sact.y1-siteUi.sact.y0)+'"/>';
return s+'</g>'}
function sitePanel(){
const K=areaKinds();document.querySelectorAll('[data-ak]').forEach(b=>b.classList.toggle('active',b.dataset.ak===siteUi.siteKind));
$('site-hint').textContent=siteUi.siteKind?'Click to drop a '+K[siteUi.siteKind].label.toLowerCase()+' ('+K[siteUi.siteKind].size.join(' x ')+' m) or drag a rectangle (Shift = keep adding, Alt = free position, Esc = cancel).':'Click an area to select it, drag to move, use the corner handles to resize. Pick a kind above to add one.';
const n=(g.areas||[]).length;$('site-count').textContent=n+(n===1?' area':' areas');
if(siteUi.selA&&!siteGet(siteUi.selA))siteUi.selA=null;const a=siteGet(siteUi.selA),el=$('site-inspector');if(!a){el.innerHTML='';return}
const num=(k,l,v)=>'<label>'+l+' <input class="sm" data-sf="'+k+'" value="'+entRd(v)+'"></label>',opts=(list,cur)=>list.map(o=>'<option value="'+o[0]+'"'+(o[0]===cur?' selected':'')+'>'+o[1]+'</option>').join(''),L=a.layout;
const inside=(g.entityPlacements||[]).filter(e=>e.areaId===a.id).length,warn=validateAreas(g).filter(i=>i.id===a.id).map(i=>'<div class="ewarn">'+entEsc(i.message)+'</div>').join('');
el.innerHTML='<div class="nm"><h2>'+entEsc(a.name)+'</h2><button id="site-del" class="ib" title="Delete this area">'+ICON_TRASH+'</button></div><div class="card"><label class="erow">Name <input data-sf="name" value="'+entEsc(a.name)+'"></label>'+
'<label class="erow">Kind <select data-sf="kind">'+opts(Object.keys(K).map(k=>[k,K[k].label]),a.kind)+'</select></label><label class="erow">Shape <select data-sf="shape">'+opts([['rect','Rectangle'],['ellipse','Ellipse']],a.shape)+'</select></label>'+
'<div class="erow2">'+num('x','X',L.x)+num('y','Y',L.y)+'</div><div class="erow2">'+num('width','W',L.width)+num('height','H',L.height)+'<span class="mini">m</span></div>'+
'<label class="row"><input type="checkbox" data-sf="roofed"'+(a.roofed?' checked':'')+'> Roofed (carport, pergola)</label><div class="mini">'+inside+(inside===1?' entity':' entities')+' in this area</div>'+warn+'</div>'}
svg.addEventListener('pointerdown',e=>{if(appMode!=='site')return;const hnd=e.target.closest('[data-ahandle]'),P=world(e),before=JSON.stringify(g);
if(hnd&&siteUi.selA){siteUi.sact={kind:'resize',corner:hnd.dataset.ahandle,L0:{...siteGet(siteUi.selA).layout},pid:e.pointerId,before};svg.setPointerCapture(e.pointerId);return}
if(siteUi.siteKind){siteUi.sact={kind:'draw',x0:P.x,y0:P.y,x1:P.x,y1:P.y,pid:e.pointerId,before};svg.setPointerCapture(e.pointerId);render();return}
const inRoom=g.rooms.some(r=>r.layout&&r.name.toLowerCase()!=='outside'&&P.x>=r.layout.x&&P.x<=r.layout.x+r.layout.width&&P.y>=r.layout.y&&P.y<=r.layout.y+r.layout.height),a=inRoom?null:areaAt(g,P.x,P.y);
if(a){siteUi.selA=a.id;siteUi.sact={kind:'move',id:a.id,x0:P.x,y0:P.y,L0:{...a.layout},pid:e.pointerId,before};svg.setPointerCapture(e.pointerId)}else siteUi.selA=null;
render()});
svg.addEventListener('pointermove',e=>{if(appMode!=='site'||!siteUi.sact||siteUi.sact.pid!==e.pointerId)return;const P=world(e),sn=v=>e.altKey?v:Math.round(v/step)*step;
if(siteUi.sact.kind==='draw'){siteUi.sact.x1=P.x;siteUi.sact.y1=P.y}
else if(siteUi.sact.kind==='move'){const r=updateArea({graph:g,id:siteUi.sact.id,patch:{x:sn(siteUi.sact.L0.x+P.x-siteUi.sact.x0),y:sn(siteUi.sact.L0.y+P.y-siteUi.sact.y0)}});if(r.ok)g=r.graph}
else{const L=siteUi.sact.L0,c=siteUi.sact.corner,x2=L.x+L.width,y2=L.y+L.height,px=sn(P.x),py=sn(P.y);let x=L.x,y=L.y,w=L.width,h=L.height;
if(c==='tl'||c==='bl'){x=Math.min(px,x2-.5);w=x2-x}else w=Math.max(.5,px-L.x);
if(c==='tl'||c==='tr'){y=Math.min(py,y2-.5);h=y2-y}else h=Math.max(.5,py-L.y);
const r=updateArea({graph:g,id:siteUi.selA,patch:{x,y,width:w,height:h}});if(r.ok)g=r.graph}
render()});
function siteEnd(e){if(appMode!=='site'||!siteUi.sact||siteUi.sact.pid!==e.pointerId)return;const a=siteUi.sact;siteUi.sact=null;
if(a.kind==='draw'){const st=e.altKey?0:step,x=Math.min(a.x0,a.x1),y=Math.min(a.y0,a.y1),w=Math.abs(a.x1-a.x0),h=Math.abs(a.y1-a.y0),res=(w<.4&&h<.4)?addArea({graph:g,kind:siteUi.siteKind,at:{x:a.x0,y:a.y0},snap:st}):addArea({graph:g,kind:siteUi.siteKind,layout:{x,y,width:w,height:h},snap:st});
entMsg(res.message);if(res.ok){g=res.graph;siteUi.selA=res.id;rec(a.before);if(!e.shiftKey){siteUi.siteKind=null;document.body.dataset.akind=''}}}
else rec(a.before);
render()}
svg.addEventListener('pointerup',siteEnd);svg.addEventListener('pointercancel',siteEnd);
function siteDelete(){const hb=JSON.stringify(g),r=removeArea({graph:g,id:siteUi.selA});entMsg(r.message);if(r.ok){g=r.graph;siteUi.selA=null;rec(hb);render()}}
document.addEventListener('keydown',e=>{if(appMode!=='site'||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.ctrlKey||e.metaKey)return;
if(e.key==='Escape'){siteUi.siteKind=null;siteUi.selA=null;siteUi.sact=null;document.body.dataset.akind='';render()}else if((e.key==='Delete'||e.key==='Backspace')&&siteUi.selA){e.preventDefault();siteDelete()}});
$('site-inspector').addEventListener('change',e=>{const t=e.target.closest('[data-sf]');if(!t||!siteUi.selA)return;const k=t.dataset.sf,hb=JSON.stringify(g),patch={};
if(k==='roofed')patch.roofed=t.checked;else if(k==='name'||k==='kind'||k==='shape')patch[k]=t.value;else patch[k]=parseFloat(t.value);
const r=updateArea({graph:g,id:siteUi.selA,patch});entMsg(r.message);if(r.ok){g=r.graph;rec(hb)}render()});
$('site-inspector').addEventListener('click',e=>{if(e.target.closest('#site-del'))siteDelete()});
document.querySelectorAll('[data-ak]').forEach(b=>b.onclick=()=>siteSetKind(b.dataset.ak));
onBeforeAppMode(m=>{siteUi.siteKind=null;siteUi.selA=null;siteUi.sact=null;document.body.dataset.akind='';if(m==='site'){selE=null;selM=new Set()}});
// Fit (view bounds, including areas) is defined once, in the floors module.
onRender(()=>{let n=svg.querySelector('[data-room]');while(n&&n.parentNode!==svg)n=n.parentNode;const h=siteLayer();if(h){if(n)n.insertAdjacentHTML('beforebegin',h);else svg.insertAdjacentHTML('beforeend',h)}if(appMode==='site')sitePanel()});
`;
