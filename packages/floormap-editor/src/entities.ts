/**
 * Entity placement (lights, motion sensors, door contacts, ...): pure, deterministic functions on the graph key
 * `entityPlacements`. Every mutating function returns a NEW graph (the input is never mutated).
 * Positions are room-relative: metres from the room's top-left corner, x right, y down. `facingDegrees` is clockwise
 * from "up" on the plan (0 = up/-y, 90 = right), direction vector (sin a, -cos a).
 * Embedded into the editor HTML with toString(): no imports, helpers live inside the functions; sibling globals (all embedded together): `entityCatalog`, `entityWorld`, `updateEntity`.
 */
export interface EntityResult { graph: any; ok: boolean; message: string; id: string }

/** Type catalogue. `anchor`: 'room' (position inside a room) or 'connector' (bound to a connector). */
export function entityCatalog(): Record<string, any> {
  return {
    light: { label: 'Light', anchor: 'room', height: 2.2, directional: false },
    'motion-sensor': { label: 'Motion sensor', anchor: 'room', height: 2.1, directional: true, facingDegrees: 0, fieldOfViewDegrees: 100, range: 3.5 },
    camera: { label: 'Camera', anchor: 'room', height: 2.3, directional: true, facingDegrees: 0, fieldOfViewDegrees: 90, range: 8 },
    'environment-sensor': { label: 'Environment sensor', anchor: 'room', height: 1.5, directional: false, multi: { field: 'measures', options: ['temperature', 'humidity', 'co2', 'illuminance', 'pressure', 'voc'], default: ['temperature', 'humidity'] } },
    'smoke-detector': { label: 'Smoke / fire detector', anchor: 'room', height: 2.3, directional: false },
    thermostat: { label: 'Thermostat / TRV', anchor: 'room', height: 1.5, directional: false },
    'water-leak': { label: 'Water leak sensor', anchor: 'room', height: 0.1, directional: false },
    'door-contact': { label: 'Door contact', anchor: 'connector', connectorTypes: ['door'], directional: false },
    'window-contact': { label: 'Window contact', anchor: 'connector', connectorTypes: ['window'], directional: false },
    lock: { label: 'Lock', anchor: 'connector', connectorTypes: ['door'], directional: false },
    cover: { label: 'Blind / cover', anchor: 'connector', connectorTypes: ['window', 'door'], directional: false },
  };
}

/** World (plan) position of an entity: room anchor = room corner + position, connector anchor = the connector point. */
export function entityWorld(graph: any, e: any): { x: number; y: number; roomId: string } | null {
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  if (e.connectorId) {
    for (const r of graph.rooms) {
      const c = (r.connectors || []).find((p: any) => p.id === e.connectorId);
      if (!c || !r.layout) continue;
      const L = r.layout, horiz = c.side === 'top' || c.side === 'bottom', len = horiz ? L.width : L.height;
      const o = Math.max(0.05, Math.min(len - 0.05, typeof c.offset === 'number' ? c.offset : (typeof c.position === 'number' ? c.position : 0.5) * len));
      return { x: rnd(horiz ? L.x + o : c.side === 'left' ? L.x : L.x + L.width), y: rnd(horiz ? (c.side === 'top' ? L.y : L.y + L.height) : L.y + o), roomId: r.id };
    }
    return null;
  }
  const r = graph.rooms.find((x: any) => x.id === e.roomId);
  if (!r || !r.layout || !Array.isArray(e.position)) return null;
  return { x: rnd(r.layout.x + e.position[0]), y: rnd(r.layout.y + e.position[1]), roomId: r.id };
}

/** Polygon (apex first, then the arc) of the coverage sector; angles per `facingDegrees` convention. */
export function coverageSector(x: number, y: number, facingDegrees: number, fieldOfViewDegrees: number, range: number, steps?: number): number[][] {
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  const fov = Math.max(1, Math.min(360, fieldOfViewDegrees)), n = Math.max(2, steps || Math.ceil(fov / 10)), pts: number[][] = fov < 360 ? [[rnd(x), rnd(y)]] : [];
  for (let i = 0; i <= n; i++) {
    const a = ((facingDegrees - fov / 2 + (fov * i) / n) * Math.PI) / 180;
    pts.push([rnd(x + range * Math.sin(a)), rnd(y - range * Math.cos(a))]);
  }
  return pts;
}

