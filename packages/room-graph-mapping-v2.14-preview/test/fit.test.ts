import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveJoints } from '../src/joints.js';
import { planFit } from '../src/walls.js';
import { editorHtml } from '../src/editor.js';

const room = (id: string, x: number, y: number, extra: any = {}) => ({ id, name: id, sizeCategory: 'medium', connectors: [], layout: { x, y, width: 4, height: 3, ...extra } });
const fit = (g: any, id = 'a', tolerance?: number) => planFit({ graph: g, joints: deriveJoints(g).joints, roomId: id, step: 0.2, tolerance });
const G = (...rooms: any[]): any => ({ rooms, relationships: [] });

describe('planFit (selected room, tolerance 0.3)', () => {
  it('gap 0.2 to B (unrelated): A right wall +0.2 (width 4 -> 4.2); B untouched', () => {
    const p = fit(G(room('a', 0, 0), room('b', 4.2, 0))); assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 4.2, height: 3 } });
    assert.deepEqual(p.applied, [{ side: 'right', kind: 'gap', delta: 0.2 }]); assert.deepEqual(p.failed, []);
  });
  it('overlap 0.1 with B (B at x 3.9): A right wall -0.1 (width 3.9)', () => {
    const p = fit(G(room('a', 0, 0), room('b', 3.9, 0))); assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 3.9, height: 3 } }); assert.equal(p.applied[0]!.kind, 'overlap');
  });
  it('gap 0.5 is beyond the tolerance 0.3: nothing changes; tolerance 0.6 closes it', () => {
    assert.deepEqual(fit(G(room('a', 0, 0), room('b', 4.5, 0))).layouts, {});
    assert.deepEqual(fit(G(room('a', 0, 0), room('b', 4.5, 0)), 'a', 0.6).layouts, { a: { x: 0, y: 0, width: 4.5, height: 3 } });
  });
  it('collinear snap: C below A ends at x 3.9 (A right at 4): A right wall -0.1', () => {
    const c = room('c', 0, 3, { width: 3.9 }); const p = fit(G(room('a', 0, 0), c));
    assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 3.9, height: 3 } }); assert.deepEqual(p.applied, [{ side: 'right', kind: 'align', delta: -0.1 }]);
  });
  it('facing contact wins over collinear snap, and several walls are fitted: left gap 0.1 and bottom gap 0.2', () => {
    const p = fit(G(room('a', 0, 0), room('l', -4.1, 0), room('d', 0, 3.2)));
    assert.deepEqual(p.layouts, { a: { x: -0.1, y: 0, width: 4.1, height: 3.2 } });
    assert.deepEqual(p.applied.map(a => a.side), ['left', 'bottom']);
  });
  it('size-locked A is carried (+0.2); A at maximum size reports the wall as failed and changes nothing', () => {
    assert.deepEqual(fit(G(room('a', 0, 0, { sizeLocked: true }), room('b', 4.2, 0))).layouts, { a: { x: 0.2, y: 0, width: 4, height: 3 } });
    const p = fit(G(room('a', -6, 0, { width: 10 }), room('b', 4.2, 0))); assert.deepEqual(p.layouts, {}); assert.equal(p.failed.length, 1);
  });
  it('flush walls and rooms without shared wall part (diagonal) are left alone', () => {
    assert.deepEqual(fit(G(room('a', 0, 0), room('b', 4, 0))).layouts, {}); assert.deepEqual(fit(G(room('a', 0, 0), room('b', 4.2, 3.1))).layouts, {});
  });
  it('embedded in the editor HTML with a button', () => { const h = editorHtml({ rooms: [], relationships: [] }); assert.ok(h.includes('function planFit(') && h.includes('id="fit-room"')); });
});
