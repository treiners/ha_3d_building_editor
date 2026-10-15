// Optional smoke test for the entity mode (needs jsdom, run after `npm run build`, from the package folder).
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x, cs) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: cs, layout: { x, y: 0, width: 4, height: 3 } });
const graph = { schemaVersion: '2.14', rooms: [room('a', 0, [{ id: 'a-right-door', roomId: 'a', side: 'right', type: 'door', offset: 1.5 }]), room('b', 4, [{ id: 'b-left-door', roomId: 'b', side: 'left', type: 'door', offset: 1.5 }])], relationships: [{ id: 'ab', connectorA: 'a-right-door', connectorB: 'b-left-door', importance: 'required' }] };
const d = new JSDOM(editorHtml(graph), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id);
$('canvas').setPointerCapture = () => {};
w.eval('world=e=>({x:e.__x,y:e.__y})');
const ptr = (type, el, x, y, extra = {}) => { const e = new w.Event(type, { bubbles: true }); Object.assign(e, { pointerId: 1, __x: x, __y: y, altKey: false, shiftKey: false }, extra); el.dispatchEvent(e); };
const ents = () => JSON.parse(w.eval('JSON.stringify(g.entityPlacements||[])'));
const click = (sel) => doc.querySelector(sel).click();
const canvas = $('canvas');

