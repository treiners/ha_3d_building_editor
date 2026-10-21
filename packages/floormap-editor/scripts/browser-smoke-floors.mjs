// Optional smoke test for floor mode (tabs, ghost, Match below, save, delete). Needs jsdom; run after `npm run build`, from the package folder.
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: [], layout: { x, y: 0, width: 4, height: 3 } });
const graph = { schemaVersion: '2.14', rooms: [room('a', 0), room('b', 4)], relationships: [] };
const d = new JSDOM(editorHtml(graph), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id), q = s => doc.querySelector(s), G = () => JSON.parse(w.eval('JSON.stringify(g)'));
const ids = a => a.map(r => r.id);

// 1. single floor: one disabled tab, no ghost; "+" adds an empty floor above and makes it current, floor 1 is drawn as a ghost
assert.ok($('floors') && q('#floors button.on').disabled, 'bar with one tab'); assert.equal(doc.querySelectorAll('.floorghost rect').length, 0);
q('#floors [data-fa=new]').click();
assert.deepEqual(G().floors.map(f => f.name), ['Floor 1', 'Floor 2']); assert.deepEqual(ids(G().rooms), ['room-1-floor-2']);
assert.equal(doc.querySelectorAll('.floorghost rect').length, 2, 'ghost of a and b'); assert.ok(q('#floors [data-fa=match]'));
assert.equal($('undo').disabled, false);

// 2. Match below: the right wall of the placeholder (x = 4.2) snaps to the ghost wall at x = 4 (0.2 m away)
w.eval('g.rooms[0].layout.width=4.2');
q('#floors [data-fa=match]').click();
assert.equal(G().rooms[0].layout.width, 4, 'right wall snapped to the ghost');

// 3. save writes all floors with unique ids and floor fields, no working keys
let blob = null; w.URL.createObjectURL = b => { blob = b; return 'blob:x'; }; w.HTMLAnchorElement.prototype.click = function () {};
$('save').click();
const saved = JSON.parse(await new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(blob); }));
assert.deepEqual(saved.floors.map(f => f.id), ['floor-1', 'floor-2']); assert.deepEqual(saved.rooms.map(r => [r.id, r.floor]), [['a', 'floor-1'], ['b', 'floor-1'], ['room-1-floor-2', 'floor-2']]); assert.equal(saved._fl, undefined);

// 4. switch back by tab, rename by prompt, undo of the add, then delete
q('#floors [data-fl=floor-1]').click(); assert.deepEqual(ids(G().rooms), ['a', 'b']); assert.equal(doc.querySelectorAll('.floorghost rect').length, 0);
q('#floors [data-fl=floor-2]').click(); assert.deepEqual(ids(G().rooms), ['room-1-floor-2']);
w.confirm = () => true; q('#floors [data-fa=del]').click();
assert.deepEqual(G().floors.map(f => f.id), ['floor-1']); assert.deepEqual(ids(G().rooms), ['a', 'b']);
$('undo').click(); assert.deepEqual(G().floors.map(f => f.id), ['floor-1', 'floor-2'], 'undo brings the deleted floor back');
// 5. PageUp / PageDown switch floors, storey height input, stairs link moves the room onto the lower room's footprint
doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })); assert.deepEqual(ids(G().rooms), ['a', 'b'], 'PageDown = floor below');
doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'PageUp', bubbles: true })); assert.deepEqual(ids(G().rooms), ['room-1-floor-2'], 'PageUp = floor above');
const h = q('#floor-h'); h.value = '3.2'; h.dispatchEvent(new w.Event('change', { bubbles: true })); assert.equal(G().floors[1].height, 3.2);
q('#floors [data-fa=stair]').click();
assert.equal(G().stairs.length, 1); assert.equal(doc.querySelectorAll('#stairs .stair').length, 1, 'stair drawn'); assert.equal($('stairbox').hidden, false, 'stair panel');
const lenIn = q('#stairbox [data-f=length]'); lenIn.value = '4'; lenIn.dispatchEvent(new w.Event('change', { bubbles: true })); assert.equal(G().stairs[0].length, 4);
q('#stairbox [data-d=up]').click(); assert.equal(G().stairs[0].direction, 'up');
doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 't', bubbles: true })); assert.ok(doc.body.classList.contains('seethrough'), 'T = see-through');
q('#floors [data-fl=floor-1]').click(); assert.equal(doc.querySelectorAll('#stairs .stair').length, 1, 'the stair is also drawn on the floor below');
q('#floors [data-fl=floor-2]').click();

// 6. contract check: a clean file saves at once (step 3); a file with a dangling relationship shows the panel, Save anyway downloads
w.eval("g.relationships.push({id:'x',connectorA:'nope',connectorB:'nope2'})"); blob = null; $('save').click();
assert.equal(blob, null, 'nothing downloaded yet'); assert.equal($('contract').hidden, false); assert.ok($('contract').textContent.includes('unknown connector'));
q('#contract [data-c=save]').click(); assert.ok(blob, 'Save anyway downloads'); assert.equal($('contract').hidden, true);
console.log('browser-smoke-floors: OK');
