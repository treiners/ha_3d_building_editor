// roomAreas / wallLabels (dimensions.ts): hand-computed scenes, the arithmetic is in the test names.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { roomAreas, wallLabels } from '../src/dimensions.js';
import { shapeOfRoom } from '../src/room-shape.js';
import { outlineFromRect, outlineBounds, outlineArea, outlineNormalize, outlineIssues, outlinePoint, outlineGrid, outlineHasRect, outlineOverlapArea, outlineCombine, outlineWalls, outlineWallAt, outlineLabelRect, outlineNearest, outlineMoveWall, outlineBump, outlineThin } from '../src/shape.js';
import type { Outline } from '../src/shape.js';

interface TR { id: string; name: string; floor?: string; layout: { x: number; y: number; width: number; height: number }; outline?: Outline }
const room = (id: string, x: number, y: number, w: number, h: number, extra: Partial<TR> = {}): TR => ({ id, name: id.toUpperCase(), layout: { x, y, width: w, height: h }, ...extra });
const L: Outline = [[0, 0], [7, 0], [7, 2], [4, 2], [4, 3], [0, 3]];

describe('room areas', () => {
  it('a 4x3 room is 12 m2; an L room 7x3 with the notch x 4..7, y 2..3 is 7*2 + 4*1 = 18 m2; the Outside room and a room without layout are not counted; total 30', () => {
    const g = { rooms: [room('a', 0, 0, 4, 3), room('l', 10, 0, 7, 3, { outline: L }), { id: 'o', name: 'Outside', layout: { x: -9, y: -9, width: 99, height: 99 } }, { id: 'n', name: 'N' }] };
    const a = roomAreas(g);
    assert.deepEqual(a.rooms.map((r) => [r.id, r.area]), [['a', 12], ['l', 18]]);
    assert.equal(a.total, 30);
    assert.deepEqual(a.floors, [{ floor: '', name: 'Floor', area: 30, count: 2 }]);
  });

  it('per floor in the order of the floors list: ground 12 + 18 = 30 (2 rooms), upper 3x3 = 9; total 39', () => {
    const g = { floors: [{ id: 'g', name: 'Ground' }, { id: 'u', name: 'Upper' }], rooms: [room('a', 0, 0, 4, 3, { floor: 'g' }), room('l', 10, 0, 7, 3, { outline: L, floor: 'g' }), room('c', 0, 0, 3, 3, { floor: 'u' })] };
    const a = roomAreas(g);
    assert.deepEqual(a.floors.map((f) => [f.name, f.area, f.count]), [['Ground', 30, 2], ['Upper', 9, 1]]);
    assert.equal(a.total, 39);
  });
});

describe('wall labels', () => {
  it('room 10,20 4x3: top wall midpoint (12,20) length 4, right (14,21.5) 3, bottom (12,23) 4, left (10,21.5) 3', () => {
    assert.deepEqual(wallLabels(room('a', 10, 20, 4, 3)), [
      { x: 12, y: 20, length: 4, side: 'top' }, { x: 14, y: 21.5, length: 3, side: 'right' }, { x: 12, y: 23, length: 4, side: 'bottom' }, { x: 10, y: 21.5, length: 3, side: 'left' },
    ]);
  });

  it('the L room at 0,0: six walls of 7, 2, 3, 1, 4, 3 m; with a minimum length of 1.5 m the 1 m step is left out', () => {
    assert.deepEqual(wallLabels(room('l', 0, 0, 7, 3, { outline: L })).map((w) => w.length), [7, 2, 3, 1, 4, 3]);
    assert.deepEqual(wallLabels(room('l', 0, 0, 7, 3, { outline: L }), 1.5).map((w) => w.length), [7, 2, 3, 4, 3]);
  });

  it('the embedded source (as in the editor page) gives the same results as the module', () => {
    const fns = [outlineFromRect, outlineBounds, outlineArea, outlineNormalize, outlineIssues, outlinePoint, outlineGrid, outlineHasRect, outlineOverlapArea, outlineCombine, outlineWalls, outlineWallAt, outlineLabelRect, outlineNearest, outlineMoveWall, outlineBump, outlineThin, shapeOfRoom, roomAreas, wallLabels];
    const E = new Function(fns.map((f) => f.toString()).join('\n') + '\nreturn { roomAreas, wallLabels };')() as { roomAreas: typeof roomAreas; wallLabels: typeof wallLabels };
    const g = { rooms: [room('a', 0, 0, 4, 3), room('l', 10, 0, 7, 3, { outline: L })] };
    assert.deepEqual(E.roomAreas(g), roomAreas(g));
    assert.deepEqual(E.wallLabels(g.rooms[1]!), wallLabels(g.rooms[1]!));
  });
});
