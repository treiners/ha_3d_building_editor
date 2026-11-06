/**
 * Editing the shape of a room (v2.18 phase 5, see docs/V2.18-SHAPES.md): pure functions behind the Shape tool. A room's shape is its `outline` (corners relative to the
 * layout's top-left corner), or the rectangle of its layout when it has none. Moving a wall segment or pulling a bump / notch out of it gives a new outline; `reshapeRoom`
 * applies it: the layout becomes the new bounding box, the outline is stored relative to it (and dropped when the shape is a rectangle again), connectors keep their
 * place on the walls (offsets are measured from the bounding box edge), and the objects and entities of the room keep their place on the floor.
 * Walls that are connected to another room cannot be moved or cut yet (the neighbour would have to follow): a message names the room.
 * Pure + deterministic. Embedded into the editor HTML with toString(): no imports of values, helpers inside the functions; sibling globals (all embedded together, see embed.ts):
 * `shapeOfRoom`, `shapeWallPartner`, `reshapeRoom`, and the shape functions `outlineBounds`, `outlineBump`, `outlineFromRect`, `outlineIssues`, `outlineMoveWall`,
 * `outlineNormalize`, `outlineOverlapArea`, `outlineWallAt`, `outlineWalls`.
 */
import { outlineBounds, outlineBump, outlineCombine, outlineFromRect, outlineIssues, outlineMoveWall, outlineNormalize, outlineOverlapArea, outlineThin, outlineWallAt, outlineWalls } from './shape.js';
import type { Outline } from './shape.js';

interface SPort { id: string; roomId?: string; side: string; offset?: number; position?: number; width?: number; wallAt?: number }
interface SLayout { x: number; y: number; width: number; height: number; locked?: boolean; positionLocked?: boolean; sizeLocked?: boolean }
interface SRoom { id: string; name?: string; floor?: string; layout?: SLayout; outline?: Outline; connectors?: SPort[] }
export interface ShapeGraph {
  rooms: SRoom[];
  relationships?: { id: string; connectorA: string; connectorB: string }[];
  joints?: { relationshipId: string; state: string }[];
  objects?: { roomId?: string; position: [number, number] }[];
  entityPlacements?: { roomId?: string; connectorId?: string; position?: number[] }[];
  wallAlignments?: { id: string; side: string; roomIds: string[] }[];
}
export interface ShapeResult<G> { graph: G; ok: boolean; message: string; id: string }

/** The shape of a room relative to its layout's top-left corner: its valid outline in canonical form, else the rectangle of its layout. */
export function shapeOfRoom(r: { layout?: { width: number; height: number }; outline?: Outline }): Outline {
  if (r.outline && outlineIssues(r.outline).length === 0) return outlineNormalize(r.outline);
  return outlineFromRect({ x: 0, y: 0, width: r.layout ? r.layout.width : 0, height: r.layout ? r.layout.height : 0 });
}

/** The name of the room that is connected to the given part (`from`..`to`, along the wall) of wall `wallIndex`, through a connection that is not detached; '' when there is none. */
export function shapeWallPartner(g: ShapeGraph, r: SRoom, o: Outline, wallIndex: number, from: number, to: number): string {
  const mine = new Set<string>();
  for (const c of r.connectors || []) {
    const horizontal = c.side === 'top' || c.side === 'bottom', len = r.layout ? (horizontal ? r.layout.width : r.layout.height) : 0, off = c.offset ?? (c.position ?? 0.5) * len, half = (c.width ?? 0.9) / 2;
    const w = outlineWallAt(o, c.side, off, c.wallAt);
    if (w && w.index === wallIndex && off >= from - half && off <= to + half) mine.add(c.id);
  }
  for (const l of g.relationships || []) {
    const other = mine.has(l.connectorA) ? l.connectorB : mine.has(l.connectorB) ? l.connectorA : '';
    if (!other || (g.joints || []).some((j) => j.relationshipId === l.id && j.state === 'detached')) continue;
    const owner = g.rooms.find((x) => (x.connectors || []).some((c) => c.id === other));
    return owner ? owner.name || owner.id : other;
  }
  return '';
}

