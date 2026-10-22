/**
 * "Add opening" in the Connectors tab: pick + Door / + Passage / + Window, then click on a wall of a room (floor-plan mode, not in the Gap view).
 * The click is handled by the pure `addOpening` (src/edit.ts): a connected pair where the wall is shared with another room (also a second door
 * between the same two rooms), an unpaired exterior opening elsewhere, windows always unpaired. A ghost bar shows where the opening would land.
 * Kept in its own file like the entity mode: `openingCss`, `openingHtml` (card inside the Connectors tab) and `openingJs` (script, before entityJs).
 * Globals used: g, $, svg, world, step, mode, sel, selPort, rec, render, appMode (declared later by the entity script, only read inside handlers).
 * The editor's own pointerdown handler returns early while an opening type is armed (`addOp`, hook in editor.ts). No backticks or dollar-brace below.
 */
export const openingCss =
  '[data-addop].active{background:#17202a;color:#fff}body[data-addop]:not([data-addop=""]) .canvas{cursor:crosshair}.addop-ghost{stroke:#16a34a;stroke-width:.14;stroke-linecap:round;opacity:.85;pointer-events:none}';

export const openingHtml =
  '<div class="card"><h2>Add connector<span class="tip" tabindex="0">i<span class="tipbox">Pick a type, then click on a wall of a room. On a wall shared with another room a door or passage connects both rooms (a second one is fine); anywhere else it is an exterior opening. Windows are never connected. Width and door type come from Settings (gear).</span></span></h2>' +
  '<div class="row"><button data-addop="door">+ Door</button><button data-addop="open-passage">+ Passage</button><button data-addop="window">+ Window</button></div><div id="addop-hint" class="mini"></div><button id="connect-rooms" title="Connects the two selected rooms with a door in the middle of their shared wall (click one room, shift-click the other)">Connect two selected rooms</button></div>';

export const openingJs = `
let addOp=null,addGhost=null;
function addOpSet(t){addOp=t&&addOp!==t?t:null;addGhost=null;document.body.dataset.addop=addOp||'';document.querySelectorAll('[data-addop]').forEach(b=>b.classList.toggle('active',b.dataset.addop===addOp));$('addop-hint').textContent=addOp?'Click on a wall to place the '+(addOp==='open-passage'?'passage':addOp)+' (Shift = keep adding, Alt = free position, Esc = cancel).':'';render()}
function addOpArgs(e){return{graph:g,type:addOp,at:world(e),width:+$('new-width').value||undefined,doorType:$('new-door').value||undefined,snap:e.altKey?0:step}}
svg.addEventListener('pointerdown',e=>{if(!addOp||appMode!=='plan')return;if(mode==='gap'){$('status').textContent='Adding openings is not available in the Gap view.';return}
const hb=JSON.stringify(g),res=addOpening(addOpArgs(e));$('status').textContent=res.message;
if(res.ok){g=res.graph;rec(hb);selPort=res.id;sel.clear();addGhost=null;if(!e.shiftKey){addOp=null;document.body.dataset.addop='';document.querySelectorAll('[data-addop]').forEach(b=>b.classList.remove('active'));$('addop-hint').textContent=''}}
render()});
svg.addEventListener('pointermove',e=>{if(!addOp||appMode!=='plan'||mode==='gap')return;const r=addOpening(addOpArgs(e));addGhost=r.ok?{p:r.point,w:r.width,side:r.side}:null;render()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&addOp)addOpSet(null)});
document.querySelectorAll('[data-addop]').forEach(b=>b.onclick=()=>addOpSet(b.dataset.addop));
onRender(function(){if(addOp&&addGhost&&mode!=='gap'&&appMode==='plan'){const p=addGhost.p,h=addGhost.side==='top'||addGhost.side==='bottom',w=addGhost.w/2;svg.insertAdjacentHTML('beforeend','<line class="addop-ghost" x1="'+(h?p.x-w:p.x)+'" y1="'+(h?p.y:p.y-w)+'" x2="'+(h?p.x+w:p.x)+'" y2="'+(h?p.y:p.y+w)+'"/>')}})
`;
