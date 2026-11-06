// Shaped areas (area-shape.ts): reshape, wall moves, bumps / notches and merging; hand-computed scenes, the arithmetic is in the test names.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { areaOutlineOf, reshapeArea, moveAreaWall, pullAreaWall, mergeAreas } from '../src/area-shape.js';
import type { AreaShapeGraph } from '../src/area-shape.js';
import { validateAreas, areaAt, updateArea } from '../src/areas.js';
import { outlineFromRect, outlineBounds, outlineNormalize, outlineIssues, outlineWalls, outlineGrid, outlineCombine, outlineThin, outlineMoveWall, outlineBump } from '../src/shape.js';
import type { Outline } from '../src/shape.js';

interface TA { id: string; name: string; kind: string; shape?: string; roofed?: boolean; layout: { x: number; y: number; width: number; height: number }; outline?: Outline }
interface TG extends AreaShapeGraph { areas: TA[]; entityPlacements?: { id: string; areaId?: string; position?: number[] }[] }

const area = (id: string, kind: string, x: number, y: number, w: number, h: number, extra: Partial<TA> = {}): TA => ({ id, name: id.toUpperCase(), kind, shape: 'rect', layout: { x, y, width: w, height: h }, ...extra });
const gr = (...areas: TA[]): TG => ({ areas });

