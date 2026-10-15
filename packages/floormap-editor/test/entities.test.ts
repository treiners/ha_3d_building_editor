import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entityCatalog, entityWorld, coverageSector, nearestAnchor, addEntity, moveEntity, updateEntity, removeEntity, validateEntities, convertEntityCoordinates, fillEntityDefaults, syncEntitySizes, coverageHints } from '../src/entities.js';
import { removeRoom, removeConnector } from '../src/edit.js';

const room = (id: string, x: number, y: number, connectors: any[] = [], w = 4, h = 3) => ({ id, name: id, sizeCategory: 'medium', connectors, layout: { x, y, width: w, height: h } });
const scene = (extra: any = {}): any => ({
  rooms: [
    room('a', 0, 0, [{ id: 'a-right-door', roomId: 'a', side: 'right', type: 'door', offset: 2 }, { id: 'a-top-window', roomId: 'a', side: 'top', type: 'window', offset: 1 }]),
    room('b', 4, 0, [{ id: 'b-left-door', roomId: 'b', side: 'left', type: 'door', offset: 2 }]),
  ],
  relationships: [{ id: 'a-right-door--b-left-door', connectorA: 'a-right-door', connectorB: 'b-left-door', importance: 'required' }], wallAlignments: [], ...extra,
});
const ent = (g: any) => g.entityPlacements as any[];

describe('entityWorld / coverageSector', () => {
  it('room anchor: room (10,2) + position [2.2,1.3] = (12.2,3.3)', () => {
    const g = { rooms: [room('l', 10, 2)] };
    assert.deepEqual(entityWorld(g, { roomId: 'l', position: [2.2, 1.3] }), { x: 12.2, y: 3.3, roomId: 'l' });
  });
  it('connector anchor: a-right-door (room a x 0..4, offset 2) = (4,2); window on top wall offset 1 = (1,0)', () => {
    const g = scene();
    assert.deepEqual(entityWorld(g, { connectorId: 'a-right-door' }), { x: 4, y: 2, roomId: 'a' });
    assert.deepEqual(entityWorld(g, { connectorId: 'a-top-window' }), { x: 1, y: 0, roomId: 'a' });
    assert.equal(entityWorld(g, { connectorId: 'nope' }), null);
  });
  it('sector at (0,0), facing 90 (right), fov 90, range 2, 2 steps: apex, (1.4142,-1.4142), (2,0), (1.4142,1.4142)', () => {
    assert.deepEqual(coverageSector(0, 0, 90, 90, 2, 2), [[0, 0], [1.4142, -1.4142], [2, 0], [1.4142, 1.4142]]);
  });
  it('facing 0 = up (-y): fov 20 range 1 steps 2 -> (-0.1736,-0.9848), (0,-1), (0.1736,-0.9848)', () => {
    assert.deepEqual(coverageSector(0, 0, 0, 20, 1, 2).slice(1), [[-0.1736, -0.9848], [0, -1], [0.1736, -0.9848]]);
  });
});

