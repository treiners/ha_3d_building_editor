import type { ObjectPlacement } from './schema.js';

/**
 * Floors (several storeys in one coordinate frame). Saved format: `graph.floors = [{ id, name, height?, elevation? }]` (bottom to top) and an optional
 * `room.floor` (absent = first floor); relationships, wall alignments, entities and objects follow their rooms. Files without `floors` are single-floor
 * and unchanged. While editing, the editor keeps ONLY the current floor in `graph.rooms / relationships / wallAlignments / entityPlacements`
 * (so every planner and tool works unchanged) and stores the other floors in the working-only key `graph._fl = { cur, data: { floorId: {...} } }`
 * (inside the graph, so undo / redo restore it). `floorsMerge` turns that back into the saved format (unique ids across floors).
 * Stairs (`graph.stairs`, see stairs.ts) are global: they belong to two floors and are never stashed.
 * All functions are pure (they return a new graph), embedded into the editor with toString(); `floorsAdd` / `floorsRemove` call the sibling `floorsSwitch`.
 */
export function floorsSplit(graph: any): any {
  const g: any = JSON.parse(JSON.stringify(graph));
  // 3.1 development format (stairs as a link between two rooms) -> stair rectangle covering the lower room, ascending to the right
  if (Array.isArray(g.stairs)) g.stairs = g.stairs.map((s: any) => {
    if (!s.lower || typeof s.lower !== 'object') return s;
    const lo = g.rooms.find((r: any) => r.id === s.lower.room), L = lo && lo.layout;
    return { id: s.id, lower: s.lower.floor, upper: s.upper.floor, x: L ? L.x : 0, y: L ? L.y : 0, length: L ? L.width : 3, width: L ? L.height : 1, direction: 'right' };
  });
  if (!Array.isArray(g.floors) || !g.floors.length) { delete g.floors; return g; }
  const ids: string[] = g.floors.map((f: any) => f.id), first = ids[0]!, fl = (r: any) => (ids.includes(r.floor) ? r.floor : first);
  const owner = new Map<string, string>(), cOwner = new Map<string, string>();
  for (const r of g.rooms) { owner.set(r.id, fl(r)); for (const c of r.connectors || []) cOwner.set(c.id, fl(r)); }
  const data: any = {};
  for (const id of ids) data[id] = { rooms: [], relationships: [], wallAlignments: [], entityPlacements: [], objects: [] };
  for (const r of g.rooms) { r.floor = fl(r); data[r.floor].rooms.push(r); }
  for (const l of g.relationships || []) data[cOwner.get(l.connectorA) || first].relationships.push(l);
  for (const a of g.wallAlignments || []) data[owner.get((a.roomIds || [])[0]) || first].wallAlignments.push(a);
  const keep: any[] = [];
  const oOwner = new Map<string, string>();
  for (const o of g.objects || []) if (o.roomId && owner.has(o.roomId)) oOwner.set(o.id, owner.get(o.roomId)!);
  for (const e of g.entityPlacements || []) { const f = e.roomId ? owner.get(e.roomId) : e.connectorId ? cOwner.get(e.connectorId) : e.objectId ? oOwner.get(e.objectId) : undefined; if (f && f !== first) data[f].entityPlacements.push(e); else keep.push(e); }
  g.rooms = data[first].rooms; g.relationships = data[first].relationships; g.wallAlignments = data[first].wallAlignments;
  if (g.entityPlacements) g.entityPlacements = keep;
  const keepO: ObjectPlacement[] = [];
  for (const o of g.objects || []) { const f = o.roomId ? owner.get(o.roomId) : undefined; if (f && f !== first) data[f].objects.push(o); else keepO.push(o); }
  if (g.objects) g.objects = keepO;
  delete data[first]; g._fl = { cur: first, data };
  return g;
}

