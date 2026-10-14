/**
 * Move planner for the "Slide" and "Slide + pull" modes (Phase 1). Pure + deterministic.
 *
 * Input is the graph and the joints AS THEY WERE when the drag started, plus the requested displacement of one room.
 * Output is the displacement of every room that has to move, so that every joint that was attached (status ok)
 * at the start is still attached afterwards. "Free" mode does not use this module (it is today's behaviour).
 *
 *  slide : only the dragged room moves. Across an attached wall it cannot move at all; along the wall it can slide
 *          within the joint's slide range, with the opening kept where it is whenever possible.
 *  pull  : like slide, but when the room leaves its slide range, or moves across a wall, the neighbour is pulled
 *          along (and its own neighbours in turn), as little as possible. Around a loop of rooms the minimal pulls
 *          can contradict each other; then the whole attached group moves rigidly instead (always valid). Locked
 *          rooms never move; if that makes the move impossible, the move stops at the last possible step.
 *
 * With `noOverlap` (default on) a move that would make two rooms overlap that did not overlap before is stopped at the last
 * position before contact. The drag is swept step by step from the start, so a room can never tunnel through another one.
 *
 * `planMove` calls `deriveJoints` (embedded next to it in the editor HTML, imported in Node).
 */
import { deriveJoints } from './joints.js';
import type { Joint, JRoom, JLink, JointOverride } from './joints.js';

export type MoveMode = 'slide' | 'pull';
export interface MoveInput {
  graph: { rooms: JRoom[]; relationships: JLink[]; joints?: JointOverride[] };
  joints: Joint[];
  roomId: string;
  dx: number; dy: number;
  mode: MoveMode;
  step: number;
  /** forbid NEW overlaps between rooms (default true) */
  noOverlap?: boolean;
  /** refuse a move that only works if EVERY room (except `ignoreIds`) moves, i.e. the whole floor plan would shift (default false) */
  blockWholePlan?: boolean;
  /** rooms that are not part of the visible floor plan (the hidden Outside room): they never block by overlap and do not count for blockWholePlan */
  ignoreIds?: string[];
  /** when a move is stopped by another room, keep sliding along it (one axis at a time) instead of sticking (default false) */
  slideAlong?: boolean;
  /** where the drag currently is (own displacement of the previous call): the sweep starts there instead of at 0, so a free room can be dragged AROUND an obstacle.
   *  Only used when the room has no attached joints (nothing else has to move); ignored otherwise. */
  from?: { dx: number; dy: number };
}
export interface MovePlan {
  displacements: Record<string, { dx: number; dy: number }>;
  /** new world position (along the wall) of every opening whose rooms moved, for BOTH connectors of the pair */
  openings: { connectorA: string; connectorB: string; world: number }[];
  /** true when the requested move was reduced */
  blocked: boolean;
  /** why the move was reduced: 'walls' (attached walls), 'locked', 'overlap' or '' */
  reason: string;
  /** rooms involved in the reason (e.g. the two rooms that would overlap) */
  ids: string[];
  message: string;
  moved: string[];
}