describe('addEntity', () => {
  it('motion sensor at world (12.2,3.3) in room (10,2), step 0.1 -> [2.2,1.3], catalogue defaults, id l-motion-sensor, then -2', () => {
    const g = { rooms: [room('l', 10, 2)], relationships: [], wallAlignments: [] } as any;
    const r = addEntity({ graph: g, type: 'motion-sensor', roomId: 'l', at: { x: 12.2, y: 3.3 }, step: 0.1 });
    assert.ok(r.ok); assert.deepEqual(ent(r.graph)[0], { id: 'l-motion-sensor', type: 'motion-sensor', roomId: 'l', position: [2.2, 1.3], height: 2.1, facingDegrees: 0, fieldOfViewDegrees: 100, range: 3.5 });
    assert.equal(g.entityPlacements, undefined);
    assert.equal(addEntity({ graph: r.graph, type: 'motion-sensor', roomId: 'l' }).id, 'l-motion-sensor-2');
  });
  it('light: default position = room centre (2,1.5) of a 4x3 room, height 2.2 clamped to wallHeight 2.0 -> 2', () => {
    const g = scene({ buildingDefaults: { wallThickness: 0.16, wallHeight: 2, floorThickness: 0.12 } });
    assert.deepEqual(ent(addEntity({ graph: g, type: 'light', roomId: 'a' }).graph)[0].position, [2, 1.5]);
    assert.equal(ent(addEntity({ graph: g, type: 'light', roomId: 'a' }).graph)[0].height, 2);
  });
  it('position outside the room is clamped: (20,20) in 4x3 -> [4,3]', () => {
    assert.deepEqual(ent(addEntity({ graph: scene(), type: 'light', roomId: 'a', at: { x: 20, y: 20 } }).graph)[0].position, [4, 3]);
  });
  it('door contact: ok on a door connector (id a-right-door-door-contact), refused on a window, refused twice on the same connector', () => {
    const r = addEntity({ graph: scene(), type: 'door-contact', connectorId: 'a-right-door' });
    assert.ok(r.ok); assert.deepEqual(ent(r.graph)[0], { id: 'a-right-door-door-contact', type: 'door-contact', connectorId: 'a-right-door' });
    assert.match(addEntity({ graph: scene(), type: 'door-contact', connectorId: 'a-top-window' }).message, /only fits door/);
    assert.match(addEntity({ graph: r.graph, type: 'door-contact', connectorId: 'a-right-door' }).message, /already has/);
  });
  it('refuses unknown type, missing room, missing connector', () => {
    assert.equal(addEntity({ graph: scene(), type: 'ufo', roomId: 'a' }).ok, false);
    assert.equal(addEntity({ graph: scene(), type: 'light', roomId: 'zz' }).ok, false);
    assert.equal(addEntity({ graph: scene(), type: 'door-contact' }).ok, false);
  });
  it('explicit id is slugged: "Living Light!" -> living-light', () => {
    assert.equal(addEntity({ graph: scene(), type: 'light', roomId: 'a', id: 'Living Light!' }).id, 'living-light');
  });
});

describe('moveEntity (re-parent) / updateEntity / removeEntity', () => {
  const withLight = () => addEntity({ graph: scene(), type: 'light', roomId: 'a', position: [1, 1] }).graph;
  it('drag to world (5.5,1): inside room b (x 4..8) -> roomId b, position [1.5,1]', () => {
    const r = moveEntity({ graph: withLight(), id: 'a-light', x: 5.5, y: 1 });
    assert.ok(r.ok); assert.equal(ent(r.graph)[0].roomId, 'b'); assert.deepEqual(ent(r.graph)[0].position, [1.5, 1]); assert.match(r.message, /Moved to b/);
  });
  it('drop outside every room (20,20): stays in room a, clamped to [4,3]', () => {
    const e = ent(moveEntity({ graph: withLight(), id: 'a-light', x: 20, y: 20 }).graph)[0];
    assert.equal(e.roomId, 'a'); assert.deepEqual(e.position, [4, 3]);
  });
  it('the smallest room under the point wins over a big Outside room', () => {
    const g = withLight(); g.rooms.push(room('Outside', -10, -10, [], 40, 40));
    assert.equal(ent(moveEntity({ graph: g, id: 'a-light', x: 5, y: 1 }).graph)[0].roomId, 'b');
    assert.equal(ent(moveEntity({ graph: g, id: 'a-light', x: 20, y: 20 }).graph)[0].roomId, 'Outside');
  });
  it('step 0.1: world (1.234,0.987) in room a -> [1.2,1]; connector entities cannot be moved', () => {
    assert.deepEqual(ent(moveEntity({ graph: withLight(), id: 'a-light', x: 1.234, y: 0.987, step: 0.1 }).graph)[0].position, [1.2, 1]);
    const c = addEntity({ graph: scene(), type: 'door-contact', connectorId: 'a-right-door' }).graph;
    assert.equal(moveEntity({ graph: c, id: 'a-right-door-door-contact', x: 1, y: 1 }).ok, false);
  });
  it('update: facing 450 -> 90, -90 -> 270, height 5 -> 2.4, fov 5 -> 10, range 0 -> 0.5; light ignores facing', () => {
    const m = addEntity({ graph: scene(), type: 'motion-sensor', roomId: 'a' }).graph, id = 'a-motion-sensor';
    const u = (patch: any) => ent(updateEntity({ graph: m, id, patch }).graph)[0];
    assert.equal(u({ facingDegrees: 450 }).facingDegrees, 90); assert.equal(u({ facingDegrees: -90 }).facingDegrees, 270);
    assert.equal(u({ height: 5 }).height, 2.4); assert.equal(u({ fieldOfViewDegrees: 5 }).fieldOfViewDegrees, 10); assert.equal(u({ range: 0 }).range, 0.5);
    assert.equal('facingDegrees' in ent(updateEntity({ graph: withLight(), id: 'a-light', patch: { facingDegrees: 90 } }).graph)[0], false);
  });
  it('update: rename, clash refused, name/haEntityId set and cleared', () => {
    let g = addEntity({ graph: withLight(), type: 'light', roomId: 'b' }).graph;
    assert.match(updateEntity({ graph: g, id: 'b-light', patch: { id: 'a-light' } }).message, /already used/);
    g = updateEntity({ graph: g, id: 'b-light', patch: { id: 'Hall Light', name: 'Hall', haEntityId: 'light.hall' } }).graph;
    assert.deepEqual([ent(g)[1].id, ent(g)[1].name, ent(g)[1].haEntityId], ['hall-light', 'Hall', 'light.hall']);
    g = updateEntity({ graph: g, id: 'hall-light', patch: { haEntityId: '' } }).graph; assert.equal('haEntityId' in ent(g)[1], false);
  });
  it('remove deletes one entity; unknown id fails', () => {
    assert.equal(ent(removeEntity({ graph: withLight(), id: 'a-light' }).graph).length, 0);
    assert.equal(removeEntity({ graph: withLight(), id: 'x' }).ok, false);
  });
});

