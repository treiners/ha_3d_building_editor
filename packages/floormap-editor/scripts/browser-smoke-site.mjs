// Optional smoke test for the Site mode / outside areas (needs jsdom, run after `npm run build`, from the package folder).
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
const G = () => JSON.parse(w.eval('JSON.stringify(g)')), area = id => G().areas.find(a => a.id === id), click = s => doc.querySelector(s).click();
const key = (k, extra = {}) => doc.dispatchEvent(Object.assign(new w.Event('keydown', { bubbles: true }), { key: k, ...extra }));
const near = (a, b) => Math.abs(a - b) < 1e-6;

// 1. Site mode: the floor plan is read-only
click('[data-app-btn=site]'); assert.equal(doc.body.dataset.app, 'site'); assert.match($('status').textContent, /Site/);
const rooms0 = w.eval('JSON.stringify(g.rooms.map(r=>r.layout))');
ptr('pointerdown', doc.querySelector('[data-room=a] rect'), 1, 1); ptr('pointermove', canvas, 3, 2); ptr('pointerup', canvas, 3, 2);
assert.equal(w.eval('JSON.stringify(g.rooms.map(r=>r.layout))'), rooms0); assert.equal(w.eval('active'), null); assert.equal(w.eval('sel.size'), 0);

// 2. click drops a default-size deck (4x3 centred on (12,2.1), grid 0.2 -> x 10, y 0.6), one undo step, one-shot palette
click('[data-ak=deck]'); assert.equal(doc.body.dataset.akind, 'deck'); assert.match($('site-hint').textContent, /drop a deck/);
ptr('pointerdown', canvas, 12, 2.1); ptr('pointerup', canvas, 12, 2.1);
assert.deepEqual(area('deck'), { id: 'deck', name: 'Deck', kind: 'deck', shape: 'rect', layout: { x: 10, y: 0.6, width: 4, height: 3 } }); assert.equal(w.eval('siteUi.selA'), 'deck'); assert.equal(doc.body.dataset.akind, '');
$('undo').click(); assert.equal((G().areas || []).length, 0); $('redo').click(); assert.equal(G().areas.length, 1);

// 3. drag a rectangle for a pond (3,6) -> (7,8.4): an ellipse 4 x 2.4
click('[data-ak=pond]'); ptr('pointerdown', canvas, 3, 6); ptr('pointermove', canvas, 5, 7); assert.ok(doc.querySelector('.area-draw'), 'draw preview'); ptr('pointermove', canvas, 7, 8.4); ptr('pointerup', canvas, 7, 8.4);
assert.deepEqual([area('pond').shape, area('pond').layout], ['ellipse', { x: 3, y: 6, width: 4, height: 2.4 }]);

// 4. select by clicking inside the deck, drag to move (+1 m), undo; rooms stay unselectable
ptr('pointerdown', canvas, 12, 2); ptr('pointermove', canvas, 13, 2); ptr('pointerup', canvas, 13, 2); assert.equal(area('deck').layout.x, 11); assert.equal(w.eval('siteUi.selA'), 'deck');
$('undo').click(); assert.equal(area('deck').layout.x, 10);
ptr('pointerdown', canvas, 2, 1); ptr('pointerup', canvas, 2, 1); assert.equal(w.eval('siteUi.selA'), null, 'inside a room = background'); assert.equal(w.eval('sel.size'), 0);

// 5. resize with the corner handle: br (14,3.6) -> (15,4.6) = 5 x 4
ptr('pointerdown', canvas, 12, 2); ptr('pointerup', canvas, 12, 2);
ptr('pointerdown', doc.querySelector('[data-ahandle=br]'), 14, 3.6); ptr('pointermove', canvas, 15, 4.6); ptr('pointerup', canvas, 15, 4.6);
assert.deepEqual([area('deck').layout.width, area('deck').layout.height], [5, 4]);

// 6. an entity in the area follows a multi-move resize (5x4 -> 2.4x2: [5,4] -> [2.4,2]); undo restores both
w.eval("g=addEntity({graph:g,type:'camera',areaId:'deck',position:[5,4]}).graph;render()");
const epos = () => G().entityPlacements[0].position;
ptr('pointerdown', doc.querySelector('[data-ahandle=br]'), 15, 4.6); ptr('pointermove', canvas, 13.6, 3.6); ptr('pointermove', canvas, 12.4, 2.6); ptr('pointerup', canvas, 12.4, 2.6);
assert.ok(near(area('deck').layout.width, 2.4) && near(area('deck').layout.height, 2)); assert.ok(near(epos()[0], 2.4) && near(epos()[1], 2), 'entity scaled: ' + epos());
$('undo').click(); assert.deepEqual([area('deck').layout.width, epos()], [5, [5, 4]]);

// 7. inspector: name, kind, roofed; delete removes the area and its entity (undo restores both)
const sf = (k, fn) => { const el = doc.querySelector('[data-sf=' + k + ']'); fn(el); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
sf('name', el => { el.value = 'Terrace'; }); sf('kind', el => { el.value = 'path'; }); sf('roofed', el => { el.checked = true; });
assert.deepEqual([area('deck').name, area('deck').kind, area('deck').roofed], ['Terrace', 'path', true]); assert.ok(doc.querySelector('.area-roof'), 'roofed hatch');
click('#site-del'); assert.equal(G().areas.some(a => a.id === 'deck'), false); assert.equal(G().entityPlacements.length, 0); assert.match($('status').textContent, /1 entity removed/);
$('undo').click(); assert.equal(G().areas.length, 2); assert.equal(G().entityPlacements.length, 1);

// 8. Escape cancels an armed kind; Delete removes the selected area
click('[data-ak=garden]'); key('Escape'); assert.equal(doc.body.dataset.akind, '');

// 9. Entities mode: a light can sit in the pond (ellipse), a smoke detector cannot, an area entity shows in the list
click('[data-app-btn=entities]'); click('[data-ptype=light]'); ptr('pointerdown', canvas, 5, 7);
const light = G().entityPlacements.find(e => e.type === 'light'); assert.deepEqual([light.areaId, light.roomId, light.position], ['pond', undefined, [2, 1]]);
click('[data-ptype=smoke-detector]'); ptr('pointerdown', canvas, 5, 7); assert.equal($('status').textContent, 'Click inside a room.'); key('Escape');
w.eval("selE=null;render()"); click('[data-etab=list]'); assert.match($('ent-list').textContent, /Pond \(area\)/);

// 10. areas are drawn below the rooms in plan mode; Fit includes them; Save keeps and completes them
click('[data-app-btn=plan]'); const al = doc.querySelector('.arealayer'), rm = doc.querySelector('[data-room]');
assert.ok(al && (al.compareDocumentPosition(rm) & 4), 'area layer comes before the rooms');
w.eval('fit()'); assert.ok(w.eval('view.x+view.w') >= 15, 'fit includes the deck (x to 15)');
const saved = JSON.parse(w.eval('JSON.stringify(fillAreaDefaults(fillEntityDefaults(fillDefaults(g))))'));
assert.deepEqual(saved.areas.map(a => [a.id, a.shape, a.roofed]), [['deck', 'rect', true], ['pond', 'ellipse', false]]);
console.log('site smoke OK');
