import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { editorHtml } from '../src/editor.js';
import { deriveJoints } from '../src/joints.js';
import { connectRooms, addRoom, removeRoom, removeConnector } from '../src/edit.js';

const ref = (): any => JSON.parse(readFileSync(new URL('../../../shared/reference-home-connectors.json', import.meta.url), 'utf8'));
const room = (id: string, x: number, y: number, extra: any = {}) => ({ id, name: id, sizeCategory: 'medium', connectors: [] as any[], layout: { x, y, width: 4, height: 3, ...extra } });
const scene = (...rooms: any[]) => ({ rooms, relationships: [] as any[], wallAlignments: [] as any[] }) as any;
const okJoints = (g: any) => deriveJoints(g).joints.filter(j => j.status === 'ok').length;

describe('connectRooms: both connectors + relationship in one step', () => {
  it('A(0,0) | B(4,1): shared wall x=4, y 1..3 -> door at y=2: A offset 2.0, B offset 1.0, one ok joint', () => {
    const r = connectRooms({ graph: scene(room('a', 0, 0), room('b', 4, 1)), roomA: 'a', roomB: 'b' });
    assert.ok(r.ok); const [a, b] = r.graph.rooms;
    assert.deepEqual(a.connectors.map((c: any) => [c.id, c.side, c.type, c.offset]), [['a-right-door', 'right', 'door', 2]]);
    assert.deepEqual(b.connectors.map((c: any) => [c.id, c.side, c.type, c.offset]), [['b-left-door', 'left', 'door', 1]]);
    assert.deepEqual(r.graph.relationships, [{ id: 'a-right-door--b-left-door', connectorA: 'a-right-door', connectorB: 'b-left-door', importance: 'required' }]);
    assert.equal(okJoints(r.graph), 1);
  });
  it('works vertically and for a passage (A above B: bottom/top, shared x 0..4 -> offset 2.0, type open-passage)', () => {
    const r = connectRooms({ graph: scene(room('a', 0, 0), room('b', 0, 3)), roomA: 'a', roomB: 'b', type: 'open-passage' });
    assert.ok(r.ok); assert.deepEqual(r.graph.rooms[0].connectors.map((c: any) => [c.side, c.type, c.offset]), [['bottom', 'open-passage', 2]]);
    assert.deepEqual(r.graph.rooms[1].connectors.map((c: any) => [c.side, c.offset]), [['top', 2]]); assert.equal(okJoints(r.graph), 1);
  });
  it('refuses: rooms apart, shared wall too short (0.5 m < 1.0 m for a door), already connected', () => {
    assert.match(connectRooms({ graph: scene(room('a', 0, 0), room('b', 6, 0)), roomA: 'a', roomB: 'b' }).message, /do not share a wall/);
    assert.match(connectRooms({ graph: scene(room('a', 0, 0), room('b', 4, 2.5)), roomA: 'a', roomB: 'b' }).message, /too short/);
    const once = connectRooms({ graph: scene(room('a', 0, 0), room('b', 4, 0)), roomA: 'a', roomB: 'b' });
    const twice = connectRooms({ graph: once.graph, roomA: 'b', roomB: 'a' }); assert.ok(!twice.ok); assert.match(twice.message, /already connected/);
  });
  it('a second connection between other rooms gets unique ids and the input graph is never mutated', () => {
    const g = scene(room('a', 0, 0), room('b', 4, 0), room('c', 0, 3)), snap = JSON.stringify(g);
    const r1 = connectRooms({ graph: g, roomA: 'a', roomB: 'b' }), r2 = connectRooms({ graph: r1.graph, roomA: 'a', roomB: 'c' });
    assert.equal(JSON.stringify(g), snap); assert.deepEqual(r2.graph.rooms[0].connectors.map((c: any) => c.id), ['a-right-door', 'a-bottom-door']); assert.equal(okJoints(r2.graph), 2);
  });
});

describe('addRoom', () => {
  it('right of A (medium 4x3 at x=4, y=0) with a door in the middle of the shared wall (y 1.5); selected and connected', () => {
    const r = addRoom({ graph: scene(room('a', 0, 0)), name: 'Pantry', nextTo: 'a', side: 'right', connect: 'door' });
    assert.ok(r.ok); assert.equal(r.id, 'pantry'); assert.deepEqual(r.graph.rooms[1].layout, { x: 4, y: 0, width: 4, height: 3 });
    assert.equal(okJoints(r.graph), 1); assert.match(r.message, /connected/);
  });
  it('size category sets the default size (small 3x2, large 6x4); without connect nothing is connected', () => {
    const s = addRoom({ graph: scene(room('a', 0, 0)), name: 'Closet', sizeCategory: 'small', nextTo: 'a', side: 'bottom' });
    assert.deepEqual(s.graph.rooms[1].layout, { x: 0, y: 3, width: 3, height: 2 }); assert.equal(s.graph.relationships.length, 0);
    assert.deepEqual(addRoom({ graph: scene(room('a', 0, 0)), name: 'Hall', sizeCategory: 'large', nextTo: 'a', side: 'left' }).graph.rooms[1].layout, { x: -6, y: 0, width: 6, height: 4 });
  });
  it('an occupied wanted side gives a free room, never another side: B sits right of A, so the new room is not connected and goes to the free spot right of everything (x 9, y 0)', () => {
    const r = addRoom({ graph: scene(room('a', 0, 0), room('b', 4, 0)), name: 'New', nextTo: 'a', side: 'right', connect: 'door' });
    assert.deepEqual(r.graph.rooms[2].layout, { x: 9, y: 0, width: 4, height: 3 }); assert.equal(okJoints(r.graph), 0); assert.equal(r.graph.relationships.length, 0); assert.match(r.message, /no free space on the right side of a.*free room \(not connected\)/i);
  });
  it('slides along the wall to free space: B sits at (4,-1) in the upper right of A, so the new room goes to y=2 (shared part exactly 1.0 m)', () => {
    const r = addRoom({ graph: scene(room('a', 0, 0), room('b', 4, -1)), name: 'New', nextTo: 'a', side: 'right' });
    assert.deepEqual(r.graph.rooms[2].layout, { x: 4, y: 2, width: 4, height: 3 });
  });
  it('without a neighbour: free spot right of the plan (x = max right + 1, y = top of plan), not connected; ids stay unique', () => {
    const a = addRoom({ graph: scene(room('a', 0, 0)), name: 'Kitchen' }), b = addRoom({ graph: a.graph, name: 'Kitchen' });
    assert.deepEqual(a.graph.rooms[1].layout, { x: 5, y: 0, width: 4, height: 3 }); assert.deepEqual([a.id, b.id], ['kitchen', 'kitchen-2']);
  });
  it('the hidden Outside room does not block placement', () => {
    const out = room('outside', 4, 0); out.name = 'Outside';
    assert.deepEqual(addRoom({ graph: scene(room('a', 0, 0), out), name: 'N', nextTo: 'a', side: 'right' }).graph.rooms[2].layout, { x: 4, y: 0, width: 4, height: 3 });
  });
});

