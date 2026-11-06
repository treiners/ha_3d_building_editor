/**
 * Walls mode (v3.2, `Floor plan | Site | Entities | Objects | Walls`): set the height of single walls. The floor plan is read-only here (the capture-phase pointer
 * handler below swallows every press on the canvas, so no plan editing code ever sees it). Every wall (one side of one room) is drawn as a strip coloured by its
 * height with the value in metres; click a wall to select it (Shift = add / remove), then type a height in the wall box. A wall that touches the facing wall of
 * another room is ONE physical wall: both sides are selected and changed together (`setWallHeights`, src/wallheights.js). Free walls (outside, balcony, garden side)
 * change alone. Empty height = back to the default (room default, floor height or building default).
 * Self-contained like the other modes: it adds its own button to the mode switch, its own sidebar block, its own CSS and the floating box `#wall-inspector`
 * (moved into the right-hand dock by editor-dock.ts). Placed after `exportJs` and before `boxesJs`.
 * Globals used: g, $, svg, sel, selPort, mode, appMode, entSetApp, entMsg, entEsc, rec, render, onRender, onBeforeAppMode, wallList, setWallHeights, sharedWallIssues, wallHeightOf.
 * No backticks, dollar-brace or backslashes below.
 */
export const wallsJs = `
(function(){
const W={sel:new Set()};
const st=document.createElement('style');
const hide='body[data-app=walls]';
st.textContent='.wallside{display:none}'+hide+' .wallside{display:block}'
+hide+' .side>.modes,'+hide+' .side>#panel,'+hide+' .side>.sec,'+hide+' .side>details.card,'+hide+' .side>label.mini,'+hide+' .toolbar .seg.modern-only,'+hide+' #run-mapper,'+hide+' #close-gaps,'+hide+' #fit-room,'+hide+' #gap{display:none}'
+hide+' .port,'+hide+' .handle{pointer-events:none}'+hide+' .room,'+hide+' .label{opacity:.5}'
+'.wlh{stroke:transparent;stroke-width:.5;stroke-linecap:round;pointer-events:stroke;cursor:pointer}.wl{fill:none;stroke-width:.2;stroke-linecap:butt;pointer-events:none}.wl.sh{stroke-dasharray:.55 .1}.wl.sel{stroke:#f97316!important;stroke-dasharray:none}'
+'.wlab{font-size:.3px;fill:#1e293b;paint-order:stroke;stroke:#fff;stroke-width:.09;pointer-events:none}'
+'#wall-inspector{position:absolute;right:10px;top:84px;width:250px;z-index:4;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 6px 20px rgba(15,23,42,.18);padding:8px 10px;font-size:13px}#wall-inspector[hidden]{display:none}'
+'#wall-inspector .nm{display:flex;align-items:center;justify-content:space-between}#wall-inspector h2{margin:0 0 6px;font-size:15px}#wall-inspector .rw{display:flex;gap:6px;align-items:center;margin:4px 0}#wall-inspector input{width:70px}';
document.head.appendChild(st);
const app=document.querySelector('.appsw');
if(app){
 app.insertAdjacentHTML('beforeend','<button data-app-btn="walls" title="Set the height of single walls">Walls</button>');
 app.querySelector('[data-app-btn=walls]').onclick=()=>entSetApp('walls');
 const ws=document.createElement('div');ws.className='wallside';
 ws.innerHTML='<div class="entbanner">Layout locked: rooms are read-only here. Click a wall to set its height.</div><div class="card"><h2>Walls</h2><div class="pal"><button id="w-all">All walls</button><button id="w-ext">Free walls</button><button id="w-none">Clear</button></div><div id="w-hint" class="mini"></div></div><div id="w-count" class="mini"></div>';
 app.insertAdjacentElement('afterend',ws);
}
const box=document.createElement('div');box.id='wall-inspector';box.className='floatbox';box.hidden=true;document.querySelector('.canvas').appendChild(box);
const fmt=v=>String(Math.round(v*100)/100);
function colour(h){const t=Math.max(0,Math.min(1,(h-2)/3));return 'hsl(215,'+Math.round(45+t*35)+'%,'+Math.round(78-t*45)+'%)'}
function layer(){
 let s='<g class="wallslayer">';
 for(const w of wallList(g)){
  if(w.shared.some(p=>p<w.id))continue;
  const on=W.sel.has(w.id),cls='wl'+(w.shared.length?' sh':'')+(on?' sel':'');let best=null,bl=0;
  for(const q of w.segs){const l=Math.hypot(q.x2-q.x1,q.y2-q.y1);if(l>bl){bl=l;best=q}
   s+='<line class="wlh" data-wl="'+w.id+'" x1="'+q.x1+'" y1="'+q.y1+'" x2="'+q.x2+'" y2="'+q.y2+'"/><line class="'+cls+'" stroke="'+colour(w.height)+'" x1="'+q.x1+'" y1="'+q.y1+'" x2="'+q.x2+'" y2="'+q.y2+'"/>'}
  if(best&&bl>=.8){const v=best.x1===best.x2,mx=(best.x1+best.x2)/2,my=(best.y1+best.y2)/2;
   s+='<text class="wlab" x="'+(v?mx+.16:mx)+'" y="'+(v?my+.1:my-.16)+'" text-anchor="'+(v?'start':'middle')+'">'+fmt(w.height)+'</text>'}
 }
 return s+'</g>'}
function pick(id,add){
 const by=new Map(wallList(g).map(w=>[w.id,w])),w=by.get(id);if(!w)return;
 const ids=[id,...w.shared];
 if(add){const has=W.sel.has(id);for(const x of ids){if(has)W.sel.delete(x);else W.sel.add(x)}}else{W.sel.clear();for(const x of ids)W.sel.add(x)}}
function panel(){
 const list=wallList(g),by=new Map(list.map(w=>[w.id,w]));
 for(const id of [...W.sel])if(!by.has(id))W.sel.delete(id);
 const own=list.filter(w=>w.own!==null&&!w.shared.some(p=>p<w.id)).length,tot=list.filter(w=>!w.shared.some(p=>p<w.id)).length;
 $('w-count').textContent=tot+' walls, '+own+' with an own height';
 $('w-hint').textContent='Click a wall (Shift = add to the selection). Dashed strips are shared walls: both sides change together. Colour = height, darker = higher.';
 const ids=[...W.sel];if(!ids.length){box.hidden=true;box.innerHTML='';return}
 const sw=ids.map(id=>by.get(id)),phys=sw.filter(w=>!w.shared.some(p=>W.sel.has(p)&&p<w.id)),hs=[...new Set(sw.map(w=>w.height))],nm=id=>{const w=by.get(id),r=room(w.roomId);return (r?r.name:w.roomId)+' ('+w.side+')'};
 const first=sw[0],r0=room(first.roomId),def=wallHeightOf(g,{...r0,wallHeights:null},first.side);
 let title,info;
 if(phys.length===1){const w=phys[0];title=nm(w.id);info=w.shared.length?'Shared with '+w.shared.map(nm).join(', ')+': one wall, both sides follow.':'Free wall (no neighbour): changes alone.'}
 else{title=phys.length+' walls';const nsh=phys.filter(w=>w.shared.length).length;info=nsh?nsh+' of them shared (both sides follow).':'All free walls.'}
 const bad=sharedWallIssues(g).filter(i=>W.sel.has(i.id)).map(i=>'<div class="ewarn">'+entEsc(i.message)+'</div>').join('');
 box.hidden=false;
 box.innerHTML='<div class="nm"><h2>'+entEsc(title)+'</h2></div><label class="rw">Height <input id="w-h" value="'+(hs.length===1?fmt(hs[0]):'')+'" placeholder="'+(hs.length===1?fmt(def):'mixed')+'"> m</label><div class="mini">'+entEsc(info)+'</div><div class="mini">Empty = default of the room ('+fmt(def)+' m).</div>'+bad+'<div class="rw"><button id="w-reset">Reset to default</button></div>'+(phys.length===1?'<div class="rw"><button id="w-room">Select all walls of '+entEsc(r0?r0.name:'the room')+'</button></div>':'')}
function apply(v){
 const hb=JSON.stringify(g),res=setWallHeights({graph:g,ids:[...W.sel],height:v});entMsg(res.message);
 if(res.ok){g=res.graph;rec(hb)}render()}
svg.addEventListener('pointerdown',e=>{
 if(appMode!=='walls')return;
 e.stopImmediatePropagation();
 const t=e.target.closest&&e.target.closest('[data-wl]');
 if(t)pick(t.dataset.wl,e.shiftKey);else if(!e.shiftKey)W.sel.clear();
 render()},true);
box.addEventListener('change',e=>{const t=e.target.closest('#w-h');if(!t)return;const s=t.value.trim();apply(s===''?null:parseFloat(s.replace(',','.')))});
box.addEventListener('click',e=>{
 if(e.target.closest('#w-reset'))return apply(null);
 if(e.target.closest('#w-room')){const w=wallList(g).find(x=>W.sel.has(x.id));if(w){for(const x of wallList(g))if(x.roomId===w.roomId){W.sel.add(x.id);for(const p of x.shared)W.sel.add(p)}render()}}});
$('w-all').onclick=()=>{W.sel=new Set(wallList(g).map(w=>w.id));render()};
$('w-ext').onclick=()=>{W.sel=new Set(wallList(g).filter(w=>!w.shared.length).map(w=>w.id));render()};
$('w-none').onclick=()=>{W.sel.clear();render()};
document.addEventListener('keydown',e=>{if(appMode!=='walls'||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;if(e.key==='Escape'){W.sel.clear();render()}});
onBeforeAppMode(m=>{W.sel.clear();if(m==='walls')setTimeout(()=>entMsg('Walls: click a wall to set its height (Shift = add). Shared walls change on both sides. Rooms are read-only.'),0)});
onRender(()=>{
 if(appMode!=='walls'){box.hidden=true;return}
 svg.querySelectorAll('.handle,[data-wall]').forEach(n=>n.remove());
 svg.insertAdjacentHTML('beforeend',layer());panel()});
})();
`;
