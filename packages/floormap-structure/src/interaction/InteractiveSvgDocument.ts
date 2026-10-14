import type { InspectionModel } from "./InspectionModel.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function addInspectionAttributes(svg: string): string {
  return svg
    .replaceAll(/data-room-id="([^"]+)"/g, 'data-room-id="$1" data-inspect-type="room" data-inspect-id="$1"')
    .replaceAll(/data-wall-id="([^"]+)"/g, 'data-wall-id="$1" data-inspect-type="wall" data-inspect-id="$1"')
    .replaceAll(/data-connector-id="([^"]+)"/g, 'data-connector-id="$1" data-inspect-type="connector" data-inspect-id="$1"')
    .replaceAll(/data-window-id="([^"]+)"/g, 'data-window-id="$1" data-inspect-type="window" data-inspect-id="$1"');
}

export function renderInteractiveInspectionHtml(
  svg: string,
  model: InspectionModel,
  title = "Interactive Floor Inspection",
): string {
  const interactiveSvg = addInspectionAttributes(svg);
  const data = JSON.stringify(model.byKey).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;font:14px system-ui,sans-serif;background:#eef2f6;color:#17202a;display:grid;grid-template-columns:minmax(0,1fr) 320px;min-height:100vh}
main{padding:20px;overflow:auto}aside{background:white;border-left:1px solid #d7dde5;padding:20px;box-shadow:-2px 0 8px #00000012}
svg{max-width:100%;height:auto;background:white}.inspectable{cursor:pointer}.inspectable:hover{filter:brightness(.92)}.selected{filter:drop-shadow(0 0 5px #f59e0b)}
dt{font-weight:700;margin-top:12px}dd{margin:3px 0 0;word-break:break-word}.empty{color:#667085}
@media(max-width:800px){body{grid-template-columns:1fr}aside{border-left:0;border-top:1px solid #d7dde5}}
</style></head><body><main>${interactiveSvg}</main><aside><h1>Inspector</h1><div id="details" class="empty">Select a room, wall, connector, or window.</div></aside>
<script>
const records=${data};const details=document.getElementById('details');let selected;
function render(record){if(!record){details.className='empty';details.textContent='No inspection data found.';return;}details.className='';const dl=document.createElement('dl');for(const [name,value] of Object.entries(record.properties)){const dt=document.createElement('dt');dt.textContent=name;const dd=document.createElement('dd');dd.textContent=Array.isArray(value)?value.join(', '):String(value);dl.append(dt,dd);}details.replaceChildren(Object.assign(document.createElement('h2'),{textContent:record.title}),Object.assign(document.createElement('p'),{textContent:record.type}),dl);}
document.querySelectorAll('[data-inspect-type][data-inspect-id]').forEach(el=>{el.classList.add('inspectable');el.addEventListener('click',event=>{event.stopPropagation();if(selected)selected.classList.remove('selected');selected=el;el.classList.add('selected');render(records[el.dataset.inspectType+':'+el.dataset.inspectId]);});});
</script></body></html>`;
}