describe('cascade', () => {
  const full = () => {
    let g = addEntity({ graph: scene(), type: 'light', roomId: 'a' }).graph;
    g = addEntity({ graph: g, type: 'light', roomId: 'b' }).graph;
    return addEntity({ graph: g, type: 'door-contact', connectorId: 'b-left-door' }).graph;
  };
  it('removeRoom a: removes its light; the contact on b-left-door stays (connector of the neighbour)', () => {
    const r = removeRoom({ graph: full(), roomId: 'a' });
    assert.deepEqual(ent(r.graph).map(e => e.id), ['b-light', 'b-left-door-door-contact']); assert.match(r.message, /1 entity removed/);
  });
  it('removeRoom b: removes its light and the contact on its connector (2 entities)', () => {
    const r = removeRoom({ graph: full(), roomId: 'b' });
    assert.deepEqual(ent(r.graph).map(e => e.id), ['a-light']); assert.match(r.message, /2 entities removed/);
  });
  it('removeConnector a-right-door (both) removes the contact on the partner b-left-door', () => {
    const r = removeConnector({ graph: full(), connectorId: 'a-right-door' });
    assert.deepEqual(ent(r.graph).map(e => e.id), ['a-light', 'b-light']); assert.match(r.message, /1 entity removed/);
  });
  it('graphs without entities: messages unchanged', () => {
    assert.doesNotMatch(removeRoom({ graph: scene(), roomId: 'a' }).message, /entit/);
  });
});

describe('validateEntities', () => {
  const codes = (g: any) => validateEntities(g).map(i => i.id + ':' + i.code);
  it('clean graph: no issues', () => {
    let g = addEntity({ graph: scene(), type: 'light', roomId: 'a' }).graph;
    g = addEntity({ graph: g, type: 'door-contact', connectorId: 'a-right-door' }).graph;
    assert.deepEqual(codes(g), []);
  });
  it('outside room (x 4.5 in a 4 m room), height 3 > 2.4, orphan room, orphan connector, duplicate id, unknown type', () => {
    const g = scene({ entityPlacements: [
      { id: 'o', type: 'light', roomId: 'a', position: [4.5, 1], height: 3 },
      { id: 'p', type: 'light', roomId: 'zz', position: [1, 1] },
      { id: 'q', type: 'door-contact', connectorId: 'zz' },
      { id: 'd', type: 'light', roomId: 'a', position: [1, 1] }, { id: 'd', type: 'light', roomId: 'a', position: [2, 1] },
      { id: 'u', type: 'ufo', roomId: 'a' }] });
    assert.deepEqual(codes(g).sort(), ['d:duplicate-id', 'o:height-range', 'o:outside-room', 'p:orphan', 'q:orphan', 'u:unknown-type']);
  });
  it('door contact on a window connector = type-mismatch; both connectors of one door = double-contact on both', () => {
    const g = scene({ entityPlacements: [
      { id: 'w', type: 'door-contact', connectorId: 'a-top-window' },
      { id: 'c1', type: 'door-contact', connectorId: 'a-right-door' }, { id: 'c2', type: 'door-contact', connectorId: 'b-left-door' }] });
    assert.deepEqual(codes(g), ['c1:double-contact', 'c2:double-contact', 'w:type-mismatch']);
  });
  it('both roomId and connectorId = orphan (exactly one anchor required)', () => {
    assert.deepEqual(codes(scene({ entityPlacements: [{ id: 'x', type: 'light', roomId: 'a', connectorId: 'a-right-door', position: [1, 1] }] })), ['x:orphan']);
  });
});

