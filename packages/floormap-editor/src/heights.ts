/**
 * Heights (v3.2): height of a room above the floor baseline of its floor (`room.elevation`, areas have the same key), and wall heights.
 * Wall height resolution, first one that is set wins: `room.wallHeights[side]` > `room.wallHeight` > height of the room's floor > `buildingDefaults.wallHeight` > 2.4 m.
 * `elevation` default 0 (a raised deck, a step-up room; sunken floors are not supported: 0..10 m). All keys are optional and only written when they differ from the default.
 * Pure + deterministic, embedded into the editor with toString(): helpers inside the functions; sibling global of `heightIssues`: `wallHeightOf`.
 */

interface HConn { id: string; side: string; type: string; window?: { headHeight?: number } }
interface HRoom { id: string; name?: string; floor?: string; elevation?: number; wallHeight?: number; wallHeights?: Partial<Record<string, number>>; connectors?: HConn[] }
/** The parts of a graph that the height functions read. */
export interface HGraph {
  rooms?: HRoom[];
  areas?: { id: string; name?: string; elevation?: number }[];
  floors?: { id: string; height?: number }[];
  buildingDefaults?: { wallHeight?: number };
}
export interface HeightPatch { elevation?: number | null; wallHeight?: number | null; wallHeights?: Partial<Record<string, number | null>> }

/** Floor height of a room above its floor baseline, metres (0 when absent or not a number). */
export function roomElevation(room: { elevation?: number } | null | undefined): number {
  const v = room ? room.elevation : undefined;
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/** Height in metres of one wall (`top` | `right` | `bottom` | `left`) of a room, see the resolution order in the file header. */
export function wallHeightOf(graph: HGraph | null | undefined, room: HRoom | null | undefined, side: string): number {
  const pos = (v: unknown): number => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
  const own = room && room.wallHeights ? pos(room.wallHeights[side]) : 0;
  if (own) return own;
  const rh = room ? pos(room.wallHeight) : 0;
  if (rh) return rh;
  const fl = (graph && graph.floors) || [], f = fl.find((x) => !!room && x.id === room.floor) || fl[0], fh = f ? pos(f.height) : 0;
  if (fh) return fh;
  return pos(graph && graph.buildingDefaults && graph.buildingDefaults.wallHeight) || 2.4;
}

/**
 * Sets heights of one room. `patch`: `elevation` (0..10 m, 0 / null removes it), `wallHeight` (1..10 m, null / 0 removes it) and
 * `wallHeights` `{ top?, right?, bottom?, left? }` (same rules per wall; a side that is not in the patch is left alone). Values are rounded to 1 cm.
 */
export function setRoomHeights<T extends HGraph>(input: { graph: T; roomId: string; patch: HeightPatch }): { graph: T; ok: boolean; message: string } {
  const g = JSON.parse(JSON.stringify(input.graph)) as T, r = (g.rooms || []).find((x) => x.id === input.roomId), P = input.patch || {};
  if (!r) return { graph: input.graph, ok: false, message: 'No such room.' };
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v), rnd = (v: number) => Math.round(v * 100) / 100 + 0;
  const wall = (v: unknown): number => (isNum(v) && v > 0 ? rnd(Math.max(1, Math.min(10, v))) : 0);
  if ('elevation' in P) { const e = isNum(P.elevation) ? rnd(Math.max(0, Math.min(10, P.elevation))) : 0; if (e) r.elevation = e; else delete r.elevation; }
  if ('wallHeight' in P) { const h = wall(P.wallHeight); if (h) r.wallHeight = h; else delete r.wallHeight; }
  const PW = P.wallHeights;
  if (PW && typeof PW === 'object') {
    const W: Partial<Record<string, number>> = r.wallHeights || {};
    for (const s of ['top', 'right', 'bottom', 'left']) {
      if (!(s in PW)) continue;
      const h = wall(PW[s]);
      if (h) W[s] = h; else delete W[s];
    }
    if (Object.keys(W).length) r.wallHeights = W; else delete r.wallHeights;
  }
  return { graph: g, ok: true, message: 'Heights of "' + (r.name || r.id) + '" updated.' };
}

/** Problems with heights (sorted by id, then code): `elevation-range` (room or area outside 0..10 m), `window-above-wall` (window head higher than the wall it sits in). */
export function heightIssues(graph: HGraph): { id: string; kind: string; code: string; message: string }[] {
  const out: { id: string; kind: string; code: string; message: string }[] = [];
  const bad = (v: number | undefined) => typeof v === 'number' && (!isFinite(v) || v < 0 || v > 10);
  for (const r of graph.rooms || []) {
    if (bad(r.elevation)) out.push({ id: r.id, kind: 'room', code: 'elevation-range', message: 'Room "' + (r.name || r.id) + '": height from floor ' + r.elevation + ' m is outside 0..10 m.' });
    for (const c of r.connectors || []) {
      const head = c.window ? c.window.headHeight : undefined;
      if (c.type !== 'window' || typeof head !== 'number') continue;
      const h = wallHeightOf(graph, r, c.side);
      if (head > h + 1e-6) out.push({ id: c.id, kind: 'connector', code: 'window-above-wall', message: 'Window "' + c.id + '": head ' + head + ' m is higher than its wall (' + h + ' m).' });
    }
  }
  for (const a of graph.areas || []) if (bad(a.elevation)) out.push({ id: a.id, kind: 'area', code: 'elevation-range', message: 'Area "' + (a.name || a.id) + '": height from floor ' + a.elevation + ' m is outside 0..10 m.' });
  return out.sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : p.code < q.code ? -1 : p.code > q.code ? 1 : 0));
}
