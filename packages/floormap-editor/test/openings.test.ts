import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addOpening, connectRooms } from '../src/edit.js';
import { deriveJoints } from '../src/joints.js';

const room = (id: string, x: number, y: number, extra: any = {}) => ({ id, name: id === 'outside' ? 'Outside' : id, sizeCategory: 'medium', connectors: [] as any[], layout: { x, y, width: 4, height: 3, ...extra } });
const scene = (...rooms: any[]) => ({ rooms, relationships: [] as any[], wallAlignments: [] as any[] }) as any;
const okJoints = (g: any) => deriveJoints(g).joints.filter(j => j.status === 'ok').length;
const conns = (g: any, id: string) => g.rooms.find((r: any) => r.id === id).connectors;

describe('addOpening: second door between the same two rooms', () => {
  const twoRooms = () => connectRooms({ graph: scene(room('a', 0, 0), room('b', 4, 0)), roomA: 'a', roomB: 'b' }).graph;
  it('first door (Connect) sits at y 1.5; a click at (4, 2.6), snap 0.1, is clamped into the shared part [0.45, 2.55] (half a door width from the ends) -> 2.55: a pair a-right-door-2 / b-left-door-2 at the same point, both joints ok', () => {
    const g = twoRooms(), r = addOpening({ graph: g, type: 'door', at: { x: 4, y: 2.6 }, snap: 0.1 });
    assert.ok(r.ok, r.message); assert.equal(r.id, 'a-right-door-2'); assert.deepEqual(r.point, { x: 4, y: 2.55 }); assert.match(r.message, /connecting to b/);
    assert.deepEqual([conns(r.graph, 'a').map((c: any) => [c.id, c.offset]), conns(r.graph, 'b').map((c: any) => [c.id, c.offset])], [[['a-right-door', 1.5], ['a-right-door-2', 2.55]], [['b-left-door', 1.5], ['b-left-door-2', 2.55]]]);
    assert.deepEqual(r.graph.relationships.map((l: any) => l.id), ['a-right-door--b-left-door', 'a-right-door-2--b-left-door-2']); assert.equal(okJoints(r.graph), 2);
    assert.equal(conns(g, 'a').length, 1, 'input not mutated');
  });
  it('a click at (4, 1.9) is 0.4 m from the first door (needs 0.9/2 + 0.9/2 + 0.1 = 1.0 m): refused; exactly 1.0 m (y 2.5) is allowed', () => {
    assert.match(addOpening({ graph: twoRooms(), type: 'door', at: { x: 4, y: 1.9 }, snap: 0.1 }).message, /Too close/);
    assert.ok(addOpening({ graph: twoRooms(), type: 'door', at: { x: 4, y: 2.5 } }).ok);
  });
  it('an open passage (1.2 m) at y 0.7 is 0.8 m from the first door but needs 0.6 + 0.45 + 0.1 = 1.15 m: refused', () => {
    assert.match(addOpening({ graph: twoRooms(), type: 'open-passage', at: { x: 4, y: 0.7 } }).message, /Too close/);
  });
  it('a gap of 0.05 m between the walls still pairs (tolerance 0.08)', () => {
    const r = addOpening({ graph: scene(room('a', 0, 0), room('b', 4.05, 0)), type: 'door', at: { x: 4, y: 1.5 } });
    assert.ok(r.ok); assert.equal(r.graph.relationships.length, 1);
  });
});

