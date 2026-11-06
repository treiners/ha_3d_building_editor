// Wall dragging next to shaped rooms and doors close to a wall end (regression from a real plan): the toilet / bathroom wall could not be dragged.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planWall } from '../src/walls.js';
import { deriveJoints } from '../src/joints.js';

const door = (id: string, side: string, offset: number) => ({ id, side, offset, width: 0.9 });
const rooms = [
  { id: 'hall', name: 'hall', layout: { x: 4.1, y: 9.3, width: 1.15, height: 1.8 }, connectors: [door('hall-right-door', 'right', 0.9)] },
  { id: 'toilet', name: 'toilet', layout: { x: 5.25, y: 9.3, width: 1.05, height: 1.8 }, connectors: [door('toilet-left-door', 'left', 0.9)] },
  { id: 'bathroom', name: 'bathroom', layout: { x: 6.3, y: 9.3, width: 3.85, height: 1.8 }, connectors: [door('bathroom-bottom-door', 'bottom', 0.5381)] },
  {
    id: 'bedroom', name: 'bedroom', layout: { x: 1.6, y: 11.1, width: 4.7, height: 3.4, sizeLocked: true },
    outline: [[0, 0], [4.1, 0], [4.1, 1.2], [4.7, 1.2], [4.7, 3.4], [0, 3.4]], connectors: [door('bedroom-right-door', 'right', 0.5503)],
  },
  {
    id: 'front-bedroom', name: 'front bedroom', layout: { x: 5.7, y: 11.1, width: 4.45, height: 3.4, sizeLocked: true },
    outline: [[0, 0], [4.45, 0], [4.45, 3.4], [0.6, 3.4], [0.6, 1.2], [0, 1.2]], connectors: [door('front-bedroom-top-door', 'top', 1.1381), door('front-bedroom-left-door', 'left', 0.5503)],
  },
];
const relationships = [
  { id: 'l1', connectorA: 'toilet-left-door', connectorB: 'hall-right-door' },
  { id: 'l2', connectorA: 'bathroom-bottom-door', connectorB: 'front-bedroom-top-door' },
  { id: 'l3', connectorA: 'front-bedroom-left-door', connectorB: 'bedroom-right-door' },
];
const graph = { rooms, relationships } as unknown as Parameters<typeof planWall>[0]['graph'];
for (const r of rooms) for (const c of r.connectors) Object.assign(c, { roomId: r.id, type: 'door' });
const input = { graph, joints: deriveJoints(graph).joints, roomId: 'toilet', side: 'right' as const, delta: 0.2, step: 0.2, noOverlap: true, glueTouching: true };

describe('wall next to a door and shaped rooms', () => {
  it('the three joints are ok (the two bedrooms interlock: their bounding boxes overlap by 0.6 m)', () => {
    assert.deepEqual(deriveJoints(graph).joints.map((j) => j.status), ['ok', 'ok', 'ok']);
  });

  it('toilet right wall +0.2: the bathroom door (centre 6.8381, 0.9 wide, so from 6.3881) would be cut off by the bathroom wall at 6.5 -> blocked "opening" by default', () => {
    const p = planWall(input);
    assert.deepEqual([p.blocked, p.reason, p.ids.sort()], [true, 'opening', ['bathroom', 'front-bedroom']]);
  });

  it('with slideOpenings the door slides inside: bathroom x 6.5 width 3.65, toilet width 1.25, the door centre 6.5 + 0.45 = 6.95; the interlocking bedrooms are not touched', () => {
    const p = planWall({ ...input, slideOpenings: true });
    assert.equal(p.blocked, false, p.reason + ' ' + p.ids.join(','));
    assert.equal(p.delta, 0.2);
    assert.deepEqual(Object.keys(p.layouts).sort(), ['bathroom', 'toilet']);
    assert.deepEqual([p.layouts.bathroom!.x, p.layouts.bathroom!.width, p.layouts.toilet!.width], [6.5, 3.65, 1.25]);
    const o = p.openings.find((x) => x.connectorA === 'bathroom-bottom-door' || x.connectorB === 'bathroom-bottom-door')!;
    assert.equal(o.world, 6.95);
  });
});

describe('min and max room size settings', () => {
  const one = { rooms: [{ id: 'a', name: 'a', layout: { x: 0, y: 0, width: 4, height: 3, positionLocked: true }, connectors: [] }], relationships: [] } as unknown as Parameters<typeof planWall>[0]['graph'];
  const plan = (delta: number, extra: { minSize?: number; maxSize?: number } = {}) => planWall({ graph: one, joints: [], roomId: 'a', side: 'right', delta, step: 0.5, noOverlap: true, ...extra });
  it('a medium room is 4 m wide and position-locked (otherwise it would be pushed along at its minimum): its right wall stops at the minimum 50% of 4 m = 2 m (delta -2) and at the maximum 250% = 10 m (delta +6); minSize 1 allows delta -3 (width 1), maxSize 6 stops at delta +2', () => {
    assert.equal(plan(-3).delta, -2);
    assert.equal(plan(8).delta, 6);
    assert.equal(plan(-3, { minSize: 1 }).delta, -3);
    assert.equal(plan(5, { maxSize: 6 }).delta, 2);
  });
});
