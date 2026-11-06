// Shape editing (v2.18 phase 5): moving a wall segment and pulling bumps / notches (src/shape.ts, src/room-shape.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { outlineBump, outlineMoveWall, outlineWallAt, type Outline } from '../src/shape.js';
import { moveRoomWall, pullRoomWall, reshapeRoom, shapeOfRoom } from '../src/room-shape.js';
import { embeddedSource } from '../src/embed.js';

// L: bar x 0..2, y 0..1 and leg x 0..1, y 1..2. Walls: 0 top (y0), 1 right (x2, y0..1), 2 bottom (y1, x1..2), 3 right (x1, y1..2), 4 bottom (y2, x0..1), 5 left (x0).
const L2: Outline = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
const R: Outline = [[0, 0], [6, 0], [6, 5], [0, 5]];

test('move wall: the right wall of the bar +1 m stretches the bar to 3 m; the bottom of the leg +1 m makes the leg 2 m longer', () => {
  assert.deepEqual(outlineMoveWall(L2, 1, 1), [[0, 0], [3, 0], [3, 1], [1, 1], [1, 2], [0, 2]]);
  assert.deepEqual(outlineMoveWall(L2, 4, 1), [[0, 0], [2, 0], [2, 1], [1, 1], [1, 3], [0, 3]]);
});

test('move wall: pushing the leg wall x = 1 out by 1 m fills the notch and the shape becomes the rectangle 2 x 2', () => {
  assert.deepEqual(outlineMoveWall(L2, 3, 1), [[0, 0], [2, 0], [2, 2], [0, 2]]);
});

test('move wall: refused when a wall would be shorter than 0.3 m (the bar pulled in by 1.8 m leaves 0.2) or the shape crosses itself (the left wall pushed in 1.5 m); zero delta changes nothing; unknown wall is null', () => {
  assert.equal(outlineMoveWall(L2, 1, -1.8), null);
  assert.equal(outlineMoveWall(L2, 5, -1.5), null);
  assert.deepEqual(outlineMoveWall(L2, 1, 0), L2);
  assert.equal(outlineMoveWall(L2, 9, 1), null);
});

test('bump: 2 m wide, 1 m deep, centred at x = 3 on the top wall of a 6 x 5 room starts at (2, -1); a notch 2 m wide and 1.5 m deep at the top of the right wall (clamped to y 0..1.5) cuts the corner', () => {
  assert.deepEqual(outlineBump(R, 0, 3, 2, 1), [[2, -1], [4, -1], [4, 0], [6, 0], [6, 5], [0, 5], [0, 0], [2, 0]]);
  assert.deepEqual(outlineBump(R, 1, 0.5, 2, -1.5), [[0, 0], [4.5, 0], [4.5, 1.5], [6, 1.5], [6, 5], [0, 5]]);
});

test('bump: refused when too shallow (0.1 m), too narrow after clamping (0.2 m), when it would cut the room in two, or leave a strip of 0.2 m', () => {
  assert.equal(outlineBump(R, 0, 3, 2, 0.1), null);
  assert.equal(outlineBump(R, 1, 0, 0.4, -1), null);
  assert.equal(outlineBump(R, 1, 2.5, 1, -6), null);
  assert.equal(outlineBump(R, 1, 2.5, 1, -5.8), null);
});

const graph = (): any => ({
  rooms: [
    { id: 'r', name: 'R', layout: { x: 10, y: 20, width: 6, height: 5 }, connectors: [{ id: 'c', side: 'right', offset: 2, width: 0.9 }] },
    { id: 'n', name: 'N', layout: { x: 16, y: 20, width: 3, height: 5 }, connectors: [{ id: 'd', side: 'left', offset: 2, width: 0.9 }] },
  ],
  relationships: [], objects: [{ roomId: 'r', position: [1, 1] }], entityPlacements: [{ roomId: 'r', position: [2, 3] }],
});

