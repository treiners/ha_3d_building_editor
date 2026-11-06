// Rectilinear room shapes (src/shape.ts, v2.18 phase 1). L = bar x 0..2, y 0..1 plus leg x 0..1, y 1..2 (area 3); coordinates are metres, y down.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  outlineArea, outlineBounds, outlineCombine, outlineFromRect, outlineHasRect, outlineIssues, outlineLabelRect, outlineNormalize, outlineOverlapArea, outlineNearest, outlinePoint, outlineWallAt, outlineWalls,
  type Outline,
} from '../src/shape.js';
import { embeddedSource } from '../src/embed.js';

const L: Outline = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
const U: Outline = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 0], [3, 0], [3, 2], [0, 2]];
const rect = (x: number, y: number, width: number, height: number) => outlineFromRect({ x, y, width, height });

test('rectangle: corners [[1,2],[4,2],[4,3.5],[1,3.5]], bounds 3 x 1.5, area 3 * 1.5 = 4.5', () => {
  const r = rect(1, 2, 3, 1.5);
  assert.deepEqual(r, [[1, 2], [4, 2], [4, 3.5], [1, 3.5]]);
  assert.deepEqual(outlineBounds(r), { x: 1, y: 2, width: 3, height: 1.5 });
  assert.equal(outlineArea(r), 4.5);
});

test('L: area 2 * 1 + 1 * 1 = 3, bounds 2 x 2', () => {
  assert.equal(outlineArea(L), 3); assert.deepEqual(outlineBounds(L), { x: 0, y: 0, width: 2, height: 2 });
});

test('normalize: a counter-clockwise L that starts at the bottom and has an extra collinear corner (1,0) becomes the canonical clockwise L from (0,0); canonical input is unchanged', () => {
  assert.deepEqual(outlineNormalize([[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [1, 0], [0, 0]]), L);
  assert.deepEqual(outlineNormalize(L), L); assert.deepEqual(outlineNormalize(U), U);
  assert.deepEqual(outlineNormalize([[0, 0], [0, 0], [2, 0], [2, 1], [0, 1]]), rect(0, 0, 2, 1));
});

test('issues: valid L and U have none; diagonal, odd corners, collinear corners, bow-tie and counter-clockwise are named', () => {
  assert.deepEqual(outlineIssues(L), []); assert.deepEqual(outlineIssues(U), []); assert.deepEqual(outlineIssues(rect(0, 0, 1, 1)), []);
  assert.deepEqual(outlineIssues([[0, 0], [2, 1], [2, 2], [0, 2]]), ['diagonal']);
  assert.deepEqual(outlineIssues([[0, 0], [1, 0], [1, 1]]), ['points']);
  assert.deepEqual(outlineIssues([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2], [0, 1]]), ['alternate']);
  assert.deepEqual(outlineIssues([[0, 0], [2, 0], [2, 2], [1, 2], [1, -1], [0, -1]]), ['self-intersect']);
  assert.deepEqual(outlineIssues([[0, 0], [0, 2], [2, 2], [2, 0]]), ['orientation']);
});

test('point: inside the bar and the leg, outside in the notch (1.5, 1.5) and beyond; boundary points count as inside', () => {
  for (const [x, y] of [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1, 1.5], [2, 1], [1.5, 1], [0, 0]]) assert.equal(outlinePoint(L, x!, y!), true, x + ',' + y);
  for (const [x, y] of [[1.5, 1.5], [3, 0], [-0.1, 0.5], [0.5, 2.1]]) assert.equal(outlinePoint(L, x!, y!), false, x + ',' + y);
});

test('rect inside: the bar, the leg and a rectangle in the bar fit; one reaching into the notch (x 0.5..2, y 0.5..2) or the bounding box does not', () => {
  const has = (x: number, y: number, w: number, h: number) => outlineHasRect(L, { x, y, width: w, height: h });
  assert.equal(has(0, 0, 2, 1), true); assert.equal(has(0, 0, 1, 2), true); assert.equal(has(0.1, 0.1, 1.8, 0.8), true);
  assert.equal(has(0.5, 0.5, 1.5, 1.5), false); assert.equal(has(0, 0, 2, 2), false); assert.equal(has(1.2, 1.2, 0, 0), false);
});

test('overlap area: L with x 1..3, y 0.5..2.5 shares only x 1..2, y 0.5..1 = 0.5; touching rectangles share 0', () => {
  assert.equal(outlineOverlapArea(L, rect(1, 0.5, 2, 2)), 0.5);
  assert.equal(outlineOverlapArea(L, rect(2, 0, 1, 1)), 0);
  assert.equal(outlineOverlapArea(L, rect(1, 1, 1, 1)), 0, 'the notch');
});