/** The ids of the rooms that share the given part (`from`..`to`, along the wall) of wall `wallIndex`: rooms connected to it through a connection that is not detached, and (when `geometry` is true) every other room of the floor whose facing wall lies on it with a positive shared length, whether or not a door sits there. The `Outside` room and `skip` are only reported when they are connected. Sorted, empty when there is none. */
export function shapeWallPartners(g: ShapeGraph, r: SRoom, o: Outline, wallIndex: number, from: number, to: number, skip?: string[], geometry?: boolean): string[] {
  const mine = new Set<string>(), out: string[] = [];
  for (const c of r.connectors || []) {
    const horizontal = c.side === 'top' || c.side === 'bottom', len = r.layout ? (horizontal ? r.layout.width : r.layout.height) : 0, off = c.offset ?? (c.position ?? 0.5) * len, half = (c.width ?? 0.9) / 2;
    const w = outlineWallAt(o, c.side, off, c.wallAt);
    if (w && w.index === wallIndex && off >= from - half && off <= to + half) mine.add(c.id);
  }
  for (const l of g.relationships || []) {
    const other = mine.has(l.connectorA) ? l.connectorB : mine.has(l.connectorB) ? l.connectorA : '';
    if (!other || (g.joints || []).some((j) => j.relationshipId === l.id && j.state === 'detached')) continue;
    const owner = g.rooms.find((x) => (x.connectors || []).some((c) => c.id === other));
    if (owner && owner.id !== r.id && out.indexOf(owner.id) < 0) out.push(owner.id);
  }
  const wl = outlineWalls(o)[wallIndex];
  if (geometry && wl && r.layout) {
    const vertical = wl.side === 'left' || wl.side === 'right', opp = wl.side === 'left' ? 'right' : wl.side === 'right' ? 'left' : wl.side === 'top' ? 'bottom' : 'top', R = r.layout;
    const cw = (vertical ? R.x : R.y) + wl.at, lo = (vertical ? R.y : R.x) + Math.max(wl.from, from), hi = (vertical ? R.y : R.x) + Math.min(wl.to, to);
    for (const x of g.rooms) {
      if (x.id === r.id || !x.layout || (x.floor || '') !== (r.floor || '') || String(x.name || '').toLowerCase() === 'outside' || (skip || []).indexOf(x.id) >= 0 || out.indexOf(x.id) >= 0) continue;
      const X = x.layout;
      for (const xw of outlineWalls(shapeOfRoom(x))) {
        if (xw.side !== opp || Math.abs((vertical ? X.x : X.y) + xw.at - cw) > 1e-4) continue;
        if (Math.min(hi, (vertical ? X.y : X.x) + xw.to) - Math.max(lo, (vertical ? X.y : X.x) + xw.from) > 1e-6) { out.push(x.id); break; }
      }
    }
  }
  return out.sort();
}

/**
 * Gives a room a new shape: `outline` is relative to the room's CURRENT top-left corner and may reach beyond it (negative or larger coordinates). The layout becomes the new bounding
 * box (the room's corner may move), the outline is stored relative to it and dropped when it is a rectangle, connector offsets and the positions of the objects and entities of the room
 * are re-based so nothing moves on the floor. Refused when the room's position is locked and its corner would move, and with `noOverlap` when the new shape would newly overlap
 * another room (`ignoreIds` are skipped, e.g. `Outside`); the overlap is measured on the real shapes, so a neighbour in a notch is no overlap.
 */
