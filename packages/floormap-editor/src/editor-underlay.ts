/**
 * Image underlay: a floor-plan photo or scan as a faded background for tracing (one per floor). Purely visual: it lives in the browser only, is never saved
 * and is not part of undo. Buttons at the bottom-left of the canvas: Image (load png / jpg / ...; export a PDF page as an image first), Scale (click two
 * points, then enter their real distance), Move (drag the image; click Move again to edit the plan), opacity slider, remove.
 * `underlayJs` must not contain backticks, dollar-brace or backslashes. Pure helpers: `underlayInit`, `underlayScale` (underlay.ts).
 */
export const underlayCss = '#underlay{position:absolute;left:10px;bottom:10px;display:flex;gap:4px;align-items:center;flex-wrap:wrap}#underlay button{margin:0;padding:3px 9px;border:1px solid #cbd5e1;background:rgba(255,255,255,.92);border-radius:6px;font-size:13px;cursor:pointer}#underlay button.on{background:#17202a;color:#fff}#underlay input[type=range]{width:90px;margin:0}';

export const underlayJs = `
(function(){
const cv=document.querySelector('.canvas');cv.style.position='relative';
const bar=document.createElement('div');bar.id='underlay';cv.appendChild(bar);
const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.hidden=true;bar.after(inp);
const U={};let armed=null,pts=[],drag=null,lastK='';
const key=()=>g._fl?g._fl.cur:'_';
const say=t=>{$('status').textContent=t};
function ubar(){const u=U[key()],k=key()+(u?1:0)+armed;if(k===lastK)return;lastK=k;let h='<button data-u="img" title="Load a floor-plan image as a faded background (not saved)">Image</button>';
 if(u)h+='<button data-u="scale" class="'+(armed==='scale'?'on':'')+'" title="Click two points of known distance, then enter the distance">Scale</button><button data-u="move" class="'+(armed==='move'?'on':'')+'" title="Drag the image; click again to edit the plan">Move</button><input type="range" min="10" max="100" value="'+Math.round(u.op*100)+'" title="Opacity"><button data-u="rm" title="Remove the image of this floor">&#10005;</button>';
 bar.innerHTML=h}
function udraw(){const u=U[key()];if(!u)return;
 svg.insertAdjacentHTML('afterbegin','<image href="'+u.href+'" x="'+u.x+'" y="'+u.y+'" width="'+u.w+'" height="'+u.h+'" opacity="'+u.op+'" preserveAspectRatio="none" style="pointer-events:none"/>'+pts.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r=".12" fill="#dc2626" style="pointer-events:none"/>').join(''))}
bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.u,u=U[key()];
 if(a==='img')inp.click();
 else if(a==='rm'){delete U[key()];armed=null;pts=[];render()}
 else if(a==='scale'){armed=armed==='scale'?null:'scale';pts=[];say(armed?'Scale: click the first point on the image.':'Scale cancelled.');render()}
 else if(a==='move'){armed=armed==='move'?null:'move';say(armed?'Move: drag the image. Click Move again to edit the plan.':'Back to editing the plan.');render()}});
bar.addEventListener('input',e=>{const u=U[key()];if(u&&e.target.type==='range'){u.op=e.target.value/100;render()}});
inp.addEventListener('change',()=>{const f=inp.files[0];if(!f)return;const url=URL.createObjectURL(f),im=new Image();
 im.onload=()=>{U[key()]=Object.assign(underlayInit(view,im.naturalWidth,im.naturalHeight),{href:url,op:.5});armed=null;pts=[];say('Image loaded. Use Scale (two clicks and a distance), then Move to place it.');render()};im.src=url;inp.value=''});
svg.addEventListener('pointerdown',e=>{if(!armed||!U[key()])return;e.stopPropagation();e.stopImmediatePropagation();e.preventDefault();const p=world(e),u=U[key()];
 if(armed==='scale'){pts.push({x:p.x,y:p.y});if(pts.length<2){say('Scale: click the second point.');render();return}
  const d=prompt('Real distance between the two points (metres)'),real=parseFloat(String(d||'').replace(',','.'));
  if(real>0){Object.assign(u,underlayScale(u,pts[0],pts[1],real));say('Image scaled. Use Move to place it.')}else say('Scale cancelled.');armed=null;pts=[];render()}
 else drag={sx:p.x,sy:p.y,x:u.x,y:u.y}},true);
window.addEventListener('pointermove',e=>{if(!drag)return;const p=world(e),u=U[key()];u.x=drag.x+p.x-drag.sx;u.y=drag.y+p.y-drag.sy;render()});
window.addEventListener('pointerup',()=>{drag=null});
{const r0=render;render=function(){r0.apply(this,arguments);udraw();ubar()}}
})();
`;
