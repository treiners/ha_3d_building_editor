// Optional smoke test: drives the GENERATED editor in a fake DOM (drag, undo/redo, keyboard, joint summary).
// Usage (from the package folder):  npm i -D jsdom && npm run build && node scripts/browser-smoke.mjs
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const ref = readFileSync('../shared/reference-home-connectors.json', 'utf8');
const d = new JSDOM(editorHtml(JSON.parse(readFileSync('examples/reference.json', 'utf8'))), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id);
const svg = $('canvas');
// jsdom has no SVG geometry: world coordinates == client coordinates
svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
svg.getScreenCTM = () => ({ inverse: () => ({}) }); svg.setPointerCapture = () => {};
const snapG = () => w.eval('JSON.stringify(g)');
const ev = (type, el, props = {}) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0 }, props); el.dispatchEvent(e); };
const joints = () => $('joints').textContent;

await $('file').onchange({ target: { files: [{ text: async () => ref }] } });
console.log('after load      :', joints(), '| undo disabled:', $('undo').disabled, '| redo disabled:', $('redo').disabled);
assert.equal($('undo').disabled, true); assert.match(joints(), /13 attached/); assert.doesNotMatch(joints(), /broken/);

// 1. real drag of the kitchen 3 m to the right
const loaded = snapG();
const kRect = doc.querySelector('[data-room="kitchen"] rect.room'); const k = JSON.parse(loaded).rooms.find(r => r.id === 'kitchen').layout;
const cx = k.x + k.width / 2, cy = k.y + k.height / 2;
ev('pointerdown', kRect, { clientX: cx, clientY: cy }); ev('pointermove', svg, { clientX: cx + 3, clientY: cy }); ev('pointerup', svg, { clientX: cx + 3, clientY: cy });
const dragged = snapG(); assert.notEqual(dragged, loaded);
console.log('after drag      :', joints(), '| undo disabled:', $('undo').disabled);
assert.equal($('undo').disabled, false); assert.match(joints(), /broken/);

// 2. undo button restores exactly, redo re-applies exactly
$('undo').click(); assert.equal(snapG(), loaded); console.log('after undo      :', joints(), '| redo disabled:', $('redo').disabled);
assert.equal($('redo').disabled, false); assert.match(joints(), /13 attached/);
$('redo').click(); assert.equal(snapG(), dragged); console.log('after redo      :', joints());

// 3. keyboard: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
const key = (k, extra = {}) => { const e = new w.KeyboardEvent('keydown', { key: k, ctrlKey: true, bubbles: true, ...extra }); doc.dispatchEvent(e); };
key('z'); assert.equal(snapG(), loaded); key('z', { shiftKey: true }); assert.equal(snapG(), dragged); key('z'); key('y'); assert.equal(snapG(), dragged);
console.log('keyboard undo/redo ok');

// 4. a click without movement is not an undoable change; Run mapper is
key('z'); assert.equal(snapG(), loaded);
const before = $('undo').disabled; ev('pointerdown', kRect, { clientX: cx, clientY: cy }); ev('pointerup', svg, { clientX: cx, clientY: cy });
assert.equal($('undo').disabled, before, 'click without move must not create an undo step');
$('run-mapper').click(); const mapped = snapG(); console.log('after run-mapper:', $('status').textContent, '|', joints());
assert.equal($('undo').disabled, false); $('undo').click(); assert.equal(snapG(), loaded); $('redo').click(); assert.equal(snapG(), mapped);

// 5. move modes
const setMode = m => { const sel = $('move-mode'); sel.value = m; sel.dispatchEvent(new w.Event('change')); };
const roomPos = id => JSON.parse(snapG()).rooms.find(r => r.id === id).layout;
const drag = (el, from, to, props = {}) => { ev('pointerdown', el, { clientX: from.x, clientY: from.y, ...props }); ev('pointermove', svg, { clientX: to.x, clientY: to.y, ...props }); ev('pointerup', svg, { clientX: to.x, clientY: to.y, ...props }); };
key('z'); key('z'); key('z'); w.eval('hist.clear()');                   // back to a known state: reload for clean history
await $('file').onchange({ target: { files: [{ text: async () => ref }] } });
const base = snapG(), K0 = roomPos('kitchen'), c0 = { x: K0.x + K0.width / 2, y: K0.y + K0.height / 2 };
const kEl = () => doc.querySelector('[data-room="kitchen"] rect.room');

