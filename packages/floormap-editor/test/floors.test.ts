import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { floorsSplit, floorsMerge, floorsSwitch, floorsAdd, floorsRemove, floorsRename, floorsGhost, floorsFill } from '../src/floors.js';

const room = (id: string, x: number, y: number, floor?: string, name = id) => ({ id, name, ...(floor ? { floor } : {}), connectors: [{ id: id + '-r', roomId: id, side: 'right', type: 'door', offset: 1 }, { id: id + '-l', roomId: id, side: 'left', type: 'door', offset: 1 }], layout: { x, y, width: 4, height: 3 } });
const flat = (): any => ({
  floors: [{ id: 'g', name: 'Ground' }, { id: 'u', name: 'Upper' }],
  rooms: [room('a', 0, 0, 'g'), room('b', 4, 0, 'g'), room('c', 0, 0, 'u'), room('o', -9, -9, 'g', 'Outside')],
  relationships: [{ id: 'a--b', connectorA: 'a-r', connectorB: 'b-l' }], wallAlignments: [{ id: 'al', side: 'top', roomIds: ['c'] }],
  areas: [{ id: 'deck' }], entityPlacements: [{ id: 'e1', roomId: 'a' }, { id: 'e2', roomId: 'c' }, { id: 'e3', connectorId: 'c-l' }, { id: 'e4', areaId: 'deck' }],
});
const ids = (a: any[]) => a.map(x => x.id);

