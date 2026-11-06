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
  '.apal button.active{background:#17202a;color:#fff}.awall{stroke:transparent;stroke-width:12px;vector-effect:non-scaling-stroke;pointer-events:stroke}.awall.awx{cursor:ew-resize}.awall.awy{cursor:ns-resize}.awall:hover{stroke:rgba(249,115,22,.4)}.area.selx{stroke:#2563eb;stroke-width:.1;stroke-dasharray:.2 .1}.area{stroke-width:.05;pointer-events:none}.area.bad{stroke:#dc2626;stroke-dasharray:.2 .1}.area.sel{stroke:#f97316;stroke-width:.1}.area-label{font-size:.38px;text-anchor:middle;fill:#475569;pointer-events:none}' +
  '.ahandle{fill:#fff;stroke:#f97316;stroke-width:.06;cursor:nwse-resize}.tree-c{fill:#166534;stroke:#fff;stroke-width:.04;pointer-events:none}body[data-app=site] .tree-c{pointer-events:auto;cursor:grab}.tree-c.sel{stroke:#f97316;stroke-width:.07}.tree-c.bad{fill:#dc2626}.area.tree{fill-opacity:.4}.area-draw{fill:rgba(37,99,235,.1);stroke:#2563eb;stroke-dasharray:.12 .08;stroke-width:.04;pointer-events:none}.siteside .row.mini{margin:4px 0}';

const K = areaKinds();
export const siteSideHtml =
  '<div class="siteside"><div class="entbanner">Layout locked: rooms are read-only here. Areas are flat footprints outside the house.</div><div class="card"><h2>Add area</h2><div class="pal apal">' +
  Object.keys(K).map(k => '<button data-ak="' + k + '" title="Add a ' + K[k].label.toLowerCase() + '">' + K[k].label + '</button>').join('') +
  '</div><div id="site-hint" class="mini"></div><label class="row mini">Bump / notch width <input id="site-bump" class="sm" value="1"> m</label></div><div id="site-inspector"></div><div id="site-count" class="mini"></div></div>';