describe('removeRoom / removeConnector', () => {
  const base = () => {
    let g = scene(room('a', 0, 0), room('b', 4, 0), room('c', 8, 0));
    g = connectRooms({ graph: g, roomA: 'a', roomB: 'b' }).graph; g = connectRooms({ graph: g, roomA: 'b', roomB: 'c' }).graph;
    g.joints = [{ relationshipId: 'b-right-door--c-left-door', state: 'detached' }]; g.wallAlignments = [{ id: 'al', side: 'top', roomIds: ['a', 'c'] }, { id: 'al2', side: 'top', roomIds: ['a', 'b', 'c'] }];
    return g;
  };
  it('deleting C removes its connector, its relationship, the joint override and C from alignments (a group with <2 rooms disappears); B keeps its now unconnected connector', () => {
    const r = removeRoom({ graph: base(), roomId: 'c' }); assert.ok(r.ok);
    assert.deepEqual(r.graph.rooms.map((x: any) => x.id), ['a', 'b']); assert.equal(r.graph.relationships.length, 1); assert.deepEqual(r.graph.joints, []);
    assert.deepEqual(r.graph.wallAlignments, [{ id: 'al2', side: 'top', roomIds: ['a', 'b'] }]);
    assert.deepEqual(r.graph.rooms[1].connectors.map((c: any) => c.id), ['b-left-door', 'b-right-door']); assert.match(r.message, /1 connector\(s\) of neighbours/);
  });
  it('removing a door removes both connectors and the relationship; with both:false only this side', () => {
    const r = removeConnector({ graph: base(), connectorId: 'a-right-door' }); assert.ok(r.ok);
    assert.deepEqual(r.graph.rooms.map((x: any) => x.connectors.map((c: any) => c.id)), [[], ['b-right-door'], ['c-left-door']]); assert.equal(r.graph.relationships.length, 1);
    const one = removeConnector({ graph: base(), connectorId: 'a-right-door', both: false });
    assert.deepEqual(one.graph.rooms[1].connectors.map((c: any) => c.id), ['b-left-door', 'b-right-door']); assert.equal(one.graph.relationships.length, 1);
  });
  it('unknown ids are refused and the input is not mutated', () => {
    const g = base(), snap = JSON.stringify(g);
    assert.ok(!removeRoom({ graph: g, roomId: 'zz' }).ok); assert.ok(!removeConnector({ graph: g, connectorId: 'zz' }).ok); removeRoom({ graph: g, roomId: 'a' }); assert.equal(JSON.stringify(g), snap);
  });
});

describe('editing: embedded in the editor HTML', () => {
  it('the embedded functions match Node and the UI is wired', () => {
    const html = editorHtml(ref()), a = html.indexOf('function deriveJoints('), b = html.indexOf('\nfunction applyMap(');
    const emb: any = new Function(html.slice(a, b) + '\nreturn { connectRooms, addRoom, removeRoom, removeConnector };')();
    const j = (x: any) => JSON.parse(JSON.stringify(x));
    const g = scene(room('a', 0, 0), room('b', 4, 1));
    const c = { graph: g, roomA: 'a', roomB: 'b', type: 'open-passage' }; assert.deepEqual(j(emb.connectRooms(c)), j(connectRooms(c)));
    const n = { graph: g, name: 'New', nextTo: 'a', side: 'bottom', connect: 'door' }; assert.deepEqual(j(emb.addRoom(n)), j(addRoom(n)));
    const built = connectRooms(c).graph; assert.deepEqual(j(emb.removeRoom({ graph: built, roomId: 'b' })), j(removeRoom({ graph: built, roomId: 'b' })));
    assert.deepEqual(j(emb.removeConnector({ graph: built, connectorId: 'a-right-open-passage' })), j(removeConnector({ graph: built, connectorId: 'a-right-open-passage' })));
    for (const s of ['id="add-room"', 'id="connect-rooms"', 'id="delete-room"', 'data-delconn', 'function editApply(']) assert.ok(html.includes(s), s);
  });
});