export function floorsMerge(graph: any): any {
  const g: any = JSON.parse(JSON.stringify(graph));
  if (!g._fl) return g;
  const fl = g._fl, cur = fl.cur;
  const parts = g.floors.map((f: any) => (f.id === cur ? { id: cur, rooms: g.rooms, relationships: g.relationships, wallAlignments: g.wallAlignments, entityPlacements: g.entityPlacements || [], objects: g.objects || [] } : { id: f.id, ...fl.data[f.id] }));
  const sR = new Set<string>(), sC = new Set<string>(), sL = new Set<string>(), rooms: any[] = [], rel: any[] = [], al: any[] = [], ent: any[] = [], sO = new Set<string>(), objs: ObjectPlacement[] = [];
  const uniq = (id: string, seen: Set<string>, f: string) => { let n = id, k = 2; if (seen.has(n)) n = id + '-' + f; while (seen.has(n)) n = id + '-' + f + '-' + k++; seen.add(n); return n; };
  for (const p of parts) {
    const rm = new Map<string, string>(), cm = new Map<string, string>();
    for (const r of p.rooms) { rm.set(r.id, uniq(r.id, sR, p.id)); for (const c of r.connectors || []) cm.set(c.id, uniq(c.id, sC, p.id)); }
    for (const r of p.rooms) rooms.push({ ...r, id: rm.get(r.id), floor: p.id, connectors: (r.connectors || []).map((c: any) => ({ ...c, id: cm.get(c.id), roomId: rm.get(r.id) })) });
    for (const l of p.relationships) rel.push({ ...l, id: uniq(l.id, sL, p.id), connectorA: cm.get(l.connectorA) || l.connectorA, connectorB: cm.get(l.connectorB) || l.connectorB });
    for (const a of p.wallAlignments) al.push({ ...a, roomIds: (a.roomIds || []).map((x: string) => rm.get(x) || x) });
    const om = new Map<string, string>();
    for (const o of p.objects || []) om.set(o.id, uniq(o.id, sO, p.id));
    for (const e of p.entityPlacements) { const n = { ...e }; if (e.roomId) n.roomId = rm.get(e.roomId) || e.roomId; if (e.connectorId) n.connectorId = cm.get(e.connectorId) || e.connectorId; if (e.objectId) n.objectId = om.get(e.objectId) || e.objectId; ent.push(n); }
    for (const o of p.objects || []) objs.push({ ...o, id: om.get(o.id)!, ...(o.roomId ? { roomId: rm.get(o.roomId) || o.roomId } : {}) });
  }
  g.rooms = rooms; g.relationships = rel; g.wallAlignments = al;
  if (g.entityPlacements || ent.length) g.entityPlacements = ent;
  if (g.objects || objs.length) g.objects = objs;
  delete g._fl;
  return g;
}

export function floorsSwitch(graph: any, id: string): any {
  const g: any = JSON.parse(JSON.stringify(graph)), fl = g._fl;
  if (!fl || id === fl.cur || !fl.data[id]) return g;
  const rid = new Set<string>(g.rooms.map((r: any) => r.id)), cid = new Set<string>(g.rooms.flatMap((r: any) => (r.connectors || []).map((c: any) => c.id)));
  const allO: ObjectPlacement[] = g.objects || [], oMine = allO.filter((o) => o.roomId && rid.has(o.roomId)), oRest = allO.filter((o) => !oMine.includes(o)), oid = new Set<string>(oMine.map((o) => o.id));
  const all: any[] = g.entityPlacements || [], mine = all.filter(e => (e.roomId && rid.has(e.roomId)) || (e.connectorId && cid.has(e.connectorId)) || (e.objectId && oid.has(e.objectId))), rest = all.filter(e => !mine.includes(e));
  fl.data[fl.cur] = { rooms: g.rooms, relationships: g.relationships, wallAlignments: g.wallAlignments, entityPlacements: mine, objects: oMine };
  const t = fl.data[id]; delete fl.data[id];
  g.rooms = t.rooms; g.relationships = t.relationships; g.wallAlignments = t.wallAlignments;
  if (g.entityPlacements || t.entityPlacements.length) g.entityPlacements = [...rest, ...t.entityPlacements];
  if (g.objects || (t.objects || []).length) g.objects = [...oRest, ...(t.objects || [])];
  fl.cur = id;
  return g;
}

