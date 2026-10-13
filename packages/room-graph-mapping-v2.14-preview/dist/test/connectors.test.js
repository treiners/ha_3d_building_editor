import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { planWall } from '../src/walls.js';
import { connectRooms, addRoom } from '../src/edit.js';
import { mapLayout } from '../src/mapper.js';
const ref = () => JSON.parse(readFileSync(new URL('../../../reference-home-connectors.json', import.meta.url), 'utf8'));
const port = (id, roomId, side, extra = {}) => ({ id, roomId, side, type: 'door', offset: 1.5, ...extra });
const room = (id, x, y, connectors, h = 3) => ({ id, name: id, sizeCategory: 'medium', connectors, layout: { x, y, width: 4, height: h } });
/** A(0,0) | B(4,0), both 4x3, door at y = 1.5; widths set on the connectors */
const pair = (wa, wb) => ({
    rooms: [room('a', 0, 0, [port('ar', 'a', 'right', wa ? { width: wa } : {})]), room('b', 4, 0, [port('bl', 'b', 'left', wb ? { width: wb } : {})])],
    relationships: [{ id: 'ab', connectorA: 'ar', connectorB: 'bl', importance: 'required' }],
});
const J = (g) => deriveJoints(g).joints[0];
describe('connector width', () => {
    it('default door is 0.9 m; slide range of B = [0+1.0-3, 3-1.0-0] = [-2, 2]', () => {
        assert.equal(J(pair()).openingWidth, 0.9);
        assert.deepEqual([J(pair()).slide.min, J(pair()).slide.max], [-2, 2]);
    });
    it('width 2.0 on one connector wins (max of both): need 2.1, slide [-0.9, 0.9]; width on either side gives the same', () => {
        for (const g of [pair(2), pair(undefined, 2), pair(2, 1)]) {
            assert.equal(J(g).openingWidth, 2);
            assert.deepEqual([J(g).slide.min, J(g).slide.max], [-0.9, 0.9]);
        }
    });
    it('wall solver: A bottom wall dragged up by 2 m stops at 2.0 (opening 0.9: A.bottom >= 1.5+0.45) but at 2.6 with width 2 (>= 1.5+1.0, grid 0.2)', () => {
        const run = (g) => planWall({ graph: g, joints: deriveJoints(g).joints, roomId: 'a', side: 'bottom', delta: -2, step: 0.2 });
        assert.equal(run(pair()).delta, -1);
        assert.equal(run(pair(2)).delta, -0.4);
        assert.ok(run(pair(2)).blocked);
    });
    it('connectRooms stores width/doorType on BOTH connectors and checks the shared wall (2 m shared: width 2 refused, width 1.5 ok)', () => {
        const g = { rooms: [room('a', 0, 0, []), room('b', 4, 0, [], 2)], relationships: [] };
        const bad = connectRooms({ graph: g, roomA: 'a', roomB: 'b', width: 2 });
        assert.ok(!bad.ok);
        const ok = connectRooms({ graph: g, roomA: 'a', roomB: 'b', width: 1.5, doorType: 'sliding' });
        assert.ok(ok.ok);
        const cs = ok.graph.rooms.flatMap((r) => r.connectors);
        assert.deepEqual(cs.map((c) => [c.width, c.doorType]), [[1.5, 'sliding'], [1.5, 'sliding']]);
        assert.equal(deriveJoints(ok.graph).joints[0].status, 'ok');
        const plain = connectRooms({ graph: g, roomA: 'a', roomB: 'b' });
        assert.ok(!('width' in plain.graph.rooms[0].connectors[0]) && !('doorType' in plain.graph.rooms[0].connectors[0]));
    });
    it('addRoom passes width through', () => {
        const g = { rooms: [room('a', 0, 0, [])], relationships: [] };
        const r = addRoom({ graph: g, name: 'Hall', nextTo: 'a', side: 'right', connect: 'door', width: 1.4 });
        assert.ok(r.ok);
        assert.ok(r.graph.rooms.flatMap((x) => x.connectors).every((c) => c.width === 1.4));
    });
    it('mapper: a wide opening needs a wider shared wall (width 2.4 -> shared part >= 2.4)', () => {
        const mk = (w) => ({ rooms: [
                { id: 'a', sizeCategory: 'medium', connectors: [port('ar', 'a', 'right', { offset: undefined, position: 0.5, ...(w ? { width: w } : {}) })] },
                { id: 'b', sizeCategory: 'medium', connectors: [port('bl', 'b', 'left', { offset: undefined, position: 0.5, ...(w ? { width: w } : {}) })] }
            ], relationships: [{ id: 'ab', connectorA: 'ar', connectorB: 'bl', importance: 'required' }] });
        const res = mapLayout(mk(2.4));
        const A = res.layouts.a, B = res.layouts.b;
        assert.ok(Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y) >= 2.4 - 1e-6);
    });
    it('embedded editor source knows width, and the HTML has the width inputs', () => {
        const h = editorHtml(ref());
        assert.ok(h.includes('typeof p.width') && h.includes('id="new-width"') && h.includes('data-cwidth'));
    });
});
