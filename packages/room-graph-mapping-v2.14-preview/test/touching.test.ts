import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { planWall, planCorner } from '../src/walls.js';
import { planMove } from '../src/moves.js';

const ref = (): any => JSON.parse(readFileSync(new URL('../../../reference-home-connectors.json', import.meta.url), 'utf8'));
const port = (id: string, roomId: string, side: string, offset: number) => ({ id, roomId, side, type: 'door', offset });
const room = (id: string, x: number, y: number, connectors: any[] = [], extra: any = {}) => ({ id, name: id, sizeCategory: 'medium', connectors, layout: { x, y, width: 4, height: 3, ...extra } });
const link = (id: string, a: string, b: string) => ({ id, connectorA: a, connectorB: b, importance: 'required' });
const J = (g: any) => deriveJoints(g).joints;

describe('touching rooms without a relationship (glueTouching)', () => {
  const side = () => ({ rooms: [room('a', 0, 0), room('b', 4, 0)], relationships: [] }) as any;
  it('off (default): an unrelated touching room is an obstacle - the wall cannot move at all', () => {
    const g = side(), p = planWall({ graph: g, joints: J(g), roomId: 'a', side: 'right', delta: 1, step: 0.2 });
    assert.ok(p.blocked); assert.equal(p.delta, 0); assert.equal(p.reason, 'overlap'); assert.deepEqual(p.ids, ['a', 'b']);
  });
  it('on: B follows (hand-computed: A 4->5 wide, B 4->3 wide and starts at 5)', () => {
    const g = side(), p = planWall({ graph: g, joints: J(g), roomId: 'a', side: 'right', delta: 1, step: 0.2, glueTouching: true });
    assert.ok(!p.blocked); assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 5, height: 3 }); assert.deepEqual(p.layouts.b, { x: 5, y: 0, width: 3, height: 3 });
  });
  it('screenshot case: Kitchen above Front Hall, tl corner dragged up 1.0: hall grows to 4 m high, kitchen shrinks to 2 m', () => {
    const g = { rooms: [room('k', 0, 0), room('f', 0, 3)], relationships: [] } as any;
    const inp = { graph: g, joints: J(g), roomId: 'f', corner: 'tl' as const, dx: 0, dy: -1, step: 0.2 };
    const off = planCorner(inp); assert.ok(off.blocked); assert.equal(off.reason, 'overlap'); assert.equal(off.dy, 0);
    const on = planCorner({ ...inp, glueTouching: true }); assert.ok(!on.blocked); assert.equal(on.dy, -1);
    assert.deepEqual(on.layouts.f, { x: 0, y: 2, width: 4, height: 4 }); assert.deepEqual(on.layouts.k, { x: 0, y: 0, width: 4, height: 2 });
  });
  it('a position-locked touching room still stops the wall; rooms that only touch at a corner are ignored', () => {
    const g = { rooms: [room('a', 0, 0), room('b', 4, 0, [], { positionLocked: true }), room('c', 0, 3)], relationships: [] } as any;
    const p = planWall({ graph: g, joints: J(g), roomId: 'a', side: 'right', delta: 1, step: 0.2, glueTouching: true });
    assert.ok(p.blocked); assert.equal(p.reason, 'locked'); assert.deepEqual(p.ids, ['b']);
    const h = { rooms: [room('a', 0, 0), room('d', 4, 3)], relationships: [] } as any;   // diagonal neighbour: no shared wall part
    assert.ok(planWall({ graph: h, joints: J(h), roomId: 'a', side: 'right', delta: 1, step: 0.2, glueTouching: true }).layouts.d === undefined);
  });
  it('a detached/related pair is not glued by this rule (related pairs are handled by their joint state)', () => {
    const g = { rooms: [room('a', 0, 0, [port('ar', 'a', 'right', 1.5)]), room('b', 4, 0, [port('bl', 'b', 'left', 1.5)])], relationships: [link('ab', 'ar', 'bl')], joints: [{ relationshipId: 'ab', state: 'detached' }] } as any;
    const p = planWall({ graph: g, joints: J(g), roomId: 'a', side: 'right', delta: 1, step: 0.2, glueTouching: true });
    assert.ok(p.blocked); assert.equal(p.reason, 'overlap');
  });
});

