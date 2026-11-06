import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addEntity, updateEntity, validateEntities } from '../src/entities.js';

const conn = (id: string, roomId: string, side: string, type: string, extra: any = {}): any => ({ id, roomId, side, type, position: 0.5, offset: 2, ...extra });
const graph = (windowType = 'tilt-turn'): any => ({
  rooms: [
    { id: 'r', name: 'R', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [conn('w1', 'r', 'top', 'window', { window: { type: windowType } }), conn('d1', 'r', 'right', 'door')] },
    { id: 's', name: 'S', layout: { x: 4, y: 0, width: 3, height: 3 }, connectors: [conn('d2', 's', 'left', 'door')] },
  ],
  relationships: [{ id: 'd1--d2', connectorA: 'd1', connectorB: 'd2', importance: 'required' }],
});
const ent = (g: any) => g.entityPlacements as any[];

describe('several entities on one connector (v3.2)', () => {
  it('the same type and role can be added again and again: ids w1-window-contact, -2, -3; no role is written for open', () => {
    let g = graph();
    for (let i = 0; i < 3; i++) g = addEntity({ graph: g, type: 'window-contact', connectorId: 'w1' }).graph;
    assert.deepEqual(ent(g).map((e) => e.id), ['w1-window-contact', 'w1-window-contact-2', 'w1-window-contact-3']);
    assert.ok(ent(g).every((e) => !('role' in e))); assert.deepEqual(validateEntities(g), []);
  });
  it('explicit role tilt on a tilt-turn window: role tilt, id ...-tilt, repeatable (-tilt-2); an unknown role is refused', () => {
    const a = addEntity({ graph: graph(), type: 'window-contact', connectorId: 'w1', role: 'tilt' });
    assert.ok(a.ok); assert.equal(a.id, 'w1-window-contact-tilt'); assert.equal(ent(a.graph)[0].role, 'tilt');
    assert.equal(addEntity({ graph: a.graph, type: 'window-contact', connectorId: 'w1', role: 'tilt' }).id, 'w1-window-contact-tilt-2');
    assert.match(addEntity({ graph: graph(), type: 'window-contact', connectorId: 'w1', role: 'slide' }).message, /Unknown role/);
  });
  it('a fixed window or a door that does not tilt cannot get a tilt contact (add and update), but any number of open contacts', () => {
    assert.match(addEntity({ graph: graph('fixed'), type: 'window-contact', connectorId: 'w1', role: 'tilt' }).message, /needs a window of type tilt/);
    assert.match(addEntity({ graph: graph(), type: 'door-contact', connectorId: 'd1', role: 'tilt' }).message, /needs a window of type tilt|door that tilts/);
    const a = addEntity({ graph: graph('fixed'), type: 'window-contact', connectorId: 'w1' }), b = addEntity({ graph: a.graph, type: 'window-contact', connectorId: 'w1' });
    assert.ok(b.ok); assert.match(updateEntity({ graph: b.graph, id: 'w1-window-contact', patch: { role: 'tilt' } }).message, /needs a window of type tilt/);
    const g = graph(); g.rooms[0].connectors[1].door = { hinge: 'left', swing: 'inward', openAngle: 85, tilt: true };
    assert.equal(addEntity({ graph: g, type: 'door-contact', connectorId: 'd1', role: 'tilt' }).id, 'd1-door-contact-tilt');
  });
  it('updateEntity role: open -> tilt writes role (also when another tilt contact exists), tilt -> open removes the key', () => {
    const a = addEntity({ graph: graph(), type: 'window-contact', connectorId: 'w1', role: 'tilt' }), b = addEntity({ graph: a.graph, type: 'window-contact', connectorId: 'w1' });
    const c = updateEntity({ graph: b.graph, id: 'w1-window-contact', patch: { role: 'tilt' } });
    assert.ok(c.ok); assert.deepEqual(ent(c.graph).map((e) => e.role), ['tilt', 'tilt']);
    assert.equal('role' in ent(updateEntity({ graph: c.graph, id: 'w1-window-contact-tilt', patch: { role: 'open' } }).graph)[0], false);
  });
  it('a door can carry contact, lock, cover and several more at once; two locks on the two ends of a door are fine; objects may carry the same connector-type entity twice', () => {
    let g = graph();
    for (const t of ['door-contact', 'lock', 'cover', 'door-contact', 'cover']) { const r = addEntity({ graph: g, type: t, connectorId: 'd1' }); assert.ok(r.ok, t); g = r.graph; }
    g = addEntity({ graph: g, type: 'lock', connectorId: 'd2' }).graph;
    assert.deepEqual(ent(g).map((e) => e.id), ['d1-door-contact', 'd1-lock', 'd1-cover', 'd1-door-contact-2', 'd1-cover-2', 'd2-lock']); assert.deepEqual(validateEntities(g), []);
  });
});

describe('validateEntities with roles', () => {
  const e = (id: string, type: string, connectorId: string, role?: string): any => ({ id, type, connectorId, ...(role ? { role } : {}) });
  const codes = (g: any) => validateEntities(g).map((i) => i.id + ':' + i.code);
  it('tilt contact on a window of type tilt-turn is fine; on a fixed window -> role-mismatch', () => {
    const g = graph(); g.entityPlacements = [e('t', 'window-contact', 'w1', 'tilt')];
    assert.deepEqual(codes(g), []);
    const f = graph('fixed'); f.entityPlacements = [e('t', 'window-contact', 'w1', 'tilt')];
    assert.deepEqual(codes(f), ['t:role-mismatch']);
  });
  it('tilt contact on a door needs door.tilt', () => {
    const g = graph(); g.entityPlacements = [e('t', 'door-contact', 'd1', 'tilt')];
    assert.deepEqual(codes(g), ['t:role-mismatch']);
    g.rooms[0].connectors[1].door = { hinge: 'left', swing: 'inward', openAngle: 85, tilt: true };
    assert.deepEqual(codes(g), []);
  });
  it('unknown role -> invalid-option; the same type and role several times on one door is no problem', () => {
    const g = graph(); g.entityPlacements = [e('x', 'window-contact', 'w1', 'slide')];
    assert.deepEqual(codes(g), ['x:invalid-option']);
    g.entityPlacements = [e('a', 'door-contact', 'd1'), e('b', 'door-contact', 'd2'), e('c', 'door-contact', 'd1')];
    assert.deepEqual(codes(g), []);
  });
});
