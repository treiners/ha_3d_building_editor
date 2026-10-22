/**
 * Stairs in the generated editor (Floor plan mode: select, drag, edit; other modes: shown only). A stair is a rectangle seen from above with treads and a
 * thick bar where it lands on the floor (see stairs.ts): drawn on the two floors it connects. Click selects, drag moves (grid snap), the panel at the top
 * right sets name, length, width and the direction it climbs, and deletes it. `+ Stair` (floor bar) adds one in the middle of the view. All steps are undoable.
 * `stairsJs` must not contain backticks, dollar-brace or backslashes.
 */
export const stairsCss = '#stairs .sb{fill:rgba(20,184,166,.12);stroke:#0f766e;stroke-width:.04}#stairs path{stroke:#0f766e;stroke-width:.015;fill:none;pointer-events:none}#stairs .sbar{fill:#0f766e}#stairs .sel .sb{stroke:#f59e0b;stroke-width:.07}#stairs text{font-size:.25px;fill:#0f766e;text-anchor:middle;dominant-baseline:middle;pointer-events:none}#stairbox{position:absolute;right:10px;top:84px;width:210px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:8px 10px;font-size:13px;z-index:4}#stairbox[hidden]{display:none}#stairbox .sh{display:flex;gap:4px}#stairbox .sh input{flex:1;margin:0;min-width:0}#stairbox label{display:flex;align-items:center;gap:6px;margin:4px 0}#stairbox label input{width:70px;margin:0 2px}#stairbox .sd{display:flex;gap:4px;align-items:center}#stairbox button{margin:0;padding:2px 8px}#stairbox button.on{background:#17202a;color:#fff}';

