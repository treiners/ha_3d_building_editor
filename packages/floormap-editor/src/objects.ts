/**
 * Objects (appliances, furniture) in rooms and areas: pure, deterministic functions on the graph keys `objects` and `objectTypes`
 * (see docs/V2.17-OBJECTS.md and docs/FILE-FORMAT.md). Every mutating function returns a NEW graph (the input is never mutated).
 *
 * Geometry: `position` = centre of the footprint in metres from the top-left corner of the host (room or area), x right, y down.
 * `width` runs across the front, `depth` from front to back; `facingDegrees` is the direction the front points to, clockwise from up
 * (0 = up / -y, 90 = right), exactly like `facingDegrees` of entities. At facing 0 the footprint is `width` along x and `depth` along y.
 *
 * Embedded into the editor page with toString(): no imports of values, helpers live inside the functions; sibling globals (all embedded
 * together, see embed.ts): `objectCatalog`, `objectDefs`, `objectFootprint`, `objectHost`, `objectHostAt`, `objectClamp`.
 */
import type { Area, ObjectPlacement, ObjectTypeDef } from './schema.js';
import type { Layout } from './core.js';

interface ObjConnector { id: string; side: string; offset?: number; width?: number; type?: string }
interface ObjRoom { id: string; name?: string; floor?: string; layout?: Layout; connectors?: ObjConnector[] }
/** The parts of a graph the object functions look at (a FloorplanGraph / WorkingGraph is assignable to it). */
export interface ObjectGraph {
  rooms?: ObjRoom[]; areas?: Area[]; objects?: ObjectPlacement[]; objectTypes?: ObjectTypeDef[];
  entityPlacements?: { id: string; objectId?: string }[];
  buildingDefaults?: { wallHeight?: number };
  _fl?: { cur: string; data: Record<string, { objects?: ObjectPlacement[] }> };
}
export interface ObjectResult<G> { graph: G; ok: boolean; message: string; id: string }
export interface ObjectIssue { id: string; code: string; message: string }
/** A room or an area as the place an object stands in (plan coordinates of its top-left corner and size). */
export interface ObjectHostRect { kind: 'room' | 'area'; id: string; x: number; y: number; width: number; height: number }
type Pt = [number, number];

/** Built-in object types, in metres. `clearance` = free space needed in front (door swing). */
export function objectCatalog(): Record<string, ObjectTypeDef> {
  return {
    refrigerator: { label: 'Refrigerator', category: 'appliance', width: 0.6, depth: 0.65, height: 1.85, clearance: 0.7 },
    freezer: { label: 'Freezer', category: 'appliance', width: 0.6, depth: 0.65, height: 1.4, clearance: 0.7 },
    stove: { label: 'Stove', category: 'appliance', width: 0.6, depth: 0.6, height: 0.9, clearance: 0.6 },
    dishwasher: { label: 'Dishwasher', category: 'appliance', width: 0.6, depth: 0.6, height: 0.85, clearance: 0.6 },
    microwave: { label: 'Microwave', category: 'appliance', width: 0.45, depth: 0.35, height: 0.28, elevation: 0.9 },
    'washing-machine': { label: 'Washing machine', category: 'appliance', width: 0.6, depth: 0.6, height: 0.85, clearance: 0.6 },
    dryer: { label: 'Dryer', category: 'appliance', width: 0.6, depth: 0.6, height: 0.85, clearance: 0.6 },
    'water-heater': { label: 'Water heater', category: 'appliance', width: 0.55, depth: 0.55, height: 1.5 },
    tv: { label: 'TV', category: 'appliance', width: 1.2, depth: 0.08, height: 0.7, elevation: 0.9 },
    sofa: { label: 'Sofa', category: 'furniture', width: 2, depth: 0.9, height: 0.85 },
    armchair: { label: 'Armchair', category: 'furniture', width: 0.85, depth: 0.85, height: 0.9 },
    'bed-single': { label: 'Single bed', category: 'furniture', width: 0.9, depth: 2, height: 0.5 },
    'bed-double': { label: 'Double bed', category: 'furniture', width: 1.6, depth: 2, height: 0.5 },
    wardrobe: { label: 'Wardrobe', category: 'furniture', width: 1, depth: 0.6, height: 2, clearance: 0.6 },
    table: { label: 'Table', category: 'furniture', width: 1.6, depth: 0.9, height: 0.75 },
    chair: { label: 'Chair', category: 'furniture', width: 0.45, depth: 0.45, height: 0.9 },
    desk: { label: 'Desk', category: 'furniture', width: 1.4, depth: 0.7, height: 0.75 },
    shelf: { label: 'Shelf', category: 'furniture', width: 0.8, depth: 0.3, height: 1.8 },
    counter: { label: 'Kitchen unit', category: 'furniture', width: 0.6, depth: 0.6, height: 0.9 },
  };
}