describe('coordinates and defaults', () => {
  it('plan -> room: room (10,2), plan position [12.2,3.3] -> [2.2,1.3]; setting becomes room; room -> plan inverts', () => {
    const g = { rooms: [room('l', 10, 2)], entitySettings: { coordinates: 'plan' }, entityPlacements: [{ id: 'x', type: 'light', roomId: 'l', position: [12.2, 3.3] }, { id: 'y', type: 'light', roomId: 'gone', position: [1, 1] }] };
    const r = convertEntityCoordinates(g, 'room');
    assert.deepEqual(r.entityPlacements.map((e: any) => e.position), [[2.2, 1.3], [1, 1]]); assert.equal(r.entitySettings.coordinates, 'room');
    assert.deepEqual(convertEntityCoordinates(r, 'plan').entityPlacements[0].position, [12.2, 3.3]);
    assert.deepEqual(convertEntityCoordinates(r, 'room').entityPlacements[0].position, [2.2, 1.3]);
  });
  it('fillEntityDefaults: no entities -> unchanged; with entities -> settings + missing height/directional values, existing kept', () => {
    const plain = scene(); assert.deepEqual(fillEntityDefaults(plain), plain);
    const r = fillEntityDefaults(scene({ entityPlacements: [{ id: 'm', type: 'motion-sensor', roomId: 'a', position: [1, 1], range: 5 }, { id: 'l', type: 'light', roomId: 'a', position: [1, 1] }] }));
    assert.deepEqual(r.entitySettings, { coordinates: 'room', gridStep: 0.1, resize: 'proportional', checks: { motion: true, doorContact: true } });
    assert.deepEqual(r.entityPlacements[0], { id: 'm', type: 'motion-sensor', roomId: 'a', position: [1, 1], range: 5, height: 2.1, facingDegrees: 0, fieldOfViewDegrees: 100 });
    assert.equal(r.entityPlacements[1].height, 2.2);
  });
});

describe('nearestAnchor / catalogue', () => {
  it('room types: smallest room under the point; none outside', () => {
    assert.deepEqual(nearestAnchor(scene(), 'light', 5, 1), { roomId: 'b', distance: 0 }); assert.equal(nearestAnchor(scene(), 'light', 50, 1), null);
  });
  it('door contact: pointer (4.3,2.1) is 0.3162 m from the door at (4,2); both partners tie -> smaller id; window ignored; beyond 0.6 m null', () => {
    assert.deepEqual(nearestAnchor(scene(), 'door-contact', 4.3, 2.1), { connectorId: 'a-right-door', distance: 0.3162 });
    assert.equal(nearestAnchor(scene(), 'door-contact', 1, 0.1), null); assert.equal(nearestAnchor(scene(), 'door-contact', 6, 2), null);
  });
  it('catalogue has the three MVP types; unknown type -> null', () => {
    assert.deepEqual(Object.keys(entityCatalog()), ['light', 'motion-sensor', 'camera', 'environment-sensor', 'smoke-detector', 'thermostat', 'water-leak', 'door-contact', 'window-contact', 'lock', 'cover']); assert.equal(nearestAnchor(scene(), 'ufo', 1, 1), null);
  });
});

describe('embedded source evaluates and matches Node', () => {
  it('toString of the functions, evaluated, gives identical results', () => {
    const fns = [entityCatalog, entityWorld, coverageSector, nearestAnchor, addEntity, moveEntity, updateEntity, removeEntity, validateEntities, convertEntityCoordinates, fillEntityDefaults];
    const E: any = new Function(fns.map(f => f.toString()).join('\n') + '\nreturn {' + fns.map(f => f.name).join(',') + '};')();
    const g = scene();
    const a = addEntity({ graph: g, type: 'motion-sensor', roomId: 'a', at: { x: 2.2, y: 1.3 }, step: 0.1 }), b = E.addEntity({ graph: g, type: 'motion-sensor', roomId: 'a', at: { x: 2.2, y: 1.3 }, step: 0.1 });
    assert.deepEqual(b, a);
    assert.deepEqual(E.moveEntity({ graph: a.graph, id: a.id, x: 5.5, y: 1 }), moveEntity({ graph: a.graph, id: a.id, x: 5.5, y: 1 }));
    assert.deepEqual(E.validateEntities(a.graph), validateEntities(a.graph));
    assert.deepEqual(E.coverageSector(1, 1, 30, 100, 3), coverageSector(1, 1, 30, 100, 3));
    assert.deepEqual(E.nearestAnchor(g, 'door-contact', 4.3, 2.1), nearestAnchor(g, 'door-contact', 4.3, 2.1));
    assert.deepEqual(E.fillEntityDefaults(a.graph), fillEntityDefaults(a.graph));
  });
});

