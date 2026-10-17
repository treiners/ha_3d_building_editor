import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { areaKinds, addArea, updateArea, removeArea, areaAt, validateAreas, fillAreaDefaults } from '../src/areas.js';

const room = (id: string, x: number, y: number, w = 4, h = 3) => ({ id, name: id, connectors: [] as any[], layout: { x, y, width: w, height: h } });
const base = (...rooms: any[]): any => ({ rooms, relationships: [], wallAlignments: [] });
const areas = (g: any) => g.areas as any[];

describe('addArea', () => {
  it('deck at (10,5): default 4x3 centred -> x 10-2 = 8, y 5-1.5 = 3.5 (snap 0.1); id and name "deck" / "Deck", then "deck-2" / "Deck 2"', () => {
    const r = addArea({ graph: base(), kind: 'deck', at: { x: 10, y: 5 }, snap: 0.1 });
    assert.ok(r.ok); assert.deepEqual(areas(r.graph)[0], { id: 'deck', name: 'Deck', kind: 'deck', shape: 'rect', layout: { x: 8, y: 3.5, width: 4, height: 3 } });
    const r2 = addArea({ graph: r.graph, kind: 'deck', at: { x: 0, y: 0 } }); assert.deepEqual([r2.id, areas(r2.graph)[1].name], ['deck-2', 'Deck 2']);
  });
  it('pond at (4,10), no snap: ellipse 2.5x1.8 -> x 4-1.25 = 2.75, y 10-0.9 = 9.1', () => {
    assert.deepEqual(areas(addArea({ graph: base(), kind: 'pond', at: { x: 4, y: 10 } }).graph)[0], { id: 'pond', name: 'Pond', kind: 'pond', shape: 'ellipse', layout: { x: 2.75, y: 9.1, width: 2.5, height: 1.8 } });
  });
  it('drawn box (1.04, 2.02, 3.97 x 2.01) snapped to 0.1 -> 1, 2, 4 x 2; a 0.1 m wide box is raised to the 0.5 m minimum', () => {
    assert.deepEqual(areas(addArea({ graph: base(), kind: 'driveway', layout: { x: 1.04, y: 2.02, width: 3.97, height: 2.01 }, snap: 0.1 }).graph)[0].layout, { x: 1, y: 2, width: 4, height: 2 });
    assert.equal(areas(addArea({ graph: base(), kind: 'path', layout: { x: 0, y: 0, width: 0.1, height: 3 } }).graph)[0].layout.width, 0.5);
  });
  it('explicit name / id, unknown kind and missing position are refused, input is not mutated', () => {
    const g = base(), r = addArea({ graph: g, kind: 'garden', at: { x: 5, y: 5 }, name: 'Back Garden!' });
    assert.deepEqual([r.id, areas(r.graph)[0].name], ['back-garden', 'Back Garden!']); assert.equal(g.areas, undefined);
    assert.match(addArea({ graph: g, kind: 'ufo', at: { x: 0, y: 0 } }).message, /Unknown area kind/); assert.equal(addArea({ graph: g, kind: 'deck' }).ok, false);
  });
});

describe('updateArea / removeArea', () => {
  const withDeck = () => addArea({ graph: base(room('a', 0, 0)), kind: 'deck', at: { x: 10, y: 5 } }).graph;
  it('update: size below 0.5 is raised, position, name, kind, shape and roofed apply, invalid shape / kind are ignored, roofed false removes the key', () => {
    let g = updateArea({ graph: withDeck(), id: 'deck', patch: { width: 0.2, x: 1.23456, name: ' Terrace ', kind: 'other', shape: 'ellipse', roofed: true } }).graph;
    assert.deepEqual(areas(g)[0], { id: 'deck', name: 'Terrace', kind: 'other', shape: 'ellipse', layout: { x: 1.2346, y: 3.5, width: 0.5, height: 3 }, roofed: true });
    g = updateArea({ graph: g, id: 'deck', patch: { shape: 'hexagon', kind: 'ufo', roofed: false } }).graph; assert.deepEqual([areas(g)[0].shape, areas(g)[0].kind, 'roofed' in areas(g)[0]], ['ellipse', 'other', false]);
    assert.equal(updateArea({ graph: g, id: 'zz', patch: {} }).ok, false);
  });
  it('remove deletes the area and the entities anchored to it (room entities stay): "1 entity removed"', () => {
    const g = withDeck(); g.entityPlacements = [{ id: 'e1', type: 'light', areaId: 'deck', position: [1, 1] }, { id: 'e2', type: 'light', roomId: 'a', position: [1, 1] }];
    const r = removeArea({ graph: g, id: 'deck' });
    assert.equal(r.message, 'Deleted area "Deck". 1 entity removed.'); assert.deepEqual([areas(r.graph).length, r.graph.entityPlacements.map((e: any) => e.id)], [0, ['e2']]);
    assert.equal(removeArea({ graph: base(), id: 'x' }).ok, false);
  });
});

