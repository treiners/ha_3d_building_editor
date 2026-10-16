// Optional smoke test for "Add opening" (needs jsdom, run after `npm run build`, from the package folder).
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x, cs) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: cs, layout: { x, y: 0, width: 4, height: 3 } });
const graph = { schemaVersion: '2.14', rooms: [room('a', 0, [{ id: 'a-right-door', roomId: 'a', side: 'right', type: 'door', offset: 1.5 }]), room('b', 4, [{ id: 'b-left-door', roomId: 'b', side: 'left', type: 'door', offset: 1.5 }])], relationships: [{ id: 'ab', connectorA: 'a-right-door', connectorB: 'b-left-door', importance: 'required' }] };
const d = new JSDOM(editorHtml(graph), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id), canvas = $('canvas');
canvas.setPointerCapture = () => {};
w.eval('world=e=>({x:e.__x,y:e.__y})');
const ptr = (type, el, x, y, extra = {}) => { const e = new w.Event(type, { bubbles: true }); Object.assign(e, { pointerId: 1, __x: x, __y: y, altKey: false, shiftKey: false }, extra); el.dispatchEvent(e); };
const G = () => JSON.parse(w.eval('JSON.stringify(g)')), conns = id => G().rooms.find(r => r.id === id).connectors;
const click = sel => doc.querySelector(sel).click(), esc = () => doc.dispatchEvent(Object.assign(new w.Event('keydown', { bubbles: true }), { key: 'Escape' }));

// nothing armed: the old behaviour is unchanged (clicking a room selects it)
ptr('pointerdown', doc.querySelector('[data-room=a] rect'), 1, 1); ptr('pointerup', canvas, 1, 1); assert.equal(w.eval('sel.size'), 1); assert.equal(w.eval('active'), null);

// 1. second door between a and b: arm, ghost follows, click places a connected pair, one undo step
click('[data-addop=door]'); assert.equal(doc.body.dataset.addop, 'door'); assert.match($('addop-hint').textContent, /Click on a wall/);
ptr('pointermove', canvas, 4, 2.6); assert.ok(doc.querySelector('.addop-ghost'), 'ghost bar');
ptr('pointerdown', canvas, 4, 2.6);
assert.equal(G().relationships.length, 2); assert.deepEqual(conns('a').map(c => [c.id, c.offset]), [['a-right-door', 1.5], ['a-right-door-2', 2.55]]); assert.deepEqual(conns('b').map(c => c.id), ['b-left-door', 'b-left-door-2']);
assert.equal(w.eval('addOp'), null, 'one-shot'); assert.equal(w.eval('selPort'), 'a-right-door-2'); assert.equal(doc.body.dataset.ui, 'connectors'); assert.match($('status').textContent, /connecting to b/);
$('undo').click(); assert.equal(G().relationships.length, 1); assert.equal(conns('a').length, 1); $('redo').click(); assert.equal(G().relationships.length, 2);

// 2. exterior window on a's left wall: unpaired (orange point), selected card shows it as not connected
click('[data-addop=window]'); ptr('pointerdown', canvas, 0.05, 1.2);
assert.deepEqual(conns('a').find(c => c.type === 'window'), { id: 'a-left-window', roomId: 'a', side: 'left', type: 'window', position: 0.4, offset: 1.2 }); assert.equal(G().relationships.length, 2);
assert.ok(doc.querySelector('[data-port=a-left-window].orange')); assert.match($('panel').textContent, /not connected/);

// 3. Shift keeps the type armed (exterior door on the top wall), Escape disarms
click('[data-addop=door]'); ptr('pointerdown', canvas, 2, 0.1, { shiftKey: true }); assert.ok(conns('a').some(c => c.id === 'a-top-door')); assert.equal(w.eval('addOp'), 'door');
esc(); assert.equal(w.eval('addOp'), null); assert.equal(doc.body.dataset.addop, '');

// 4. refusals: too close to the first door, nowhere near a wall; nothing changes
const before = w.eval('JSON.stringify(g)');
click('[data-addop=door]'); ptr('pointerdown', canvas, 4, 1.6); assert.match($('status').textContent, /Too close/); ptr('pointerdown', canvas, 30, 30); assert.match($('status').textContent, /Click on a wall/);
assert.equal(w.eval('JSON.stringify(g)'), before); esc();

// 5. not in the Gap view
click('#gap'); click('[data-addop=door]'); ptr('pointerdown', canvas, 2, 0.1); assert.match($('status').textContent, /Gap view/); assert.equal(w.eval('JSON.stringify(g)'), before); esc(); click('#mapping');

// 6. Add a passage with a width from the settings (1.5 m) on b's bottom wall; saved file keeps it
$('new-width').value = '1.5'; click('[data-addop=open-passage]'); ptr('pointerdown', canvas, 6, 3, {});
const p = conns('b').find(c => c.type === 'open-passage'); assert.deepEqual([p.id, p.side, p.width], ['b-bottom-open-passage', 'bottom', 1.5]);
const saved = JSON.parse(w.eval('JSON.stringify(fillDefaults(g))')); assert.ok(saved.rooms[1].connectors.some(c => c.id === 'b-bottom-open-passage'));
console.log('openings smoke OK');