setMode('slide'); console.log('mode hint       :', $('status').textContent); assert.match($('status').textContent, /Slide/);
drag(kEl(), c0, { x: c0.x + 3, y: c0.y });                              // across the wall: blocked
assert.deepEqual(roomPos('kitchen'), K0); assert.match($('status').textContent, /Attached walls limit/); assert.match(joints(), /13 attached/);
console.log('slide, across   : blocked ->', $('status').textContent);
assert.ok(doc.querySelectorAll('.jointwall').length >= 1, 'selected room shows its attached walls');

drag(kEl(), c0, { x: c0.x, y: c0.y + 5 });                              // along the wall: slides, stays attached
const K1 = roomPos('kitchen'); assert.equal(K1.x, K0.x); assert.match(joints(), /13 attached/);
console.log('slide, along    : kitchen y', K0.y, '->', K1.y, '|', joints());
w.eval('undo()'); assert.equal(snapG(), base);

setMode('pull'); const pre = JSON.parse(snapG());
drag(kEl(), c0, { x: c0.x + 3, y: c0.y });                              // across the wall: neighbours follow
const after = JSON.parse(snapG()); assert.match(joints(), /13 attached/);
const shifted = after.rooms.filter(r => Math.abs(r.layout.x - pre.rooms.find(q => q.id === r.id).layout.x - 3) < 1e-6).length;
console.log('pull, across    :', shifted, 'of', after.rooms.length, 'rooms moved |', $('status').textContent, '|', joints());
assert.ok(shifted < after.rooms.length, 'a move that needs the whole floor plan to shift is refused'); assert.match($('status').textContent, /whole floor plan/);
w.eval('undo()'); assert.equal(snapG(), base);

setMode('slide'); drag(kEl(), c0, { x: c0.x + 3, y: c0.y }, { altKey: true });   // Alt: detach on purpose
assert.equal(roomPos('kitchen').x, K0.x + 3); assert.match(joints(), /12 attached, 1 detached/);
console.log('alt-drag        :', joints(), '| saved joints:', JSON.stringify(JSON.parse(snapG()).joints));
w.eval('undo()'); assert.equal(snapG(), base); assert.match(joints(), /13 attached/);

setMode('free'); drag(kEl(), c0, { x: c0.x + 3, y: c0.y });              // Free = today's behaviour: just moves, breaks the joint
assert.equal(roomPos('kitchen').x, K0.x + 3); assert.match(joints(), /12 attached, 1 broken/); w.eval('undo()'); assert.equal(snapG(), base);
console.log('free            : unchanged behaviour');

// 6. split locks, wall tool, overlap blocking
const overlapsNow = () => w.eval(`(()=>{let o=0;for(let i=0;i<g.rooms.length;i++)for(let j=i+1;j<g.rooms.length;j++){const A=rect(g.rooms[i]),B=rect(g.rooms[j]);if(Math.min(A.x+A.width,B.x+B.width)-Math.max(A.x,B.x)>1e-6&&Math.min(A.y+A.height,B.y+B.height)-Math.max(A.y,B.y)>1e-6)o++}return o})()`);
const pick = id => { const r = doc.querySelector(`[data-room="${id}"] rect.room`); ev('pointerdown', r, { clientX: 0, clientY: 0 }); ev('pointerup', svg, { clientX: 0, clientY: 0 }); };
const setTool = t => { const sel = $('tool'); sel.value = t; sel.dispatchEvent(new w.Event('change')); };
setMode('free'); w.eval('hist.clear()');
assert.equal(overlapsNow(), 0);

