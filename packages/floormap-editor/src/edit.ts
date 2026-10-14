/**
 * Editing the room graph from the floor plan: add a room, connect two rooms, remove a connection, delete a room.
 * Pure + deterministic: every function takes a graph and returns a NEW graph (the input is never mutated).
 * Rooms stay rectangles; connectors/relationships follow the existing schema. Embedded in the editor HTML next to
 * the planners with `toString()`, so: no imports, helpers live inside the functions, `addRoom` calls `connectRooms`
 * as a sibling global.
 *
 * "Connect": a connection is ONE action that creates the connector on BOTH rooms (same world position, middle of
 * the shared wall) plus the relationship, so the partner connector never has to be added by hand.
 */
export interface EditResult { graph: any; ok: boolean; message: string; id: string }

/** Door/passage between two rooms that share a wall: both connectors + the relationship, at the middle of the shared part. */
export function connectRooms(input: { graph: any; roomA: string; roomB: string; type?: string; width?: number; doorType?: string }): EditResult {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  const type = input.type === 'open-passage' ? 'open-passage' : 'door';
  const wd = typeof input.width === 'number' && input.width > 0 ? Math.round(input.width * 100) / 100 : 0, need = (wd || (type === 'door' ? 0.9 : 1.2)) + 0.1, T = 0.08;
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  const fail = (m: string): EditResult => ({ graph: input.graph, ok: false, message: m, id: '' });
  const A = g.rooms.find((r: any) => r.id === input.roomA), B = g.rooms.find((r: any) => r.id === input.roomB);
  if (!A || !B || A === B || !A.layout || !B.layout) return fail('Select two different placed rooms.');
  A.connectors = A.connectors || []; B.connectors = B.connectors || [];
  const owner = (cid: string) => g.rooms.find((r: any) => (r.connectors || []).some((c: any) => c.id === cid));
  const already = g.relationships.some((l: any) => { const p = owner(l.connectorA), q = owner(l.connectorB); return !!p && !!q && ((p === A && q === B) || (p === B && q === A)); });
  if (already) return fail(A.name + ' and ' + B.name + ' are already connected.');
  const a = A.layout, b = B.layout;
  const yo = [Math.max(a.y, b.y), Math.min(a.y + a.height, b.y + b.height)], xo = [Math.max(a.x, b.x), Math.min(a.x + a.width, b.x + b.width)];
  const cands = [
    { sa: 'right', sb: 'left', gap: Math.abs(a.x + a.width - b.x), lo: yo[0]!, hi: yo[1]! },
    { sa: 'left', sb: 'right', gap: Math.abs(b.x + b.width - a.x), lo: yo[0]!, hi: yo[1]! },
    { sa: 'bottom', sb: 'top', gap: Math.abs(a.y + a.height - b.y), lo: xo[0]!, hi: xo[1]! },
    { sa: 'top', sb: 'bottom', gap: Math.abs(b.y + b.height - a.y), lo: xo[0]!, hi: xo[1]! },
  ].filter(c => c.gap <= T && c.hi - c.lo > 1e-6);
  if (!cands.length) return fail(A.name + ' and ' + B.name + ' do not share a wall. Move them together first.');
  let best = cands[0]!;
  for (const c of cands) if (c.hi - c.lo > best.hi - best.lo + 1e-9) best = c;
  if (best.hi - best.lo < need - 1e-9) return fail('The shared wall of ' + A.name + ' and ' + B.name + ' is too short for a ' + (type === 'door' ? 'door' : 'passage') + ' (needs ' + need + ' m).');
  const p = rnd((best.lo + best.hi) / 2);
  const used = new Set<string>(g.rooms.flatMap((r: any) => (r.connectors || []).map((c: any) => c.id)));
  const uniq = (base: string) => { let s = base, n = 2; while (used.has(s)) s = base + '-' + n++; used.add(s); return s; };
  const make = (R: any, side: string) => {
    const horiz = side === 'top' || side === 'bottom', len = horiz ? R.layout.width : R.layout.height;
    const off = rnd(Math.max(0.05, Math.min(len - 0.05, p - (horiz ? R.layout.x : R.layout.y))));
    return { id: uniq(R.id + '-' + side + '-' + type), roomId: R.id, side, type, position: rnd(off / len), offset: off, ...(wd ? { width: wd } : {}), ...(input.doorType ? { doorType: input.doorType } : {}) };
  };
  const ca = make(A, best.sa), cb = make(B, best.sb);
  A.connectors.push(ca); B.connectors.push(cb);
  const ids = new Set<string>(g.relationships.map((l: any) => l.id));
  let rid = ca.id + '--' + cb.id, n = 2; while (ids.has(rid)) rid = ca.id + '--' + cb.id + '-' + n++;
  g.relationships.push({ id: rid, connectorA: ca.id, connectorB: cb.id, importance: 'required' });
  return { graph: g, ok: true, message: 'Connected ' + A.name + ' and ' + B.name + ' with a ' + (type === 'door' ? 'door' : 'passage') + ' (' + A.name + ' ' + best.sa + ' / ' + B.name + ' ' + best.sb + ').', id: rid };
}

