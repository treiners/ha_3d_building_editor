// Room shapes in the file (v2.18 phase 2): load (migrate), save (fillDefaults) and the contract check for rooms with an `outline`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/core.js';
import { fillDefaults } from '../src/defaults.js';
import { checkContract } from '../src/contract.js';

const L = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
const room = (id: string, extra: Record<string, unknown> = {}, connectors: unknown[] = []) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors, layout: { x: 0, y: 0, width: 2, height: 2 }, ...extra });
const graph = (rooms: unknown[]) => ({ schemaVersion: '3.0', id: 'g', name: 'g', rooms, relationships: [], wallAlignments: [] });

test('load: a counter-clockwise L with a collinear corner becomes canonical and fixes the size; a plain rectangle outline is dropped; an invalid outline is kept and not locked', () => {
  const g = migrate(graph([
    room('l', { outline: [[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [1, 0], [0, 0]] }),
    room('r', { outline: [[0, 0], [2, 0], [2, 2], [0, 2]] }),
    room('bad', { outline: [[0, 0], [2, 1], [2, 2], [0, 2]] }),
  ]));
  assert.deepEqual(g.rooms[0]!.outline, L); assert.equal(g.rooms[0]!.layout!.sizeLocked, true);
  assert.equal(g.rooms[1]!.outline, undefined); assert.equal(g.rooms[1]!.layout!.sizeLocked, undefined);
  assert.deepEqual(g.rooms[2]!.outline, [[0, 0], [2, 1], [2, 2], [0, 2]]); assert.equal(g.rooms[2]!.layout!.sizeLocked, undefined);
});

test('load: an outline whose box is not the room size is kept (the contract reports it) and does not lock the room', () => {
  const g = migrate(graph([room('wide', { outline: [[0, 0], [3, 0], [3, 1], [1, 1], [1, 2], [0, 2]] })]));
  assert.equal(g.rooms[0]!.outline!.length, 6); assert.equal(g.rooms[0]!.layout!.sizeLocked, undefined);
});

test('save: fillDefaults writes the outline canonical, drops a rectangle, keeps an invalid one, and does not change its input', () => {
  const input = graph([room('l', { outline: [[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [0, 0]] }), room('r', { outline: [[2, 2], [0, 2], [0, 0], [2, 0]] }), room('bad', { outline: [[0, 0], [2, 1], [2, 2], [0, 2]] })]), before = JSON.stringify(input);
  const out = fillDefaults(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(out.rooms.map((r: { outline?: unknown }) => r.outline), [L, undefined, [[0, 0], [2, 1], [2, 2], [0, 2]]]);
});

test('contract: a valid L with a connector on the bounding box is clean; a rectangle needs nothing', () => {
  const c = checkContract(graph([room('l', { outline: L }, [{ id: 'c', roomId: 'l', side: 'top', type: 'door', offset: 0.5 }]), room('r')]));
  assert.deepEqual(c.errors, []); assert.deepEqual(c.warnings.filter((w) => /outline|inner-wall|off-wall/.test(w.code)), []);
});

test('contract: invalid outline, wrong bounding box and a connector beyond the shape are errors; a connector on the inner wall x = 1 is fine (joints use the wall segment since phase 4)', () => {
  const codes = (rooms: unknown[]) => checkContract(graph(rooms)).errors.map((e) => e.code);
  assert.deepEqual(codes([room('bad', { outline: [[0, 0], [2, 1], [2, 2], [0, 2]] })]), ['room-outline-invalid']);
  assert.deepEqual(codes([room('wide', { outline: [[0, 0], [3, 0], [3, 1], [1, 1], [1, 2], [0, 2]] })]), ['room-outline-bounds']);
  assert.deepEqual(codes([room('l', { outline: L }, [{ id: 'c', roomId: 'l', side: 'top', type: 'door', offset: 5 }])]), ['connector-off-wall']);
  const warn = (offset: number) => checkContract(graph([room('l', { outline: L }, [{ id: 'c', roomId: 'l', side: 'right', type: 'door', offset }])])).warnings.map((w) => w.code);
  assert.deepEqual(warn(1.5), []); assert.deepEqual(warn(0.5), []);
});
