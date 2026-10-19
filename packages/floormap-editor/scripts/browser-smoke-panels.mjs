// Optional smoke test for the connector table (needs jsdom, run after `npm run build`, from the package folder).
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: ['top', 'left', 'bottom'].map((side, i) => ({ id: id + '-' + side, roomId: id, side, type: i === 1 ? 'window' : 'door', offset: 1.5 })), layout: { x, y: 0, width: 4, height: 3 } });
const graph = { schemaVersion: '2.14', rooms: [room('r1', 0), room('r2', 5), room('r3', 10), room('r4', 15)], relationships: [] };
const d = new JSDOM(editorHtml(graph), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id);
const rows = () => [...doc.querySelectorAll('#conn-table tr[data-selconn]')].map(tr => tr.firstChild.textContent);
const pick = (...ids) => { w.eval('sel.clear()'); for (const id of ids) w.eval("sel.add('" + id + "')"); w.eval('selPort=null;render()'); };

assert.equal($('show-bars').checked, true, 'width bars on by default'); assert.ok(doc.querySelectorAll('.bar').length > 0, 'bars drawn');
assert.equal(rows().length, 12, 'nothing selected: all connectors'); assert.ok(doc.querySelector('#conn-table .ctwrap'), 'scroll wrapper'); assert.equal(doc.querySelector('#conn-table .mini'), null, 'no filter note');
pick('r2'); assert.deepEqual(rows(), ['r2', 'r2', 'r2']); assert.match($('conn-table').textContent, /3 of 12 connectors \(selected room\)/);
pick('r1', 'r3'); assert.equal(rows().length, 6); assert.match($('conn-table').textContent, /6 of 12 connectors \(selected rooms\)/);
w.eval("sel.clear();sel.add('r2');selPort='r4-top';render()"); assert.equal(rows().length, 4, 'the selected connector stays visible'); assert.ok(rows().includes('r4'));
pick(); assert.equal(rows().length, 12, 'deselect: all again');
w.eval("g.rooms[0].connectors=[];sel.clear();sel.add('r1');selPort=null;render()"); assert.match($('conn-table').textContent, /No connectors in the selected room/);

// Connectors tab: order, room panel hidden, structured inspector below the table
w.eval("setUi('connectors');sel.clear();selPort=null;render()");
assert.equal($('panel-conn').innerHTML, '', 'no connector selected: no inspector');
doc.querySelector('#conn-table tr[data-selconn]').click();
const pc = $('panel-conn'), tbl = pc.querySelector('table.ptable'); assert.ok(tbl, 'inspector is a table');
assert.deepEqual([...tbl.querySelectorAll('tr')].map(tr => tr.firstChild.textContent).slice(0, 5), ['Room', 'Connects to', 'Type', 'Width', 'Door type']);
assert.ok(pc.querySelector('[data-ctype]') && pc.querySelector('[data-cwidth]') && pc.querySelector('[data-cdoor]') && pc.querySelector('[data-delconn]'), 'handlers keep their data attributes');
assert.ok($('conn-table').compareDocumentPosition(pc) & 4, 'inspector comes after the connectors table');
assert.ok(doc.querySelector('.sec-connectors h2').textContent.startsWith('Add connector'), 'Add connector is first');
assert.equal(w.getComputedStyle($('panel')).display, 'none', 'room panel hidden in the Connectors tab');
// a window shows sill and head as table rows
w.eval("selPort='r2-left'; render()"); assert.ok([...$('panel-conn').querySelectorAll('td:first-child')].some(td => td.textContent === 'Sill height'));
// editing in the table still works (type via the select)
const ty = $('panel-conn').querySelector('[data-ctype]'); ty.value = 'door'; ty.dispatchEvent(new w.Event('change', { bubbles: true })); assert.equal(w.eval("port('r2-left').type"), 'door');

// double-click on a room opens the Layout tab and shows the room panel
w.eval("setUi('connectors');sel.clear();sel.add('r2');selPort=null;render()"); assert.equal(doc.body.dataset.ui, 'connectors');
doc.querySelector('[data-room=r2] rect').dispatchEvent(new w.Event('dblclick', { bubbles: true }));
assert.equal(doc.body.dataset.ui, 'layout'); assert.match($('panel').textContent, /r2/); assert.notEqual(w.getComputedStyle($('panel')).display, 'none');

// gear: settings view with sections, everything else hidden, Escape or the gear closes it; options keep working
assert.ok(!doc.body.dataset.settings, 'closed at start');
$('gear').click(); assert.equal(doc.body.dataset.settings, '1'); assert.equal($('gear').getAttribute('aria-pressed'), 'true');
assert.deepEqual([...doc.querySelectorAll('#settings-view > .card > h2')].map(h => h.textContent), ['Layout', 'Connectors', 'Entities', 'Interface']);
assert.equal(w.getComputedStyle($('settings-view')).display, 'block');
$('show-bars').checked = false; w.eval('render()'); assert.equal(doc.querySelectorAll('.bar').length, 0, 'width bars off');
$('show-bars').checked = true; w.eval('render()'); assert.ok(doc.querySelectorAll('.bar').length > 0);
doc.dispatchEvent(Object.assign(new w.Event('keydown', { bubbles: true }), { key: 'Escape' })); assert.equal(doc.body.dataset.settings, ''); assert.equal($('gear').getAttribute('aria-pressed'), 'false');
$('gear').click(); $('gear').click(); assert.equal(doc.body.dataset.settings, '');
console.log('panels smoke OK');
