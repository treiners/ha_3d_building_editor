import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fillDefaults } from '../src/defaults.js';
import { editorHtml } from '../src/editor.js';

const port = (id: string, roomId: string, side: string, extra: any = {}) => ({ id, roomId, side, type: 'door', offset: 1.5, ...extra });
const G = (a: any, b: any, extra: any = {}): any => ({ rooms: [{ id: 'a', name: 'A', connectors: [a] }, { id: 'b', name: 'B', connectors: [b] }, ...(extra.rooms || [])], relationships: [{ id: 'ab', connectorA: a.id, connectorB: b.id }] });

describe('fillDefaults (what Save graph writes)', () => {
  it('building defaults 0.16 / 2.4 / 0.12 are written; values that are set are kept', () => {
    assert.deepEqual(fillDefaults({ rooms: [], relationships: [] }).buildingDefaults, { wallThickness: 0.16, wallHeight: 2.4, floorThickness: 0.12 });
    assert.deepEqual(fillDefaults({ rooms: [], relationships: [], buildingDefaults: { wallHeight: 2.7 } }).buildingDefaults, { wallThickness: 0.16, wallHeight: 2.7, floorThickness: 0.12 });
  });
  it('a door pair with nothing set: A left / inward / 85, B the mirror (right / outward / 85), both widths 0.9; the input is untouched', () => {
    const g = G(port('ar', 'a', 'right'), port('bl', 'b', 'left')), E = fillDefaults(g);
    assert.deepEqual(E.rooms[0].connectors[0].door, { hinge: 'left', swing: 'inward', openAngle: 85 });
    assert.deepEqual(E.rooms[1].connectors[0].door, { hinge: 'right', swing: 'outward', openAngle: 85 });
    assert.deepEqual([E.rooms[0].connectors[0].width, E.rooms[1].connectors[0].width], [0.9, 0.9]);
    assert.ok(!('door' in g.rooms[0].connectors[0]) && !('width' in g.rooms[0].connectors[0]));
  });
  it('only B has a door (right / inward / 70): A becomes its mirror (left / outward / 70), B is unchanged', () => {
    const E = fillDefaults(G(port('ar', 'a', 'right'), port('bl', 'b', 'left', { door: { hinge: 'right', swing: 'inward', openAngle: 70 } })));
    assert.deepEqual(E.rooms[0].connectors[0].door, { hinge: 'left', swing: 'outward', openAngle: 70 }); assert.deepEqual(E.rooms[1].connectors[0].door, { hinge: 'right', swing: 'inward', openAngle: 70 });
  });
  it('passage 1.2 m without door spec, sliding door 0.9 m without swing, explicit width kept, window gets 0.8 / 2.1 / 0.08 / fixed and width 1.2', () => {
    const pass = fillDefaults(G(port('ar', 'a', 'right', { type: 'open-passage' }), port('bl', 'b', 'left', { type: 'open-passage', width: 2 })));
    assert.deepEqual([pass.rooms[0].connectors[0].width, pass.rooms[1].connectors[0].width], [1.2, 2]); assert.ok(!('door' in pass.rooms[0].connectors[0]));
    const sl = fillDefaults(G(port('ar', 'a', 'right', { doorType: 'sliding' }), port('bl', 'b', 'left', { doorType: 'sliding' })));
    assert.equal(sl.rooms[0].connectors[0].width, 0.9); assert.ok(!('door' in sl.rooms[0].connectors[0]));
    const w = fillDefaults({ rooms: [{ id: 'a', name: 'A', connectors: [port('aw', 'a', 'top', { type: 'window', window: { sillHeight: 1 } })] }], relationships: [] }).rooms[0].connectors[0];
    assert.deepEqual(w.window, { type: 'fixed', sillHeight: 1, headHeight: 2.1, frameDepth: 0.08 }); assert.equal(w.width, 1.2);
  });
  it('embedded in the editor and used by Save graph', () => { const h = editorHtml({ rooms: [], relationships: [] }); assert.ok(h.includes('function fillDefaults(') && h.includes('savedGraph(g)')); });
});
