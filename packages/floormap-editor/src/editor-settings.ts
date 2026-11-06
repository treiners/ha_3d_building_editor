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
  '<div class="sidehead"><h1>Room mapping 3.1</h1><button id="gear" class="ib" title="Settings" aria-label="Settings" aria-pressed="false">' + GEAR + '</button></div>';

export const settingsViewHtml =
  '<div id="settings-view" class="setview">' +
  '<div class="card"><h2>Layout</h2><label class="row"><input id="no-overlap" type="checkbox" checked> Block overlaps (Slide modes, walls)</label><label class="row"><input id="glue-touch" type="checkbox" checked> Resize touching rooms too (walls, Slide-mode corners)</label><label class="row"><input id="slide-doors" type="checkbox" checked> Slide doors along when a wall would cut them off (walls)</label><label class="row">Min room size <input id="min-room" class="sm" placeholder="auto" title="Smallest width or height in metres for the wall tools and corners. Empty = 50% of the room category default, at least 1 m."> m</label><label class="row">Max room size <input id="max-room" class="sm" placeholder="auto" title="Largest width or height in metres for the wall tools and corners. Empty = 250% of the room category default."> m</label></div>' +
  '<div class="card"><h2>Connectors</h2><label class="row"><input id="show-bars" type="checkbox" checked> Show connector widths</label><div class="mini">New connections (Connect, Add connector, new rooms)</div>' +
  '<select id="new-conn"><option value="door">door</option><option value="open-passage">open passage</option><option value="none">no connection</option></select>' +
  '<div class="row"><input id="new-width" placeholder="width m (default)"><select id="new-door"><option value="">door type</option><option value="hinged">hinged</option><option value="sliding">sliding</option><option value="pocket">pocket</option></select></div></div>' +
  '<div class="card"><h2>Entities</h2><label class="row"><input id="ent-cov" type="checkbox"> Show coverage of all sensors</label><label class="row">On room resize <select id="ent-resize"><option value="proportional">scale proportionally</option><option value="anchor">keep distance to corner</option></select></label></div>' +
  '<div class="card"><h2>Colours</h2><label class="row">Room fill <input type="color" data-col="--c-room" value="#eff6ff"></label><label class="row">Room outline <input type="color" data-col="--c-edge" value="#1d4ed8"></label><label class="row">Locked (position + size) <input type="color" data-col="--c-lock" value="#ecfdf5"></label><label class="row">Position locked <input type="color" data-col="--c-plock" value="#fefce8"></label><label class="row">Size locked <input type="color" data-col="--c-slock" value="#f5f3ff"></label><button id="col-reset">Reset colours</button><div class="mini">Kept in this browser only, not in the plan file.</div></div>' +
  '<div class="card"><h2>Interface</h2><label class="row"><input id="classic" type="checkbox"> Classic layout (all sections, for comparison)</label><label class="row">Toolbar <select id="tb-layout"><option value="current">Current</option><option value="grouped">Grouped (fixed rows, zoom in status bar)</option></select></label></div>' +
  '</div>';