/** The built-in catalogue plus the custom types of the graph (`objectTypes`, matched by `id`, a custom type replaces a built-in one). */
export function objectDefs(graph: ObjectGraph): Record<string, ObjectTypeDef> {
  const out: Record<string, ObjectTypeDef> = { ...objectCatalog() };
  for (const t of graph.objectTypes || []) if (t && t.id) out[t.id] = { ...t };
  return out;
}

/** The four corners of the footprint relative to the host's top-left corner, clockwise from the front-left corner (at facing 0: top-left). Size defaults come from `defs[o.type]`. */
export function objectFootprint(
  o: { type?: string; position: Pt; width?: number; depth?: number; facingDegrees?: number },
  defs?: Record<string, ObjectTypeDef>,
): Pt[] {
  const d = defs && o.type ? defs[o.type] : undefined;
  const w = (o.width ?? d?.width ?? 0.5) / 2, h = (o.depth ?? d?.depth ?? 0.5) / 2;
  const a = (((o.facingDegrees ?? 0) % 360) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const corners: Pt[] = [[-w, -h], [w, -h], [w, h], [-w, h]];
  return corners.map(([x, y]): Pt => [rnd(o.position[0] + x * c - y * s), rnd(o.position[1] + x * s + y * c)]);
}

/** The free zone in front of an object (`clearance` of its type, e.g. a door swing) as four corners relative to the host's top-left corner, front edge first; empty when the type has no clearance. */
export function objectClearance(
  o: { type?: string; position: Pt; width?: number; depth?: number; facingDegrees?: number },
  defs?: Record<string, ObjectTypeDef>,
): Pt[] {
  const d = defs && o.type ? defs[o.type] : undefined, c = d?.clearance ?? 0;
  if (!(c > 0)) return [];
  const w = (o.width ?? d?.width ?? 0.5) / 2, h = (o.depth ?? d?.depth ?? 0.5) / 2;
  const a = (((o.facingDegrees ?? 0) % 360) * Math.PI) / 180, co = Math.cos(a), s = Math.sin(a);
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const corners: Pt[] = [[-w, -h - c], [w, -h - c], [w, -h], [-w, -h]];
  return corners.map(([x, y]): Pt => [rnd(o.position[0] + x * co - y * s), rnd(o.position[1] + x * s + y * co)]);
}

/**
 * Snap to walls: when an edge of the object's footprint (its axis-aligned bounds) is within `tol` metres (default 0.15) of a wall of the host under the
 * proposed centre (wx, wy), the centre is moved so the edge touches the wall; x and y are handled separately, the nearer wall wins. Pure; returns the
 * (possibly unchanged) plan centre and whether anything snapped. Unknown object or no host: unchanged.
 */
export function objectSnap(input: { graph: ObjectGraph; id: string; wx: number; wy: number; tol?: number }): { wx: number; wy: number; snapped: boolean } {
  const g = input.graph, o = (g.objects || []).find((x) => x.id === input.id), tol = (input.tol ?? 0.15) + 1e-9;
  const same = { wx: input.wx, wy: input.wy, snapped: false };
  if (!o) return same;
  const host = objectHostAt(g, input.wx, input.wy) || objectHost(g, o);
  if (!host) return same;
  const pts = objectFootprint({ ...o, position: [0, 0] }, objectDefs(g)), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const axis = (c: number, lo: number, hi: number, h0: number, h1: number): number | null => {
    const dl = Math.abs(c + lo - h0), dr = Math.abs(c + hi - h1);
    if (dl <= tol && dl <= dr) return rnd(h0 - lo);
    if (dr <= tol) return rnd(h1 - hi);
    return null;
  };
  const sx = axis(input.wx, Math.min(...xs), Math.max(...xs), host.x, host.x + host.width);
  const sy = axis(input.wy, Math.min(...ys), Math.max(...ys), host.y, host.y + host.height);
  return { wx: sx ?? input.wx, wy: sy ?? input.wy, snapped: sx !== null || sy !== null };
}

/** The room or area an object stands in (its plan rectangle), or null when the host does not exist or has no layout. */
export function objectHost(graph: ObjectGraph, o: { roomId?: string; areaId?: string }): ObjectHostRect | null {
  const r = o.roomId ? (graph.rooms || []).find((x) => x.id === o.roomId) : undefined;
  if (r && r.layout) return { kind: 'room', id: r.id, x: r.layout.x, y: r.layout.y, width: r.layout.width, height: r.layout.height };
  const a = o.areaId ? (graph.areas || []).find((x) => x.id === o.areaId) : undefined;
  if (a && a.layout) return { kind: 'area', id: a.id, x: a.layout.x, y: a.layout.y, width: a.layout.width, height: a.layout.height };
  return null;
}

/** The host under a plan point: rooms first (not `Outside`), then areas; the smallest one wins, then the id. Null when there is none. */
export function objectHostAt(graph: ObjectGraph, wx: number, wy: number): ObjectHostRect | null {
  const inside = (L: Layout) => wx >= L.x - 1e-9 && wx <= L.x + L.width + 1e-9 && wy >= L.y - 1e-9 && wy <= L.y + L.height + 1e-9;
  const pick = (list: ObjectHostRect[]) => list.sort((p, q) => p.width * p.height - q.width * q.height || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))[0] ?? null;
  const rooms: ObjectHostRect[] = [];
  for (const r of graph.rooms || []) {
    if (!r.layout || String(r.name).toLowerCase() === 'outside' || !inside(r.layout)) continue;
    rooms.push({ kind: 'room', id: r.id, x: r.layout.x, y: r.layout.y, width: r.layout.width, height: r.layout.height });
  }
  const room = pick(rooms);
  if (room) return room;
  const areas: ObjectHostRect[] = [];
  for (const a of graph.areas || []) if (a.layout && inside(a.layout)) areas.push({ kind: 'area', id: a.id, x: a.layout.x, y: a.layout.y, width: a.layout.width, height: a.layout.height });
  return pick(areas);
}