/** Which anchor a pointer position hits: the smallest room containing it (room types) or the nearest matching connector within maxDist (connector types). */
export function nearestAnchor(graph: any, type: string, x: number, y: number, maxDist?: number): { roomId?: string; connectorId?: string; distance: number } | null {
  const cat = entityCatalog()[type];
  if (!cat) return null;
  if (cat.anchor === 'room') {
    let best: any = null, ba = Infinity;
    for (const r of graph.rooms) {
      const L = r.layout;
      if (!L || x < L.x - 1e-6 || x > L.x + L.width + 1e-6 || y < L.y - 1e-6 || y > L.y + L.height + 1e-6) continue;
      const a = L.width * L.height;
      if (a < ba - 1e-9 || (Math.abs(a - ba) <= 1e-9 && r.id < best.id)) { best = r; ba = a; }
    }
    return best ? { roomId: best.id, distance: 0 } : null;
  }
  const lim = maxDist ?? 0.6;
  let bestId = '', bd = Infinity;
  for (const r of graph.rooms) for (const c of r.connectors || []) {
    if ((cat.connectorTypes || []).indexOf(c.type) < 0) continue;
    const w = entityWorld(graph, { connectorId: c.id });
    if (!w) continue;
    const d = Math.hypot(w.x - x, w.y - y);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && c.id < bestId)) { bd = d; bestId = c.id; }
  }
  return bestId && bd <= lim ? { connectorId: bestId, distance: Math.round(bd * 1e4) / 1e4 + 0 } : null;
}

/** Adds an entity. Room types: roomId + `position` ([x,y] relative) or `at` (world point); connector types: connectorId. */
export function addEntity(input: { graph: any; type: string; roomId?: string; connectorId?: string; position?: number[]; at?: { x: number; y: number }; name?: string; id?: string; haEntityId?: string; step?: number }): EntityResult {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  const fail = (m: string): EntityResult => ({ graph: input.graph, ok: false, message: m, id: '' });
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  const cat = entityCatalog()[input.type];
  if (!cat) return fail('Unknown entity type "' + input.type + '".');
  const list: any[] = g.entityPlacements || (g.entityPlacements = []);
  const wallH = g.buildingDefaults?.wallHeight ?? 2.4;
  const e: any = { id: '', type: input.type };
  let anchorId = '';
  if (cat.anchor === 'connector') {
    const owner = g.rooms.find((r: any) => (r.connectors || []).some((c: any) => c.id === input.connectorId));
    const c = owner && owner.connectors.find((p: any) => p.id === input.connectorId);
    if (!c) return fail(cat.label + ' needs a connector.');
    if (cat.connectorTypes.indexOf(c.type) < 0) return fail(cat.label + ' only fits ' + cat.connectorTypes.join('/') + ' connectors.');
    if (list.some(o => o.type === input.type && o.connectorId === c.id)) return fail('That connector already has a ' + cat.label.toLowerCase() + '.');
    e.connectorId = c.id; anchorId = c.id;
  } else {
    const r = g.rooms.find((x: any) => x.id === input.roomId);
    if (!r || !r.layout) return fail('Pick a placed room.');
    const L = r.layout, st = input.step && input.step > 0 ? input.step : 0;
    let p = input.position ? [input.position[0], input.position[1]] : input.at ? [input.at.x - L.x, input.at.y - L.y] : [L.width / 2, L.height / 2];
    if (st) p = p.map(v => Math.round(v / st) * st);
    e.roomId = r.id; anchorId = r.id;
    e.position = [rnd(Math.max(0, Math.min(L.width, p[0]!))), rnd(Math.max(0, Math.min(L.height, p[1]!)))];
    e.height = rnd(Math.min(cat.height, wallH));
    if (cat.directional) { e.facingDegrees = cat.facingDegrees; e.fieldOfViewDegrees = cat.fieldOfViewDegrees; e.range = cat.range; }
    if (cat.multi) e[cat.multi.field] = cat.multi.default.slice();
  }
  if (input.name) e.name = input.name;
  if (input.haEntityId) e.haEntityId = input.haEntityId;
  const slug = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'entity';
  const base = slug(input.id || (anchorId + '-' + input.type));
  let id = base, n = 2;
  while (list.some(o => o.id === id)) id = base + '-' + n++;
  e.id = id;
  const ordered: any = { id: e.id, type: e.type }; for (const k of Object.keys(e)) if (!(k in ordered)) ordered[k] = e[k];
  list.push(ordered);
  return { graph: g, ok: true, message: 'Added ' + cat.label.toLowerCase() + ' "' + id + '".', id };
}

