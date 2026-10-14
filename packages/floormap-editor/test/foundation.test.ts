import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { migrate, mapOnlyMissing, rect, alignPair, metrics } from '../src/core.js';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { createHistory } from '../src/history.js';

const REF = new URL('../../../shared/reference-home-connectors.json', import.meta.url);
const ref = (): any => JSON.parse(readFileSync(REF, 'utf8'));
const port = (id: string, roomId: string, side: string, offset: number, type = 'door') => ({ id, roomId, side, type, offset });
/** two rooms side by side: A 4x3 at (0,0), B 4x3 at (4,1); door at world y=1.5 on both walls */
const pair = (over: any = {}) => ({
  rooms: [
    { id: 'a', connectors: [port('ar', 'a', 'right', 1.5)], layout: { x: 0, y: 0, width: 4, height: 3 } },
    { id: 'b', connectors: [port('bl', 'b', 'left', 0.5)], layout: { x: 4, y: 1, width: 4, height: 3 } },
  ],
  relationships: [{ id: 'ab', connectorA: 'ar', connectorB: 'bl', importance: 'required' }],
  ...over,
}) as any;

describe('joints', () => {
  it('reference home: 13 attached joints, none broken', () => {
    const g = migrate(ref()); mapOnlyMissing(g); const { summary, joints } = deriveJoints(g as any);
    const { narrow, ...rest } = summary; assert.ok(narrow >= 0);
    assert.deepEqual(rest, { total: 13, ok: 13, broken: 0, detached: 0, invalid: 0, unplaced: 0 });
    assert.ok(joints.every(j => j.overlap && j.openingAligned && j.slide));
  });
  it('geometry of a simple joint', () => {
    const j = deriveJoints(pair(), { margin: 0 }).joints[0]!;
    assert.equal(j.status, 'ok'); assert.equal(j.gap, 0); assert.equal(j.axis, 'y');
    assert.deepEqual(j.overlap, [1, 3]); assert.equal(j.opening, 1.5); assert.equal(j.openingWidth, 0.9); assert.ok(j.openingAligned);
  });
  it('slide range for room B (hand-computed): free [-3.1,1.1], opening kept in place [-2.05,0.05]', () => {
    const s = deriveJoints(pair(), { margin: 0 }).joints[0]!.slide!;
    assert.equal(s.min, -3.1); assert.equal(s.max, 1.1);
    assert.deepEqual(s.fixedOpening, { min: -2.05, max: 0.05 });
  });
  it('slide range matches the geometry: inside it the shared wall is wide enough, one step outside it is narrow', () => {
    const s = deriveJoints(pair(), { margin: 0 }).joints[0]!.slide!;
    for (const [shift, narrow] of [[s.min, false], [s.max, false], [s.max + 0.2, true], [s.min - 0.2, true]] as const) {
      const g = pair(); g.rooms[1].layout.y = 1 + shift;
      const j = deriveJoints(g, { margin: 0 }).joints[0]!;
      assert.equal(j.touching, true, 'still touching at shift ' + shift); assert.equal(j.narrow, narrow, 'narrow at shift ' + shift);
    }
  });
  it('status follows the editor rule: narrow walls stay ok, far-apart connector points are misaligned', () => {
    const g = pair(); g.rooms[1].layout.y = 2.6; g.rooms[0].connectors[0].offset = 2.8; g.rooms[1].connectors[0].offset = 0.2;   // overlap 0.4 m wide, points aligned
    let j = deriveJoints(g).joints[0]!; assert.equal(j.status, 'ok'); assert.equal(j.narrow, true); assert.equal(deriveJoints(g).summary.narrow, 1);
    g.rooms[1].connectors[0].offset = 0.9;                                                                                     // same walls, points 0.7 m apart
    j = deriveJoints(g).joints[0]!; assert.equal(j.status, 'broken'); assert.deepEqual(j.reasons, ['misaligned']); assert.equal(j.touching, true);
  });
  it('PARITY: ok-joint count equals the editor\'s own aligned() count for random drags and resizes', () => {
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let t = 0; t < 300; t++) {
      const g = migrate(ref()); mapOnlyMissing(g);
      for (let i = 0, n = 1 + Math.floor(rnd() * 4); i < n; i++) {
        const L = rect(g.rooms[Math.floor(rnd() * g.rooms.length)]!);
        if (rnd() < .6) { L.x = +(L.x + Math.round((rnd() - .5) * 20) * .2).toFixed(4); L.y = +(L.y + Math.round((rnd() - .5) * 20) * .2).toFixed(4); }
        else { L.width = Math.max(1, +(L.width + Math.round((rnd() - .5) * 8) * .2).toFixed(4)); L.height = Math.max(1, +(L.height + Math.round((rnd() - .5) * 8) * .2).toFixed(4)); }
        g.relationships.forEach(l => alignPair(g, l));
      }
      assert.equal(deriveJoints(g as any).summary.ok, metrics(g).satisfied, 'trial ' + t);
    }
  });
  it('a moved room breaks the joint and says why; a detached override is not broken', () => {
    const g = pair(); g.rooms[1].layout.x = 6;
    let j = deriveJoints(g).joints[0]!; assert.equal(j.status, 'broken'); assert.ok(j.reasons.includes('gap')); assert.equal(j.gap, 2);
    g.joints = [{ relationshipId: 'ab', state: 'detached' }];
    j = deriveJoints(g).joints[0]!; assert.equal(j.status, 'detached'); assert.equal(j.state, 'detached');
  });
  it('rooms that slid past each other: no-overlap', () => {
    const g = pair(); g.rooms[1].layout.y = 5; const j = deriveJoints(g).joints[0]!;
    assert.equal(j.status, 'broken'); assert.ok(j.reasons.includes('no-overlap')); assert.equal(j.overlap, null);
  });
  it('locked rooms are reported as not movable', () => {
    const g = pair(); g.rooms[0].layout.locked = true;
    assert.deepEqual(deriveJoints(g).joints[0]!.movable, { a: false, b: true });
  });
  it('invalid and unplaced relationships are classified, never thrown', () => {
    const g = pair(); g.rooms[1].connectors[0].side = 'right';
    assert.equal(deriveJoints(g).joints[0]!.status, 'invalid');
    const h = pair(); delete h.rooms[1].layout; assert.equal(deriveJoints(h).joints[0]!.status, 'unplaced');
    const k = pair(); k.relationships.push({ id: 'x', connectorA: 'nope', connectorB: 'bl' });
    assert.equal(deriveJoints(k).summary.invalid, 1);
  });
  it('joint overrides survive migrate()', () => {
    const raw = ref(); raw.joints = [{ relationshipId: 'living-dining', state: 'detached' }];
    const g = migrate(raw); mapOnlyMissing(g); assert.deepEqual(g.joints, raw.joints); assert.notEqual(g.joints, raw.joints);
    assert.equal(deriveJoints(g as any).summary.detached, 1);
    assert.equal(migrate(ref()).joints, undefined, 'files without joints stay unchanged');
  });
});

