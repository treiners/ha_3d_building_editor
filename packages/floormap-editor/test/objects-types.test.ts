// Objects phase 4 (src/objects.ts): custom types and editing type defaults.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addObject, addObjectType, objectCatalog, objectDefs, removeObjectType, updateObjectType, type ObjectGraph } from '../src/objects.js';
import { embeddedSource } from '../src/embed.js';

const base = (): ObjectGraph => ({ rooms: [{ id: 'r', name: 'R', layout: { x: 0, y: 0, width: 4, height: 3 }, connectors: [] }], objects: [] });

test('add type: "New type" gets id new-type and the defaults furniture 0.5 x 0.5 x 0.8; a second one gets new-type-2; the input is not mutated', () => {
  const g = base(), before = JSON.stringify(g);
  const a = addObjectType({ graph: g, label: 'New type' });
  assert.equal(JSON.stringify(g), before);
  assert.deepEqual([a.id, a.graph.objectTypes![0]!.category, a.graph.objectTypes![0]!.width, a.graph.objectTypes![0]!.depth, a.graph.objectTypes![0]!.height], ['new-type', 'furniture', 0.5, 0.5, 0.8]);
  assert.equal(addObjectType({ graph: a.graph, label: 'New type' }).id, 'new-type-2');
});

test('add type from the sofa without a label: label "Sofa copy", id sofa-copy, width 2 and depth 0.9 copied; the id never clashes with a built-in (label "Sofa" gives sofa-2)', () => {
  const r = addObjectType({ graph: base(), from: 'sofa' });
  assert.deepEqual([r.id, r.graph.objectTypes![0]!.label, r.graph.objectTypes![0]!.width, r.graph.objectTypes![0]!.depth], ['sofa-copy', 'Sofa copy', 2, 0.9]);
  assert.equal(addObjectType({ graph: base(), label: 'Sofa' }).id, 'sofa-2');
  assert.equal(addObjectType({ graph: base(), from: 'nope' }).ok, false);
});

test('a new type can be placed and shows in objectDefs; the built-in catalogue is untouched', () => {
  const t = addObjectType({ graph: base(), label: 'Piano' }), p = addObject({ graph: t.graph, type: 'piano', wx: 2, wy: 1.5 });
  assert.ok(p.ok); assert.equal(objectDefs(t.graph).piano!.label, 'Piano'); assert.equal(objectCatalog().piano, undefined);
});

test('update a built-in: refrigerator width 0.7 creates an override that keeps depth 0.65, height 1.85 and clearance 0.7; objects without own size follow', () => {
  const g0 = addObject({ graph: base(), type: 'refrigerator', wx: 2, wy: 1.5 }).graph;
  const r = updateObjectType({ graph: g0, id: 'refrigerator', patch: { width: 0.7 } });
  assert.ok(r.ok);
  assert.deepEqual(r.graph.objectTypes!.map((t) => [t.id, t.width, t.depth, t.height, t.clearance]), [['refrigerator', 0.7, 0.65, 1.85, 0.7]]);
  assert.equal(objectDefs(r.graph).refrigerator!.width, 0.7); assert.equal(objectCatalog().refrigerator!.width, 0.6);
});

test('update refuses width 0, height 5, a negative clearance and an empty name; clearance 0 removes the clearance', () => {
  const g = base();
  for (const patch of [{ width: 0 }, { height: 5 }, { clearance: -1 }, { label: '  ' }]) {
    const r = updateObjectType({ graph: g, id: 'sofa', patch }); assert.equal(r.ok, false); assert.equal(r.graph, g);
  }
  assert.equal(updateObjectType({ graph: g, id: 'nope', patch: { width: 1 } }).ok, false);
  const r = updateObjectType({ graph: g, id: 'refrigerator', patch: { clearance: 0 } });
  assert.equal(r.graph.objectTypes![0]!.clearance, undefined);
});

test('remove: resetting a built-in override brings back 0.6; a built-in without override is refused; objectTypes disappears when empty', () => {
  const edited = updateObjectType({ graph: base(), id: 'refrigerator', patch: { width: 0.7 } }).graph;
  const r = removeObjectType({ graph: edited, id: 'refrigerator' });
  assert.ok(r.ok); assert.equal(objectDefs(r.graph).refrigerator!.width, 0.6); assert.equal(r.graph.objectTypes, undefined);
  assert.equal(removeObjectType({ graph: base(), id: 'sofa' }).ok, false);
});

test('remove: a custom type that an object uses is refused (also on another floor); an unused one is deleted', () => {
  const t = addObjectType({ graph: base(), label: 'Piano' }).graph, used = addObject({ graph: t, type: 'piano', wx: 2, wy: 1.5 }).graph;
  const r = removeObjectType({ graph: used, id: 'piano' });
  assert.equal(r.ok, false); assert.match(r.message, /1 object uses/);
  const other: ObjectGraph = { ...t, _fl: { cur: 'f1', data: { f2: { objects: [{ id: 'x', type: 'piano', roomId: 'r', position: [1, 1] }] } } } };
  assert.equal(removeObjectType({ graph: other, id: 'piano' }).ok, false);
  const ok = removeObjectType({ graph: t, id: 'piano' });
  assert.ok(ok.ok); assert.equal(ok.graph.objectTypes, undefined);
});

test('the type functions are embedded in the page source', () => {
  const src = embeddedSource();
  for (const f of ['addObjectType', 'updateObjectType', 'removeObjectType']) assert.ok(src.includes('function ' + f + '('), f);
});
