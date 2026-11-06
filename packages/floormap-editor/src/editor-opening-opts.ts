/**
 * Opening options (v3.2): slide direction of sliding doors / pocket doors / sliding windows, tilt-and-turn for hinged doors, hinge + swing for hinged and
 * tilt-and-turn windows, and the plan symbols for them. Extra rows are appended to the connector card (`tr.xo`) after every render and edited through the core
 * `setDoor` / `setWindow` (one undo step each). Symbols are drawn for the selected connector only. Nothing in the core handlers is touched.
 * Data: `door.slide` ("start" | "end", absent = start) and `door.tilt` (true), `window.hinge`, `window.swing`, `window.slide`. "start" / "end" = towards the smaller / larger
 * x (top and bottom walls) or y (left and right walls); both connectors of a pair share the value. Pocket door: the width is the whole visible leaf, it slides into the wall.
 * Also adds an Entities block to the connector card: the entities on the door / window (both ends of a pair), a button per entity type that fits (contact, lock, blind / cover)
 * and a trash button per entity, so one connector can carry several entities.
 * Placed after `heightsJs` in editor.ts. Globals used: g, $, port, partner, setDoor, setWindow, doorSpec, winSpec, hinged, cwOf, dpoint, doorGeometry, room, selPort, mode, appMode, svg, rec, render, onRender.
 * No backticks, dollar-brace or backslashes below.
 */
