/**
 * Issues panel: an "Issues" button in the toolbar (count of errors + warnings, green tick when clean) opens a list of everything `checkContract` finds in the file as it would be saved
 * (errors first). A row that points at one item (room, connector, relationship, area, entity, object, stairs) selects it where the current mode allows and zooms the plan to it. The
 * list is refreshed a moment after every render. Items on another floor cannot be shown: the status line says so.
 * `issuesJs` must not contain backticks, dollar-brace or backslashes.
 */
export const issuesJs = `
(function(){
const E=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const st=document.createElement('style');
st.textContent='#issues-btn[data-state=err]{background:#fee2e2;border-color:#fca5a5}#issues-btn[data-state=warn]{background:#fef3c7;border-color:#fcd34d}#issues-btn[data-state=ok]{background:#dcfce7;border-color:#86efac}#issues{position:absolute;right:12px;top:48px;width:min(460px,92%);max-height:70%;overflow:auto;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:10px 14px;z-index:6;font-size:13px}#issues[hidden]{display:none}#issues .ih{display:flex;justify-content:space-between;align-items:center}#issues h3{margin:8px 0 2px;font-size:13px}#issues h3.e{color:#b91c1c}#issues h3.w{color:#b45309}#issues ul{margin:0;padding:0;list-style:none}#issues li{padding:4px 6px;border-radius:6px;margin:1px 0}#issues li.go{cursor:pointer}#issues li.go:hover{background:#e0f2fe}#issues li.e{border-left:3px solid #ef4444}#issues li.w{border-left:3px solid #f59e0b}#issues button{margin:0;padding:2px 8px}';
document.head.appendChild(st);
const btn=document.createElement('button'),grp=document.createElement('div'),files=document.querySelector('.files');
btn.id='issues-btn';btn.title='All errors and warnings of this file. Click an entry to select the item and zoom to it.';btn.innerHTML='Issues <span id="issues-n"></span>';
document.getElementById('tb-extra').appendChild(btn);
const cv=document.querySelector('.canvas'),box=document.createElement('div');box.id='issues';box.hidden=true;cv.appendChild(box);
let list=[],tm=0;
function boxOf(l){const q=1.5;return{x:l.x-q,y:l.y-q,w:l.width+2*q,h:l.height+2*q}}
function uni(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),x2=Math.max(a.x+a.w,b.x+b.w),y2=Math.max(a.y+a.h,b.y+b.h);return{x:x,y:y,w:x2-x,h:y2-y}}
function go(t){
const R=id=>g.rooms.find(r=>r.id===id),own=cid=>g.rooms.find(r=>(r.connectors||[]).some(c=>c.id===cid));
const host=it=>{if(!it)return null;const r=it.roomId?R(it.roomId):null;if(r&&r.layout)return r.layout;if(it.areaId){const a=(g.areas||[]).find(x=>x.id===it.areaId);if(a&&a.layout)return a.layout}if(it.objectId){const o=(g.objects||[]).find(x=>x.id===it.objectId);return o&&o!==it?host(o):null}if(it.connectorId){const q=own(it.connectorId);return q&&q.layout?q.layout:null}return null};
let B=null;const add=l=>{if(l&&isFinite(l.x)&&isFinite(l.y)&&isFinite(l.width)&&isFinite(l.height)){const b=boxOf(l);B=B?uni(B,b):b}};
if(t.kind==='room'){const r=R(t.id);if(r){add(r.layout);if(appMode==='plan'){selPort=null;sel.clear();sel.add(r.id)}}}
else if(t.kind==='connector'){const r=own(t.id);if(r){add(r.layout);if(appMode==='plan'){sel.clear();sel.add(r.id);selPort=t.id}}}
else if(t.kind==='relationship'){const l=(g.relationships||[]).find(x=>x.id===t.id);if(l){const a=own(l.connectorA),b=own(l.connectorB);if(a)add(a.layout);if(b)add(b.layout)}}
else if(t.kind==='area'){const a=(g.areas||[]).find(x=>x.id===t.id);if(a){add(a.layout);if(appMode==='site')siteUi.selA=a.id}}
else if(t.kind==='entity')add(host((g.entityPlacements||[]).find(x=>x.id===t.id)));
else if(t.kind==='object')add(host((g.objects||[]).find(x=>x.id===t.id)));
else if(t.kind==='stairs'){const s=(g.stairs||[]).find(x=>x.id===t.id);if(s){try{add(stairRect(s))}catch(x){}}}
if(!B){$('status').textContent='That item is not on the plan of this floor (another floor, or it has no place yet).';return}
view={x:B.x,y:B.y,w:B.w,h:B.h};render();
}
function draw(){
const er=list.filter(x=>x.lvl==='e'),wa=list.filter(x=>x.lvl==='w');
const row=x=>'<li class="'+x.lvl+(x.target?' go':'')+'" data-i="'+x.i+'">'+E(x.message)+'</li>';
let h='<div class="ih"><b>Issues</b><button data-x="1" title="Close">&#10005;</button></div>';
if(!list.length)h+='<p>No issues: the file passes the contract check.</p>';
if(er.length)h+='<h3 class="e">Errors ('+er.length+')</h3><ul>'+er.slice(0,200).map(row).join('')+'</ul>';
if(wa.length)h+='<h3 class="w">Warnings ('+wa.length+')</h3><ul>'+wa.slice(0,200).map(row).join('')+'</ul>';
box.innerHTML=h;
}
function refresh(){
let r={errors:[],warnings:[]};
try{r=checkContract(savedGraph(g),true)}catch(x){}
list=r.errors.map(x=>Object.assign({lvl:'e'},x)).concat(r.warnings.map(x=>Object.assign({lvl:'w'},x)));
list.forEach((x,i)=>{x.i=i});
const n=list.length,b=$('issues-n');
if(b)b.innerHTML=n?String(n):'&#10003;';
btn.dataset.state=r.errors.length?'err':n?'warn':'ok';
if(!box.hidden)draw();
}
btn.onclick=()=>{box.hidden=!box.hidden;if(!box.hidden){refresh()}};
box.addEventListener('click',e=>{
if(e.target.closest('[data-x]')){box.hidden=true;return}
const li=e.target.closest('li[data-i]');if(!li)return;
const x=list[+li.dataset.i];if(x&&x.target)go(x.target);
});
onRender(()=>{clearTimeout(tm);tm=setTimeout(refresh,250)});
refresh();
})();
`;
