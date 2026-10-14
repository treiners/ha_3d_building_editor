import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { planMove } from '../src/moves.js';
import { planWall, planCorner } from '../src/walls.js';

const ref = (): any => JSON.parse(readFileSync(new URL('../../../shared/reference-home-connectors.json', import.meta.url), 'utf8'));
const room = (id: string, x: number, y: number) => ({ id, name: id, sizeCategory: 'medium', connectors: [] as any[], layout: { x, y, width: 4, height: 3 } });
const scene = (...rooms: any[]) => ({ rooms, relationships: [] as any[] }) as any;
const J = (g: any) => deriveJoints(g).joints;

describe('hidden rooms (Outside) do not block by overlap (ignoreIds)', () => {
  it('planMove: A may move 1.0 down through the hidden room below it; a visible room still blocks at contact', () => {
    const g = scene(room('a', 0, 0), room('out', 0, 3));
    const inp = { graph: g, joints: J(g), roomId: 'a', dx: 0, dy: 1, mode: 'slide' as const, step: 0.2 };
    const without = planMove(inp); assert.ok(without.blocked); assert.equal(without.reason, 'overlap'); assert.equal(without.displacements.a!.dy, 0);
    const hidden = planMove({ ...inp, ignoreIds: ['out'] }); assert.ok(!hidden.blocked); assert.equal(hidden.displacements.a!.dy, 1);
  });
  it('planWall: the right wall of A moves +1.0 although a hidden room touches it, and the hidden room is not glued or resized', () => {
    const g = scene(room('a', 0, 0), room('out', 4, 0));
    const inp = { graph: g, joints: J(g), roomId: 'a', side: 'right' as const, delta: 1, step: 0.2, glueTouching: true };
    assert.ok(planWall(inp).layouts.out !== undefined);
    const p = planWall({ ...inp, ignoreIds: ['out'] }); assert.ok(!p.blocked); assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 5, height: 3 } });
    assert.ok(!planWall({ ...inp, glueTouching: false, ignoreIds: ['out'] }).blocked);
  });
  it('planCorner passes it on (br corner +1.0 / +0.6 with a hidden room to the right)', () => {
    const g = scene(room('a', 0, 0), room('out', 4, 0));
    const p = planCorner({ graph: g, joints: J(g), roomId: 'a', corner: 'br', dx: 1, dy: 0.6, step: 0.2, ignoreIds: ['out'] });
    assert.ok(!p.blocked); assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 5, height: 3.6 } });
  });
  it('the editor passes the hidden room ids to every planner', () => {
    const html = editorHtml(ref());
    assert.ok(html.includes('hidden=()=>g.rooms.filter'));
    assert.equal(html.split('ignoreIds:hidden()').length - 1, 7);
  });
});

describe('slideAlong: a blocked move keeps sliding along the obstacle instead of sticking', () => {
  // A (0..4 x 0..3) is dragged by (+3, +3) towards O (4..8 x 2..5): diagonal contact at the first step, so it slides down along O's wall
  const g = scene(room('a', 0, 0), room('o', 4, 2));
  const inp = { graph: g, joints: J(g), roomId: 'a', dx: 3, dy: 3, mode: 'slide' as const, step: 0.2 };
  it('off (default): stops at the start', () => { const p = planMove(inp); assert.ok(p.blocked); assert.deepEqual(p.displacements.a, { dx: 0, dy: 0 }); });
  it('on: x is blocked by O, y is free: A ends at dy = 3.0 (hand-computed: below y=3 it clears O in x), dx = 0', () => {
    const p = planMove({ ...inp, slideAlong: true }); assert.deepEqual(p.displacements.a, { dx: 0, dy: 3 }); assert.ok(p.blocked);
  });
  it('the editor enables it for room drags', () => assert.ok(editorHtml(ref()).includes('slideAlong:true')));
  it('from: a free room dragged around an obstacle keeps its place (hand-computed: from (0,-4) to (8,0) ends exactly there; from the start it would stay stuck)', () => {
    const h = scene(room('a', 0, 0), room('o', 4, 0));
    const base = { graph: h, joints: J(h), roomId: 'a', dx: 8, dy: 0, mode: 'slide' as const, step: 0.2, slideAlong: true };
    assert.deepEqual(planMove(base).displacements.a, { dx: 0, dy: 0 });
    const p = planMove({ ...base, from: { dx: 0, dy: -4 } }); assert.deepEqual(p.displacements.a, { dx: 8, dy: 0 }); assert.ok(!p.blocked);
  });
  it('from is ignored for rooms with attached joints (they are always planned from the start of the drag)', () => {
    const port = (id: string, side: string) => ({ id, roomId: id[0], side, type: 'door', offset: 1.5 });
    const g2 = { rooms: [{ ...room('a', 0, 0), connectors: [port('ar', 'right')] }, { ...room('b', 4, 0), connectors: [port('bl', 'left')] }], relationships: [{ id: 'ab', connectorA: 'ar', connectorB: 'bl', importance: 'required' }] } as any;
    const base = { graph: g2, joints: J(g2), roomId: 'a', dx: 0, dy: 0.6, mode: 'slide' as const, step: 0.2 };
    assert.deepEqual(planMove({ ...base, from: { dx: 0, dy: 5 } }), planMove(base));
  });
  it('the editor passes it on', () => assert.ok(editorHtml(ref()).includes('from:A.lastD')));
});