describe('whole floor plan moves are refused (blockWholePlan)', () => {
  const chain = (withD: boolean) => ({
    rooms: [room('a', 0, 0, [port('ar', 'a', 'right', 1.5)]), room('b', 4, 0, [port('bl', 'b', 'left', 1.5), port('br', 'b', 'right', 1.5)]), room('c', 8, 0, [port('cl', 'c', 'left', 1.5)]), ...(withD ? [room('d', 0, 10)] : [])],
    relationships: [link('ab', 'ar', 'bl'), link('bc', 'br', 'cl')],
  }) as any;
  const plan = (g: any, extra: any = {}) => planMove({ graph: g, joints: J(g), roomId: 'a', dx: 1, dy: 0, mode: 'pull', step: 0.2, ...extra });
  it('default: pulling A across the wall drags A, B and C (all rooms) by 1.0', () => {
    const p = plan(chain(false)); assert.ok(!p.blocked); assert.deepEqual(p.moved, ['a', 'b', 'c']);
  });
  it('blockWholePlan: the same move is stopped before anything moves (reason all)', () => {
    const p = plan(chain(false), { blockWholePlan: true });
    assert.ok(p.blocked); assert.equal(p.reason, 'all'); assert.deepEqual(p.moved, []); assert.match(p.message, /whole floor plan/);
  });
  it('an unattached room D does not count (the floor plan is the largest attached group): A, B, C moving together is still refused', () => {
    const p = plan(chain(true), { blockWholePlan: true }); assert.ok(p.blocked); assert.equal(p.reason, 'all'); assert.deepEqual(p.moved, []);
  });
  it('a separate smaller group may move as a whole: A-B (2 rooms) next to the main plan C-D-E (3 rooms)', () => {
    const g = {
      rooms: [room('a', 0, 20, [port('ar', 'a', 'right', 1.5)]), room('b', 4, 20, [port('bl', 'b', 'left', 1.5)]),
        room('c', 0, 0, [port('cr', 'c', 'right', 1.5)]), room('d', 4, 0, [port('dl', 'd', 'left', 1.5), port('dr', 'd', 'right', 1.5)]), room('e', 8, 0, [port('el', 'e', 'left', 1.5)])],
      relationships: [link('ab', 'ar', 'bl'), link('cd', 'cr', 'dl'), link('de', 'dr', 'el')],
    } as any;
    const p = plan(g, { blockWholePlan: true }); assert.ok(!p.blocked); assert.deepEqual(p.moved, ['a', 'b']);
    assert.equal(planMove({ graph: g, joints: J(g), roomId: 'c', dx: 1, dy: 0, mode: 'pull', step: 0.2, blockWholePlan: true }).reason, 'all');
  });
});

describe('embedded in the editor HTML', () => {
  it('the embedded planners match Node for glueTouching and blockWholePlan', () => {
    const html = editorHtml(ref()), a = html.indexOf('function deriveJoints('), b = html.indexOf('\nfunction applyMap(');
    const emb: any = new Function(html.slice(a, b) + '\nreturn { planWall, planMove };')();
    const g = { rooms: [room('a', 0, 0), room('b', 4, 0)], relationships: [] } as any;
    const w = { graph: g, joints: J(g), roomId: 'a', side: 'right', delta: 1, step: 0.2, glueTouching: true };
    assert.deepEqual(JSON.parse(JSON.stringify(emb.planWall(w))), JSON.parse(JSON.stringify(planWall(w as any))));
    const c = { rooms: [room('a', 0, 0, [port('ar', 'a', 'right', 1.5)]), room('b', 4, 0, [port('bl', 'b', 'left', 1.5)])], relationships: [link('ab', 'ar', 'bl')] } as any;
    const m = { graph: c, joints: J(c), roomId: 'a', dx: 1, dy: 0, mode: 'pull', step: 0.2, blockWholePlan: true };
    assert.deepEqual(JSON.parse(JSON.stringify(emb.planMove(m))), JSON.parse(JSON.stringify(planMove(m as any))));
    assert.ok(html.includes('id="glue-touch"') && html.includes('blockWholePlan:true') && html.includes('$(\'lock-pos\').onchange'));
  });
});