/** Moves the centre so that the whole footprint lies inside the host (an object larger than the host is centred). Returns the new relative position. */
export function objectClamp(
  o: { type?: string; position: Pt; width?: number; depth?: number; facingDegrees?: number },
  host: { width: number; height: number },
  defs?: Record<string, ObjectTypeDef>,
): Pt {
  const pts = objectFootprint(o, defs), rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const fit = (lo: number, hi: number, size: number) => (hi - lo > size + 1e-9 ? (size - (hi - lo)) / 2 - lo : lo < 0 ? -lo : hi > size ? size - hi : 0);
  return [rnd(o.position[0] + fit(x0, x1, host.width)), rnd(o.position[1] + fit(y0, y1, host.height))];
}

/** Adds an object of `type` with its centre at the plan point (wx, wy). The host is the room or area under the point; the footprint is kept inside it. */
export function addObject<G extends ObjectGraph>(input: { graph: G; type: string; wx: number; wy: number; facingDegrees?: number; name?: string }): ObjectResult<G> {
  const defs = objectDefs(input.graph);
  if (!defs[input.type]) return { graph: input.graph, ok: false, message: 'Unknown object type "' + input.type + '".', id: '' };
  const host = objectHostAt(input.graph, input.wx, input.wy);
  if (!host) return { graph: input.graph, ok: false, message: 'Place the object inside a room or an area.', id: '' };
  const g = JSON.parse(JSON.stringify(input.graph)) as ObjectGraph;
  const used = new Set<string>((g.objects || []).map((x) => x.id));
  for (const k of Object.keys(g._fl ? g._fl.data : {})) for (const x of g._fl!.data[k]!.objects || []) used.add(x.id);
  const base = (host.id + '-' + input.type).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  let id = base, n = 2;
  while (used.has(id)) id = base + '-' + n++;
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const o: ObjectPlacement = {
    id, type: input.type, ...(input.name ? { name: input.name } : {}),
    ...(host.kind === 'room' ? { roomId: host.id } : { areaId: host.id }),
    position: [rnd(input.wx - host.x), rnd(input.wy - host.y)],
    facingDegrees: ((((input.facingDegrees ?? 0) % 360) + 360) % 360) + 0,
  };
  o.position = objectClamp(o, host, defs);
  g.objects = [...(g.objects || []), o];
  return { graph: g as G, ok: true, message: 'Added ' + (input.name || defs[input.type]!.label) + '.', id };
}

