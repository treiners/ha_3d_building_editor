import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addObject, addObjectType, updateObject, updateObjectType, objectDefs, fillObjectDefaults } from '../src/objects.js';
import { editorHtml } from '../src/editor.js';

const base = { rooms: [{ id: 'a', name: 'A', layout: { x: 0, y: 0, width: 4, height: 3 } }], objects: [] as any[] };

describe('free object categories', () => {
  it('a type gets a new category, trimmed and lower-cased', () => {
    const t = addObjectType({ graph: base, label: 'Toilet' });
    const r = updateObjectType({ graph: t.graph, id: t.id, patch: { category: '  Sanitary ' } });
    assert.equal(r.ok, true);
    assert.equal(objectDefs(r.graph)[t.id]!.category, 'sanitary');
  });
  it('empty and 33-character categories are refused, the input graph is untouched', () => {
    const t = addObjectType({ graph: base, label: 'Bath' });
    for (const c of ['', '   ', 'x'.repeat(33)]) {
      const r = updateObjectType({ graph: t.graph, id: t.id, patch: { category: c } });
      assert.equal(r.ok, false, JSON.stringify(c));
    }
    assert.equal(objectDefs(t.graph)[t.id]!.category, 'furniture');
  });
  it('an object can carry its own category and Save keeps it', () => {
    const a = addObject({ graph: base, type: 'sofa', wx: 2, wy: 1.5 });
    const r = updateObject({ graph: a.graph, id: a.id, patch: { category: 'Outdoor' } });
    assert.equal(r.ok, true);
    assert.equal(fillObjectDefaults(r.graph).objects![0]!.category, 'outdoor');
    assert.equal(updateObject({ graph: a.graph, id: a.id, patch: { category: '' } }).ok, false);
  });
  it('the editor offers a category text box with suggestions and builds palette groups from categories', () => {
    const html = editorHtml({ rooms: [], relationships: [], wallAlignments: [] });
    assert.ok(html.includes('list="obj-cats"') && html.includes('<datalist id="obj-cats">'));
    assert.ok(html.includes("filter(c=>grp(c).length)"));
  });
});
