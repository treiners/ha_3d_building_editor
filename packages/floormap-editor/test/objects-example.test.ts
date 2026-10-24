// The example house with objects (examples/objects-example.ts): built from the reference home, deterministic and free of problems.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildObjectsExample, objectsExampleIssues } from '../examples/objects-example.js';

const here = dirname(fileURLToPath(import.meta.url));
const reference = (): unknown => JSON.parse(readFileSync(join(here, '../../../shared/reference-home-connectors.json'), 'utf8'));

test('the example has objects with entities on them, a custom type, and no object or entity problems', () => {
  const g = buildObjectsExample(reference());
  assert.deepEqual(objectsExampleIssues(g), []);
  assert.ok((g.objects || []).length >= 4, 'objects: ' + (g.objects || []).length);
  assert.ok((g.entityPlacements || []).length >= 3, 'entities: ' + (g.entityPlacements || []).length);
  assert.ok((g.objectTypes || []).some((t: { id: string }) => t.id === 'aquarium'), 'custom type');
  for (const e of g.entityPlacements || []) assert.ok(e.objectId && !e.roomId && !e.areaId && !e.connectorId, e.id);
  for (const o of g.objects || []) assert.ok(typeof o.width === 'number' && typeof o.depth === 'number' && o.category, 'defaults written for ' + o.id);
});

test('the example is deterministic', () => {
  assert.equal(JSON.stringify(buildObjectsExample(reference())), JSON.stringify(buildObjectsExample(reference())));
});
