/**
 * Plan-level helpers in the generated editor: the *New floor plan* button (next to Load) and the north compass.
 * `graph.northDegrees` (optional, absent = 0) is the direction of north on the plan, clockwise from "up" like `facingDegrees`
 * (0 = north is up, 90 = north points right). It is only stored for the Home Assistant side, the drawing is never rotated.
 * `northJs` must not contain backticks or dollar-brace (it sits inside the editor template string).
 */
export const northCss = '#north{position:absolute;right:10px;top:10px;width:64px;height:64px;cursor:grab;touch-action:none;user-select:none}#north .nc{fill:rgba(255,255,255,.88);stroke:#94a3b8;stroke-width:1}#north .nl{stroke:#475569;stroke-width:2}#north .nd{fill:#dc2626}#north .nt{fill:#fff;font:bold 7px sans-serif;text-anchor:middle;pointer-events:none}';

export const northJs = `
(function(){
const cv=document.querySelector('.canvas');cv.style.position='relative';
const el=document.createElementNS('http://www.w3.org/2000/svg','svg');el.id='north';el.setAttribute('viewBox','-30 -30 60 60');cv.appendChild(el);
$('load').insertAdjacentHTML('beforebegin','<button id="newplan" class="ib" title="New floor plan"><svg class="ic" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6zM14 3v5h5M12 11v6M9 14h6"/></svg></button>');
$('newplan').onclick=()=>{if(appMode!=='plan'){$('status').textContent='Switch to Floor plan mode to start a new plan.';return}
if(!confirm('Start a new floor plan? Unsaved changes are lost.'))return;
g={schemaVersion:'3.0',rooms:[{id:'room-1',name:'Room 1',sizeCategory:'medium',connectors:[],layout:{x:0,y:0,width:4,height:3}}],relationships:[],wallAlignments:[]};
entLoad();hist.clear();sel.clear();selPort=null;$('status').textContent='New floor plan: add rooms with Add room, then connect them.';fit()};
function northDraw(){const a=+g.northDegrees||0,r=a*Math.PI/180,x=Math.sin(r)*20,y=-Math.cos(r)*20;
el.innerHTML='<title>North is '+a+' degrees clockwise from up. Drag to turn (Shift = 1 degree steps), double-click to reset.</title><circle r="26" class="nc"/><line x1="'+(-x*.5)+'" y1="'+(-y*.5)+'" x2="'+x+'" y2="'+y+'" class="nl"/><circle cx="'+x+'" cy="'+y+'" r="5" class="nd"/><text x="'+x+'" y="'+(y+2.5)+'" class="nt">N</text>';el.setAttribute('data-north',a)}
function ang(e){const b=el.getBoundingClientRect();let a=Math.atan2(e.clientX-(b.left+b.width/2),-(e.clientY-(b.top+b.height/2)))*180/Math.PI;const s=e.shiftKey?1:5;a=Math.round(a/s)*s;return((a%360)+360)%360}
let nb=null;
el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();nb=JSON.stringify(g);if(el.setPointerCapture)el.setPointerCapture(e.pointerId);turn(e)});
el.addEventListener('pointermove',e=>{if(nb!==null)turn(e)});
el.addEventListener('pointerup',e=>{if(nb===null)return;turn(e);if(JSON.stringify(g)!==nb){rec(nb);chrome()}nb=null});
function turn(e){const a=ang(e);if(a===0)delete g.northDegrees;else g.northDegrees=a;northDraw()}
el.addEventListener('dblclick',()=>{if(g.northDegrees===undefined)return;const hb=JSON.stringify(g);delete g.northDegrees;rec(hb);chrome();northDraw()});
onRender(northDraw);
northDraw();
})();
`;