/** Moves an object so that its centre is at the plan point; it changes room / area when the point is in another one. The footprint stays inside the host. */
export function moveObject<G extends ObjectGraph>(input: { graph: G; id: string; wx: number; wy: number }): ObjectResult<G> {
  const g0 = input.graph, o0 = (g0.objects || []).find((x) => x.id === input.id);
  if (!o0) return { graph: g0, ok: false, message: 'No such object.', id: input.id };
  const defs = objectDefs(g0), host = objectHostAt(g0, input.wx, input.wy) || objectHost(g0, o0);
  if (!host) return { graph: g0, ok: false, message: 'The object has no room or area.', id: input.id };
  const g = JSON.parse(JSON.stringify(g0)) as ObjectGraph, o = g.objects!.find((x) => x.id === input.id)!;
  delete o.roomId; delete o.areaId;
  if (host.kind === 'room') o.roomId = host.id; else o.areaId = host.id;
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  o.position = objectClamp({ ...o, position: [rnd(input.wx - host.x), rnd(input.wy - host.y)] }, host, defs);
  return { graph: g as G, ok: true, message: 'Moved.', id: input.id };
}

/** Changes properties of an object. Numbers are checked (size 0.05 to 10 m, height 0.02 to 4 m, elevation 0 to 3 m), the type must exist, the facing is normalised to 0..360, the footprint is kept inside the host. */
export function updateObject<G extends ObjectGraph>(input: {
  graph: G; id: string;
  patch: { name?: string; type?: string; width?: number; depth?: number; height?: number; elevation?: number; facingDegrees?: number; category?: 'appliance' | 'furniture'; position?: Pt };
}): ObjectResult<G> {
  const g0 = input.graph, p = input.patch, bad = (m: string): ObjectResult<G> => ({ graph: g0, ok: false, message: m, id: input.id });
  if (!(g0.objects || []).some((x) => x.id === input.id)) return bad('No such object.');
  const defs = objectDefs(g0), num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && isFinite(v) && v >= lo - 1e-9 && v <= hi + 1e-9;
  if (p.type !== undefined && !defs[p.type]) return bad('Unknown object type "' + p.type + '".');
  for (const [k, lo, hi] of [['width', 0.05, 10], ['depth', 0.05, 10], ['height', 0.02, 4], ['elevation', 0, 3]] as [keyof typeof p, number, number][]) if (p[k] !== undefined && !num(p[k], lo, hi)) return bad(k + ' must be between ' + lo + ' and ' + hi + ' m.');
  if (p.facingDegrees !== undefined && !num(p.facingDegrees, -3600, 3600)) return bad('facingDegrees must be a number.');
  if (p.position !== undefined && !(num(p.position[0], -1000, 1000) && num(p.position[1], -1000, 1000))) return bad('position must be two numbers.');
  if (p.category !== undefined && p.category !== 'appliance' && p.category !== 'furniture') return bad('category must be appliance or furniture.');
  const g = JSON.parse(JSON.stringify(g0)) as ObjectGraph, o = g.objects!.find((x) => x.id === input.id)!;
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  if (p.name !== undefined) { if (p.name) o.name = p.name; else delete o.name; }
  if (p.type !== undefined) o.type = p.type;
  if (p.category !== undefined) o.category = p.category;
  for (const k of ['width', 'depth', 'height', 'elevation'] as const) if (p[k] !== undefined) o[k] = rnd(p[k]!);
  if (p.facingDegrees !== undefined) o.facingDegrees = rnd(((p.facingDegrees % 360) + 360) % 360);
  if (p.position !== undefined) o.position = [rnd(p.position[0]), rnd(p.position[1])];
  const host = objectHost(g, o);
  if (host) o.position = objectClamp(o, host, defs);
  return { graph: g as G, ok: true, message: 'Updated.', id: input.id };
}

