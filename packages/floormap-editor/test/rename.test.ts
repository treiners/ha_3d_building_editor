import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renameRoom } from '../src/rename.js';
import { editorHtml } from '../src/editor.js';

const g = { rooms: [{ id: 'k', name: 'Kitchen' }, { id: 'l', name: 'Living' }, { id: 'o', name: 'Outside' }], objects: [{ id: 'k-sofa', roomId: 'k' }] };

describe('renameRoom', () => {
  it('renames, trims and collapses spaces; the id and everything pointing at it stay', () => {
    const r = renameRoom({ graph: g, roomId: 'k', name: '  Open   Kitchen ' });
    assert.equal(r.ok, true);
    assert.equal(r.graph.rooms[0]!.name, 'Open Kitchen');
    assert.equal(r.graph.rooms[0]!.id, 'k');
    assert.deepEqual(r.graph.objects, g.objects);
    assert.equal(g.rooms[0]!.name, 'Kitchen', 'input is not mutated');
  });
  it('same name is a no-op (ok, same graph object); changing only the case is allowed for the room itself', () => {
    assert.equal(renameRoom({ graph: g, roomId: 'k', name: 'Kitchen' }).graph, g);
    assert.equal(renameRoom({ graph: g, roomId: 'k', name: 'KITCHEN' }).graph.rooms[0]!.name, 'KITCHEN');
  });
  it('refuses empty, 41 characters, a clash (case-insensitive), Outside as name, an Outside room and an unknown id', () => {
    for (const name of ['', '   ', 'x'.repeat(41), 'living', 'outside']) assert.equal(renameRoom({ graph: g, roomId: 'k', name }).ok, false, JSON.stringify(name));
    assert.equal(renameRoom({ graph: g, roomId: 'o', name: 'Garden' }).ok, false);
    assert.equal(renameRoom({ graph: g, roomId: 'zz', name: 'Hall' }).ok, false);
    assert.equal(renameRoom({ graph: g, roomId: 'k', name: 'x'.repeat(40) }).ok, true);
  });
  it('the page has the rename button once and calls renameRoom', () => {
    const html = editorHtml({ rooms: [], relationships: [], wallAlignments: [] });
    assert.equal(html.split('id="rename-room"').length - 1, 1);
    assert.ok(html.includes('renameRoom({graph:g,roomId:r.id,name:i.value})'));
  });
});
