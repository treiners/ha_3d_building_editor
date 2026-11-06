// checkContract(graph, true) adds a target (kind + id) to every issue that points at one item; without the flag the issues are unchanged.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkContract } from '../src/contract.js';

const room = (id: string, x = 0) => ({ id, name: id.toUpperCase(), layout: { x, y: 0, width: 4, height: 3 }, connectors: [] as unknown[] });

describe('contract issue targets', () => {
  it('a deck 2,0 3x2 overlapping room R (0,0 4x3) -> warning area-overlaps-room with the target area d; a duplicate room id -> error duplicate-room with the target room r', () => {
    const g = { rooms: [room('r')], relationships: [], areas: [{ id: 'd', name: 'D', kind: 'deck', shape: 'rect', layout: { x: 2, y: 0, width: 3, height: 2 } }] };
    const a = checkContract(g, true).warnings.find((w) => w.code === 'area-overlaps-room');
    assert.deepEqual(a && a.target, { kind: 'area', id: 'd' });
    const d = checkContract({ ...g, rooms: [room('r'), room('r', 10)] }, true).errors.find((e) => e.code === 'duplicate-room');
    assert.deepEqual(d && d.target, { kind: 'room', id: 'r' });
  });

  it('without the flag no issue has a target (the result is as before)', () => {
    const g = { rooms: [room('r'), room('r', 10)], relationships: [] };
    const r = checkContract(g);
    assert.ok(r.errors.length > 0);
    for (const i of [...r.errors, ...r.warnings]) assert.equal('target' in i, false);
  });

  it('a broken relationship points at the relationship: R right connector at offset 1 and S left connector at offset 2 with a gap of 2 m between the rooms', () => {
    const r = room('r'), s = room('s', 6);
    r.connectors = [{ id: 'c', roomId: 'r', side: 'right', offset: 1, width: 0.9 }];
    s.connectors = [{ id: 'd', roomId: 's', side: 'left', offset: 2, width: 0.9 }];
    const res = checkContract({ rooms: [r, s], relationships: [{ id: 'l', connectorA: 'c', connectorB: 'd' }] }, true);
    const w = res.warnings.find((x) => x.code === 'relationship-broken');
    assert.deepEqual(w && w.target, { kind: 'relationship', id: 'l' });
  });
});
