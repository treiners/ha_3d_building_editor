// Merging two rooms into one (room-shape.ts `mergeRooms`): hand-computed scenes, the arithmetic is in the test names.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRooms } from '../src/room-shape.js';
import type { ShapeGraph } from '../src/room-shape.js';
import { outlineFromRect, outlineBounds, outlineNormalize, outlineIssues, outlineWalls, outlineWallAt, outlineGrid, outlineOverlapArea, outlineCombine, outlineThin } from '../src/shape.js';
import { shapeOfRoom } from '../src/room-shape.js';
import type { Outline } from '../src/shape.js';

interface Conn { id: string; roomId: string; side: string; offset?: number; wallAt?: number }
interface TLayout { x: number; y: number; width: number; height: number; positionLocked?: boolean; sizeLocked?: boolean; locked?: boolean }
interface TRoom { id: string; name: string; floor?: string; layout: TLayout; outline?: Outline; connectors: Conn[] }
interface TG extends ShapeGraph { rooms: TRoom[] }

const room = (id: string, x: number, y: number, w: number, h: number, connectors: Conn[] = []): TRoom => ({ id, name: id.toUpperCase(), layout: { x, y, width: w, height: h }, connectors });
const conn = (id: string, roomId: string, side: string, offset: number): Conn => ({ id, roomId, side, offset });
const two = (a: TRoom, b: TRoom): TG => ({ rooms: [a, b] });

