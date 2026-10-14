import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { migrate, mapOnlyMissing } from '../src/core.js';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { planMove } from '../src/moves.js';

const REF = new URL('../../../shared/reference-home-connectors.json', import.meta.url);
const ref = (): any => JSON.parse(readFileSync(REF, 'utf8'));
const port = (id: string, roomId: string, side: string, offset: number) => ({ id, roomId, side, type: 'door', offset });
const room = (id: string, x: number, y: number, connectors: any[], extra: any = {}) => ({ id, connectors, layout: { x, y, width: 4, height: 3, ...extra } });
const link = (id: string, a: string, b: string) => ({ id, connectorA: a, connectorB: b, importance: 'required' });
/** A(0,0) - B(4,1) - C(8,1): doors at world y = 1.5 on both walls of each pair */
const chain = (lockA = false) => ({
  rooms: [
    room('a', 0, 0, [port('ar', 'a', 'right', 1.5)], lockA ? { locked: true } : {}),
    room('b', 4, 1, [port('bl', 'b', 'left', 0.5), port('br', 'b', 'right', 0.5)]),
    room('c', 8, 1, [port('cl', 'c', 'left', 0.5)]),
  ],
  relationships: [link('ab', 'ar', 'bl'), link('bc', 'br', 'cl')],
}) as any;
const plan = (g: any, roomId: string, dx: number, dy: number, mode: 'slide' | 'pull', noOverlap = true) => planMove({ graph: g, joints: deriveJoints(g).joints, roomId, dx, dy, mode, step: 0.2, noOverlap });

describe('planMove: slide', () => {
  it('cannot cross an attached wall, and is reported as blocked', () => {
    const p = plan(chain(), 'b', 1, 0, 'slide');
    assert.deepEqual(p.displacements.b, { dx: 0, dy: 0 }); assert.ok(p.blocked); assert.match(p.message, /Alt/);
  });
  it('slides along the wall within the range that keeps the opening in place (hand-computed: up to 2.0, down 0)', () => {
    // joint a|b: B may move [-2.0, 0] along y with the door at y=1.5 staying inside the shared part; joint b|c pins x and also limits y
    const g = chain(); g.rooms.pop(); g.relationships.pop();
    assert.deepEqual(plan(g, 'b', 0, -1, 'slide').displacements.b, { dx: 0, dy: -1 });
    assert.deepEqual(plan(g, 'b', 0, -5, 'slide').displacements.b, { dx: 0, dy: -2 });
    assert.deepEqual(plan(g, 'b', 0, 1, 'slide').displacements.b, { dx: 0, dy: 0 });
  });
  it('the opening stays where it was while the room slides', () => {
    const g = chain(); g.rooms.pop(); g.relationships.pop();
    const p = plan(g, 'b', 0, -1, 'slide');
    assert.deepEqual(p.openings, [{ connectorA: 'ar', connectorB: 'bl', world: 1.5 }]);
  });
  it('a room with no attached joints moves freely', () => {
    const g = chain(); g.relationships = [];
    assert.deepEqual(plan(g, 'b', 1.4, -0.6, 'slide', false).displacements.b, { dx: 1.4, dy: -0.6 });
  });
  it('detached joints do not restrain the room', () => {
    const g = chain(); g.joints = [{ relationshipId: 'ab', state: 'detached' }, { relationshipId: 'bc', state: 'detached' }];
    assert.deepEqual(plan(g, 'b', 1, 1, 'slide', false).displacements.b, { dx: 1, dy: 1 });
  });
});

describe('planMove: no overlaps', () => {
  /** B(4,0) free to move, D(7,0) unattached 4x3: B (4 wide) can only travel until its right edge touches D */
  const scene = () => ({ rooms: [room('b', 0, 0, []), room('d', 7, 0, [])], relationships: [] }) as any;
  it('a free room stops exactly at contact (hand-computed: 3 m of travel), in both modes', () => {
    for (const mode of ['slide', 'pull'] as const) {
      const p = plan(scene(), 'b', 5, 0, mode); assert.deepEqual(p.displacements.b, { dx: 3, dy: 0 }); assert.ok(p.blocked); assert.equal(p.reason, 'overlap'); assert.deepEqual([...p.ids].sort(), ['b', 'd']);
    }
  });
  it('it cannot tunnel through the obstacle even if the pointer ends on the far side', () => {
    const p = plan(scene(), 'b', 12, 0, 'slide'); assert.deepEqual(p.displacements.b, { dx: 3, dy: 0 });
  });
  it('sliding past the obstacle is fine, and the block can be switched off', () => {
    assert.deepEqual(plan(scene(), 'b', 0, 3.2, 'slide').displacements.b, { dx: 0, dy: 3.2 });
    assert.deepEqual(plan(scene(), 'b', 5, 0, 'slide', false).displacements.b, { dx: 5, dy: 0 });
  });
  it('rooms that already overlap are not frozen', () => {
    const g = scene(); g.rooms[1].layout.x = 2; assert.deepEqual(plan(g, 'b', -1, 0, 'slide').displacements.b, { dx: -1, dy: 0 });
  });
});

describe('planMove: locks', () => {
  it('only a POSITION lock pins a room: a size-locked neighbour is pulled along like any other', () => {
    const g = chain(); g.rooms[0].layout.sizeLocked = true; const p = plan(g, 'b', 1, 0, 'pull');
    assert.ok(!p.blocked); assert.deepEqual(p.displacements.a, { dx: 1, dy: 0 });
    const h = chain(); h.rooms[0].layout.positionLocked = true; assert.ok(plan(h, 'b', 1, 0, 'pull').blocked);
  });
  it('the old single flag still means both', () => {
    const g = chain(); g.rooms[0].layout.locked = true; assert.ok(plan(g, 'b', 1, 0, 'pull').blocked);
    assert.equal(plan(g, 'b', 1, 0, 'pull').reason, 'locked');
  });
});