/** Moves a room-anchored entity to a world point. The room under the point becomes the parent (re-parent); outside every room it stays in its room, clamped. */
export function moveEntity(input: { graph: any; id: string; x: number; y: number; step?: number }): EntityResult {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  const fail = (m: string): EntityResult => ({ graph: input.graph, ok: false, message: m, id: input.id });
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  const e = (g.entityPlacements || []).find((o: any) => o.id === input.id);
  if (!e) return fail('No such entity.');
  if (e.connectorId) return fail('Connector entities follow their connector.');
  let best: any = null, ba = Infinity;
  for (const r of g.rooms) {
    const L = r.layout;
    if (!L || input.x < L.x - 1e-6 || input.x > L.x + L.width + 1e-6 || input.y < L.y - 1e-6 || input.y > L.y + L.height + 1e-6) continue;
    const a = L.width * L.height;
    if (a < ba - 1e-9 || (Math.abs(a - ba) <= 1e-9 && r.id < best.id)) { best = r; ba = a; }
  }
  const r = best || g.rooms.find((x: any) => x.id === e.roomId);
  if (!r || !r.layout) return fail('Room has no layout.');
  const L = r.layout, st = input.step && input.step > 0 ? input.step : 0, sn = (v: number) => (st ? Math.round(v / st) * st : v);
  const reparent = r.id !== e.roomId;
  e.roomId = r.id;
  e.position = [rnd(Math.max(0, Math.min(L.width, sn(input.x - L.x)))), rnd(Math.max(0, Math.min(L.height, sn(input.y - L.y))))];
  return { graph: g, ok: true, message: reparent ? 'Moved to ' + r.name + '.' : 'Moved.', id: e.id };
}

/** Edits fields of one entity: id (renamed, must stay unique), name, haEntityId, position (clamped), height (0..wallHeight), facing / field of view / range (directional types). */
export function updateEntity(input: { graph: any; id: string; patch: any }): EntityResult {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  const fail = (m: string): EntityResult => ({ graph: input.graph, ok: false, message: m, id: input.id });
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  const list: any[] = g.entityPlacements || [], e = list.find(o => o.id === input.id), P = input.patch || {};
  if (!e) return fail('No such entity.');
  const cat = entityCatalog()[e.type] || {}, wallH = g.buildingDefaults?.wallHeight ?? 2.4, num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : NaN);
  if (typeof P.id === 'string' && P.id !== e.id) {
    const id = P.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!id) return fail('The id cannot be empty.');
    if (list.some(o => o !== e && o.id === id)) return fail('Id "' + id + '" is already used.');
    e.id = id;
  }
  for (const k of ['name', 'haEntityId']) if (k in P) { if (P[k]) e[k] = String(P[k]); else delete e[k]; }
  if (e.roomId && Array.isArray(P.position)) {
    const r = g.rooms.find((x: any) => x.id === e.roomId), x = num(P.position[0]), y = num(P.position[1]);
    if (r && r.layout && !isNaN(x) && !isNaN(y)) e.position = [rnd(Math.max(0, Math.min(r.layout.width, x))), rnd(Math.max(0, Math.min(r.layout.height, y)))];
  }
  if (e.roomId && !isNaN(num(P.height))) e.height = rnd(Math.max(0, Math.min(wallH, P.height)));
  if (cat.directional) {
    if (!isNaN(num(P.facingDegrees))) e.facingDegrees = rnd(((P.facingDegrees % 360) + 360) % 360);
    if (!isNaN(num(P.fieldOfViewDegrees))) e.fieldOfViewDegrees = rnd(Math.max(10, Math.min(360, P.fieldOfViewDegrees)));
    if (!isNaN(num(P.range))) e.range = rnd(Math.max(0.5, Math.min(30, P.range)));
  }
  if (cat.multi && Array.isArray(P[cat.multi.field])) { const v = cat.multi.options.filter((o: string) => P[cat.multi.field].indexOf(o) >= 0); if (v.length) e[cat.multi.field] = v; }
  if (e.roomId && 'anchorCorner' in P) { if (['tl', 'tr', 'bl', 'br'].indexOf(P.anchorCorner) >= 0) e.anchorCorner = P.anchorCorner; else delete e.anchorCorner; }
  return { graph: g, ok: true, message: 'Updated "' + e.id + '".', id: e.id };
}

