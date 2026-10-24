// Objects across the rest of the model (src/objects.ts + floors, edit, areas, save, contract): objects follow their rooms between floors,
// are deleted with their room or area, get their defaults on save, and are checked by the contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { floorsAdd, floorsMerge, floorsSplit, floorsSwitch } from '../src/floors.js';
import { removeRoom } from '../src/edit.js';
import { removeArea } from '../src/areas.js';
import { savedGraph } from '../src/save.js';
import { checkContract } from '../src/contract.js';

const room = (id: string, floor: string) => ({ id, name: id, type: 'room', sizeCategory: 'medium', connectors: [], floor, layout: { x: 0, y: 0, width: 4, height: 3 } });
const house = (): any => ({
  schemaVersion: '3.0', id: 'h', name: 'H', floors: [{ id: 'f1', name: 'Ground' }, { id: 'f2', name: 'Upper' }],
  rooms: [room('kitchen', 'f1'), room('bed', 'f2')], relationships: [], wallAlignments: [],
  areas: [{ id: 'deck', name: 'Deck', kind: 'deck', shape: 'rect', layout: { x: 5, y: 0, width: 3, height: 3 } }],
  objects: [
    { id: 'k-fridge', type: 'refrigerator', roomId: 'kitchen', position: [1, 1] },
    { id: 'b-bed', type: 'bed-double', roomId: 'bed', position: [2, 1.5] },
    { id: 'deck-table', type: 'table', areaId: 'deck', position: [1.5, 1.5] },
  ],
});
const ids = (list: any[] | undefined) => (list || []).map((o) => o.id).sort();

test('floors split: the first floor keeps its objects and the objects of areas, the other floor is stashed with its own', () => {
  const g = floorsSplit(house());
  assert.deepEqual(ids(g.objects), ['deck-table', 'k-fridge']);
  assert.deepEqual(ids(g._fl.data.f2.objects), ['b-bed']);
});

test('floors switch moves the objects of the shown floor into the stash and back; area objects stay in the graph', () => {
  const g = floorsSwitch(floorsSplit(house()), 'f2');
  assert.deepEqual(ids(g.objects), ['b-bed', 'deck-table']);
  assert.deepEqual(ids(g._fl.data.f1.objects), ['k-fridge']);
  const back = floorsSwitch(g, 'f1');
  assert.deepEqual(ids(back.objects), ['deck-table', 'k-fridge']);
  assert.deepEqual(ids(back._fl.data.f2.objects), ['b-bed']);
});

test('floors merge returns every object once, without the stash', () => {
  const m = floorsMerge(floorsSwitch(floorsSplit(house()), 'f2'));
  assert.deepEqual(ids(m.objects), ['b-bed', 'deck-table', 'k-fridge']);
  assert.equal(m._fl, undefined);
});

test('floors merge makes object ids unique across floors: the same id on both floors gives x and x-f2', () => {
  const h = house(); h.objects.push({ id: 'k-fridge', type: 'refrigerator', roomId: 'bed', position: [1, 1] });
  const m = floorsMerge(floorsSplit(h));
  assert.deepEqual(ids(m.objects.filter((o: any) => o.type === 'refrigerator')), ['k-fridge', 'k-fridge-f2']);
});

test('a new empty floor has an empty object list in its stash', () => {
  const g = floorsAdd({ graph: floorsSplit(house()), name: 'Attic' });
  assert.ok(Object.values(g._fl.data).every((d: any) => Array.isArray(d.objects)));
});

test('delete room: its objects go with it, and so do the entities on them (objectId), with a message', () => {
  const h = house(); h.entityPlacements = [{ id: 'e1', type: 'door-contact', objectId: 'k-fridge' }, { id: 'e2', type: 'light', roomId: 'bed', position: [1, 1] }];
  const r = removeRoom({ graph: h, roomId: 'kitchen' });
  assert.deepEqual(ids(r.graph.objects), ['b-bed', 'deck-table']);
  assert.deepEqual(ids(r.graph.entityPlacements), ['e2']);
  assert.ok(r.message.includes('1 object removed'));
});

test('delete area: its objects go with it', () => {
  const r = removeArea({ graph: house(), id: 'deck' });
  assert.deepEqual(ids(r.graph.objects), ['b-bed', 'k-fridge']);
  assert.ok(r.message.includes('1 object removed'));
});

test('save writes the defaults of every object, from every floor, and no stash', () => {
  const s = savedGraph(floorsSwitch(floorsSplit(house()), 'f2'));
  assert.equal(s._fl, undefined);
  const fridge = s.objects.find((o: any) => o.id === 'k-fridge');
  assert.deepEqual([fridge.name, fridge.category, fridge.width, fridge.depth, fridge.height, fridge.elevation, fridge.facingDegrees], ['Refrigerator', 'appliance', 0.6, 0.65, 1.85, 0, 0]);
  assert.equal(s.objects.length, 3);
});

test('save, load (split) and save again gives the same file (objects listed floor by floor, so compared by id; the second cycle is exactly stable)', () => {
  const byId = (g: any) => ({ ...g, objects: [...g.objects].sort((a: any, b: any) => (a.id < b.id ? -1 : 1)) });
  const once = savedGraph(house()), twice = savedGraph(floorsSplit(once));
  assert.deepEqual(byId(twice), byId(once));
  assert.deepEqual(savedGraph(floorsSplit(twice)), twice);
});

test('contract: duplicate object ids are an error, an object of a missing room is an error, an overlap is a warning', () => {
  const h = savedGraph(house()); h.objects.push({ ...h.objects[0] }, { id: 'lost', type: 'sofa', roomId: 'gone', position: [1, 1] });
  const dup = checkContract(h);
  assert.ok(dup.errors.some((e) => e.code === 'duplicate-object'));
  assert.ok(dup.errors.some((e) => e.code === 'dangling-object'));
  const o = savedGraph(house()); o.objects.push({ id: 'k-fridge-2', type: 'refrigerator', roomId: 'kitchen', position: [1, 1] });
  const over = checkContract(savedGraph(o));
  assert.ok(over.warnings.some((w) => w.code === 'object-overlap'));
  assert.deepEqual(checkContract(savedGraph(house())).errors.filter((e) => e.code.includes('object')), []);
});
