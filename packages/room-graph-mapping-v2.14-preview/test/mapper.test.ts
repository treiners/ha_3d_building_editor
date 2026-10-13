import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { migrate, mapOnlyMissing, runMapper, metrics } from '../src/core.js';
import { editorHtml } from '../src/editor.js';
import { mapLayout } from '../src/mapper.js';

// packages/reference-home-connectors.json: schema 2.1 graph without any coordinates (output of the first two editors).
// Compiled test location: <pkg>/dist/test/ -> three levels up is packages/.
const REF = new URL('../../../reference-home-connectors.json', import.meta.url);
const ref = (): any => JSON.parse(readFileSync(REF, 'utf8'));
const finite = (g: any) => g.rooms.every((r: any) => ['x', 'y', 'width', 'height'].every(k => Number.isFinite(r.layout[k])) && r.connectors.every((p: any) => Number.isFinite(p.offset)));

describe('initial mapper on the reference home', () => {
  it('maps a graph without any coordinates: finite, no overlaps, every relationship aligned', () => {
    const g = migrate(ref()); mapOnlyMissing(g); const m = metrics(g);
    assert.ok(finite(g), 'no NaN/null coordinates or offsets');
    assert.equal(m.overlaps, 0); assert.equal(m.open, 0); assert.equal(m.satisfied, g.relationships.length);
  });
  it('keeps supplied layouts and places only the missing rooms', () => {
    const raw = ref(); raw.rooms.find((r: any) => r.id === 'living').layout = { x: 10, y: 20, width: 6, height: 4, locked: true };
    const g = migrate(raw); mapOnlyMissing(g); const L = g.rooms.find(r => r.id === 'living')!.layout!;
    assert.deepEqual([L.x, L.y, L.width, L.height, L.locked], [10, 20, 6, 4, true]);
    assert.ok(finite(g)); assert.equal(metrics(g).overlaps, 0);
    assert.ok(g.rooms.find(r => r.id === 'dining')!.layout!.x >= 16 - 1e-9, 'dining is to the right of living');
  });
  it('is deterministic and independent of input order', () => {
    const a = migrate(ref()), raw = ref(); raw.rooms.reverse(); raw.relationships.reverse(); const b = migrate(raw);
    mapOnlyMissing(a); mapOnlyMissing(b);
    const key = (g: any) => JSON.stringify([...g.rooms].sort((p: any, q: any) => p.id.localeCompare(q.id)).map((r: any) => [r.id, r.layout]));
    assert.equal(key(a), key(b));
  });
  it('Run mapper keeps locked rooms and sizes, and never produces NaN', () => {
    const g = migrate(ref()); mapOnlyMissing(g);
    g.rooms.find(r => r.id === 'bath')!.layout!.locked = true; const bath = { ...g.rooms.find(r => r.id === 'bath')!.layout! };
    g.rooms.find(r => r.id === 'toilet')!.layout!.width = 2.4; runMapper(g);
    assert.deepEqual(g.rooms.find(r => r.id === 'bath')!.layout, bath);
    assert.equal(g.rooms.find(r => r.id === 'toilet')!.layout!.width, 2.4); assert.ok(finite(g));
  });
  it('reports an impossible cycle instead of faking success', () => {
    const p = (id: string, s: 'left' | 'right') => ({ id: id + '-' + s, roomId: id, side: s, type: 'door', position: .5 });
    const bad = {
      rooms: ['a', 'b', 'c'].map(id => ({ id, sizeCategory: 'medium' as const, connectors: [p(id, 'left'), p(id, 'right')] })),
      relationships: [['a-right', 'b-left'], ['b-right', 'c-left'], ['c-right', 'a-left']].map(([x, y], i) => ({ id: 'r' + i, connectorA: x!, connectorB: y!, importance: 'required' })),
    };
    const r = mapLayout(bad); assert.equal(r.metrics.overlaps, 0); assert.ok(r.metrics.open >= 1);
    assert.ok(r.issues.some(i => i.code === 'unresolved-relationship'));
  });
  it('handles isolated rooms and non-opposing sides without throwing', () => {
    const raw = ref(); raw.rooms.push({ id: 'shed', name: 'Shed', type: 'other', sizeCategory: 'small', connectors: [] });
    raw.relationships.push({ id: 'bogus', connectorA: 'living-right-passage', connectorB: 'kitchen-top-door', importance: 'preferred' });
    const g = migrate(raw); mapOnlyMissing(g); assert.equal(metrics(g).overlaps, 0); assert.ok(finite(g));
  });
});

describe('generated editor embeds the same mapper', () => {
  const html = editorHtml(ref());
  it('contains the mapper and the load/run hooks, and no leftover row placement', () => {
    assert.ok(html.includes('function mapLayout('));
    assert.ok(html.includes('applyMap(mapLayout(g,{moveOnly'));
    assert.ok(!html.includes('cursor+=r.layout.width+2'));
  });
  it('embedded data contains no null coordinates', () => assert.ok(!/"(x|y|width|height)":null/.test(html)));
  it('the embedded source evaluates and matches the Node result', () => {
    const src = html.slice(html.indexOf('function mapLayout('), html.indexOf('function applyMap('));
    const f = new Function(src + ';return mapLayout')() as typeof mapLayout; const g = migrate(ref());
    assert.deepEqual(f(g as any), mapLayout(g as any));
  });
});
