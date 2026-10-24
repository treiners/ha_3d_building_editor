/**
 * Connector box, entity box and site box: the connector editor (`#panel-conn`, written by `panel()` through `connCard`), the entity
 * inspector (`#ent-inspector`, written by `entPanel()`) and the area inspector of Site mode (`#site-inspector`, written by `sitePanel()`)
 * as floating boxes on the canvas, like the room box (editor-roombox.ts) and the stair box, instead of cards in the sidebar. The elements
 * and everything that writes into them or listens on them stay exactly as they are; this module only moves them onto the canvas, shows
 * them while they have something to edit, and gives all three one tidy layout.
 *
 *   connector box  Floor plan mode, a connector is selected (not while a stair is selected); sits under the room box when a room is shown too
 *   entity box     Entities mode, at least one entity selected (one: its fields; several: the align / multi tools)
 *   site box       Site mode, an area is selected
 *
 * Layout (all scoped to the ids of the boxes, so nothing else on the page is affected): title row with the trash icon on the right, then rows with
 * the label in the left column and the control filling the right column; unit inputs (m, degrees) keep their unit next to the field;
 * checkbox lists run in one column. The room box (`#panel`) and the stair box (`#stairbox`) keep their markup and behaviour; only their layout
 * is aligned with the three boxes here (same width, same title row, same label / field columns).
 * Must come after `roomboxJs` in editor.ts (it measures the room box). `boxesJs` must not contain backticks, dollar-brace or backslashes.
 */
export const boxesJs = `
(function(){
const cv=document.querySelector('.canvas'),st=document.createElement('style'),
 B='#panel-conn.floatbox,#ent-inspector.floatbox,#site-inspector.floatbox,#obj-inspector.floatbox',
 form=id=>{const q=id+'.floatbox';return q+' .erow{display:grid;grid-template-columns:38% 1fr;align-items:center;column-gap:8px;margin:3px 0}'
 +q+' .erow input,'+q+' .erow select{width:100%;box-sizing:border-box;min-width:0;margin:0}'
 +q+' .erow span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +q+' .erow2{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin:3px 0}'
 +q+' .erow2 label{display:flex;align-items:center;gap:4px;margin:0}'
 +q+' .erow2 .sm{width:64px;margin:0}'
 +q+' .erow2 .mini{flex-basis:100%}'
 +q+' .emulti{flex-direction:column;align-items:flex-start;gap:2px}'
 +q+' label.row{display:flex;align-items:center;gap:6px;margin:4px 0}'
 +q+' .mini{color:#64748b;font-size:12px}'
 +q+' .ewarn{margin-top:6px;padding:4px 6px;border-radius:6px;background:#fef3c7;color:#92400e;font-size:12px}'};
st.textContent=B+'{position:absolute;right:10px;top:84px;width:250px;max-height:calc(100% - 100px);overflow:auto;box-sizing:border-box;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:6px 10px 8px;z-index:4;font-size:13px}'
+'#panel-conn.floatbox[hidden],#ent-inspector.floatbox[hidden],#site-inspector.floatbox[hidden]{display:none}'
+'#panel-conn.floatbox .card,#ent-inspector.floatbox .card,#site-inspector.floatbox .card{background:none;border:0;padding:0;margin:0}'
+'#panel-conn.floatbox .sechead,#ent-inspector.floatbox .nm,#site-inspector.floatbox .nm{display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:0;padding:0;margin:0 0 4px}'
+'#panel-conn.floatbox h2,#ent-inspector.floatbox h2,#site-inspector.floatbox h2{font-size:15px;margin:2px 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
+'#panel-conn.floatbox .ib,#ent-inspector.floatbox .ib,#site-inspector.floatbox .ib{flex:none}'
+'#panel-conn.floatbox .ptable{width:100%;border-collapse:collapse}'
+'#panel-conn.floatbox .ptable td{padding:3px 0;vertical-align:middle}'
+'#panel-conn.floatbox .ptable td:first-child{width:38%;padding-right:8px;color:#475569}'
+'#panel-conn.floatbox .ptable select,#panel-conn.floatbox .ptable input{width:100%;box-sizing:border-box;min-width:0;margin:0}'
+'#panel-conn.floatbox .pin{display:flex;align-items:center;gap:4px}'
+'#panel-conn.floatbox .pin input{flex:1}'
+'#panel-conn.floatbox small{display:block;margin-top:2px;color:#64748b}'
+form('#ent-inspector')+form('#site-inspector')+form('#obj-inspector')
+'#obj-inspector.floatbox[hidden]{display:none}#obj-inspector.floatbox .card{background:none;border:0;padding:0;margin:0}#obj-inspector.floatbox .nm{display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:0;padding:0;margin:0 0 4px}'
+'#obj-inspector.floatbox h2{font-size:15px;margin:2px 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#obj-inspector.floatbox .ib{flex:none}'
+'#panel.floatbox .nm{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 4px}'
+'#panel.floatbox h2{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
+'#panel.floatbox .ib,#stairbox .sh .ib{flex:none;padding:3px 6px}'
+'#panel.floatbox .card>label{display:flex;align-items:center;gap:6px;margin:3px 0}'
+'#panel.floatbox .rw{margin:3px 0}'
+'#stairbox{width:250px;box-sizing:border-box;padding:6px 10px 8px;max-height:calc(100% - 100px);overflow:auto}'
+'#stairbox .sh{align-items:center;justify-content:space-between;gap:8px;margin:0 0 4px}'
+'#stairbox label{display:grid;grid-template-columns:38% 1fr auto;align-items:center;column-gap:8px;margin:3px 0}'
+'#stairbox label input{width:100%;box-sizing:border-box;min-width:0;margin:0}'
+'#stairbox .sd{margin:3px 0}'
+'#stairbox .mini{margin-top:4px}';
document.head.appendChild(st);
cv.style.position='relative';
const cb=$('panel-conn'),eb=$('ent-inspector'),sb=$('site-inspector'),ob=$('obj-inspector'),rb=$('panel');
for(const el of [cb,eb,sb,ob]){cv.appendChild(el);el.classList.add('floatbox')}
function sync(){
 const roomShown=!rb.hidden;
 cb.hidden=!(selPort&&port(selPort)&&appMode==='plan'&&!selS);
 cb.style.top=(roomShown&&!cb.hidden?rb.offsetTop+rb.offsetHeight+8:84)+'px';
 eb.hidden=!(appMode==='entities'&&entSel().length>0);
 sb.hidden=!(appMode==='site'&&siteUi.selA&&siteGet(siteUi.selA));
 ob.hidden=!(appMode==='objects'&&objUi.sel&&objGet(objUi.sel));
}
onRender(sync);
sync();
})();
`;
