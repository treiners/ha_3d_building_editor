import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { linkConnectors, addPartner } from '../src/link.js';

const conn = (id: string, roomId: string, side: string, offset: number, extra: any = {}): any => ({ id, roomId, side, type: 'door', position: 0.5, offset, ...extra });
const graph = (bExtra: any = {}, bLayout: any = { x: 4, y: 0, width: 3, height: 3 }, bConns?: any[]): any => ({
  rooms: [
    { id: 'a', name: 'A', connectors: [conn('a-right-door', 'a', 'right', 1.5, { width: 0.9, doorType: 'hinged', glazing: 'glass', door: { hinge: 'left', swing: 'inward', openAngle: 85, tilt: true } })], layout: { x: 0, y: 0, width: 4, height: 3 } },
    { id: 'b', name: 'B', connectors: bConns || [conn('b-left-door', 'b', 'left', 1.2, bExtra)], layout: bLayout },
  ],
  relationships: [],
});

describe('linkConnectors', () => {
  it('A right offset 1.5 (world y 1.5) + B left offset 1.2: B moves to 1.5 - 0 = 1.5, position 0.5; door mirrored (hinge left -> right, inward -> outward), tilt / glass / width kept', () => {
    const r = linkConnectors({ graph: graph(), connectorId: 'a-right-door', partnerId: 'b-left-door' });
    assert.ok(r.ok);
    const b = r.graph.rooms[1]!.connectors![0]!;
    assert.equal(b.offset, 1.5); assert.equal(b.position, 0.5); assert.equal(b.width, 0.9); assert.equal(b.glazing, 'glass'); assert.equal(b.doorType, 'hinged');
    assert.deepEqual(b.door, { hinge: 'right', swing: 'outward', openAngle: 85, tilt: true });
    assert.deepEqual(r.graph.relationships, [{ id: 'a-right-door--b-left-door', connectorA: 'a-right-door', connectorB: 'b-left-door', importance: 'required' }]);
  });
  it('the input graph is not changed', () => {
    const g = graph(); linkConnectors({ graph: g, connectorId: 'a-right-door', partnerId: 'b-left-door' });
    assert.equal(g.relationships.length, 0); assert.equal(g.rooms[1].connectors[0].offset, 1.2);
  });
  it('same side (A right + B right) -> not opposing walls', () => assert.match(linkConnectors({ graph: graph({}, undefined, [conn('b-right-door', 'b', 'right', 1)]), connectorId: 'a-right-door', partnerId: 'b-right-door' }).message, /not on opposing walls/));
  it('B in a 5 m high room, offset 4.5: |1.5 - 4.5| = 3 m apart -> refused', () => {
    const r = linkConnectors({ graph: graph({ offset: 4.5 }, { x: 4, y: 0, width: 3, height: 5 }), connectorId: 'a-right-door', partnerId: 'b-left-door' });
    assert.equal(r.ok, false); assert.match(r.message, /3 m apart/);
  });
  it('a window or an already connected connector cannot be linked', () => {
    assert.equal(linkConnectors({ graph: graph({ type: 'window' }), connectorId: 'a-right-door', partnerId: 'b-left-door' }).ok, false);
    const g = graph(); g.relationships.push({ id: 'x', connectorA: 'b-left-door', connectorB: 'other', importance: 'required' });
    assert.match(linkConnectors({ graph: g, connectorId: 'a-right-door', partnerId: 'b-left-door' }).message, /already connected/);
  });
});

describe('addPartner', () => {
  it('B without connectors: new "b-left-door" on B left at 1.5 (same world y), width 0.9, no wallAt (A right edge 4 = B left edge 4)', () => {
    const r = addPartner({ graph: graph({}, undefined, []), connectorId: 'a-right-door', roomId: 'b' });
    assert.ok(r.ok);
    const b = r.graph.rooms[1]!.connectors![0]!;
    assert.deepEqual([b.id, b.side, b.offset, b.position, b.width, b.wallAt], ['b-left-door', 'left', 1.5, 0.5, 0.9, undefined]);
    assert.equal(r.graph.relationships.length, 1);
    assert.equal(b.roomId, 'b');
  });
  it('B box starts at x 3.4 (notch wall at x 4): wallAt = 4 - 3.4 = 0.6', () => {
    const r = addPartner({ graph: graph({}, { x: 3.4, y: 0, width: 3.6, height: 3 }, []), connectorId: 'a-right-door', roomId: 'b' });
    assert.ok(r.ok); assert.equal(r.graph.rooms[1]!.connectors![0]!.wallAt, 0.6);
  });
  it('B box starts at x 4.5 (0.5 m away from the wall at x 4 > 0.08) -> refused; B does not reach y 1.5 -> refused', () => {
    assert.match(addPartner({ graph: graph({}, { x: 4.5, y: 0, width: 3, height: 3 }, []), connectorId: 'a-right-door', roomId: 'b' }).message, /does not reach the wall/);
    assert.match(addPartner({ graph: graph({}, { x: 4, y: 2, width: 3, height: 3 }, []), connectorId: 'a-right-door', roomId: 'b' }).message, /along the wall/);
  });
  it('id clash: an existing "b-left-door" -> "b-left-door-2"', () => {
    const g = graph({}, undefined, [conn('b-left-door', 'b', 'left', 2.9, { type: 'window' })]);
    assert.equal(addPartner({ graph: g, connectorId: 'a-right-door', roomId: 'b' }).graph.rooms[1]!.connectors![1]!.id, 'b-left-door-2');
  });
});
