// Optional smoke test for the New floor plan button, the north compass and the origin shift on save (needs jsdom, run after `npm run build`, from the package folder).
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: [], layout: { x, y: 0, width: 4, height: 3 } });
const graph = { schemaVersion: '2.14', rooms: [room('a', 0), room('b', 4)], relationships: [] };
const d = new JSDOM(editorHtml(graph), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id), north = $('north');
const G = () => JSON.parse(w.eval('JSON.stringify(g)'));
const ptr = (type, x, y, extra = {}) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { pointerId: 1, clientX: x, clientY: y, shiftKey: false }, extra); north.dispatchEvent(e); };

// 1. compass: drawn at 0, click right of the centre (jsdom rect is 0,0) -> 90 degrees, one undo step; Shift = 1 degree steps
assert.ok(north && $('newplan'), 'compass and New button exist'); assert.equal(north.getAttribute('data-north'), '0');
ptr('pointerdown', 10, 0); ptr('pointerup', 10, 0);
assert.equal(G().northDegrees, 90); assert.equal(north.getAttribute('data-north'), '90'); assert.equal($('undo').disabled, false);
ptr('pointerdown', 10, 1, { shiftKey: true }); ptr('pointermove', 10, -1, { shiftKey: true }); ptr('pointerup', 10, -1, { shiftKey: true });
assert.equal(G().northDegrees, 84, 'atan2(10, 1) = 84.3 degrees -> 84 with Shift');
$('undo').click(); assert.equal(G().northDegrees, 90); assert.equal(north.getAttribute('data-north'), '90', 'compass follows undo');
north.dispatchEvent(new w.Event('dblclick', { bubbles: true })); assert.equal(G().northDegrees, undefined); assert.equal(north.getAttribute('data-north'), '0');
ptr('pointerdown', 0, -10); ptr('pointerup', 0, -10); assert.equal(G().northDegrees, undefined, 'straight up = default, key removed');

// 2. save writes a plan whose top-left corner is (0,0); the editor itself is unchanged
w.eval('g.rooms.forEach(r=>{r.layout.x+=5;r.layout.y+=2})');
let blob = null; w.URL.createObjectURL = b => { blob = b; return 'blob:x'; }; w.HTMLAnchorElement.prototype.click = function () {};
$('save').click(); assert.ok(blob, 'save produced a blob');
const saved = JSON.parse(await new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(blob); }));
assert.deepEqual(saved.rooms.map(r => [r.layout.x, r.layout.y]), [[0, 0], [4, 0]]);
assert.deepEqual(G().rooms.map(r => [r.layout.x, r.layout.y]), [[5, 2], [9, 2]], 'editor keeps its own coordinates');

// 3. New floor plan: asks first, then one placeholder room, empty history, north reset
w.confirm = () => false; $('newplan').click(); assert.equal(G().rooms.length, 2, 'cancelled');
w.confirm = () => true; $('newplan').click();
assert.deepEqual(G().rooms.map(r => r.name), ['Room 1']); assert.equal(G().relationships.length, 0); assert.equal($('undo').disabled, true); assert.equal(north.getAttribute('data-north'), '0');
console.log('browser-smoke-plan: OK');