describe('syncEntitySizes (entities keep their relative place when a room is resized)', () => {
  const base = () => {
    let g = addEntity({ graph: scene(), type: 'light', roomId: 'a', position: [4, 3] }).graph;
    g = addEntity({ graph: g, type: 'light', roomId: 'a', position: [1, 1.5] }).graph;
    return addEntity({ graph: g, type: 'light', roomId: 'b', position: [3, 2] }).graph;
  };
  it('room a 4x3 -> 2x1.5: [4,3] -> [2,1.5], [1,1.5] -> [0.5,0.75]; room b entity untouched; input not mutated', () => {
    const g = base(), s0 = syncEntitySizes(g, null);
    assert.equal(s0.changed, 0); assert.equal(s0.graph, g); assert.deepEqual(s0.sizes, { a: [4, 3], b: [4, 3] });
    const small = JSON.parse(JSON.stringify(g)); small.rooms[0].layout.width = 2; small.rooms[0].layout.height = 1.5;
    const r = syncEntitySizes(small, s0.sizes);
    assert.equal(r.changed, 2); assert.deepEqual(ent(r.graph).map(e => e.position), [[2, 1.5], [0.5, 0.75], [3, 2]]);
    assert.deepEqual(ent(small).map(e => e.position), [[4, 3], [1, 1.5], [3, 2]]); assert.deepEqual(r.sizes, { a: [2, 1.5], b: [4, 3] });
  });
  it('width only 4 -> 6 (x scales by 1.5, y unchanged): [2,1] -> [3,1]; shrinking back restores [2,1]', () => {
    const g = addEntity({ graph: scene(), type: 'light', roomId: 'a', position: [2, 1] }).graph, s0 = syncEntitySizes(g, null);
    const wide = JSON.parse(JSON.stringify(g)); wide.rooms[0].layout.width = 6;
    const r = syncEntitySizes(wide, s0.sizes); assert.deepEqual(ent(r.graph)[0].position, [3, 1]);
    const back = JSON.parse(JSON.stringify(r.graph)); back.rooms[0].layout.width = 4;
    assert.deepEqual(ent(syncEntitySizes(back, r.sizes).graph)[0].position, [2, 1]);
  });
  it('moving a room (x, y change, same size) changes nothing; rooms not seen before are ignored', () => {
    const g = base(), s0 = syncEntitySizes(g, null), moved = JSON.parse(JSON.stringify(g));
    moved.rooms[0].layout.x = 7; moved.rooms[0].layout.y = -2;
    const r = syncEntitySizes(moved, s0.sizes); assert.equal(r.changed, 0); assert.equal(r.graph, moved);
    assert.equal(syncEntitySizes(moved, { b: [4, 3] }).changed, 0);
  });
  it('save rounds positions to 4 decimals: [0.123456, 1] -> [0.1235, 1]', () => {
    const g = scene({ entityPlacements: [{ id: 'l', type: 'light', roomId: 'a', position: [0.123456, 1] }] });
    assert.deepEqual(fillEntityDefaults(g).entityPlacements[0].position, [0.1235, 1]);
  });
  it('embedded source gives the same result as Node', () => {
    const E: any = new Function(syncEntitySizes.toString() + '\nreturn syncEntitySizes;')();
    const g = base(), s0 = syncEntitySizes(g, null), small = JSON.parse(JSON.stringify(g)); small.rooms[0].layout.width = 2;
    assert.deepEqual(E(small, s0.sizes), syncEntitySizes(small, s0.sizes));
  });
});

