// A room can be moved into the notch of an L-shaped neighbour (v2.18): "Block overlaps" measures the real shapes, not the bounding boxes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveJoints } from '../src/joints.js';
import { planMove } from '../src/moves.js';
import { embeddedSource } from '../src/embed.js';

// A: bar x 0..6, y 0..3 and leg x 0..3, y 3..5 (notch x 3..6, y 3..5); B: 2 x 2 at (7, 3), free (no connections).
const L: [number, number][] = [[0, 0], [6, 0], [6, 3], [3, 3], [3, 5], [0, 5]];
const rooms = (withShape: boolean): any[] => [
  { id: 'a', connectors: [], layout: { x: 0, y: 0, width: 6, height: 5 }, ...(withShape ? { outline: L } : {}) },
  { id: 'b', connectors: [], layout: { x: 7, y: 3, width: 2, height: 2 } },
];
const move = (withShape: boolean, dx: number) => {
  const graph = { rooms: rooms(withShape), relationships: [] };
  return planMove({ graph, joints: deriveJoints(graph).joints, roomId: 'b', dx, dy: 0, mode: 'slide', step: 0.2 });
};

test('into the notch: B moved 3 m left (x 4..6, y 3..5) fits, the bounding boxes overlap but the shapes do not', () => {
  const p = move(true, -3);
  assert.deepEqual([p.blocked, p.displacements.b], [false, { dx: -3, dy: 0 }]);
});

test('further left it touches the leg: it stops at 4 m (B x 3..5 touches the wall x = 3), reason overlap', () => {
  const p = move(true, -5);
  assert.deepEqual([p.blocked, p.reason, p.displacements.b!.dx], [true, 'overlap', -4]);
});

test('control: without a shape the bounding box blocks at 1 m (B x 6..8 touches the room)', () => {
  const p = move(false, -3);
  assert.deepEqual([p.blocked, p.reason, p.displacements.b!.dx], [true, 'overlap', -1]);
});

test('embedded in the page: planMove evaluates with the shape functions and matches Node', () => {
  const f = new Function(embeddedSource() + '\nreturn { planMove };')() as { planMove: typeof planMove };
  const graph = { rooms: rooms(true), relationships: [] }, input = { graph, joints: deriveJoints(graph).joints, roomId: 'b', dx: -5, dy: 0, mode: 'slide' as const, step: 0.2 };
  assert.equal(JSON.stringify(f.planMove(input)), JSON.stringify(planMove(input)));
});