test('combine: bar + leg = L; 2 x 2 minus the corner (1,1,1,1) = L; 3 x 2 minus (1,0,1,1) at the top edge = U; intersect = the common rectangle; subtract itself = nothing', () => {
  assert.deepEqual(outlineCombine(rect(0, 0, 2, 1), rect(0, 0, 1, 2), 'union'), { outlines: [L], holes: [] });
  assert.deepEqual(outlineCombine(rect(0, 0, 2, 2), rect(1, 1, 1, 1), 'subtract'), { outlines: [L], holes: [] });
  assert.deepEqual(outlineCombine(rect(0, 0, 3, 2), rect(1, 0, 1, 1), 'subtract'), { outlines: [U], holes: [] });
  assert.deepEqual(outlineCombine(rect(0, 0, 2, 2), rect(1, 1, 2, 2), 'intersect'), { outlines: [rect(1, 1, 1, 1)], holes: [] });
  assert.deepEqual(outlineCombine(rect(0, 0, 2, 2), rect(0, 0, 2, 2), 'subtract'), { outlines: [], holes: [] });
});

test('combine reports what a room cannot be: a ring (3 x 3 minus the middle) has a hole, apart rectangles and ones touching only at a corner are two outlines', () => {
  assert.deepEqual(outlineCombine(rect(0, 0, 3, 3), rect(1, 1, 1, 1), 'subtract'), { outlines: [rect(0, 0, 3, 3)], holes: [rect(1, 1, 1, 1)] });
  assert.deepEqual(outlineCombine(rect(0, 0, 1, 1), rect(2, 0, 1, 1), 'union'), { outlines: [rect(0, 0, 1, 1), rect(2, 0, 1, 1)], holes: [] });
  assert.deepEqual(outlineCombine(rect(0, 0, 1, 1), rect(1, 1, 1, 1), 'union'), { outlines: [rect(0, 0, 1, 1), rect(1, 1, 1, 1)], holes: [] });
  assert.deepEqual(outlineCombine(rect(0, 0, 1, 1), rect(1, 0, 1, 1), 'union'), { outlines: [rect(0, 0, 2, 1)], holes: [] }, 'sharing a wall merges into one rectangle');
});

test('walls of L, clockwise from (0,0): top y=0 x 0..2, right x=2 y 0..1, bottom y=1 x 1..2, right x=1 y 1..2, bottom y=2 x 0..1, left x=0 y 0..2; counter-clockwise input gives the same walls', () => {
  const w = outlineWalls(L);
  assert.deepEqual(w.map((x) => [x.index, x.side, x.at, x.from, x.to, x.length]), [[0, 'top', 0, 0, 2, 2], [1, 'right', 2, 0, 1, 1], [2, 'bottom', 1, 1, 2, 1], [3, 'right', 1, 1, 2, 1], [4, 'bottom', 2, 0, 1, 1], [5, 'left', 0, 0, 2, 2]]);
  const key = (x: { side: string; at: number; from: number; to: number }) => [x.side, x.at, x.from, x.to].join();
  assert.deepEqual(outlineWalls([...L].reverse() as Outline).map(key).sort(), w.map(key).sort());
});

test('wall at: bottom at 1.5 is the notch wall (y=1), bottom at 0.5 the leg end (y=2); right at 0.5 is x=2, right at 1.5 is x=1; a side without a wall there is undefined', () => {
  assert.equal(outlineWallAt(L, 'bottom', 1.5)!.at, 1); assert.equal(outlineWallAt(L, 'bottom', 0.5)!.at, 2);
  assert.equal(outlineWallAt(L, 'right', 0.5)!.at, 2); assert.equal(outlineWallAt(L, 'right', 1.5)!.at, 1);
  assert.equal(outlineWallAt(L, 'top', 2.5), undefined); assert.equal(outlineWallAt(L, 'left', 1.5)!.at, 0);
});

test('wall at with two walls facing the same way (the left walls of U: outer x = 0 over y 0..2 and the notch wall x = 2 over y 0..1): the outermost wins by default, `at` picks the other, an unknown `at` falls back to the outermost; right walls x = 3 and x = 1 likewise', () => {
  assert.equal(outlineWallAt(U, 'left', 0.5)!.at, 0); assert.equal(outlineWallAt(U, 'left', 0.5, 2)!.at, 2); assert.equal(outlineWallAt(U, 'left', 0.5, 5)!.at, 0);
  assert.equal(outlineWallAt(U, 'left', 1.5)!.at, 0, 'below the notch there is only the outer wall');
  assert.equal(outlineWallAt(U, 'right', 0.5)!.at, 3); assert.equal(outlineWallAt(U, 'right', 0.5, 1)!.at, 1);
});

test('label rectangle: L has two best rectangles of area 2 (bar and leg), the bar wins (smaller y); U gives the bottom row 3 x 1; a rectangle is itself', () => {
  assert.deepEqual(outlineLabelRect(L), { x: 0, y: 0, width: 2, height: 1 });
  assert.deepEqual(outlineLabelRect(U), { x: 0, y: 1, width: 3, height: 1 });
  assert.deepEqual(outlineLabelRect(rect(1, 1, 2, 3)), { x: 1, y: 1, width: 2, height: 3 });
});

