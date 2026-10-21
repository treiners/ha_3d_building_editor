import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entityCatalog, entityWorld, coverageHints } from '../src/entities.js';

const scene = (sensors: any[], coverage = true): any => ({
  rooms: [{ id: 'a', name: 'a', connectors: [], layout: { x: 0, y: 0, width: 4, height: 4 } }], relationships: [],
  entitySettings: { checks: { doorContact: false, coverage } },
  entityPlacements: sensors.map((s, i) => ({ id: 's' + i, type: 'motion-sensor', roomId: 'a', ...s })),
});
const low = (g: any) => coverageHints(g).filter(h => h.code === 'low-coverage');

describe('coverage gaps (motion sensors cover < 80% of a room)', () => {
  it('4x4 room, 360 degree sensor in the centre with range 3 (corner distance 2.83 <= 3): 100%, no hint', () => {
    assert.equal(low(scene([{ position: [2, 2], facingDegrees: 0, fieldOfViewDegrees: 360, range: 3 }])).length, 0);
  });
  it('range 1 in the centre: pi*1^2 / 16 = 19.6% -> 20%, hint with a "add motion sensor" fix', () => {
    const h = low(scene([{ position: [2, 2], facingDegrees: 0, fieldOfViewDegrees: 360, range: 1 }]));
    assert.equal(h.length, 1); assert.equal(h[0]!.key, 'low-coverage|a');
    assert.equal(h[0]!.message, 'Room "a": motion sensors cover only 20% of the floor.');
    assert.deepEqual(h[0]!.fix, { type: 'motion-sensor', roomId: 'a' });
  });
  it('sensor in the top-left corner facing 135 degrees, fov 90, range 6: the whole room lies inside the cone, no hint', () => {
    assert.equal(low(scene([{ position: [0, 0], facingDegrees: 135, fieldOfViewDegrees: 90, range: 6 }])).length, 0);
  });
  it('wall sensor at (0,2): 90 degree cone, range 2.9 leaves a gap (hint, also with a second overlapping one); 180 degrees, range 4.5 reaches the far corner (4,0) at 4.47 m: no hint', () => {
    const w = { position: [0, 2], facingDegrees: 90, fieldOfViewDegrees: 90, range: 2.9 };
    assert.equal(low(scene([w])).length, 1);
    assert.equal(low(scene([w, { ...w, position: [0, 1] }])).length, 1);
    assert.equal(low(scene([{ ...w, fieldOfViewDegrees: 180, range: 4.5 }])).length, 0);
  });
  it('off unless entitySettings.checks.coverage is true; rooms without sensors only get the no-motion hint', () => {
    assert.equal(low(scene([{ position: [2, 2], fieldOfViewDegrees: 360, range: 1 }], false)).length, 0);
    assert.equal(low(scene([])).length, 0);
  });
  it('embedded source evaluates and matches Node', () => {
    const E: any = new Function(entityCatalog.toString() + '\n' + entityWorld.toString() + '\n' + coverageHints.toString() + '\nreturn coverageHints;')();
    const g = scene([{ position: [2, 2], fieldOfViewDegrees: 360, range: 1 }]);
    assert.deepEqual(E(g), coverageHints(g));
  });
});