describe('more types and anchor resize mode', () => {
  it('window contact: ok on a window connector (id a-top-window-window-contact), refused on a door; door contact refused on the window', () => {
    const r = addEntity({ graph: scene(), type: 'window-contact', connectorId: 'a-top-window' });
    assert.ok(r.ok); assert.deepEqual(ent(r.graph)[0], { id: 'a-top-window-window-contact', type: 'window-contact', connectorId: 'a-top-window' });
    assert.match(addEntity({ graph: scene(), type: 'window-contact', connectorId: 'a-right-door' }).message, /only fits window/);
    assert.equal(nearestAnchor(scene(), 'window-contact', 1, 0.2)!.connectorId, 'a-top-window'); assert.equal(nearestAnchor(scene(), 'window-contact', 4, 2), null);
  });
  it('environment sensor: default measures [temperature, humidity], height 1.5; update keeps catalogue order, drops unknown values, ignores an empty selection', () => {
    const g = addEntity({ graph: scene(), type: 'environment-sensor', roomId: 'a' }).graph, id = 'a-environment-sensor';
    assert.deepEqual([ent(g)[0].measures, ent(g)[0].height], [['temperature', 'humidity'], 1.5]);
    const u = (measures: any) => ent(updateEntity({ graph: g, id, patch: { measures } }).graph)[0].measures;
    assert.deepEqual(u(['voc', 'co2', 'ufo', 'temperature']), ['temperature', 'co2', 'voc']); assert.deepEqual(u([]), ['temperature', 'humidity']);
    const bad = scene({ entityPlacements: [{ id: 'x', type: 'environment-sensor', roomId: 'a', position: [1, 1], measures: ['ufo'] }] });
    assert.deepEqual(validateEntities(bad).map(i => i.code), ['invalid-option']);
  });
  it('water leak height 0.1 (floor level); smoke detector height 2.3 clamped to wallHeight 2 -> 2', () => {
    const g = scene({ buildingDefaults: { wallThickness: 0.16, wallHeight: 2, floorThickness: 0.12 } });
    assert.equal(ent(addEntity({ graph: g, type: 'water-leak', roomId: 'a' }).graph)[0].height, 0.1);
    assert.equal(ent(addEntity({ graph: g, type: 'smoke-detector', roomId: 'a' }).graph)[0].height, 2);
    assert.equal(ent(addEntity({ graph: scene(), type: 'smoke-detector', roomId: 'a' }).graph)[0].height, 2.3);
  });
  it('anchor mode, room 4x3 -> 2x1.5: [3.5,2.5] (auto = bottom-right) -> [1.5,1]; [0.5,0.5] stays; explicit tl on [3.5,2.5] -> clamped [2,1.5]; proportional would give [1.75,1.25]', () => {
    const mk = (resize?: string) => scene({ entitySettings: resize ? { resize } : undefined, entityPlacements: [
      { id: 'br', type: 'light', roomId: 'a', position: [3.5, 2.5] }, { id: 'tl', type: 'light', roomId: 'a', position: [0.5, 0.5] }, { id: 'fx', type: 'light', roomId: 'a', position: [3.5, 2.5], anchorCorner: 'tl' }] });
    const run = (g: any) => { const s0 = syncEntitySizes(g, null), small = JSON.parse(JSON.stringify(g)); small.rooms[0].layout.width = 2; small.rooms[0].layout.height = 1.5; return ent(syncEntitySizes(small, s0.sizes).graph).map(e => e.position); };
    assert.deepEqual(run(mk('anchor')), [[1.5, 1], [0.5, 0.5], [2, 1.5]]);
    assert.deepEqual(run(mk())[0], [1.75, 1.25]); assert.deepEqual(run(mk('proportional'))[0], [1.75, 1.25]);
  });
  it('anchorCorner: set br; empty / invalid removes it; save adds resize and measures defaults', () => {
    let g = addEntity({ graph: scene(), type: 'environment-sensor', roomId: 'a' }).graph;
    g = updateEntity({ graph: g, id: 'a-environment-sensor', patch: { anchorCorner: 'br' } }).graph; assert.equal(ent(g)[0].anchorCorner, 'br');
    assert.equal('anchorCorner' in ent(updateEntity({ graph: g, id: 'a-environment-sensor', patch: { anchorCorner: '' } }).graph)[0], false);
    const r = fillEntityDefaults(scene({ entityPlacements: [{ id: 'e', type: 'environment-sensor', roomId: 'a', position: [1, 1] }] }));
    assert.deepEqual([r.entitySettings.resize, r.entityPlacements[0].measures, r.entityPlacements[0].height], ['proportional', ['temperature', 'humidity'], 1.5]);
  });
});

