/**
 * Room actions (part of the page script, see editor.ts for the order of the parts).
 * Add room, connect rooms, delete room (side panel buttons).
 * Functions: delRoom.
 * Plain JavaScript in a template string, copied unchanged from editor.ts: edit with exact-substring replacements and run `npm test` (golden test) afterwards.
 */
export const coreActionsJs=`$('add-room').onclick=()=>{const hb=JSON.stringify(g),ct=$('new-conn').value,res=addRoom({graph:g,name:$('new-name').value,sizeCategory:$('new-size').value,nextTo:[...sel][0],side:$('new-side').value,connect:ct==='none'?'':ct,width:+$('new-width').value||undefined,doorType:$('new-door').value||undefined});editApply(res,hb,[res.id]);if(res.ok)$('new-name').value=''};
$('connect-rooms').onclick=()=>{const ids=[...sel],hb=JSON.stringify(g);if(ids.length!==2){$('status').textContent='Select exactly two rooms (click one, shift-click the other).';return}const ct=$('new-conn').value;editApply(connectRooms({graph:g,roomA:ids[0],roomB:ids[1],type:ct==='none'?'door':ct,width:+$('new-width').value||undefined,doorType:$('new-door').value||undefined}),hb,ids)};
function delRoom(){const ids=[...sel],hb=JSON.stringify(g);if(ids.length!==1){$('status').textContent='Select one room to delete.';return}editApply(removeRoom({graph:g,roomId:ids[0]}),hb,[])}`;
