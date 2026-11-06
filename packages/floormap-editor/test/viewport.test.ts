import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { viewGesture } from '../src/viewport.js';

const V = { x: 0, y: 0, w: 20, h: 10 }, C = { x: 500, y: 250 };

describe('viewGesture', () => {
  it('no movement, k 1 -> same view', () => assert.deepEqual(viewGesture({ view: V, scale: 50, centre: C, from: { x: 300, y: 100 }, to: { x: 300, y: 100 } }), V));
  it('pan: finger +100 px right at 50 px/m -> view moves 2 m left: x 0 - 2 = -2', () => assert.deepEqual(viewGesture({ view: V, scale: 50, centre: C, from: C, to: { x: 600, y: 250 } }), { x: -2, y: 0, w: 20, h: 10 }));
  it('pan: finger 50 px up -> view moves 1 m down: y 0 + 1 = 1', () => assert.deepEqual(viewGesture({ view: V, scale: 50, centre: C, from: C, to: { x: 500, y: 200 } }), { x: 0, y: 1, w: 20, h: 10 }));
  it('zoom x2 at the centre: width 20 / 2 = 10, height 5, x = 10 - 5 = 5, y = 5 - 2.5 = 2.5', () => assert.deepEqual(viewGesture({ view: V, scale: 50, centre: C, from: C, to: C, k: 2 }), { x: 5, y: 2.5, w: 10, h: 5 }));
  it('zoom x2 at the right edge keeps that point fixed: world x 20 stays at 1000 px -> x = 15 - 5 = 10', () => assert.deepEqual(viewGesture({ view: V, scale: 50, centre: C, from: { x: 1000, y: 250 }, to: { x: 1000, y: 250 }, k: 2 }), { x: 10, y: 2.5, w: 10, h: 5 }));
  it('zoom limits: k 100 -> width 1 (height 0.5), k 0.01 -> width 500 (height 250)', () => {
    assert.deepEqual(viewGesture({ view: V, scale: 50, centre: C, from: C, to: C, k: 100 }).w, 1);
    const o = viewGesture({ view: V, scale: 50, centre: C, from: C, to: C, k: 0.01 });
    assert.equal(o.w, 500); assert.equal(o.h, 250);
  });
  it('invalid k (0, NaN, negative) is treated as 1', () => { for (const k of [0, NaN, -2]) assert.deepEqual(viewGesture({ view: V, scale: 50, centre: C, from: C, to: C, k }), V); });
});
