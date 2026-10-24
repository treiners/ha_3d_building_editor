// Optional smoke test for the Objects mode (needs jsdom, run after `npm run build`, from the package folder).
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: [], layout: { x, y: 0, width: 4, height: 3 } });
const graph = { schemaVersion: '2.14', rooms: [room('a', 0), room('b', 4)], relationships: [] };
const d = new JSDOM(editorHtml(graph), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id), canvas = $('canvas');
canvas.setPointerCapture = () => {};
w.eval('world=e=>({x:e.__x,y:e.__y})');
const ptr = (type, el, x, y, extra = {}) => { const e = new w.Event(type, { bubbles: true }); Object.assign(e, { pointerId: 1, __x: x, __y: y, altKey: false, shiftKey: false }, extra); el.dispatchEvent(e); };
const G = () => JSON.parse(w.eval('JSON.stringify(g)')), objs = () => G().objects || [], click = s => doc.querySelector(s).click();
const key = (k, extra = {}) => doc.dispatchEvent(Object.assign(new w.Event('keydown', { bubbles: true }), { key: k, ...extra }));
const near = (a, b) => Math.abs(a - b) < 1e-6;
const change = (sel, fn) => { const el = doc.querySelector(sel); fn(el); el.dispatchEvent(new w.Event('change', { bubbles: true })); };

// 1. Objects mode: the floor plan is read-only
click('[data-app-btn=objects]'); assert.equal(doc.body.dataset.app, 'objects'); assert.match($('status').textContent, /Objects/);
const rooms0 = w.eval('JSON.stringify(g.rooms.map(r=>r.layout))');
ptr('pointerdown', doc.querySelector('[data-room=a] rect'), 1, 1); ptr('pointermove', canvas, 3, 2); ptr('pointerup', canvas, 3, 2);
assert.equal(w.eval('JSON.stringify(g.rooms.map(r=>r.layout))'), rooms0); assert.equal(w.eval('active'), null);

// 2. place a refrigerator at (2,1.5) in room a: id a-refrigerator, position [2,1.5], one undo step, one-shot palette
click('[data-otype=refrigerator]'); assert.equal(doc.body.dataset.oplacing, 'refrigerator'); assert.match($('obj-hint').textContent, /place the refrigerator/);
ptr('pointerdown', canvas, 2, 1.5); ptr('pointerup', canvas, 2, 1.5);
assert.equal(objs().length, 1); assert.deepEqual([objs()[0].id, objs()[0].roomId, objs()[0].position], ['a-refrigerator', 'a', [2, 1.5]]); assert.equal(doc.body.dataset.oplacing, '');
assert.equal($('obj-inspector').hidden, false, 'floating inspector shown');
$('undo').click(); assert.equal(objs().length, 0); $('redo').click(); assert.equal(objs().length, 1);

// 3. drag to x 0.4: the left edge (0.4 - 0.3 = 0.1) snaps to the wall, centre 0.3; Alt = free (0.4); undo restores [2,1.5]
const body = () => doc.querySelector('[data-obj="a-refrigerator"] polygon');
ptr('pointerdown', body(), 2, 1.5); ptr('pointermove', canvas, 0.4, 1.5); ptr('pointerup', canvas, 0.4, 1.5);
assert.ok(near(objs()[0].position[0], 0.3), 'snapped to the wall: ' + objs()[0].position);
$('undo').click(); assert.deepEqual(objs()[0].position, [2, 1.5]);
ptr('pointerdown', body(), 2, 1.5); ptr('pointermove', canvas, 0.4, 1.5, { altKey: true }); ptr('pointerup', canvas, 0.4, 1.5);
assert.ok(near(objs()[0].position[0], 0.4), 'Alt = free: ' + objs()[0].position);
ptr('pointerdown', body(), 0.4, 1.5); ptr('pointermove', canvas, 0.45, 1.5); ptr('pointermove', canvas, 0.4, 1.5); ptr('pointerup', canvas, 0.4, 1.5);
assert.ok(near(objs()[0].position[0], 0.3), 'snapped again');

