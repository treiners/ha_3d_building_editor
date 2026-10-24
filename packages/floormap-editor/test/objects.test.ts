// Objects (src/objects.ts): hand-computed expectations on tiny scenes. Kitchen = room at (2,1), 4 x 3 m, door on its right wall at offset 1.5, width 0.9.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addObject, fillObjectDefaults, moveObject, objectCatalog, objectClamp, objectDefs, objectFootprint, objectHostAt, removeObject, updateObject, validateObjects, type ObjectGraph } from '../src/objects.js';

const base = (): ObjectGraph => ({
  rooms: [
    { id: 'kitchen', name: 'Kitchen', layout: { x: 2, y: 1, width: 4, height: 3 }, connectors: [{ id: 'k-door', side: 'right', offset: 1.5, width: 0.9, type: 'door' }] },
    { id: 'hall', name: 'Hall', layout: { x: 6, y: 1, width: 2, height: 3 }, connectors: [] },
    { id: 'out', name: 'Outside', layout: { x: -50, y: -50, width: 200, height: 200 }, connectors: [] },
  ],
  objects: [], entityPlacements: [], buildingDefaults: { wallHeight: 2.4 },
});
const withFridge = (): ObjectGraph => addObject({ graph: base(), type: 'refrigerator', wx: 3, wy: 2 }).graph;

test('catalogue: every type has a positive footprint and a category; the refrigerator is 0.6 x 0.65 x 1.85 m with 0.7 m clearance', () => {
  for (const [k, d] of Object.entries(objectCatalog())) {
    assert.ok(d.width > 0 && d.depth > 0 && d.height > 0, k);
    assert.ok(d.category === 'appliance' || d.category === 'furniture', k);
  }
  assert.deepEqual(objectCatalog().refrigerator, { label: 'Refrigerator', category: 'appliance', width: 0.6, depth: 0.65, height: 1.85, clearance: 0.7 });
});

test('footprint at (1,1): facing 0 spans x 0.7..1.3 and y 0.675..1.325 (w 0.6, d 0.65)', () => {
  const f = objectFootprint({ position: [1, 1], width: 0.6, depth: 0.65, facingDegrees: 0 });
  assert.deepEqual(f, [[0.7, 0.675], [1.3, 0.675], [1.3, 1.325], [0.7, 1.325]]);
});

test('footprint at (1,1): facing 90 turns it clockwise, so it spans x 0.675..1.325 and y 0.7..1.3; corner 1 (-0.3,-0.325) -> (0.325,-0.3) -> (1.325,0.7)', () => {
  const f = objectFootprint({ position: [1, 1], width: 0.6, depth: 0.65, facingDegrees: 90 });
  assert.deepEqual(f, [[1.325, 0.7], [1.325, 1.3], [0.675, 1.3], [0.675, 0.7]]);
});

test('footprint at facing 180 equals facing 0 with the corners shifted by two; size defaults come from the type', () => {
  const a = objectFootprint({ type: 'refrigerator', position: [1, 1], facingDegrees: 180 }, objectCatalog());
  assert.deepEqual(a, [[1.3, 1.325], [0.7, 1.325], [0.7, 0.675], [1.3, 0.675]]);
});

test('host at a point: the kitchen at (3,2); the hall at (7,2); the Outside room is ignored; nothing at (-10,-10)', () => {
  const g = base();
  assert.equal(objectHostAt(g, 3, 2)?.id, 'kitchen');
  assert.equal(objectHostAt(g, 7, 2)?.id, 'hall');
  assert.equal(objectHostAt(g, -10, -10), null);
});

test('host at a shared wall x = 6 is the smaller room (hall 6 m2 against kitchen 12 m2)', () => {
  assert.equal(objectHostAt(base(), 6, 2)?.id, 'hall');
});

test('add: a refrigerator with its centre at plan (3,2) in the kitchen at (2,1) has position [1,1] and the id kitchen-refrigerator; a second one gets -2', () => {
  const r1 = addObject({ graph: base(), type: 'refrigerator', wx: 3, wy: 2 });
  assert.ok(r1.ok); assert.equal(r1.id, 'kitchen-refrigerator');
  assert.deepEqual(r1.graph.objects![0]!.position, [1, 1]); assert.equal(r1.graph.objects![0]!.roomId, 'kitchen');
  const r2 = addObject({ graph: r1.graph, type: 'refrigerator', wx: 4, wy: 2 });
  assert.equal(r2.id, 'kitchen-refrigerator-2');
});

