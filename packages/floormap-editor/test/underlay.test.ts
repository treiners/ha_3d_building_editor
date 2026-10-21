import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { underlayInit, underlayScale } from '../src/underlay.js';

describe('underlay', () => {
  it('init: view 20 x 10 at (0,0), image 800 x 400: width 0.8 * 20 = 16, height 16 * 400 / 800 = 8, centred at (2, 1)', () => {
    assert.deepEqual(underlayInit({ x: 0, y: 0, w: 20, h: 10 }, 800, 400), { x: 2, y: 1, w: 16, h: 8 });
  });
  it('scale: image (0,0,10,5), clicks (2,1) and (6,1) are 4 apart, real distance 8: factor 2 about (2,1) gives x = 2 + (0 - 2) * 2 = -2, y = 1 + (0 - 1) * 2 = -1, 20 x 10', () => {
    assert.deepEqual(underlayScale({ x: 0, y: 0, w: 10, h: 5 }, { x: 2, y: 1 }, { x: 6, y: 1 }, 8), { x: -2, y: -1, w: 20, h: 10 });
  });
  it('scale: the clicked first point stays where it is; the two clicks end up exactly `real` apart (3-4-5 triangle, real 10: factor 2)', () => {
    const u = { x: 1, y: 1, w: 6, h: 4 }, p1 = { x: 3, y: 2 }, p2 = { x: 6, y: 6 }, r = underlayScale(u, p1, p2, 10);
    assert.deepEqual(r, { x: -1, y: 0, w: 12, h: 8 });
    const m = (p: any) => ({ x: (p.x - u.x) / u.w, y: (p.y - u.y) / u.h }), q = (p: any) => ({ x: r.x + m(p).x * r.w, y: r.y + m(p).y * r.h });
    assert.deepEqual(q(p1), p1); assert.equal(Math.hypot(q(p2).x - q(p1).x, q(p2).y - q(p1).y), 10);
  });
  it('invalid input (same point, zero or negative distance) leaves the image unchanged', () => {
    const u = { x: 0, y: 0, w: 4, h: 3 };
    assert.equal(underlayScale(u, { x: 1, y: 1 }, { x: 1, y: 1 }, 5), u); assert.equal(underlayScale(u, { x: 0, y: 0 }, { x: 1, y: 0 }, 0), u); assert.equal(underlayScale(u, { x: 0, y: 0 }, { x: 1, y: 0 }, -2), u);
  });
  it('embedded source evaluates and matches Node', () => {
    const E: any = new Function(underlayInit.toString() + '\n' + underlayScale.toString() + '\nreturn { underlayInit, underlayScale };')();
    assert.deepEqual(E.underlayScale({ x: 0, y: 0, w: 10, h: 5 }, { x: 2, y: 1 }, { x: 6, y: 1 }, 8), underlayScale({ x: 0, y: 0, w: 10, h: 5 }, { x: 2, y: 1 }, { x: 6, y: 1 }, 8));
  });
});
