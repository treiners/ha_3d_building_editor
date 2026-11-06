// Room shapes as hosts (v2.18 phase 3): objects, entities and stairs respect the real shape, not the bounding box.
// L room "l" at (10, 20): bar x 0..6, y 0..3 and leg x 0..3, y 3..5 (relative to the room), the notch x 3..6, y 3..5 is outside.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addObject, moveObject, objectClamp, objectDefs, objectHostAt, objectSnap, validateObjects } from '../src/objects.js';
import { addEntity, entityClamp, entityHostAt, moveEntity, validateEntities } from '../src/entities.js';
import { stairsHost } from '../src/stairs.js';
import { embeddedSource } from '../src/embed.js';

const L: [number, number][] = [[0, 0], [6, 0], [6, 3], [3, 3], [3, 5], [0, 5]];
const base = (): any => ({ rooms: [{ id: 'l', name: 'L', layout: { x: 10, y: 20, width: 6, height: 5 }, outline: L, connectors: [] }], relationships: [], objects: [], entityPlacements: [] });
const withSofa = (pos: [number, number]): any => { const g = base(); g.objects.push({ id: 'o', type: 'sofa', roomId: 'l', position: pos, facingDegrees: 0 }); return g; };

test('host under a point: the bar (12, 21) and the leg (11, 24) belong to the room, the notch (14, 24) to nobody', () => {
  assert.equal(objectHostAt(base(), 12, 21)!.id, 'l'); assert.equal(objectHostAt(base(), 11, 24)!.id, 'l');
  assert.equal(objectHostAt(base(), 14, 24), null); assert.equal(entityHostAt(base(), 14, 24, false), null);
  assert.equal(entityHostAt(base(), 12, 21, false)!.id, 'l');
});

test('placing an object in the notch is refused, in the leg it works', () => {
  assert.equal(addObject({ graph: base(), type: 'sofa', wx: 14, wy: 24 }).ok, false);
  assert.equal(addObject({ graph: base(), type: 'chair', wx: 11, wy: 24 }).ok, true);
});

test('moving a 2 x 0.9 m sofa from the leg [1.5, 4] to the notch centre (4, 4): the nearest place where it fits is the bar above, y = 3 - 0.45 = 2.55', () => {
  const r = moveObject({ graph: withSofa([1.5, 4]), id: 'o', wx: 14, wy: 24 });
  assert.ok(r.ok); assert.deepEqual(r.graph.objects[0].position, [4, 2.55]); assert.equal(r.graph.objects[0].roomId, 'l');
});

test('validate: a sofa at [4, 4] reaches into the notch (outside), one at [3, 1.5] in the bar and one at [1.5, 4] in the leg are fine', () => {
  assert.deepEqual(validateObjects(withSofa([4, 4])).map((i) => i.code), ['outside']);
  assert.match(validateObjects(withSofa([4, 4]))[0]!.message, /shape/);
  assert.deepEqual(validateObjects(withSofa([3, 1.5])), []); assert.deepEqual(validateObjects(withSofa([1.5, 4])), []);
});

test('snap to the notch wall: a sofa at (4, 2.45) has its bottom edge 0.1 m from the wall y = 3 and snaps to y = 2.55 (world 22.55); x stays', () => {
  assert.deepEqual(objectSnap({ graph: withSofa([4, 2.45]), id: 'o', wx: 14, wy: 22.45 }), { wx: 14, wy: 22.55, snapped: true });
  assert.equal(objectSnap({ graph: withSofa([4, 1.5]), id: 'o', wx: 14, wy: 21.5 }).snapped, false);
});

test('entity clamp: a point in the notch (4, 4) goes to the nearest wall point (4, 3) (a tie with (3, 4) goes to the smaller y); inside points and rectangles are unchanged', () => {
  assert.deepEqual(entityClamp({ width: 6, height: 5 }, L, 4, 4), [4, 3]);
  assert.deepEqual(entityClamp({ width: 6, height: 5 }, L, 1, 4), [1, 4]);
  assert.deepEqual(entityClamp({ width: 6, height: 5 }, undefined, 4, 4), [4, 4]);
  assert.deepEqual(entityClamp({ width: 6, height: 5 }, L, 9, -1), [6, 0]);
});

test('entities: adding in the notch lands on the wall, moving into the notch stays in the room at the wall, validate reports a notch position', () => {
  const a = addEntity({ graph: base(), type: 'light', roomId: 'l', at: { x: 14, y: 24 } });
  assert.deepEqual(a.graph.entityPlacements[0].position, [4, 3]);
  const m = moveEntity({ graph: addEntity({ graph: base(), type: 'light', roomId: 'l', position: [1, 1] }).graph, id: 'l-light', x: 14, y: 24 });
  assert.ok(m.ok); assert.deepEqual(m.graph.entityPlacements[0].position, [4, 3]);
  const g = base(); g.entityPlacements = [{ id: 'bad', type: 'light', roomId: 'l', position: [4, 4], height: 2.2 }, { id: 'ok', type: 'light', roomId: 'l', position: [4, 2], height: 2.2 }];
  assert.deepEqual(validateEntities(g).map((i) => [i.id, i.code]), [['bad', 'outside-room']]);
  assert.match(validateEntities(g)[0]!.message, /notch/);
});

test('stairs: the bar of a stair in the leg belongs to the room, one whose bar lies in the notch does not', () => {
  const g = base(); g.floors = [{ id: 'f1' }, { id: 'f2' }]; g.rooms[0].floor = 'f1';
  const stair = (x: number) => ({ lower: 'f1', upper: 'f2', x, y: 23.5, length: 3, width: 1, direction: 'right' });
  assert.equal(stairsHost(g, stair(11), 'lower'), 'l'); assert.equal(stairsHost(g, stair(14), 'lower'), null);
});

test('embedded in the page: the shape-aware host functions evaluate and match Node', () => {
  const f = new Function(embeddedSource() + '\nreturn { objectHostAt, objectClamp, objectDefs, entityClamp };')() as {
    objectHostAt: typeof objectHostAt; objectClamp: typeof objectClamp; objectDefs: typeof objectDefs; entityClamp: typeof entityClamp;
  };
  assert.equal(f.objectHostAt(base(), 14, 24), null);
  assert.deepEqual(f.entityClamp({ width: 6, height: 5 }, L, 4, 4), [4, 3]);
  const host = { width: 6, height: 5, outline: L }, sofa = { type: 'sofa', position: [4, 4] as [number, number] };
  assert.deepEqual(f.objectClamp(sofa, host, f.objectDefs({})), objectClamp(sofa, host, objectDefs({})));
  assert.deepEqual(objectClamp(sofa, host, objectDefs({})), [4, 2.55]);
});