/** New room (default size of its category) next to a room, on the wished side if there is free space, else on another side;
 *  optionally connected right away. Without a neighbour it is placed in free space right of the plan, not connected. */
export function addRoom(input: { graph: any; name: string; type?: string; sizeCategory?: string; nextTo?: string; side?: string; connect?: string; width?: number; doorType?: string }): EditResult {
  let g: any = JSON.parse(JSON.stringify(input.graph));
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  const SIZES: any = { small: [3, 2], medium: [4, 3], large: [6, 4] };
  const cat = SIZES[input.sizeCategory || 'medium'] ? (input.sizeCategory || 'medium') : 'medium', w = SIZES[cat][0] as number, h = SIZES[cat][1] as number;
  const name = (input.name || '').trim() || 'New room';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'room';
  const taken = new Set<string>(g.rooms.map((r: any) => r.id));
  let id = slug, k = 2; while (taken.has(id)) id = slug + '-' + k++;
  const others = g.rooms.filter((r: any) => r.layout && String(r.name).toLowerCase() !== 'outside');
  const free = (x: number, y: number) => others.every((o: any) => !(x < o.layout.x + o.layout.width - 1e-6 && x + w > o.layout.x + 1e-6 && y < o.layout.y + o.layout.height - 1e-6 && y + h > o.layout.y + 1e-6));
  const A = input.nextTo ? g.rooms.find((r: any) => r.id === input.nextTo && r.layout) : undefined;
  const need = ((typeof input.width === 'number' && input.width > 0 ? input.width : 0) || (input.connect === 'open-passage' ? 1.2 : 0.9)) + 0.1;
  let pos: { x: number; y: number } | null = null, placedSide = '';
  if (A) {
    const L = A.layout, order = [input.side || 'right'];
    for (const s of order) {
      const vertWall = s === 'left' || s === 'right', lenA = vertWall ? L.height : L.width, lenN = vertWall ? h : w, a0 = vertWall ? L.y : L.x;
      const lo = -(lenN - need), hi = lenA - need, shifts: number[] = [];
      for (let j = 0; j * 0.2 <= Math.max(Math.abs(lo), Math.abs(hi)) + 1e-9; j++) {
        if (j * 0.2 <= hi + 1e-9) shifts.push(rnd(j * 0.2));
        if (j > 0 && -j * 0.2 >= lo - 1e-9) shifts.push(rnd(-j * 0.2));
      }
      for (const sh of shifts) {
        const x = vertWall ? (s === 'right' ? L.x + L.width : L.x - w) : a0 + sh, y = vertWall ? a0 + sh : (s === 'bottom' ? L.y + L.height : L.y - h);
        if (free(x, y)) { pos = { x, y }; placedSide = s; break; }
      }
      if (pos) break;
    }
  }
  let note = '';
  if (!pos) {
    if (A) note = ' There is no free space on the ' + (input.side || 'right') + ' side of ' + A.name + ', so it was added as a free room (not connected).';
    const maxX = others.length ? Math.max(...others.map((o: any) => o.layout.x + o.layout.width)) : -1, minY = others.length ? Math.min(...others.map((o: any) => o.layout.y)) : 0;
    pos = { x: maxX + 1, y: minY };
  }
  g.rooms.push({ id, name, type: input.type || 'other', sizeCategory: cat, connectors: [], layout: { x: rnd(pos.x), y: rnd(pos.y), width: w, height: h } });
  if (A && placedSide && input.connect) {
    const c = connectRooms({ graph: g, roomA: A.id, roomB: id, type: input.connect, width: input.width, doorType: input.doorType });
    if (c.ok) return { graph: c.graph, ok: true, message: 'Added "' + name + '" ' + placedSide + ' of ' + A.name + ' and connected it (' + (input.connect === 'open-passage' ? 'passage' : 'door') + ').', id };
    return { graph: g, ok: true, message: 'Added "' + name + '" next to ' + A.name + '. ' + c.message, id };
  }
  return { graph: g, ok: true, message: 'Added "' + name + '"' + (A && placedSide ? ' ' + placedSide + ' of ' + A.name + ' (not connected).' : '.') + note, id };
}