/** Adds a custom object type (`graph.objectTypes`). Without `label` it is called "New type" (or "<source> copy"); `from` copies size, category, elevation and clearance of an existing type. The id is a slug of the label, unique among all types. */
export function addObjectType<G extends ObjectGraph>(input: { graph: G; label?: string; from?: string }): ObjectResult<G> {
  const defs = objectDefs(input.graph), src = input.from ? defs[input.from] : undefined;
  if (input.from && !src) return { graph: input.graph, ok: false, message: 'Unknown object type "' + input.from + '".', id: '' };
  const label = (input.label || (src ? src.label + ' copy' : 'New type')).trim() || 'New type';
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'type';
  let id = base, n = 2;
  while (defs[id]) id = base + '-' + n++;
  const g = JSON.parse(JSON.stringify(input.graph)) as ObjectGraph;
  const t: ObjectTypeDef = { id, label, category: src?.category ?? 'furniture', width: src?.width ?? 0.5, depth: src?.depth ?? 0.5, height: src?.height ?? 0.8 };
  if (src?.elevation !== undefined) t.elevation = src.elevation;
  if (src?.clearance !== undefined) t.clearance = src.clearance;
  g.objectTypes = [...(g.objectTypes || []), t];
  return { graph: g as G, ok: true, message: 'Added type ' + label + '.', id };
}

/** Edits the defaults of a type. A built-in type gets an override entry in `objectTypes` (same id) that replaces it; objects without their own size follow. Numbers are checked (size 0.05 to 10 m, height 0.02 to 4 m, elevation and clearance 0 to 3 m); clearance 0 removes it. */
export function updateObjectType<G extends ObjectGraph>(input: {
  graph: G; id: string;
  patch: { label?: string; category?: 'appliance' | 'furniture'; width?: number; depth?: number; height?: number; elevation?: number; clearance?: number };
}): ObjectResult<G> {
  const g0 = input.graph, p = input.patch, cur = objectDefs(g0)[input.id], bad = (m: string): ObjectResult<G> => ({ graph: g0, ok: false, message: m, id: input.id });
  if (!cur) return bad('No such type.');
  const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && isFinite(v) && v >= lo - 1e-9 && v <= hi + 1e-9;
  for (const [k, lo, hi] of [['width', 0.05, 10], ['depth', 0.05, 10], ['height', 0.02, 4], ['elevation', 0, 3], ['clearance', 0, 3]] as [keyof typeof p, number, number][]) if (p[k] !== undefined && !num(p[k], lo, hi)) return bad(k + ' must be between ' + lo + ' and ' + hi + ' m.');
  if (p.label !== undefined && !String(p.label).trim()) return bad('The name must not be empty.');
  if (p.category !== undefined && p.category !== 'appliance' && p.category !== 'furniture') return bad('category must be appliance or furniture.');
  const g = JSON.parse(JSON.stringify(g0)) as ObjectGraph, list = g.objectTypes || [], rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  let t = list.find((x) => x.id === input.id);
  if (!t) { t = { ...cur, id: input.id }; list.push(t); }
  if (p.label !== undefined) t.label = String(p.label).trim();
  if (p.category !== undefined) t.category = p.category;
  for (const k of ['width', 'depth', 'height', 'elevation'] as const) if (p[k] !== undefined) t[k] = rnd(p[k]!);
  if (p.clearance !== undefined) { if (p.clearance > 0) t.clearance = rnd(p.clearance); else delete t.clearance; }
  g.objectTypes = list;
  return { graph: g as G, ok: true, message: 'Updated type ' + t.label + '.', id: input.id };
}