export const stairsJs = `
let selS=null;
function stairAdd(){if(appMode!=='plan'){$('status').textContent='Switch to Floor plan mode to add a stair.';return}
 const hb=JSON.stringify(g);g=stairsAdd({graph:g,x:snap(view.x+view.w/2-1.5),y:snap(view.y+view.h/2-.5)});if(JSON.stringify(g)===hb)return;
 rec(hb);selS=g.stairs[g.stairs.length-1].id;render();$('status').textContent='Stair added: drag it, set length, width and direction in the panel at the top right.'}
(function(){
const cv=document.querySelector('.canvas');cv.style.position='relative';
const box=document.createElement('div');box.id='stairbox';box.hidden=true;cv.appendChild(box);
const E=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const AR={left:'&#8592;',up:'&#8593;',down:'&#8595;',right:'&#8594;'};
let drag=null,lastK='';
function draw(){const vs=stairsVisible(g);if(!vs.length)return;let h='<g id="stairs" style="pointer-events:'+(appMode==='plan'?'auto':'none')+'">';
 for(const v of vs){const R=v.rect,horiz=v.direction==='left'||v.direction==='right',len=horiz?R.w:R.h;let d='';
  for(let k=1;k*.27<len-.01;k++){const o=k*.27;d+=horiz?'M'+(R.x+o)+' '+R.y+'V'+(R.y+R.h):'M'+R.x+' '+(R.y+o)+'H'+(R.x+R.w)}
  h+='<g class="stair'+(v.id===selS?' sel':'')+'" data-stair="'+E(v.id)+'"><rect class="sb" x="'+R.x+'" y="'+R.y+'" width="'+R.w+'" height="'+R.h+'"/><path d="'+d+'"/><rect class="sbar" x="'+v.bar.x+'" y="'+v.bar.y+'" width="'+v.bar.w+'" height="'+v.bar.h+'"/><text x="'+(R.x+R.w/2)+'" y="'+(R.y+R.h/2)+'">'+E(v.name)+'</text></g>'}
 let hs='';const sv=vs.find(v=>v.id===selS);if(sv&&appMode==='plan'){const R=sv.rect;hs='<g id="stairhandles">'+[['tl',R.x,R.y],['tr',R.x+R.w,R.y],['bl',R.x,R.y+R.h],['br',R.x+R.w,R.y+R.h]].map(c=>'<circle class="handle" data-stc="'+c[0]+'" cx="'+c[1]+'" cy="'+c[2]+'" r=".14" stroke="#fff" stroke-width=".04" style="cursor:'+(c[0]==='tl'||c[0]==='br'?'nwse':'nesw')+'-resize"/>').join('')+'</g>'}
 svg.insertAdjacentHTML('beforeend',h+'</g>'+hs)}
function panel(){const v=stairsVisible(g).find(x=>x.id===selS),s=v&&g.stairs.find(x=>x.id===selS);
 if(!s||appMode!=='plan'){box.hidden=true;lastK='';return}
 const k=s.id+'|'+s.name+'|'+s.length+'|'+s.width+'|'+s.direction+'|'+v.role;if(k===lastK&&!box.hidden)return;lastK=k;box.hidden=false;
 box.innerHTML='<div class="sh"><input data-f="name" value="'+E(s.name||s.id)+'" title="Name"><button data-d="del" title="Delete this stair">&#10005;</button></div><label>Length<input data-f="length" type="number" step="0.05" min="0.6" max="12" value="'+s.length+'">m</label><label>Width<input data-f="width" type="number" step="0.05" min="0.5" max="4" value="'+s.width+'">m</label><div class="sd">Climbs '+['left','up','down','right'].map(d=>'<button data-d="'+d+'" class="'+(s.direction===d?'on':'')+'" title="Climbs to the '+d+'">'+AR[d]+'</button>').join('')+'</div><div class="mini">The bar is where the stair lands: '+(v.role==='lower'?'its start on this floor':'its top on this floor')+'.</div>'}
function edit(patch){const hb=JSON.stringify(g);g=stairsUpdate({graph:g,id:selS,patch:patch});rec(hb);render()}
box.addEventListener('change',e=>{const f=e.target.dataset.f;if(!f||!selS)return;const p={};p[f]=f==='name'?e.target.value:parseFloat(String(e.target.value).replace(',','.'));edit(p)});
box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!selS)return;const d=b.dataset.d;
 if(d==='del'){const hb=JSON.stringify(g);g=stairsRemove({graph:g,id:selS});selS=null;rec(hb);render();$('status').textContent='Stair deleted.'}
 else edit({direction:d})});
svg.addEventListener('pointerdown',e=>{if(appMode!=='plan')return;
 const hd=e.target.closest&&e.target.closest('[data-stc]');
 if(hd){e.stopPropagation();e.stopImmediatePropagation();e.preventDefault();const s=g.stairs.find(x=>x.id===selS);if(!s)return;const R=stairRect(s),c=hd.dataset.stc;drag={kind:'size',fx:c[1]==='l'?R.x+R.w:R.x,fy:c[0]==='t'?R.y+R.h:R.y,before:JSON.stringify(g)};return}
 const t=e.target.closest&&e.target.closest('.stair');
 if(!t){if(selS){selS=null;render()}return}
 e.stopPropagation();e.stopImmediatePropagation();e.preventDefault();selS=t.dataset.stair;sel.clear();selPort=null;const s=g.stairs.find(x=>x.id===selS),p=world(e);
 drag={kind:'move',sx:p.x,sy:p.y,x:s.x,y:s.y,before:JSON.stringify(g)};render()},true);
window.addEventListener('pointermove',e=>{if(!drag)return;const s=g.stairs.find(x=>x.id===selS);if(!s)return;const p=world(e);if(drag.kind==='size')Object.assign(s,stairResize(s,drag.fx,drag.fy,snap(p.x),snap(p.y)));else{s.x=snap(drag.x+p.x-drag.sx);s.y=snap(drag.y+p.y-drag.sy)}render()});
window.addEventListener('pointerup',()=>{if(!drag)return;const b=drag.before;drag=null;rec(b)});
onRender(()=>{draw();panel()});
})();
`;