export const settingsCss =
  '.sidehead{display:flex;align-items:center;justify-content:space-between;gap:8px}.sidehead h1{margin:0}#gear.active{background:#17202a;color:#fff}' +
  '.setview{display:none}body[data-settings="1"] .setview{display:block}body[data-settings="1"] .side>*:not(.sidehead):not(.setview):not(svg){display:none}.setview .row{margin:4px 0}' +
  '.tip{position:relative;display:inline-block;margin-left:6px;width:16px;height:16px;line-height:16px;text-align:center;border-radius:50%;background:#cbd5e1;color:#334155;font-size:11px;font-weight:700;cursor:help;vertical-align:middle}' +
  '.tipbox{display:none;position:absolute;left:-8px;top:22px;z-index:20;width:240px;padding:8px 10px;border-radius:8px;background:#17202a;color:#fff;font-size:12px;font-weight:400;line-height:1.35;text-align:left;box-shadow:0 4px 12px rgba(0,0,0,.25)}.tip:hover .tipbox,.tip:focus .tipbox{display:block}' +
  '.ptable{width:100%;border-collapse:collapse;font-size:12px}.ptable td{padding:3px 4px;border-bottom:1px solid #e2e8f0;vertical-align:middle}.ptable tr:last-child td{border-bottom:0}.ptable td:first-child{color:#475569;width:36%;white-space:nowrap}.ptable input,.ptable select{width:100%;box-sizing:border-box}.pin{display:flex;gap:4px;align-items:center}.pin input{flex:1;min-width:0}' +
  '.setview input[type=color]{flex:none;width:44px;height:26px;padding:0;margin:0}.visgrp button.active{background:#17202a;color:#fff}body.hide-rooms [data-room],body.hide-rooms .link,body.hide-rooms line.bad,body.hide-rooms .gaplink,body.hide-rooms .port,body.hide-rooms .bar,body.hide-rooms .jointwall,body.hide-rooms .jointarrow,body.hide-rooms .wallhit,body.hide-site .arealayer,body.hide-obj .objlayer,body.hide-ent .ent,body.hide-ent .ent-label,body.hide-ent .ent-cone,body.hide-ent .ent-hint,body.hide-ent .ent-ring,body.hide-ent .ent-h,body.hide-ent .ent-hl,body:not([data-app=entities]) [data-vis=ent]{display:none}' +
  '.tbbreak{display:none}body.tbg .toolbar>*{order:5}body.tbg .toolbar>.grp.files{order:1}body.tbg .toolbar>.grp:first-child{order:2}body.tbg .toolbar>.visgrp{order:3;margin-left:auto}body.tbg .toolbar>.seg.tabs{order:6}body.tbg .toolbar>.tbbreak{display:block;flex:0 0 100%;height:0;order:4}' +
  'body.tbg:not([data-app=entities]) [data-vis=ent]{display:inline-block;visibility:hidden}body.tbg .visgrp [data-vis=ent]{order:99}' +
  'body.tbg:not(.classic):is([data-app=entities],[data-app=site],[data-app=objects]) :is(.toolbar .seg.modern-only,.toolbar .seg.tabs){display:flex}body.tbg:not(.classic):is([data-app=entities],[data-app=site],[data-app=objects]) :is(#run-mapper,#close-gaps,#fit-room,#gap){display:inline-block}' +
  'body.tbg:is([data-app=entities],[data-app=site],[data-app=objects]) :is(.toolbar .seg.modern-only,.toolbar .seg.tabs,#run-mapper,#close-gaps,#fit-room,#shape-opt){opacity:.4;pointer-events:none}' +
  '.statusbar>#zoomgrp{flex:none;margin:0}.statusbar .grp button,.statusbar .grp select{padding:2px 7px;font-size:14.4px;margin:0}.statusbar .ic{width:18px;height:18px}' +
  'body.tbg .toolbar>.visgrp{gap:6px}body.tbg .toolbar>.visgrp button{margin:0;border-radius:8px}body.tbg .toolbar>#tb-extra{order:7;margin-left:auto}#tb-extra #issues-btn{order:1}#tb-extra #export-btn{order:2}.toolbar #shape-opt input{box-sizing:border-box;margin:0;padding:3px 8px;min-height:0;line-height:1.3;border-radius:8px}';

