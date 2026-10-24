// Objects phase 5 (src/entities.ts, src/floors.ts): entities that sit ON an object (objectId, position from the object's centre in its own frame).
import test from 'node:test';
import assert from 'node:assert/strict';
import { addEntity, coverageHints, entitySuggestions, entityWorld, moveEntity, validateEntities } from '../src/entities.js';
import { floorsMerge, floorsSplit, floorsSwitch } from '../src/floors.js';
import { removeObject } from '../src/objects.js';
import { embeddedSource } from '../src/embed.js';

// Room r = (0,0) 4 x 3 m; refrigerator "fridge" 0.6 x 0.65 x 1.85 centred at (2, 1.5) facing up.
const base = (facing = 0): any => ({
  rooms: [{ id: 'r', name: 'R', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [] }],
  relationships: [],
  objects: [{ id: 'fridge', type: 'refrigerator', roomId: 'r', position: [2, 1.5], facingDegrees: facing }],
  entityPlacements: [],
});

test('door contact on the fridge: id fridge-door-contact, position [0,0] (centre), height 1.85 (top of the fridge), world point (2, 1.5)', () => {
  const r = addEntity({ graph: base(), type: 'door-contact', objectId: 'fridge' });
  assert.ok(r.ok); assert.equal(r.id, 'fridge-door-contact');
  const e = r.graph.entityPlacements[0];
  assert.deepEqual([e.objectId, e.position, e.height, e.roomId, e.connectorId], ['fridge', [0, 0], 1.85, undefined, undefined]);
  assert.deepEqual(entityWorld(r.graph, e), { x: 2, y: 1.5, roomId: 'r' });
});

test('position [0.2, -0.1] on an object facing 90 (right): x = 2 + 0.2 * cos90 - (-0.1) * sin90 = 2.1, y = 1.5 + 0.2 * sin90 + (-0.1) * cos90 = 1.7', () => {
  const g = base(90); g.entityPlacements = [{ id: 'e', type: 'light', objectId: 'fridge', position: [0.2, -0.1], height: 1 }];
  assert.deepEqual(entityWorld(g, g.entityPlacements[0]), { x: 2.1, y: 1.7, roomId: 'r' });
});

test('the entity follows the object: moving the fridge to (1,1) puts a centred entity at (1,1)', () => {
  const g = addEntity({ graph: base(), type: 'light', objectId: 'fridge' }).graph; g.objects[0].position = [1, 1];
  const w = entityWorld(g, g.entityPlacements[0]); assert.deepEqual([w!.x, w!.y], [1, 1]);
});

test('moveEntity on an object: world (2.1, 1.7) on the 90 degree fridge gives local [0.2, -0.1]; a far point is clamped to the footprint (0.3, 0.325) and never re-parents', () => {
  const g = addEntity({ graph: base(90), type: 'light', objectId: 'fridge' }).graph, id = g.entityPlacements[0].id;
  assert.deepEqual(moveEntity({ graph: g, id, x: 2.1, y: 1.7 }).graph.entityPlacements[0].position, [0.2, -0.1]);
  const far = moveEntity({ graph: addEntity({ graph: base(), type: 'light', objectId: 'fridge' }).graph, id, x: 10, y: 10 }).graph.entityPlacements[0];
  assert.deepEqual([far.position, far.objectId, far.roomId], [[0.3, 0.325], 'fridge', undefined]);
});

test('refused: a smoke detector does not fit objects, a second door contact on the same object, an unknown object', () => {
  const g = addEntity({ graph: base(), type: 'door-contact', objectId: 'fridge' }).graph;
  assert.match(addEntity({ graph: g, type: 'smoke-detector', objectId: 'fridge' }).message, /cannot be placed on an object/);
  assert.match(addEntity({ graph: g, type: 'door-contact', objectId: 'fridge' }).message, /already has a door contact/);
  assert.match(addEntity({ graph: g, type: 'light', objectId: 'nope' }).message, /Pick a placed object/);
});

test('validate: missing object = orphan, x 1 m from the centre of a 0.6 m wide object = outside-object, a good one has no issue', () => {
  const g = base(); g.entityPlacements = [
    { id: 'a', type: 'light', objectId: 'zzz', position: [0, 0], height: 1 },
    { id: 'b', type: 'light', objectId: 'fridge', position: [1, 0], height: 1 },
    { id: 'c', type: 'light', objectId: 'fridge', position: [0.1, 0.1], height: 1 },
    { id: 'd', type: 'smoke-detector', objectId: 'fridge', position: [0, 0], height: 1 },
  ];
  assert.deepEqual(validateEntities(g).map((i) => [i.id, i.code]), [['a', 'orphan'], ['b', 'outside-object'], ['d', 'type-mismatch']]);
});

