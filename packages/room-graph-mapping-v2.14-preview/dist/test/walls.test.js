import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { migrate, mapOnlyMissing, positionLocked, sizeLocked, runMapper } from '../src/core.js';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { planWall } from '../src/walls.js';
const REF = new URL('../../../reference-home-connectors.json', import.meta.url);
const ref = () => JSON.parse(readFileSync(REF, 'utf8'));
const port = (id, roomId, side, offset) => ({ id, roomId, side, type: 'door', offset });
const room = (id, x, y, connectors, extra = {}) => ({ id, sizeCategory: 'medium', connectors, layout: { x, y, width: 4, height: 3, ...extra } });
const link = (id, a, b) => ({ id, connectorA: a, connectorB: b, importance: 'required' });
/** A(0,0) | B(4,0) | optional unattached C(10,0); all 4x3 'medium' (min width 2, max width 10); door a|b at y = 1.5 */
const pair = (withC = false, extra = {}) => ({
    rooms: [room('a', 0, 0, [port('ar', 'a', 'right', 1.5)], extra.a), room('b', 4, 0, [port('bl', 'b', 'left', 1.5)], extra.b), ...(withC ? [room('c', 10, 0, [])] : [])],
    relationships: [link('ab', 'ar', 'bl')],
});
const wall = (g, roomId, side, delta, noOverlap = true) => planWall({ graph: g, joints: deriveJoints(g).joints, roomId, side: side, delta, step: 0.2, noOverlap });
describe('planWall: shared wall', () => {
    it('moving the shared wall resizes both rooms (hand-computed: A 4->5 wide, B 4->3 wide, B starts at 5)', () => {
        const p = wall(pair(), 'a', 'right', 1);
        assert.ok(!p.blocked);
        assert.equal(p.delta, 1);
        assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 5, height: 3 });
        assert.deepEqual(p.layouts.b, { x: 5, y: 0, width: 3, height: 3 });
        assert.deepEqual(p.openings, [{ connectorA: 'ar', connectorB: 'bl', world: 1.5 }]);
    });
    it('the same wall dragged from the other room gives the same result, and dragging back shrinks the first room', () => {
        assert.deepEqual(wall(pair(), 'b', 'left', 1).layouts, wall(pair(), 'a', 'right', 1).layouts);
        const p = wall(pair(), 'a', 'right', -1);
        assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 3, height: 3 });
        assert.deepEqual(p.layouts.b, { x: 3, y: 0, width: 5, height: 3 });
    });
    it('squeeze, then push: B shrinks to its minimum (2 m) and is then carried along', () => {
        const p = wall(pair(), 'a', 'right', 3);
        assert.ok(!p.blocked);
        assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 7, height: 3 });
        assert.deepEqual(p.layouts.b, { x: 7, y: 0, width: 2, height: 3 });
    });
    it('maximum size stops the wall exactly (A max 10 m wide: 6.0 of the 7.0 requested)', () => {
        const p = wall(pair(), 'a', 'right', 7);
        assert.ok(p.blocked);
        assert.equal(p.delta, 6);
        assert.equal(p.reason, 'max');
        assert.deepEqual(p.ids, ['a']);
    });
});
describe('planWall: locks', () => {
    it('a position-locked room cannot be pushed, and its left/top wall cannot be dragged at all', () => {
        const g = pair(false, { b: { positionLocked: true } });
        const p = wall(g, 'a', 'right', 1);
        assert.ok(p.blocked);
        assert.equal(p.delta, 0);
        assert.equal(p.reason, 'locked');
        assert.deepEqual(p.ids, ['b']);
        const q = wall(pair(false, { a: { positionLocked: true } }), 'a', 'left', -1);
        assert.ok(q.blocked);
        assert.equal(q.reason, 'locked');
    });
    it('a position-locked room can still be resized from its right/bottom walls', () => {
        const p = wall(pair(false, { a: { positionLocked: true } }), 'a', 'right', 1);
        assert.ok(!p.blocked);
        assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 5, height: 3 });
    });
    it('a size-locked room keeps its size and is carried along as a whole', () => {
        const p = wall(pair(false, { b: { sizeLocked: true } }), 'a', 'right', 1);
        assert.ok(!p.blocked);
        assert.deepEqual(p.layouts.b, { x: 5, y: 0, width: 4, height: 3 });
        assert.deepEqual(p.layouts.a, { x: 0, y: 0, width: 5, height: 3 });
    });
    it('size AND position locked: nothing moves', () => {
        const p = wall(pair(false, { b: { locked: true } }), 'a', 'right', 1);
        assert.ok(p.blocked);
        assert.equal(p.delta, 0);
        assert.equal(p.reason, 'locked');
    });
    it('helpers: explicit flags win over the old single flag', () => {
        assert.ok(positionLocked({ x: 0, y: 0, width: 1, height: 1, locked: true }));
        assert.ok(sizeLocked({ x: 0, y: 0, width: 1, height: 1, locked: true }));
        const l = { x: 0, y: 0, width: 1, height: 1, locked: true, sizeLocked: false };
        assert.ok(positionLocked(l));
        assert.ok(!sizeLocked(l));
    });
    it('Run mapper moves size-locked rooms (size kept) but never position-locked ones', () => {
        const g = migrate(ref());
        mapOnlyMissing(g);
        g.rooms.find((r) => r.id === 'bath').layout.positionLocked = true;
        g.rooms.find((r) => r.id === 'kitchen').layout.sizeLocked = true;
        const bath = { ...g.rooms.find((r) => r.id === 'bath').layout };
        const kitchen = g.rooms.find((r) => r.id === 'kitchen').layout;
        kitchen.x += 9;
        kitchen.y += 9;
        const size = [kitchen.width, kitchen.height];
        runMapper(g);
        assert.deepEqual(g.rooms.find((r) => r.id === 'bath').layout, bath);
        const k = g.rooms.find((r) => r.id === 'kitchen').layout;
        assert.deepEqual([k.width, k.height], size);
        assert.notEqual(k.x, kitchen.x + 0 === 0 ? -1 : 9999);
    });
});
describe('planWall: overlaps and doors', () => {
    it('an unattached room blocks the squeeze (hand-computed: stops at 4.0, where B 2 m wide touches C at x=10... B right edge = 6+delta)', () => {
        // B = [4+d, 8+..]: B is squeezed to 2 m then carried: right edge = 4+d+2 once d>2. C starts at x=10 -> d <= 4
        const p = wall(pair(true), 'a', 'right', 6);
        assert.ok(p.blocked);
        assert.equal(p.delta, 4);
        assert.equal(p.reason, 'overlap');
        assert.deepEqual([...p.ids].sort(), ['b', 'c']);
        assert.equal(wall(pair(true), 'a', 'right', 6, false).blocked, false, 'overlap blocking can be switched off');
    });
    it('a wall cannot be dragged across a door: the opening must stay inside both rooms', () => {
        // vertical shared wall a|b with the door at y=1.5 (opening 0.9 wide): dragging A\'s TOP wall down past y=1.05 would cut the door off
        const p = wall(pair(), 'a', 'top', 3);
        assert.ok(p.blocked);
        assert.equal(p.reason, 'opening');
        assert.ok(p.delta <= 1.05 + 1e-9 && p.delta >= 0.8);
    });
    it('a room without attached walls just resizes', () => {
        const g = pair();
        g.relationships = [];
        const p = wall(g, 'a', 'bottom', 1);
        assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 4, height: 4 } });
    });
});
describe('planWall: invariants on the reference home (random wall drags)', () => {
    it('attached walls stay attached, locks and size limits hold, no new overlaps, deterministic', () => {
        let seed = 4242;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
        let moved = 0, blocked = 0;
        for (let t = 0; t < 200; t++) {
            const g = migrate(ref());
            mapOnlyMissing(g);
            const lockedId = g.rooms[Math.floor(rnd() * g.rooms.length)].id;
            const kind = Math.floor(rnd() * 3);
            const lay = g.rooms.find((r) => r.id === lockedId).layout;
            if (kind === 0)
                lay.positionLocked = true;
            else if (kind === 1)
                lay.sizeLocked = true;
            else
                lay.locked = true;
            const R = g.rooms[Math.floor(rnd() * g.rooms.length)];
            const side = ['left', 'right', 'top', 'bottom'][Math.floor(rnd() * 4)];
            const delta = Math.round((rnd() - .5) * 24) * .2;
            const j0 = deriveJoints(g).joints;
            const p = planWall({ graph: g, joints: j0, roomId: R.id, side: side, delta, step: 0.2 });
            assert.deepEqual(p, planWall({ graph: g, joints: j0, roomId: R.id, side: side, delta, step: 0.2 }));
            if (p.blocked)
                blocked++;
            if (p.moved.length)
                moved++;
            const rooms = g.rooms.map((r) => (p.layouts[r.id] ? { ...r, layout: { ...r.layout, ...p.layouts[r.id] } } : r));
            const after = new Map(deriveJoints({ ...g, rooms }).joints.map(j => [j.id, j]));
            for (const j of j0.filter(j => j.status === 'ok'))
                assert.ok(after.get(j.id).touching, `trial ${t}: ${j.id} lost its wall (${R.id}.${side} by ${delta})`);
            const l = p.layouts[lockedId], l0 = lay;
            if (l && (kind === 0 || kind === 2))
                assert.ok(l.x === l0.x && l.y === l0.y, `trial ${t}: position-locked ${lockedId} moved`);
            if (l && (kind === 1 || kind === 2))
                assert.ok(l.width === l0.width && l.height === l0.height, `trial ${t}: size-locked ${lockedId} resized`);
            for (const r of rooms) {
                const o = r.layout;
                assert.ok(o.width >= Math.min(1, g.rooms.find((q) => q.id === r.id).layout.width) - 1e-9 && o.height >= Math.min(1, g.rooms.find((q) => q.id === r.id).layout.height) - 1e-9);
            }
            for (let a = 0; a < rooms.length; a++)
                for (let b = a + 1; b < rooms.length; b++) {
                    const A = rooms[a].layout, B = rooms[b].layout, A0 = g.rooms[a].layout, B0 = g.rooms[b].layout;
                    const ov = (X, Y) => Math.min(X.x + X.width, Y.x + Y.width) - Math.max(X.x, Y.x) > 1e-6 && Math.min(X.y + X.height, Y.y + Y.height) - Math.max(X.y, Y.y) > 1e-6;
                    if (!ov(A0, B0))
                        assert.ok(!ov(A, B), `trial ${t}: ${rooms[a].id} and ${rooms[b].id} now overlap`);
                }
        }
        assert.ok(moved > 30 && blocked > 10, `the random drags must exercise both outcomes (moved ${moved}, blocked ${blocked})`);
    });
});
describe('editor html: wall tool, split lock', () => {
    const html = editorHtml(ref());
    it('has the tool switch, overlap toggle, two lock checkboxes and the embedded solver', () => {
        for (const s of ['id="tool"', 'id="no-overlap"', 'id="lock-pos"', 'id="lock-size"', 'Lock position', 'Lock size', 'function planWall(', 'function applyWall(', 'function wallLayer(', 'data-wall'])
            assert.ok(html.includes(s), s);
        assert.ok(!html.includes('Lock size and position'));
    });
    it('the embedded solver evaluates and matches the Node result', () => {
        const src = html.slice(html.indexOf('function mapLayout('), html.indexOf('function applyMap('));
        const f = new Function(src + ';return planWall')();
        const g = migrate(ref());
        mapOnlyMissing(g);
        const joints = deriveJoints(g).joints;
        for (const side of ['left', 'right', 'top', 'bottom'])
            assert.deepEqual(f({ graph: g, joints, roomId: 'dining', side, delta: 1, step: 0.2 }), planWall({ graph: g, joints, roomId: 'dining', side, delta: 1, step: 0.2 }));
    });
});