export function reshapeRoom<G extends ShapeGraph>(input: { graph: G; id: string; outline: Outline; noOverlap?: boolean; ignoreIds?: string[] }): ShapeResult<G> {
  const g0 = input.graph, fail = (m: string): ShapeResult<G> => ({ graph: g0, ok: false, message: m, id: input.id });
  const r0 = g0.rooms.find((r) => r.id === input.id), L0 = r0 ? r0.layout : undefined;
  if (!r0 || !L0) return fail('Room not found.');
  const o = outlineNormalize(input.outline);
  if (o.length < 4 || outlineIssues(o).length) return fail('That shape is not valid.');
  const b = outlineBounds(o), rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  if ((Math.abs(b.x) > 1e-9 || Math.abs(b.y) > 1e-9) && (L0.positionLocked ?? L0.locked === true)) return fail((r0.name || r0.id) + ' is position-locked: this change would move its top-left corner.');
  const at = (r: SRoom, p: Outline, ox: number, oy: number): Outline => p.map((q): [number, number] => [q[0] + ox, q[1] + oy]);
  if (input.noOverlap) {
    const skip = new Set(input.ignoreIds || []), now = at(r0, o, L0.x, L0.y), before = at(r0, shapeOfRoom(r0), L0.x, L0.y);
    for (const r of g0.rooms) {
      if (r.id === r0.id || !r.layout || skip.has(r.id)) continue;
      const other = at(r, shapeOfRoom(r), r.layout.x, r.layout.y);
      if (outlineOverlapArea(now, other) > 1e-6 && outlineOverlapArea(before, other) <= 1e-6) return fail('The new shape would overlap ' + (r.name || r.id) + '. Untick "Block overlaps" to allow it.');
    }
  }
  const g = JSON.parse(JSON.stringify(g0)) as G, r = g.rooms.find((x) => x.id === input.id)!, L = r.layout!;
  const rel = outlineNormalize(o.map((q): [number, number] => [q[0] - b.x, q[1] - b.y])), W0 = L.width, H0 = L.height, oldShape = shapeOfRoom(r0);
  L.x = rnd(L.x + b.x); L.y = rnd(L.y + b.y); L.width = b.width; L.height = b.height;
  if (rel.length === 4) delete r.outline; else { r.outline = rel; L.sizeLocked = true; }
  for (const c of r.connectors || []) {
    const horizontal = c.side === 'top' || c.side === 'bottom', len = horizontal ? L.width : L.height, old = c.offset ?? (c.position ?? 0.5) * (horizontal ? W0 : H0);
    const ow = outlineWallAt(oldShape, c.side, Math.max(0.05, Math.min((horizontal ? W0 : H0) - 0.05, old)), c.wallAt), want = ow ? rnd(ow.at - (horizontal ? b.y : b.x)) : undefined;
    c.offset = rnd(Math.max(0.05, Math.min(len - 0.05, old - (horizontal ? b.x : b.y))));
    c.position = rnd(c.offset / len);
    // the wall a connector sits on is kept: `wallAt` is only written when it is not the outermost wall at that place (see outlineWallAt)
    const def = rel.length > 4 ? outlineWallAt(rel, c.side, c.offset) : undefined, hit = want !== undefined && rel.length > 4 ? outlineWallAt(rel, c.side, c.offset, want) : undefined;
    if (def && hit && Math.abs(hit.at - want!) <= 1e-4 && Math.abs(hit.at - def.at) > 1e-4) c.wallAt = rnd(hit.at); else delete c.wallAt;
  }
  for (const ob of g.objects || []) if (ob.roomId === input.id) ob.position = [rnd(ob.position[0] - b.x), rnd(ob.position[1] - b.y)];
  for (const e of g.entityPlacements || []) if (e.roomId === input.id && Array.isArray(e.position)) e.position = [rnd(e.position[0]! - b.x), rnd(e.position[1]! - b.y)];
  return { graph: g, ok: true, message: rel.length === 4 ? 'The room is a rectangle.' : 'Shape changed.', id: input.id };
}