export function removeEntity(input: { graph: any; id: string }): EntityResult {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  const list: any[] = g.entityPlacements || [];
  if (!list.some(o => o.id === input.id)) return { graph: input.graph, ok: false, message: 'No such entity.', id: input.id };
  g.entityPlacements = list.filter(o => o.id !== input.id);
  return { graph: g, ok: true, message: 'Removed "' + input.id + '".', id: input.id };
}

/** Checks every entity; issues are sorted by id, then code. Codes: unknown-type, orphan, no-layout, outside-room, height-range, duplicate-id, type-mismatch, double-contact. */
export function validateEntities(graph: any): { id: string; code: string; message: string }[] {
  const out: { id: string; code: string; message: string }[] = [], cat = entityCatalog(), list: any[] = graph.entityPlacements || [], wallH = graph.buildingDefaults?.wallHeight ?? 2.4;
  const seen: Record<string, number> = {}, contactDoors: Record<string, string[]> = {};
  const add = (id: string, code: string, message: string) => out.push({ id, code, message });
  list.forEach((e, i) => {
    const id = String(e.id ?? '#' + i);
    seen[id] = (seen[id] || 0) + 1;
    const c = cat[e.type];
    if (!c) { add(id, 'unknown-type', 'Unknown type "' + e.type + '".'); return; }
    if (!!e.roomId === !!e.connectorId) { add(id, 'orphan', 'Needs exactly one of roomId / connectorId.'); return; }
    if (c.anchor === 'connector' && !e.connectorId) add(id, 'type-mismatch', c.label + ' must be bound to a connector.');
    if (c.anchor === 'room' && !e.roomId) add(id, 'type-mismatch', c.label + ' must sit in a room.');
    if (e.connectorId) {
      const owner = graph.rooms.find((r: any) => (r.connectors || []).some((p: any) => p.id === e.connectorId));
      const p = owner && owner.connectors.find((q: any) => q.id === e.connectorId);
      if (!p) { add(id, 'orphan', 'Connector "' + e.connectorId + '" does not exist.'); return; }
      if (c.connectorTypes && c.connectorTypes.indexOf(p.type) < 0) add(id, 'type-mismatch', c.label + ' on a ' + p.type + ' connector.');
      const l = (graph.relationships || []).find((k: any) => k.connectorA === p.id || k.connectorB === p.id);
      const key = l ? l.id : p.id;
      (contactDoors[e.type + '|' + key] = contactDoors[e.type + '|' + key] || []).push(id);
    } else {
      const r = graph.rooms.find((x: any) => x.id === e.roomId);
      if (!r) { add(id, 'orphan', 'Room "' + e.roomId + '" does not exist.'); return; }
      if (!r.layout) { add(id, 'no-layout', 'Room "' + r.name + '" is not placed.'); return; }
      const p = e.position;
      if (!Array.isArray(p) || p[0] < -1e-6 || p[1] < -1e-6 || p[0] > r.layout.width + 1e-6 || p[1] > r.layout.height + 1e-6) add(id, 'outside-room', 'Position is outside room "' + r.name + '".');
      if (typeof e.height === 'number' && (e.height < 0 || e.height > wallH + 1e-6)) add(id, 'height-range', 'Height ' + e.height + ' m is outside 0..' + wallH + ' m.');
      if (c.multi && Array.isArray(e[c.multi.field]) && e[c.multi.field].some((o: string) => c.multi.options.indexOf(o) < 0)) add(id, 'invalid-option', 'Unknown value in ' + c.multi.field + '.');
    }
  });
  for (const id of Object.keys(seen)) if (seen[id]! > 1) add(id, 'duplicate-id', 'Id used ' + seen[id] + ' times.');
  for (const k of Object.keys(contactDoors)) if (contactDoors[k]!.length > 1) for (const id of contactDoors[k]!) add(id, 'double-contact', 'Several ' + k.split('|')[0] + ' entities on the two connectors of one door.');
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

/** Converts all room-anchored positions between room-relative and plan coordinates and sets entitySettings.coordinates. Entities of missing rooms are kept as they are. */
export function convertEntityCoordinates(graph: any, to: string): any {
  const g: any = JSON.parse(JSON.stringify(graph)), rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  const from = (g.entitySettings && g.entitySettings.coordinates) === 'plan' ? 'plan' : 'room';
  if (from !== to) for (const e of g.entityPlacements || []) {
    const r = e.roomId && g.rooms.find((x: any) => x.id === e.roomId);
    if (!r || !r.layout || !Array.isArray(e.position)) continue;
    const s = to === 'room' ? -1 : 1;
    e.position = [rnd(e.position[0] + s * r.layout.x), rnd(e.position[1] + s * r.layout.y)];
  }
  g.entitySettings = { ...(g.entitySettings || {}), coordinates: to };
  return g;
}

/**
 * Keeps room-anchored entities at the same RELATIVE place when a room changes size: positions scale by newSize / oldSize per axis
 * (the top-left corner is the origin; moving a room changes nothing). `prev` = room sizes of the previous call (roomId -> [width, height]),
 * or null on the first call. Returns the graph (a copy only when something changed), the current sizes and the number of entities scaled.
 */
export function syncEntitySizes(graph: any, prev: Record<string, number[]> | null): { graph: any; sizes: Record<string, number[]>; changed: number } {
  const sizes: Record<string, number[]> = {};
  for (const r of graph.rooms) if (r.layout) sizes[r.id] = [r.layout.width, r.layout.height];
  const list: any[] = graph.entityPlacements || [];
  if (!prev || !list.length) return { graph, sizes, changed: 0 };
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0, anchor = !!graph.entitySettings && graph.entitySettings.resize === 'anchor';
  let g: any = null, changed = 0;
  list.forEach((e, i) => {
    const p = e.roomId && prev[e.roomId], s = e.roomId && sizes[e.roomId];
    if (!p || !s || !(p[0]! > 0) || !(p[1]! > 0) || !Array.isArray(e.position)) return;
    if (Math.abs(s[0]! - p[0]!) < 1e-9 && Math.abs(s[1]! - p[1]!) < 1e-9) return;
    if (!g) g = JSON.parse(JSON.stringify(graph));
    if (anchor) {
      const c = ['tl', 'tr', 'bl', 'br'].indexOf(e.anchorCorner) >= 0 ? e.anchorCorner : (e.position[1] > p[1]! / 2 ? 'b' : 't') + (e.position[0] > p[0]! / 2 ? 'r' : 'l');
      const x = e.position[0] + (c[1] === 'r' ? s[0]! - p[0]! : 0), y = e.position[1] + (c[0] === 'b' ? s[1]! - p[1]! : 0);
      g.entityPlacements[i].position = [rnd(Math.max(0, Math.min(s[0]!, x))), rnd(Math.max(0, Math.min(s[1]!, y)))];
    } else g.entityPlacements[i].position = [rnd((e.position[0] * s[0]!) / p[0]!), rnd((e.position[1] * s[1]!) / p[1]!)];
    changed++;
  });
  return { graph: g || graph, sizes, changed };
}

/** Ids of the entities whose world point lies inside the box (inclusive, corners in any order), in list order. Used by the selection rectangle and Ctrl+A. */
export function entitiesInBox(graph: any, x0: number, y0: number, x1: number, y1: number): string[] {
  const lx = Math.min(x0, x1) - 1e-6, hx = Math.max(x0, x1) + 1e-6, ly = Math.min(y0, y1) - 1e-6, hy = Math.max(y0, y1) + 1e-6;
  return (graph.entityPlacements || []).filter((e: any) => { const w = entityWorld(graph, e); return !!w && w.x >= lx && w.x <= hx && w.y >= ly && w.y <= hy; }).map((e: any) => e.id);
}

/** Moves several room-anchored entities by the same world offset. Each lands in the room under its new point (re-parent) or, outside every room, stays in its own room (clamped). Connector entities are skipped. */
export function moveEntities(input: { graph: any; ids: string[]; dx: number; dy: number }): EntityResult {
  const g: any = JSON.parse(JSON.stringify(input.graph)), rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  let n = 0;
  for (const e of g.entityPlacements || []) {
    if (input.ids.indexOf(e.id) < 0 || !e.roomId) continue;
    const w = entityWorld(g, e);
    if (!w) continue;
    const x = w.x + input.dx, y = w.y + input.dy;
    let best: any = null, ba = Infinity;
    for (const q of g.rooms) {
      const L = q.layout;
      if (!L || x < L.x - 1e-6 || x > L.x + L.width + 1e-6 || y < L.y - 1e-6 || y > L.y + L.height + 1e-6) continue;
      const a = L.width * L.height;
      if (a < ba - 1e-9 || (Math.abs(a - ba) <= 1e-9 && q.id < best.id)) { best = q; ba = a; }
    }
    const r = best || g.rooms.find((q: any) => q.id === e.roomId);
    if (!r || !r.layout) continue;
    e.roomId = r.id;
    e.position = [rnd(Math.max(0, Math.min(r.layout.width, x - r.layout.x))), rnd(Math.max(0, Math.min(r.layout.height, y - r.layout.y)))];
    n++;
  }
  return n ? { graph: g, ok: true, message: 'Moved ' + n + (n === 1 ? ' entity.' : ' entities.'), id: '' } : { graph: input.graph, ok: false, message: 'Nothing to move.', id: '' };
}

/** Removes several entities at once. */
export function removeEntities(input: { graph: any; ids: string[] }): EntityResult {
  const g: any = JSON.parse(JSON.stringify(input.graph)), list: any[] = g.entityPlacements || [];
  const gone = list.filter(e => input.ids.indexOf(e.id) >= 0);
  if (!gone.length) return { graph: input.graph, ok: false, message: 'No such entity.', id: '' };
  g.entityPlacements = list.filter(e => input.ids.indexOf(e.id) < 0);
  return { graph: g, ok: true, message: gone.length === 1 ? 'Removed "' + gone[0].id + '".' : 'Removed ' + gone.length + ' entities.', id: '' };
}

/**
 * Pastes copies of room-anchored entities. `items` = the clipboard ([{ entity, x, y }] with the world point at copy time); every copy lands at (x + dx, y + dy)
 * in the room under that point (or, outside every room, in its original room, clamped), snapped to `step`. Ids: trailing "-N" stripped, then the next free "-N".
 * Connector-bound entities are skipped. Returns the new ids.
 */
export function pasteEntities(input: { graph: any; items: { entity: any; x: number; y: number }[]; dx: number; dy: number; step?: number }): EntityResult & { ids: string[] } {
  const g: any = JSON.parse(JSON.stringify(input.graph)), list: any[] = g.entityPlacements || (g.entityPlacements = []), ids: string[] = [];
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0, st = input.step && input.step > 0 ? input.step : 0, sn = (v: number) => (st ? Math.round(v / st) * st : v);
  for (const it of input.items) {
    const src = it.entity;
    if (!src || !src.roomId) continue;
    const x = it.x + input.dx, y = it.y + input.dy;
    let best: any = null, ba = Infinity;
    for (const q of g.rooms) {
      const L = q.layout;
      if (!L || x < L.x - 1e-6 || x > L.x + L.width + 1e-6 || y < L.y - 1e-6 || y > L.y + L.height + 1e-6) continue;
      const a = L.width * L.height;
      if (a < ba - 1e-9 || (Math.abs(a - ba) <= 1e-9 && q.id < best.id)) { best = q; ba = a; }
    }
    const r = best || g.rooms.find((q: any) => q.id === src.roomId);
    if (!r || !r.layout) continue;
    const base = String(src.id).replace(/-\d+$/, '') || 'entity';
    let id = base, n = 2;
    while (list.some(o => o.id === id)) id = base + '-' + n++;
    const e = JSON.parse(JSON.stringify(src)), ordered: any = { id };
    e.roomId = r.id;
    e.position = [rnd(Math.max(0, Math.min(r.layout.width, sn(x - r.layout.x)))), rnd(Math.max(0, Math.min(r.layout.height, sn(y - r.layout.y))))];
    for (const k of Object.keys(e)) if (!(k in ordered)) ordered[k] = e[k];
    list.push(ordered);
    ids.push(id);
  }
  if (!ids.length) return { graph: input.graph, ok: false, message: 'Nothing to paste.', id: '', ids };
  return { graph: g, ok: true, message: 'Pasted ' + ids.length + (ids.length === 1 ? ' entity.' : ' entities.'), id: ids[0]!, ids };
}

/**
 * Aligns or distributes room-anchored entities by their world points. Modes: left, hcenter, right, top, vcenter, bottom (to the extreme / centre of the selection),
 * hdist, vdist (equal spacing between the two outermost, needs 3). Entities stay in their own room (clamped, never re-parented). Connector entities are ignored.
 */
export function alignEntities(input: { graph: any; ids: string[]; mode: string }): EntityResult {
  const g: any = JSON.parse(JSON.stringify(input.graph)), rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  const fail = (m: string): EntityResult => ({ graph: input.graph, ok: false, message: m, id: '' });
  const items: { e: any; r: any; x: number; y: number }[] = [];
  for (const e of g.entityPlacements || []) {
    if (input.ids.indexOf(e.id) < 0 || !e.roomId) continue;
    const w = entityWorld(g, e), r = g.rooms.find((q: any) => q.id === e.roomId);
    if (w && r && r.layout) items.push({ e, r, x: w.x, y: w.y });
  }
  const horiz = ['left', 'hcenter', 'right', 'hdist'].indexOf(input.mode) >= 0, vert = ['top', 'vcenter', 'bottom', 'vdist'].indexOf(input.mode) >= 0, dist = input.mode === 'hdist' || input.mode === 'vdist';
  if (!horiz && !vert) return fail('Unknown align mode.');
  if (items.length < (dist ? 3 : 2)) return fail(dist ? 'Distribute needs at least 3 entities in rooms.' : 'Align needs at least 2 entities in rooms.');
  const key: 'x' | 'y' = horiz ? 'x' : 'y', vals = items.map(i => i[key]), lo = Math.min(...vals), hi = Math.max(...vals), target = new Map<any, number>();
  if (dist) items.slice().sort((a, b) => a[key] - b[key] || (a.e.id < b.e.id ? -1 : 1)).forEach((it, i, s) => target.set(it, lo + ((hi - lo) * i) / (s.length - 1)));
  else for (const it of items) target.set(it, input.mode === 'left' || input.mode === 'top' ? lo : input.mode === 'right' || input.mode === 'bottom' ? hi : (lo + hi) / 2);
  for (const it of items) {
    const t = target.get(it)!, L = it.r.layout, p = it.e.position;
    it.e.position = horiz ? [rnd(Math.max(0, Math.min(L.width, t - L.x))), p[1]] : [p[0], rnd(Math.max(0, Math.min(L.height, t - L.y)))];
  }
  return { graph: g, ok: true, message: (dist ? 'Distributed ' : 'Aligned ') + items.length + ' entities.', id: '' };
}

/** Applies the shared fields of a multi-selection (height, facingDegrees, fieldOfViewDegrees, range) to every entity it fits; other patch keys are ignored. */
export function updateEntities(input: { graph: any; ids: string[]; patch: any }): EntityResult {
  const allowed = ['height', 'facingDegrees', 'fieldOfViewDegrees', 'range'], patch: any = {}, src = input.patch || {};
  for (const k of allowed) if (k in src) patch[k] = src[k];
  let g = input.graph, n = 0;
  for (const id of input.ids) { const r = updateEntity({ graph: g, id, patch }); if (r.ok) { g = r.graph; n++; } }
  return n ? { graph: g, ok: true, message: 'Updated ' + n + (n === 1 ? ' entity.' : ' entities.'), id: '' } : { graph: input.graph, ok: false, message: 'Nothing to update.', id: '' };
}

/**
 * Coverage hints (not errors): rooms without a motion sensor and doors without a contact. Skips the `Outside` room and rooms without a layout.
 * A door counts as covered when either end of its relationship has a door contact. Settings: `entitySettings.checks` ({ motion, doorContact }, both on by
 * default) and `entitySettings.ignoredHints` (keys "code|id"). Each hint carries a one-click fix; sorted by key.
 */
export function coverageHints(graph: any): { key: string; code: string; message: string; target: { roomId?: string; connectorId?: string }; fix: { type: string; roomId?: string; connectorId?: string } }[] {
  const out: any[] = [], S = graph.entitySettings || {}, checks = S.checks || {}, ign: string[] = S.ignoredHints || [], list: any[] = graph.entityPlacements || [];
  const own = (id: string) => graph.rooms.find((x: any) => (x.connectors || []).some((p: any) => p.id === id));
  if (checks.motion !== false) for (const r of graph.rooms) {
    if (!r.layout || String(r.name).toLowerCase() === 'outside' || list.some(e => e.type === 'motion-sensor' && e.roomId === r.id)) continue;
    out.push({ key: 'no-motion|' + r.id, code: 'no-motion', message: 'Room "' + r.name + '" has no motion sensor.', target: { roomId: r.id }, fix: { type: 'motion-sensor', roomId: r.id } });
  }
  if (checks.doorContact !== false) {
    const seen: Record<string, boolean> = {};
    for (const r of graph.rooms) for (const c of r.connectors || []) {
      if (c.type !== 'door') continue;
      const l = (graph.relationships || []).find((k: any) => k.connectorA === c.id || k.connectorB === c.id), ids: string[] = l ? [l.connectorA, l.connectorB] : [c.id], key = 'no-door-contact|' + (l ? l.id : c.id);
      if (seen[key]) continue;
      seen[key] = true;
      if (list.some(e => e.type === 'door-contact' && ids.indexOf(e.connectorId) >= 0)) continue;
      const names = ids.map(id => (own(id) || { name: '?' }).name), cid = ids.slice().sort()[0]!;
      out.push({ key, code: 'no-door-contact', message: l ? 'Door between "' + names[0] + '" and "' + names[1] + '" has no contact.' : 'Door of "' + names[0] + '" has no contact.', target: { connectorId: cid }, fix: { type: 'door-contact', connectorId: cid } });
    }
  }
  return out.filter(h => ign.indexOf(h.key) < 0).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Copy with every entity default written out (settings, height, directional values). A graph without entities is returned unchanged (as a copy). */
export function fillEntityDefaults(graph: any): any {
  const g: any = JSON.parse(JSON.stringify(graph));
  if (!g.entityPlacements && !g.entitySettings) return g;
  g.entitySettings = { coordinates: 'room', gridStep: 0.1, resize: 'proportional', ...(g.entitySettings || {}) };
  g.entitySettings.checks = { motion: true, doorContact: true, ...(g.entitySettings.checks || {}) };
  const cat = entityCatalog();
  for (const e of g.entityPlacements || []) {
    const c = cat[e.type];
    if (!c) continue;
    if (c.anchor === 'room' && typeof e.height !== 'number') e.height = c.height;
    if (Array.isArray(e.position)) e.position = e.position.map((v: number) => Math.round(v * 1e4) / 1e4 + 0);
    if (c.directional) for (const k of ['facingDegrees', 'fieldOfViewDegrees', 'range']) if (typeof e[k] !== 'number') e[k] = c[k];
    if (c.multi && !Array.isArray(e[c.multi.field])) e[c.multi.field] = c.multi.default.slice();
  }
  return g;
}
