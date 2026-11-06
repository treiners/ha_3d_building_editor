/**
 * "Is this file ready for the consumers (building-card / 3D)?" Pure check over a SAVED graph (see `savedGraph`): errors make a file unusable, warnings are
 * things worth a look. Errors: duplicate room / connector / relationship / area ids, connectors that do not belong to their room, relationships or wall
 * alignments or stairs pointing at things that do not exist, entities on an object that does not exist, visible rooms without layout, rooms on unknown floors, invalid relationships (unknown
 * connector, same room, sides that cannot share a wall). Warnings: relationships that are not green (gap, no overlap, misaligned), stairs whose ends are
 * not inside a room, and everything `validateEntities` / `validateAreas` report (entity outside its room, bad heights, ...).
 * Pure, embedded with toString(); siblings: deriveJoints, heightIssues (needs wallHeightOf), sharedWallIssues (needs wallList, outlineWalls), validateEntities (needs entityCatalog), validateAreas (needs areaKinds), stairsHost (needs stairBar, stairRect), outlineIssues, outlineBounds, outlineWallAt (needs outlineWalls).
 * Room shapes (`outline`, v2.18): errors `room-outline-invalid` (not a valid rectilinear loop), `room-outline-bounds` (its bounding box is not the room's width x height from the room's corner), `connector-off-wall` (no wall of the outline at the connector's side and offset). Connectors on inner walls (notches) are fine since v2.18 phase 4: joints use the wall segment.
 */
import type { Link } from './core.js';
import type { FloorplanGraph, FloorRoom } from './schema.js';
import { deriveJoints } from './joints.js';
import { validateEntities } from './entities.js';
import { validateAreas } from './areas.js';
import { heightIssues } from './heights.js';
import { sharedWallIssues } from './wallheights.js';
import { validateObjects } from './objects.js';
import { stairsHost } from './stairs.js';
import { outlineBounds, outlineIssues, outlineWallAt } from './shape.js';

export interface ContractIssue { code: string; message: string; target?: { kind: string; id: string } }