// 1. mode switch + lock
click('[data-app-btn=entities]');
assert.equal(doc.body.dataset.app, 'entities'); assert.match($('status').textContent, /locked/);
const before = w.eval('JSON.stringify(g.rooms.map(r=>r.layout))');
ptr('pointerdown', doc.querySelector('[data-room=a] rect'), 1, 1); ptr('pointermove', canvas, 3, 2); ptr('pointerup', canvas, 3, 2);
assert.equal(w.eval('JSON.stringify(g.rooms.map(r=>r.layout))'), before, 'rooms must not move in entity mode');
assert.equal(w.eval('active'), null);
// 2. place a light with the grid (0.1): click (1.23, 1.07) -> [1.2, 1.1]; one undo step
click('[data-ptype=light]'); ptr('pointerdown', canvas, 1.23, 1.07); ptr('pointerup', canvas, 1.23, 1.07);
assert.deepEqual(ents()[0].position, [1.2, 1.1]); assert.equal(w.eval('selE'), 'a-light'); assert.ok($('ent-inspector').querySelector('[data-ef=height]'));
$('undo').click(); assert.equal(ents().length, 0); $('redo').click(); assert.equal(ents().length, 1);
// 3. motion sensor + facing handle: drag to the right of the sensor -> 90 degrees, one undo step
click('[data-ptype=motion-sensor]'); ptr('pointerdown', canvas, 2, 1); ptr('pointerup', canvas, 2, 1);
const m = ents()[1]; assert.equal(m.type, 'motion-sensor'); assert.deepEqual([m.facingDegrees, m.fieldOfViewDegrees, m.range], [0, 100, 3.5]);
assert.ok(doc.querySelector('.ent-cone.sel'), 'cone of the selected sensor');
const h = doc.querySelector('[data-ehandle=facing]'); ptr('pointerdown', h, 2, 0.4); ptr('pointermove', canvas, 3, 1); ptr('pointerup', canvas, 3, 1);
assert.equal(ents()[1].facingDegrees, 90); $('undo').click(); assert.equal(ents()[1].facingDegrees, 0);
// range handle: drag to 2.04 m -> 2
ptr('pointerdown', doc.querySelector('[data-ehandle=range]'), 2, -2.5); ptr('pointermove', canvas, 2, -1.04); ptr('pointerup', canvas, 2, -1.04);
assert.equal(ents()[1].range, 2);
// 4. door contact on the door at (4, 1.5); a second one on the same door is refused
click('[data-ptype=door-contact]'); assert.ok(doc.querySelector('.ent-target'), 'door targets shown');
ptr('pointerdown', canvas, 4.1, 1.4); ptr('pointerup', canvas, 4.1, 1.4);
assert.deepEqual(ents().at(-1), { id: 'a-right-door-door-contact', type: 'door-contact', connectorId: 'a-right-door' });
click('[data-ptype=door-contact]'); ptr('pointerdown', canvas, 4.1, 1.4); assert.match($('status').textContent, /already has/); assert.equal(ents().length, 3);
ptr('pointerdown', canvas, 20, 20); doc.dispatchEvent(Object.assign(new w.Event('keydown', { bubbles: true }), { key: 'Escape' }));
// 5. drag the light into room b (re-parent), undo restores
ptr('pointerdown', doc.querySelector('[data-ent=a-light]'), 1.2, 1.1); ptr('pointermove', canvas, 5.5, 1); ptr('pointerup', canvas, 5.5, 1);
assert.equal(ents()[0].roomId, 'b'); assert.deepEqual(ents()[0].position, [1.5, 1]); $('undo').click(); assert.equal(ents()[0].roomId, 'a');
// 6. inspector: height + name; arrow key nudge; delete
w.eval("selE='a-light';render()");
const hi = $('ent-inspector').querySelector('[data-ef=height]'); hi.value = '1.5'; hi.dispatchEvent(new w.Event('change', { bubbles: true })); assert.equal(ents()[0].height, 1.5);
doc.dispatchEvent(Object.assign(new w.Event('keydown', { bubbles: true }), { key: 'ArrowRight' })); assert.deepEqual(ents()[0].position, [1.3, 1.1]);
click('#ent-del'); assert.equal(ents().some(e => e.id === 'a-light'), false);
// 6b. List tab: rows, type filter, click selects and rings, diagnostics clean
click('[data-etab=list]'); assert.equal(doc.querySelector('.entside').dataset.tab, 'list');
assert.equal(doc.querySelectorAll('#ent-list [data-erow]').length, 2);
$('ent-f-type').value = 'motion-sensor'; $('ent-f-type').dispatchEvent(new w.Event('change', { bubbles: true }));
assert.equal(doc.querySelectorAll('#ent-list [data-erow]').length, 1);
doc.querySelector('#ent-list [data-erow]').click(); assert.equal(w.eval('selE'), 'a-motion-sensor'); assert.ok(doc.querySelector('.ent-ring'));
assert.match($('ent-diag-sum').textContent, /Diagnostics \(0\)/);
// 6c. resizing a room (real corner drag in floor-plan mode) keeps entities at the same relative place; one undo step restores everything
click('[data-app-btn=plan]');
w.eval("g=addEntity({graph:g,type:'light',roomId:'a',position:[4,3]}).graph;sel.clear();sel.add('a');render()");
const pos = t => ents().find(e => e.type === t).position, near = (a, b) => Math.abs(a - b) < 1e-6, m0 = pos('motion-sensor');
ptr('pointerdown', doc.querySelector('[data-resize=a][data-corner=br]'), 4, 3); ptr('pointermove', canvas, 2, 1.4); ptr('pointerup', canvas, 2, 1.4);
assert.equal(w.eval('g.rooms[0].layout.width'), 2); assert.equal(w.eval('g.rooms[0].layout.height'), 1.4);
assert.ok(near(pos('light')[0], 2) && near(pos('light')[1], 1.4), 'light follows the new room size: ' + pos('light'));
assert.ok(near(pos('motion-sensor')[0], m0[0] * 0.5) && near(pos('motion-sensor')[1], m0[1] * 1.4 / 3), 'sensor scales too');
$('undo').click(); assert.equal(w.eval('g.rooms[0].layout.width'), 4); assert.deepEqual(pos('light'), [4, 3]); assert.deepEqual(pos('motion-sensor'), m0);
// 6d. new types: window contact on the window connector is not available here (no window in this scene) -> refused message; sensors place in rooms; measures sub-selection; resize setting with undo
click('[data-app-btn=entities]');
for (const t of ['environment-sensor', 'smoke-detector', 'water-leak']) { click('[data-ptype=' + t + ']'); ptr('pointerdown', canvas, 3, 2); ptr('pointerup', canvas, 3, 2); assert.equal(ents().at(-1).type, t); }
assert.equal(ents().at(-1).height, 0.1);
click('[data-ptype=window-contact]'); ptr('pointerdown', canvas, 3, 2); assert.match($('status').textContent, /Click a highlighted window/); doc.dispatchEvent(Object.assign(new w.Event('keydown', { bubbles: true }), { key: 'Escape' }));
w.eval("selE=g.entityPlacements.find(e=>e.type==='environment-sensor').id;render()");
const co2 = doc.querySelector('[data-em=measures][data-opt=co2]'); co2.checked = true; co2.dispatchEvent(new w.Event('change', { bubbles: true }));
assert.deepEqual(ents().find(e => e.type === 'environment-sensor').measures, ['temperature', 'humidity', 'co2']);
$('ent-resize').value = 'anchor'; $('ent-resize').dispatchEvent(new w.Event('change', { bubbles: true }));
assert.equal(w.eval('g.entitySettings.resize'), 'anchor'); assert.ok(doc.querySelector('#ent-inspector [data-ef=anchorCorner]'), 'anchor corner field in anchor mode');
$('undo').click(); assert.notEqual(w.eval('(g.entitySettings||{}).resize'), 'anchor'); $('redo').click(); assert.equal(w.eval('g.entitySettings.resize'), 'anchor');
// 6e. camera (directional: cone + handles), lock and blind / cover on the door, thermostat
click('[data-ptype=camera]'); ptr('pointerdown', canvas, 3, 2.5);
const cam = ents().at(-1); assert.deepEqual([cam.type, cam.height, cam.fieldOfViewDegrees, cam.range], ['camera', 2.3, 90, 8]);
assert.ok(doc.querySelector('.ent-cone.sel') && doc.querySelector('[data-ehandle=facing]'), 'camera shows cone and handles');
click('[data-ptype=lock]'); ptr('pointerdown', canvas, 4.1, 1.4); assert.equal(ents().at(-1).id, 'a-right-door-lock');
click('[data-ptype=cover]'); ptr('pointerdown', canvas, 4.1, 1.4); assert.equal(ents().at(-1).id, 'a-right-door-cover');
click('[data-ptype=cover]'); ptr('pointerdown', canvas, 4.1, 1.4); assert.match($('status').textContent, /already has a blind/); doc.dispatchEvent(Object.assign(new w.Event('keydown', { bubbles: true }), { key: 'Escape' }));
click('[data-ptype=thermostat]'); ptr('pointerdown', canvas, 3, 1); assert.equal(ents().at(-1).height, 1.5);
// 7. save writes defaults; floor-plan mode again
const saved = JSON.parse(w.eval('JSON.stringify(fillEntityDefaults(fillDefaults(g)))')); assert.deepEqual(saved.entitySettings, { coordinates: 'room', gridStep: 0.1, resize: 'anchor' });
click('[data-app-btn=plan]'); assert.equal(doc.body.dataset.app, 'plan'); assert.equal(doc.querySelector('.entlayer'), null);
console.log('entity smoke OK');