describe('history', () => {
  it('undo / redo walk through the states', () => {
    const h = createHistory(); h.push('s0'); h.push('s1');           // current state is s2
    assert.equal(h.undo('s2'), 's1'); assert.equal(h.undo('s1'), 's0'); assert.equal(h.undo('s0'), null);
    assert.equal(h.redo('s0'), 's1'); assert.equal(h.redo('s1'), 's2'); assert.equal(h.redo('s2'), null);
  });
  it('a new change clears redo, the limit drops the oldest, clear() empties', () => {
    const h = createHistory(3); h.push('a'); h.push('b'); h.undo('c'); assert.ok(h.canRedo()); h.push('x'); assert.ok(!h.canRedo());
    for (const s of ['1', '2', '3', '4']) h.push(s); assert.equal(h.undo('now'), '4'); assert.equal(h.undo('4'), '3'); assert.equal(h.undo('3'), '2'); assert.equal(h.undo('2'), null);
    h.push('q'); h.clear(); assert.ok(!h.canUndo() && !h.canRedo());
  });
});

describe('editor html foundation', () => {
  const html = editorHtml(ref());
  it('has undo/redo controls, joint summary and the embedded modules', () => {
    for (const s of ['id="undo"', 'id="redo"', 'id="joints"', 'function createHistory(', 'function deriveJoints(', 'function mapLayout(']) assert.ok(html.includes(s), s);
  });
  it('embedded deriveJoints / createHistory behave like the Node versions', () => {
    const src = html.slice(html.indexOf('function mapLayout('), html.indexOf('function applyMap('));
    const f = new Function(src + ';return{deriveJoints,createHistory}')() as { deriveJoints: typeof deriveJoints; createHistory: typeof createHistory };
    const g = migrate(ref()); mapOnlyMissing(g);
    assert.deepEqual(f.deriveJoints(g as any), deriveJoints(g as any));
    const h = f.createHistory(2); h.push('a'); assert.equal(h.undo('b'), 'a');
  });
  it('rect() is still the only layout accessor the geometry relies on', () => assert.ok(rect(migrate(ref()).rooms[0]!)));
});