test('nearest: a point inside stays, one in the notch of L (1.5, 1.5) goes to (1.5, 1) (tie with (1, 1.5) goes to the smaller y), one far outside to the nearest corner', () => {
  assert.deepEqual(outlineNearest(L, 0.5, 0.5), [0.5, 0.5]);
  assert.deepEqual(outlineNearest(L, 1.5, 1.5), [1.5, 1]);
  assert.deepEqual(outlineNearest(L, 3, -1), [2, 0]);
  assert.deepEqual(outlineNearest(L, 0.3, 2.6), [0.3, 2]);
});

// Property test against an independent raster: 12 x 12 cells of 0.5 m, random rectangles combined step by step.
test('500 random unions / differences / intersections agree with a cell raster (area, membership of every cell centre, containment, overlap, perimeter, canonical form)', () => {
  let seed = 20260425;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const N = 12;
  const randRect = () => {
    const ix = Math.floor(rnd() * 10), iy = Math.floor(rnd() * 10), iw = 1 + Math.floor(rnd() * Math.min(6, N - ix)), ih = 1 + Math.floor(rnd() * Math.min(6, N - iy));
    return { ix, iy, iw, ih, rect: rect(ix * 0.5, iy * 0.5, iw * 0.5, ih * 0.5) };
  };
  const cells = (r: { ix: number; iy: number; iw: number; ih: number }) => { const c: [number, number][] = []; for (let i = r.ix; i < r.ix + r.iw; i++) for (let j = r.iy; j < r.iy + r.ih; j++) c.push([i, j]); return c; };
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  let singles = 0;
  for (let t = 0; t < 500; t++) {
    const r0 = randRect(), ras: boolean[][] = Array.from({ length: N }, () => new Array<boolean>(N).fill(false));
    for (const [i, j] of cells(r0)) ras[i]![j] = true;
    let shape: Outline = r0.rect;
    for (let step = 0; step < 4; step++) {
      const r = randRect(), op = (['union', 'subtract', 'intersect'] as const)[Math.floor(rnd() * 3)]!, inR = new Set(cells(r).map((c) => c.join()));
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const b = inR.has(i + ',' + j), a = ras[i]![j]!; ras[i]![j] = op === 'union' ? a || b : op === 'subtract' ? a && !b : a && b; }
      const res = outlineCombine(shape, r.rect, op), count = ras.flat().filter(Boolean).length;
      const area = res.outlines.reduce((s, o) => s + outlineArea(o), 0) - res.holes.reduce((s, o) => s + outlineArea(o), 0);
      assert.ok(near(area, count * 0.25), 'area ' + area + ' vs ' + count * 0.25 + ' (seed run ' + t + ')');
      if (res.outlines.length !== 1 || res.holes.length) break;
      singles++;
      shape = res.outlines[0]!;
      assert.deepEqual(outlineIssues(shape), []); assert.deepEqual(outlineNormalize(shape), shape);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) assert.equal(outlinePoint(shape, i * 0.5 + 0.25, j * 0.5 + 0.25), ras[i]![j], 'cell ' + i + ',' + j);
      const q = randRect(), qc = cells(q);
      assert.equal(outlineHasRect(shape, { x: q.ix * 0.5, y: q.iy * 0.5, width: q.iw * 0.5, height: q.ih * 0.5 }), qc.every(([i, j]) => ras[i!]![j!]));
      assert.ok(near(outlineOverlapArea(shape, q.rect), qc.filter(([i, j]) => ras[i!]![j!]).length * 0.25));
      let perimeter = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (ras[i]![j]) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di!, b = j + dj!; if (a < 0 || b < 0 || a >= N || b >= N || !ras[a]![b]) perimeter += 0.5; }
      assert.ok(near(outlineWalls(shape).reduce((s, w) => s + w.length, 0), perimeter), 'perimeter');
    }
  }
  assert.ok(singles > 500, 'enough single-outline results were checked: ' + singles);
});

test('embedded in the page: the shape functions evaluate and match Node', () => {
  const f = new Function(embeddedSource() + '\nreturn { outlineCombine, outlineWalls, outlineLabelRect, outlineHasRect };')() as {
    outlineCombine: typeof outlineCombine; outlineWalls: typeof outlineWalls; outlineLabelRect: typeof outlineLabelRect; outlineHasRect: typeof outlineHasRect;
  };
  assert.equal(JSON.stringify(f.outlineCombine(rect(0, 0, 3, 2), rect(1, 0, 1, 1), 'subtract')), JSON.stringify(outlineCombine(rect(0, 0, 3, 2), rect(1, 0, 1, 1), 'subtract')));
  assert.equal(JSON.stringify(f.outlineWalls(U)), JSON.stringify(outlineWalls(U)));
  assert.equal(JSON.stringify(f.outlineLabelRect(L)), JSON.stringify(outlineLabelRect(L)));
  assert.equal(f.outlineHasRect(L, { x: 0, y: 0, width: 2, height: 1 }), true);
});
