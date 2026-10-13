import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { planWall, planAlign } from '../src/walls.js';
const ref = () => JSON.parse(readFileSync(new URL('../../../reference-home-connectors.json', import.meta.url), 'utf8'));
const room = (id, x, y, extra = {}) => ({ id, name: id, sizeCategory: 'medium', connectors: [], layout: { x, y, width: 4, height: 3, ...extra } });
const J = (g) => deriveJoints(g).joints;
const scene = (...rooms) => ({ rooms, relationships: [] });
describe('planWall: alignment groups as collinear constraints', () => {
    const wall = (g, id, side, delta, alignments) => planWall({ graph: g, joints: J(g), roomId: id, side, delta, step: 0.2, alignments });
    it('bottom wall of A +1.0 carries the aligned bottom wall of B (both 3 -> 4 high); without the group B stays', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 0));
        const on = wall(g, 'a', 'bottom', 1, [{ side: 'bottom', roomIds: ['a', 'b'] }]);
        assert.ok(!on.blocked);
        assert.deepEqual(on.layouts.a, { x: 0, y: 0, width: 4, height: 4 });
        assert.deepEqual(on.layouts.b, { x: 10, y: 0, width: 4, height: 4 });
        assert.equal(wall(g, 'a', 'bottom', 1).layouts.b, undefined);
    });
    it('a member that is not at the same level (C bottom at 2.0 vs 3.0) is left alone; other axes are unaffected', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 0), room('c', 20, 0, { height: 2 }));
        const al = [{ side: 'bottom', roomIds: ['a', 'b', 'c'] }];
        const p = wall(g, 'a', 'bottom', 1, al);
        assert.deepEqual(Object.keys(p.layouts), ['a', 'b']);
        assert.equal(wall(g, 'a', 'right', 1, al).layouts.b, undefined);
    });
    it('a size-locked member is carried as a whole (moves down 1.0, keeps 3 m height)', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 0, { sizeLocked: true }));
        const p = wall(g, 'a', 'bottom', 1, [{ side: 'bottom', roomIds: ['a', 'b'] }]);
        assert.deepEqual(p.layouts.b, { x: 10, y: 1, width: 4, height: 3 });
    });
    it('top wall alignment with a position-locked member blocks the drag (locked, B)', () => {
        const g = scene(room('a', 0, 5), room('b', 10, 5, { positionLocked: true }));
        const p = wall(g, 'a', 'top', -1, [{ side: 'top', roomIds: ['a', 'b'] }]);
        assert.ok(p.blocked);
        assert.equal(p.reason, 'locked');
        assert.deepEqual(p.ids, ['b']);
        assert.equal(p.delta, 0);
    });
    it('a delta that is not a multiple of the grid step ends exactly on target (0.9 with step 0.2)', () => {
        const g = scene(room('a', 0, 0));
        const p = wall(g, 'a', 'bottom', 0.9);
        assert.ok(!p.blocked);
        assert.equal(p.delta, 0.9);
        assert.equal(p.layouts.a.height, 3.9);
    });
});
describe('planAlign: snap to the first selected room', () => {
    const al = (g, side, roomIds, extra = {}) => planAlign({ graph: g, joints: J(g), side, roomIds, step: 0.2, ...extra });
    it('bottom: B (2 high) snaps to the reference A (bottom at 3.0): B becomes 3 high, A is untouched', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 0, { height: 2 }));
        const p = al(g, 'bottom', ['a', 'b']);
        assert.equal(p.level, 3);
        assert.deepEqual(p.aligned, ['a', 'b']);
        assert.deepEqual(p.failed, []);
        assert.deepEqual(p.layouts, { b: { x: 10, y: 0, width: 4, height: 3 } });
    });
    it('the order decides: reference B (bottom at 2.0) moves A up to 2.0 (A becomes 2 high)', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 0, { height: 2 }));
        const p = al(g, 'bottom', ['b', 'a']);
        assert.equal(p.level, 2);
        assert.deepEqual(p.layouts, { a: { x: 0, y: 0, width: 4, height: 2 } });
    });
    it('top: B (top at 2.0) goes up to the reference top at 0.0: y 0, height 5', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 2));
        const p = al(g, 'top', ['a', 'b']);
        assert.deepEqual(p.layouts, { b: { x: 10, y: 0, width: 4, height: 5 } });
    });
    it('an off-grid distance still lands exactly (B bottom at 2.1, target 3.0, step 0.2)', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 0, { height: 2.1 }));
        const p = al(g, 'bottom', ['a', 'b']);
        assert.equal(p.layouts.b.height, 3);
        assert.deepEqual(p.failed, []);
    });
    it('a position-locked top wall cannot move: reported in failed (locked), others still aligned', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 2, { positionLocked: true }), room('c', 20, 1));
        const p = al(g, 'top', ['a', 'b', 'c']);
        assert.deepEqual(p.failed.map(f => [f.id, f.reason]), [['b', 'locked']]);
        assert.deepEqual(p.aligned, ['a', 'c']);
        assert.deepEqual(p.layouts.c, { x: 20, y: 0, width: 4, height: 4 });
        assert.equal(p.layouts.b, undefined);
    });
    it('touching rooms next to the reference are not disturbed when another room snaps to it', () => {
        const g = scene(room('a', 0, 0), room('c', 0, 3), room('b', 10, 0, { height: 2 }));
        const p = al(g, 'bottom', ['a', 'b'], { glueTouching: true });
        assert.deepEqual(p.failed, []);
        assert.equal(p.layouts.a, undefined);
        assert.equal(p.layouts.c, undefined);
    });
    it('does not mutate the input and is deterministic', () => {
        const g = scene(room('a', 0, 0), room('b', 10, 0, { height: 2 })), snap = JSON.stringify(g);
        assert.deepEqual(al(g, 'bottom', ['a', 'b']), al(g, 'bottom', ['a', 'b']));
        assert.equal(JSON.stringify(g), snap);
    });
});
const ALIGN_FILE = new URL('../../../alignment_test.json', import.meta.url);
describe('alignment test file: Small Hall / Toilet / Laundry bottoms (runs when packages/alignment_test.json exists)', () => {
    it('with the reference Small Hall, Small Hall and Toilet stay and Laundry (bottom 4.6) goes towards 6.0', { skip: !existsSync(ALIGN_FILE) }, () => {
        const raw = JSON.parse(readFileSync(ALIGN_FILE, 'utf8'));
        const g = { rooms: raw.rooms.filter((r) => r.layout), relationships: raw.relationships };
        const p = planAlign({ graph: g, joints: J(g), side: 'bottom', roomIds: ['small-hall', 'toilet', 'laundry'], step: 0.2 });
        assert.equal(p.level, 6);
        assert.equal(p.layouts['small-hall'], undefined);
        assert.equal(p.layouts['toilet'], undefined);
        assert.ok(p.aligned.includes('laundry') || p.failed.some(f => f.id === 'laundry'));
    });
});
describe('alignment: embedded in the editor HTML', () => {
    it('the embedded planAlign matches Node; the editor shows the reference', () => {
        const html = editorHtml(ref()), a = html.indexOf('function deriveJoints('), b = html.indexOf('\nfunction applyMap(');
        const emb = new Function(html.slice(a, b) + '\nreturn { planAlign };')();
        const g = scene(room('a', 0, 0), room('b', 10, 0, { height: 2 })), inp = { graph: g, joints: J(g), side: 'bottom', roomIds: ['a', 'b'], step: 0.2 };
        assert.deepEqual(JSON.parse(JSON.stringify(emb.planAlign(inp))), JSON.parse(JSON.stringify(planAlign(inp))));
        assert.ok(html.includes('(reference)') && html.includes('.aref .edgeglow') && html.includes('planAlign({graph:g0'));
    });
});