export function planMove(input: MoveInput): MovePlan {
  const { graph, joints, roomId, mode } = input;
  const step = input.step > 0 ? input.step : 0.2;
  const EPS = 1e-6;
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0; // + 0 turns -0 into 0
  type D = { dx: number; dy: number };
  const layouts = new Map(graph.rooms.map(r => [r.id, r.layout]));
  const ok = joints.filter(j => j.status === 'ok');
  const locked = (id: string) => { const l = layouts.get(id); return !!l && (l.positionLocked ?? l.locked === true); }; // position lock only
  const floorTo = (v: number) => Math.floor((v + EPS) / step) * step;
  const ceilTo = (v: number) => Math.ceil((v - EPS) / step) * step;
  const snapTo = (v: number) => Math.round(v / step) * step;
  const tk = (j: Joint): keyof D => (j.axis === 'y' ? 'dy' : 'dx'); // displacement along the wall
  const nk = (j: Joint): keyof D => (j.axis === 'y' ? 'dx' : 'dy'); // displacement across the wall

  /** allowed displacement of room x along the wall relative to its partner; inward-snapped, always contains 0 */
  const relRange = (j: Joint, x: string, keepOpening: boolean): [number, number] => {
    const s = j.slide;
    if (!s) return [0, 0];
    const r = keepOpening && s.fixedOpening ? s.fixedOpening : s;
    const lo = x === j.roomB ? r.min : -r.max, hi = x === j.roomB ? r.max : -r.min;
    return [Math.min(0, ceilTo(lo)), Math.max(0, floorTo(hi))];
  };

  const solveSlide = (dx: number, dy: number): Map<string, D> => {
    const rng: Record<keyof D, [number, number]> = { dx: [-Infinity, Infinity], dy: [-Infinity, Infinity] };
    for (const j of ok) {
      if (j.roomA !== roomId && j.roomB !== roomId) continue;
      rng[nk(j)] = [0, 0];
      const [lo, hi] = relRange(j, roomId, true), t = rng[tk(j)];
      const nlo = Math.max(t[0], lo), nhi = Math.min(t[1], hi);
      rng[tk(j)] = nlo <= nhi ? [nlo, nhi] : [0, 0];
    }
    const cl = (v: number, r: [number, number]) => Math.min(r[1], Math.max(r[0], v));
    return new Map([[roomId, { dx: cl(dx, rng.dx), dy: cl(dy, rng.dy) }]]);
  };

  const solvePull = (dx: number, dy: number): Map<string, D> | null => {
    const disp = new Map<string, D>([[roomId, { dx, dy }]]);
    const queue = [roomId];
    let guard = 0;
    while (queue.length) {
      if (++guard > 400) return null;
      const x = queue.shift()!, dX = disp.get(x)!;
      for (const j of ok) {
        if (j.roomA !== x && j.roomB !== x) continue;
        const n = j.roomA === x ? j.roomB : j.roomA;
        const [lo, hi] = relRange(j, x, false);
        const assigned = disp.get(n), dN: D = assigned ? { ...assigned } : { dx: 0, dy: 0 };
        const normal = nk(j), tang = tk(j);
        if (assigned && Math.abs(dN[normal] - dX[normal]) > EPS) return null; // rigid loop: two paths disagree
        dN[normal] = dX[normal];                                              // across the wall the partner follows
        const rel = dX[tang] - dN[tang];                                      // along the wall: slide, then pull
        if (rel > hi + EPS) dN[tang] = dX[tang] - hi; else if (rel < lo - EPS) dN[tang] = dX[tang] - lo;
        const changed = !assigned || Math.abs(dN.dx - assigned.dx) > EPS || Math.abs(dN.dy - assigned.dy) > EPS;
        if (!changed) continue;
        if (n === roomId) return null;
        if (locked(n) && (Math.abs(dN.dx) > EPS || Math.abs(dN.dy) > EPS)) return null;
        disp.set(n, dN); queue.push(n);
      }
    }
    return disp;
  };

  /** fallback for pull: translate the whole group connected through attached joints (all joints stay valid) */
  let rigidLocked: string[] = [];
  const solveRigid = (dx: number, dy: number): Map<string, D> | null => {
    const group = new Set([roomId]), queue = [roomId];
    while (queue.length) {
      const x = queue.shift()!;
      for (const j of ok) {
        if (j.roomA !== x && j.roomB !== x) continue;
        const n = j.roomA === x ? j.roomB : j.roomA;
        if (!group.has(n)) { group.add(n); queue.push(n); }
      }
    }
    rigidLocked = [...group].filter(locked);
    if (rigidLocked.length) return null;
    return new Map([...group].map(id => [id, { dx, dy }]));
  };

  type Why = { tag: string; ids: string[] };
  const ignore = new Set(input.ignoreIds ?? []);   // hidden rooms (Outside): never block by overlap, do not count for blockWholePlan
  const noOverlap = input.noOverlap !== false;
  const overlapKeys = (rs0: JRoom[]) => {
    const rs = rs0.filter(r => !ignore.has(r.id)), out = new Set<string>();
    for (let i = 0; i < rs.length; i++) for (let k = i + 1; k < rs.length; k++) {
      const a = rs[i]!.layout, b = rs[k]!.layout;
      if (!a || !b) continue;
      if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > EPS) out.add(rs[i]!.id + '|' + rs[k]!.id);
    }
    return out;
  };
  const overlapsBefore = noOverlap ? overlapKeys(graph.rooms) : new Set<string>();

  /** every joint that was attached must still touch (and not become narrower than it already was); no NEW overlaps */
  const verify = (disp: Map<string, D>): Why | null => {
    const rooms = graph.rooms.map(r => {
      const d = disp.get(r.id);
      return d && r.layout ? { ...r, layout: { ...r.layout, x: r.layout.x + d.dx, y: r.layout.y + d.dy } } : r;
    });
    const after = new Map(deriveJoints({ rooms, relationships: graph.relationships, joints: graph.joints }).joints.map(j => [j.id, j]));
    for (const j of ok) { const a = after.get(j.id); if (!a || !a.touching || (a.narrow && !j.narrow)) return { tag: 'walls', ids: [j.roomA, j.roomB] }; }
    if (noOverlap) for (const key of overlapKeys(rooms)) if (!overlapsBefore.has(key)) return { tag: 'overlap', ids: key.split('|') };
    return null;
  };

  // a move that can only happen if EVERY room moves (the whole floor plan) is refused when blockWholePlan is on
  const counted = graph.rooms.filter(r => r.layout && !ignore.has(r.id)).map(r => r.id), cset = new Set(counted);
  const comps: string[][] = [], seen = new Set<string>();
  for (const id of counted) {                                    // groups of rooms connected through attached joints
    if (seen.has(id)) continue;
    const comp = [id], q = [id]; seen.add(id);
    while (q.length) { const x = q.shift()!; for (const j of ok) { const n = j.roomA === x ? j.roomB : j.roomB === x ? j.roomA : ''; if (n && cset.has(n) && !seen.has(n)) { seen.add(n); comp.push(n); q.push(n); } } }
    comps.push(comp);
  }
  const mainPlan = new Set(comps.reduce((b, c) => (c.length > b.length || (c.length === b.length && c.slice().sort()[0]! < b.slice().sort()[0]!) ? c : b), [] as string[]));   // the largest attached group is the floor plan
  const movesAll = (d: Map<string, D>) => !!input.blockWholePlan && mainPlan.size > 1 && mainPlan.has(roomId) && [...mainPlan].every(id => { const v = d.get(id); return !!v && Math.abs(v.dx) + Math.abs(v.dy) > EPS; });

  // sweep the drag from the start in grid steps and stop at the first position that is not allowed
  const tryAt = (sdx: number, sdy: number): { d: Map<string, D> | null; w: Why | null } => {
    let d: Map<string, D> | null, w: Why | null;
    if (mode === 'slide') { d = solveSlide(sdx, sdy); w = verify(d); }
    else {
      d = solvePull(sdx, sdy); w = d ? verify(d) : { tag: 'walls', ids: [] };
      if (w) {                                                           // minimal pulls failed: move the whole attached group
        const r = solveRigid(sdx, sdy);
        if (r) { const w2 = verify(r); if (!w2) { d = r; w = null; } else w = w2; }
        else if (!d) w = { tag: 'locked', ids: rigidLocked };
      }
    }
    if (!w && d && movesAll(d)) w = { tag: 'all', ids: [] };
    return { d, w };
  };
  const dx0 = snapTo(input.dx), dy0 = snapTo(input.dy);
  const f0 = input.from && !ok.some(j => j.roomA === roomId || j.roomB === roomId) ? { x: snapTo(input.from.dx), y: snapTo(input.from.dy) } : { x: 0, y: 0 };
  const N = Math.max(Math.round(Math.abs(dx0 - f0.x) / step), Math.round(Math.abs(dy0 - f0.y) / step));
  let disp = new Map<string, D>([[roomId, { dx: f0.x, dy: f0.y }]]);
  let why: Why | null = null, last = { x: f0.x, y: f0.y };
  for (let m = 1; m <= N; m++) {
    const sdx = snapTo(f0.x + (dx0 - f0.x) * m / N), sdy = snapTo(f0.y + (dy0 - f0.y) * m / N);
    const t = tryAt(sdx, sdy);
    if (t.w) { why = t.w; break; }
    disp = t.d!; last = { x: sdx, y: sdy };
  }
  if (why && why.tag === 'overlap' && input.slideAlong) {           // stopped by another room: keep sliding along it, one axis at a time (x then y, or y then x; the closer result wins)
    const cont = (first: 'x' | 'y') => {
      let cx = last.x, cy = last.y, dd = disp;
      for (const ax of [first, first === 'x' ? 'y' : 'x'] as const) {
        const target = ax === 'x' ? dx0 : dy0;
        for (let guard = 0; guard < 2000; guard++) {
          const cur = ax === 'x' ? cx : cy;
          if (Math.abs(target - cur) < EPS) break;
          const nv = snapTo(cur + Math.sign(target - cur) * step), t = ax === 'x' ? tryAt(nv, cy) : tryAt(cx, nv);
          if (t.w || !t.d) break;
          if (ax === 'x') cx = nv; else cy = nv;
          dd = t.d;
        }
      }
      return { cx, cy, dd };
    };
    const a = cont('x'), b = cont('y'), dist = (r: { cx: number; cy: number }) => Math.hypot(dx0 - r.cx, dy0 - r.cy);
    const best = dist(b) < dist(a) - EPS ? b : a;
    if (dist(best) < Math.hypot(dx0 - last.x, dy0 - last.y) - EPS) disp = best.dd;
  }

  const dOf = (id: string): D => disp.get(id) ?? { dx: 0, dy: 0 };
  const own = dOf(roomId);
  const blocked = Math.abs(own.dx - dx0) > EPS || Math.abs(own.dy - dy0) > EPS;
  const reason = !blocked ? '' : why ? why.tag : 'walls';
  const ids = blocked && why ? why.ids : [];

  // opening of every moved joint: stays where it is if it still fits into the shared part, else is pushed inside
  const openings: MovePlan['openings'] = [];
  for (const j of ok) {
    const da = dOf(j.roomA), db = dOf(j.roomB);
    if (Math.abs(da.dx) + Math.abs(da.dy) + Math.abs(db.dx) + Math.abs(db.dy) < EPS) continue;
    const A = layouts.get(j.roomA)!, B = layouts.get(j.roomB)!, x = j.axis === 'x';
    const a0 = x ? A.x + da.dx : A.y + da.dy, a1 = a0 + (x ? A.width : A.height);
    const b0 = x ? B.x + db.dx : B.y + db.dy, b1 = b0 + (x ? B.width : B.height);
    const lo = Math.max(a0, b0), hi = Math.min(a1, b1), half = j.openingWidth / 2;
    const ta = x ? da.dx : da.dy, tb = x ? db.dx : db.dy, op = j.opening + (Math.abs(ta - tb) < EPS ? ta : 0);   // both rooms moved together along the wall: the opening travels with them
    const p = hi - lo >= j.openingWidth ? Math.min(hi - half, Math.max(lo + half, op)) : (lo + hi) / 2;
    openings.push({ connectorA: j.connectorA, connectorB: j.connectorB, world: rnd(p) });
  }
  const displacements: MovePlan['displacements'] = {};
  const moved: string[] = [];
  for (const [id, d] of [...disp.entries()].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    displacements[id] = { dx: rnd(d.dx), dy: rnd(d.dy) };
    if (Math.abs(d.dx) + Math.abs(d.dy) > EPS) moved.push(id);
  }
  const message = !blocked ? '' : reason === 'overlap' ? 'Another room is in the way.'
    : reason === 'all' ? 'Stopped: this move would shift every room (the whole floor plan).'
    : reason === 'locked' ? 'A locked room blocks this move.'
    : mode === 'slide' ? 'Attached walls limit this move. Hold Alt to detach, or use Slide + pull.'
    : 'A rigid loop of walls limits this move. Hold Alt to detach.';
  return { displacements, openings, blocked, reason, ids, message, moved };
}