describe('floors', () => {
  it('no floors key: split and merge leave a single-floor graph unchanged', () => {
    const g: any = { rooms: [room('a', 0, 0)], relationships: [], wallAlignments: [] };
    assert.deepEqual(floorsSplit(g), g); assert.deepEqual(floorsMerge(g), g);
  });
  it('split: current floor = first floor (a, b, Outside); upper floor stashed with its alignment and the entities of room c and connector c-l; area entity stays', () => {
    const w = floorsSplit(flat());
    assert.deepEqual(ids(w.rooms), ['a', 'b', 'o']); assert.deepEqual(ids(w.relationships), ['a--b']); assert.deepEqual(w.wallAlignments, []);
    assert.deepEqual(ids(w.entityPlacements), ['e1', 'e4']); assert.equal(w._fl.cur, 'g');
    assert.deepEqual(ids(w._fl.data.u.rooms), ['c']); assert.deepEqual(ids(w._fl.data.u.wallAlignments), ['al']); assert.deepEqual(ids(w._fl.data.u.entityPlacements), ['e2', 'e3']);
  });
  it('split then merge returns every room, relationship, alignment and entity (floor order g, u)', () => {
    const m = floorsMerge(floorsSplit(flat()));
    assert.deepEqual(ids(m.rooms), ['a', 'b', 'o', 'c']); assert.deepEqual(m.rooms.map((r: any) => r.floor), ['g', 'g', 'g', 'u']);
    assert.deepEqual(ids(m.relationships), ['a--b']); assert.deepEqual(m.wallAlignments[0].roomIds, ['c']);
    assert.deepEqual(ids(m.entityPlacements).sort(), ['e1', 'e2', 'e3', 'e4']); assert.equal(m._fl, undefined); assert.deepEqual(m.floors, flat().floors);
  });
  it('switch: upper floor becomes current (rooms c), ground goes to the stash, the area entity e4 stays in the graph, e2 / e3 follow their floor; switching back restores', () => {
    const w = floorsSwitch(floorsSplit(flat()), 'u');
    assert.deepEqual(ids(w.rooms), ['c']); assert.equal(w._fl.cur, 'u'); assert.deepEqual(ids(w._fl.data.g.rooms), ['a', 'b', 'o']);
    assert.deepEqual(ids(w.entityPlacements).sort(), ['e2', 'e3', 'e4']); assert.deepEqual(ids(w._fl.data.g.entityPlacements), ['e1']);
    const back = floorsSwitch(w, 'g'); assert.deepEqual(ids(back.rooms), ['a', 'b', 'o']); assert.deepEqual(ids(back.entityPlacements).sort(), ['e1', 'e4']);
  });
  it('add empty floor on a single-floor graph: floors Floor 1 + Floor 2, the new floor is current with one placeholder room at the plan top-left (min x 3, y 1 of visible rooms), the old floor keeps its rooms', () => {
    const g: any = { rooms: [room('a', 3, 2), room('b', 7, 1)], relationships: [], wallAlignments: [] };
    const w = floorsAdd({ graph: g });
    assert.deepEqual(w.floors, [{ id: 'floor-1', name: 'Floor 1' }, { id: 'floor-2', name: 'Floor 2' }]); assert.equal(w._fl.cur, 'floor-2');
    assert.deepEqual(w.rooms.map((r: any) => [r.id, r.layout.x, r.layout.y, r.layout.width, r.layout.height]), [['room-1-floor-2', 3, 1, 4, 3]]);
    assert.deepEqual(ids(w._fl.data['floor-1'].rooms), ['a', 'b']);
  });
  it('add copy: ids get the suffix -floor-3, relationship ends follow, layouts equal, entities not copied; inserted above the current floor', () => {
    const w = floorsAdd({ graph: floorsSplit(flat()), copy: true, name: 'Attic' });
    assert.deepEqual(w.floors.map((f: any) => f.id), ['g', 'floor-3', 'u']); assert.equal(w.floors[1].name, 'Attic'); assert.equal(w._fl.cur, 'floor-3');
    assert.deepEqual(ids(w.rooms), ['a-floor-3', 'b-floor-3', 'o-floor-3']); assert.equal(w.relationships[0].connectorA, 'a-r-floor-3');
    assert.equal(w.rooms[0].connectors[0].roomId, 'a-floor-3'); assert.deepEqual(w.rooms[1].layout, { x: 4, y: 0, width: 4, height: 3 }); assert.deepEqual(ids(w._fl.data.g.rooms), ['a', 'b', 'o']);
    assert.deepEqual(ids(w.entityPlacements), ['e4']);
  });
  it('merge keeps ids unique when two floors use the same room id (second gets -u), including its connectors, relationship ends and entities', () => {
    const g: any = flat(); g.rooms[2] = room('a', 0, 0, 'u'); g.relationships.push({ id: 'a--b', connectorA: 'a-r', connectorB: 'a-l' }); g.entityPlacements = [{ id: 'x', roomId: 'a' }];
    const w = floorsSwitch(floorsSplit(g), 'u'), m = floorsMerge(w);
    assert.deepEqual(ids(m.rooms), ['a', 'b', 'o', 'a-u']); assert.deepEqual(ids(m.relationships), ['a--b', 'a--b-u']);
    assert.deepEqual([m.relationships[1].connectorA, m.relationships[1].connectorB], ['a-r-u', 'a-l-u']); assert.equal(m.rooms[3].connectors[0].roomId, 'a-u');
  });
  it('remove: the upper floor with its rooms, entities and stairs is gone, ground becomes current; with one floor nothing happens; rename trims and ignores empty names', () => {
    const g: any = flat(); g.stairs = [{ id: 's1', lower: 'g', upper: 'u', x: 0, y: 0, length: 3, width: 1, direction: 'right' }];
    const r = floorsRemove(floorsSwitch(floorsSplit(g), 'u'));
    assert.deepEqual(r.floors.map((f: any) => f.id), ['g']); assert.equal(r._fl.cur, 'g'); assert.deepEqual(Object.keys(r._fl.data), []); assert.deepEqual(ids(r.rooms), ['a', 'b', 'o']); assert.deepEqual(ids(r.entityPlacements).sort(), ['e1', 'e4']);
    assert.equal(r.stairs, undefined); assert.deepEqual(floorsRemove(r), r);
    assert.equal(floorsRename({ graph: flat(), id: 'u', name: '  Loft ' }).floors[1].name, 'Loft'); assert.equal(floorsRename({ graph: flat(), id: 'u', name: '  ' }).floors[1].name, 'Upper');
  });
  it('ghost: on the upper floor the footprints of a and b (Outside excluded); on the ground floor none', () => {
    const w = floorsSplit(flat());
    assert.deepEqual(floorsGhost(w), []);
    assert.deepEqual(floorsGhost(floorsSwitch(w, 'u')).map(r => [r.name, r.x, r.y, r.width, r.height]), [['a', 0, 0, 4, 3], ['b', 4, 0, 4, 3]]);
  });
  it('fill: height defaults to buildingDefaults.wallHeight 2.5 (own height 3 kept); elevation = 0, then 2.5 + floorThickness 0.2 = 2.7, then 2.7 + 3 + 0.2 = 5.9; without buildingDefaults 2.4 + 0.12 = 2.52; no floors key: unchanged', () => {
    const f: any = { floors: [{ id: 'g', name: 'G' }, { id: 'u', name: 'U', height: 3 }, { id: 'v', name: 'V' }], buildingDefaults: { wallHeight: 2.5, floorThickness: 0.2 } };
    assert.deepEqual(floorsFill(f).floors.map((x: any) => [x.height, x.elevation]), [[2.5, 0], [3, 2.7], [2.5, 5.9]]);
    assert.deepEqual(floorsFill({ floors: [{ id: 'g', name: 'G' }, { id: 'u', name: 'U' }] }).floors.map((x: any) => [x.height, x.elevation]), [[2.4, 0], [2.4, 2.52]]);
    assert.deepEqual(floorsFill({ rooms: [] }), { rooms: [] });
  });
  it('a new floor (empty or copy) inherits the height of the current floor when it has one', () => {
    const g: any = flat(); g.floors[0].height = 3.1;
    assert.equal(floorsAdd({ graph: floorsSplit(g) }).floors[1].height, 3.1); assert.equal(floorsAdd({ graph: floorsSplit(g), copy: true }).floors[1].height, 3.1);
    assert.equal(floorsAdd({ graph: floorsSplit(flat()) }).floors[1].height, undefined);
  });
  it('split converts the old room-link stairs: a (floor g, layout 0,0,4,3) -> stair at (0,0), length 4, width 3, direction right, floors as ids; new-format stairs stay', () => {
    const g: any = flat(); g.stairs = [{ id: 's1', lower: { floor: 'g', room: 'a' }, upper: { floor: 'u', room: 'c' } }, { id: 's2', lower: 'g', upper: 'u', x: 1, y: 1, length: 3, width: 1, direction: 'up' }];
    const w = floorsSplit(g);
    assert.deepEqual(w.stairs[0], { id: 's1', lower: 'g', upper: 'u', x: 0, y: 0, length: 4, width: 3, direction: 'right' }); assert.deepEqual(w.stairs[1], g.stairs[1]);
  });
  it('embedded source evaluates and matches Node (siblings floorsSwitch / floorsAdd / floorsRemove)', () => {
    const src = [floorsSplit, floorsMerge, floorsSwitch, floorsAdd, floorsRemove, floorsRename, floorsGhost].map(f => f.toString()).join('\n');
    const E: any = new Function(src + '\nreturn { floorsSplit, floorsAdd, floorsRemove, floorsMerge };')();
    assert.deepEqual(E.floorsMerge(E.floorsRemove(E.floorsAdd({ graph: E.floorsSplit(flat()), copy: true }))), floorsMerge(floorsRemove(floorsAdd({ graph: floorsSplit(flat()), copy: true }))));
  });
});