// 6a. two independent lock checkboxes
pick('dining'); assert.ok($('lock-pos') && $('lock-size'), 'two lock checkboxes'); assert.equal($('lock-pos').checked, false); assert.equal($('lock-size').checked, false);
$('lock-pos').checked = true; $('apply-room').click();
let dl = JSON.parse(snapG()).rooms.find(r => r.id === 'dining').layout; assert.equal(dl.positionLocked, true); assert.equal(dl.sizeLocked, false); assert.equal(dl.locked, undefined);
pick('dining'); assert.equal($('lock-pos').checked, true); assert.equal($('lock-size').checked, false); assert.equal($('width').disabled, false, 'size still editable');
assert.equal(doc.querySelectorAll('[data-resize]').length, 1, 'position locked: only the bottom-right resize handle');
$('lock-size').checked = true; $('apply-room').click(); dl = JSON.parse(snapG()).rooms.find(r => r.id === 'dining').layout; assert.equal(dl.locked, true);
pick('dining'); assert.equal($('width').disabled, true); assert.equal(doc.querySelectorAll('[data-resize]').length, 0, 'size locked: no handles');
$('lock-pos').checked = false; $('apply-room').click(); dl = JSON.parse(snapG()).rooms.find(r => r.id === 'dining').layout; assert.equal(dl.positionLocked, false); assert.equal(dl.sizeLocked, true); assert.equal(dl.locked, undefined);
console.log('split locks     : position / size / both / size-only round-trip OK');
// a position-locked room cannot be dragged, a size-locked one can
$('lock-size').checked = false; $('apply-room').click(); pick('dining'); $('lock-pos').checked = true; $('apply-room').click();
const D0 = roomPos('dining'), dEl = doc.querySelector('[data-room="dining"] rect.room');
drag(dEl, { x: D0.x + 1, y: D0.y + 1 }, { x: D0.x + 3, y: D0.y + 1 }); assert.deepEqual(roomPos('dining'), D0); console.log('position lock  : drag refused');

// 6b. wall tool
setTool('walls'); console.log('tool hint       :', $('status').textContent); assert.match($('status').textContent, /Drag walls/);
assert.equal(doc.querySelectorAll('[data-wall]').length, 4 * 11, 'four wall strips per visible room');
const lock = (id, flags) => w.eval(`Object.assign(g.rooms.find(r=>r.id==='${id}').layout,${JSON.stringify(flags)})`);
const wl = (id, side) => doc.querySelector(`[data-wall="${id}"][data-side="${side}"]`);
const pre2 = snapG();
drag(wl('living', 'right'), { x: 0, y: 0 }, { x: 1, y: 0 });                    // dining is position-locked: blocked
assert.equal(snapG(), pre2); assert.match($('status').textContent, /Dining Room is locked in place/); console.log('wall, locked    :', $('status').textContent);
lock('dining', { positionLocked: false, sizeLocked: false, locked: undefined });
const L0 = roomPos('living'), Dn0 = roomPos('dining');
drag(wl('living', 'right'), { x: 0, y: 0 }, { x: 1, y: 0 });                    // shared wall moves: living grows, dining shrinks
const L1 = roomPos('living'), Dn1 = roomPos('dining');
assert.equal(L1.width, L0.width + 1); assert.equal(Dn1.x, Dn0.x + 1); assert.equal(Dn1.width, Dn0.width - 1); assert.equal(Dn1.x + Dn1.width, Dn0.x + Dn0.width);
assert.match(joints(), /13 attached/); assert.equal(overlapsNow(), 0);
console.log('wall, shared    : living', L0.width, '->', L1.width, '| dining x', Dn0.x, '->', Dn1.x, 'width', Dn0.width, '->', Dn1.width, '|', joints());
const ports = w.eval(`JSON.stringify(g.relationships.map(l=>aligned(l)))`); assert.ok(!ports.includes('false'), 'all connectors still aligned (green)');
w.eval('undo()'); assert.equal(JSON.stringify(roomPos('dining')), JSON.stringify(Dn0));
drag(wl('living', 'right'), { x: 0, y: 0 }, { x: 30, y: 0 });                   // far too far: squeezes, pushes, then something stops it - never an overlap
assert.equal(overlapsNow(), 0); assert.match(joints(), /13 attached/); console.log('wall, far drag :', $('status').textContent);
w.eval('undo()');
// the overlap block can be switched off in the UI
$('no-overlap').checked = false; drag(wl('living', 'right'), { x: 0, y: 0 }, { x: 30, y: 0 }); console.log('wall, no block  : overlaps now', overlapsNow(), '|', joints()); w.eval('undo()'); $('no-overlap').checked = true;
setTool('rooms'); assert.equal(doc.querySelectorAll('[data-wall]').length, 0, 'strips only exist in the wall tool');

const g6c = snapG();
// 6c. slide modes never create overlaps
setMode('slide'); drag(kEl(), c0, { x: c0.x, y: c0.y + 6 }); assert.equal(overlapsNow(), 0); assert.match(joints(), /13 attached/);
setMode('pull'); drag(kEl(), c0, { x: c0.x + 20, y: c0.y }); assert.equal(overlapsNow(), 0); console.log('modes           : no overlaps after long slide/pull drags | ' + $('status').textContent);
setMode('free');

