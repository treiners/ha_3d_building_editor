/**
 * "Merge rooms" in the room panel (part of the page script, see editor.ts for the order of the parts): with exactly two rooms selected (Shift-click) in Floor plan mode a button is
 * added to the floating room panel. It calls the pure `mergeRooms` (room-shape.ts): the first selected room is kept (name, id, type), the second one is merged into it; the result is
 * a shaped room when the union is not a rectangle. One undo step. `mergeJs` must not contain backticks, dollar-brace or backslashes.
 */
export const mergeJs = `
(function(){
function mergeUi(){
const old=$('merge-rooms-card');if(old)old.remove();
if(appMode!=='plan'||sel.size!==2)return;
const ids=[...sel],a=room(ids[0]),b=room(ids[1]),p=$('panel');
if(!a||!b||!p)return;
const d=document.createElement('div'),btn=document.createElement('button');
d.className='card';d.id='merge-rooms-card';
btn.id='merge-rooms';btn.textContent='Merge into '+a.name;
btn.title='Merge '+b.name+' into '+a.name+'. The rooms must share part of a wall; the result is a shaped room when it is not a rectangle.';
btn.onclick=()=>{const hb=JSON.stringify(g);editApply(mergeRooms({graph:g,ids:ids}),hb,[ids[0]])};
d.appendChild(btn);p.appendChild(d);
}
onRender(mergeUi);
mergeUi();
})();
`;