describe('camera, thermostat, lock, blind / cover', () => {
  it('camera: directional defaults height 2.3, fov 90, range 8, facing 0; range 40 is clamped to 30; save fills missing values', () => {
    const g = addEntity({ graph: scene(), type: 'camera', roomId: 'a' }).graph;
    assert.deepEqual(ent(g)[0], { id: 'a-camera', type: 'camera', roomId: 'a', position: [2, 1.5], height: 2.3, facingDegrees: 0, fieldOfViewDegrees: 90, range: 8 });
    assert.equal(ent(updateEntity({ graph: g, id: 'a-camera', patch: { range: 40 } }).graph)[0].range, 30);
    assert.deepEqual(fillEntityDefaults(scene({ entityPlacements: [{ id: 'c', type: 'camera', roomId: 'a', position: [1, 1] }] })).entityPlacements[0], { id: 'c', type: 'camera', roomId: 'a', position: [1, 1], height: 2.3, facingDegrees: 0, fieldOfViewDegrees: 90, range: 8 });
  });
  it('thermostat: height 1.5, clamped to wallHeight 1 -> 1; no directional fields', () => {
    assert.deepEqual(ent(addEntity({ graph: scene(), type: 'thermostat', roomId: 'a' }).graph)[0], { id: 'a-thermostat', type: 'thermostat', roomId: 'a', position: [2, 1.5], height: 1.5 });
    assert.equal(ent(addEntity({ graph: scene({ buildingDefaults: { wallThickness: 0.16, wallHeight: 1, floorThickness: 0.12 } }), type: 'thermostat', roomId: 'a' }).graph)[0].height, 1);
  });
  it('lock: ok on a door (a-right-door-lock), refused on a window; a lock on each end of one door is double-contact', () => {
    assert.equal(addEntity({ graph: scene(), type: 'lock', connectorId: 'a-right-door' }).id, 'a-right-door-lock');
    assert.match(addEntity({ graph: scene(), type: 'lock', connectorId: 'a-top-window' }).message, /only fits door/);
    assert.deepEqual(validateEntities(scene({ entityPlacements: [{ id: 'x', type: 'lock', connectorId: 'a-right-door' }, { id: 'y', type: 'lock', connectorId: 'b-left-door' }] })).map(i => i.id + ':' + i.code), ['x:double-contact', 'y:double-contact']);
  });
  it('cover: fits windows and doors; a window can have a contact AND a cover, but not two covers; type mismatch is not flagged', () => {
    let g = addEntity({ graph: scene(), type: 'window-contact', connectorId: 'a-top-window' }).graph;
    const r = addEntity({ graph: g, type: 'cover', connectorId: 'a-top-window' });
    assert.equal(r.id, 'a-top-window-cover'); g = r.graph;
    assert.match(addEntity({ graph: g, type: 'cover', connectorId: 'a-top-window' }).message, /already has/);
    g = addEntity({ graph: g, type: 'cover', connectorId: 'a-right-door' }).graph;
    assert.deepEqual(ent(g).map(e => e.id), ['a-top-window-window-contact', 'a-top-window-cover', 'a-right-door-cover']); assert.deepEqual(validateEntities(g), []);
  });
  it('nearestAnchor for cover: (1,0.2) -> window a-top-window, (4,2.1) -> door a-right-door', () => {
    assert.equal(nearestAnchor(scene(), 'cover', 1, 0.2)!.connectorId, 'a-top-window'); assert.equal(nearestAnchor(scene(), 'cover', 4, 2.1)!.connectorId, 'a-right-door');
  });
});