describe('merge rooms', () => {
  it('A 0,0 4x3 + B 4,0 3x3 share the wall x=4 (y 0..3): one rectangle 7x3, no outline; door ar<->bl vanishes; B top connector offset 1 becomes 4+1=5; B object [1,1] becomes [5,1]; B entity [0.5,2] becomes [4.5,2]; the entity on the vanished door is removed', () => {
    const g: TG = two(room('a', 0, 0, 4, 3, [conn('ar', 'a', 'right', 1.5), conn('at', 'a', 'top', 1)]), room('b', 4, 0, 3, 3, [conn('bl', 'b', 'left', 1.5), conn('bt', 'b', 'top', 1)]));
    g.relationships = [{ id: 'ab', connectorA: 'ar', connectorB: 'bl' }];
    g.joints = [{ relationshipId: 'ab', state: 'attached' }];
    g.objects = [{ roomId: 'b', position: [1, 1] }];
    g.entityPlacements = [{ roomId: 'b', position: [0.5, 2] }, { connectorId: 'ar' }];
    const before = JSON.stringify(g), res = mergeRooms({ graph: g, ids: ['a', 'b'] });
    assert.equal(JSON.stringify(g), before, 'the input graph is not changed');
    assert.equal(res.ok, true, res.message);
    const m = res.graph;
    assert.equal(m.rooms.length, 1);
    assert.deepEqual([m.rooms[0]!.layout.x, m.rooms[0]!.layout.y, m.rooms[0]!.layout.width, m.rooms[0]!.layout.height], [0, 0, 7, 3]);
    assert.equal(m.rooms[0]!.outline, undefined);
    assert.deepEqual(m.rooms[0]!.connectors.map((c) => [c.id, c.roomId, c.offset]), [['at', 'a', 1], ['bt', 'a', 5]]);
    assert.deepEqual([m.relationships, m.joints], [[], []]);
    assert.deepEqual(m.objects, [{ roomId: 'a', position: [5, 1] }]);
    assert.deepEqual(m.entityPlacements, [{ roomId: 'a', position: [4.5, 2] }]);
    assert.match(res.message, /1 connection between them removed/);
  });

  it('A 0,0 4x3 + B 4,0 3x2 form an L (corners 0,0 7,0 7,2 4,2 4,3 0,3): size-locked outline; B bottom connector offset 1.5 sits at x=5.5 on the wall y=2 (no wallAt, it is the only wall there); A bottom connector offset 2 stays on y=3', () => {
    const g = two(room('a', 0, 0, 4, 3, [conn('ab', 'a', 'bottom', 2)]), room('b', 4, 0, 3, 2, [conn('bb', 'b', 'bottom', 1.5)]));
    const res = mergeRooms({ graph: g, ids: ['a', 'b'] });
    assert.equal(res.ok, true, res.message);
    const r = res.graph.rooms[0]!;
    assert.deepEqual(r.outline, [[0, 0], [7, 0], [7, 2], [4, 2], [4, 3], [0, 3]]);
    assert.deepEqual([r.layout.width, r.layout.height, r.layout.sizeLocked], [7, 3, true]);
    assert.deepEqual(r.connectors.map((c) => [c.id, c.offset, c.wallAt]), [['ab', 2, undefined], ['bb', 5.5, undefined]]);
    assert.match(res.message, /shaped room/);
  });

  it('a connector on the shared wall without a connection: right connector of A at offset 1 (y=1, facing B, which covers y 0..2) is removed; offset 2.5 (y=2.5, below B) stays on the wall x=4 (the only right wall there, so no wallAt)', () => {
    const g = two(room('a', 0, 0, 4, 3, [conn('hid', 'a', 'right', 1), conn('vis', 'a', 'right', 2.5)]), room('b', 4, 0, 3, 2));
    const res = mergeRooms({ graph: g, ids: ['a', 'b'] });
    assert.equal(res.ok, true, res.message);
    const r = res.graph.rooms[0]!;
    assert.deepEqual(r.connectors.map((c) => [c.id, c.offset, c.wallAt]), [['vis', 2.5, undefined]]);
    assert.match(res.message, /1 connector on the vanished wall removed/);
  });

  it('position lock: A locked at 0,0 and B at -4,0 would start the room at x=-4: refused; with B on the right (4,0) the corner stays and the merged room is position-locked', () => {
    const a = room('a', 0, 0, 4, 3);
    a.layout.positionLocked = true;
    assert.match(mergeRooms({ graph: two(a, room('b', -4, 0, 4, 3)), ids: ['a', 'b'] }).message, /position-locked/);
    const ok = mergeRooms({ graph: two(a, room('b', 4, 0, 3, 3)), ids: ['a', 'b'] });
    assert.equal(ok.ok, true, ok.message);
    assert.equal(ok.graph.rooms[0]!.layout.positionLocked, true);
  });

  it('refusals: apart (B at x=5), overlapping (B at x=3), touching only at the corner (B at 4,3), different floors, the same room twice, one room', () => {
    const a = room('a', 0, 0, 4, 3), bad = (b: TRoom, re: RegExp) => { const r = mergeRooms({ graph: two(a, b), ids: ['a', 'b'] }); assert.equal(r.ok, false); assert.match(r.message, re); };
    bad(room('b', 5, 0, 3, 3), /share part of a wall/);
    bad(room('b', 3, 0, 3, 3), /overlap/);
    bad(room('b', 4, 3, 3, 3), /share part of a wall/);
    const f = room('b', 4, 0, 3, 3);
    f.floor = 'upper';
    bad(f, /different floors/);
    assert.equal(mergeRooms({ graph: two(a, room('b', 4, 0, 3, 3)), ids: ['a', 'a'] }).ok, false);
    assert.equal(mergeRooms({ graph: two(a, room('b', 4, 0, 3, 3)), ids: ['a'] }).ok, false);
  });

  it('the embedded source (as in the editor page) gives the same result as the module', () => {
    const fns = [outlineFromRect, outlineBounds, outlineNormalize, outlineIssues, outlineWalls, outlineWallAt, outlineGrid, outlineOverlapArea, outlineCombine, outlineThin, shapeOfRoom, mergeRooms];
    const embedded = new Function(fns.map((f) => f.toString()).join('\n') + '\nreturn mergeRooms;')() as typeof mergeRooms;
    const g = two(room('a', 0, 0, 4, 3, [conn('ab', 'a', 'bottom', 2)]), room('b', 4, 0, 3, 2, [conn('bb', 'b', 'bottom', 1.5)]));
    assert.deepEqual(embedded({ graph: g, ids: ['a', 'b'] }), mergeRooms({ graph: g, ids: ['a', 'b'] }));
  });
});
