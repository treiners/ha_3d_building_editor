import { outlineWalls } from './shape.js';
import { wallHeightOf } from './heights.js';
import type { HGraph } from './heights.js';

/**
 * Wall heights per wall (v3.2, Walls mode). A WALL is one side of one room (`roomId:side`, e.g. `kitchen:top`); a room with a shape (L, U, T) has several
 * segments on the same side, which share one height. Where the wall of one room touches the facing wall of another room (0.08 m, shared part longer than
 * 0.05 m) the two are ONE physical wall: `shared` lists the partner wall ids, and `setWallHeights` always sets both sides together, so a shared wall can
 * never get two heights from the editor. A wall without partner (outside, balcony, garden side) is free and changes alone.
 * The height itself lives in `room.wallHeights[side]` of every room involved (see heights.ts for the resolution order). Pure + deterministic, embedded
 * with toString(); sibling globals: `outlineWalls`, `wallHeightOf`, `wallList` (used by setWallHeights and sharedWallIssues). Rooms named `Outside` are ignored.
 */
interface WRoom { id: string; name?: string; floor?: string; layout?: { x: number; y: number; width: number; height: number }; outline?: [number, number][]; wallHeight?: number; wallHeights?: Partial<Record<string, number>> }
export interface WGraph extends HGraph { rooms?: WRoom[] }
export interface WallSeg { x1: number; y1: number; x2: number; y2: number }
export interface WallInfo { id: string; roomId: string; side: string; height: number; own: number | null; length: number; segs: WallSeg[]; shared: string[] }

/** All walls of all placed rooms, ordered by room, then side as the shape lists them. `height` is the resolved height, `own` the value stored on this wall (null = inherited). */
export function wallList(graph: WGraph): WallInfo[] {
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const map = new Map<string, WallInfo>(), order: string[] = [];
  for (const r of graph.rooms || []) {
    const L = r.layout;
    if (!L || String(r.name || '').toLowerCase() === 'outside') continue;
    const ol: [number, number][] = r.outline && r.outline.length >= 4 ? r.outline : [[0, 0], [L.width, 0], [L.width, L.height], [0, L.height]];
    for (const w of outlineWalls(ol)) {
      const id = r.id + ':' + w.side;
      let info = map.get(id);
      if (!info) {
        const o = r.wallHeights ? r.wallHeights[w.side] : undefined;
        info = { id, roomId: r.id, side: w.side, height: wallHeightOf(graph, r, w.side), own: typeof o === 'number' && o > 0 ? o : null, length: 0, segs: [], shared: [] };
        map.set(id, info); order.push(id);
      }
      const v = w.side === 'left' || w.side === 'right';
      info.segs.push(v ? { x1: rnd(L.x + w.at), y1: rnd(L.y + w.from), x2: rnd(L.x + w.at), y2: rnd(L.y + w.to) } : { x1: rnd(L.x + w.from), y1: rnd(L.y + w.at), x2: rnd(L.x + w.to), y2: rnd(L.y + w.at) });
      info.length = rnd(info.length + w.length);
    }
  }
  const list = order.map((id) => map.get(id) as WallInfo), OPP: Record<string, string> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const touch = (s: WallSeg, t: WallSeg) => {
    if (s.x1 === s.x2 && t.x1 === t.x2) return Math.abs(s.x1 - t.x1) <= 0.08 && Math.min(Math.max(s.y1, s.y2), Math.max(t.y1, t.y2)) - Math.max(Math.min(s.y1, s.y2), Math.min(t.y1, t.y2)) > 0.05;
    if (s.y1 === s.y2 && t.y1 === t.y2) return Math.abs(s.y1 - t.y1) <= 0.08 && Math.min(Math.max(s.x1, s.x2), Math.max(t.x1, t.x2)) - Math.max(Math.min(s.x1, s.x2), Math.min(t.x1, t.x2)) > 0.05;
    return false;
  };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i] as WallInfo, b = list[j] as WallInfo;
      if (a.roomId === b.roomId || OPP[a.side] !== b.side) continue;
      if (a.segs.some((s) => b.segs.some((t) => touch(s, t)))) { a.shared.push(b.id); b.shared.push(a.id); }
    }
  }
  for (const w of list) w.shared.sort();
  return list;
}

/**
 * Sets (or, with `height` null / 0, clears) the height of the given walls AND of their shared partners, 1..10 m rounded to 1 cm. Returns the ids that were changed
 * (selected walls plus partners). Unknown ids are skipped; nothing known -> not ok. The input graph is never mutated.
 */
export function setWallHeights<T extends WGraph>(input: { graph: T; ids: string[]; height: number | null }): { graph: T; ok: boolean; message: string; ids: string[] } {
  const by = new Map<string, WallInfo>();
  for (const w of wallList(input.graph)) by.set(w.id, w);
  const todo = new Set<string>();
  for (const id of input.ids) { const w = by.get(id); if (!w) continue; todo.add(id); for (const p of w.shared) todo.add(p); }
  if (!todo.size) return { graph: input.graph, ok: false, message: 'No such wall.', ids: [] };
  const v = input.height, h = typeof v === 'number' && isFinite(v) && v > 0 ? Math.round(Math.max(1, Math.min(10, v)) * 100) / 100 : 0;
  const g = JSON.parse(JSON.stringify(input.graph)) as T, ids = [...todo].sort();
  for (const id of ids) {
    const w = by.get(id) as WallInfo, r = (g.rooms || []).find((x) => x.id === w.roomId);
    if (!r) continue;
    const W: Partial<Record<string, number>> = r.wallHeights || {};
    if (h) W[w.side] = h; else delete W[w.side];
    if (Object.keys(W).length) r.wallHeights = W; else delete r.wallHeights;
  }
  const n = input.ids.filter((id) => by.has(id)).length, extra = ids.length - n;
  return { graph: g, ok: true, ids, message: (h ? 'Wall height ' + h + ' m set on ' : 'Wall height reset to the default on ') + n + (n === 1 ? ' wall' : ' walls') + (extra > 0 ? ' (+' + extra + ' shared ' + (extra === 1 ? 'side' : 'sides') + ' followed)' : '') + '.' };
}

/** Shared walls whose two sides have different heights (hand-edited files): `shared-wall-height`, one issue per pair, sorted by id. `roomId` is the room of the first wall. */
export function sharedWallIssues(graph: WGraph): { id: string; roomId: string; kind: string; code: string; message: string }[] {
  const list = wallList(graph), by = new Map<string, WallInfo>(), name = new Map<string, string>();
  for (const w of list) by.set(w.id, w);
  for (const r of graph.rooms || []) name.set(r.id, r.name || r.id);
  const out: { id: string; roomId: string; kind: string; code: string; message: string }[] = [];
  for (const w of list) for (const pid of w.shared) {
    const p = by.get(pid) as WallInfo;
    if (w.id < pid && Math.abs(w.height - p.height) > 0.005) out.push({ id: w.id, roomId: w.roomId, kind: 'room', code: 'shared-wall-height', message: 'Shared wall "' + name.get(w.roomId) + ' (' + w.side + ')" is ' + w.height + ' m high but "' + name.get(p.roomId) + ' (' + p.side + ')" is ' + p.height + ' m. Set it in the Walls mode.' });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