/** Deletes a room with its connectors and relationships; joint overrides and alignment memberships go with it.
 *  Connectors of neighbours that lost their partner stay (shown as not connected). */
export function removeRoom(input: { graph: any; roomId: string }): EditResult {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  const r = g.rooms.find((x: any) => x.id === input.roomId);
  if (!r) return { graph: input.graph, ok: false, message: 'No such room.', id: '' };
  const own = new Set<string>((r.connectors || []).map((c: any) => c.id));
  const gone = g.relationships.filter((l: any) => own.has(l.connectorA) || own.has(l.connectorB));
  const goneIds = new Set<string>(gone.map((l: any) => l.id));
  const left = gone.map((l: any) => (own.has(l.connectorA) ? l.connectorB : l.connectorA)).filter((c: string) => !own.has(c)).length;
  g.relationships = g.relationships.filter((l: any) => !goneIds.has(l.id));
  g.rooms = g.rooms.filter((x: any) => x.id !== r.id);
  if (g.joints) g.joints = g.joints.filter((j: any) => !goneIds.has(j.relationshipId));
  if (g.wallAlignments) g.wallAlignments = g.wallAlignments.map((a: any) => ({ ...a, roomIds: a.roomIds.filter((i: string) => i !== r.id) })).filter((a: any) => a.roomIds.length >= 2);
  return { graph: g, ok: true, message: 'Deleted "' + r.name + '" with ' + own.size + ' connector(s) and ' + gone.length + ' relationship(s).' + (left ? ' ' + left + ' connector(s) of neighbours are now not connected.' : ''), id: r.id };
}

/** Removes a connector and its relationship; by default the partner connector in the other room as well (a door is one pair). */
export function removeConnector(input: { graph: any; connectorId: string; both?: boolean }): EditResult {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  const room = g.rooms.find((r: any) => (r.connectors || []).some((c: any) => c.id === input.connectorId));
  if (!room) return { graph: input.graph, ok: false, message: 'No such connector.', id: '' };
  const rels = g.relationships.filter((l: any) => l.connectorA === input.connectorId || l.connectorB === input.connectorId);
  const kill = new Set<string>([input.connectorId]);
  if (input.both !== false) for (const l of rels) kill.add(l.connectorA === input.connectorId ? l.connectorB : l.connectorA);
  const ids = new Set<string>(rels.map((l: any) => l.id));
  for (const r of g.rooms) r.connectors = (r.connectors || []).filter((c: any) => !kill.has(c.id));
  g.relationships = g.relationships.filter((l: any) => !ids.has(l.id));
  if (g.joints) g.joints = g.joints.filter((j: any) => !ids.has(j.relationshipId));
  return { graph: g, ok: true, message: 'Removed ' + kill.size + ' connector(s) and ' + ids.size + ' relationship(s).', id: input.connectorId };
}
