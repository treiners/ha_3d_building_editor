// Optional smoke test for connector width inputs and "Close gaps" (needs jsdom, run after `npm run build`, from the package folder).
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x, cs) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: cs, layout: { x, y: 0, width: 4, height: 3 } });
const g = { schemaVersion: '2.14', rooms: [room('a', 0, [{ id: 'ar', roomId: 'a', side: 'right', type: 'door', offset: 1.5 }]), room('b', 4.6, [{ id: 'bl', roomId: 'b', side: 'left', type: 'door', offset: 1.5 }])], relationships: [{ id: 'ab', connectorA: 'ar', connectorB: 'bl', importance: 'required' }] };
const d = new JSDOM(editorHtml(g), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id);
$('canvas').setPointerCapture = () => {};
const ev = (type, el) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
assert.match($('joints').textContent, /1 broken/);
$('close-gaps').click();
assert.match($('status').textContent, /1 closed/); assert.match($('joints').textContent, /1 attached/);
assert.equal(w.eval('g.rooms[0].layout.width'), 4.6);
// width input: select room a, type 2 in its connector width box -> both connectors get the width, one undo step
w.eval("sel.clear();selPort='ar';render()");
const inp = doc.querySelector('[data-cwidth="ar"]'); assert.ok(inp, 'connector width box'); inp.value = '2'; ev('change', inp);
assert.equal(w.eval("g.rooms[0].connectors[0].width"), 2); assert.equal(w.eval("g.rooms[1].connectors[0].width"), 2);
$('undo').click(); assert.equal(w.eval("g.rooms[0].connectors[0].width"), undefined);
// Connect with width from the sidebar: refused when the shared wall is shorter than width + 0.1
w.eval("g.relationships=[];g.rooms.forEach(r=>r.connectors=[]);sel.clear();sel.add('a');sel.add('b');render()");
$('new-width').value = '3'; $('connect-rooms').click(); assert.match($('status').textContent, /too short/);
$('new-width').value = '1.5'; $('new-door').value = 'sliding'; $('connect-rooms').click();
assert.equal(w.eval("g.rooms[0].connectors[0].doorType"), 'sliding'); assert.equal(w.eval("g.rooms[1].connectors[0].width"), 1.5);
// Connector selection: clicking a connector shows its own panel; type / door edits apply to both ends; undo restores
w.eval("g.relationships=[{id:'ab',connectorA:'ar',connectorB:'bl',importance:'required'}];g.rooms[0].connectors=[{id:'ar',roomId:'a',side:'right',type:'door',offset:1.5}];g.rooms[1].connectors=[{id:'bl',roomId:'b',side:'left',type:'door',offset:1.5}];sel.clear();selPort=null;render()");
doc.querySelector('[data-port="ar"]').dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
$('canvas').dispatchEvent(new w.Event('pointerup', { bubbles: true }));
assert.ok(doc.querySelector('[data-ctype="ar"]'), 'connector panel opens when a connector is selected');
const ct = doc.querySelector('[data-ctype="ar"]'); ct.value = 'open-passage'; ev('change', ct);
assert.equal(w.eval("g.rooms[0].connectors[0].type + '/' + g.rooms[1].connectors[0].type"), 'open-passage/open-passage');
$('undo').click(); assert.equal(w.eval("g.rooms[1].connectors[0].type"), 'door');
// Width bars (tickbox): one bar per connector, sized by the joint width, hidden when unticked
assert.equal(doc.querySelectorAll('.bar').length, 0);
$('show-bars').checked = true; w.eval('render()'); assert.equal(doc.querySelectorAll('.bar').length, 2);
w.eval("g.rooms[0].connectors[0].width=2;render()"); const b0 = doc.querySelector('.bar'); assert.equal(Math.abs(b0.getAttribute('y2') - b0.getAttribute('y1')), 2);
// Ghost preview: wanted outline only when the result differs from the wanted position; affected rooms are tinted
w.eval("active={kind:'move',id:'a',g0:JSON.parse(JSON.stringify(g)),want:{dx:5,dy:0},before:'x'}");
assert.ok(w.eval('ghostLayer()').includes('class="ghost"'));
w.eval("active.want={dx:0,dy:0}"); assert.equal(w.eval('ghostLayer()'), '');
w.eval("rect(room('b')).width=5"); assert.ok(w.eval('ghostLayer()').includes('class="affected"'));
w.eval('active=null');
// Connectors stay inside the wall: the opening (width 2) keeps 1 m from each wall end while dragging
w.eval("g.rooms[0].connectors[0].width=2;g.rooms[0].layout.width=4.6;g.rooms[1].layout.x=4.6;render()");
assert.equal(w.eval("portTarget(port('ar'),{x:4.6,y:-5}).y"), 1); assert.equal(w.eval("portTarget(port('ar'),{x:4.6,y:9}).y"), 2);
// Fit to neighbours (selected room, 0.3 m): gap of 0.2 to B is closed by A's right wall
w.eval("g.rooms[1].layout.x=4.8;sel.clear();sel.add('a');render()");
$('fit-room').click(); assert.match($('status').textContent, /1 wall\(s\) fitted/); assert.equal(w.eval('g.rooms[0].layout.width'), 4.8);
$('undo').click(); assert.equal(w.eval('g.rooms[0].layout.width'), 4.6);
// Building defaults: edited in the sidebar, kept in the graph, clamped; undo restores
$('b-wh').value = '2.8'; ev('change', $('b-wh')); assert.equal(w.eval('g.buildingDefaults.wallHeight'), 2.8);
assert.equal(w.eval('JSON.stringify(bd())'), JSON.stringify({ wallThickness: 0.16, wallHeight: 2.8, floorThickness: 0.12 }));
$('b-wt').value = '9'; ev('change', $('b-wt')); assert.equal(w.eval('g.buildingDefaults.wallThickness'), 0.6);
// Door swing: only drawn while a hinged door connector is selected; hinge / swing / angle apply to the pair mirrored
w.eval("g.rooms[0].connectors[0].width=undefined;sel.clear();selPort=null;render()");
assert.equal(doc.querySelectorAll('.swing').length, 0);
doc.querySelector('[data-port="ar"]').dispatchEvent(new w.Event('pointerdown', { bubbles: true })); $('canvas').dispatchEvent(new w.Event('pointerup', { bubbles: true }));
assert.equal(doc.querySelectorAll('.swing').length, 1); assert.ok(doc.querySelector('.swinghandle'));
assert.match(doc.querySelector('[data-dswing="ar"]').textContent, /into a.*into b/); // swing options name the rooms
const hs = doc.querySelector('[data-dhinge="ar"]'); hs.value = 'right'; ev('change', hs);
assert.equal(w.eval("g.rooms[0].connectors[0].door.hinge + '/' + g.rooms[1].connectors[0].door.hinge + '/' + g.rooms[1].connectors[0].door.swing"), 'right/left/outward');
const an = doc.querySelector('[data-dangle="ar"]'); an.value = '70'; ev('change', an);
assert.equal(w.eval("g.rooms[0].connectors[0].door.openAngle + '/' + g.rooms[1].connectors[0].door.openAngle"), '70/70');
$('undo').click(); $('undo').click(); assert.equal(w.eval("g.rooms[0].connectors[0].door"), undefined);
w.eval("g.rooms[0].connectors[0].doorType='sliding';render()"); assert.equal(doc.querySelectorAll('.swing').length, 0);
w.eval("g.rooms[0].connectors[0].doorType='hinged'");
// Window heights: sill / head, head clamped to the wall height
w.eval("g.rooms[0].connectors.push({id:'aw',roomId:'a',side:'top',type:'window',offset:2});selPort='aw';render()");
const sill = doc.querySelector('[data-wsill="aw"]'); sill.value = '1'; ev('change', sill);
const head = doc.querySelector('[data-whead="aw"]'); head.value = '3.5'; ev('change', head);
assert.equal(w.eval("JSON.stringify(g.rooms[0].connectors[1].window)"), JSON.stringify({ type: 'fixed', sillHeight: 1, headHeight: 2.8, frameDepth: 0.08 }));
// Mode + inspector layout: tabs, segmented tool / move mode, auto-switch to Connectors on connector selection, classic toggle
doc.querySelector('[data-ui-tab="building"]').click(); assert.equal(doc.body.dataset.ui, 'building');
doc.querySelector('[data-ui-tab="layout"]').click(); w.eval("selPort=null;sel.clear();render()");
doc.querySelector('[data-seg="tool"][data-v="walls"]').click(); assert.equal($('tool').value, 'walls'); assert.equal(w.eval('tool'), 'walls'); assert.ok(doc.querySelector('[data-seg="tool"][data-v="walls"]').classList.contains('active'));
doc.querySelector('[data-seg="move-mode"][data-v="slide"]').click(); assert.equal(w.eval('moveMode'), 'slide');
doc.querySelector('[data-seg="tool"][data-v="rooms"]').click(); doc.querySelector('[data-seg="move-mode"][data-v="free"]').click();
doc.querySelector('[data-port="ar"]').dispatchEvent(new w.Event('pointerdown', { bubbles: true })); $('canvas').dispatchEvent(new w.Event('pointerup', { bubbles: true }));
assert.equal(doc.body.dataset.ui, 'connectors');
doc.querySelector('[data-ui-tab="layout"]').click(); w.eval('render()'); assert.equal(doc.body.dataset.ui, 'layout');
assert.match($('conn-summary').textContent, /New rooms connect with: door/);
$('classic').checked = true; ev('change', $('classic')); assert.ok(doc.body.classList.contains('classic'));
// UI revision (fresh page): background click, add-room panel, trash next to the name, auto-applied size, connector table
{
  const g2 = JSON.parse(JSON.stringify(g)); g2.rooms[1].layout.x = 4;
  const d2 = new JSDOM(editorHtml(g2), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  await new Promise(r => setTimeout(r, 50));
  const w2 = d2.window, doc2 = w2.document, $2 = id => doc2.getElementById(id), ev2 = (t, el) => el.dispatchEvent(new w2.Event(t, { bubbles: true }));
  $2('canvas').setPointerCapture = () => {};
  // connector table: one row per connector, tapping a row selects it and rings it on the map
  assert.equal(doc2.querySelectorAll('#conn-table tr[data-selconn]').length, 2);
  doc2.querySelector('tr[data-selconn="bl"]').dispatchEvent(new w2.Event('click', { bubbles: true }));
  assert.equal(w2.eval('selPort'), 'bl'); assert.equal(doc2.querySelectorAll('.selring').length, 1); assert.ok(doc2.querySelector('tr[data-selconn="bl"]').classList.contains('on'));
  // background click clears the connector and room selection
  w2.eval("sel.add('a')"); $2('canvas').dispatchEvent(new w2.Event('pointerdown', { bubbles: true }));
  assert.equal(w2.eval('selPort'), null); assert.equal(w2.eval('sel.size'), 0); assert.equal(doc2.querySelectorAll('.selring').length, 0);
  // room inspector: trash next to the name, W / H apply on change (no button), no connector list
  w2.eval("sel.add('a');render()"); assert.ok($2('delete-room')); assert.ok(!doc2.querySelector('#panel [data-cwidth]'));
  $2('width').value = '5'; ev2('change', $2('width')); assert.equal(w2.eval('g.rooms[0].layout.width'), 5);
  $2('height').value = '3.4'; ev2('change', $2('height')); assert.equal(w2.eval('g.rooms[0].layout.height'), 3.4);
  // add-room panel opens with +, closes after a successful add
  assert.equal($2('add-panel').hidden, true); $2('add-toggle').click(); assert.equal($2('add-panel').hidden, false);
  $2('new-name').value = 'Pantry'; $2('new-side').value = 'bottom'; $2('add-room').onclick(); assert.match($2('status').textContent, /^Added/); assert.equal($2('add-panel').hidden, true);
  assert.equal(w2.eval('g.rooms.length'), 3);
  // trash deletes the selected room
  w2.eval("sel.clear();sel.add('pantry');render()"); $2('delete-room').onclick(); assert.equal(w2.eval('g.rooms.length'), 2);
}
console.log('connector smoke ok');