test('shape of a room: the rectangle of its layout, or its canonical outline', () => {
  assert.deepEqual(shapeOfRoom(graph().rooms[0]), R);
  assert.deepEqual(shapeOfRoom({ layout: { width: 2, height: 2 }, outline: [[2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 0]] }), L2);
  assert.deepEqual(shapeOfRoom({ layout: { width: 2, height: 2 }, outline: [[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [0, 0]] }), [[0, 0], [2, 0], [2, 2], [0, 2]], 'a counter-clockwise outline is not valid: the rectangle of the layout is used');
});

test('pull a bump (2 x 1 m at x 3) out of the top wall: the room grows 1 m upwards (layout y 19, height 6), the outline is relative to it, connector offset 2 -> 3 (position 0.5), the object [1,1] -> [1,2] and the entity [2,3] -> [2,4] stay in place on the floor', () => {
  const r = pullRoomWall({ graph: graph(), id: 'r', wall: 0, center: 3, width: 2, depth: 1 });
  assert.ok(r.ok, r.message);
  const room = r.graph.rooms[0];
  assert.deepEqual(room.layout, { x: 10, y: 19, width: 6, height: 6, sizeLocked: true });
  assert.deepEqual(room.outline, [[2, 0], [4, 0], [4, 1], [6, 1], [6, 6], [0, 6], [0, 1], [2, 1]]);
  assert.deepEqual([room.connectors[0].offset, room.connectors[0].position], [3, 0.5]);
  assert.deepEqual([r.graph.objects[0].position, r.graph.entityPlacements[0].position], [[1, 2], [2, 4]]);
});

test('a wall with a connection to ONE other room moves for both rooms (phase 7): the right wall of R (door to N at offset 2) +1 m gives R width 7 and N x 17 width 2, both still rectangles, the door still at offset 2; away from the connector a bump is free; a detached connection frees the wall', () => {
  const g = graph(); g.relationships = [{ id: 'l', connectorA: 'c', connectorB: 'd' }];
  const m = moveRoomWall({ graph: g, id: 'r', wall: 1, delta: 1 });
  assert.ok(m.ok, m.message);
  const [r0, n0] = m.graph.rooms;
  assert.deepEqual([r0.layout.x, r0.layout.width, r0.outline, n0.layout.x, n0.layout.width, n0.outline], [10, 7, undefined, 17, 2, undefined]);
  assert.deepEqual([r0.connectors[0].offset, n0.connectors[0].offset, m.graph.relationships.length], [2, 2, 1]);
  assert.match(m.message, /N changed with it/);
  assert.equal(pullRoomWall({ graph: g, id: 'r', wall: 1, center: 4, width: 1, depth: 1 }).ok, true, 'a part of the wall away from the connector is free');
  g.joints = [{ relationshipId: 'l', state: 'detached' }];
  const r = moveRoomWall({ graph: g, id: 'r', wall: 1, delta: 1 });
  assert.ok(r.ok); assert.match(r.message, /N changed with it/, 'a detached connection does not matter: the walls still coincide');
  const alone = moveRoomWall({ graph: g, id: 'r', wall: 1, delta: 1, alone: true });
  assert.ok(alone.ok); assert.deepEqual([alone.graph.rooms[0].layout.width, alone.graph.rooms[0].outline, alone.graph.rooms[1].layout.x], [7, undefined, 16]); assert.equal(alone.message, 'The room is a rectangle.');
  g.joints = [];
  assert.match(moveRoomWall({ graph: g, id: 'r', wall: 1, delta: 1, alone: true }).message, /connected to N/, 'Alt (alone) refuses while a connection is attached');
});

test('a shared wall without any door moves for both rooms too (geometry decides): A 0,0 4x3 above B 0,3 4x3, A bottom wall +1 gives A height 4 and B y 4 height 2; with Alt (alone) and Block overlaps only A moves and B is named as overlapped', () => {
  const g = { rooms: [{ id: 'a', name: 'A', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [] }, { id: 'b', name: 'B', layout: { x: 0, y: 3, width: 4, height: 3 }, connectors: [] }], relationships: [] };
  const m = moveRoomWall({ graph: g, id: 'a', wall: 2, delta: 1, noOverlap: true });
  assert.ok(m.ok, m.message);
  assert.deepEqual([m.graph.rooms[0].layout.height, m.graph.rooms[1].layout.y, m.graph.rooms[1].layout.height], [4, 4, 2]);
  assert.match(m.message, /B changed with it/);
  assert.match(moveRoomWall({ graph: g, id: 'a', wall: 2, delta: 1, noOverlap: true, alone: true }).message, /overlap B/);
  assert.equal(moveRoomWall({ graph: g, id: 'a', wall: 2, delta: 1, noOverlap: false, alone: true }).ok, true);
  const out = JSON.parse(JSON.stringify(g)); out.rooms[1].name = 'Outside';
  assert.equal(moveRoomWall({ graph: out, id: 'a', wall: 2, delta: 1, noOverlap: true }).ok, false, 'the Outside room never follows');
});

test('shared wall inwards: R right wall -1 m gives R width 5 and N x 15 width 4; N top connector at offset 1 (world x 17) becomes offset 2 so it stays where it is on the floor', () => {
  const g = graph(); g.relationships = [{ id: 'l', connectorA: 'c', connectorB: 'd' }];
  g.rooms[1].connectors.push({ id: 'e', side: 'top', offset: 1, width: 0.9 });
  const m = moveRoomWall({ graph: g, id: 'r', wall: 1, delta: -1 });
  assert.ok(m.ok, m.message);
  const n = m.graph.rooms[1];
  assert.deepEqual([m.graph.rooms[0].layout.width, n.layout.x, n.layout.width], [5, 15, 4]);
  assert.deepEqual(n.connectors.map((c: { id: string; offset: number }) => [c.id, c.offset]), [['d', 2], ['e', 2]]);
});

test('shared notch: a notch 1 m wide and 1 m deep (y 21.5..22.5) pulled into the right wall of R at the door makes N grow into it: R corners 0,0 6,0 6,1.5 5,1.5 5,2.5 6,2.5 6,5 0,5; N (x 15..19) corners 1,0 4,0 4,5 1,5 1,2.5 0,2.5 0,1.5 1,1.5; both doors stay on the notch walls without wallAt', () => {
  const g = graph(); g.relationships = [{ id: 'l', connectorA: 'c', connectorB: 'd' }];
  const m = pullRoomWall({ graph: g, id: 'r', wall: 1, center: 2, width: 1, depth: -1 });
  assert.ok(m.ok, m.message);
  const [r0, n0] = m.graph.rooms;
  assert.deepEqual(r0.outline, [[0, 0], [6, 0], [6, 1.5], [5, 1.5], [5, 2.5], [6, 2.5], [6, 5], [0, 5]]);
  assert.deepEqual(n0.outline, [[1, 0], [4, 0], [4, 5], [1, 5], [1, 2.5], [0, 2.5], [0, 1.5], [1, 1.5]]);
  assert.deepEqual([n0.layout.x, n0.layout.width, r0.layout.width], [15, 4, 6]);
  assert.deepEqual([r0.connectors[0].offset, r0.connectors[0].wallAt, n0.connectors[0].offset, n0.connectors[0].wallAt], [2, undefined, 2, undefined]);
});

test('shared wall refusals: a wall connected to two rooms; a size-locked neighbour; a position-locked neighbour whose corner would move; a neighbour left 0.2 m wide', () => {
  const g = graph(); g.relationships = [{ id: 'l', connectorA: 'c', connectorB: 'd' }];
  const two = graph();
  two.rooms = [
    { id: 'r', name: 'R', layout: { x: 10, y: 20, width: 6, height: 5 }, connectors: [{ id: 'c', side: 'right', offset: 1, width: 0.9 }, { id: 'c2', side: 'right', offset: 4, width: 0.9 }] },
    { id: 'n1', name: 'N1', layout: { x: 16, y: 20, width: 3, height: 2.5 }, connectors: [{ id: 'd', side: 'left', offset: 1, width: 0.9 }] },
    { id: 'n2', name: 'N2', layout: { x: 16, y: 22.5, width: 3, height: 2.5 }, connectors: [{ id: 'd2', side: 'left', offset: 1.5, width: 0.9 }] },
  ];
  two.relationships = [{ id: 'l1', connectorA: 'c', connectorB: 'd' }, { id: 'l2', connectorA: 'c2', connectorB: 'd2' }];
  assert.match(moveRoomWall({ graph: two, id: 'r', wall: 1, delta: 1 }).message, /several rooms \(N1, N2\)/);
  const sl = JSON.parse(JSON.stringify(g)); sl.rooms[1].layout.sizeLocked = true;
  assert.match(moveRoomWall({ graph: sl, id: 'r', wall: 1, delta: 1 }).message, /N is size-locked/);
  const pl = JSON.parse(JSON.stringify(g)); pl.rooms[1].layout.positionLocked = true;
  assert.match(moveRoomWall({ graph: pl, id: 'r', wall: 1, delta: 1 }).message, /N is position-locked/);
  assert.match(moveRoomWall({ graph: pl, id: 'r', wall: 1, delta: -1 }).message, /N is position-locked/, 'N would grow to the left: its corner moves as well');
  assert.match(moveRoomWall({ graph: g, id: 'r', wall: 1, delta: 2.8 }).message, /0\.3 m/);
  assert.equal(JSON.stringify(g).includes('"x":17'), false, 'the input graph is not changed');
});

test('block overlaps with two neighbours on one wall and no door: R wall +1 m touches N (x 16..19, y 20..22.5) and X (y 22.5..25) -> refused naming both; Alt (alone) moves only R: refused naming the overlapped room with Block overlaps, allowed without', () => {
  const g = graph();
  g.rooms[1].layout.height = 2.5; g.rooms[1].connectors = []; g.rooms[0].connectors = [];
  g.rooms.push({ id: 'x', name: 'X', layout: { x: 16, y: 22.5, width: 3, height: 2.5 }, connectors: [] });
  assert.match(moveRoomWall({ graph: g, id: 'r', wall: 1, delta: 1, noOverlap: true }).message, /several rooms \(N, X\)/);
  assert.match(moveRoomWall({ graph: g, id: 'r', wall: 1, delta: 1, noOverlap: true, alone: true }).message, /overlap N/);
  assert.equal(moveRoomWall({ graph: g, id: 'r', wall: 1, delta: 1, noOverlap: false, alone: true }).ok, true);
});

test('block overlaps: a bump into the neighbour makes the neighbour follow (notch, too); with Alt (alone) it is refused with the room named, allowed without Block overlaps', () => {
  const g = graph();
  const b = pullRoomWall({ graph: g, id: 'r', wall: 1, center: 4, width: 1, depth: 1, noOverlap: true });
  assert.ok(b.ok, b.message); assert.match(b.message, /N changed with it/);
  assert.match(pullRoomWall({ graph: g, id: 'r', wall: 1, center: 4, width: 1, depth: 1, noOverlap: true, alone: true }).message, /overlap N/);
  assert.equal(pullRoomWall({ graph: g, id: 'r', wall: 1, center: 4, width: 1, depth: 1, noOverlap: false, alone: true }).ok, true);
  assert.equal(pullRoomWall({ graph: g, id: 'r', wall: 1, center: 4, width: 1, depth: -1, noOverlap: true }).ok, true);
  assert.equal(pullRoomWall({ graph: g, id: 'n', wall: 3, center: 4, width: 1, depth: -1, noOverlap: true }).ok, true, 'N: a notch in its left wall');
  assert.equal(pullRoomWall({ graph: g, id: 'n', wall: 3, center: 4, width: 1, depth: 1, noOverlap: true, alone: true }).ok, false, 'N: a bump to the left into R with Alt');
});

test('a locked top-left corner: pulling a bump out of the top wall is refused, out of the bottom wall is fine', () => {
  const g = graph(); g.rooms[0].layout.positionLocked = true;
  assert.match(pullRoomWall({ graph: g, id: 'r', wall: 0, center: 3, width: 2, depth: 1 }).message, /position-locked/);
  assert.equal(pullRoomWall({ graph: g, id: 'r', wall: 2, center: 3, width: 2, depth: 1 }).ok, true);
});

test('reshape refuses an invalid outline and an unknown room; the input graph is never changed', () => {
  const g = graph(), before = JSON.stringify(g);
  assert.equal(reshapeRoom({ graph: g, id: 'r', outline: [[0, 0], [2, 1], [2, 2]] }).ok, false);
  assert.equal(reshapeRoom({ graph: g, id: 'zz', outline: R }).ok, false);
  pullRoomWall({ graph: g, id: 'r', wall: 0, center: 3, width: 2, depth: 1 });
  assert.equal(JSON.stringify(g), before);
});

test('a connector stays on its wall: a notch pulled up from the bottom under a left connector (y = 3) does not make it jump to the notch wall x = 4.5, it stays on the outer wall x = 0', () => {
  const g = { rooms: [{ id: 'r', name: 'R', layout: { x: 0, y: 0, width: 6, height: 5 }, connectors: [{ id: 'c', side: 'left', offset: 3, width: 0.9 }] }], relationships: [] };
  const r = pullRoomWall({ graph: g, id: 'r', wall: 2, center: 4, width: 1, depth: -3 });
  assert.ok(r.ok, r.message);
  const room = r.graph.rooms[0]!, c = room.connectors![0]!;
  assert.equal(outlineWallAt(shapeOfRoom(room), 'left', 3)!.at, 0); assert.deepEqual([c.offset, (c as { wallAt?: number }).wallAt], [3, undefined]);
});

test('a connector on an inner wall keeps it: on a U (notch open at the top) a left connector on the notch wall x = 2 (wallAt 2) stays there when a bump is pulled out of the top of the left arm (offset 0.5 -> 1.5, wallAt 2), and is not moved to the outer wall x = 0', () => {
  const U: Outline = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 0], [3, 0], [3, 2], [0, 2]];
  const g = { rooms: [{ id: 'u', name: 'U', layout: { x: 0, y: 0, width: 3, height: 2 }, outline: U, connectors: [{ id: 'c', side: 'left', offset: 0.5, wallAt: 2, width: 0.9 }] }], relationships: [] };
  const r = pullRoomWall({ graph: g, id: 'u', wall: 0, center: 0.5, width: 0.4, depth: 1 });
  assert.ok(r.ok, r.message);
  const c = r.graph.rooms[0]!.connectors![0]!;
  assert.deepEqual([c.offset, c.wallAt], [1.5, 2]);
  assert.equal(outlineWallAt(shapeOfRoom(r.graph.rooms[0]!), 'left', 1.5, c.wallAt)!.at, 2);
});

test('embedded in the page: the shape editing functions evaluate and match Node', () => {
  const f = new Function(embeddedSource() + '\nreturn { pullRoomWall, moveRoomWall };')() as { pullRoomWall: typeof pullRoomWall; moveRoomWall: typeof moveRoomWall };
  const a = { graph: graph(), id: 'r', wall: 0, center: 3, width: 2, depth: 1 };
  assert.equal(JSON.stringify(f.pullRoomWall(a)), JSON.stringify(pullRoomWall(a)));
  assert.equal(JSON.stringify(f.moveRoomWall({ graph: graph(), id: 'r', wall: 2, delta: 1 })), JSON.stringify(moveRoomWall({ graph: graph(), id: 'r', wall: 2, delta: 1 })));
});