describe('shaped areas', () => {
  it('merge: deck A 0,0 4x3 + deck B 4,0 3x2 form an L (0,0 7,0 7,2 4,2 4,3 0,3), layout 7x3; the entity in B at [1,1] moves to 4+1=5 -> [5,1] in A; B disappears', () => {
    const g = gr(area('a', 'deck', 0, 0, 4, 3), area('b', 'deck', 4, 0, 3, 2));
    g.entityPlacements = [{ id: 'e', areaId: 'b', position: [1, 1] }];
    const before = JSON.stringify(g), res = mergeAreas({ graph: g, ids: ['a', 'b'] });
    assert.equal(JSON.stringify(g), before, 'input not changed');
    assert.equal(res.ok, true, res.message);
    assert.equal(res.graph.areas.length, 1);
    const a = res.graph.areas[0]!;
    assert.deepEqual(a.outline, [[0, 0], [7, 0], [7, 2], [4, 2], [4, 3], [0, 3]]);
    assert.deepEqual([a.layout.x, a.layout.y, a.layout.width, a.layout.height], [0, 0, 7, 3]);
    assert.deepEqual(res.graph.entityPlacements, [{ id: 'e', areaId: 'a', position: [5, 1] }]);
    assert.match(res.message, /shaped area/);
  });

  it('merge: overlapping decks 0,0 4x3 and 3,0 4x3 give the rectangle 7x3 without outline', () => {
    const res = mergeAreas({ graph: gr(area('a', 'deck', 0, 0, 4, 3), area('b', 'deck', 3, 0, 4, 3)), ids: ['a', 'b'] });
    assert.equal(res.ok, true, res.message);
    assert.equal(res.graph.areas[0]!.outline, undefined);
    assert.equal(res.graph.areas[0]!.layout.width, 7);
  });

  it('merge refusals: other kind, roofed with open, an ellipse, apart (B at x=5), the same area twice', () => {
    const a = area('a', 'deck', 0, 0, 4, 3), bad = (b: TA, re: RegExp) => { const r = mergeAreas({ graph: gr(a, b), ids: ['a', 'b'] }); assert.equal(r.ok, false); assert.match(r.message, re); };
    bad(area('b', 'path', 4, 0, 3, 3), /same kind/);
    bad(area('b', 'deck', 4, 0, 3, 3, { roofed: true }), /roofed and an open/);
    bad(area('b', 'deck', 4, 0, 3, 3, { shape: 'ellipse' }), /Ellipses/);
    bad(area('b', 'deck', 5, 0, 3, 3), /share part of an edge/);
    assert.equal(mergeAreas({ graph: gr(a), ids: ['a', 'a'] }).ok, false);
    const r1 = area('r1', 'deck', 0, 0, 4, 3, { roofed: true }), r2 = area('r2', 'deck', 4, 0, 3, 3, { roofed: true });
    assert.equal(mergeAreas({ graph: gr(r1, r2), ids: ['r1', 'r2'] }).ok, true, 'two roofed decks merge');
  });

  it('wall move: the right wall (index 1) of 0,0 4x3 moved out by 1 gives width 5; the left wall (index 3) moved out by 1 gives x=-1, width 5 and the entity at [1,1] becomes [2,1]', () => {
    const g = gr(area('a', 'deck', 0, 0, 4, 3));
    g.entityPlacements = [{ id: 'e', areaId: 'a', position: [1, 1] }];
    const r = moveAreaWall({ graph: g, id: 'a', wall: 1, delta: 1 });
    assert.deepEqual([r.ok, r.graph.areas[0]!.layout.width, r.graph.areas[0]!.outline], [true, 5, undefined]);
    const l = moveAreaWall({ graph: g, id: 'a', wall: 3, delta: 1 });
    assert.deepEqual([l.graph.areas[0]!.layout.x, l.graph.areas[0]!.layout.width], [-1, 5]);
    assert.deepEqual(l.graph.entityPlacements, [{ id: 'e', areaId: 'a', position: [2, 1] }]);
  });

  it('notch: 1 m wide, 1 m deep at x=3 in the bottom wall (index 2) of 0,0 4x3 gives corners 0,0 4,0 4,3 3.5,3 3.5,2 2.5,2 2.5,3 0,3; "Make rectangle" (outline null) restores the box', () => {
    const g = gr(area('a', 'deck', 0, 0, 4, 3)), r = pullAreaWall({ graph: g, id: 'a', wall: 2, center: 3, width: 1, depth: -1 });
    assert.equal(r.ok, true, r.message);
    assert.deepEqual(r.graph.areas[0]!.outline, [[0, 0], [4, 0], [4, 3], [3.5, 3], [3.5, 2], [2.5, 2], [2.5, 3], [0, 3]]);
    const u = updateArea({ graph: r.graph, id: 'a', patch: { outline: null } });
    assert.equal(u.graph.areas[0].outline, undefined);
    assert.equal(updateArea({ graph: r.graph, id: 'a', patch: { width: 6 } }).ok, false, 'a shaped area is resized by its walls');
  });

  it('refusals: an ellipse cannot be shaped; a wall move that makes a part thinner than 0.3 m is refused', () => {
    assert.equal(moveAreaWall({ graph: gr(area('p', 'pond', 0, 0, 3, 2, { shape: 'ellipse' })), id: 'p', wall: 0, delta: 1 }).ok, false);
    const g = gr(area('a', 'deck', 0, 0, 4, 3)), notch = pullAreaWall({ graph: g, id: 'a', wall: 2, center: 3, width: 1, depth: -2.8 });
    assert.equal(notch.ok, false);
  });

  it('shaped area hit test: the L of 0,0 4x3 + 4,0 3x2 has a notch at x 4..7, y 2..3: areaAt(5,2.5) finds nothing, areaAt(5,1) and areaAt(1,2.5) find the deck', () => {
    const g = mergeAreas({ graph: gr(area('a', 'deck', 0, 0, 4, 3), area('b', 'deck', 4, 0, 3, 2)), ids: ['a', 'b'] }).graph;
    assert.equal(areaAt(g, 5, 2.5), null);
    assert.equal(areaAt(g, 5, 1)!.id, 'a');
    assert.equal(areaAt(g, 1, 2.5)!.id, 'a');
  });

  it('room check on the real shape: room 0,0 4x1; an area with its top-left block missing (corners 1,0 4,0 4,3 0,3 0,1 1,1 in a 4x3 box at x=3) leaves the room corner free -> no warning; moving it to x=2 makes it overlap', () => {
    const outline: Outline = [[1, 0], [4, 0], [4, 3], [0, 3], [0, 1], [1, 1]];
    const mk = (x: number): { rooms: unknown[]; areas: TA[] } => ({ rooms: [{ id: 'r', name: 'R', layout: { x: 0, y: 0, width: 4, height: 1 }, connectors: [] }], areas: [area('d', 'deck', x, 0, 4, 3, { outline })] });
    assert.deepEqual(validateAreas(mk(3)), []);
    assert.deepEqual(validateAreas(mk(2)).map((i) => i.code), ['overlaps-room']);
  });

  it('tree kind: species "  Jacaranda " is stored trimmed as "Jacaranda" on a tree; an empty text removes it; it is cut at 40 characters', () => {
    const g = gr(area('t', 'tree', 3, 3, 3, 3, { shape: 'ellipse' }));
    const a = updateArea({ graph: g, id: 't', patch: { species: '  Jacaranda ' } });
    assert.equal(a.ok, true, a.message);
    assert.equal(a.graph.areas[0].species, 'Jacaranda');
    assert.equal(updateArea({ graph: a.graph, id: 't', patch: { species: '   ' } }).graph.areas[0].species, undefined);
    assert.equal(updateArea({ graph: g, id: 't', patch: { species: 'x'.repeat(60) } }).graph.areas[0].species.length, 40);
  });

  it('the embedded source (as in the editor page) gives the same results as the module', () => {
    const fns = [outlineFromRect, outlineBounds, outlineNormalize, outlineIssues, outlineWalls, outlineGrid, outlineCombine, outlineThin, outlineMoveWall, outlineBump, areaOutlineOf, reshapeArea, moveAreaWall, pullAreaWall, mergeAreas];
    const E = new Function(fns.map((f) => f.toString()).join('\n') + '\nreturn { mergeAreas, pullAreaWall, moveAreaWall };')() as { mergeAreas: typeof mergeAreas; pullAreaWall: typeof pullAreaWall; moveAreaWall: typeof moveAreaWall };
    const g = gr(area('a', 'deck', 0, 0, 4, 3), area('b', 'deck', 4, 0, 3, 2));
    assert.deepEqual(E.mergeAreas({ graph: g, ids: ['a', 'b'] }), mergeAreas({ graph: g, ids: ['a', 'b'] }));
    const h = gr(area('a', 'deck', 0, 0, 4, 3));
    assert.deepEqual(E.pullAreaWall({ graph: h, id: 'a', wall: 2, center: 3, width: 1, depth: -1 }), pullAreaWall({ graph: h, id: 'a', wall: 2, center: 3, width: 1, depth: -1 }));
    assert.deepEqual(E.moveAreaWall({ graph: h, id: 'a', wall: 1, delta: 1 }), moveAreaWall({ graph: h, id: 'a', wall: 1, delta: 1 }));
  });
});