/** Deletes a custom type, or removes the override of a built-in one (back to its default). Refused for a built-in type without override and for a custom type that objects (on any floor) still use. */
export function removeObjectType<G extends ObjectGraph>(input: { graph: G; id: string }): ObjectResult<G> {
  const g0 = input.graph, own = (g0.objectTypes || []).find((t) => t.id === input.id), builtin = !!objectCatalog()[input.id];
  const bad = (m: string): ObjectResult<G> => ({ graph: g0, ok: false, message: m, id: input.id });
  if (!own) return bad(builtin ? 'Built-in types cannot be deleted.' : 'No such type.');
  if (!builtin) {
    let n = (g0.objects || []).filter((o) => o.type === input.id).length;
    for (const k of Object.keys(g0._fl ? g0._fl.data : {})) n += (g0._fl!.data[k]!.objects || []).filter((o) => o.type === input.id).length;
    if (n) return bad(n + (n === 1 ? ' object uses' : ' objects use') + ' this type: change or delete them first.');
  }
  const g = JSON.parse(JSON.stringify(g0)) as ObjectGraph;
  g.objectTypes = (g.objectTypes || []).filter((t) => t.id !== input.id);
  if (!g.objectTypes.length) delete g.objectTypes;
  return { graph: g as G, ok: true, message: builtin ? 'Reset ' + (own.label || input.id) + ' to its default.' : 'Deleted type ' + (own.label || input.id) + '.', id: input.id };
}

/** Removes an object and the entities that are attached to it (`objectId`). */
export function removeObject<G extends ObjectGraph>(input: { graph: G; id: string }): ObjectResult<G> {
  const o = (input.graph.objects || []).find((x) => x.id === input.id);
  if (!o) return { graph: input.graph, ok: false, message: 'No such object.', id: input.id };
  const g = JSON.parse(JSON.stringify(input.graph)) as ObjectGraph;
  g.objects = (g.objects || []).filter((x) => x.id !== input.id);
  const ne = (g.entityPlacements || []).length;
  if (ne) g.entityPlacements = (g.entityPlacements || []).filter((e) => e.objectId !== input.id);
  const nr = ne - (g.entityPlacements || []).length;
  return { graph: g as G, ok: true, message: 'Deleted ' + (o.name || o.type) + '.' + (nr ? ' ' + nr + (nr === 1 ? ' entity' : ' entities') + ' removed.' : ''), id: input.id };
}

/**
 * Problems of the objects of a graph: unknown-type, no-host (the room or area is missing), outside (the footprint leaves its host),
 * overlap (with another object of the same height range), blocks-door (the footprint is in front of a door or open passage), too-high
 * (higher than the wall height). One issue per object and code; overlap is reported on the object that comes later by id.
 * Only doors count for blocks-door; open passages are free (v2.17 phase 3).
 */
