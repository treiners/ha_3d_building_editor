/**
 * Mapper result, undo / redo, shortcuts (part of the page script, see editor.ts for the order of the parts).
 * Applying a mapper result, the snapshot history (`rec` after a finished gesture, `restore`), `chrome()` (button / status state) and the Ctrl+Z / Ctrl+Y shortcuts. `restore` and `render` are wrapped by editor-hooks.ts.
 * Functions: applyMap, rec, restore, undo, redo, chrome.
 * Top-level lets / consts: hist.
 * Plain JavaScript in a template string, copied unchanged from editor.ts: edit with exact-substring replacements and run `npm test` (golden test) afterwards.
 */
export const coreHistoryJs=`function applyMap(res,ids){for(const r of g.rooms){if(!ids.has(r.id))continue;const L=res.layouts[r.id];r.layout={...L,x:clean(L.x),y:clean(L.y),width:clean(L.width),height:clean(L.height)};r.connectors.forEach(p=>norm(r,p))}for(const o of res.openings){const a=port(o.connectorA),b=port(o.connectorB);if(!a||!b||(!ids.has(a.roomId)&&!ids.has(b.roomId)))continue;for(const[p,off]of[[a,o.offsetA],[b,o.offsetB]]){const r=room(p.roomId);norm(r,p);p.offset=clean(Math.max(.05,Math.min(len(r,p.side)-.05,off)));p.position=clean(p.offset/len(r,p.side))}}}
const hist=createHistory(100);
function rec(before){const now=JSON.stringify(g);if(before!==now)hist.push(before)}
function restore(s,label){if(s===null)return;g=JSON.parse(s);active=null;for(const id of [...sel])if(!room(id))sel.delete(id);$('status').textContent=label;render()}
function undo(){restore(hist.undo(JSON.stringify(g)),'Undo.')}
function redo(){restore(hist.redo(JSON.stringify(g)),'Redo.')}
function chrome(){$('undo').disabled=!hist.canUndo();$('redo').disabled=!hist.canRedo();const s=deriveJoints(g).summary;$('joints').textContent='Joints: '+s.ok+' attached'+(s.broken?', '+s.broken+' broken':'')+(s.detached?', '+s.detached+' detached':'')+(s.invalid?', '+s.invalid+' invalid':'')}
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;const k=e.key.toLowerCase();if(k==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(k==='y'){e.preventDefault();redo()}});`;
