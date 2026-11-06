/**
 * Right-hand dock (v3.2): the floating boxes (room, stair, connector, entity, site, object) live in ONE column on the canvas that keeps their floating look
 * but scrolls when the boxes together are taller than the window, so no box can become unreachable. Click a box title to collapse / expand it (a small
 * triangle shows the state; remembered per box in localStorage `floormap-dock`). Collapsed boxes show only their title row.
 * The boxes keep their ids, markup and code; this module only moves them into `#dock` (after `boxesJs`, which creates the last of them), overrides their
 * absolute position with CSS and marks the title row of each box after every render (and when a box is rewritten) so that the collapsed state can hide the rest.
 * No automatic collapsing. The zoom buttons (zoom out / 100% / zoom in / fit all) are moved from the top bar into the status bar, next to the joints line; the grid select stays in the top bar. No backticks, dollar-brace or backslashes below.
 */
export const dockJs = `
(function(){
const cv=document.querySelector('.canvas'),st=document.createElement('style'),dock=document.createElement('div');dock.id='dock';
let col={};try{col=JSON.parse(localStorage.getItem('floormap-dock')||'{}')||{}}catch(x){col={}}
st.textContent='#dock{position:absolute;right:2px;top:80px;width:278px;box-sizing:border-box;max-height:calc(100% - 84px);padding:4px 8px 16px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:8px;z-index:4;scrollbar-gutter:stable}'
+'#dock>*{position:static!important;width:auto!important;max-height:none!important;overflow:visible!important;flex:none;margin:0!important}'
+'#dock>[hidden]{display:none!important}'
+'.dock-h{cursor:pointer}.dock-h::before{content:"";flex:none;border:5px solid transparent;border-top-color:#64748b;margin:5px 5px 0 0}'
+'#dock>.col .dock-h::before{transform:rotate(-90deg);margin:0 5px 5px 0}'
+'#dock>.col *:not(.keep):not(.keeph):not(.keeph *){display:none!important}'
+'@media(max-width:820px) and (orientation:portrait){#dock{width:min(278px,calc(100% - 4px))}}';
document.head.appendChild(st);
cv.style.position='relative';cv.appendChild(dock);
const boxes=['panel','stairbox','panel-conn','ent-inspector','site-inspector','obj-inspector','wall-inspector'].map(id=>document.getElementById(id)).filter(Boolean);
for(const b of boxes)dock.appendChild(b);
function mark(){
 for(const b of boxes){
  b.querySelectorAll('.keep,.keeph,.dock-h').forEach(n=>n.classList.remove('keep','keeph','dock-h'));
  const h=b.querySelector('.nm,.sechead,.sh');
  if(h){h.classList.add('dock-h','keeph');for(let n=h.parentNode;n&&n!==b;n=n.parentNode)n.classList.add('keep')}
  b.classList.toggle('col',!!col[b.id]&&!!h);
 }
}
dock.addEventListener('click',e=>{
 const h=e.target.closest&&e.target.closest('.dock-h');
 if(!h||e.target.closest('button,input,select,textarea,label,a'))return;
 const b=h.closest('#dock>*');if(!b)return;
 if(col[b.id])delete col[b.id];else col[b.id]=true;
 try{localStorage.setItem('floormap-dock',JSON.stringify(col))}catch(x){}
 mark();
});
let queued=false;
const mo=new MutationObserver(()=>{if(queued)return;queued=true;const f=()=>{queued=false;mark()};if(window.requestAnimationFrame)requestAnimationFrame(f);else setTimeout(f,0)});
for(const b of boxes)mo.observe(b,{childList:true,subtree:true});
const sb=document.querySelector('.statusbar'),zst=document.createElement('style');
zst.textContent='.statusbar{display:flex;align-items:center;gap:12px}.statusbar .status:first-child{flex:1 1 auto}.statusbar .zoombar{margin-left:auto;flex:none;display:flex;gap:4px;align-items:center}.statusbar .zoombar button{margin:0;padding:2px 8px;min-height:0}';
document.head.appendChild(zst);
if(sb&&document.getElementById('zoom-out')){const zb=document.createElement('div');zb.className='grp zoombar';for(const id of ['zoom-out','zoom-reset','zoom-in','fit-all'])zb.appendChild(document.getElementById(id));sb.appendChild(zb)}
onRender(mark);
mark();
})();
`;