/** New floor above the current one (becomes current): empty with one placeholder room at the top-left of the plan, or `copy` = a copy of the current floor (ids get the new floor id as suffix, entities and stairs are not copied). */
export function floorsAdd(input: { graph: any; name?: string; copy?: boolean }): any {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  if (!g._fl) { g.floors = [{ id: 'floor-1', name: 'Floor 1' }]; g._fl = { cur: 'floor-1', data: {} }; for (const r of g.rooms) r.floor = 'floor-1'; }
  const floors: any[] = g.floors, used = new Set<string>(floors.map(f => f.id)); let n = floors.length + 1;
  while (used.has('floor-' + n)) n++;
  const id = 'floor-' + n, name = String(input.name || '').trim() || 'Floor ' + n, sfx = '-' + id;
  const at = floors.findIndex(f => f.id === g._fl.cur), h0 = floors[at].height;
  floors.splice(at + 1, 0, { id, name, ...(h0 ? { height: h0 } : {}) });
  if (input.copy) {
    g._fl.data[id] = {
      rooms: g.rooms.map((r: any) => ({ ...JSON.parse(JSON.stringify(r)), id: r.id + sfx, floor: id, connectors: (r.connectors || []).map((c: any) => ({ ...JSON.parse(JSON.stringify(c)), id: c.id + sfx, roomId: r.id + sfx })) })),
      relationships: g.relationships.map((l: any) => ({ ...l, id: l.id + sfx, connectorA: l.connectorA + sfx, connectorB: l.connectorB + sfx })),
      wallAlignments: g.wallAlignments.map((a: any) => ({ ...a, id: (a.id || 'align') + sfx, roomIds: (a.roomIds || []).map((x: string) => x + sfx) })), entityPlacements: [], objects: [],
    };
  } else {
    const vis = g.rooms.filter((r: any) => r.layout && String(r.name).toLowerCase() !== 'outside');
    const x = vis.length ? Math.min(...vis.map((r: any) => r.layout.x)) : 0, y = vis.length ? Math.min(...vis.map((r: any) => r.layout.y)) : 0;
    g._fl.data[id] = { rooms: [{ id: 'room-1' + sfx, name: 'Room 1', sizeCategory: 'medium', connectors: [], floor: id, layout: { x, y, width: 4, height: 3 } }], relationships: [], wallAlignments: [], entityPlacements: [], objects: [] };
  }
  return floorsSwitch(g, id);
}

/** Deletes the current floor with its rooms, entities and stairs (needs at least 2 floors); the floor below (or above for the first) becomes current. */
export function floorsRemove(graph: any): any {
  const g: any = JSON.parse(JSON.stringify(graph));
  if (!g._fl || g.floors.length < 2) return g;
  const cur = g._fl.cur, i = g.floors.findIndex((f: any) => f.id === cur), to = (g.floors[i - 1] || g.floors[i + 1]).id;
  const h = floorsSwitch(g, to);
  delete h._fl.data[cur]; h.floors = h.floors.filter((f: any) => f.id !== cur);
  if (h.stairs) { h.stairs = h.stairs.filter((s: any) => s.lower !== cur && s.upper !== cur); if (!h.stairs.length) delete h.stairs; }
  return h;
}

export function floorsRename(input: { graph: any; id: string; name: string }): any {
  const g: any = JSON.parse(JSON.stringify(input.graph)), f = (g.floors || []).find((x: any) => x.id === input.id), n = String(input.name || '').trim();
  if (f && n) f.name = n;
  return g;
}

/** Footprints of the visible rooms of the floor directly below the current one (for the ghost and for "Match below"); [] when there is none. */
export function floorsGhost(graph: any): { x: number; y: number; width: number; height: number; name: string }[] {
  if (!graph._fl) return [];
  const i = graph.floors.findIndex((f: any) => f.id === graph._fl.cur), below = i > 0 ? graph._fl.data[graph.floors[i - 1].id] : null;
  return below ? below.rooms.filter((r: any) => r.layout && String(r.name).toLowerCase() !== 'outside').map((r: any) => ({ x: r.layout.x, y: r.layout.y, width: r.layout.width, height: r.layout.height, name: r.name })) : [];
}

/** For saving: writes `height` of every floor (default `buildingDefaults.wallHeight`, else 2.4) and the derived `elevation` = height of the floor surface above the ground (ground floor 0, then the sum of height + floorThickness of the floors below). Graphs without `floors` are unchanged. */
export function floorsFill(graph: any): any {
  const g: any = JSON.parse(JSON.stringify(graph));
  if (!Array.isArray(g.floors)) return g;
  const b = g.buildingDefaults || {}, wh = typeof b.wallHeight === 'number' ? b.wallHeight : 2.4, ft = typeof b.floorThickness === 'number' ? b.floorThickness : 0.12;
  let z = 0;
  for (const f of g.floors) { if (typeof f.height !== 'number') f.height = wh; f.elevation = Math.round(z * 1e4) / 1e4 + 0; z += f.height + ft; }
  return g;
}