/** `withTargets` adds `target` ({ kind: room | connector | relationship | area | entity | object | stairs, id }) to every issue that points at one item (used by the Issues panel to select and zoom to it). */
export function checkContract(input: any, withTargets?: boolean): { errors: ContractIssue[]; warnings: ContractIssue[] } {
  const graph: FloorplanGraph = input;
  const errors: ContractIssue[] = [], warnings: ContractIssue[] = [];
  const mk = (code: string, message: string, target?: { kind: string; id: string }): ContractIssue => (withTargets && target ? { code, message, target } : { code, message });
  const err = (code: string, message: string, target?: { kind: string; id: string }) => errors.push(mk(code, message, target)), warn = (code: string, message: string, target?: { kind: string; id: string }) => warnings.push(mk(code, message, target));
  const rooms: FloorRoom[] = graph.rooms || [], rel: Link[] = graph.relationships || [], conns = rooms.flatMap(r => (r.connectors || []).map((c) => ({ c, r })));
  const dups = (kind: string, ids: string[]) => { const seen = new Set<string>(), d = new Set<string>(); for (const id of ids) { if (seen.has(id)) d.add(id); seen.add(id); } for (const id of d) err('duplicate-' + kind, 'Duplicate ' + kind + ' id "' + id + '"', { kind, id }); };
  dups('room', rooms.map(r => r.id)); dups('connector', conns.map(x => x.c.id)); dups('relationship', rel.map(l => l.id)); dups('area', (graph.areas || []).map((a) => a.id)); dups('object', (graph.objects || []).map((o) => o.id));
  const roomIds = new Set<string>(rooms.map(r => r.id)), connIds = new Set<string>(conns.map(x => x.c.id)), floorIds = new Set<string>((graph.floors || []).map((f) => f.id));
  for (const r of rooms) {
    if (String(r.name).toLowerCase() !== 'outside' && !r.layout) err('no-layout', 'Room "' + r.name + '" has no position and size', { kind: 'room', id: r.id });
    if (floorIds.size && r.floor && !floorIds.has(r.floor)) err('unknown-floor', 'Room "' + r.name + '" is on the unknown floor "' + r.floor + '"', { kind: 'room', id: r.id });
    const ol = r.outline;
    if (ol && r.layout) {
      const bad = outlineIssues(ol), L = r.layout;
      if (bad.length) err('room-outline-invalid', 'Room "' + r.name + '": the outline is not a valid shape with 90 degree corners (' + bad.join(', ') + ')', { kind: 'room', id: r.id });
      else {
        const b = outlineBounds(ol);
        if (Math.abs(b.x) > 1e-4 || Math.abs(b.y) > 1e-4 || Math.abs(b.width - L.width) > 1e-4 || Math.abs(b.height - L.height) > 1e-4) err('room-outline-bounds', 'Room "' + r.name + '": the outline spans ' + b.width + ' x ' + b.height + ' m from (' + b.x + ', ' + b.y + '), the room is ' + L.width + ' x ' + L.height + ' m', { kind: 'room', id: r.id });
        else for (const c of r.connectors || []) {
          const w = outlineWallAt(ol, c.side, c.offset ?? 0, (c as { wallAt?: number }).wallAt);
          if (!w) err('connector-off-wall', 'Connector "' + c.id + '" of room "' + r.name + '" is not on a wall of the room shape', { kind: 'connector', id: c.id });
        }
      }
    }
  }
  for (const a of graph.areas || []) {
    const ol = (a as { outline?: [number, number][] }).outline, L = a.layout;
    if (!ol || !L) continue;
    const bad = outlineIssues(ol);
    if (bad.length) { err('area-outline-invalid', 'Area "' + String(a.name) + '": the outline is not a valid shape with 90 degree corners (' + bad.join(', ') + ')', { kind: 'area', id: a.id }); continue; }
    const b = outlineBounds(ol);
    if (Math.abs(b.x) > 1e-4 || Math.abs(b.y) > 1e-4 || Math.abs(b.width - L.width) > 1e-4 || Math.abs(b.height - L.height) > 1e-4) err('area-outline-bounds', 'Area "' + String(a.name) + '": the outline spans ' + b.width + ' x ' + b.height + ' m from (' + b.x + ', ' + b.y + '), the area is ' + L.width + ' x ' + L.height + ' m', { kind: 'area', id: a.id });
  }
  for (const { c, r } of conns) if (c.roomId !== r.id) err('connector-room', 'Connector "' + c.id + '" says it belongs to "' + c.roomId + '" but sits in room "' + r.id + '"', { kind: 'connector', id: c.id });
  for (const l of rel) for (const k of [l.connectorA, l.connectorB]) if (!connIds.has(k)) err('dangling-connector', 'Relationship "' + l.id + '" points at the unknown connector "' + k + '"', { kind: 'relationship', id: l.id });
  for (const a of graph.wallAlignments || []) for (const x of a.roomIds || []) if (!roomIds.has(x)) err('dangling-alignment', 'A wall alignment points at the unknown room "' + x + '"');
  const fl: string[] = (graph.floors || []).map((f) => f.id);
  for (const s of graph.stairs || []) {
    const i = fl.indexOf(s.lower), j = fl.indexOf(s.upper);
    if (i < 0 || j !== i + 1) { err('stairs-floors', 'Stairs "' + s.id + '" must connect two floors that lie directly above each other', { kind: 'stairs', id: s.id }); continue; }
    if (!(s.length > 0) || !(s.width > 0)) err('stairs-size', 'Stairs "' + s.id + '" needs a positive length and width', { kind: 'stairs', id: s.id });
    if (stairsHost(graph, s, 'lower') === null) warn('stairs-room', 'Stairs "' + s.id + '": the lower end is not inside a room of floor "' + s.lower + '"', { kind: 'stairs', id: s.id });
    if (stairsHost(graph, s, 'upper') === null) warn('stairs-room', 'Stairs "' + s.id + '": the upper end is not inside a room of floor "' + s.upper + '"', { kind: 'stairs', id: s.id });
  }
  const known = rel.filter(l => connIds.has(l.connectorA) && connIds.has(l.connectorB));
  for (const j of deriveJoints({ rooms, relationships: known, joints: graph.joints }).joints as any[]) {
    const id = j.relationshipId || j.id;
    if (j.status === 'invalid') err('relationship-invalid', 'Relationship "' + id + '" is invalid (unknown connector, same room or sides that cannot share a wall)', { kind: 'relationship', id });
    else if (j.status === 'broken') warn('relationship-broken', 'Relationship "' + id + '" is not green' + (j.reasons && j.reasons.length ? ' (' + j.reasons.join(', ') + ')' : ''), { kind: 'relationship', id });
  }
  const nm = (list: { id: string; name?: string }[] | undefined, id: string) => { const f = (list || []).find((x) => x.id === id); return f && f.name && f.name !== id ? f.name + ' (' + id + ')' : id; };
  const objIds = new Set<string>((graph.objects || []).map((o) => o.id)), lost = new Set<string>();
  for (const e of graph.entityPlacements || []) { const oid = (e as { objectId?: string }).objectId; if (oid && !objIds.has(oid)) { lost.add(e.id); err('dangling-entity-object', 'Entity "' + e.id + '" sits on the unknown object "' + oid + '"', { kind: 'entity', id: e.id }); } }
  for (const e of validateEntities(graph)) { if (e.code === 'orphan' && lost.has(e.id)) continue; warn('entity-' + e.code, 'Entity "' + nm(graph.entityPlacements, e.id) + '": ' + e.message, { kind: 'entity', id: e.id }); }
  for (const a of validateAreas(graph)) warn('area-' + a.code, 'Area "' + nm(graph.areas, a.id) + '": ' + a.message, { kind: 'area', id: a.id });
  for (const h of heightIssues(graph)) warn('height-' + h.code, h.message, { kind: h.kind, id: h.id });
  for (const h of sharedWallIssues(graph)) warn('height-' + h.code, h.message, { kind: 'room', id: h.roomId });
  for (const o of validateObjects(graph)) { const m = 'Object "' + nm(graph.objects, o.id) + '": ' + o.message; if (o.code === 'no-host') err('dangling-object', m, { kind: 'object', id: o.id }); else warn('object-' + o.code, m, { kind: 'object', id: o.id }); }
  return { errors, warnings };
}