describe('addOpening: exterior doors and windows (unpaired)', () => {
  it('door on the top wall at (2, 0.1), snap 0.1 -> x 2: connector a-top-door offset 2, position 0.5, no relationship', () => {
    const r = addOpening({ graph: scene(room('a', 0, 0)), type: 'door', at: { x: 2, y: 0.1 }, snap: 0.1 });
    assert.ok(r.ok); assert.deepEqual(conns(r.graph, 'a'), [{ id: 'a-top-door', roomId: 'a', side: 'top', type: 'door', position: 0.5, offset: 2 }]);
    assert.equal(r.graph.relationships.length, 0); assert.deepEqual(r.point, { x: 2, y: 0 }); assert.match(r.message, /not connected \(exterior\)/);
  });
  it('window on the left wall at (0.05, 1.2): a-left-window offset 1.2, no width key; with width 0.8 the width is stored; doorType is ignored for windows', () => {
    const g = scene(room('a', 0, 0)), w = addOpening({ graph: g, type: 'window', at: { x: 0.05, y: 1.2 }, snap: 0.1, doorType: 'sliding' });
    assert.deepEqual(conns(w.graph, 'a')[0], { id: 'a-left-window', roomId: 'a', side: 'left', type: 'window', position: 0.4, offset: 1.2 });
    assert.equal(conns(addOpening({ graph: g, type: 'window', at: { x: 0, y: 1.2 }, width: 0.8 }).graph, 'a')[0].width, 0.8);
  });
  it('a window on a wall shared with room b stays unpaired (never a relationship, nothing added to b)', () => {
    const r = addOpening({ graph: scene(room('a', 0, 0), room('b', 4, 0)), type: 'window', at: { x: 4, y: 0.5 }, width: 0.6, snap: 0.1 });
    assert.ok(r.ok, r.message); assert.equal(r.graph.relationships.length, 0); assert.deepEqual([conns(r.graph, 'a').length, conns(r.graph, 'b').length], [1, 0]); assert.equal(conns(r.graph, 'a')[0].offset, 0.5);
  });
  it('two openings on one wall: ids a-top-door then a-top-door-2 (x 1 and x 3 are 2 m apart, 1.0 m needed)', () => {
    let g = addOpening({ graph: scene(room('a', 0, 0)), type: 'door', at: { x: 1, y: 0 } }).graph;
    g = addOpening({ graph: g, type: 'door', at: { x: 3, y: 0 } }).graph;
    assert.deepEqual(conns(g, 'a').map((c: any) => [c.id, c.offset]), [['a-top-door', 1], ['a-top-door-2', 3]]);
  });
  it('the hidden Outside room can be the partner of a door (reference-home style) but is never the wall that is hit', () => {
    const g = scene(room('a', 0, 0), room('outside', 4, 0));
    const r = addOpening({ graph: g, type: 'door', at: { x: 4, y: 1.5 } });
    assert.deepEqual([r.id, r.graph.relationships[0].connectorB], ['a-right-door', 'outside-left-door']); assert.equal(okJoints(r.graph), 1);
    assert.match(addOpening({ graph: scene(room('outside', 0, 0)), type: 'door', at: { x: 2, y: 0 } }).message, /Click on a wall/);
  });
  it('the open passage and door width/doorType are stored like Connect does (width 1.5, doorType sliding)', () => {
    const r = addOpening({ graph: scene(room('a', 0, 0)), type: 'door', at: { x: 2, y: 3 }, width: 1.5, doorType: 'sliding' });
    assert.deepEqual([conns(r.graph, 'a')[0].id, conns(r.graph, 'a')[0].width, conns(r.graph, 'a')[0].doorType], ['a-bottom-door', 1.5, 'sliding']);
  });
});

describe('addOpening: partly shared walls, limits and refusals', () => {
  it('G (x 4, y 1..2.5) touches only part of a\'s right wall: a click at y 0.4 is exterior (unpaired, clamped to 0.45); a click at y 1.8 pairs with g, clamped into [1.45, 2.05] -> 1.8 (offsets a 1.8, g 0.8)', () => {
    const g = scene(room('a', 0, 0), room('g', 4, 1, { width: 3, height: 1.5 }));
    const ext = addOpening({ graph: g, type: 'door', at: { x: 4, y: 0.4 }, snap: 0.1 });
    assert.deepEqual([conns(ext.graph, 'a')[0].offset, ext.graph.relationships.length, conns(ext.graph, 'g').length], [0.45, 0, 0]);
    const pair = addOpening({ graph: g, type: 'door', at: { x: 4, y: 1.8 }, snap: 0.1 });
    assert.deepEqual([conns(pair.graph, 'a')[0].offset, conns(pair.graph, 'g')[0].offset, pair.graph.relationships.length, okJoints(pair.graph)], [1.8, 0.8, 1, 1]);
  });
  it('a 0.9 m wide room is too short for a door (needs 1.0 m) and a window (1.3 m)', () => {
    const g = scene(room('d', 10, 10, { width: 0.9 }));
    assert.match(addOpening({ graph: g, type: 'door', at: { x: 10.4, y: 10 } }).message, /too short for a door \(needs 1 m\)/); assert.match(addOpening({ graph: g, type: 'window', at: { x: 10.4, y: 10 } }).message, /too short for a window/);
  });
  it('reach is 0.5 m: 0.4 m above the wall works, 0.6 m does not, far away does not', () => {
    const g = scene(room('a', 0, 0));
    assert.ok(addOpening({ graph: g, type: 'door', at: { x: 2, y: -0.4 } }).ok); assert.match(addOpening({ graph: g, type: 'door', at: { x: 2, y: -0.6 } }).message, /Click on a wall/); assert.match(addOpening({ graph: g, type: 'door', at: { x: 20, y: 20 } }).message, /Click on a wall/);
  });
  it('unknown type falls back to door; unplaced rooms are ignored; the result is deterministic', () => {
    const g = scene(room('a', 0, 0), { id: 'u', name: 'u', connectors: [] });
    const r1 = addOpening({ graph: g, type: 'ufo', at: { x: 2, y: 0 } }), r2 = addOpening({ graph: g, type: 'ufo', at: { x: 2, y: 0 } });
    assert.equal(conns(r1.graph, 'a')[0].type, 'door'); assert.deepEqual(r1, r2);
  });
  it('embedded source matches Node', () => {
    const E: any = new Function(addOpening.toString() + '\nreturn addOpening;')(), g = connectRooms({ graph: scene(room('a', 0, 0), room('b', 4, 0)), roomA: 'a', roomB: 'b' }).graph;
    for (const i of [{ type: 'door', at: { x: 4, y: 2.6 }, snap: 0.1 }, { type: 'window', at: { x: 0, y: 1 } }, { type: 'open-passage', at: { x: 2, y: 3 }, width: 1.5 }, { type: 'door', at: { x: 40, y: 1 } }]) assert.deepEqual(E({ graph: g, ...i }), addOpening({ graph: g, ...i } as any));
  });
});
