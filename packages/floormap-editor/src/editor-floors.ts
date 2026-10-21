/**
 * Floor tabs, height, the ghost of the floor below, See-through (T), "Match below", "+ Stair", PageUp / PageDown and floor-aware Fit in the generated editor (all modes).
 * The model lives in `floors.ts`: the editor only ever holds the current floor in `g.rooms`, so planners and tools are unchanged.
 * `floorsJs` must not contain backticks, dollar-brace or backslashes; it must not contain the text ignoreIds followed by hidden() (a test counts it).
 */
export const floorsCss = '#floors{position:absolute;left:10px;top:10px;display:flex;gap:4px;align-items:center;flex-wrap:wrap;max-width:70%}#floors button{margin:0;padding:3px 9px;border:1px solid #cbd5e1;background:rgba(255,255,255,.92);border-radius:6px;font-size:13px;cursor:pointer}#floors button.on{background:#17202a;color:#fff}#floors .fh{font-size:12px;background:rgba(255,255,255,.92);border:1px solid #cbd5e1;border-radius:6px;padding:2px 6px}#floors .fh input{width:56px;margin:0 2px;padding:1px 3px}.floorghost rect{fill:rgba(100,116,139,.07);stroke:#94a3b8;stroke-width:.04;stroke-dasharray:.25 .15;pointer-events:none}.floorghost text{font-size:.3px;fill:#94a3b8;text-anchor:middle;dominant-baseline:middle;pointer-events:none}body.seethrough .room{fill-opacity:.2;stroke-opacity:.6}body.seethrough .floorghost rect{fill:rgba(100,116,139,.28);stroke:#475569;stroke-width:.06;stroke-dasharray:none}body.seethrough .floorghost text{fill:#475569}';

