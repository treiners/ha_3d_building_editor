/**
 * Heights card of the room box (v3.2): "Height from floor" (`room.elevation`). The card is appended to `#panel` after every render while exactly one room is
 * selected in Floor plan mode (the core `panel()` stays untouched); edits go through the pure `setRoomHeights` (src/heights.ts, one undo step each).
 * Wall heights are set per wall in the Walls mode (editor-walls.ts); the room default `wallHeight` stays in the file format but has no field here.
 * The "+0.45 m" label of a raised room is drawn by editor-dims.ts, only while the wall length toggle (m) is on.
 * Also makes the input fields of the room box as low as a text line (mouse and pen; touch keeps its larger targets).
 * Placed after `roomboxJs` and before `boxesJs` in editor.ts. Globals used: g, $, sel, selS, room, rec, render, appMode, onRender, setRoomHeights.
 * No backticks, dollar-brace or backslashes below.
 */
export const heightsJs = `
(function(){
const fmt=v=>v>0?String(v):'';
const st=document.createElement('style');
st.textContent='@media(pointer:fine){#panel input:not([type=checkbox]){height:24px;box-sizing:border-box;padding:1px 6px}}';
document.head.appendChild(st);
function card(r){
 return '<div class="card" id="rh-card"><label class="rw">Height from floor <input data-rh="elevation" value="'+fmt(r.elevation)+'" placeholder="0"> m</label></div>'}
document.addEventListener('change',e=>{const t=e.target.closest&&e.target.closest('[data-rh]');if(!t)return;
 const id=[...sel][0],v=t.value.trim()===''?null:parseFloat(t.value.replace(',','.')),patch={elevation:v};
 const hb=JSON.stringify(g),res=setRoomHeights({graph:g,roomId:id,patch});$('status').textContent=res.message;if(res.ok){g=res.graph;rec(hb)}render()});
onRender(function(){
 const old=$('rh-card');if(old)old.remove();
 const r=room([...sel][0]);
 if(appMode==='plan'&&sel.size===1&&r&&r.layout&&!selS)$('panel').insertAdjacentHTML('beforeend',card(r));
});
})();
`;
