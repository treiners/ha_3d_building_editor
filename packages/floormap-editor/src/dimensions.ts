/**
 * Dimensions and areas (v2.19): pure helpers behind the optional wall-length labels, the room-area labels and the Areas card in the Building tab. Nothing is stored in the file:
 * everything is derived from the room layouts and shapes (an L room is measured on its outline). The `Outside` room and rooms without a layout are never counted.
 * Embedded into the editor HTML with toString(): no imports of values, helpers inside the functions; siblings: `shapeOfRoom`, `outlineArea`, `outlineWalls`.
 */
import { outlineArea, outlineWalls } from './shape.js';
import type { Outline } from './shape.js';
import { shapeOfRoom } from './room-shape.js';

interface DRoom { id: string; name?: string; floor?: string; layout?: { x: number; y: number; width: number; height: number }; outline?: Outline }
export interface RoomAreas { rooms: { id: string; name: string; floor: string; area: number }[]; floors: { floor: string; name: string; area: number; count: number }[]; total: number }

/** Floor area in m² (2 decimals) of every counted room, the sum per floor (in the order of `floors`, then of appearance) and the total. */
export function roomAreas(g: { rooms: DRoom[]; floors?: { id: string; name?: string }[] }): RoomAreas {
  const rnd = (v: number) => Math.round(v * 100) / 100 + 0, rooms: RoomAreas['rooms'] = [], order: string[] = (g.floors || []).map((f) => f.id);
  for (const r of g.rooms || []) {
    if (!r.layout || String(r.name || '').toLowerCase() === 'outside') continue;
    const floor = r.floor || '';
    if (order.indexOf(floor) < 0) order.push(floor);
    rooms.push({ id: r.id, name: r.name || r.id, floor, area: rnd(outlineArea(shapeOfRoom(r))) });
  }
  const floors: RoomAreas['floors'] = [];
  for (const f of order) {
    const mine = rooms.filter((r) => r.floor === f);
    if (!mine.length) continue;
    const def = (g.floors || []).find((x) => x.id === f);
    floors.push({ floor: f, name: (def && def.name) || f || 'Floor', area: rnd(mine.reduce((s, r) => s + r.area, 0)), count: mine.length });
  }
  return { rooms, floors, total: rnd(rooms.reduce((s, r) => s + r.area, 0)) };
}

/** One entry per wall of a room's shape (walls shorter than `minLength`, default 0.5 m, are left out): the wall's midpoint in plan coordinates, its length (2 decimals) and the side it faces. */
export function wallLabels(r: DRoom, minLength?: number): { x: number; y: number; length: number; side: string }[] {
  const L = r.layout, min = minLength ?? 0.5, out: { x: number; y: number; length: number; side: string }[] = [];
  if (!L) return out;
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  for (const w of outlineWalls(shapeOfRoom(r))) {
    if (w.length < min - 1e-9) continue;
    const vertical = w.side === 'left' || w.side === 'right', mid = (w.from + w.to) / 2;
    out.push({ x: rnd(L.x + (vertical ? w.at : mid)), y: rnd(L.y + (vertical ? mid : w.at)), length: Math.round(w.length * 100) / 100, side: w.side });
  }
  return out;
}
