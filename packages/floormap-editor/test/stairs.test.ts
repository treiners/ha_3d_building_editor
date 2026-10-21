import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stairRect, stairBar, stairsVisible, stairsAdd, stairsUpdate, stairsRemove, stairsHost, stairsFill, stairResize } from '../src/stairs.js';
import { floorsAdd, floorsSwitch } from '../src/floors.js';

const st = (o: any = {}): any => ({ id: 's', lower: 'g', upper: 'u', x: 1, y: 2, length: 3, width: 1, direction: 'right', ...o });
const two = (): any => floorsAdd({ graph: { rooms: [{ id: 'a', name: 'a', connectors: [], layout: { x: 0, y: 0, width: 4, height: 3 } }], relationships: [], wallAlignments: [] } });

describe('stairs', () => {
  it('rectangle: length 3 x width 1 at (1,2): direction right / left = 3 wide, 1 high; up / down = 1 wide, 3 high', () => {
    assert.deepEqual(stairRect(st()), { x: 1, y: 2, w: 3, h: 1 }); assert.deepEqual(stairRect(st({ direction: 'left' })), { x: 1, y: 2, w: 3, h: 1 });
    assert.deepEqual(stairRect(st({ direction: 'down' })), { x: 1, y: 2, w: 1, h: 3 }); assert.deepEqual(stairRect(st({ direction: 'up' })), { x: 1, y: 2, w: 1, h: 3 });
  });
  it('bar, direction right (rect x 1..4, y 2..3, thickness 0.2): lower floor = left end (x 1), upper floor = right end (x 4 - 0.2 = 3.8)', () => {
    assert.deepEqual(stairBar(st(), 'lower'), { x: 1, y: 2, w: 0.2, h: 1 }); assert.deepEqual(stairBar(st(), 'upper'), { x: 3.8, y: 2, w: 0.2, h: 1 });
  });
  it('bar, direction left: lower = right end, upper = left end; direction up (rect x 1..2, y 2..5): lower = bottom (y 5 - 0.2 = 4.8), upper = top; direction down: the other way round', () => {
    assert.deepEqual(stairBar(st({ direction: 'left' }), 'lower'), { x: 3.8, y: 2, w: 0.2, h: 1 }); assert.deepEqual(stairBar(st({ direction: 'left' }), 'upper'), { x: 1, y: 2, w: 0.2, h: 1 });
    assert.deepEqual(stairBar(st({ direction: 'up' }), 'lower'), { x: 1, y: 4.8, w: 1, h: 0.2 }); assert.deepEqual(stairBar(st({ direction: 'up' }), 'upper'), { x: 1, y: 2, w: 1, h: 0.2 });
    assert.deepEqual(stairBar(st({ direction: 'down' }), 'lower'), { x: 1, y: 2, w: 1, h: 0.2 }); assert.deepEqual(stairBar(st({ direction: 'down' }), 'upper'), { x: 1, y: 4.8, w: 1, h: 0.2 });
  });
  it('a very short stair gets a thinner bar: length 0.6 -> a quarter = 0.15', () => {
    assert.equal(stairBar(st({ length: 0.6 }), 'lower').w, 0.15);
  });
  it('add: on the lower of two floors the stair joins floor-1 and floor-2; on the top floor too; one floor or no floors: unchanged; ids stairs-1, stairs-2', () => {
    const top = two(), a = stairsAdd({ graph: top, x: 1, y: 1 });
    assert.deepEqual(a.stairs, [{ id: 'stairs-1', name: 'Stairs 1', lower: 'floor-1', upper: 'floor-2', x: 1, y: 1, length: 3, width: 1, direction: 'right' }]);
    const b = stairsAdd({ graph: floorsSwitch(a, 'floor-1'), x: 0, y: 0 }); assert.deepEqual(b.stairs.map((s: any) => [s.id, s.lower, s.upper]), [['stairs-1', 'floor-1', 'floor-2'], ['stairs-2', 'floor-1', 'floor-2']]);
    const single: any = { rooms: [], relationships: [], wallAlignments: [] }; assert.deepEqual(stairsAdd({ graph: single, x: 0, y: 0 }), single);
  });
  it('update clamps length to 0.6..12 and width to 0.5..4, rounds x to 4 decimals, ignores an unknown direction, trims the name; remove deletes (and the key when empty)', () => {
    const g: any = { stairs: [st()] };
    const u = stairsUpdate({ graph: g, id: 's', patch: { length: 0.1, width: 9, x: 1.23456, direction: 'x', name: '  Main  ' } }).stairs[0];
    assert.deepEqual([u.length, u.width, u.x, u.direction, u.name], [0.6, 4, 1.2346, 'right', 'Main']);
    assert.equal(stairsUpdate({ graph: g, id: 's', patch: { length: 50 } }).stairs[0].length, 12); assert.equal(stairsUpdate({ graph: g, id: 's', patch: { direction: 'up' } }).stairs[0].direction, 'up');
    assert.deepEqual(stairsUpdate({ graph: g, id: 'zz', patch: { length: 2 } }), g); assert.equal(stairsRemove({ graph: g, id: 's' }).stairs, undefined);
  });
  it('visible: on floor-2 the stair has role upper with the bar on the right, on floor-1 role lower with the bar on the left; on a third floor nothing', () => {
    let g = stairsAdd({ graph: two(), x: 1, y: 2 }); const v2 = stairsVisible(g)[0]!;
    assert.deepEqual([v2.role, v2.bar.x, v2.rect.w, v2.rect.h], ['upper', 1 + 3 - 0.2, 3, 1]);
    g = floorsSwitch(g, 'floor-1'); const v1 = stairsVisible(g)[0]!; assert.deepEqual([v1.role, v1.bar.x], ['lower', 1]);
    g = floorsAdd({ graph: g }); assert.deepEqual(stairsVisible(g), []);
  });
  it('host: stair at (2,1) 3 x 1 climbing right, room a on floor g (0,0,4,3), room b on floor u (4,0,4,3): lower bar middle (2.1, 1.5) is in a, upper bar middle (4.9, 1.5) is in b; a stair far away has none; a room without floor counts as the first floor', () => {
    const g: any = { floors: [{ id: 'g' }, { id: 'u' }], rooms: [{ id: 'a', name: 'a', floor: 'g', layout: { x: 0, y: 0, width: 4, height: 3 } }, { id: 'b', name: 'b', floor: 'u', layout: { x: 4, y: 0, width: 4, height: 3 } }], stairs: [st({ x: 2, y: 1 }), st({ id: 'far', x: 20, y: 20 })] };
    assert.deepEqual([stairsHost(g, g.stairs[0], 'lower'), stairsHost(g, g.stairs[0], 'upper')], ['a', 'b']);
    const f = stairsFill(g); assert.deepEqual([f.stairs[0].fromRoom, f.stairs[0].toRoom, f.stairs[1].fromRoom, f.stairs[1].toRoom], ['a', 'b', null, null]);
    delete g.rooms[0].floor; assert.equal(stairsHost(g, g.stairs[0], 'lower'), 'a');
  });
  it('corner resize (stair 3 x 1 at (1,2) climbing right): drag the bottom-right corner to (5, 3.5) with the top-left (1,2) fixed -> length 4, width 1.5 at (1,2); drag the top-left corner to (2, 2.5) with the bottom-right (4,3) fixed -> length 2, width 0.5 at (2, 2.5)', () => {
    assert.deepEqual(stairResize(st(), 1, 2, 5, 3.5), { x: 1, y: 2, length: 4, width: 1.5 }); assert.deepEqual(stairResize(st(), 4, 3, 2, 2.5), { x: 2, y: 2.5, length: 2, width: 0.5 });
  });
  it('corner resize clamps (length 12, width 0.5 at most / least), flips when dragged past the fixed corner, and swaps length and width when the stair climbs up', () => {
    assert.deepEqual(stairResize(st(), 1, 2, 20, 2.2), { x: 1, y: 2, length: 12, width: 0.5 });
    assert.deepEqual(stairResize(st(), 4, 3, 6, 4), { x: 4, y: 3, length: 2, width: 1 });
    assert.deepEqual(stairResize(st({ direction: 'up' }), 1, 2, 3, 4), { x: 1, y: 2, length: 2, width: 2 });
    assert.deepEqual(stairResize(st({ direction: 'up' }), 1, 2, 1.1, 30), { x: 1, y: 2, length: 12, width: 0.5 });
  });
  it('embedded source evaluates and matches Node', () => {
    const src = [stairRect, stairBar, stairsVisible, stairsAdd, stairsUpdate, stairsRemove, stairsHost, stairsFill, stairResize].map(f => f.toString()).join('\n');
    const E: any = new Function(src + '\nreturn { stairsAdd, stairsVisible, stairsFill, stairResize };')();
    assert.deepEqual(E.stairResize(st(), 1, 2, 5, 3.5), stairResize(st(), 1, 2, 5, 3.5));
    const g = stairsAdd({ graph: two(), x: 1, y: 2 });
    assert.deepEqual(E.stairsAdd({ graph: two(), x: 1, y: 2 }), g); assert.deepEqual(E.stairsVisible(g), stairsVisible(g)); assert.deepEqual(E.stairsFill(g), stairsFill(g));
  });
});