/** Moves wall `wall` (index in `shapeOfRoom`) of a room along its outward normal by `delta` metres (outwards positive). See `outlineMoveWall` and `reshapeRoom` for the rules; a wall with a connection to another room is refused. */
export function moveRoomWall<G extends ShapeGraph>(input: { graph: G; id: string; wall: number; delta: number; minEdge?: number; noOverlap?: boolean; ignoreIds?: string[]; alone?: boolean }): ShapeResult<G> {
  const g = input.graph, r = g.rooms.find((x) => x.id === input.id), fail = (m: string): ShapeResult<G> => ({ graph: g, ok: false, message: m, id: input.id });
  if (!r || !r.layout) return fail('Room not found.');
  const o = shapeOfRoom(r);
  if (!outlineWalls(o)[input.wall]) return fail('No such wall.');
  if (Math.abs(input.delta) < 1e-9) return { graph: g, ok: true, message: 'No change.', id: input.id };
  const nameOf = (id: string) => { const x = g.rooms.find((q) => q.id === id); return x ? x.name || x.id : id; }, outside = (id: string) => (input.ignoreIds || []).indexOf(id) >= 0 || String(nameOf(id)).toLowerCase() === 'outside';
  const w = outlineWalls(o)[input.wall]!, partners = shapeWallPartners(g, r, o, input.wall, -Infinity, Infinity, input.ignoreIds, !input.alone);
  if (partners.some(outside) || (input.alone && partners.length)) return fail('This wall is connected to ' + partners.map(nameOf).join(', ') + '. Detach the connection first (Alt-drag a room in a Slide mode) or use Drag walls.');
  if (partners.length > 1) return fail('This wall is shared with several rooms (' + partners.map(nameOf).join(', ') + '). Hold Alt to move only this room.');
  const n = outlineMoveWall(o, input.wall, input.delta, input.minEdge);
  if (!n) return fail('That would make the shape invalid or a wall shorter than ' + (input.minEdge ?? 0.3) + ' m.');
  if (partners.length === 1) return reshapeWithPartner({ graph: g, id: input.id, outline: n, partner: partners[0]!, wall: input.wall, from: w.from, to: w.to, shift: w.side === 'right' || w.side === 'bottom' ? input.delta : -input.delta, noOverlap: input.noOverlap, ignoreIds: input.ignoreIds });
  return reshapeRoom({ graph: g, id: input.id, outline: n, noOverlap: input.noOverlap, ignoreIds: input.ignoreIds });
}

/** Pulls a bump (depth > 0) or notch (depth < 0) of `width` metres out of wall `wall`, centred at `center` along the wall (from the room's corner). See `outlineBump`; when that part of the wall is connected to ONE other room, that room follows (`reshapeWithPartner`). */
export function pullRoomWall<G extends ShapeGraph>(input: { graph: G; id: string; wall: number; center: number; width: number; depth: number; minEdge?: number; noOverlap?: boolean; ignoreIds?: string[]; alone?: boolean }): ShapeResult<G> {
  const g = input.graph, r = g.rooms.find((x) => x.id === input.id), fail = (m: string): ShapeResult<G> => ({ graph: g, ok: false, message: m, id: input.id });
  if (!r || !r.layout) return fail('Room not found.');
  const o = shapeOfRoom(r), w = outlineWalls(o)[input.wall];
  if (!w) return fail('No such wall.');
  if (Math.abs(input.depth) < 0.2 - 1e-9) return fail('A bump or notch needs at least 0.2 m.');
  const lo = Math.max(w.from, input.center - input.width / 2), hi = Math.min(w.to, input.center + input.width / 2), nameOf = (id: string) => { const x = g.rooms.find((q) => q.id === id); return x ? x.name || x.id : id; }, outside = (id: string) => (input.ignoreIds || []).indexOf(id) >= 0 || String(nameOf(id)).toLowerCase() === 'outside';
  const partners = shapeWallPartners(g, r, o, input.wall, lo, hi, input.ignoreIds, !input.alone);
  if (partners.some(outside) || (input.alone && partners.length)) return fail('This part of the wall is connected to ' + partners.map(nameOf).join(', ') + '. Detach the connection first (Alt-drag a room in a Slide mode) or use Drag walls.');
  if (partners.length > 1) return fail('This part of the wall is shared with several rooms (' + partners.map(nameOf).join(', ') + '). Hold Alt to move only this room.');
  const n = outlineBump(o, input.wall, input.center, input.width, input.depth, input.minEdge);
  if (!n) return fail('That would cut the room apart, make a wall shorter than ' + (input.minEdge ?? 0.3) + ' m, or the bump is too narrow.');
  if (partners.length === 1) return reshapeWithPartner({ graph: g, id: input.id, outline: n, partner: partners[0]!, wall: input.wall, from: lo, to: hi, shift: w.side === 'right' || w.side === 'bottom' ? input.depth : -input.depth, noOverlap: input.noOverlap, ignoreIds: input.ignoreIds });
  return reshapeRoom({ graph: g, id: input.id, outline: n, noOverlap: input.noOverlap, ignoreIds: input.ignoreIds });
}

