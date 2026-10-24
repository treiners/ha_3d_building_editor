// Example house with objects and entities on them, built from a room graph without coordinates (for example packages/shared/reference-home-connectors.json).
// The rooms are placed by the mapper, then appliances and furniture are put against walls (snapped, facing into the room) and sensors on them.
// Everything is data driven (rooms are found by name, types by keyword), and any object or entity that would not validate is dropped, so the result is always clean.
// Used by test/objects-example.test.ts and by examples/make-objects-example.ts (writes the JSON and the editor HTML).
import { mapOnlyMissing, migrate } from '../src/core.js';
import { addEntity, entitySuggestions, validateEntities } from '../src/entities.js';
import { addObject, addObjectType, moveObject, objectDefs, objectSnap, removeObject, updateObject, updateObjectType, validateObjects } from '../src/objects.js';
import { savedGraph } from '../src/save.js';

type Wall = 'left' | 'right' | 'top' | 'bottom';
/** Where an object stands as a fraction of the room, and its facing: the front points into the room. */
const WALL: Record<Wall, [number, number, number]> = { left: [0.12, 0.5, 90], right: [0.88, 0.5, 270], top: [0.5, 0.12, 180], bottom: [0.5, 0.88, 0] };
const RECIPES: { room: RegExp; items: { kw: RegExp; wall?: Wall; at?: [number, number] }[] }[] = [
  { room: /kitchen/i, items: [{ kw: /refrigerator|fridge/i, wall: 'left' }, { kw: /dishwasher/i, wall: 'top' }] },
  { room: /living/i, items: [{ kw: /sofa|couch/i, wall: 'bottom' }, { kw: /^tv|television/i, wall: 'top' }, { kw: /aquarium/i, wall: 'right' }] },
  { room: /bed/i, items: [{ kw: /bed/i, wall: 'top' }, { kw: /wardrobe/i, wall: 'left' }] },
  { room: /bath|laundry|utility/i, items: [{ kw: /washing/i, wall: 'right' }] },
  { room: /dining/i, items: [{ kw: /table/i, at: [0.5, 0.5] }] },
];

/** The saved graph (as *Save graph* writes it) of the example house. */
export function buildObjectsExample(reference: unknown): any {
  const m = migrate(reference);
  mapOnlyMissing(m);
  let g: any = m;
  g = addObjectType({ graph: g, label: 'Aquarium' }).graph;
  g = updateObjectType({ graph: g, id: 'aquarium', patch: { width: 1, depth: 0.4, height: 0.5, elevation: 0.7 } }).graph;
  const defs = objectDefs(g), find = (kw: RegExp) => Object.keys(defs).find((k) => kw.test(k) || kw.test(String(defs[k]!.label)));
  for (const rc of RECIPES) {
    const room = g.rooms.find((r: { name: string; layout?: unknown }) => r.layout && !/^outside$/i.test(r.name) && rc.room.test(r.name));
    if (!room) continue;
    for (const it of rc.items) {
      const type = find(it.kw);
      if (!type) continue;
      const [fx, fy, fa] = it.wall ? WALL[it.wall] : [it.at![0], it.at![1], 0], L = room.layout, wx = L.x + L.width * fx, wy = L.y + L.height * fy;
      let r = addObject({ graph: g, type, wx, wy });
      if (!r.ok) continue;
      const id = r.id, u = updateObject({ graph: r.graph, id, patch: { facingDegrees: fa } });
      if (u.ok) r = u;
      if (it.wall) {
        const s = objectSnap({ graph: r.graph, id, wx, wy, tol: 0.6 }), mv = s.snapped ? moveObject({ graph: r.graph, id, wx: s.wx, wy: s.wy }) : null;
        if (mv && mv.ok) r = mv;
      }
      g = r.graph;
    }
  }
  for (const i of validateObjects(g)) g = removeObject({ graph: g, id: i.id }).graph;
  for (const o of [...(g.objects || [])] as { id: string; type: string }[]) {
    const n = /fridge|refrigerator/.test(o.type) ? 2 : 1;
    for (const t of entitySuggestions(o.type).slice(0, n)) { const r = addEntity({ graph: g, type: t, objectId: o.id }); if (r.ok) g = r.graph; }
  }
  return savedGraph(g);
}

/** Problems of the example: object and entity checks together (expected to be empty). */
export function objectsExampleIssues(saved: unknown): string[] {
  return [...validateObjects(saved as never).map((i) => 'object ' + i.id + ': ' + i.code), ...validateEntities(saved).map((i) => 'entity ' + i.id + ': ' + i.code)];
}
