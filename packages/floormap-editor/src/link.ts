/**
 * Links two existing, unconnected openings (door / open passage) of two different rooms into ONE connection (the relationship), for example a door that was added
 * on its own (exterior) and a connector of the neighbour room. Needs opposing sides (left/right, top/bottom) and both connectors without a relationship; windows cannot be linked.
 * The partner takes over the kind of the first connector (type, width, doorType, glazing, door spec mirrored) and is moved along its wall to the first connector's
 * world position (kept 0.05 m inside its wall). Refused when the two points are more than 1.5 m apart along the wall. Pure + deterministic, the input is never mutated.
 * Embedded into the editor with toString(): no imports, helpers inside the function.
 */
interface LDoor { hinge?: string; swing?: string; openAngle?: number; tilt?: boolean; slide?: string }
interface LConn { id: string; roomId?: string; side: string; type: string; offset?: number; position?: number; width?: number; wallAt?: number; doorType?: string; glazing?: string; door?: LDoor; window?: object }
interface LRoom { id: string; name: string; layout?: { x: number; y: number; width: number; height: number }; connectors?: LConn[] }
export interface LGraph { rooms: LRoom[]; relationships: { id: string; connectorA: string; connectorB: string; importance?: string }[] }

/**
 * Creates the missing partner of an unconnected opening in a chosen neighbour room and connects the two: a connector on the opposing side of `roomId`, at the same
 * world position along the wall, with the kind of the first connector (type, width, doorType, glazing, door mirrored). For a neighbour whose wall is set back (the notch wall of an
 * L-shaped room) the connector gets `wallAt` (the wall's coordinate from the room's bounding box origin); the wall of the first connector is read from `at` (its real world point, given by the editor) or else from `wallAt` / the box edge.
 * Refused when the room is the same, the first connector is already connected or a window, the position lies outside the neighbour's span along the wall, or its box does not reach the wall (0.08 m).
 * Pure + deterministic, the input is never mutated.
 */
export function addPartner<T extends LGraph>(input: { graph: T; connectorId: string; roomId: string; at?: { x: number; y: number } }): { graph: T; ok: boolean; message: string; id: string } {
  const g = JSON.parse(JSON.stringify(input.graph)) as T;
  const fail = (m: string) => ({ graph: input.graph, ok: false, message: m, id: '' });
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0, OPP: Record<string, string> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const ra = g.rooms.find((r) => (r.connectors || []).some((c) => c.id === input.connectorId)), rb = g.rooms.find((r) => r.id === input.roomId);
  if (!ra || !rb) return fail('No such connector or room.');
  if (ra === rb) return fail('Choose a different room.');
  const a = (ra.connectors || []).find((c) => c.id === input.connectorId);
  if (!a) return fail('No such connector.');
  if (a.type === 'window') return fail('A window cannot be linked to another room.');
  if (g.relationships.some((l) => l.connectorA === a.id || l.connectorB === a.id)) return fail('This opening is already connected.');
  const La = ra.layout, Lb = rb.layout;
  if (!La || !Lb) return fail('Both rooms need a place on the plan.');
  const horiz = a.side === 'top' || a.side === 'bottom', sb = OPP[a.side] as string;
  const len = (L: { width: number; height: number }) => (horiz ? L.width : L.height), o0 = (L: { x: number; y: number }) => (horiz ? L.x : L.y);
  const p0 = (L: { x: number; y: number }) => (horiz ? L.y : L.x), plen = (L: { width: number; height: number }) => (horiz ? L.height : L.width);
  const edge = (L: { x: number; y: number; width: number; height: number }, side: string) => (side === 'top' ? L.y : side === 'bottom' ? L.y + L.height : side === 'left' ? L.x : L.x + L.width);
  const t = input.at ? (horiz ? input.at.x : input.at.y) : o0(La) + (typeof a.offset === 'number' ? a.offset : (a.position ?? 0.5) * len(La));
  const wc = input.at ? (horiz ? input.at.y : input.at.x) : typeof a.wallAt === 'number' ? p0(La) + a.wallAt : edge(La, a.side);
  if (t < o0(Lb) + 0.05 - 1e-9 || t > o0(Lb) + len(Lb) - 0.05 + 1e-9) return fail(rb.name + ' does not reach this position along the wall.');
  if (wc < p0(Lb) - 0.08 || wc > p0(Lb) + plen(Lb) + 0.08) return fail(rb.name + ' does not reach the wall of this opening (more than 0.08 m away).');
  const off = rnd(Math.max(0.05, Math.min(len(Lb) - 0.05, t - o0(Lb))));
  const outer = edge(Lb, sb), used = new Set<string>(g.rooms.flatMap((r) => (r.connectors || []).map((c) => c.id)));
  let cid = rb.id + '-' + sb + '-' + a.type, k = 2; const base = cid; while (used.has(cid)) cid = base + '-' + k++;
  const b: LConn = { id: cid, roomId: rb.id, side: sb, type: a.type, position: rnd(off / len(Lb)), offset: off };
  if (Math.abs(wc - outer) > 0.08) b.wallAt = rnd(wc - p0(Lb));
  if (a.width && a.width > 0) b.width = a.width;
  if (a.doorType) b.doorType = a.doorType;
  if (a.glazing) b.glazing = a.glazing;
  if (a.door && (!a.doorType || a.doorType.indexOf('hinged') === 0)) {
    const d: LDoor = { hinge: a.door.hinge === 'right' ? 'left' : 'right', swing: a.door.swing === 'outward' ? 'inward' : 'outward', openAngle: a.door.openAngle };
    if (a.door.tilt) d.tilt = true;
    if (a.door.slide === 'end') d.slide = 'end';
    b.door = d;
  } else if (a.door && a.door.slide === 'end') b.door = { slide: 'end' };
  rb.connectors = (rb.connectors || []).concat([b]);
  const ids = new Set<string>(g.relationships.map((l) => l.id));
  let rid = a.id + '--' + b.id, n = 2; while (ids.has(rid)) rid = a.id + '--' + b.id + '-' + n++;
  g.relationships.push({ id: rid, connectorA: a.id, connectorB: b.id, importance: 'required' });
  return { graph: g, ok: true, message: 'Added a ' + a.type + ' to ' + rb.name + ' (' + sb + ') and connected it with ' + ra.name + '.', id: rid };
}

