import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { wallList, setWallHeights, sharedWallIssues } from '../src/wallheights.js';

const room = (id: string, x: number, y: number, w = 4, h = 3, extra: any = {}): any => ({ id, name: id.toUpperCase(), connectors: [], layout: { x, y, width: w, height: h }, ...extra });
const g0 = (...rooms: any[]): any => ({ rooms, relationships: [], wallAlignments: [] });
const by = (g: any) => new Map(wallList(g).map((w) => [w.id, w]));

describe('wallList', () => {
  it('A (0,0,4x3) and B (4,0,3x3): A:right and B:left are one shared wall (x 4, y 0..3, length 3); the other 6 walls are free', () => {
    const m = by(g0(room('a', 0, 0), room('b', 4, 0)));
    assert.equal(m.size, 8);
    assert.deepEqual(m.get('a:right')!.shared, ['b:left']); assert.deepEqual(m.get('b:left')!.shared, ['a:right']);
    assert.deepEqual(m.get('a:right')!.segs, [{ x1: 4, y1: 0, x2: 4, y2: 3 }]); assert.equal(m.get('a:right')!.length, 3);
    assert.deepEqual([...m.values()].filter((w) => !w.shared.length).map((w) => w.id).sort(), ['a:bottom', 'a:left', 'a:top', 'b:bottom', 'b:right', 'b:top']);
  });
  it('gap 0.05 m (<= 0.08) is still shared; gap 0.2 m is not; walls that only meet at a corner (overlap 0) are not', () => {
    assert.deepEqual(by(g0(room('a', 0, 0), room('b', 4.05, 0))).get('a:right')!.shared, ['b:left']);
    assert.deepEqual(by(g0(room('a', 0, 0), room('b', 4.2, 0))).get('a:right')!.shared, []);
    assert.deepEqual(by(g0(room('a', 0, 0), room('b', 4, 3))).get('a:right')!.shared, []);
  });
  it('shared top / bottom: A (0,0,4x3) above B (0,3,4x2) -> a:bottom + b:top; resolved heights come from wallHeightOf (default 2.4, room 3, wall 3.5)', () => {
    const g = g0(room('a', 0, 0, 4, 3, { wallHeight: 3, wallHeights: { top: 3.5 } }), room('b', 0, 3, 4, 2));
    const m = by(g);
    assert.deepEqual(m.get('a:bottom')!.shared, ['b:top']);
    assert.equal(m.get('a:top')!.height, 3.5); assert.equal(m.get('a:top')!.own, 3.5); assert.equal(m.get('a:left')!.height, 3); assert.equal(m.get('a:left')!.own, null); assert.equal(m.get('b:top')!.height, 2.4);
  });
  it('rooms named Outside are ignored', () => assert.equal(wallList(g0(room('a', 0, 0), room('o', 4, 0, 4, 3, { name: 'Outside' }))).length, 4));
  it('L-shaped room: two segments on the right side belong to ONE wall c:right', () => {
    const c = room('c', 0, 5, 4, 4, { outline: [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]] });
    const w = by(g0(c)).get('c:right')!;
    assert.equal(w.segs.length, 2); assert.equal(w.length, 4);
  });
});

describe('setWallHeights', () => {
  it('shared wall a:right 3.2 -> A.right and B.left both 3.2 ("+1 shared side followed"); input graph unchanged', () => {
    const g = g0(room('a', 0, 0), room('b', 4, 0)), r = setWallHeights({ graph: g, ids: ['a:right'], height: 3.2 });
    assert.ok(r.ok); assert.equal(r.graph.rooms[0].wallHeights.right, 3.2); assert.equal(r.graph.rooms[1].wallHeights.left, 3.2);
    assert.match(r.message, /\(\+1 shared side followed\)/); assert.deepEqual(r.ids, ['a:right', 'b:left']);
    assert.equal(g.rooms[0].wallHeights, undefined);
  });
  it('free wall a:top 2.9 changes only A; 0.5 is clamped to 1, 99 to 10; null / 0 resets and drops the empty object', () => {
    const g = g0(room('a', 0, 0), room('b', 4, 0)), a = setWallHeights({ graph: g, ids: ['a:top'], height: 2.9 });
    assert.deepEqual(a.graph.rooms[0].wallHeights, { top: 2.9 }); assert.equal(a.graph.rooms[1].wallHeights, undefined);
    assert.equal(setWallHeights({ graph: g, ids: ['a:top'], height: 0.5 }).graph.rooms[0].wallHeights.top, 1);
    assert.equal(setWallHeights({ graph: g, ids: ['a:top'], height: 99 }).graph.rooms[0].wallHeights.top, 10);
    assert.equal('wallHeights' in setWallHeights({ graph: a.graph, ids: ['a:top'], height: null }).graph.rooms[0], false);
  });
  it('two selected walls (a:top, a:left) are set together; unknown ids are skipped; only unknown -> not ok', () => {
    const g = g0(room('a', 0, 0)), r = setWallHeights({ graph: g, ids: ['a:top', 'a:left', 'zz:top'], height: 2.7 });
    assert.deepEqual(r.graph.rooms[0].wallHeights, { top: 2.7, left: 2.7 }); assert.match(r.message, /on 2 walls/);
    assert.equal(setWallHeights({ graph: g, ids: ['zz:top'], height: 2.7 }).ok, false);
  });
  it('resetting a shared wall removes the key on both sides but keeps other walls', () => {
    const g = g0(room('a', 0, 0, 4, 3, { wallHeights: { right: 3, top: 2.8 } }), room('b', 4, 0, 3, 3, { wallHeights: { left: 3 } }));
    const r = setWallHeights({ graph: g, ids: ['b:left'], height: null });
    assert.deepEqual(r.graph.rooms[0].wallHeights, { top: 2.8 }); assert.equal('wallHeights' in r.graph.rooms[1], false);
  });
});

describe('sharedWallIssues', () => {
  it('A.right 3 but B.left default 2.4 -> one issue shared-wall-height on a:right; after setWallHeights none', () => {
    const g = g0(room('a', 0, 0, 4, 3, { wallHeights: { right: 3 } }), room('b', 4, 0));
    const i = sharedWallIssues(g);
    assert.deepEqual(i.map((x) => [x.id, x.roomId, x.code]), [['a:right', 'a', 'shared-wall-height']]);
    assert.deepEqual(sharedWallIssues(setWallHeights({ graph: g, ids: ['a:right'], height: 3 }).graph), []);
  });
});
