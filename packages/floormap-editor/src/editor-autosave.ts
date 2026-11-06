/**
 * Autosave (v3.2): the current floor plan (the whole graph `g`: rooms, connectors, areas, objects, entities, floors, walls heights) is kept in the browser
 * (`localStorage`, key `floormap-autosave:` + the page path) about half a second after every change and when the page is closed or reloaded, and is restored when
 * the page opens, through the same steps as "Load" (`entLoad`, history cleared, selection cleared). The undo history is not kept.
 * `?fresh=1` in the address ignores and deletes the autosave (back to the file the page was generated with); "New plan" and "Load" simply replace it with the next change.
 * If the browser refuses to store it (private mode, storage full) the status line says so once. "Save graph" stays the way to keep a file.
 * Placed after `dockJs`, before the final `render()`. Globals used: g, entLoad, hist, sel, $, onRender. No backticks, dollar-brace or backslashes below.
 */
export const autosaveJs = `
(function(){
const KEY='floormap-autosave:'+location.pathname;
if(/[?&]fresh=1/.test(location.search)){try{localStorage.removeItem(KEY)}catch(x){}}
else{try{
 const s=JSON.parse(localStorage.getItem(KEY)||'null');
 if(s&&s.graph&&Array.isArray(s.graph.rooms)&&Array.isArray(s.graph.relationships)){
  g=s.graph;entLoad();hist.clear();sel.clear();
  const t=s.savedAt?new Date(s.savedAt):null;
  $('status').textContent='Restored your last session'+(t?' (autosaved '+t.toLocaleTimeString()+')':'')+'. Add ?fresh=1 to the address to reload the original file.'}
}catch(x){}}
let timer=0,warned=false;
function save(){timer=0;try{localStorage.setItem(KEY,JSON.stringify({v:1,savedAt:Date.now(),graph:g}))}catch(x){if(!warned){warned=true;$('status').textContent='Autosave failed (browser storage is full or blocked). Use Save graph to keep your plan.'}}}
function flush(){if(timer){clearTimeout(timer);save()}}
onRender(()=>{if(!timer)timer=setTimeout(save,500)});
addEventListener('pagehide',flush);addEventListener('beforeunload',flush);
})();
`;