/**
 * A shared wall moves for both rooms (v2.18 phase 7): room `id` gets the new shape `outline` (relative to its corner) by changing wall `wall` over the stretch `from`..`to` (along the wall from the room's corner), and the ONE
 * room `partner` it is connected to there follows: it loses what `id` gains and gains what `id` gives up next to its wall (only where it touched that part). `shift` is the signed world displacement of the wall (right / down
 * positive). Doors and windows on the moved stretch of both rooms move with the wall (same place along it, so connected pairs stay green); all other connectors keep their wall. Refused when the partner is size-locked (a
 * rectangle with the lock), would move its locked corner, would be cut apart, vanish or get a wall shorter / a part thinner than 0.3 m, when a door or window would be cut off, or (with `noOverlap`) when either room would
 * newly overlap a third room. Both rooms are changed in ONE result (one undo step for the caller).
 */
export function reshapeWithPartner<G extends ShapeGraph>(input: { graph: G; id: string; outline: Outline; partner: string; wall: number; from: number; to: number; shift: number; noOverlap?: boolean; ignoreIds?: string[] }): ShapeResult<G> {
  const g0 = input.graph, fail = (m: string): ShapeResult<G> => ({ graph: g0, ok: false, message: m, id: input.id });
  const a0 = g0.rooms.find((r) => r.id === input.id), p0 = g0.rooms.find((r) => r.id === input.partner);
  if (!a0 || !p0 || !a0.layout || !p0.layout) return fail('Room not found.');
  const A0 = a0.layout, P0 = p0.layout, nm = (r: SRoom) => r.name || r.id, rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const at = (s: Outline, x: number, y: number): Outline => s.map((q): [number, number] => [q[0] + x, q[1] + y]);
  const oldA = shapeOfRoom(a0), w = outlineWalls(oldA)[input.wall], newA = outlineNormalize(input.outline);
  if (!w) return fail('No such wall.');
  if (newA.length < 4 || outlineIssues(newA).length) return fail('That shape is not valid.');
  const aOld = at(oldA, A0.x, A0.y), aNew = at(newA, A0.x, A0.y), pOld = at(shapeOfRoom(p0), P0.x, P0.y), vertical = w.side === 'left' || w.side === 'right';
  const gained = outlineCombine(aNew, aOld, 'subtract'), lost = outlineCombine(aOld, aNew, 'subtract');
  if (gained.outlines.length > 1 || lost.outlines.length > 1 || gained.holes.length || lost.holes.length) return fail('That change is too complex to share with ' + nm(p0) + '.');
  let pNew: Outline = pOld;
  if (gained.outlines[0]) {
    const s = outlineCombine(pOld, gained.outlines[0], 'subtract');
    if (s.outlines.length !== 1 || s.holes.length) return fail(nm(p0) + ' would be cut apart or vanish.');
    pNew = s.outlines[0]!;
  }
  if (lost.outlines[0]) {
    const R = outlineBounds(lost.outlines[0]), band = outlineFromRect({ x: R.x - 0.02, y: R.y - 0.02, width: R.width + 0.04, height: R.height + 0.04 }), touch = outlineCombine(pOld, band, 'intersect');
    for (const t of touch.outlines) {
      const tb = outlineBounds(t), lo = vertical ? Math.max(tb.y, R.y) : Math.max(tb.x, R.x), hi = vertical ? Math.min(tb.y + tb.height, R.y + R.height) : Math.min(tb.x + tb.width, R.x + R.width);
      if (hi - lo < 1e-6) continue;
      const gain = vertical ? outlineFromRect({ x: R.x, y: lo, width: R.width, height: hi - lo }) : outlineFromRect({ x: lo, y: R.y, width: hi - lo, height: R.height }), u = outlineCombine(pNew, gain, 'union');
      if (u.outlines.length !== 1 || u.holes.length) return fail(nm(p0) + ' would not stay in one piece.');
      pNew = u.outlines[0]!;
    }
  }
  pNew = outlineNormalize(pNew);
  const pChanged = JSON.stringify(pNew) !== JSON.stringify(outlineNormalize(pOld));
  if (pChanged && (outlineIssues(pNew).length || outlineWalls(pNew).some((x) => x.length < 0.3 - 1e-6) || outlineThin(pNew, 0.3))) return fail(nm(p0) + ' would get a wall shorter than 0.3 m or a part thinner than 0.3 m.');
  if (pChanged && !p0.outline && (P0.sizeLocked ?? P0.locked === true)) return fail(nm(p0) + ' is size-locked: unlock its size to let the shared wall move.');
  // where every connector of both rooms stands before (world coordinate of its wall) and after (the moved stretch follows the wall)
  const sLo = (vertical ? A0.y : A0.x) + input.from, sHi = (vertical ? A0.y : A0.x) + input.to, cOld = (vertical ? A0.x : A0.y) + w.at, opp = w.side === 'left' ? 'right' : w.side === 'right' ? 'left' : w.side === 'top' ? 'bottom' : 'top';
  const expect = new Map<string, number>();
  for (const [r, L, side] of [[a0, A0, w.side], [p0, P0, opp]] as [SRoom, SLayout, string][]) {
    const S = shapeOfRoom(r);
    for (const c of r.connectors || []) {
      const horizontal = c.side === 'top' || c.side === 'bottom', len = horizontal ? L.width : L.height, off = c.offset ?? (c.position ?? 0.5) * len, cw = outlineWallAt(S, c.side, Math.max(0.05, Math.min(len - 0.05, off)), c.wallAt);
      if (!cw) continue;
      const wc = (horizontal ? L.y : L.x) + cw.at, along = (horizontal ? L.x : L.y) + off;
      expect.set(c.id, c.side === side && Math.abs(wc - cOld) < 1e-4 && along >= sLo - 1e-6 && along <= sHi + 1e-6 ? rnd(wc + input.shift) : rnd(wc));
    }
  }
  let g: G = g0;
  if (pChanged) {
    const rp = reshapeRoom({ graph: g, id: p0.id, outline: pNew.map((q): [number, number] => [q[0] - P0.x, q[1] - P0.y]) });
    if (!rp.ok) return fail(rp.message);
    g = rp.graph;
  }
  const ra = reshapeRoom({ graph: g, id: a0.id, outline: newA });
  if (!ra.ok) return fail(ra.message);
  g = ra.graph;
  for (const id of [a0.id, p0.id]) {
    const r = g.rooms.find((x) => x.id === id)!, L = r.layout!, S = shapeOfRoom(r);
    for (const c of r.connectors || []) {
      const e = expect.get(c.id);
      if (e === undefined) continue;
      const horizontal = c.side === 'top' || c.side === 'bottom', want = rnd(e - (horizontal ? L.y : L.x)), off = c.offset ?? 0, hit = outlineWallAt(S, c.side, off, want);
      if (!hit || Math.abs(hit.at - want) > 1e-4) return fail('A door or window of ' + nm(r) + ' would be cut off by that change.');
      const def = outlineWallAt(S, c.side, off);
      if (S.length > 4 && def && Math.abs(hit.at - def.at) > 1e-4) c.wallAt = want; else delete c.wallAt;
    }
  }
  if (input.noOverlap) {
    const skip = new Set(input.ignoreIds || []);
    for (const [id, before] of [[a0.id, aOld], [p0.id, pOld]] as [string, Outline][]) {
      const r = g.rooms.find((x) => x.id === id)!, now = at(shapeOfRoom(r), r.layout!.x, r.layout!.y);
      for (const o of g.rooms) {
        if (o.id === a0.id || o.id === p0.id || !o.layout || skip.has(o.id)) continue;
        const other = at(shapeOfRoom(o), o.layout.x, o.layout.y);
        if (outlineOverlapArea(now, other) > 1e-6 && outlineOverlapArea(before, other) <= 1e-6) return fail('The new shape would overlap ' + nm(o) + '. Untick "Block overlaps" to allow it.');
      }
    }
  }
  return { graph: g, ok: true, message: ra.message + (pChanged ? ' ' + nm(p0) + ' changed with it.' : ''), id: a0.id };
}