export function validateObjects(graph: ObjectGraph): ObjectIssue[] {
  const out: ObjectIssue[] = [], defs = objectDefs(graph), list = [...(graph.objects || [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const wallH = typeof graph.buildingDefaults?.wallHeight === 'number' ? graph.buildingDefaults.wallHeight : 2.4, EPS = 1e-6;
  const add = (id: string, code: string, message: string) => out.push({ id, code, message });
  const label = (o: ObjectPlacement) => o.name || defs[o.type]?.label || o.id;
  /** Separating axis test for two convex polygons: true when they overlap by more than EPS. */
  const overlap = (A: Pt[], B: Pt[]): boolean => {
    for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
      const p = P[i]!, q = P[(i + 1) % P.length]!, ax = -(q[1] - p[1]), ay = q[0] - p[0];
      const pr = (S: Pt[]) => { const v = S.map((s) => s[0] * ax + s[1] * ay); return [Math.min(...v), Math.max(...v)] as Pt; };
      const a = pr(A), b = pr(B), len = Math.hypot(ax, ay) || 1;
      if ((Math.min(a[1], b[1]) - Math.max(a[0], b[0])) / len <= EPS) return false;
    }
    return true;
  };
  const world = list.map((o) => {
    const host = objectHost(graph, o), d = defs[o.type], z0 = o.elevation ?? d?.elevation ?? 0, z1 = z0 + (o.height ?? d?.height ?? 0);
    const rel = objectFootprint(o, defs);
    return { o, host, d, z0, z1, poly: host ? rel.map((p): Pt => [p[0] + host.x, p[1] + host.y]) : [] };
  });
  for (const w of world) {
    const { o, host, d } = w;
    if (!d) { add(o.id, 'unknown-type', 'Unknown object type "' + o.type + '".'); continue; }
    if (!host) { add(o.id, 'no-host', 'Its room or area does not exist.'); continue; }
    const xs = w.poly.map((p) => p[0]), ys = w.poly.map((p) => p[1]);
    if (Math.min(...xs) < host.x - EPS || Math.max(...xs) > host.x + host.width + EPS || Math.min(...ys) < host.y - EPS || Math.max(...ys) > host.y + host.height + EPS) add(o.id, 'outside', 'Reaches outside its ' + host.kind + '.');
    if (w.z1 > wallH + EPS) add(o.id, 'too-high', 'Higher than the walls (' + Math.round(w.z1 * 100) / 100 + ' m).');
    const room = host.kind === 'room' ? (graph.rooms || []).find((r) => r.id === host.id) : undefined;
    for (const c of room?.connectors || []) {
      if (c.type !== 'door') continue; // open passages are free: furniture may stand in them
      if (w.z0 >= 2 - EPS) continue;
      const cw = c.width && c.width > 0 ? c.width : 0.9, dep = Math.min(cw, 0.9), off = c.offset ?? 0;
      const zone: Pt[] = c.side === 'top' ? [[host.x + off - cw / 2, host.y], [host.x + off + cw / 2, host.y], [host.x + off + cw / 2, host.y + dep], [host.x + off - cw / 2, host.y + dep]]
        : c.side === 'bottom' ? [[host.x + off - cw / 2, host.y + host.height - dep], [host.x + off + cw / 2, host.y + host.height - dep], [host.x + off + cw / 2, host.y + host.height], [host.x + off - cw / 2, host.y + host.height]]
        : c.side === 'left' ? [[host.x, host.y + off - cw / 2], [host.x + dep, host.y + off - cw / 2], [host.x + dep, host.y + off + cw / 2], [host.x, host.y + off + cw / 2]]
        : [[host.x + host.width - dep, host.y + off - cw / 2], [host.x + host.width, host.y + off - cw / 2], [host.x + host.width, host.y + off + cw / 2], [host.x + host.width - dep, host.y + off + cw / 2]];
      if (overlap(w.poly, zone)) { add(o.id, 'blocks-door', 'Stands in front of the ' + (c.type === 'door' ? 'door' : 'passage') + ' "' + c.id + '".'); break; }
    }
  }
  for (let i = 0; i < world.length; i++) for (let j = i + 1; j < world.length; j++) {
    const a = world[i]!, b = world[j]!;
    if (!a.host || !b.host || !a.d || !b.d) continue;
    if (Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) <= EPS) continue;
    if (overlap(a.poly, b.poly)) add(b.o.id, 'overlap', 'Overlaps ' + label(a.o) + '.');
  }
  return out;
}

/** For saving: writes the defaults of the type into every object (name, category, width, depth, height, elevation, facingDegrees) and rounds the position. Unknown types are left as they are. */
export function fillObjectDefaults<G extends ObjectGraph>(graph: G): G {
  const g = JSON.parse(JSON.stringify(graph)) as ObjectGraph;
  if (!(g.objects || []).length) return g as G;
  const defs = objectDefs(g), rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  for (const o of g.objects!) {
    const d = defs[o.type];
    if (d) {
      if (!o.name) o.name = d.label;
      if (!o.category) o.category = d.category;
      if (typeof o.width !== 'number') o.width = d.width;
      if (typeof o.depth !== 'number') o.depth = d.depth;
      if (typeof o.height !== 'number') o.height = d.height;
      if (typeof o.elevation !== 'number') o.elevation = d.elevation ?? 0;
    }
    if (typeof o.facingDegrees !== 'number') o.facingDegrees = 0;
    o.position = [rnd(o.position[0]), rnd(o.position[1])];
  }
  return g as G;
}