export const floorsJs = `
(function(){
const cv=document.querySelector('.canvas');cv.style.position='relative';
const bar=document.createElement('div');bar.id='floors';cv.appendChild(bar);
const E=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const say=t=>{$('status').textContent=t};
let seeThrough=false;
if(Array.isArray(g.floors)&&g.floors.length&&!g._fl)g=floorsSplit(g);
function floorBar(){const fs=g.floors,c=g._fl&&g._fl.cur;let h='';
 if(fs&&fs.length)for(const f of fs)h+='<button data-fl="'+E(f.id)+'" class="'+(f.id===c?'on':'')+'" title="Click or PageUp / PageDown to switch, double-click to rename">'+E(f.name)+'</button>';
 else h+='<button class="on" disabled>Floor 1</button>';
 h+='<button data-fa="new" title="Add an empty floor above">+</button><button data-fa="copy" title="Add a floor above as a copy of this one">Copy</button>';
 if(fs&&fs.length>1)h+='<button data-fa="del" title="Delete this floor">&#10005;</button>';
 if(fs&&fs.length){const cf=fs.find(f=>f.id===c)||{},dw=(g.buildingDefaults&&g.buildingDefaults.wallHeight)||2.4;h+='<label class="fh" title="Storey height of this floor (walls). Empty = building wall height">h<input id="floor-h" type="number" step="0.05" min="1.8" max="8" placeholder="'+dw+'" value="'+(typeof cf.height==='number'?cf.height:'')+'">m</label>'}
 if(floorsGhost(g).length)h+='<button data-fa="match" title="Snap the walls of this floor to the walls of the floor below (within 0.3 m)">Match below</button><button data-fa="see" class="'+(seeThrough?'on':'')+'" title="Draw this floor 80 percent transparent to see the floor below (key T)">See-through</button>';
 if(fs&&fs.length>1)h+='<button data-fa="stair" title="Add a stair between this floor and the next one">+ Stair</button>';
 bar.innerHTML=h}
function ghostDraw(){const gs=floorsGhost(g);if(!gs.length)return;
 svg.insertAdjacentHTML('afterbegin','<g class="floorghost">'+gs.map(r=>'<rect x="'+r.x+'" y="'+r.y+'" width="'+r.width+'" height="'+r.height+'"/><text x="'+(r.x+r.width/2)+'" y="'+(r.y+r.height/2)+'">'+E(r.name)+'</text>').join('')+'</g>')}
function reset(){sel.clear();selPort=null;if(typeof selE!=='undefined')selE=null;if(typeof selM!=='undefined')selM=new Set()}
function goto(id){if(g._fl&&id!==g._fl.cur){g=floorsSwitch(g,id);reset();render()}}
function see(on){seeThrough=on;document.body.classList.toggle('seethrough',on);render()}
function moveWalls(list){let n=0,fail=0;for(const m of list){const ig=hidden(),g0=JSON.parse(JSON.stringify(g)),res=planWall({graph:g0,joints:deriveJoints(g0).joints,roomId:m.id,side:m.side,delta:clean(m.delta),step:step,noOverlap:noOverlap(),glueTouching:glueTouch(),ignoreIds:ig,alignments:g0.wallAlignments});if(!res.delta){fail++;continue}applyWallResult(res,g0);g.relationships.forEach(align);n++}return{n:n,fail:fail}}
function matchOutline(){
 if(appMode!=='plan'){say('Switch to Floor plan mode to match walls.');return}
 const gs=floorsGhost(g);if(!gs.length){say('There is no floor below.');return}
 const tol=.3,hb=JSON.stringify(g);let n=0,fail=0;
 for(const id of g.rooms.filter(r=>r.layout&&r.name.toLowerCase()!=='outside').map(r=>r.id))for(const side of['left','right','top','bottom']){
  const L=room(id).layout,v=side==='left'||side==='right',w=side==='left'?L.x:side==='right'?L.x+L.width:side==='top'?L.y:L.y+L.height,a0=v?L.y:L.x,a1=v?L.y+L.height:L.x+L.width;let best=null;
  for(const G of gs)for(const gw of v?[G.x,G.x+G.width]:[G.y,G.y+G.height]){const s0=v?G.y:G.x,s1=v?G.y+G.height:G.x+G.width;if(Math.min(a1,s1)-Math.max(a0,s0)<.3)continue;const d=gw-w;if(Math.abs(d)<1e-6||Math.abs(d)>tol)continue;if(best===null||Math.abs(d)<Math.abs(best))best=d}
  if(best===null)continue;
  const r=moveWalls([{id:id,side:side,delta:best}]);n+=r.n;fail+=r.fail}
 if(n)rec(hb);say('Match below: '+n+' wall(s) snapped'+(fail?', '+fail+' not moved (locks, doors or neighbours in the way)':'')+'.');render()}
bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.fl){goto(b.dataset.fl);return}
 const a=b.dataset.fa,hb=JSON.stringify(g);
 if(a==='new'||a==='copy'){g=floorsAdd({graph:g,copy:a==='copy'});rec(hb);reset();render();say('Floor added. The floor below is shown as a dashed ghost; use Match below to snap walls to it, See-through (T) to look through this floor.')}
 else if(a==='del'){if(!confirm('Delete this floor with all its rooms, entities and stairs?'))return;g=floorsRemove(g);rec(hb);reset();render();say('Floor deleted.')}
 else if(a==='match')matchOutline();
 else if(a==='see')see(!seeThrough);
 else if(a==='stair')stairAdd()});
bar.addEventListener('change',e=>{
 if(e.target.id==='floor-h'){const f=g.floors.find(x=>x.id===g._fl.cur),v=parseFloat(String(e.target.value).replace(',','.')),hb=JSON.stringify(g);if(v>=1.8&&v<=8)f.height=v;else delete f.height;rec(hb);render()}});
bar.addEventListener('dblclick',e=>{const b=e.target.closest('button');if(!b||!b.dataset.fl)return;const f=g.floors.find(x=>x.id===b.dataset.fl),n=prompt('Floor name',f.name);if(!n||!n.trim())return;const hb=JSON.stringify(g);g=floorsRename({graph:g,id:f.id,name:n});rec(hb);render()});
document.addEventListener('keydown',e=>{const t=e.target&&e.target.tagName;if(t==='INPUT'||t==='SELECT'||t==='TEXTAREA'||e.ctrlKey||e.metaKey||e.altKey||!g._fl)return;
 if(e.key==='PageUp'||e.key==='PageDown'){const fs=g.floors,j=fs.findIndex(f=>f.id===g._fl.cur)+(e.key==='PageUp'?1:-1);if(j<0||j>=fs.length)return;e.preventDefault();goto(fs[j].id)}
 else if((e.key==='t'||e.key==='T')&&floorsGhost(g).length){e.preventDefault();see(!seeThrough)}});
fit=function(){const rs=(g._fl?floorsMerge(g).rooms:g.rooms).filter(r=>r.layout&&r.name.toLowerCase()!=='outside');if(!rs.length)return;const p=1,minX=Math.min(...rs.map(r=>r.layout.x))-p,minY=Math.min(...rs.map(r=>r.layout.y))-p,maxX=Math.max(...rs.map(r=>r.layout.x+r.layout.width))+p,maxY=Math.max(...rs.map(r=>r.layout.y+r.layout.height))+p;view={x:minX,y:minY,w:maxX-minX,h:maxY-minY};render()};
$('fit-all').onclick=()=>fit();
{const f0=$('file').onchange;$('file').onchange=async function(e){await f0.call(this,e);if(Array.isArray(g.floors)&&g.floors.length&&!g._fl){g=floorsSplit(g);hist.clear();reset();fit()}}}
{const r0=render;render=function(){r0.apply(this,arguments);ghostDraw();floorBar()}}
})();
`;