test('add near the corner: centre (2.1,1.1) is clamped so the footprint stays inside, to (0.3, 0.325) relative', () => {
  const r = addObject({ graph: base(), type: 'refrigerator', wx: 2.1, wy: 1.1 });
  assert.deepEqual(r.graph.objects![0]!.position, [0.3, 0.325]);
});

test('add: unknown type and a point outside every room are refused with a message and the same graph', () => {
  const g = base();
  assert.equal(addObject({ graph: g, type: 'spaceship', wx: 3, wy: 2 }).ok, false);
  const r = addObject({ graph: g, type: 'refrigerator', wx: -10, wy: -10 });
  assert.equal(r.ok, false); assert.equal(r.graph, g);
});

test('add: ids are unique across the other floors (a stashed kitchen-refrigerator makes the new one -2)', () => {
  const g = base(); g._fl = { cur: 'f1', data: { f2: { objects: [{ id: 'kitchen-refrigerator', type: 'refrigerator', roomId: 'kitchen', position: [1, 1] }] } } };
  assert.equal(addObject({ graph: g, type: 'refrigerator', wx: 3, wy: 2 }).id, 'kitchen-refrigerator-2');
});

test('add never mutates its input', () => {
  const g = base(), before = JSON.stringify(g);
  addObject({ graph: g, type: 'sofa', wx: 3, wy: 2 });
  assert.equal(JSON.stringify(g), before);
});

test('move into the hall: centre at plan (7,2) with the hall at (6,1) gives roomId hall and position [1,1]', () => {
  const m = moveObject({ graph: withFridge(), id: 'kitchen-refrigerator', wx: 7, wy: 2 });
  const o = m.graph.objects![0]!;
  assert.equal(o.roomId, 'hall'); assert.deepEqual(o.position, [1, 1]);
});

test('move to a point outside every room keeps the host and clamps: plan (-10,-10) in the kitchen becomes [0.3, 0.325]', () => {
  const o = moveObject({ graph: withFridge(), id: 'kitchen-refrigerator', wx: -10, wy: -10 }).graph.objects![0]!;
  assert.equal(o.roomId, 'kitchen'); assert.deepEqual(o.position, [0.3, 0.325]);
});

test('update: facing 450 is stored as 90; the footprint then spans 0.65 in x', () => {
  const g = updateObject({ graph: withFridge(), id: 'kitchen-refrigerator', patch: { facingDegrees: 450 } }).graph;
  assert.equal(g.objects![0]!.facingDegrees, 90);
  const xs = objectFootprint(g.objects![0]!, objectDefs(g)).map((p) => p[0]);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 0.65) < 1e-9);
});

test('update refuses a negative width, an unknown type and a height above 4 m; the graph stays the same', () => {
  const g = withFridge();
  for (const patch of [{ width: -1 }, { type: 'spaceship' }, { height: 5 }]) {
    const r = updateObject({ graph: g, id: 'kitchen-refrigerator', patch });
    assert.equal(r.ok, false); assert.equal(r.graph, g);
  }
});

test('update: widening a wall-side object clamps it inside: width 3 at the left wall of the 4 m kitchen moves the centre from 0.3 to 1.5', () => {
  const g0 = addObject({ graph: base(), type: 'refrigerator', wx: 2.1, wy: 2 }).graph;
  const g = updateObject({ graph: g0, id: 'kitchen-refrigerator', patch: { width: 3 } }).graph;
  assert.equal(g.objects![0]!.position[0], 1.5);
});

test('clamp: an object larger than its host is centred (a 5 m wide object in a 4 m room has its centre at 2)', () => {
  assert.deepEqual(objectClamp({ position: [0.3, 1], width: 5, depth: 1, facingDegrees: 0 }, { width: 4, height: 3 }), [2, 1]);
});