// 4. R rotates by 90, Shift+R back; edge handle resizes (right edge from 0.6 to 1.1 m: width 1.1, centre 0.55)
key('r'); assert.equal(objs()[0].facingDegrees, 90); key('r', { shiftKey: true }); assert.equal(objs()[0].facingDegrees, 0);
const c0 = objs()[0].position[0]; // rotating clamps the object into the room, so the centre is not necessarily 0.3 any more
ptr('pointerdown', doc.querySelector('[data-ohandle=rs-r]'), c0 + 0.3, 1.5); ptr('pointermove', canvas, c0 + 0.8, 1.5); ptr('pointerup', canvas, c0 + 0.8, 1.5);
assert.ok(near(objs()[0].width, 1.1) && near(objs()[0].position[0], c0 - 0.3 + 0.55), 'resized, left edge stays: ' + objs()[0].width + ' ' + objs()[0].position);
$('undo').click(); assert.equal(objs()[0].width, undefined);

// 5. inspector name; copy / paste at the pointer (3,1.5); Delete removes the pasted one
change('[data-of=name]', el => { el.value = 'Fridge'; }); assert.equal(objs()[0].name, 'Fridge');
key('c', { ctrlKey: true }); ptr('pointermove', canvas, 3, 1.5); key('v', { ctrlKey: true });
assert.equal(objs().length, 2); assert.deepEqual([objs()[1].id, objs()[1].name, objs()[1].position], ['a-refrigerator-2', 'Fridge', [3, 1.5]]);
key('Delete'); assert.equal(objs().length, 1);

// 6. list tab shows the object; a row selects it; clearance zone is drawn on request
click('[data-otab=list]'); assert.match($('obj-list').textContent, /Fridge/);
w.eval('objUi.sel=null;render()'); click('[data-orow=a-refrigerator]'); assert.equal(w.eval('objUi.sel'), 'a-refrigerator');
$('obj-clr').checked = true; $('obj-clr').dispatchEvent(new w.Event('change', { bubbles: true })); assert.ok(doc.querySelector('.obj-clr'), 'clearance zone');

// 7. types tab: new type, edit, appears in the palette, delete; built-in override and reset
click('[data-otab=types]'); click('#obj-t-new'); assert.equal(G().objectTypes.length, 1); assert.equal(G().objectTypes[0].id, 'new-type');
change('[data-tf=width]', el => { el.value = '0.8'; }); assert.equal(G().objectTypes[0].width, 0.8); assert.ok(doc.querySelector('[data-otype=new-type]'), 'new type in the palette');
click('#obj-t-del'); assert.equal(G().objectTypes, undefined);
click('[data-otrow=refrigerator]'); change('[data-tf=width]', el => { el.value = '0.7'; });
assert.deepEqual(G().objectTypes.map(t => [t.id, t.width, t.depth]), [['refrigerator', 0.7, 0.65]]);
click('#obj-t-del'); assert.equal(G().objectTypes, undefined);

// 7b. entity on an object: suggestion button in the inspector, drawn in Entities mode with the object as parent, follows the object
assert.equal(w.eval('objUi.sel'), 'a-refrigerator'); click('[data-oent-add=door-contact]');
assert.deepEqual([G().entityPlacements[0].id, G().entityPlacements[0].objectId, G().entityPlacements[0].position], ['a-refrigerator-door-contact', 'a-refrigerator', [0, 0]]);
click('[data-app-btn=entities]'); assert.ok(doc.querySelector('[data-ent="a-refrigerator-door-contact"]'), 'entity drawn on the object');
w.eval('entSetSel(["a-refrigerator-door-contact"]);render()'); assert.match($('ent-inspector').textContent, /\(object\)/);
click('[data-app-btn=objects]'); w.eval('objUi.sel="a-refrigerator";render()'); click('[data-oent-del=a-refrigerator-door-contact]'); assert.equal(G().entityPlacements.length, 0);

// 8. objects stay drawn in plan mode
click('[data-app-btn=plan]'); assert.ok(doc.querySelector('.objlayer'), 'object layer in plan mode');
console.log('objects smoke OK');
