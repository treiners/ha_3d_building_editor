// The fan: an object type ("fan", ceiling fan) whose speed and direction are two entities that sit on it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addEntity, entitySuggestions, entityCatalog } from '../src/entities.js';
import { objectCatalog } from '../src/objects.js';

const graph = () => ({
  rooms: [{ id: 'r', name: 'R', layout: { x: 0, y: 0, width: 5, height: 4 }, connectors: [] }],
  objects: [{ id: 'f1', type: 'fan', roomId: 'r', position: [2.5, 2], facingDegrees: 0 }, { id: 's1', type: 'sofa', roomId: 'r', position: [1, 1], facingDegrees: 0 }],
});

describe('fan object with speed and direction entities', () => {
  it('the object catalogue has a ceiling fan 1.2 x 1.2 m, 0.3 m high, 2.1 m above the floor; the entity catalogue has fan-speed and fan-direction, object-only', () => {
    const f = objectCatalog().fan!;
    assert.deepEqual([f.label, f.width, f.depth, f.height, f.elevation], ['Fan', 1.2, 1.2, 0.3, 2.1]);
    for (const t of ['fan-speed', 'fan-direction']) assert.deepEqual([entityCatalog()[t].onObject, entityCatalog()[t].objectOnly, entityCatalog()[t].objectTypes], [true, true, ['fan']]);
  });

  it('suggestions for a fan object start with its speed and direction', () => {
    assert.deepEqual(entitySuggestions('fan').slice(0, 2), ['fan-speed', 'fan-direction']);
    assert.equal(entitySuggestions('sofa').includes('fan-speed'), false);
  });

  it('speed and direction sit on the fan (centre of the object, height min(2.1 + 0.3, wall height 2.4) = 2.4), one each; not in a room, not on a sofa', () => {
    let g = graph();
    const s = addEntity({ graph: g, type: 'fan-speed', objectId: 'f1' });
    assert.equal(s.ok, true, s.message);
    assert.deepEqual([s.graph.entityPlacements[0].objectId, s.graph.entityPlacements[0].position, s.graph.entityPlacements[0].height], ['f1', [0, 0], 2.4]);
    g = s.graph as ReturnType<typeof graph>;
    const d = addEntity({ graph: g, type: 'fan-direction', objectId: 'f1' });
    assert.equal(d.ok, true, d.message);
    assert.match(addEntity({ graph: s.graph, type: 'fan-speed', objectId: 'f1' }).message, /already has a fan speed/);
    assert.match(addEntity({ graph: graph(), type: 'fan-speed', roomId: 'r', position: [1, 1] }).message, /must sit on a fan object/);
    assert.match(addEntity({ graph: graph(), type: 'fan-direction', objectId: 's1' }).message, /only fits fan objects/);
  });
});
