// Objects phase 3 (src/objects.ts): clearance zones, snap to walls, open passages are free. Room R = (0,0) 4 x 3 m.
import test from 'node:test';
import assert from 'node:assert/strict';
import { objectCatalog, objectClearance, objectSnap, validateObjects, type ObjectGraph } from '../src/objects.js';
import { embeddedSource } from '../src/embed.js';

const room = (connectors: { id: string; side: string; offset: number; width?: number; type: string }[] = []): ObjectGraph => ({
  rooms: [{ id: 'r', name: 'R', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors }],
  objects: [{ id: 'o', type: 'refrigerator', roomId: 'r', position: [2, 1.5], facingDegrees: 0 }],
  buildingDefaults: { wallHeight: 2.4 },
});

test('clearance facing 0 at (1,1): refrigerator 0.6 x 0.65 with 0.7 m in front gives x 0.7..1.3 and y -0.025..0.675 (0.675 - 0.7)', () => {
  assert.deepEqual(objectClearance({ type: 'refrigerator', position: [1, 1], facingDegrees: 0 }, objectCatalog()), [[0.7, -0.025], [1.3, -0.025], [1.3, 0.675], [0.7, 0.675]]);
});

test('clearance facing 90 at (1,1) lies to the right: x 1.325..2.025, y 0.7..1.3', () => {
  assert.deepEqual(objectClearance({ type: 'refrigerator', position: [1, 1], facingDegrees: 90 }, objectCatalog()), [[2.025, 0.7], [2.025, 1.3], [1.325, 1.3], [1.325, 0.7]]);
});

test('clearance is empty for a type without it (sofa) and for an unknown type', () => {
  assert.deepEqual(objectClearance({ type: 'sofa', position: [1, 1] }, objectCatalog()), []);
  assert.deepEqual(objectClearance({ type: 'nope', position: [1, 1] }, objectCatalog()), []);
});

test('snap: proposed centre x 0.35 puts the left edge (0.35 - 0.3 = 0.05) within 0.15 m of the wall, so the centre becomes 0.3; y 1.5 is far from walls and stays', () => {
  assert.deepEqual(objectSnap({ graph: room(), id: 'o', wx: 0.35, wy: 1.5 }), { wx: 0.3, wy: 1.5, snapped: true });
});

test('snap: top edge at 0.4 - 0.325 = 0.075 snaps y to 0.325; right edge at 3.6 + 0.3 = 3.9 snaps x to 3.7', () => {
  assert.deepEqual(objectSnap({ graph: room(), id: 'o', wx: 2, wy: 0.4 }), { wx: 2, wy: 0.325, snapped: true });
  assert.deepEqual(objectSnap({ graph: room(), id: 'o', wx: 3.6, wy: 1.5 }), { wx: 3.7, wy: 1.5, snapped: true });
});

test('snap: 0.2 m away from the wall (left edge at 0.2) is beyond the 0.15 m tolerance, so nothing changes; unknown id is unchanged', () => {
  assert.deepEqual(objectSnap({ graph: room(), id: 'o', wx: 0.5, wy: 1.5 }), { wx: 0.5, wy: 1.5, snapped: false });
  assert.equal(objectSnap({ graph: room(), id: 'zzz', wx: 0.35, wy: 1.5 }).snapped, false);
});

test('open passages are free: a refrigerator in front of an open passage on the right wall (y 1.5) has no problem, in front of a door it blocks it', () => {
  const at = (type: string): ObjectGraph => { const g = room([{ id: 'c', side: 'right', offset: 1.5, width: 1.2, type }]); g.objects![0]!.position = [3.6, 1.5]; return g; };
  assert.deepEqual(validateObjects(at('open-passage')), []);
  assert.deepEqual(validateObjects(at('door')).map((i) => i.code), ['blocks-door']);
});

test('the new functions are embedded in the page source', () => {
  const src = embeddedSource();
  assert.ok(src.includes('function objectClearance(') && src.includes('function objectSnap('));
});
