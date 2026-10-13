import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { doorGeometry, doorAngle, mirrorDoor } from '../src/door.js';
import { editorHtml } from '../src/editor.js';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-3, a + ' vs ' + b);
const spec = (o: any = {}) => ({ hinge: 'left' as const, swing: 'inward' as const, openAngle: 90, ...o });

describe('door symbol', () => {
  it('top wall, P (2,0), w 0.9, hinge left (screen left), inward, 90 deg: H (1.55,0), J (2.45,0), E (1.55,0.9)', () => {
    const g = doorGeometry('top', { x: 2, y: 0 }, 0.9, spec()); assert.deepEqual([g.H, g.J, g.E], [{ x: 1.55, y: 0 }, { x: 2.45, y: 0 }, { x: 1.55, y: 0.9 }]);
  });
  it('open angle 85: E = H + (0.9 cos85, 0.9 sin85)', () => {
    const g = doorGeometry('top', { x: 2, y: 0 }, 0.9, spec({ openAngle: 85 })); near(g.E.x, 1.55 + 0.9 * Math.cos(85 * Math.PI / 180)); near(g.E.y, 0.9 * Math.sin(85 * Math.PI / 180));
  });
  it('hinge right moves H to the other jamb; outward swings to the other side of the wall', () => {
    const g = doorGeometry('top', { x: 2, y: 0 }, 0.9, spec({ hinge: 'right', swing: 'outward' })); assert.deepEqual([g.H, g.J, g.E], [{ x: 2.45, y: 0 }, { x: 1.55, y: 0 }, { x: 2.45, y: -0.9 }]);
  });
  it('bottom wall: hinge left is screen right; left wall: hinge left is down; right wall: hinge left is up', () => {
    assert.deepEqual(doorGeometry('bottom', { x: 2, y: 3 }, 1, spec()).H, { x: 2.5, y: 3 });
    assert.deepEqual(doorGeometry('left', { x: 0, y: 1 }, 1, spec()).H, { x: 0, y: 1.5 });
    assert.deepEqual(doorGeometry('right', { x: 4, y: 1 }, 1, spec()).H, { x: 4, y: 0.5 });
  });
  it('angle is clamped to 10..180 and the arc starts at the free jamb', () => {
    const g = doorGeometry('top', { x: 2, y: 0 }, 0.9, spec({ openAngle: 400 })); near(g.E.x, 1.55 - 0.9); near(g.E.y, 0);
    assert.ok(doorGeometry('top', { x: 2, y: 0 }, 0.9, spec()).path.startsWith('M1.55 0L2.45 0A0.9 0.9 0 0 '));
  });
  it('dragging the leaf end gives the angle (rounded to 5, clamped): (1.55,0.9)->90, (2.0,0.5)->50, behind the wall->10, far side->170', () => {
    const P = { x: 2, y: 0 }, a = (Q: any) => doorAngle('top', P, 0.9, spec(), Q);
    assert.equal(a({ x: 1.55, y: 0.9 }), 90); assert.equal(a({ x: 2.0, y: 0.5 }), 50); assert.equal(a({ x: 2.4, y: -1 }), 10); assert.equal(a({ x: 0.5, y: 0.2 }), 170);
  });
  it('mirror: the partner connector sees hinge and swing flipped, same angle', () => {
    assert.deepEqual(mirrorDoor({ hinge: 'left', swing: 'inward', openAngle: 85 }), { hinge: 'right', swing: 'outward', openAngle: 85 });
    const a = doorGeometry('right', { x: 4, y: 1.5 }, 0.9, spec({ openAngle: 85 })), b = doorGeometry('left', { x: 4, y: 1.5 }, 0.9, mirrorDoor(spec({ openAngle: 85 })));
    near(a.H.x, b.H.x); near(a.H.y, b.H.y); near(a.E.x, b.E.x); near(a.E.y, b.E.y);
  });
  it('embedded in the editor HTML', () => { const h = editorHtml({ rooms: [], relationships: [] }); assert.ok(h.includes('function doorGeometry(') && h.includes('function mirrorDoor(') && h.includes('data-swing')); });
});