/**
 * Merges two rooms into one (v2.18 phase 6): the first id is the primary room (its id, name, type and other data stay), the second disappears. The rooms must lie on the same floor, must not overlap
 * and must share part of a wall (touching at a corner is not enough); their union has to be ONE shape without a hole, with no wall or part shorter / thinner than 0.3 m. The union becomes the
 * room's layout (bounding box) and `outline` (dropped when the union is a rectangle, otherwise the room is size-locked like every shaped room). Connectors keep their place on the floor (offsets and
 * `wallAt` are re-based); the connection(s) between the two rooms vanish with their connectors, as does a connector whose wall no longer exists, together with its relationships and joints and the entities
 * bound to it. Objects and entities of both rooms move to the merged room (positions re-based), wall alignments of the second room point to the primary room. A position-locked room must keep its corner.
 */
export function mergeRooms<G extends ShapeGraph>(input: { graph: G; ids: string[] }): ShapeResult<G> {
  const g0 = input.graph, ia = input.ids[0] || '', ib = input.ids[1] || '', fail = (m: string): ShapeResult<G> => ({ graph: g0, ok: false, message: m, id: ia });
  if (input.ids.length !== 2 || !ia || ia === ib) return fail('Select exactly two rooms to merge.');
  const a0 = g0.rooms.find((r) => r.id === ia), b0 = g0.rooms.find((r) => r.id === ib);
  if (!a0 || !b0 || !a0.layout || !b0.layout) return fail('Both rooms need a place on the plan.');
  const A0 = a0.layout, B0 = b0.layout, nm = (r: SRoom) => r.name || r.id, rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const pl = (l: SLayout) => l.positionLocked ?? l.locked === true, sl = (l: SLayout) => l.sizeLocked ?? l.locked === true;
  if ((a0.floor || '') !== (b0.floor || '')) return fail(nm(a0) + ' and ' + nm(b0) + ' are on different floors.');
  const at = (s: Outline, x: number, y: number): Outline => s.map((q): [number, number] => [q[0] + x, q[1] + y]);
  const wa = at(shapeOfRoom(a0), A0.x, A0.y), wb = at(shapeOfRoom(b0), B0.x, B0.y);
  if (outlineOverlapArea(wa, wb) > 1e-6) return fail(nm(a0) + ' and ' + nm(b0) + ' overlap. Move them apart so that they only share a wall.');
  const u = outlineCombine(wa, wb, 'union');
  if (u.outlines.length !== 1 || u.holes.length) return fail(nm(a0) + ' and ' + nm(b0) + ' must share part of a wall (use Close gaps first) and form one shape without a hole.');
  const un = u.outlines[0]!;
  if (outlineIssues(un).length || outlineWalls(un).some((w) => w.length < 0.3 - 1e-6) || outlineThin(un, 0.3)) return fail('The merged room would have a wall shorter than 0.3 m or a part thinner than 0.3 m.');
  const b = outlineBounds(un);
  for (const [r, L] of [[a0, A0], [b0, B0]] as [SRoom, SLayout][]) if (pl(L) && (Math.abs(L.x - b.x) > 1e-9 || Math.abs(L.y - b.y) > 1e-9)) return fail(nm(r) + ' is position-locked: the merged room would start at a different corner.');
  const rel = outlineNormalize(un.map((q): [number, number] => [q[0] - b.x, q[1] - b.y]));
  const dropConn = new Set<string>(), dropRel = new Set<string>(), owner = new Map<string, string>(), moved: SPort[] = [];
  for (const r of [a0, b0]) for (const c of r.connectors || []) owner.set(c.id, r.id);
  for (const l of g0.relationships || []) {
    const oa = owner.get(l.connectorA), ob = owner.get(l.connectorB);
    if (oa && ob && oa !== ob) { dropRel.add(l.id); dropConn.add(l.connectorA); dropConn.add(l.connectorB); }
  }
  const between = dropConn.size / 2;
  for (const src of [a0, b0]) {
    const S = shapeOfRoom(src), SL = src.layout!;
    for (const c0 of src.connectors || []) {
      if (dropConn.has(c0.id)) continue;
      const horizontal = c0.side === 'top' || c0.side === 'bottom', len0 = horizontal ? SL.width : SL.height, old = c0.offset ?? (c0.position ?? 0.5) * len0;
      const w0 = outlineWallAt(S, c0.side, Math.max(0.05, Math.min(len0 - 0.05, old)), c0.wallAt);
      if (!w0) { dropConn.add(c0.id); continue; }
      const wx = horizontal ? SL.x + old : SL.x + w0.at, wy = horizontal ? SL.y + w0.at : SL.y + old;
      const along = rnd(horizontal ? wx - b.x : wy - b.y), wall = rnd(horizontal ? wy - b.y : wx - b.x), w1 = outlineWallAt(rel, c0.side, along, wall);
      if (!w1 || Math.abs(w1.at - wall) > 1e-4) { dropConn.add(c0.id); continue; }
      const c = JSON.parse(JSON.stringify(c0)) as SPort, len1 = horizontal ? b.width : b.height;
      c.roomId = ia; c.offset = rnd(Math.max(0.05, Math.min(len1 - 0.05, along))); c.position = rnd(c.offset / len1);
      const def = rel.length > 4 ? outlineWallAt(rel, c.side, c.offset) : undefined;
      if (def && Math.abs(w1.at - def.at) > 1e-4) c.wallAt = rnd(w1.at); else delete c.wallAt;
      moved.push(c);
    }
  }
  for (const l of g0.relationships || []) if (dropConn.has(l.connectorA) || dropConn.has(l.connectorB)) dropRel.add(l.id);
  const g = JSON.parse(JSON.stringify(g0)) as G, ra = g.rooms.find((r) => r.id === ia)!, L = ra.layout!;
  const gs: ShapeGraph = g, posL = pl(A0) || pl(B0), sizeL = rel.length > 4 ? true : sl(A0);
  L.x = rnd(b.x); L.y = rnd(b.y); L.width = b.width; L.height = b.height; L.positionLocked = posL; L.sizeLocked = sizeL;
  if (posL && sizeL) L.locked = true; else delete L.locked;
  if (rel.length > 4) ra.outline = rel; else delete ra.outline;
  ra.connectors = moved;
  gs.rooms = gs.rooms.filter((r) => r.id !== ib);
  if (gs.relationships) gs.relationships = gs.relationships.filter((l) => !dropRel.has(l.id));
  if (gs.joints) gs.joints = gs.joints.filter((j) => !dropRel.has(j.relationshipId));
  const srcOf = (id?: string): SLayout | undefined => (id === ia ? A0 : id === ib ? B0 : undefined), nE = (g.entityPlacements || []).length;
  if (gs.entityPlacements) gs.entityPlacements = gs.entityPlacements.filter((e) => !(e.connectorId && dropConn.has(e.connectorId)));
  const gone = nE - (g.entityPlacements || []).length;
  for (const ob of g.objects || []) { const s = srcOf(ob.roomId); if (s) { ob.position = [rnd(s.x + ob.position[0] - b.x), rnd(s.y + ob.position[1] - b.y)]; ob.roomId = ia; } }
  for (const e of g.entityPlacements || []) { const s = srcOf(e.roomId); if (s && Array.isArray(e.position)) { e.position = [rnd(s.x + e.position[0]! - b.x), rnd(s.y + e.position[1]! - b.y)]; e.roomId = ia; } }
  if (gs.wallAlignments) gs.wallAlignments = gs.wallAlignments.map((a) => ({ ...a, roomIds: Array.from(new Set(a.roomIds.map((x) => (x === ib ? ia : x)))) })).filter((a) => a.roomIds.length >= 2);
  const lost = dropConn.size - between * 2;
  return { graph: g, ok: true, message: 'Merged ' + nm(b0) + ' into ' + nm(a0) + (rel.length > 4 ? ' (shaped room).' : ' (rectangle).') + (between ? ' ' + between + (between === 1 ? ' connection' : ' connections') + ' between them removed.' : '') + (lost ? ' ' + lost + (lost === 1 ? ' connector' : ' connectors') + ' on the vanished wall removed.' : '') + (gone ? ' ' + gone + (gone === 1 ? ' entity' : ' entities') + ' removed.' : ''), id: ia };
}
