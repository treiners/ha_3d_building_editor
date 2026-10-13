import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { migrate, mapOnlyMissing } from '../src/core.js';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { planWall, planCorner } from '../src/walls.js';
const REF = new URL('../../../reference-home-connectors.json', import.meta.url);
const ref = () => JSON.parse(readFileSync(REF, 'utf8'));
const port = (id, roomId, side, offset) => ({ id, roomId, side, type: 'door', offset });
const room = (id, x, y, connectors, extra = {}) => ({ id, name: id, sizeCategory: 'medium', connectors, layout: { x, y, width: 4, height: 3, ...extra } });
const link = (id, a, b) => ({ id, connectorA: a, connectorB: b, importance: 'required' });
/** A(0,0) | B(4,0) | optional unattached C(10,0); all 4x3 'medium' (min width 2, max width 10); door a|b at y = 1.5 */
const pair = (withC = false, extra = {}) => ({
    rooms: [room('a', 0, 0, [port('ar', 'a', 'right', 1.5)], extra.a), room('b', 4, 0, [port('bl', 'b', 'left', 1.5)], extra.b), ...(withC ? [room('c', 10, 0, [])] : [])],
    relationships: [link('ab', 'ar', 'bl')],
});
const corner = (g, roomId, c, dx, dy, noOverlap = true) => planCorner({ graph: g, joints: deriveJoints(g).joints, roomId, corner: c, dx, dy, step: 0.2, noOverlap });
const wall = (g, roomId, side, delta) => planWall({ graph: g, joints: deriveJoints(g).joints, roomId, side: side, delta, step: 0.2 });
describe('planCorner: hand-computed scenes', () => {
    it('a lone room: br corner +1.0 / +0.6 gives 5.0 x 3.6', () => {
        const g = { rooms: [room('a', 0, 0, [])], relationships: [] };
        const p = corner(g, 'a', 'br', 1, 0.6);
        assert.ok(!p.blocked);
        assert.equal(p.dx, 1);
        assert.equal(p.dy, 0.6);
        assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 5, height: 3.6 });
    });
    it('a lone room: tl corner +1.0 / +0.6 moves the corner to (1, 0.6) and shrinks to 3.0 x 2.4', () => {
        const g = { rooms: [room('a', 0, 0, [])], relationships: [] };
        const p = corner(g, 'a', 'tl', 1, 0.6);
        assert.ok(!p.blocked);
        assert.deepEqual(p.layouts.a, { x: 1, y: 0.6, width: 3, height: 2.4 });
    });
    it('x only equals the wall solver: neighbour B shrinks 4 -> 3 and starts at 5', () => {
        const g = pair();
        const p = corner(g, 'a', 'br', 1, 0);
        assert.deepEqual(p.layouts, wall(g, 'a', 'right', 1).layouts);
        assert.deepEqual(p.openings, wall(g, 'a', 'right', 1).openings);
    });
    it('a position-locked neighbour blocks the x axis only: x stays, y moves 0.6', () => {
        const p = corner(pair(false, { b: { positionLocked: true } }), 'a', 'br', 1, 0.6);
        assert.ok(p.blocked);
        assert.equal(p.reason, 'locked');
        assert.deepEqual(p.ids, ['b']);
        assert.equal(p.dx, 0);
        assert.equal(p.dy, 0.6);
        assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 4, height: 3.6 } });
    });
    it('an unattached room stops the squeeze exactly (B squeezed to 2 m, pushed to C at x=10: 4.0 of 5.0)', () => {
        const p = corner(pair(true), 'a', 'br', 5, 0);
        assert.ok(p.blocked);
        assert.equal(p.reason, 'overlap');
        assert.equal(p.dx, 4);
        assert.deepEqual(p.ids, ['b', 'c']);
        assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 8, height: 3 });
        assert.deepEqual(p.layouts.b, { x: 8, y: 0, width: 2, height: 3 });
        assert.ok(!corner(pair(true), 'a', 'br', 5, 0, false).blocked);
    });
    it('tl corner of a position-locked room is refused', () => {
        const p = corner(pair(false, { a: { positionLocked: true } }), 'a', 'tl', 1, 1);
        assert.ok(p.blocked);
        assert.equal(p.reason, 'locked');
        assert.deepEqual(p.layouts, {});
        assert.equal(p.dx, 0);
        assert.equal(p.dy, 0);
    });
    it('the input graph is not mutated and the result is deterministic', () => {
        const g = pair(true), snap = JSON.stringify(g), j = deriveJoints(g).joints;
        const a = corner(g, 'a', 'br', 2, 0.4), b = corner(g, 'a', 'br', 2, 0.4);
        assert.equal(JSON.stringify(g), snap);
        assert.deepEqual(a, b);
        assert.deepEqual(j, deriveJoints(g).joints);
    });
});
const overlaps = (rooms, L) => {
    const out = new Set();
    for (let i = 0; i < rooms.length; i++)
        for (let j = i + 1; j < rooms.length; j++) {
            const A = L(rooms[i].id), B = L(rooms[j].id);
            if (A.x < B.x + B.width - 1e-6 && A.x + A.width > B.x + 1e-6 && A.y < B.y + B.height - 1e-6 && A.y + A.height > B.y + 1e-6)
                out.add(rooms[i].id + '|' + rooms[j].id);
        }
    return out;
};
describe('planCorner: reference home', () => {
    it('500 seeded random corner drags: locked rooms stay, attached walls keep touching, no new overlap', () => {
        const g = migrate(ref());
        mapOnlyMissing(g);
        g.rooms.forEach((r, i) => { if (i % 5 === 2)
            r.layout.positionLocked = true; });
        const joints = deriveJoints(g).joints, ok = joints.filter(j => j.status === 'ok');
        const rooms = g.rooms.filter((r) => r.layout), before = overlaps(rooms, id => g.rooms.find((r) => r.id === id).layout);
        let seed = 12345;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
        for (let n = 0; n < 500; n++) {
            const r = rooms[Math.floor(rnd() * rooms.length)], c = rnd() < 0.5 ? 'br' : 'tl', dx = Math.round((rnd() * 6 - 3) / 0.2) * 0.2, dy = Math.round((rnd() * 6 - 3) / 0.2) * 0.2;
            const p = planCorner({ graph: g, joints, roomId: r.id, corner: c, dx, dy, step: 0.2, noOverlap: true });
            const L = (id) => ({ ...g.rooms.find((x) => x.id === id).layout, ...(p.layouts[id] || {}) });
            for (const x of rooms)
                if (x.layout.positionLocked) {
                    assert.equal(L(x.id).x, x.layout.x);
                    assert.equal(L(x.id).y, x.layout.y);
                }
            const after = deriveJoints({ rooms: rooms.map((x) => ({ ...x, layout: L(x.id) })), relationships: g.relationships, joints: g.joints }).joints;
            for (const j of ok) {
                const a = after.find(q => q.id === j.id);
                assert.ok(a.touching, `joint ${j.id} lost (room ${r.id}, ${c}, ${dx}, ${dy})`);
            }
            for (const o of overlaps(rooms, L))
                assert.ok(before.has(o), `new overlap ${o} (room ${r.id}, ${c}, ${dx}, ${dy})`);
        }
    });
});
describe('planCorner: embedded in the editor HTML', () => {
    it('the embedded source evaluates and matches Node', () => {
        const html = editorHtml(ref()), a = html.indexOf('function deriveJoints('), b = html.indexOf('\nfunction applyMap(');
        assert.ok(a > 0 && b > a && html.includes('function planCorner('));
        const emb = new Function(html.slice(a, b) + '\nreturn { deriveJoints, planCorner };')();
        const g = pair(true), input = { graph: g, joints: deriveJoints(g).joints, roomId: 'a', corner: 'br', dx: 2, dy: 0.4, step: 0.2, noOverlap: true };
        assert.deepEqual(JSON.parse(JSON.stringify(emb.planCorner(input))), JSON.parse(JSON.stringify(planCorner(input))));
        assert.ok(html.includes('applyCorner(P)'));
    });
});
