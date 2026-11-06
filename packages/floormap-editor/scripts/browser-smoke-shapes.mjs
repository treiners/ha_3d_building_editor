// Optional smoke test for rooms with a shape (needs jsdom, run after `npm run build`, from the package folder).
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x, extra = {}) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: [], layout: { x, y: 0, width: 2, height: 2 }, ...extra });
// room a: an L given counter-clockwise with a collinear corner (loaded in canonical form); room b: a plain rectangle
const graph = { schemaVersion: '3.0', id: 'g', name: 'g', relationships: [], wallAlignments: [], rooms: [room('a', 0, { outline: [[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [1, 0], [0, 0]] }), room('b', 4)] };
const d = new JSDOM(editorHtml(graph), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id), canvas = $('canvas');
canvas.setPointerCapture = () => {};
w.eval('world=e=>({x:e.__x,y:e.__y})');
const ptr = (type, el, x, y) => { const e = new w.Event(type, { bubbles: true }); Object.assign(e, { pointerId: 1, __x: x, __y: y, altKey: false, shiftKey: false }); el.dispatchEvent(e); };

// 1. the L is a path with the canonical corners, the rectangle is still a rect; the label of the L sits in the middle of its bar (1, 0.5)
const a = doc.querySelector('[data-room=a]'), b = doc.querySelector('[data-room=b]');
assert.equal(a.querySelector('path.room').getAttribute('d'), 'M0 0 L2 0 L2 1 L1 1 L1 2 L0 2 Z');
assert.ok(b.querySelector('rect.room') && !b.querySelector('path'), 'rectangle unchanged');
const label = a.querySelector('text.label'); assert.deepEqual([label.getAttribute('x'), label.getAttribute('y')], ['1', '0.5']);

// 2. a room with its own shape keeps its size: no resize handles, Lock size ticked and disabled, width / height disabled
ptr('pointerdown', a.querySelector('path.room'), 0.5, 0.5); ptr('pointerup', canvas, 0.5, 0.5);
assert.ok(doc.querySelector('[data-room=a] path.room.selected'), 'selected');
assert.equal(doc.querySelectorAll('[data-resize]').length, 0, 'no resize handles');
assert.deepEqual([$('lock-size').checked, $('lock-size').disabled, $('width').disabled, $('height').disabled], [true, true, true, true]);

// 3. moving the room moves the shape with it (the outline is relative to the room)
ptr('pointerdown', doc.querySelector('[data-room=a] path.room'), 0.5, 0.5); ptr('pointermove', canvas, 1.5, 0.5); ptr('pointerup', canvas, 1.5, 0.5);
assert.deepEqual(JSON.parse(w.eval('JSON.stringify(g.rooms[0].layout)')).x, 1);
assert.equal(doc.querySelector('[data-room=a] path.room').getAttribute('d'), 'M1 0 L3 0 L3 1 L2 1 L2 2 L1 2 Z');
$('undo').click(); assert.equal(JSON.parse(w.eval('JSON.stringify(g.rooms[0].layout)')).x, 0);

// 4. the saved graph keeps the outline (canonical) and the lock
const saved = JSON.parse(w.eval('JSON.stringify(savedGraph(g))'));
assert.deepEqual(saved.rooms[0].outline, [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]]); assert.equal(saved.rooms[1].outline, undefined);
// 5. Objects mode (phase 3): the notch of the L (x 1..2, y 1..2) is not a place for objects; the leg is; dragging into the notch stays valid
doc.querySelector('[data-app-btn=objects]').click();
doc.querySelector('[data-otype=chair]').click();
ptr('pointerdown', canvas, 1.5, 1.5); ptr('pointerup', canvas, 1.5, 1.5);
assert.equal(JSON.parse(w.eval('JSON.stringify(g.objects||[])')).length, 0, 'nothing placed in the notch'); assert.match($('status').textContent, /inside a room/);
ptr('pointerdown', canvas, 0.5, 1.5); ptr('pointerup', canvas, 0.5, 1.5);
assert.equal(JSON.parse(w.eval('JSON.stringify(g.objects||[])')).length, 1, 'placed in the leg');
ptr('pointerdown', doc.querySelector('[data-obj] polygon'), 0.5, 1.5); ptr('pointermove', canvas, 1.5, 1.5); ptr('pointerup', canvas, 1.5, 1.5);
assert.equal(w.eval('validateObjects(g).length'), 0, 'the chair was pushed out of the notch, not left in it');
// 6. phase 4: a neighbour in the notch is connected to the inner walls (ports sit on the inner walls and are green)
const door = (id, roomId, side, offset) => ({ id, roomId, side, type: 'door', offset, width: 0.9 });
const graph2 = { schemaVersion: '3.0', id: 'g2', name: 'g2', wallAlignments: [], rooms: [
  { id: 'a', name: 'a', type: 'other', sizeCategory: 'large', layout: { x: 0, y: 0, width: 6, height: 5 }, outline: [[0, 0], [6, 0], [6, 3], [3, 3], [3, 5], [0, 5]], connectors: [door('a-right', 'a', 'right', 4), door('a-bottom', 'a', 'bottom', 4.5)] },
  { id: 'b', name: 'b', type: 'other', sizeCategory: 'small', layout: { x: 3, y: 3, width: 3, height: 2 }, connectors: [door('b-left', 'b', 'left', 1), door('b-top', 'b', 'top', 1.5)] },
], relationships: [{ id: 'r1', connectorA: 'a-right', connectorB: 'b-left', importance: 'required' }, { id: 'r2', connectorA: 'a-bottom', connectorB: 'b-top', importance: 'required' }] };
const d2 = new JSDOM(editorHtml(graph2), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w2 = d2.window;
assert.equal(w2.eval('JSON.stringify(["a-right","a-bottom","b-left","b-top"].map(id=>pt(port(id))))'), '[{"x":3,"y":4},{"x":4.5,"y":3},{"x":3,"y":4},{"x":4.5,"y":3}]', 'connector points lie on the inner walls');
assert.equal(w2.eval('JSON.stringify(deriveJoints(g).joints.map(j=>j.status))'), '["ok","ok"]');
assert.equal(w2.eval('JSON.stringify(g.relationships.map(l=>aligned(l)))'), '[true,true]');
// 7. phase 5: Shape tool - Shift + drag pulls a bump out of a wall (the room becomes a shape, its box grows), dragging a wall segment moves it, undo restores the rectangle
const graph3 = { schemaVersion: '3.0', id: 'g3', name: 'g3', wallAlignments: [], relationships: [], rooms: [{ id: 'a', name: 'a', type: 'other', sizeCategory: 'medium', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [] }] };
const d3 = new JSDOM(editorHtml(graph3), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w3 = d3.window, doc3 = w3.document, c3 = doc3.getElementById('canvas');
c3.setPointerCapture = () => {}; w3.eval('world=e=>({x:e.__x,y:e.__y})');
const p3 = (type, el, x, y, extra = {}) => { const e = new w3.Event(type, { bubbles: true }); Object.assign(e, { pointerId: 1, __x: x, __y: y, altKey: false, shiftKey: false }, extra); el.dispatchEvent(e); };
const tool3 = doc3.getElementById('tool'); tool3.value = 'shape'; tool3.dispatchEvent(new w3.Event('change'));
assert.equal(doc3.querySelectorAll('[data-shape]').length, 4, 'one grab strip per wall of the rectangle'); assert.equal(doc3.getElementById('shape-opt').hidden, false);
p3('pointermove', doc3.querySelector('[data-shape="a:0"]'), 2, 0, { shiftKey: true }); assert.ok(doc3.getElementById('shape-hint'), 'Shift over a wall shows the part that would be pulled (red)');
p3('pointerdown', doc3.querySelector('[data-shape="a:0"]'), 2, 0, { shiftKey: true }); p3('pointermove', c3, 2, -1);
assert.ok(/ m<\/text>/.test(doc3.getElementById('canvas').innerHTML), 'dimensions of the changing walls are shown while dragging'); p3('pointerup', c3, 2, -1);
assert.equal(w3.eval('JSON.stringify(g.rooms[0].layout)'), '{"x":0,"y":-1,"width":4,"height":4,"sizeLocked":true}');
assert.equal(w3.eval('JSON.stringify(g.rooms[0].outline)'), '[[1.5,0],[2.5,0],[2.5,1],[4,1],[4,4],[0,4],[0,1],[1.5,1]]');
assert.equal(doc3.querySelectorAll('[data-shape]').length, 8, 'one strip per wall segment of the new shape');
p3('pointerdown', doc3.querySelector('[data-shape="a:3"]'), 4, 2); p3('pointermove', c3, 5, 2); p3('pointerup', c3, 5, 2);
assert.equal(w3.eval('JSON.stringify(g.rooms[0].outline)'), '[[1.5,0],[2.5,0],[2.5,1],[5,1],[5,4],[0,4],[0,1],[1.5,1]]');
assert.equal(w3.eval('g.rooms[0].layout.width'), 5);
doc3.getElementById('undo').click(); doc3.getElementById('undo').click();
assert.equal(w3.eval('JSON.stringify(g.rooms[0].layout)'), '{"x":0,"y":0,"width":4,"height":3}'); assert.equal(w3.eval('g.rooms[0].outline'), undefined);

console.log('shapes smoke OK');
