import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkContract } from '../src/contract.js';
import { deriveJoints } from '../src/joints.js';
import { validateEntities, entityCatalog } from '../src/entities.js';
import { validateAreas, areaKinds } from '../src/areas.js';
import { validateObjects, objectDefs, objectCatalog, objectHost, objectFootprint } from '../src/objects.js';
import { stairsHost, stairBar, stairRect } from '../src/stairs.js';

const room = (id: string, x: number, floor?: string): any => ({ id, name: id, ...(floor ? { floor } : {}), connectors: [{ id: id + '-c', roomId: id, side: x === 0 ? 'right' : 'left', type: 'door', offset: 1.5 }], layout: { x, y: 0, width: 4, height: 3 } });
const base = (): any => ({ rooms: [room('a', 0), room('b', 4)], relationships: [{ id: 'a--b', connectorA: 'a-c', connectorB: 'b-c', type: 'door', required: true }] });

describe('contract check of a saved graph', () => {
  it('two touching rooms with doors at the same height (walls touch at x = 4, connector points both at y = 1.5): no errors, no warnings', () => {
    assert.deepEqual(checkContract(base()), { errors: [], warnings: [] });
  });
  it('errors: duplicate room id, connector of another room (also makes its relationship invalid), dangling connector, dangling wall alignment, room without layout, unknown floor', () => {
    let g = base(); g.rooms.push(room('a', 9)); assert.ok(checkContract(g).errors.some(e => e.code === 'duplicate-room'));
    g = base(); g.rooms[0].connectors[0].roomId = 'b'; assert.deepEqual(checkContract(g).errors.map(e => e.code), ['connector-room', 'relationship-invalid']);
    g = base(); g.relationships[0].connectorB = 'zzz'; assert.deepEqual(checkContract(g).errors.map(e => e.code), ['dangling-connector']);
    g = base(); g.wallAlignments = [{ id: 'al', roomIds: ['a', 'nope'] }]; assert.deepEqual(checkContract(g).errors.map(e => e.code), ['dangling-alignment']);
    g = base(); delete g.rooms[1].layout; assert.ok(checkContract(g).errors.some(e => e.code === 'no-layout' && e.message.includes('"b"')));
    g = base(); g.floors = [{ id: 'g', name: 'G' }]; g.rooms[0].floor = 'x'; assert.deepEqual(checkContract(g).errors.map(e => e.code), ['unknown-floor']);
  });
  it('a relationship that is not green is a warning: room b moved to x = 6 leaves a 2 m gap', () => {
    const g = base(); g.rooms[1].layout.x = 6; const r = checkContract(g);
    assert.deepEqual(r.errors, []); assert.deepEqual(r.warnings.map(w => w.code), ['relationship-broken']); assert.ok(r.warnings[0]!.message.includes('"a--b"'));
  });
  it('stairs: both ends inside rooms of their floors is fine; an end outside every room is a warning; floors that are not directly above each other, or no length, are errors', () => {
    const g: any = base(); g.floors = [{ id: 'g', name: 'G' }, { id: 'u', name: 'U' }]; g.rooms.forEach((r: any) => { r.floor = 'g'; }); g.rooms.push({ ...room('c', 4, 'u'), connectors: [] });
    g.stairs = [{ id: 's1', lower: 'g', upper: 'u', x: 2, y: 1, length: 3, width: 1, direction: 'right' }];
    assert.deepEqual(checkContract(g), { errors: [], warnings: [] });
    g.stairs[0].length = 1.5; assert.deepEqual(checkContract(g).warnings.map(w => w.code), ['stairs-room']);
    g.stairs[0].length = 0; assert.ok(checkContract(g).errors.some(e => e.code === 'stairs-size'));
    g.stairs[0] = { ...g.stairs[0], length: 3, lower: 'u', upper: 'g' }; assert.deepEqual(checkContract(g).errors.map(e => e.code), ['stairs-floors']);
  });
  it('entity and area problems from validateEntities / validateAreas are passed on as warnings with an entity- / area- prefix', () => {
    const g = base(); g.entityPlacements = [{ id: 'e', type: 'light', roomId: 'ghost-room', position: [1, 1] }];
    const direct = validateEntities(g), r = checkContract(g);
    assert.ok(direct.length > 0); assert.deepEqual(r.warnings.filter(w => w.code.startsWith('entity-')).map(w => w.message), direct.map(d => 'Entity "' + d.id + '": ' + d.message));
    assert.deepEqual(r.warnings.filter(w => w.code.startsWith('area-')).length, validateAreas(g).length);
  });
  it('embedded source evaluates and matches Node (siblings deriveJoints / validateEntities / validateAreas / validateObjects and their helpers entityCatalog / areaKinds / objectDefs / objectCatalog / objectHost / objectFootprint)', () => {
    const E: any = new Function(deriveJoints.toString() + '\n' + stairRect.toString() + '\n' + stairBar.toString() + '\n' + stairsHost.toString() + '\n' + entityCatalog.toString() + '\n' + areaKinds.toString() + '\n' + validateEntities.toString() + '\n' + validateAreas.toString() + '\n' + objectCatalog.toString() + '\n' + objectDefs.toString() + '\n' + objectFootprint.toString() + '\n' + objectHost.toString() + '\n' + validateObjects.toString() + '\n' + checkContract.toString() + '\nreturn checkContract;')();
    assert.deepEqual(E(base()), checkContract(base()));
  });
});