// 6d. corner handles use the wall solver in Slide modes; Free keeps the old one-room resize
for (let i = 0; i < 10 && snapG() !== g6c; i++) w.eval('undo()'); assert.equal(snapG(), g6c, 'plan restored after 6c');
w.eval('hist.clear()'); setMode('slide'); pick('living'); const cs0 = snapG(), LV0 = roomPos('living'), DN0 = roomPos('dining');
const brHandle = () => doc.querySelector('[data-resize="living"][data-corner="br"]'); assert.ok(brHandle(), 'living has a bottom-right handle');
drag(brHandle(), { x: 0, y: 0 }, { x: 1, y: 0 });
assert.equal(roomPos('living').width, LV0.width + 1); assert.equal(roomPos('dining').x, DN0.x + 1); assert.equal(roomPos('dining').width, DN0.width - 1);
assert.match(joints(), /13 attached/); assert.equal(overlapsNow(), 0); assert.ok(!w.eval(`JSON.stringify(g.relationships.map(l=>aligned(l)))`).includes('false'), 'connectors stay green');
w.eval('undo()'); assert.equal(snapG(), cs0);
drag(brHandle(), { x: 0, y: 0 }, { x: 30, y: 30 }); assert.equal(overlapsNow(), 0); assert.match(joints(), /13 attached/); console.log('corner, slide   : pushes neighbours; far drag stops without overlap |', $('status').textContent); w.eval('undo()');
setMode('free'); drag(brHandle(), { x: 0, y: 0 }, { x: 1, y: 0 });
assert.equal(roomPos('living').width, LV0.width + 1); assert.deepEqual(roomPos('dining'), DN0); w.eval('undo()'); assert.equal(snapG(), cs0); console.log('corner, free    : unchanged behaviour');
// lock checkboxes apply immediately (no Apply button)
pick('dining'); $('lock-size').checked = true; $('lock-size').dispatchEvent(new w.Event('change'));
assert.equal(roomPos('dining').sizeLocked, true, 'lock applies without Apply'); assert.equal($('width').disabled, true);
$('lock-pos').checked = true; $('lock-pos').dispatchEvent(new w.Event('change')); assert.equal(roomPos('dining').locked, true);
w.eval('undo()'); w.eval('undo()'); assert.equal(snapG(), cs0); console.log('locks           : apply immediately, one undo step each');

// 6e. alignment groups: reference shown, inactive after a free change, Re-align restores it
w.eval("sel.clear();sel.add('living');sel.add('dining')"); $('align-side').value = 'top'; $('add-alignment').onclick();
assert.match($('alignments').innerHTML, /\(reference\)/); assert.match($('alignments').innerHTML, /Active/, $('status').textContent);
assert.equal(roomPos('dining').y, roomPos('living').y);
w.eval("g.rooms.find(r=>r.id==='dining').layout.y+=0.6;render()");
assert.match($('alignments').innerHTML, /Inactive/); assert.match($('alignments').innerHTML, /data-realign/);
doc.querySelector('[data-realign]').dispatchEvent(new w.Event('click', { bubbles: true }));
assert.match($('alignments').innerHTML, /Active/, $('status').textContent); assert.equal(roomPos('dining').y, roomPos('living').y);
w.eval('undo()'); w.eval('undo()'); assert.equal(snapG(), cs0); console.log('alignment       : reference, inactive after free edit, re-align');

// 6f. add a room (connected), connect two rooms, remove a connector, delete a room
const n0 = JSON.parse(snapG()).rooms.length;
w.eval("sel.clear();sel.add('kitchen')"); $('new-name').value = 'Pantry'; $('new-side').value = 'top'; $('add-room').onclick();
assert.equal(JSON.parse(snapG()).rooms.length, n0 + 1); assert.match($('status').textContent, /Added "Pantry"/); assert.doesNotMatch($('status').textContent, /not connected/, $('status').textContent);
assert.match(joints(), /14 attached/); assert.match($('conn-table').innerHTML, /data-delconn/);
doc.querySelector('[data-delconn]').dispatchEvent(new w.Event('click', { bubbles: true }));
assert.match($('status').textContent, /Removed 2 connector/); assert.match(joints(), /13 attached/); w.eval('undo()'); assert.match(joints(), /14 attached/);
w.eval("sel.clear();sel.add('pantry')"); $('delete-room').onclick();
assert.equal(JSON.parse(snapG()).rooms.length, n0); assert.match($('status').textContent, /Deleted "Pantry"/); assert.match(joints(), /13 attached/);
w.eval('undo()'); w.eval('undo()'); assert.equal(snapG(), cs0); console.log('rooms           : add + connect, remove connector, delete, undo');