describe('planMove: pull', () => {
  it('moving away from a wall pulls the whole chain along, rigidly', () => {
    const p = plan(chain(), 'b', 1, 0, 'pull');
    assert.ok(!p.blocked); assert.deepEqual(p.displacements, { a: { dx: 1, dy: 0 }, b: { dx: 1, dy: 0 }, c: { dx: 1, dy: 0 } });
  });
  it('beyond the slide range the neighbour is pulled just enough (hand-computed: range for B is [-3,1], moving 2 pulls A by 1)', () => {
    const g = chain(); g.rooms.pop(); g.relationships.pop();
    const p = plan(g, 'b', 0, 2, 'pull'); assert.deepEqual(p.displacements.b, { dx: 0, dy: 2 }); assert.deepEqual(p.displacements.a, { dx: 0, dy: 1 });
  });
  it('a locked neighbour is never moved: the request is scaled back until it is feasible', () => {
    const p = plan(chain(true), 'b', 1, 0, 'pull');
    assert.ok(p.blocked); assert.deepEqual(p.displacements.b, { dx: 0, dy: 0 }); assert.equal(p.displacements.a?.dx ?? 0, 0);
  });
  it('sliding within the range pulls nothing', () => {
    const g = chain(); g.rooms.pop(); g.relationships.pop();
    const p = plan(g, 'b', 0, 0.6, 'pull'); assert.deepEqual(p.moved, ['b']);
  });
});

describe('planMove: pull around loops', () => {
  it('reference home: pulling the kitchen across its wall moves the whole attached plan rigidly instead of refusing', () => {
    const g: any = migrate(ref()); mapOnlyMissing(g); const p = plan(g, 'kitchen', 3, 0, 'pull');
    assert.ok(!p.blocked); assert.equal(p.moved.length, g.rooms.length);
    assert.ok(Object.values(p.displacements).every(d => d.dx === 3 && d.dy === 0));
  });
  it('a locked room anywhere in the attached group stops the rigid fallback: the move is scaled back, nothing breaks', () => {
    const g: any = migrate(ref()); mapOnlyMissing(g); g.rooms.find((r: any) => r.id === 'outside').layout.locked = true;
    const p = plan(g, 'kitchen', 3, 0, 'pull'); assert.ok(p.blocked); assert.deepEqual(p.displacements.outside ?? { dx: 0, dy: 0 }, { dx: 0, dy: 0 });
  });
});

describe('planMove: invariants on the reference home (random drags)', () => {
  for (const mode of ['slide', 'pull'] as const) {
    it(mode + ': every joint attached at the start still touches; locked rooms never move; deterministic', () => {
      let seed = 777; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
      for (let t = 0; t < 250; t++) {
        const g: any = migrate(ref()); mapOnlyMissing(g);
        const lockedId = g.rooms[Math.floor(rnd() * g.rooms.length)].id; g.rooms.find((r: any) => r.id === lockedId).layout.locked = true;
        const free = g.rooms.filter((r: any) => !r.layout.locked); const R = free[Math.floor(rnd() * free.length)];
        const dx = Math.round((rnd() - .5) * 30) * .2, dy = Math.round((rnd() - .5) * 30) * .2;
        const j0 = deriveJoints(g).joints;
        const p = planMove({ graph: g, joints: j0, roomId: R.id, dx, dy, mode, step: 0.2 });
        assert.deepEqual(p, planMove({ graph: g, joints: j0, roomId: R.id, dx, dy, mode, step: 0.2 }));
        assert.equal(p.displacements[lockedId]?.dx ?? 0, 0); assert.equal(p.displacements[lockedId]?.dy ?? 0, 0);
        if (mode === 'slide') assert.deepEqual(p.moved.filter(id => id !== R.id), []);
        const moved = g.rooms.map((r: any) => { const d = p.displacements[r.id]; return d ? { ...r, layout: { ...r.layout, x: r.layout.x + d.dx, y: r.layout.y + d.dy } } : r; });
        const after = new Map(deriveJoints({ ...g, rooms: moved }).joints.map(j => [j.id, j]));
        for (const j of j0.filter(j => j.status === 'ok')) assert.ok(after.get(j.id)!.touching, `trial ${t} ${mode}: ${j.id} lost its wall (room ${R.id} by ${dx},${dy})`);
      }
    });
  }
});

describe('editor html: move modes', () => {
  const html = editorHtml(ref());
  it('has the mode switch, the planner and the hooks', () => {
    for (const s of ['id="move-mode"', 'function planMove(', 'function applyPlan(', 'function detachBroken(', 'function jointOverlay(', '.jointwall']) assert.ok(html.includes(s), s);
  });
  it('the embedded planner evaluates and matches the Node result', () => {
    const src = html.slice(html.indexOf('function mapLayout('), html.indexOf('function applyMap('));
    const f = new Function(src + ';return planMove')() as typeof planMove;
    const g: any = migrate(ref()); mapOnlyMissing(g); const joints = deriveJoints(g).joints;
    for (const mode of ['slide', 'pull'] as const) assert.deepEqual(f({ graph: g, joints, roomId: 'kitchen', dx: 1.2, dy: -0.6, mode, step: 0.2 }), planMove({ graph: g, joints, roomId: 'kitchen', dx: 1.2, dy: -0.6, mode, step: 0.2 }));
  });
});