test('remove deletes the object and the entities attached to it (objectId) and says so', () => {
  const g = withFridge(); g.entityPlacements = [{ id: 'e1', objectId: 'kitchen-refrigerator' }, { id: 'e2' }];
  const r = removeObject({ graph: g, id: 'kitchen-refrigerator' });
  assert.deepEqual(r.graph.objects, []); assert.deepEqual(r.graph.entityPlacements!.map((e) => e.id), ['e2']);
  assert.ok(r.message.includes('1 entity removed'));
  assert.equal(removeObject({ graph: g, id: 'nope' }).ok, false);
});

test('validate: a fresh refrigerator in the kitchen has no problems', () => {
  assert.deepEqual(validateObjects(withFridge()), []);
});

test('validate: two refrigerators on the same spot overlap (reported on the later id); touching ones (0.6 m apart) do not', () => {
  const a = addObject({ graph: base(), type: 'refrigerator', wx: 3, wy: 2 }).graph;
  const b = addObject({ graph: a, type: 'refrigerator', wx: 3, wy: 2 }).graph;
  assert.deepEqual(validateObjects(b).map((i) => [i.id, i.code]), [['kitchen-refrigerator-2', 'overlap']]);
  const c = addObject({ graph: a, type: 'refrigerator', wx: 3.6, wy: 2 }).graph;
  assert.deepEqual(validateObjects(c), []);
});

test('validate: a microwave (elevation 0.9) above a dishwasher (height 0.85) does not overlap: 0.9 >= 0.85', () => {
  const a = addObject({ graph: base(), type: 'dishwasher', wx: 3, wy: 2 }).graph;
  const b = addObject({ graph: a, type: 'microwave', wx: 3, wy: 2 }).graph;
  assert.deepEqual(validateObjects(b), []);
});

test('validate: an object pushed outside its room by editing the data is reported as outside', () => {
  const g = withFridge(); g.objects![0]!.position = [3.9, 2.5];
  assert.deepEqual(validateObjects(g).map((i) => i.code), ['outside']);
});

test('validate: a refrigerator at the door (right wall, centre y 2.5, zone x 5.1..6, y 2.05..2.95) blocks it; one at the left wall does not', () => {
  const g = addObject({ graph: base(), type: 'refrigerator', wx: 5.6, wy: 2.5 }).graph;
  assert.deepEqual(validateObjects(g).map((i) => i.code), ['blocks-door']);
  assert.deepEqual(validateObjects(withFridge()), []);
});

test('validate: a wardrobe 2.5 m high in 2.4 m walls is too high; unknown type and missing host are reported', () => {
  const g = addObject({ graph: base(), type: 'wardrobe', wx: 3, wy: 2 }).graph; g.objects![0]!.height = 2.5;
  assert.deepEqual(validateObjects(g).map((i) => i.code), ['too-high']);
  const h = withFridge(); h.objects!.push({ id: 'x', type: 'spaceship', roomId: 'kitchen', position: [1, 1] }, { id: 'y', type: 'sofa', roomId: 'gone', position: [1, 1] });
  assert.deepEqual(validateObjects(h).map((i) => i.id + ':' + i.code), ['x:unknown-type', 'y:no-host']);
});

test('fill defaults writes name, category, size, elevation and facing from the type, keeps given values, is idempotent and does not mutate', () => {
  const g = withFridge(); g.objects![0]!.width = 0.7; const before = JSON.stringify(g);
  const f = fillObjectDefaults(g), o = f.objects![0]!;
  assert.equal(JSON.stringify(g), before);
  assert.deepEqual([o.name, o.category, o.width, o.depth, o.height, o.elevation, o.facingDegrees], ['Refrigerator', 'appliance', 0.7, 0.65, 1.85, 0, 0]);
  assert.deepEqual(fillObjectDefaults(f), f);
});

test('custom types replace built-in ones and add new ones', () => {
  const g = base(); g.objectTypes = [{ id: 'refrigerator', label: 'Big fridge', category: 'appliance', width: 0.9, depth: 0.7, height: 1.8 }, { id: 'wine-cooler', label: 'Wine cooler', category: 'appliance', width: 0.5, depth: 0.5, height: 0.85 }];
  const d = objectDefs(g);
  assert.equal(d.refrigerator!.width, 0.9); assert.equal(d['wine-cooler']!.label, 'Wine cooler'); assert.equal(d.sofa!.width, 2);
  assert.ok(addObject({ graph: g, type: 'wine-cooler', wx: 3, wy: 2 }).ok);
});