// 6g. dragging a connector is limited to the shared part of both walls (the pair never separates)
const pc0 = snapG(), lbd = doc.querySelector('[data-port="living-bottom-door-2"]');
ev('pointerdown', lbd, { clientX: 0, clientY: 0 }); ev('pointermove', svg, { clientX: 60, clientY: 0 }); ev('pointerup', svg, { clientX: 60, clientY: 0 });
assert.match(joints(), /13 attached/); assert.doesNotMatch(joints(), /broken/); w.eval('undo()'); assert.equal(snapG(), pc0);
ev('pointerdown', lbd, { clientX: 0, clientY: 0 }); ev('pointermove', svg, { clientX: -60, clientY: 0 }); ev('pointerup', svg, { clientX: -60, clientY: 0 });
assert.match(joints(), /13 attached/); w.eval('undo()'); assert.equal(snapG(), pc0); console.log('connector drag  : stays inside the shared wall part');

// 6h. Free room drag: connectors are not touched while dragging (smooth), pairs that were aligned are re-aligned on release
setMode('free'); pick('kitchen'); const kk = roomPos('kitchen'), conn0 = w.eval('JSON.stringify(g.rooms.flatMap(r=>r.connectors.map(p=>p.offset)))');
ev('pointerdown', doc.querySelector('[data-room="kitchen"] rect.room'), { clientX: 0, clientY: 0 }); ev('pointermove', svg, { clientX: 0, clientY: 0.4 });
assert.doesNotMatch(joints(), /broken/, 'aligned pairs stay aligned while dragging');
ev('pointerup', svg, { clientX: 0, clientY: 0.4 }); assert.doesNotMatch(joints(), /broken/, 'and after release');
w.eval('undo()'); assert.equal(snapG(), pc0); console.log('free drag       : pairs stay aligned while dragging');

// 6i. Slide modes: a broken pair that still touches (like hottub / living room) is not re-aligned while dragging
setMode('pull'); w.eval("g.rooms.find(r=>r.id==='kitchen').connectors.find(p=>p.id==='kitchen-left-open-passage').offset-=0.6;render()");
const offs = () => w.eval('JSON.stringify(g.rooms.flatMap(r=>r.connectors.map(p=>p.offset)))'), bo0 = offs();
ev('pointerdown', doc.querySelector('[data-room="kitchen"] rect.room'), { clientX: 0, clientY: 0 });
for (const y of [-0.2, -0.4]) { ev('pointermove', svg, { clientX: 0, clientY: y }); assert.equal(offs(), bo0, 'connector offsets stay put while sliding'); }
ev('pointerup', svg, { clientX: 0, clientY: -0.4 }); w.eval('undo()'); w.eval("g.rooms.find(r=>r.id==='kitchen').connectors.find(p=>p.id==='kitchen-left-open-passage').offset+=0.6;render()"); console.log('slide, broken   : connectors untouched while dragging');

// 6j. Slide + pull: dragging away and back restores every connector exactly (planned from the start of the drag, nothing stale)
setMode('pull'); const j6 = snapG(), dn = doc.querySelector('[data-room="dining"] rect.room');
ev('pointerdown', dn, { clientX: 0, clientY: 0 });
for (const x of [0.2, 0.4, 0.6, 0.4, 0.2, 0]) ev('pointermove', svg, { clientX: x, clientY: 0 });
ev('pointerup', svg, { clientX: 0, clientY: 0 }); assert.equal(snapG(), j6, 'back at the start = identical graph'); assert.doesNotMatch(joints(), /broken/);
console.log('pull, there+back: identical graph');

// 7. loading a file clears the history; joint overrides in the file are honoured
await $('file').onchange({ target: { files: [{ text: async () => JSON.stringify({ ...JSON.parse(ref), joints: [{ relationshipId: 'living-dining', state: 'detached' }] }) }] } });
console.log('after 2nd load  :', joints(), '| undo disabled:', $('undo').disabled);
assert.equal($('undo').disabled, true); assert.match(joints(), /12 attached, 1 detached/);
console.log('ALL BROWSER CHECKS PASSED');