describe('coverageHints (rooms without motion sensor, doors without contact)', () => {
  const keys = (g: any) => coverageHints(g).map(h => h.key);
  it('empty scene: door hint first (sorted), then rooms a and b; messages and one-click fixes', () => {
    const h = coverageHints(scene());
    assert.deepEqual(h.map(x => x.key), ['no-door-contact|a-right-door--b-left-door', 'no-motion|a', 'no-motion|b']);
    assert.equal(h[0]!.message, 'Door between "a" and "b" has no contact.'); assert.deepEqual(h[0]!.fix, { type: 'door-contact', connectorId: 'a-right-door' });
    assert.deepEqual(h[1]!.fix, { type: 'motion-sensor', roomId: 'a' }); assert.deepEqual(h[1]!.target, { roomId: 'a' });
  });
  it('a motion sensor in a clears only room a; a contact on the PARTNER end (b-left-door) clears the door', () => {
    let g = addEntity({ graph: scene(), type: 'motion-sensor', roomId: 'a' }).graph;
    assert.deepEqual(keys(g), ['no-door-contact|a-right-door--b-left-door', 'no-motion|b']);
    g = addEntity({ graph: g, type: 'door-contact', connectorId: 'b-left-door' }).graph; assert.deepEqual(keys(g), ['no-motion|b']);
  });
  it('the Outside room and rooms without a layout are never flagged; an unpaired door gets its own hint', () => {
    const g = scene(); g.rooms.push({ id: 'o', name: 'Outside', connectors: [], layout: { x: -9, y: -9, width: 30, height: 30 } }, { id: 'u', name: 'u', connectors: [] });
    g.rooms[0].connectors.push({ id: 'a-front-door', roomId: 'a', side: 'left', type: 'door', offset: 1 });
    assert.deepEqual(keys(g), ['no-door-contact|a-front-door', 'no-door-contact|a-right-door--b-left-door', 'no-motion|a', 'no-motion|b']);
    assert.equal(coverageHints(g)[0]!.message, 'Door of "a" has no contact.');
  });
  it('checks switch each rule off; ignoredHints removes single hints', () => {
    assert.deepEqual(keys(scene({ entitySettings: { checks: { motion: false } } })), ['no-door-contact|a-right-door--b-left-door']);
    assert.deepEqual(keys(scene({ entitySettings: { checks: { doorContact: false } } })), ['no-motion|a', 'no-motion|b']);
    assert.deepEqual(keys(scene({ entitySettings: { ignoredHints: ['no-motion|a'] } })), ['no-door-contact|a-right-door--b-left-door', 'no-motion|b']);
  });
  it('applying every fix (add motion sensor / door contact) leaves no hints', () => {
    let g = scene();
    for (const h of coverageHints(g)) g = addEntity({ graph: g, type: h.fix.type, roomId: h.fix.roomId, connectorId: h.fix.connectorId }).graph;
    assert.deepEqual(ent(g).map(e => e.id), ['a-right-door-door-contact', 'a-motion-sensor', 'b-motion-sensor']); assert.deepEqual(coverageHints(g), []);
  });
  it('save fills missing checks without overriding set ones; embedded source matches Node', () => {
    assert.deepEqual(fillEntityDefaults(scene({ entitySettings: { checks: { motion: false } } })).entitySettings.checks, { motion: false, doorContact: true });
    const E: any = new Function(coverageHints.toString() + '\nreturn coverageHints;')();
    assert.deepEqual(E(scene()), coverageHints(scene()));
  });
});

describe('entity mode shell (HTML structure)', () => {
  it('editor HTML: switch + sidebar block present once, ids unique, entity functions embedded, CSS scoped (no bare element selectors)', async () => {
    const { editorHtml } = await import('../src/editor.js');
    const { entityCss } = await import('../src/editor-entities.js');
    const html = editorHtml(scene());
    const body = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
    const ids = [...body.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ['ent-inspector', 'ent-hint', 'ent-count', 'ent-cov']) assert.equal(ids.filter(i => i === id).length, 1);
    assert.equal(body.split('data-app-btn="entities"').length - 1, 1);
    assert.equal(body.split('data-ptype="door-contact"').length - 1, 1);
    for (const f of ['entityCatalog', 'addEntity', 'moveEntity', 'updateEntity', 'validateEntities', 'fillEntityDefaults']) assert.ok(html.includes('function ' + f + '('), f);
    const selectors = entityCss.split('}').map(r => r.split('{')[0]!.trim()).filter(Boolean).flatMap(s => s.split(','));
    for (const s of selectors) assert.ok(/^(\.|body\[)/.test(s.trim()), 'unscoped selector: ' + s);
    assert.doesNotMatch(entityCss, /(^|[}\s,])svg\s*\{/);
  });
  it('old editor behaviour is guarded: the floor-plan pointerdown returns early only in entity mode', async () => {
    const { editorHtml } = await import('../src/editor.js');
    assert.ok(editorHtml(scene()).includes("svg.addEventListener('pointerdown',e=>{if(appMode==='entities')return;"));
  });
});
