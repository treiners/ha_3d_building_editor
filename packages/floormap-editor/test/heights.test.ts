import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { roomElevation, wallHeightOf, setRoomHeights, heightIssues } from '../src/heights.js';
import { updateArea, fillAreaDefaults } from '../src/areas.js';

const room = (extra: any = {}): any => ({ id: 'a', name: 'A', connectors: [], layout: { x: 0, y: 0, width: 4, height: 3 }, ...extra });
const g0 = (r: any, more: any = {}): any => ({ rooms: [r], relationships: [], wallAlignments: [], ...more });

describe('wallHeightOf', () => {
  it('nothing set -> 2.4 (built-in default)', () => assert.equal(wallHeightOf(g0(room()), room(), 'top'), 2.4));
  it('buildingDefaults.wallHeight 2.7 -> 2.7', () => assert.equal(wallHeightOf(g0(room(), { buildingDefaults: { wallHeight: 2.7 } }), room(), 'left'), 2.7));
  it('floor height 3 beats building 2.7; room without floor uses the first floor', () => {
    const g = g0(room(), { buildingDefaults: { wallHeight: 2.7 }, floors: [{ id: 'f0', name: 'G', height: 3 }, { id: 'f1', name: 'U', height: 2.5 }] });
    assert.equal(wallHeightOf(g, room(), 'top'), 3);
    assert.equal(wallHeightOf(g, room({ floor: 'f1' }), 'top'), 2.5);
  });
  it('room wallHeight 3.5 beats floor 3; wall top 4.2 beats room: top 4.2, right 3.5', () => {
    const r = room({ wallHeight: 3.5, wallHeights: { top: 4.2 } }), g = g0(r, { floors: [{ id: 'f0', name: 'G', height: 3 }] });
    assert.equal(wallHeightOf(g, r, 'top'), 4.2);
    assert.equal(wallHeightOf(g, r, 'right'), 3.5);
  });
  it('invalid values (0, negative, string) fall through to the next level', () => assert.equal(wallHeightOf(g0(room({ wallHeight: 0, wallHeights: { top: -1, left: 'x' } })), room({ wallHeight: 0, wallHeights: { top: -1, left: 'x' } }), 'top'), 2.4));
});

describe('roomElevation / setRoomHeights', () => {
  it('absent -> 0, 0.45 -> 0.45', () => { assert.equal(roomElevation(room()), 0); assert.equal(roomElevation(room({ elevation: 0.45 })), 0.45); });
  it('elevation 0.456 -> rounded to 0.46; the input graph is not changed', () => {
    const g = g0(room()), r = setRoomHeights({ graph: g, roomId: 'a', patch: { elevation: 0.456 } });
    assert.ok(r.ok); assert.equal(r.graph.rooms[0].elevation, 0.46); assert.equal(g.rooms[0].elevation, undefined);
  });
  it('elevation 15 -> clamped to 10; 0 removes the key', () => {
    const a = setRoomHeights({ graph: g0(room()), roomId: 'a', patch: { elevation: 15 } });
    assert.equal(a.graph.rooms[0].elevation, 10);
    const b = setRoomHeights({ graph: a.graph, roomId: 'a', patch: { elevation: 0 } });
    assert.equal('elevation' in b.graph.rooms[0], false);
  });
  it('wallHeight 0.5 -> clamped to 1; null removes it', () => {
    const a = setRoomHeights({ graph: g0(room()), roomId: 'a', patch: { wallHeight: 0.5 } });
    assert.equal(a.graph.rooms[0].wallHeight, 1);
    assert.equal('wallHeight' in setRoomHeights({ graph: a.graph, roomId: 'a', patch: { wallHeight: null } }).graph.rooms[0], false);
  });
  it('wallHeights: top 3.2 and left 2.9 set, then top removed -> only left stays; removing the last one drops the object', () => {
    const a = setRoomHeights({ graph: g0(room()), roomId: 'a', patch: { wallHeights: { top: 3.2, left: 2.9 } } });
    assert.deepEqual(a.graph.rooms[0].wallHeights, { top: 3.2, left: 2.9 });
    const b = setRoomHeights({ graph: a.graph, roomId: 'a', patch: { wallHeights: { top: null } } });
    assert.deepEqual(b.graph.rooms[0].wallHeights, { left: 2.9 });
    const c = setRoomHeights({ graph: b.graph, roomId: 'a', patch: { wallHeights: { left: null } } });
    assert.equal('wallHeights' in c.graph.rooms[0], false);
  });
  it('unknown room -> not ok', () => assert.equal(setRoomHeights({ graph: g0(room()), roomId: 'zz', patch: {} }).ok, false));
});

describe('heightIssues', () => {
  const win = (head: number) => ({ id: 'w', roomId: 'a', side: 'top', type: 'window', window: { type: 'fixed', sillHeight: 0.8, headHeight: head } });
  it('window head 2.1 in a 2.4 wall -> no issue; head 2.6 -> window-above-wall; same window in a wall of 2.8 -> no issue', () => {
    assert.deepEqual(heightIssues(g0(room({ connectors: [win(2.1)] }))), []);
    assert.deepEqual(heightIssues(g0(room({ connectors: [win(2.6)] }))).map((i) => i.code), ['window-above-wall']);
    assert.deepEqual(heightIssues(g0(room({ connectors: [win(2.6)], wallHeights: { top: 2.8 } }))), []);
  });
  it('elevation 12 on a room and an area -> two elevation-range issues; negative too', () => {
    const g = g0(room({ elevation: 12 }), { areas: [{ id: 'd', name: 'Deck', kind: 'deck', shape: 'rect', layout: { x: 0, y: 0, width: 2, height: 2 }, elevation: -1 }] });
    assert.deepEqual(heightIssues(g).map((i) => i.id + ':' + i.code), ['a:elevation-range', 'd:elevation-range']);
  });
});

describe('area elevation', () => {
  const deck = (): any => ({ rooms: [], relationships: [], wallAlignments: [], areas: [{ id: 'd', name: 'Deck', kind: 'deck', shape: 'rect', layout: { x: 0, y: 0, width: 4, height: 3 } }] });
  it('updateArea elevation 0.456 -> 0.46, 0 removes it, 99 -> 10', () => {
    const a = updateArea({ graph: deck(), id: 'd', patch: { elevation: 0.456 } });
    assert.equal(a.graph.areas[0].elevation, 0.46);
    assert.equal('elevation' in updateArea({ graph: a.graph, id: 'd', patch: { elevation: 0 } }).graph.areas[0], false);
    assert.equal(updateArea({ graph: deck(), id: 'd', patch: { elevation: 99 } }).graph.areas[0].elevation, 10);
  });
  it('fillAreaDefaults keeps the elevation and does not add one', () => {
    assert.equal(fillAreaDefaults(deck()).areas[0].elevation, undefined);
    const g = deck(); g.areas[0].elevation = 0.3;
    assert.equal(fillAreaDefaults(g).areas[0].elevation, 0.3);
  });
});
