/**
 * "Is this file ready for the consumers (building-card / 3D)?" Pure check over a SAVED graph (see `savedGraph`): errors make a file unusable, warnings are
 * things worth a look. Errors: duplicate room / connector / relationship / area ids, connectors that do not belong to their room, relationships or wall
 * alignments or stairs pointing at things that do not exist, visible rooms without layout, rooms on unknown floors, invalid relationships (unknown
 * connector, same room, sides that cannot share a wall). Warnings: relationships that are not green (gap, no overlap, misaligned), stairs whose ends are
 * not inside a room, and everything `validateEntities` / `validateAreas` report (entity outside its room, bad heights, ...).
 * Pure, embedded with toString(); siblings: deriveJoints, validateEntities (needs entityCatalog), validateAreas (needs areaKinds), stairsHost (needs stairBar, stairRect).
 */
import type { Link } from './core.js';
import type { FloorplanGraph, FloorRoom } from './schema.js';
import { deriveJoints } from './joints.js';
import { validateEntities } from './entities.js';
import { validateAreas } from './areas.js';
import { validateObjects } from './objects.js';
import { stairsHost } from './stairs.js';

export function checkContract(input: any): { errors: { code: string; message: string }[]; warnings: { code: string; message: string }[] } {
  const graph: FloorplanGraph = input;
  const errors: { code: string; message: string }[] = [], warnings: { code: string; message: string }[] = [];
  const err = (code: string, message: string) => errors.push({ code, message }), warn = (code: string, message: string) => warnings.push({ code, message });
  const rooms: FloorRoom[] = graph.rooms || [], rel: Link[] = graph.relationships || [], conns = rooms.flatMap(r => (r.connectors || []).map((c) => ({ c, r })));
  const dups = (kind: string, ids: string[]) => { const seen = new Set<string>(), d = new Set<string>(); for (const id of ids) { if (seen.has(id)) d.add(id); seen.add(id); } for (const id of d) err('duplicate-' + kind, 'Duplicate ' + kind + ' id "' + id + '"'); };
  dups('room', rooms.map(r => r.id)); dups('connector', conns.map(x => x.c.id)); dups('relationship', rel.map(l => l.id)); dups('area', (graph.areas || []).map((a) => a.id)); dups('object', (graph.objects || []).map((o) => o.id));
  const roomIds = new Set<string>(rooms.map(r => r.id)), connIds = new Set<string>(conns.map(x => x.c.id)), floorIds = new Set<string>((graph.floors || []).map((f) => f.id));
  for (const r of rooms) {
    if (String(r.name).toLowerCase() !== 'outside' && !r.layout) err('no-layout', 'Room "' + r.name + '" has no position and size');
    if (floorIds.size && r.floor && !floorIds.has(r.floor)) err('unknown-floor', 'Room "' + r.name + '" is on the unknown floor "' + r.floor + '"');
  }
  for (const { c, r } of conns) if (c.roomId !== r.id) err('connector-room', 'Connector "' + c.id + '" says it belongs to "' + c.roomId + '" but sits in room "' + r.id + '"');
  for (const l of rel) for (const k of [l.connectorA, l.connectorB]) if (!connIds.has(k)) err('dangling-connector', 'Relationship "' + l.id + '" points at the unknown connector "' + k + '"');
  for (const a of graph.wallAlignments || []) for (const x of a.roomIds || []) if (!roomIds.has(x)) err('dangling-alignment', 'A wall alignment points at the unknown room "' + x + '"');
  const fl: string[] = (graph.floors || []).map((f) => f.id);
  for (const s of graph.stairs || []) {
    const i = fl.indexOf(s.lower), j = fl.indexOf(s.upper);
    if (i < 0 || j !== i + 1) { err('stairs-floors', 'Stairs "' + s.id + '" must connect two floors that lie directly above each other'); continue; }
    if (!(s.length > 0) || !(s.width > 0)) err('stairs-size', 'Stairs "' + s.id + '" needs a positive length and width');
    if (stairsHost(graph, s, 'lower') === null) warn('stairs-room', 'Stairs "' + s.id + '": the lower end is not inside a room of floor "' + s.lower + '"');
    if (stairsHost(graph, s, 'upper') === null) warn('stairs-room', 'Stairs "' + s.id + '": the upper end is not inside a room of floor "' + s.upper + '"');
  }
  const known = rel.filter(l => connIds.has(l.connectorA) && connIds.has(l.connectorB));
  for (const j of deriveJoints({ rooms, relationships: known, joints: graph.joints }).joints as any[]) {
    const id = j.relationshipId || j.id;
    if (j.status === 'invalid') err('relationship-invalid', 'Relationship "' + id + '" is invalid (unknown connector, same room or sides that cannot share a wall)');
    else if (j.status === 'broken') warn('relationship-broken', 'Relationship "' + id + '" is not green' + (j.reasons && j.reasons.length ? ' (' + j.reasons.join(', ') + ')' : ''));
  }
  const nm = (list: { id: string; name?: string }[] | undefined, id: string) => { const f = (list || []).find((x) => x.id === id); return f && f.name && f.name !== id ? f.name + ' (' + id + ')' : id; };
  for (const e of validateEntities(graph)) warn('entity-' + e.code, 'Entity "' + nm(graph.entityPlacements, e.id) + '": ' + e.message);
  for (const a of validateAreas(graph)) warn('area-' + a.code, 'Area "' + nm(graph.areas, a.id) + '": ' + a.message);
  for (const o of validateObjects(graph)) { const m = 'Object "' + nm(graph.objects, o.id) + '": ' + o.message; if (o.code === 'no-host') err('dangling-object', m); else warn('object-' + o.code, m); }
  return { errors, warnings };
}
