import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shiftOrigin } from '../src/origin.js';

const room = (id: string, x: number, y: number, name = id) => ({ id, name, connectors: [], layout: { x, y, width: 4, height: 3 } });
const scene = (): any => ({
  rooms: [room('a', 3, 2), room('b', 7, 1), room('o', -5, -5, 'Outside')], relationships: [],
  areas: [{ id: 'deck', layout: { x: 10, y: 0.6, width: 4, height: 3 } }],
  entitySettings: { coordinates: 'plan' }, entityPlacements: [{ id: 'e', roomId: 'a', position: [5, 3] }, { id: 'c', connectorId: 'x' }],
});

describe('shiftOrigin (top-left corner of the house becomes 0,0 on save)', () => {
  it('min x = 3 and min y = 1 over visible rooms: a (3,2) -> (0,1), b (7,1) -> (4,0), Outside (-5,-5) -> (-8,-6) is ignored for the minimum but shifted', () => {
    const g = shiftOrigin(scene());
    assert.deepEqual(g.rooms.map((r: any) => [r.layout.x, r.layout.y]), [[0, 1], [4, 0], [-8, -6]]);
  });
  it('areas shift with the plan (10, 0.6) -> (7, -0.4); plan-coordinate entities (5, 3) -> (2, 2); connector entities untouched', () => {
    const g = shiftOrigin(scene());
    assert.deepEqual([g.areas[0].layout.x, g.areas[0].layout.y], [7, -0.4]);
    assert.deepEqual(g.entityPlacements[0].position, [2, 2]); assert.equal(g.entityPlacements[1].position, undefined);
  });
  it('room-relative entities are not shifted; input is not mutated; shifting twice changes nothing', () => {
    const s = scene(); s.entitySettings = {}; const before = JSON.stringify(s), g = shiftOrigin(s);
    assert.deepEqual(g.entityPlacements[0].position, [5, 3]); assert.equal(JSON.stringify(s), before);
    assert.deepEqual(shiftOrigin(g), g);
  });
  it('no visible room with a layout: unchanged; no -0 after rounding', () => {
    assert.deepEqual(shiftOrigin({ rooms: [room('o', 4, 4, 'Outside')] }).rooms[0].layout.x, 4);
    const g = shiftOrigin({ rooms: [room('a', 0.1 + 0.2, 0)] }); assert.ok(Object.is(g.rooms[0].layout.x, 0) && Object.is(g.rooms[0].layout.y, 0));
  });
  it('stairs shift with the plan: min x 3, y 1 -> a stair at (5, 4) goes to (2, 3)', () => {
    const g = shiftOrigin({ ...scene(), stairs: [{ id: 's', lower: 'a', upper: 'b', x: 5, y: 4, length: 3, width: 1, direction: 'right' }] });
    assert.deepEqual([g.stairs[0].x, g.stairs[0].y], [2, 3]);
  });
  it('embedded source evaluates and matches Node', () => {
    const E: any = new Function(shiftOrigin.toString() + '\nreturn shiftOrigin;')();
    assert.deepEqual(E(scene()), shiftOrigin(scene()));
  });
});