export const openOptsJs = `
(function(){
const hz=c=>c.side==='top'||c.side==='bottom';
const pick=(attr,id,list,cur)=>'<select '+attr+'="'+id+'">'+list.map(v=>'<option value="'+v[0]+'"'+(cur===v[0]?' selected':'')+'>'+v[1]+'</option>').join('')+'</select>';
const row=(a,b)=>'<tr class="xo"><td>'+a+'</td><td>'+b+'</td></tr>';
const dirs=c=>c.side==='top'||c.side==='right'?[['start','left'],['end','right']]:[['end','left'],['start','right']];
function linkRow(c){
 if(c.type==='window'||linkFor(c.id))return'';
 const P=dpoint(c);let o='';
 for(const q of ports()){if(q.roomId===c.roomId||linkFor(q.id))continue;if(!linkConnectors({graph:g,connectorId:c.id,partnerId:q.id}).ok)continue;const Q=dpoint(q);o+='<option value="c:'+q.id+'">link to '+room(q.roomId).name+' ('+q.side+'), '+Math.hypot(Q.x-P.x,Q.y-P.y).toFixed(2)+' m away</option>'}
 for(const r of g.rooms){if(r.id===c.roomId||!r.layout||String(r.name).toLowerCase()==='outside')continue;if(addPartner({graph:g,connectorId:c.id,roomId:r.id,at:pt(c)}).ok)o+='<option value="r:'+r.id+'">add a '+(c.type==='door'?'door':'passage')+' in '+r.name+'</option>'}
 return row('Connect to',o?'<select data-clink="'+c.id+'"><option value="">not connected</option>'+o+'</select>':'<small>no room reaches this wall here</small>')}
function rows(c){
 const o=partner(c),R=room(c.roomId),W=o&&room(o.roomId);let h=linkRow(c);
 if(c.type==='door'){
  const d=doorSpec(c);
  if(hinged(c))h+=row('Tilt','<label><input type="checkbox" data-dtilt="'+c.id+'"'+(d.tilt?' checked':'')+'> also tilts (tilt and turn)</label>');
  else if(c.doorType==='sliding')h+=row('Slides toward',pick('data-dslide',c.id,dirs(c),d.slide)+'<small>seen from '+R.name+', facing the wall; one half slides over the other half</small>');
  else if(c.doorType==='pocket')h+=row('Slides toward',pick('data-dslide',c.id,dirs(c),d.slide)+'<small>seen from '+R.name+', facing the wall; the width follows the movement (one half slides over the other half)</small>');
 }else if(c.type==='window'){
  const w=winSpec(c);
  if(w.type==='hinged'||w.type==='tilt-turn')h+=row('Hinge',pick('data-whinge',c.id,[['left','left'],['right','right']],w.hinge==='right'?'right':'left'))+row('Swing',pick('data-wswing',c.id,[['inward','into '+R.name],['outward','into '+(W?W.name:'the other side')]],w.swing==='outward'?'outward':'inward'));
  else if(w.type==='slide-horizontal')h+=row('Slides toward',pick('data-wslide',c.id,dirs(c),w.slide==='end'?'end':'start')+'<small>seen from '+R.name+', facing the wall; one sash slides over the other</small>');
 }
 return h}
function sym(c){
 const P=dpoint(c),o=partner(c),w=Math.max(cwOf(c),o?cwOf(o):0),h=hz(c),A={x:h?1:0,y:h?0:1},N={x:h?0:(c.side==='left'?1:-1),y:h?(c.side==='top'?1:-1):0};
 const at=(a,n)=>({x:P.x+A.x*a+N.x*n,y:P.y+A.y*a+N.y*n}),L=(p,q)=>'M'+p.x+' '+p.y+'L'+q.x+' '+q.y;
 const arrow=(f,dr,len)=>{const t={x:f.x+A.x*dr*len,y:f.y+A.y*dr*len},b={x:t.x-A.x*dr*.1,y:t.y-A.y*dr*.1};return 'M'+f.x+' '+f.y+'L'+t.x+' '+t.y+'M'+(b.x+N.x*.07)+' '+(b.y+N.y*.07)+'L'+t.x+' '+t.y+'L'+(b.x-N.x*.07)+' '+(b.y-N.y*.07)};
 const slide=dr=>L(at(0,.05),at(dr*w/2,.05))+L(at(-dr*w/2,-.05),at(0,-.05))+arrow(at(-dr*w/4,-.05),dr,w/2);
 const vee=inw=>{const ap=at(0,(inw?1:-1)*.22*w);return L(at(-w/2,0),ap)+L(ap,at(w/2,0))};
 let solid='',dash='',arc='';
 if(c.type==='door'){
  const d=doorSpec(c),dr=d.slide==='end'?1:-1;
  if(c.doorType==='sliding')solid=slide(dr);
  else if(c.doorType==='pocket'){solid=L(at(-w/2,0),at(w/2,0))+arrow(at(0,-.08),dr,w/2);dash=L(at(dr*w/2,0),at(dr*1.5*w,0))}
  else if(d.tilt)dash=vee(d.swing==='inward');
 }else if(c.type==='window'){
  const x=winSpec(c),dr=x.slide==='end'?1:-1,gm=()=>doorGeometry(c.side,P,w,{hinge:x.hinge==='right'?'right':'left',swing:x.swing==='outward'?'outward':'inward',openAngle:90}).path;
  if(x.type==='slide-horizontal')solid=slide(dr);
  else if(x.type==='slide-vertical')solid=L(at(-w/2,.04),at(w/2,.04))+L(at(-w/2,-.04),at(w/2,-.04));
  else if(x.type==='tilt')dash=vee(true);
  else if(x.type==='hinged')arc=gm();
  else if(x.type==='tilt-turn'){arc=gm();dash=vee(x.swing!=='outward')}
 }
 if(!solid&&!dash&&!arc)return'';
 return '<g class="opsym" style="fill:none;stroke:#2563eb;stroke-width:.04;pointer-events:none">'+(arc?'<path class="swing" d="'+arc+'"/>':'')+(solid?'<path d="'+solid+'"/>':'')+(dash?'<path d="'+dash+'" style="stroke-dasharray:.1 .08"/>':'')+'</g>'}
function entBlock(c){
 if(typeof entityCatalog!=='function')return'';
 const cat=entityCatalog(),l=linkFor(c.id),ids=[c.id].concat(l?[l.connectorA===c.id?l.connectorB:l.connectorA]:[]),en=(g.entityPlacements||[]).filter(e=>ids.includes(e.connectorId)),types=Object.keys(cat).filter(t=>cat[t].anchor==='connector'&&cat[t].connectorTypes.includes(c.type));
 if(!types.length)return'';
 return '<div class="xo-ent" style="margin-top:8px"><div class="mini"><b>Entities</b> (several per door or window)</div>'+(en.length?en.map(e=>'<div class="erow"><span>'+entEsc(e.name||((cat[e.type]||{}).label||e.type)+(e.role?' ('+e.role+')':''))+'</span><button class="ib" data-xent-del="'+entEsc(e.id)+'" title="Remove this entity">'+ICON_TRASH+'</button></div>').join(''):'<div class="mini">None yet.</div>')+'<div class="pal">'+types.map(t=>{const f=entFreeRole(t,c.id),r=cat[t].roles&&f&&f!==cat[t].roles[0]?' ('+f+')':'';return '<button data-xent-add="'+t+'"'+(f?'':' disabled')+'>+ '+entEsc(cat[t].label)+r+'</button>'}).join('')+'</div></div>'}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-xent-add]'),d=e.target.closest&&e.target.closest('[data-xent-del]');if(!a&&!d)return;
 const c=selPort&&port(selPort);if(!c)return;const hb=JSON.stringify(g),cat=entityCatalog();let r;
 if(a){const t=a.dataset.xentAdd;r=addEntity({graph:g,type:t,connectorId:c.id,role:cat[t].roles?entFreeRole(t,c.id):undefined})}else r=removeEntity({graph:g,id:d.dataset.xentDel});
 $('status').textContent=r.message;if(r.ok){g=r.graph;rec(hb);render()}});
document.addEventListener('change',e=>{const t=e.target.closest&&e.target.closest('[data-clink]');if(!t||!t.value)return;
 const c=port(t.dataset.clink);if(!c)return;
 const hb=JSON.stringify(g),v=t.value,k=v.slice(2),res=v[0]==='c'?linkConnectors({graph:g,connectorId:c.id,partnerId:k}):addPartner({graph:g,connectorId:c.id,roomId:k,at:pt(c)});
 $('status').textContent=res.message;
 if(!res.ok){render();return}
 try{g=res.graph;render();rec(hb)}catch(x){g=JSON.parse(hb);$('status').textContent='Could not connect: '+x.message;render()}});
document.addEventListener('change',e=>{const t=e.target.closest&&e.target.closest('[data-dtilt],[data-dslide],[data-whinge],[data-wswing],[data-wslide]');if(!t)return;
 const D=t.dataset,c=port(D.dtilt||D.dslide||D.whinge||D.wswing||D.wslide);if(!c)return;
 const hb=JSON.stringify(g);
 if(D.dtilt)setDoor(c,{tilt:t.checked});else if(D.dslide)setDoor(c,{slide:t.value});else setWindow(c,D.whinge?{hinge:t.value}:D.wswing?{swing:t.value}:{slide:t.value});
 rec(hb);render()});
onRender(function(){
 document.querySelectorAll('tr.xo,.xo-ent').forEach(r=>r.remove());
 const c=selPort&&port(selPort);if(!c||appMode!=='plan')return;
 const t0=document.querySelector('select[data-ctype]'),tb=t0&&t0.closest('table'),h=rows(c);
 if(tb&&h)tb.insertAdjacentHTML('beforeend',h);
 if(tb)tb.insertAdjacentHTML('afterend',entBlock(c));
 if(mode==='mapping'){const s=sym(c);if(s)svg.insertAdjacentHTML('beforeend',s)}
});
})();
`;
