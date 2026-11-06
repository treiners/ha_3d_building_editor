import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planWall, planCorner } from '../src/walls.js';
import { deriveJoints } from '../src/joints.js';

const scene = (): any => ({ rooms: [{ id: 'a', name: 'A', connectors: [], sizeCategory: 'medium', layout: { x: 0, y: 0, width: 4, height: 3 } }], relationships: [] });
const joints = (g: any) => deriveJoints({ rooms: g.rooms, relationships: g.relationships, joints: g.joints }).joints;

describe('a room can be dragged into the notch of a shaped neighbour', () => {
  const L = { id: 'l', name: 'L', connectors: [], sizeCategory: 'medium', layout: { x: 0, y: 0, width: 4, height: 4 }, outline: [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]] };
  const at = (x: number): any => ({ rooms: [L, { id: 'n', name: 'N', connectors: [], sizeCategory: 'medium', layout: { x, y: 4, width: 2, height: 2 } }], relationships: [] });
  it('notch x 2..4, y 2..4; N (x 2.5..4.5) below the box: top wall -2.6 stops at -2 (y 2, the notch top; the box bottom y 4 would stop at 0), reason overlap', () => {
    const g = at(2.5), p = planWall({ graph: g, joints: joints(g), roomId: 'n', side: 'top', delta: -2.6, step: 0.2 });
    assert.equal(p.delta, -2); assert.equal(p.reason, 'overlap'); assert.deepEqual(p.layouts.n, { x: 2.5, y: 2, width: 2, height: 4 });
  });
  it('N under the body part (x 0.5..2.5 overlaps the box column x < 2): top wall cannot move up at all', () => {
    const g = at(0.5), p = planWall({ graph: g, joints: joints(g), roomId: 'n', side: 'top', delta: -1, step: 0.2 });
    assert.equal(p.delta, 0); assert.equal(p.reason, 'overlap');
  });
  it('inside the notch (N top y 2.4, x 2.5..4.5): left wall -1.5 stops at x 2.1 (grid steps of 0.2 from 2.5; the body edge is x 2), not at the box edge x 4', () => {
    const g = at(2.5); g.rooms[1].layout = { x: 2.5, y: 2.4, width: 2, height: 3 };
    const p = planWall({ graph: g, joints: joints(g), roomId: 'n', side: 'left', delta: -1.5, step: 0.2 });
    assert.equal(p.delta, -0.4); assert.equal(p.reason, 'overlap'); assert.equal(p.layouts.n!.x, 2.1);
  });
  it('U-shaped room (notch x 2..4, y 2..4, open at the bottom) and room 2 (x 2.2..3.8) under its box edge: with glueTouching the U is NOT pulled; room 2 top -1 enters the notch (y 3), only r2 changes', () => {
    const u = { id: 'u', name: 'U', connectors: [], sizeCategory: 'medium', layout: { x: 0, y: 0, width: 6, height: 4 }, outline: [[0, 0], [6, 0], [6, 4], [4, 4], [4, 2], [2, 2], [2, 4], [0, 4]] };
    const g: any = { rooms: [u, { id: 'r2', name: 'R2', connectors: [], sizeCategory: 'medium', layout: { x: 2.2, y: 4, width: 1.6, height: 2 } }], relationships: [] };
    const p = planWall({ graph: g, joints: joints(g), roomId: 'r2', side: 'top', delta: -1, step: 0.2, glueTouching: true });
    assert.equal(p.blocked, false); assert.deepEqual(Object.keys(p.layouts), ['r2']); assert.deepEqual(p.layouts.r2, { x: 2.2, y: 3, width: 1.6, height: 3 });
  });
});

describe('the dragged room is not pushed by its own minimum size', () => {
  it('medium room 4 x 3 alone, minimum width max(1, 4 * 0.5) = 2: dragging the right wall by -3 stops at -2 (width 2), x stays 0, reason min', () => {
    const g = scene(), p = planWall({ graph: g, joints: joints(g), roomId: 'a', side: 'right', delta: -3, step: 0.2 });
    assert.equal(p.blocked, true); assert.equal(p.reason, 'min'); assert.equal(p.delta, -2);
    assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 2, height: 3 });
  });
  it('left wall dragged by +3 stops at +2: x 2, width 2 (right wall stays at 4)', () => {
    const g = scene(), p = planWall({ graph: g, joints: joints(g), roomId: 'a', side: 'left', delta: 3, step: 0.2 });
    assert.equal(p.reason, 'min'); assert.deepEqual(p.layouts.a, { x: 2, y: 0, width: 2, height: 3 });
  });
  it('bottom-right corner dragged by (-3, -2): width 2 (min, exact), height 3 - 1.4 = 1.6 (grid steps of 0.2: 1.8 would be 1.2 < min 1.5); the room does not move', () => {
    const g = scene(), p = planCorner({ graph: g, joints: joints(g), roomId: 'a', corner: 'br', dx: -3, dy: -2, step: 0.2 });
    assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 2, height: 1.6 }); assert.equal(p.blocked, true);
  });
});
