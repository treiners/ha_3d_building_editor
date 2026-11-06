import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mirrorDoor } from '../src/door.js';
import { fillDefaults } from '../src/defaults.js';

describe('fillDefaults door options', () => {
  const g = (conns: any[]): any => ({ rooms: [{ id: 'r', name: 'R', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: conns }], relationships: [] });
  it('hinged door keeps tilt; its default spec is hinge left, inward, 85', () => {
    const c = fillDefaults(g([{ id: 'd', roomId: 'r', side: 'top', type: 'door', door: { tilt: true } }])).rooms[0].connectors[0];
    assert.deepEqual(c.door, { hinge: 'left', swing: 'inward', openAngle: 85, tilt: true });
  });
  it('sliding / pocket door: hinge, swing and openAngle are dropped, door.slide is always written (end kept, otherwise start)', () => {
    const out = fillDefaults(g([
      { id: 's', roomId: 'r', side: 'top', type: 'door', doorType: 'sliding', door: { hinge: 'left', swing: 'inward', openAngle: 85, slide: 'end' } },
      { id: 'p', roomId: 'r', side: 'bottom', type: 'door', doorType: 'pocket', door: { hinge: 'left', swing: 'inward', openAngle: 85 } },
    ])).rooms[0].connectors;
    assert.deepEqual(out[0].door, { slide: 'end' }); assert.deepEqual(out[1].door, { slide: 'start' });
  });
  it('windows: hinged and tilt-turn get hinge left + swing inward, slide-horizontal gets slide start, right / outward / end are kept, fixed and tilt get nothing extra', () => {
    const w = (type: string, extra: any = {}) => ({ id: 'w' + type, roomId: 'r', side: 'top', type: 'window', window: { type, ...extra } });
    const out = fillDefaults(g([w('hinged'), w('tilt-turn', { hinge: 'right', swing: 'outward' }), w('slide-horizontal'), w('slide-horizontal', { slide: 'end' }), w('fixed'), w('tilt')])).rooms[0].connectors.map((c: any) => c.window);
    assert.deepEqual([out[0].hinge, out[0].swing, out[0].slide], ['left', 'inward', undefined]);
    assert.deepEqual([out[1].hinge, out[1].swing], ['right', 'outward']);
    assert.deepEqual([out[2].slide, out[2].hinge, out[3].slide], ['start', undefined, 'end']);
    for (const i of [4, 5]) assert.deepEqual([out[i].hinge, out[i].swing, out[i].slide], [undefined, undefined, undefined]);
  });
});
import { validateObjects } from '../src/objects.js';

describe('objects in front of sliding doors', () => {
  const g = (doorType: string): any => ({
    rooms: [{ id: 'r', name: 'R', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [{ id: 'd', roomId: 'r', side: 'top', type: 'door', offset: 2, width: 0.9, doorType }] }],
    objects: [{ id: 'o', type: 'table', roomId: 'r', position: [2, 0.4 + 0.45], width: 0.8, depth: 0.9 }],
  });
  it('table front edge at y 0.4: hinged door zone is 0.9 deep -> blocks-door; sliding / pocket zone is 0.1 deep -> free', () => {
    assert.deepEqual(validateObjects(g('hinged')).filter((i) => i.code === 'blocks-door').map((i) => i.id), ['o']);
    assert.deepEqual(validateObjects(g('sliding')).filter((i) => i.code === 'blocks-door'), []);
    assert.deepEqual(validateObjects(g('pocket')).filter((i) => i.code === 'blocks-door'), []);
  });
  it('table at y 0.05 .. 0.95 (centre 0.5, depth 0.9, edge at 0.05) is inside the 0.1 m zone of a sliding door -> blocks-door', () => {
    const x = g('sliding'); x.objects[0].position = [2, 0.5];
    assert.deepEqual(validateObjects(x).filter((i) => i.code === 'blocks-door').map((i) => i.id), ['o']);
  });
});

describe('mirrorDoor options', () => {
  it('plain door: hinge and swing flip, no tilt / slide keys appear', () => assert.deepEqual(mirrorDoor({ hinge: 'left', swing: 'inward', openAngle: 85 }), { hinge: 'right', swing: 'outward', openAngle: 85 }));
  it('tilt-and-turn stays, slide end stays (both walls run along the same axis)', () => assert.deepEqual(mirrorDoor({ hinge: 'right', swing: 'outward', openAngle: 90, tilt: true, slide: 'end' }), { hinge: 'left', swing: 'inward', openAngle: 90, tilt: true, slide: 'end' }));
  it('tilt false / slide start are dropped (defaults)', () => assert.deepEqual(mirrorDoor({ hinge: 'left', swing: 'inward', openAngle: 85, tilt: false, slide: 'start' }), { hinge: 'right', swing: 'outward', openAngle: 85 }));
});