test('deleting the object removes its entities (cascade)', () => {
  const g = addEntity({ graph: base(), type: 'door-contact', objectId: 'fridge' }).graph;
  assert.deepEqual(removeObject({ graph: g, id: 'fridge' }).graph.entityPlacements, []);
});

test('a motion sensor on a sofa counts as a motion sensor of the room (no no-motion hint)', () => {
  const g = base(); g.objects.push({ id: 'sofa', type: 'sofa', roomId: 'r', position: [1, 1] });
  assert.ok(coverageHints(g).some((h) => h.key === 'no-motion|r'));
  g.entityPlacements = [{ id: 'm', type: 'motion-sensor', objectId: 'sofa', position: [0, 0], height: 1 }];
  assert.ok(!coverageHints(g).some((h) => h.key === 'no-motion|r'));
});

test('suggestions: fridge = door contact, environment sensor, light (filled up to 3); sofa = motion sensor first; unknown = light, environment, motion; all fit objects', () => {
  assert.deepEqual(entitySuggestions('refrigerator'), ['door-contact', 'environment-sensor', 'light']);
  assert.deepEqual(entitySuggestions('sofa'), ['motion-sensor', 'light', 'environment-sensor']);
  assert.deepEqual(entitySuggestions('zzz'), ['light', 'environment-sensor', 'motion-sensor']);
});

// Floors: two storeys, the fridge entity lives on the upper floor.
const twoFloors = (): any => ({
  floors: [{ id: 'f1', name: 'F1' }, { id: 'f2', name: 'F2' }],
  rooms: [{ id: 'r1', name: 'R1', floor: 'f1', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [] }, { id: 'r2', name: 'R2', floor: 'f2', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [] }],
  relationships: [],
  objects: [{ id: 'o', type: 'refrigerator', roomId: 'r2', position: [2, 1.5] }],
  entityPlacements: [{ id: 'e', type: 'door-contact', objectId: 'o', position: [0, 0], height: 1.85 }],
});

test('floors: split puts an entity on an object with the object\'s floor; switching away and back keeps it with that floor', () => {
  const s = floorsSplit(twoFloors());
  assert.deepEqual([s.entityPlacements.length, s._fl.data.f2.entityPlacements.length, s._fl.data.f2.objects.length], [0, 1, 1]);
  const up = floorsSwitch(s, 'f2'); assert.deepEqual([up.entityPlacements.map((e: any) => e.id), up.objects.map((o: any) => o.id)], [['e'], ['o']]);
  const back = floorsSwitch(up, 'f1'); assert.deepEqual([back.entityPlacements.length, back._fl.data.f2.entityPlacements.map((e: any) => e.id)], [0, ['e']]);
  assert.deepEqual(floorsMerge(s).entityPlacements.map((e: any) => [e.id, e.objectId]), [['e', 'o']]);
});

test('floors: merge renames a clashing object id of the second floor to o-f2 and remaps the objectId of its entities', () => {
  const g: any = {
    floors: [{ id: 'f1', name: 'F1' }, { id: 'f2', name: 'F2' }], relationships: [], wallAlignments: [],
    rooms: [{ id: 'r1', name: 'R1', floor: 'f1', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [] }],
    objects: [{ id: 'o', type: 'refrigerator', roomId: 'r1', position: [1, 1] }],
    entityPlacements: [{ id: 'e1', type: 'door-contact', objectId: 'o', position: [0, 0] }],
    _fl: { cur: 'f1', data: { f2: { rooms: [{ id: 'r2', name: 'R2', floor: 'f2', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [] }], relationships: [], wallAlignments: [], objects: [{ id: 'o', type: 'refrigerator', roomId: 'r2', position: [1, 1] }], entityPlacements: [{ id: 'e2', type: 'door-contact', objectId: 'o', position: [0, 0] }] } } },
  };
  const m = floorsMerge(g);
  assert.deepEqual(m.objects.map((o: any) => o.id), ['o', 'o-f2']);
  assert.deepEqual(m.entityPlacements.map((e: any) => [e.id, e.objectId]), [['e1', 'o'], ['e2', 'o-f2']]);
});

test('the new entity functions are embedded in the page source', () => {
  const src = embeddedSource();
  for (const f of ['entityObjectFrame', 'entitySuggestions']) assert.ok(src.includes('function ' + f + '('), f);
});