describe('areaAt', () => {
  it('smallest area wins (deck inside garden); ellipse corners are outside: pond (0..4 x 0..2) contains (2,1) but not (0.1,0.1)', () => {
    let g = addArea({ graph: base(), kind: 'garden', layout: { x: 0, y: 0, width: 20, height: 20 } }).graph;
    g = addArea({ graph: g, kind: 'deck', layout: { x: 5, y: 5, width: 4, height: 3 } }).graph; g = addArea({ graph: g, kind: 'pond', layout: { x: 0, y: 0, width: 4, height: 2 } }).graph;
    assert.equal(areaAt(g, 6, 6).id, 'deck'); assert.equal(areaAt(g, 15, 15).id, 'garden'); assert.equal(areaAt(g, 2, 1).id, 'pond'); assert.equal(areaAt(g, 0.1, 0.1).id, 'garden'); assert.equal(areaAt(g, 30, 30), null);
  });
  it('equal sizes: the smaller id wins', () => {
    const g = base(); g.areas = [{ id: 'b', kind: 'deck', shape: 'rect', layout: { x: 0, y: 0, width: 2, height: 2 } }, { id: 'a', kind: 'deck', shape: 'rect', layout: { x: 0, y: 0, width: 2, height: 2 } }];
    assert.equal(areaAt(g, 1, 1).id, 'a');
  });
});

describe('validateAreas', () => {
  const codes = (g: any) => validateAreas(g).map(i => i.id + ':' + i.code);
  it('deck x 3..7 overlaps room a (0..4); a garden around the house does not warn; a deck beside the house does not warn', () => {
    const g = base(room('a', 0, 0));
    assert.deepEqual(codes(addArea({ graph: g, kind: 'deck', layout: { x: 3, y: 0, width: 4, height: 3 } }).graph), ['deck:overlaps-room']);
    assert.deepEqual(codes(addArea({ graph: g, kind: 'garden', layout: { x: -3, y: -3, width: 12, height: 9 } }).graph), []);
    assert.deepEqual(codes(addArea({ graph: g, kind: 'deck', layout: { x: 4, y: 0, width: 4, height: 3 } }).graph), []);
  });
  it('ellipse: a 1 m pond at (3.9, 2.9) overlaps the bounding box of room a at the corner (4,3) but its circle (centre (4.4,3.4), r 0.5, 0.566 m from the corner) does not', () => {
    assert.deepEqual(codes(addArea({ graph: base(room('a', 0, 0)), kind: 'pond', layout: { x: 3.9, y: 2.9, width: 1, height: 1 } }).graph), []);
    assert.deepEqual(codes(addArea({ graph: base(room('a', 0, 0)), kind: 'pond', layout: { x: 3.5, y: 2.5, width: 1, height: 1 } }).graph), ['pond:overlaps-room']);
  });
  it('unknown kind, too small and duplicate id are reported; the Outside room is ignored', () => {
    const g = base(room('a', 0, 0), { ...room('o', 0, 0), name: 'Outside' }); g.areas = [{ id: 'x', kind: 'ufo', layout: { x: 9, y: 9, width: 2, height: 2 } }, { id: 'y', kind: 'deck', layout: { x: 9, y: 9, width: 0.2, height: 2 } }, { id: 'd', kind: 'deck', layout: { x: 20, y: 0, width: 2, height: 2 } }, { id: 'd', kind: 'deck', layout: { x: 30, y: 0, width: 2, height: 2 } }];
    assert.deepEqual(codes(g), ['d:duplicate-id', 'x:unknown-kind', 'y:too-small']);
  });
});

describe('fillAreaDefaults / catalogue / embedding', () => {
  it('defaults: shape per kind, roofed false, name, 4-decimal positions; no areas -> unchanged', () => {
    const g = base(); assert.deepEqual(fillAreaDefaults(g), g);
    const f = fillAreaDefaults({ ...g, areas: [{ id: 'p', kind: 'pond', layout: { x: 1.123456, y: 2, width: 3, height: 1.5 } }] });
    assert.deepEqual(f.areas[0], { id: 'p', kind: 'pond', name: 'Pond', shape: 'ellipse', roofed: false, layout: { x: 1.1235, y: 2, width: 3, height: 1.5 } });
  });
  it('catalogue: six kinds, only garden is a plot, pond is an ellipse', () => {
    const K = areaKinds(); assert.deepEqual(Object.keys(K), ['deck', 'driveway', 'garden', 'pond', 'path', 'other']); assert.deepEqual([K.garden.plot, K.pond.shape, K.deck.plot], [true, 'ellipse', undefined]);
  });
  it('embedded source gives the same results as Node', () => {
    const fns = [areaKinds, addArea, updateArea, removeArea, areaAt, validateAreas, fillAreaDefaults];
    const E: any = new Function(fns.map(f => f.toString()).join('\n') + '\nreturn {' + fns.map(f => f.name).join(',') + '};')();
    const g = addArea({ graph: base(room('a', 0, 0)), kind: 'pond', at: { x: 4, y: 3 }, snap: 0.1 }).graph;
    assert.deepEqual(E.addArea({ graph: base(room('a', 0, 0)), kind: 'pond', at: { x: 4, y: 3 }, snap: 0.1 }), addArea({ graph: base(room('a', 0, 0)), kind: 'pond', at: { x: 4, y: 3 }, snap: 0.1 }));
    assert.deepEqual(E.validateAreas(g), validateAreas(g)); assert.deepEqual(E.areaAt(g, 4, 3), areaAt(g, 4, 3)); assert.deepEqual(E.fillAreaDefaults(g), fillAreaDefaults(g));
    assert.deepEqual(E.updateArea({ graph: g, id: 'pond', patch: { width: 5 } }), updateArea({ graph: g, id: 'pond', patch: { width: 5 } })); assert.deepEqual(E.removeArea({ graph: g, id: 'pond' }), removeArea({ graph: g, id: 'pond' }));
  });
});
