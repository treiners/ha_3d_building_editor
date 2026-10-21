/**
 * Settings view (gear at the top right of the sidebar), hover tips and the structured inspector table.
 * `settingsHeadHtml` (title + gear), `settingsViewHtml` (all setting options in sections: Layout, Connectors, Entities, Interface), `settingsCss`, `settingsJs`.
 * The ids of the moved options are unchanged (no-overlap, glue-touch, show-bars, new-conn, new-width, new-door, ent-cov, ent-resize, classic), so every existing
 * handler keeps working; only their place in the document changed. While the view is open (body[data-settings="1"]) everything else in the sidebar is hidden.
 * Also: double-clicking a room in floor-plan mode opens the Layout tab. No backticks or dollar-brace inside settingsJs.
 */
const GEAR =
  '<svg class="ic" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

export const settingsHeadHtml =
  '<div class="sidehead"><h1>Room mapping 3.0 beta</h1><button id="gear" class="ib" title="Settings" aria-label="Settings" aria-pressed="false">' + GEAR + '</button></div>';

export const settingsViewHtml =
  '<div id="settings-view" class="setview">' +
  '<div class="card"><h2>Layout</h2><label class="row"><input id="no-overlap" type="checkbox" checked> Block overlaps (Slide modes, walls)</label><label class="row"><input id="glue-touch" type="checkbox" checked> Resize touching rooms too (walls, Slide-mode corners)</label></div>' +
  '<div class="card"><h2>Connectors</h2><label class="row"><input id="show-bars" type="checkbox" checked> Show connector widths</label><div class="mini">New connections (Connect, Add connector, new rooms)</div>' +
  '<select id="new-conn"><option value="door">door</option><option value="open-passage">open passage</option><option value="none">no connection</option></select>' +
  '<div class="row"><input id="new-width" placeholder="width m (default)"><select id="new-door"><option value="">door type</option><option value="hinged">hinged</option><option value="sliding">sliding</option><option value="pocket">pocket</option></select></div></div>' +
  '<div class="card"><h2>Entities</h2><label class="row"><input id="ent-cov" type="checkbox"> Show coverage of all sensors</label><label class="row">On room resize <select id="ent-resize"><option value="proportional">scale proportionally</option><option value="anchor">keep distance to corner</option></select></label></div>' +
  '<div class="card"><h2>Interface</h2><label class="row"><input id="classic" type="checkbox"> Classic layout (all sections, for comparison)</label></div>' +
  '</div>';

export const settingsCss =
  '.sidehead{display:flex;align-items:center;justify-content:space-between;gap:8px}.sidehead h1{margin:0}#gear.active{background:#17202a;color:#fff}' +
  '.setview{display:none}body[data-settings="1"] .setview{display:block}body[data-settings="1"] .side>*:not(.sidehead):not(.setview):not(svg){display:none}.setview .row{margin:4px 0}' +
  '.tip{position:relative;display:inline-block;margin-left:6px;width:16px;height:16px;line-height:16px;text-align:center;border-radius:50%;background:#cbd5e1;color:#334155;font-size:11px;font-weight:700;cursor:help;vertical-align:middle}' +
  '.tipbox{display:none;position:absolute;left:-8px;top:22px;z-index:20;width:240px;padding:8px 10px;border-radius:8px;background:#17202a;color:#fff;font-size:12px;font-weight:400;line-height:1.35;text-align:left;box-shadow:0 4px 12px rgba(0,0,0,.25)}.tip:hover .tipbox,.tip:focus .tipbox{display:block}' +
  '.ptable{width:100%;border-collapse:collapse;font-size:12px}.ptable td{padding:3px 4px;border-bottom:1px solid #e2e8f0;vertical-align:middle}.ptable tr:last-child td{border-bottom:0}.ptable td:first-child{color:#475569;width:36%;white-space:nowrap}.ptable input,.ptable select{width:100%;box-sizing:border-box}.pin{display:flex;gap:4px;align-items:center}.pin input{flex:1;min-width:0}';

export const settingsJs = `
function setSettings(on){document.body.dataset.settings=on?'1':'';$('gear').classList.toggle('active',on);$('gear').setAttribute('aria-pressed',on?'true':'false')}
$('gear').onclick=()=>setSettings(document.body.dataset.settings!=='1');
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.dataset.settings==='1')setSettings(false)});
svg.addEventListener('dblclick',e=>{if(appMode!=='plan'||addOp)return;if(e.target.closest('[data-port],[data-wall],[data-resize],[data-swing]'))return;if(e.target.closest('[data-room]')){setSettings(false);setUi('layout')}});
`;
