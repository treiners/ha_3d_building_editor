// examples/house-with-shapes.json: the demonstration plan for room shapes (v2.18 phases 1-2). It must load, keep its shapes, be green and pass the contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate } from '../src/core.js';
import { savedGraph } from '../src/save.js';
import { checkContract } from '../src/contract.js';
import { deriveJoints } from '../src/joints.js';
import { outlineArea, outlineIssues } from '../src/shape.js';

const here = dirname(fileURLToPath(import.meta.url));
const raw = (): unknown => JSON.parse(readFileSync(join(here, '../../examples/house-with-shapes.json'), 'utf8'));

test('the example has four shaped rooms (L, bay, T, U) with areas 24, 14, 8 and 18 m2 (bounding box minus the cut-outs), all valid and size-locked after loading', () => {
  const g = migrate(raw());
  const shaped = g.rooms.filter((r) => r.outline);
  assert.deepEqual(shaped.map((r) => r.id), ['living', 'study', 'hall', 'bedroom']);
  assert.deepEqual(shaped.map((r) => outlineArea(r.outline!)), [24, 14, 8, 18]);
  for (const r of shaped) { assert.deepEqual(outlineIssues(r.outline!), [], r.id); assert.equal(r.layout!.sizeLocked, true, r.id); }
  assert.deepEqual(g.rooms.filter((r) => !r.outline).map((r) => r.id), ['kitchen', 'bath']);
});

test('the example is saved unchanged where it matters: outlines stay canonical, nothing is dropped', () => {
  const saved = savedGraph(migrate(raw()));
  assert.deepEqual(saved.rooms.map((r: { outline?: unknown }) => !!r.outline), [true, false, true, true, true, false]);
  assert.equal(saved.objects.length, 6); assert.equal(saved.entityPlacements.length, 9);
});

test('every relationship of the example is green (walls touch, openings line up) and the contract has neither errors nor warnings', () => {
  const saved = savedGraph(migrate(raw()));
  assert.deepEqual(deriveJoints(saved).joints.map((j: { status: string }) => j.status), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  const c = checkContract(saved);
  assert.deepEqual(c.errors, []); assert.deepEqual(c.warnings, []);
});