export const siteJs = `
const siteUi={selA:null,selX:null,siteKind:null,sact:null,canopy:true};
const siteGet=id=>(g.areas||[]).find(a=>a.id===id);
const siteEdges=()=>{const xs=[],ys=[],add=(L,o)=>{for(const w of outlineWalls(o)){if(w.side==='left'||w.side==='right')xs.push(L.x+w.at);else ys.push(L.y+w.at)}};for(const r of g.rooms){if(!r.layout||r.name.toLowerCase()==='outside')continue;add(r.layout,shapeOfRoom(r))}for(const a of g.areas||[]){if(!a.layout||a.id===siteUi.selA||a.kind==='tree')continue;add(a.layout,areaOutlineOf(a))}return{xs,ys}};
const siteTol=()=>{const w=svg.clientWidth;return Math.max(.3,w?view.w/w*12:0)};
const siteNear=(vs,es)=>{const tol=siteTol();let b=null;for(const v of vs)for(const q of es){const d=q-v;if(Math.abs(d)<=tol&&(b===null||Math.abs(d)<Math.abs(b)))b=d}return b};
function siteSetKind(k){siteUi.siteKind=k&&siteUi.siteKind!==k?k:null;siteUi.selA=null;siteUi.sact=null;document.body.dataset.akind=siteUi.siteKind||'';render()}
function siteLayer(){
const K=areaKinds(),as=g.areas||[],drawing=appMode==='site'&&siteUi.sact&&siteUi.sact.kind==='draw';if(!as.length&&!drawing)return'';
const bad=new Set(validateAreas(g).map(i=>i.id));
let s='<g class="arealayer"><defs><pattern id="roofhatch" width=".3" height=".3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2=".3" stroke="#64748b" stroke-width=".05" opacity=".55"/></pattern></defs>';
for(const a of as){const L=a.layout;if(!L||a.kind==='tree')continue;const k=K[a.kind]||K.other,sel=appMode==='site'&&a.id===siteUi.selA,cx=L.x+L.width/2,cy=L.y+L.height/2,cls='area'+(sel?' sel':'')+(appMode==='site'&&a.id===siteUi.selX?' selx':'')+(bad.has(a.id)?' bad':''),ol=a.shape!=='ellipse'&&a.outline&&a.outline.length>4?a.outline:null,lr=ol?outlineLabelRect(ol):null,lx=lr?L.x+lr.x+lr.width/2:cx,ly=lr?L.y+lr.y+lr.height/2:cy;
const shape=(c,f,st)=>ol?'<path class="'+c+'" d="M'+ol.map(p=>(L.x+p[0])+' '+(L.y+p[1])).join('L')+'Z"'+f+st+'/>':a.shape==='ellipse'?'<ellipse class="'+c+'" cx="'+cx+'" cy="'+cy+'" rx="'+L.width/2+'" ry="'+L.height/2+'"'+f+st+'/>':'<rect class="'+c+'" x="'+L.x+'" y="'+L.y+'" width="'+L.width+'" height="'+L.height+'" rx=".05"'+f+st+'/>';
s+=shape(cls,' fill="'+k.fill+'"',' stroke="'+k.stroke+'"');if(a.roofed)s+=shape('area-roof',' fill="url(#roofhatch)"',' stroke="none" pointer-events="none"');
s+='<text class="area-label" x="'+lx+'" y="'+(ly+.12)+'">'+entEsc(a.name||k.label)+(a.elevation>0&&window.dimUiLen&&window.dimUiLen()?' (+'+a.elevation+' m)':'')+'</text>'}
if(drawing)s+='<rect class="area-draw" x="'+Math.min(siteUi.sact.x0,siteUi.sact.x1)+'" y="'+Math.min(siteUi.sact.y0,siteUi.sact.y1)+'" width="'+Math.abs(siteUi.sact.x1-siteUi.sact.x0)+'" height="'+Math.abs(siteUi.sact.y1-siteUi.sact.y0)+'"/>';
return s+'</g>'}
function treeLayer(){
const ts=(g.areas||[]).filter(a=>a.kind==='tree'&&a.layout);if(!ts.length)return'';
const bad=new Set(validateAreas(g).map(i=>i.id)),site=appMode==='site';let s='<g class="arealayer treelayer">';
for(const a of ts){const L=a.layout,cx=L.x+L.width/2,cy=L.y+L.height/2,sl=site&&a.id===siteUi.selA,b=bad.has(a.id)?' bad':'';
if(siteUi.canopy)s+='<ellipse class="area tree'+(sl?' sel':'')+b+'" cx="'+cx+'" cy="'+cy+'" rx="'+L.width/2+'" ry="'+L.height/2+'" fill="#86efac" stroke="#166534"/>';
s+='<circle class="tree-c'+(sl?' sel':'')+b+'" data-tree="'+entEsc(a.id)+'" cx="'+cx+'" cy="'+cy+'" r=".16"/><text class="area-label" x="'+cx+'" y="'+(cy+.5)+'">'+entEsc(a.name||'Tree')+(a.species?' ('+entEsc(a.species)+')':'')+'</text>';
if(sl&&siteUi.canopy)for(const c of[['tl',L.x,L.y],['tr',L.x+L.width,L.y],['bl',L.x,L.y+L.height],['br',L.x+L.width,L.y+L.height]])s+='<circle class="ahandle" data-ahandle="'+c[0]+'" cx="'+c[1]+'" cy="'+c[2]+'" r=".14"/>'}
return s+'</g>'}
function siteWallLayer(){const a=appMode==='site'&&!siteUi.siteKind&&siteGet(siteUi.selA);if(!a||!a.layout||a.kind==='tree')return'';const L=a.layout;let s='<g class="awalls">';if(a.shape!=='ellipse')for(const w of outlineWalls(areaOutlineOf(a))){const v=w.side==='left'||w.side==='right';s+='<line class="awall '+(v?'awx':'awy')+'" data-awall="'+w.index+'" '+(v?'x1="'+(L.x+w.at)+'" x2="'+(L.x+w.at)+'" y1="'+(L.y+w.from)+'" y2="'+(L.y+w.to):'y1="'+(L.y+w.at)+'" y2="'+(L.y+w.at)+'" x1="'+(L.x+w.from)+'" x2="'+(L.x+w.to))+'"/>'}if(!a.outline)for(const c of[['tl',L.x,L.y],['tr',L.x+L.width,L.y],['bl',L.x,L.y+L.height],['br',L.x+L.width,L.y+L.height]])s+='<circle class="ahandle" data-ahandle="'+c[0]+'" cx="'+c[1]+'" cy="'+c[2]+'" r=".14"/>';return s+'</g>'}
function sitePanel(){
const K=areaKinds();document.querySelectorAll('[data-ak]').forEach(b=>b.classList.toggle('active',b.dataset.ak===siteUi.siteKind));
$('site-hint').textContent=siteUi.siteKind?'Click to drop a '+K[siteUi.siteKind].label.toLowerCase()+' ('+K[siteUi.siteKind].size.join(' x ')+' m) or drag a rectangle (Shift = keep adding, Alt = free position, Esc = cancel).':'Click an area to select it, drag to move, use the corner handles to resize, or drag a wall to reshape it (Shift + drag pulls a bump or notch). Shift-click a second area to merge. Pick a kind above to add one. Key C shows or hides tree canopies.';
const n=(g.areas||[]).length;$('site-count').textContent=n+(n===1?' area':' areas');
if(siteUi.selA&&!siteGet(siteUi.selA))siteUi.selA=null;const a=siteGet(siteUi.selA),el=$('site-inspector');if(!a){el.innerHTML='';return}
const num=(k,l,v,d)=>'<label>'+l+' <input class="sm" data-sf="'+k+'" value="'+entRd(v)+'"'+(d?' disabled title="Drag the walls to resize a shaped area"':'')+'></label>',opts=(list,cur)=>list.map(o=>'<option value="'+o[0]+'"'+(o[0]===cur?' selected':'')+'>'+o[1]+'</option>').join(''),L=a.layout;
if(siteUi.selX&&!siteGet(siteUi.selX))siteUi.selX=null;const xa=siteUi.selX&&siteGet(siteUi.selX),mc=xa?'<div class="card"><button id="site-merge">Merge "'+entEsc(xa.name)+'" into "'+entEsc(a.name)+'"</button><div class="mini">Same kind, both roofed or both open.</div></div>':'';
const inside=(g.entityPlacements||[]).filter(e=>e.areaId===a.id).length,warn=validateAreas(g).filter(i=>i.id===a.id).map(i=>'<div class="ewarn">'+entEsc(i.message)+'</div>').join('');
el.innerHTML='<div class="nm"><h2>'+entEsc(a.name)+'</h2><button id="site-del" class="ib" title="Delete this area">'+ICON_TRASH+'</button></div><div class="card"><label class="erow">Name <input data-sf="name" value="'+entEsc(a.name)+'"></label>'+
'<label class="erow">Kind <select data-sf="kind">'+opts(Object.keys(K).map(k=>[k,K[k].label]),a.kind)+'</select></label><label class="erow">Shape <select data-sf="shape">'+opts([['rect','Rectangle'],['ellipse','Ellipse']],a.shape)+'</select></label>'+(a.kind==='tree'?'<label class="erow">Tree kind <input data-sf="species" list="tree-kinds" value="'+entEsc(a.species||'')+'" placeholder="e.g. Eucalyptus"><datalist id="tree-kinds">'+['Eucalyptus (gum)','Jacaranda','Banksia','Palm','Pine','Oak','Olive','Citrus','Fruit tree','Hedge','Other'].map(s=>'<option value="'+s+'">').join('')+'</datalist></label>':'')+
'<div class="erow2">'+num('x','X',L.x)+num('y','Y',L.y)+'</div><div class="erow2">'+num('width','W',L.width,!!a.outline)+num('height','H',L.height,!!a.outline)+'<span class="mini">m</span></div><div class="erow2">'+num('elevation','Height from floor',a.elevation||0)+'<span class="mini">m above the floor line (raised deck); 0 = on the ground</span></div>'+
'<label class="row"><input type="checkbox" data-sf="roofed"'+(a.roofed?' checked':'')+'> Roofed (carport, pergola)</label><div class="mini">'+inside+(inside===1?' entity':' entities')+' in this area</div>'+warn+(a.outline?'<button id="site-rect" title="Make this area a rectangle again">Make rectangle</button>':'')+'</div>'+mc}
svg.addEventListener('pointerdown',e=>{if(appMode!=='site')return;const hnd=e.target.closest('[data-ahandle]'),P=world(e),before=JSON.stringify(g);
if(hnd&&siteUi.selA){siteUi.sact={kind:'resize',corner:hnd.dataset.ahandle,L0:{...siteGet(siteUi.selA).layout},pid:e.pointerId,before};svg.setPointerCapture(e.pointerId);return}
const aw=e.target.closest('[data-awall]');if(aw&&siteUi.selA){siteUi.sact={kind:'wall',wall:+aw.dataset.awall,x0:P.x,y0:P.y,g0:JSON.parse(JSON.stringify(g)),bump:e.shiftKey,pid:e.pointerId,before};svg.setPointerCapture(e.pointerId);return}
if(siteUi.siteKind){siteUi.sact={kind:'draw',x0:P.x,y0:P.y,x1:P.x,y1:P.y,pid:e.pointerId,before};svg.setPointerCapture(e.pointerId);render();return}
const inRoom=g.rooms.some(r=>r.layout&&r.name.toLowerCase()!=='outside'&&P.x>=r.layout.x&&P.x<=r.layout.x+r.layout.width&&P.y>=r.layout.y&&P.y<=r.layout.y+r.layout.height&&(!r.outline||outlinePoint(shapeOfRoom(r),P.x-r.layout.x,P.y-r.layout.y))),tr=e.target.closest&&e.target.closest('[data-tree]'),a=tr?siteGet(tr.dataset.tree):inRoom?null:areaAt(siteUi.canopy?g:{...g,areas:(g.areas||[]).filter(x=>x.kind!=='tree')},P.x,P.y);
if(a){if(e.shiftKey&&siteUi.selA&&a.id!==siteUi.selA){siteUi.selX=a.id;render();return}siteUi.selA=a.id;siteUi.selX=null;siteUi.sact={kind:'move',id:a.id,x0:P.x,y0:P.y,L0:{...a.layout},pid:e.pointerId,before};svg.setPointerCapture(e.pointerId)}else{siteUi.selA=null;siteUi.selX=null}
render()});
svg.addEventListener('pointermove',e=>{if(appMode!=='site'||!siteUi.sact||siteUi.sact.pid!==e.pointerId)return;const P=world(e),sn=v=>e.altKey?v:Math.round(v/step)*step;
if(siteUi.sact.kind==='draw'){siteUi.sact.x1=P.x;siteUi.sact.y1=P.y}
else if(siteUi.sact.kind==='move'){const L0=siteUi.sact.L0;let nx=sn(L0.x+P.x-siteUi.sact.x0),ny=sn(L0.y+P.y-siteUi.sact.y0);if(!e.altKey&&siteGet(siteUi.sact.id).kind!=='tree'){const E=siteEdges(),dx=siteNear([nx,nx+L0.width],E.xs),dy=siteNear([ny,ny+L0.height],E.ys);if(dx!==null)nx=clean(nx+dx);if(dy!==null)ny=clean(ny+dy)}const r=updateArea({graph:g,id:siteUi.sact.id,patch:{x:nx,y:ny}});if(r.ok)g=r.graph}
else if(siteUi.sact.kind==='wall'){const A=siteUi.sact,a0=(A.g0.areas||[]).find(x=>x.id===siteUi.selA),w=a0&&outlineWalls(areaOutlineOf(a0))[A.wall];if(w){const v=w.side==='left'||w.side==='right',d=sn(v?P.x-A.x0:P.y-A.y0),out=w.side==='right'||w.side==='bottom'?d:-d,L=a0.layout,res=A.bump?pullAreaWall({graph:A.g0,id:a0.id,wall:A.wall,center:(v?sn(A.y0)-L.y:sn(A.x0)-L.x),width:+$('site-bump').value||1,depth:out}):moveAreaWall({graph:A.g0,id:a0.id,wall:A.wall,delta:out});entMsg(res.ok?(res.message==='No change.'?'Drag a wall to move it, Shift + drag pulls a bump or notch.':res.message):res.message);if(res.ok)g=res.graph}}
else{const L=siteUi.sact.L0,c=siteUi.sact.corner,x2=L.x+L.width,y2=L.y+L.height,px=((v)=>{if(e.altKey)return v;const d=siteNear([v],siteEdges().xs);return d===null?v:clean(v+d)})(sn(P.x)),py=((v)=>{if(e.altKey)return v;const d=siteNear([v],siteEdges().ys);return d===null?v:clean(v+d)})(sn(P.y));let x=L.x,y=L.y,w=L.width,h=L.height;
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
if(e.key==='Escape'){siteUi.siteKind=null;siteUi.selA=null;siteUi.selX=null;siteUi.sact=null;document.body.dataset.akind='';render()}else if(e.key==='c'||e.key==='C'){siteUi.canopy=!siteUi.canopy;entMsg(siteUi.canopy?'Tree canopies shown (key C hides them).':'Tree canopies hidden, trunks only (key C shows them).');render()}else if((e.key==='Delete'||e.key==='Backspace')&&siteUi.selA){e.preventDefault();siteDelete()}});
$('site-inspector').addEventListener('change',e=>{const t=e.target.closest('[data-sf]');if(!t||!siteUi.selA)return;const k=t.dataset.sf,hb=JSON.stringify(g),patch={};
if(k==='roofed')patch.roofed=t.checked;else if(k==='name'||k==='kind'||k==='shape'||k==='species')patch[k]=t.value;else patch[k]=parseFloat(t.value);
const r=updateArea({graph:g,id:siteUi.selA,patch});entMsg(r.message);if(r.ok){g=r.graph;rec(hb)}render()});
$('site-inspector').addEventListener('click',e=>{if(e.target.closest('#site-del'))siteDelete();else if(e.target.closest('#site-merge')){const hb=JSON.stringify(g),r=mergeAreas({graph:g,ids:[siteUi.selA,siteUi.selX]});entMsg(r.message);if(r.ok){g=r.graph;siteUi.selX=null;rec(hb)}render()}else if(e.target.closest('#site-rect')){const hb=JSON.stringify(g),r=updateArea({graph:g,id:siteUi.selA,patch:{outline:null}});entMsg(r.message);if(r.ok){g=r.graph;rec(hb)}render()}});
document.querySelectorAll('[data-ak]').forEach(b=>b.onclick=()=>siteSetKind(b.dataset.ak));
onBeforeAppMode(m=>{siteUi.siteKind=null;siteUi.selA=null;siteUi.selX=null;siteUi.sact=null;document.body.dataset.akind='';if(m==='site'){selE=null;selM=new Set()}});
// Fit (view bounds, including areas) is defined once, in the floors module.
onRender(()=>{let n=svg.querySelector('[data-room]');while(n&&n.parentNode!==svg)n=n.parentNode;const h=siteLayer();if(h){if(n)n.insertAdjacentHTML('beforebegin',h);else svg.insertAdjacentHTML('beforeend',h)}const tl=treeLayer();if(tl)svg.insertAdjacentHTML('beforeend',tl);const wl=siteWallLayer();if(wl)svg.insertAdjacentHTML('beforeend',wl);if(appMode==='site')sitePanel()});
`;