export const settingsJs = `
function setSettings(on){document.body.dataset.settings=on?'1':'';$('gear').classList.toggle('active',on);$('gear').setAttribute('aria-pressed',on?'true':'false')}
$('gear').onclick=()=>setSettings(document.body.dataset.settings!=='1');
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.dataset.settings==='1')setSettings(false)});
function roomZoom(id){const r=room(id),R=r&&r.layout;if(!R)return;const p=1,x=R.x-p,y=R.y-p,w=R.width+2*p,h=R.height+2*p;if(Math.abs(view.x-x)<1e-6&&Math.abs(view.w-w)<1e-6)fit();else{view={x,y,w,h};render()}}
const dcUi={t:0,x:0,y:0,pend:null};
function roomAtPt(P){let b=null,ba=1e18;for(const r of g.rooms){const R=r.layout;if(!R||r.name.toLowerCase()==='outside')continue;if(P.x>=R.x&&P.x<=R.x+R.width&&P.y>=R.y&&P.y<=R.y+R.height&&R.width*R.height<ba){b=r.id;ba=R.width*R.height}}return b}
function dcOk(e){return !(appMode==='site'||addOp||(appMode==='entities'&&entUi.placing)||(appMode==='objects'&&objUi.placing)||e.target.closest('[data-port],[data-wall],[data-resize],[data-swing],.ent,.obj,.ahandle,.ent-h,.obj-h,.obj-rs'))}
svg.addEventListener('pointerdown',e=>{dcUi.pend=null;if(e.button>0||!dcOk(e))return;let P;try{P=world(e)}catch(x){return}const t=Date.now();if(t-dcUi.t<400&&Math.hypot(P.x-dcUi.x,P.y-dcUi.y)<.3){dcUi.pend=P;dcUi.t=0}else{dcUi.t=t;dcUi.x=P.x;dcUi.y=P.y}},true);
svg.addEventListener('pointerup',e=>{const P=dcUi.pend;dcUi.pend=null;if(!P)return;let Q;try{Q=world(e)}catch(x){return}if(Math.hypot(Q.x-P.x,Q.y-P.y)>=.3)return;const id=roomAtPt(P);if(id){if(appMode==='plan'){setSettings(false);setUi('layout')}roomZoom(id)}else fit()});
svg.addEventListener('dblclick',e=>{if(appMode!=='plan'||addOp)return;if(e.target.closest('[data-port],[data-wall],[data-resize],[data-swing]'))return;if(e.target.closest('[data-room]')){setSettings(false);setUi('layout')}});
document.querySelectorAll('[data-vis]').forEach(b=>b.onclick=()=>{const k=b.dataset.vis,off=!document.body.classList.contains('hide-'+k);document.body.classList.toggle('hide-'+k,off);b.classList.toggle('active',!off)});
const colInputs=[...document.querySelectorAll('[data-col]')],colSave=()=>{try{localStorage.setItem('floormap-colours',JSON.stringify(Object.fromEntries(colInputs.map(i=>[i.dataset.col,i.value]))))}catch(x){}};
try{const s=JSON.parse(localStorage.getItem('floormap-colours')||'{}');colInputs.forEach(i=>{if(s[i.dataset.col]){i.value=s[i.dataset.col];document.documentElement.style.setProperty(i.dataset.col,i.value)}})}catch(x){}
colInputs.forEach(i=>i.oninput=()=>{document.documentElement.style.setProperty(i.dataset.col,i.value);colSave()});
$('col-reset').onclick=()=>{colInputs.forEach(i=>{i.value=i.defaultValue;document.documentElement.style.removeProperty(i.dataset.col)});try{localStorage.removeItem('floormap-colours')}catch(x){}};
const zg=$('zoomgrp'),zhome=zg.parentNode,zref=zg.nextSibling;
function setTb(on){document.body.classList.toggle('tbg',on);if(on)document.querySelector('.statusbar').appendChild(zg);else zhome.insertBefore(zg,zref);try{localStorage.setItem('floormap-toolbar',on?'grouped':'current')}catch(x){}}
$('tb-layout').onchange=()=>setTb($('tb-layout').value==='grouped');
try{if(localStorage.getItem('floormap-toolbar')==='grouped'){$('tb-layout').value='grouped';setTb(true)}}catch(x){}
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||appMode!=='plan'||document.body.dataset.settings==='1')return;const t=e.target;if(t&&(/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)||t.isContentEditable))return;if(e.key==='F2'){const rb=$('rename-room');if(rb){rb.click();e.preventDefault()}return}const v={c:'rooms',w:'walls',s:'shape'}[e.key.toLowerCase()],b=v&&document.querySelector('[data-seg=tool][data-v="'+v+'"]');if(b){b.click();e.preventDefault()}});
`;