export function linkConnectors<T extends LGraph>(input: { graph: T; connectorId: string; partnerId: string }): { graph: T; ok: boolean; message: string; id: string } {
  const g = JSON.parse(JSON.stringify(input.graph)) as T;
  const fail = (m: string) => ({ graph: input.graph, ok: false, message: m, id: '' });
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0, OPP: Record<string, string> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const ownerOf = (cid: string) => g.rooms.find((r) => (r.connectors || []).some((c) => c.id === cid));
  const ra = ownerOf(input.connectorId), rb = ownerOf(input.partnerId);
  if (!ra || !rb) return fail('No such connector.');
  if (ra === rb) return fail('Both connectors are in the same room.');
  const a = (ra.connectors || []).find((c) => c.id === input.connectorId), b = (rb.connectors || []).find((c) => c.id === input.partnerId);
  if (!a || !b) return fail('No such connector.');
  if (a.type === 'window' || b.type === 'window') return fail('A window cannot be linked to another room.');
  if (OPP[a.side] !== b.side) return fail(ra.name + ' (' + a.side + ') and ' + rb.name + ' (' + b.side + ') are not on opposing walls.');
  if (g.relationships.some((l) => l.connectorA === a.id || l.connectorB === a.id || l.connectorA === b.id || l.connectorB === b.id)) return fail('One of the two connectors is already connected.');
  const La = ra.layout, Lb = rb.layout;
  if (!La || !Lb) return fail('Both rooms need a place on the plan.');
  const horiz = a.side === 'top' || a.side === 'bottom';
  const len = (L: { width: number; height: number }) => (horiz ? L.width : L.height), o0 = (L: { x: number; y: number }) => (horiz ? L.x : L.y);
  const off = (L: { width: number; height: number }, c: LConn) => (typeof c.offset === 'number' ? c.offset : (c.position ?? 0.5) * len(L));
  const t = o0(La) + off(La, a), u = o0(Lb) + off(Lb, b);
  if (Math.abs(t - u) > 1.5) return fail('The two openings are ' + rnd(Math.abs(t - u)) + ' m apart (limit 1.5 m). Move one of them closer first.');
  const nb = rnd(Math.max(0.05, Math.min(len(Lb) - 0.05, t - o0(Lb))));
  b.offset = nb; b.position = rnd(nb / len(Lb));
  b.type = a.type;
  if (a.width && a.width > 0) b.width = a.width; else delete b.width;
  if (a.doorType) b.doorType = a.doorType; else delete b.doorType;
  if (a.glazing) b.glazing = a.glazing; else delete b.glazing;
  if (a.door && (!a.doorType || a.doorType.indexOf('hinged') === 0)) {
    const d: LDoor = { hinge: a.door.hinge === 'right' ? 'left' : 'right', swing: a.door.swing === 'outward' ? 'inward' : 'outward', openAngle: a.door.openAngle };
    if (a.door.tilt) d.tilt = true;
    if (a.door.slide === 'end') d.slide = 'end';
    b.door = d;
  } else if (a.door && a.door.slide === 'end') b.door = { slide: 'end' }; else delete b.door;
  delete b.window;
  const ids = new Set<string>(g.relationships.map((l) => l.id));
  let rid = a.id + '--' + b.id, n = 2; while (ids.has(rid)) rid = a.id + '--' + b.id + '-' + n++;
  g.relationships.push({ id: rid, connectorA: a.id, connectorB: b.id, importance: 'required' });
  return { graph: g, ok: true, message: 'Connected ' + ra.name + ' (' + a.side + ') and ' + rb.name + ' (' + b.side + ').', id: rid };
}
