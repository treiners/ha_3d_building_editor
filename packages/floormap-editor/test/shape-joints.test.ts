// Room shapes and joints (v2.18 phase 4): a connector sits on a wall SEGMENT, so a neighbour can sit in a notch and its connection is green.
// L room "a" at (0, 0), 6 x 5: bar x 0..6, y 0..3 and leg x 0..3, y 3..5; the notch x 3..6, y 3..5 holds the rectangle "b" (3 x 2 at (3, 3)).
import test from 'node:test';
import assert from 'node:assert/strict';
import { aligned, migrate, point, setWorld, touch } from '../src/core.js';
import { deriveJoints } from '../src/joints.js';
import { embeddedSource } from '../src/embed.js';

const L = [[0, 0], [6, 0], [6, 3], [3, 3], [3, 5], [0, 5]];
const port = (id: string, roomId: string, side: string, offset: number) => ({ id, roomId, side, type: 'door', offset, width: 0.9 });
const scene = (bx = 3, aRightOffset = 4): any => ({
  schemaVersion: '3.0', id: 'g', name: 'g', wallAlignments: [],
  rooms: [
    { id: 'a', name: 'a', type: 'other', sizeCategory: 'large', layout: { x: 0, y: 0, width: 6, height: 5 }, outline: L, connectors: [port('a-right', 'a', 'right', aRightOffset), port('a-bottom', 'a', 'bottom', 4.5)] },
    { id: 'b', name: 'b', type: 'other', sizeCategory: 'small', layout: { x: bx, y: 3, width: 3, height: 2 }, connectors: [port('b-left', 'b', 'left', 1), port('b-top', 'b', 'top', 1.5)] },
  ],
  relationships: [{ id: 'r1', connectorA: 'a-right', connectorB: 'b-left', importance: 'required' }, { id: 'r2', connectorA: 'a-bottom', connectorB: 'b-top', importance: 'required' }],
});

test('a neighbour in the notch is green on both inner walls: gap 0, shared parts y 3..5 and x 3..6, openings at y = 4 and x = 4.5', () => {
  const j = deriveJoints(migrate(scene())).joints;
  assert.deepEqual(j.map((x) => [x.relationshipId, x.status, x.gap, x.overlap, x.axis, x.opening]), [['r1', 'ok', 0, [3, 5], 'y', 4], ['r2', 'ok', 0, [3, 6], 'x', 4.5]]);
});

test('slide range along the inner wall x = 3 (y 3..5, door 0.9 + 0.1 margin): room b may move -1..1, with the opening staying where it is -0.55..0.55 (4 -+ 0.45 inside 3..5)', () => {
  const s = deriveJoints(migrate(scene())).joints[0]!.slide!;
  assert.deepEqual([s.min, s.max, s.fixedOpening], [-1, 1, { min: -0.55, max: 0.55 }]);
});

test('core: touch / aligned / point agree with the joints; the connector points lie on the inner walls (3, 4) and (4.5, 3)', () => {
  const g = migrate(scene());
  assert.equal(touch(g, g.rooms[0]!.connectors[0]!, g.rooms[1]!.connectors[0]!), true);
  assert.ok(g.relationships.every((l) => aligned(g, l)));
  assert.deepEqual(point(g, g.rooms[0]!.connectors[0]!), { x: 3, y: 4 }); assert.deepEqual(point(g, g.rooms[0]!.connectors[1]!), { x: 4.5, y: 3 });
});

test('moving b 0.5 m away from the notch wall breaks the first joint with reason gap; a connector on the outer wall x = 6 (offset 1.5) does not touch b (gap and no shared part)', () => {
  const far = deriveJoints(migrate(scene(3.5))).joints[0]!;
  assert.deepEqual([far.status, far.reasons, far.gap], ['broken', ['gap'], 0.5]);
  const wrong = deriveJoints(migrate(scene(3, 1.5))).joints[0]!;
  assert.deepEqual([wrong.status, wrong.reasons], ['broken', ['gap', 'no-overlap']]);
});

test('setWorld keeps a connector on its wall: y = 3.01 on the inner wall x = 3 (y 3..5) gives offset 3.05, y = 4.9 gives 4.9, y = 5.5 gives 4.95', () => {
  const g = migrate(scene()), c = g.rooms[0]!.connectors[0]!;
  setWorld(g, c, { x: 0, y: 3.01 }); assert.equal(c.offset, 3.05);
  setWorld(g, c, { x: 0, y: 4.9 }); assert.equal(c.offset, 4.9);
  setWorld(g, c, { x: 0, y: 5.5 }); assert.equal(c.offset, 4.95);
});

test('embedded in the page: deriveJoints evaluates with the shape functions and matches Node', () => {
  const f = new Function(embeddedSource() + '\nreturn { deriveJoints };')() as { deriveJoints: typeof deriveJoints };
  const g = migrate(scene());
  assert.equal(JSON.stringify(f.deriveJoints(g)), JSON.stringify(deriveJoints(g)));
});
