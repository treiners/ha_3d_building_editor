import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveJoints } from '../src/joints.js';
import { planClose } from '../src/walls.js';
import { editorHtml } from '../src/editor.js';
const port = (id, roomId, side) => ({ id, roomId, side, type: 'door', offset: 1.5 });
const room = (id, x, connectors, extra = {}) => ({ id, name: id, sizeCategory: 'medium', connectors, layout: { x, y: 0, width: 4, height: 3, ...extra } });
/** A(0..4) gap 0.6 B(4.6..8.6); door at y 1.5 */
const gapG = (a = {}, b = {}) => ({ rooms: [room('a', 0, [port('ar', 'a', 'right')], a), room('b', 4.6, [port('bl', 'b', 'left')], b)], relationships: [{ id: 'ab', connectorA: 'ar', connectorB: 'bl', importance: 'required' }] });
const close = (g) => planClose({ graph: g, joints: deriveJoints(g).joints, step: 0.2 });
describe('planClose', () => {
    it('gap 0.6: A grows to the right by 0.6 (width 4 -> 4.6), B is untouched', () => {
        const p = close(gapG());
        assert.deepEqual(p.closed, ['ab']);
        assert.deepEqual(p.failed, []);
        assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 4.6, height: 3 } });
    });
    it('A position-locked still grows (its right wall is free); A size-locked is carried: A moves right by 0.6', () => {
        assert.deepEqual(close(gapG({ positionLocked: true })).layouts, { a: { x: 0, y: 0, width: 4.6, height: 3 } });
        assert.deepEqual(close(gapG({ sizeLocked: true })).layouts, { a: { x: 0.6, y: 0, width: 4, height: 3 } });
    });
    it('A cannot grow (already 10 m wide = maximum, x -6..4): B takes over, its left wall moves left by 0.6 (4 -> 4.6 wide)', () => {
        const p = close(gapG({ x: -6, width: 10 }, {}));
        assert.deepEqual(p.closed, ['ab']);
        assert.deepEqual(p.layouts, { b: { x: 4, y: 0, width: 4.6, height: 3 } });
    });
    it('both walls blocked (A max size, B position+size locked): reported in failed, nothing changes', () => {
        const p = close(gapG({ x: -6, width: 10 }, { locked: true }));
        assert.deepEqual(p.closed, []);
        assert.equal(p.failed.length, 1);
        assert.deepEqual(p.layouts, {});
    });
    it('overlapping rooms and joints that are already attached are left alone; result joint touches', () => {
        const g = gapG({ width: 4.6 });
        assert.deepEqual(close(g), { layouts: {}, closed: [], failed: [] });
        const p = close(gapG());
        const g2 = gapG();
        g2.rooms[0].layout = { ...g2.rooms[0].layout, ...p.layouts.a };
        assert.ok(deriveJoints(g2).joints[0].touching);
    });
    it('embedded in the editor HTML with a button', () => { const h = editorHtml({ rooms: [], relationships: [] }); assert.ok(h.includes('function planClose(') && h.includes('id="close-gaps"')); });
});
