/**
 * Tablet / touch support (v3.2). Capture-phase listeners on the canvas, so the core pointer code stays untouched:
 *  - one finger on empty background pans (Floor plan mode; in other modes only with the Pan button), a short tap on the background still deselects;
 *  - the Pan button (hand, shown on touch devices) makes one finger pan anywhere, also when it starts on a room;
 *  - two fingers pinch-zoom and pan around their midpoint. A drag that the first finger had started is undone first (the graph is restored from the
 *    snapshot taken at the first move; a Site drawing is dropped);
 *  - the Shift button (one shot) makes the next press count as Shift + press (multi-select, keep adding): the press is re-sent as a copy with shiftKey;
 *  - CSS for coarse pointers: bigger wall strips, handles and controls; in a narrow portrait window the side panel moves below the canvas.
 * View maths: `viewGesture` (src/viewport.ts). Pen and mouse are not touched. Globals used: svg, view, active, g, siteUi, sel, selPort, appMode, addOp, render, $.
 * Placed after `heightsJs` in editor.ts. No backticks, dollar-brace or backslashes below.
 */
export const touchJs = `
(function(){
const ptr=new Map(),swallow=new Set();let gs=null,hand=false,shiftOnce=false;
const st=document.createElement('style');
st.textContent='@media(pointer:coarse){.wallhit{stroke-width:.6}.awall{stroke-width:24px}.port,.handle,.ahandle,.swinghandle{r:.26px}button,input,select{min-height:34px}.app{height:100dvh}}'
+'@media(max-width:820px) and (orientation:portrait){.app{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) 36vh}.main{order:-1}.side{border-top:1px solid #cbd5e1}.floatbox{width:min(250px,calc(100% - 20px))}}';
document.head.appendChild(st);
const tb=document.querySelector('.toolbar');
function mk(id,html,title,fn){const b=document.createElement('button');b.id=id;b.className='ib';b.innerHTML=html;b.title=title;b.onclick=fn;tb.appendChild(b);return b}
function paint(){for(const[id,on]of[['pan-toggle',hand],['shift-once',shiftOnce]]){const b=$(id);if(b){b.style.background=on?'#17202a':'';b.style.color=on?'#fff':''}}}
if(tb&&(navigator.maxTouchPoints>0||(window.matchMedia&&matchMedia('(pointer:coarse)').matches))){
 mk('pan-toggle','&#9995;','Pan with one finger, also over rooms (touch)',()=>{hand=!hand;paint()});
 mk('shift-once','&#8679;','Shift for the next press (multi-select; touch)',()=>{shiftOnce=!shiftOnce;paint()});
}
const onObject=n=>{while(n&&n!==svg){if(n.dataset&&Object.keys(n.dataset).length)return true;n=n.parentNode}return false};
function begin(){const a=[...ptr.values()],m=svg.getScreenCTM(),v={x:view.x,y:view.y,w:view.w,h:view.h},two=a.length>1;
 gs={view:v,scale:m.a,centre:{x:m.a*(v.x+v.w/2)+m.e,y:m.d*(v.y+v.h/2)+m.f},from:two?{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}:{x:a[0].x,y:a[0].y},d0:two?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y):0,n:a.length,moved:false}}
function undoDrag(){if(active&&active.before!==undefined)g=JSON.parse(active.before);active=null;if(siteUi.sact){if(siteUi.sact.before!==undefined)g=JSON.parse(siteUi.sact.before);siteUi.sact=null}}
svg.addEventListener('pointerdown',e=>{
 if(shiftOnce&&e.isTrusted&&!e.shiftKey){shiftOnce=false;paint();e.stopImmediatePropagation();e.target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,composed:true,pointerId:e.pointerId,pointerType:e.pointerType,isPrimary:e.isPrimary,clientX:e.clientX,clientY:e.clientY,button:e.button,buttons:e.buttons,shiftKey:true,altKey:e.altKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey}));return}
 if(e.pointerType!=='touch'||!e.isTrusted)return;
 ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(ptr.size===2){undoDrag();begin();e.stopImmediatePropagation();render();return}
 if(ptr.size>2){e.stopImmediatePropagation();swallow.add(e.pointerId);return}
 if(hand||(appMode==='plan'&&!addOp&&!onObject(e.target))){begin();e.stopImmediatePropagation()}
},true);
svg.addEventListener('pointermove',e=>{
 if(e.pointerType!=='touch'||!ptr.has(e.pointerId))return;
 const p=ptr.get(e.pointerId);p.x=e.clientX;p.y=e.clientY;
 if(!gs&&!swallow.has(e.pointerId))return;
 e.stopImmediatePropagation();if(!gs)return;
 const a=[...ptr.values()];if(a.length<gs.n)return;
 const two=gs.n>1,to=two?{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}:{x:a[0].x,y:a[0].y},k=two&&gs.d0>0?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/gs.d0:1;
 if(Math.hypot(to.x-gs.from.x,to.y-gs.from.y)>6||Math.abs(k-1)>.02)gs.moved=true;
 if(gs.moved){view=viewGesture({view:gs.view,scale:gs.scale,centre:gs.centre,from:gs.from,to,k});render()}
},true);
function up(e){
 if(e.pointerType!=='touch'||!ptr.has(e.pointerId))return;
 const sw=swallow.delete(e.pointerId);ptr.delete(e.pointerId);
 if(gs){e.stopImmediatePropagation();const tap=gs.n===1&&!gs.moved&&!hand;
  if(ptr.size===0){gs=null;if(tap&&appMode==='plan'){sel.clear();selPort=null;render()}}
  else{for(const id of ptr.keys())swallow.add(id);gs=null}}
 else if(sw)e.stopImmediatePropagation();
}
svg.addEventListener('pointerup',up,true);svg.addEventListener('pointercancel',up,true);
})();
`;
