/**
 * Rectilinear room shapes (v2.18 phase 1, see docs/V2.18-SHAPES.md): pure, deterministic geometry for rooms whose corners are all 90 degrees
 * (L, U, T, bays, notches). A shape is an `Outline`: the corner points in metres, clockwise on screen (x right, y down, which is a POSITIVE shoelace
 * sum), edges alternating horizontal / vertical, no collinear or duplicate points, starting at the top-left-most corner (`outlineNormalize` makes any
 * valid outline canonical). No holes: a room is one loop; the boolean operations report holes and extra parts so the caller can refuse them.
 *
 * Everything works on a COMPRESSED GRID (the sorted x and y coordinates of the corners): a cell is inside when its centre is, so unions, differences,
 * overlaps and containment are exact, with no general polygon clipping. Coordinates are rounded to 1e-6, comparisons use 1e-6.
 *
 * Embedded into the editor page with toString(): no imports of values, helpers live inside the functions; sibling globals (all embedded together, see
 * embed.ts): `outlineNormalize`, `outlineGrid`, `outlinePoint`, `outlineWalls`, `outlineBounds`.
 */
export type Outline = [number, number][];
export interface OutlineRect { x: number; y: number; width: number; height: number }
export interface OutlineWall { index: number; side: 'top' | 'right' | 'bottom' | 'left'; at: number; from: number; to: number; length: number }
export type OutlineOp = 'union' | 'subtract' | 'intersect';

/** The four corners of a rectangle as a canonical outline. */
export function outlineFromRect(r: OutlineRect): Outline {
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const x0 = rnd(r.x), y0 = rnd(r.y), x1 = rnd(r.x + r.width), y1 = rnd(r.y + r.height);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** The bounding box of an outline. */
export function outlineBounds(o: Outline): OutlineRect {
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0, xs = o.map((p) => p[0]), ys = o.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x: rnd(x), y: rnd(y), width: rnd(Math.max(...xs) - x), height: rnd(Math.max(...ys) - y) };
}

/** The area of an outline (always positive, whatever the orientation). */
export function outlineArea(o: Outline): number {
  let s = 0;
  for (let i = 0; i < o.length; i++) { const p = o[i]!, q = o[(i + 1) % o.length]!; s += p[0] * q[1] - q[0] * p[1]; }
  return Math.round((Math.abs(s) / 2) * 1e6) / 1e6;
}

/** The canonical form: rounded, duplicates and collinear points removed, clockwise, starting at the top-left-most corner. Fewer than 4 points are returned as they are. */
export function outlineNormalize(o: Outline): Outline {
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  let p: Outline = o.map((q): [number, number] => [rnd(q[0]), rnd(q[1])]);
  p = p.filter((q, i) => { const n = p[(i + 1) % p.length]!; return !(q[0] === n[0] && q[1] === n[1]); });
  let again = true;
  while (again && p.length > 2) {
    again = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length]!, b = p[i]!, c = p[(i + 1) % p.length]!;
      if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) { p.splice(i, 1); again = true; break; }
    }
  }
  if (p.length < 4) return p;
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; }
  if (s < 0) p.reverse();
  let k = 0;
  for (let i = 1; i < p.length; i++) if (p[i]![1] < p[k]![1] || (p[i]![1] === p[k]![1] && p[i]![0] < p[k]![0])) k = i;
  return p.slice(k).concat(p.slice(0, k));
}

/**
 * Structural problems of an outline as codes, empty when it is valid: `points` (fewer than 4, an odd number, or not numbers), `diagonal` (an edge that is
 * neither horizontal nor vertical), `alternate` (a zero-length edge, or two horizontal / two vertical edges in a row: collinear corners), `self-intersect`
 * (edges that touch or cross, other than neighbours at their shared corner), `orientation` (not clockwise on screen). The first four end the check.
 */
export function outlineIssues(o: Outline): string[] {
  const EPS = 1e-6, n = Array.isArray(o) ? o.length : 0;
  if (n < 4 || n % 2 !== 0 || o.some((p) => !Array.isArray(p) || !isFinite(p[0]) || !isFinite(p[1]))) return ['points'];
  const H = (i: number) => Math.abs(o[i]![1] - o[(i + 1) % n]![1]) <= EPS, V = (i: number) => Math.abs(o[i]![0] - o[(i + 1) % n]![0]) <= EPS;
  for (let i = 0; i < n; i++) { if (!H(i) && !V(i)) return ['diagonal']; if (H(i) && V(i)) return ['alternate']; }
  for (let i = 0; i < n; i++) if (H(i) === H((i + 1) % n)) return ['alternate'];
  let hit = false;
  for (let i = 0; i < n && !hit; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue;
    const a = o[i]!, b = o[(i + 1) % n]!, c = o[j]!, d = o[(j + 1) % n]!;
    if (Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + EPS && Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) + EPS) { hit = true; break; }
  }
  if (hit) return ['self-intersect'];
  let s = 0;
  for (let i = 0; i < n; i++) { const a = o[i]!, b = o[(i + 1) % n]!; s += a[0] * b[1] - b[0] * a[1]; }
  return s < 0 ? ['orientation'] : [];
}

/** Is the point inside the outline or on its boundary (within 1e-6)? */
export function outlinePoint(o: Outline, x: number, y: number): boolean {
  const EPS = 1e-6;
  let crossings = 0;
  for (let i = 0; i < o.length; i++) {
    const a = o[i]!, b = o[(i + 1) % o.length]!, x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    if (x >= x0 - EPS && x <= x1 + EPS && y >= y0 - EPS && y <= y1 + EPS) return true;
    if (Math.abs(a[0] - b[0]) <= EPS && a[0] > x && y >= y0 && y < y1) crossings++;
  }
  return crossings % 2 === 1;
}

/**
 * The compressed grid of several outlines: the sorted unique x and y coordinates of all corners (plus `extraXs` / `extraYs`) and, per outline, which cell
 * is inside it: `cells[k][i][j]` is cell (xs[i]..xs[i+1], ys[j]..ys[j+1]) of outline k. Cell centres never lie on an edge, so the test is exact.
 */
export function outlineGrid(outlines: Outline[], extraXs: number[] = [], extraYs: number[] = []): { xs: number[]; ys: number[]; cells: boolean[][][] } {
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0, uniq = (v: number[]) => Array.from(new Set(v.map(rnd))).sort((a, b) => a - b);
  const xs = uniq([...extraXs, ...outlines.flatMap((o) => o.map((p) => p[0]))]), ys = uniq([...extraYs, ...outlines.flatMap((o) => o.map((p) => p[1]))]);
  const cells = outlines.map((o) => {
    const vert: [number, number, number][] = [];
    for (let i = 0; i < o.length; i++) { const a = o[i]!, b = o[(i + 1) % o.length]!; if (Math.abs(a[0] - b[0]) <= 1e-6) vert.push([a[0], Math.min(a[1], b[1]), Math.max(a[1], b[1])]); }
    const m: boolean[][] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const row: boolean[] = [], cx = (xs[i]! + xs[i + 1]!) / 2;
      for (let j = 0; j < ys.length - 1; j++) {
        const cy = (ys[j]! + ys[j + 1]!) / 2;
        let c = 0;
        for (const e of vert) if (e[0] > cx && cy > e[1] && cy < e[2]) c++;
        row.push(c % 2 === 1);
      }
      m.push(row);
    }
    return m;
  });
  return { xs, ys, cells };
}

/** Does the rectangle lie completely inside the outline (touching the boundary is fine)? A zero-size rectangle is a point. */
export function outlineHasRect(o: Outline, r: OutlineRect): boolean {
  const EPS = 1e-6, rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  if (!(r.width > EPS && r.height > EPS)) return outlinePoint(o, r.x, r.y);
  const x0 = rnd(r.x), x1 = rnd(r.x + r.width), y0 = rnd(r.y), y1 = rnd(r.y + r.height), g = outlineGrid([o], [x0, x1], [y0, y1]), m = g.cells[0]!;
  for (let i = 0; i < g.xs.length - 1; i++) for (let j = 0; j < g.ys.length - 1; j++) {
    const cx = (g.xs[i]! + g.xs[i + 1]!) / 2, cy = (g.ys[j]! + g.ys[j + 1]!) / 2;
    if (cx > x0 && cx < x1 && cy > y0 && cy < y1 && !m[i]![j]) return false;
  }
  return true;
}

/** The area two outlines have in common (0 when they only touch). */
export function outlineOverlapArea(a: Outline, b: Outline): number {
  const g = outlineGrid([a, b]), A = g.cells[0]!, B = g.cells[1]!;
  let s = 0;
  for (let i = 0; i < g.xs.length - 1; i++) for (let j = 0; j < g.ys.length - 1; j++) if (A[i]![j] && B[i]![j]) s += (g.xs[i + 1]! - g.xs[i]!) * (g.ys[j + 1]! - g.ys[j]!);
  return Math.round(s * 1e6) / 1e6;
}

/**
 * Boolean operation on two outlines (`union`, `subtract` = a without b, `intersect`). Returns the outer loops (`outlines`) and the holes (`holes`), all
 * canonical and sorted by their start corner. A room needs exactly one outline and no hole; parts that only touch at a corner count as separate outlines.
 */
export function outlineCombine(a: Outline, b: Outline, op: OutlineOp): { outlines: Outline[]; holes: Outline[] } {
  const g = outlineGrid([a, b]), A = g.cells[0]!, B = g.cells[1]!, nx = g.xs.length - 1, ny = g.ys.length - 1;
  const inside = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < nx && j < ny && (op === 'union' ? !!(A[i]![j] || B[i]![j]) : op === 'subtract' ? !!(A[i]![j] && !B[i]![j]) : !!(A[i]![j] && B[i]![j]));
  interface Edge { fi: number; fj: number; ti: number; tj: number; used: boolean }
  const edges: Edge[] = [], from = new Map<number, Edge[]>(), key = (i: number, j: number) => i * (ny + 1) + j;
  const add = (fi: number, fj: number, ti: number, tj: number) => { const e: Edge = { fi, fj, ti, tj, used: false }; edges.push(e); const k = key(fi, fj); if (!from.has(k)) from.set(k, []); from.get(k)!.push(e); };
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (!inside(i, j)) continue;
    if (!inside(i, j - 1)) add(i, j, i + 1, j);
    if (!inside(i + 1, j)) add(i + 1, j, i + 1, j + 1);
    if (!inside(i, j + 1)) add(i + 1, j + 1, i, j + 1);
    if (!inside(i - 1, j)) add(i, j + 1, i, j);
  }
  const outlines: Outline[] = [], holes: Outline[] = [];
  for (const first of edges) {
    if (first.used) continue;
    const loop: Outline = [];
    let cur: Edge | null = first, guard = edges.length + 2;
    while (cur && guard-- > 0) {
      cur.used = true;
      loop.push([g.xs[cur.fi]!, g.ys[cur.fj]!]);
      const dx = Math.sign(cur.ti - cur.fi), dy = Math.sign(cur.tj - cur.fj), cands: Edge[] = (from.get(key(cur.ti, cur.tj)) || []).filter((e) => !e.used || e === first);
      const want: [number, number][] = [[-dy, dx], [dx, dy], [dy, -dx]];
      let next: Edge | null = null;
      for (const w of want) { const f = cands.find((e) => Math.sign(e.ti - e.fi) === w[0] && Math.sign(e.tj - e.fj) === w[1]); if (f) { next = f; break; } }
      if (next === first) break;
      cur = next;
    }
    let s = 0;
    for (let i = 0; i < loop.length; i++) { const p = loop[i]!, q = loop[(i + 1) % loop.length]!; s += p[0] * q[1] - q[0] * p[1]; }
    const n = outlineNormalize(loop);
    if (n.length < 4) continue;
    (s > 0 ? outlines : holes).push(n);
  }
  const order = (p: Outline, q: Outline) => p[0]![1] - q[0]![1] || p[0]![0] - q[0]![0];
  return { outlines: outlines.sort(order), holes: holes.sort(order) };
}

/** The wall segments of an outline in corner order: `side` is the direction the wall faces (outwards), `at` its coordinate (y for top / bottom, x for left / right), `from` / `to` its extent along the other axis. */
export function outlineWalls(o: Outline): OutlineWall[] {
  const n = o.length, out: OutlineWall[] = [], rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  let s = 0;
  for (let i = 0; i < n; i++) { const a = o[i]!, b = o[(i + 1) % n]!; s += a[0] * b[1] - b[0] * a[1]; }
  const cw = s >= 0;
  for (let i = 0; i < n; i++) {
    const a = o[i]!, b = o[(i + 1) % n]!;
    if (Math.abs(a[1] - b[1]) <= 1e-6) {
      const east = b[0] > a[0];
      out.push({ index: i, side: east === cw ? 'top' : 'bottom', at: rnd(a[1]), from: rnd(Math.min(a[0], b[0])), to: rnd(Math.max(a[0], b[0])), length: rnd(Math.abs(b[0] - a[0])) });
    } else {
      const south = b[1] > a[1];
      out.push({ index: i, side: south === cw ? 'right' : 'left', at: rnd(a[0]), from: rnd(Math.min(a[1], b[1])), to: rnd(Math.max(a[1], b[1])), length: rnd(Math.abs(b[1] - a[1])) });
    }
  }
  return out;
}

/**
 * The wall a connector sits on: a wall facing `side` whose extent contains `along` (x for top / bottom, y for left / right, measured from the outline origin). Two walls that face the
 * same way can cover the same `along` (the left walls of both arms of a U, the notch wall and the outer wall of an L): `at` (the wall's coordinate, a connector's `wallAt`) picks one;
 * without it, or when no wall has that coordinate, the OUTERMOST wall wins (smallest at for top / left, largest for bottom / right), like a connector on a plain rectangle.
 */
export function outlineWallAt(o: Outline, side: string, along: number, at?: number): OutlineWall | undefined {
  const c = outlineWalls(o).filter((w) => w.side === side && along >= w.from - 1e-6 && along <= w.to + 1e-6);
  if (c.length < 2) return c[0];
  if (typeof at === 'number') { const m = c.find((w) => Math.abs(w.at - at) <= 1e-4); if (m) return m; }
  const outer = side === 'top' || side === 'left' ? Math.min(...c.map((w) => w.at)) : Math.max(...c.map((w) => w.at));
  return c.find((w) => w.at === outer);
}

/** The largest axis-aligned rectangle inside the outline (the best place for a label); ties go to the smallest y, then the smallest x, then the wider one. */
export function outlineLabelRect(o: Outline): OutlineRect {
  const g = outlineGrid([o]), m = g.cells[0]!, nx = g.xs.length - 1, ny = g.ys.length - 1, rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const P: number[][] = [];
  for (let i = 0; i <= nx; i++) P.push(new Array(ny + 1).fill(0));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) P[i + 1]![j + 1] = P[i]![j + 1]! + P[i + 1]![j]! - P[i]![j]! + (m[i]![j] ? 1 : 0);
  let best: OutlineRect | null = null, bestArea = -1;
  for (let i0 = 0; i0 < nx; i0++) for (let i1 = i0 + 1; i1 <= nx; i1++) for (let j0 = 0; j0 < ny; j0++) for (let j1 = j0 + 1; j1 <= ny; j1++) {
    if (P[i1]![j1]! - P[i0]![j1]! - P[i1]![j0]! + P[i0]![j0]! !== (i1 - i0) * (j1 - j0)) continue;
    const w = g.xs[i1]! - g.xs[i0]!, h = g.ys[j1]! - g.ys[j0]!, area = w * h;
    const better = area > bestArea + 1e-9 || (Math.abs(area - bestArea) <= 1e-9 && best !== null && (g.ys[j0]! < best.y - 1e-9 || (Math.abs(g.ys[j0]! - best.y) <= 1e-9 && (g.xs[i0]! < best.x - 1e-9 || (Math.abs(g.xs[i0]! - best.x) <= 1e-9 && w > best.width + 1e-9)))));
    if (better) { best = { x: g.xs[i0]!, y: g.ys[j0]!, width: rnd(w), height: rnd(h) }; bestArea = area; }
  }
  return best || outlineBounds(o);
}

/** The point itself when it is inside the outline (or on its boundary), otherwise the nearest point of the boundary (ties: smaller y, then smaller x). */
export function outlineNearest(o: Outline, x: number, y: number): [number, number] {
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  if (outlinePoint(o, x, y)) return [rnd(x), rnd(y)];
  let best: [number, number] = [x, y], bd = Infinity;
  for (const w of outlineWalls(o)) {
    const c: [number, number] = w.side === 'top' || w.side === 'bottom' ? [Math.max(w.from, Math.min(w.to, x)), w.at] : [w.at, Math.max(w.from, Math.min(w.to, y))], d = Math.hypot(c[0] - x, c[1] - y);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && (c[1] < best[1] || (c[1] === best[1] && c[0] < best[0])))) { bd = d; best = c; }
  }
  return [rnd(best[0]), rnd(best[1])];
}

/**
 * Is some part of the outline thinner than `min` metres, or some notch narrower? True when two walls that face each other (left / right or top / bottom) are closer than `min`
 * (more than 1e-6) and share part of their extent: a strip between them (an inner wall and an outer wall 0.2 m apart) or a gap between two parts.
 */
export function outlineThin(o: Outline, min: number): boolean {
  const ws = outlineWalls(o), opposite: Record<string, string> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
    const a = ws[i]!, b = ws[j]!, d = Math.abs(a.at - b.at);
    if (opposite[a.side] === b.side && d > 1e-6 && d < min - 1e-6 && Math.min(a.to, b.to) - Math.max(a.from, b.from) > 1e-6) return true;
  }
  return false;
}

/**
 * Moves wall `index` (corner order of a canonical outline) along its outward normal by `delta` metres (positive = outwards, negative = inwards): its two corners move,
 * the neighbouring walls stretch or shrink. Returns the new canonical outline (collinear walls that now line up are merged), or null when the result is not a valid
 * shape (touching or crossing itself) or has a wall shorter than `minEdge` (default 0.3 m). A zero delta returns the outline unchanged.
 */
export function outlineMoveWall(o: Outline, index: number, delta: number, minEdge = 0.3): Outline | null {
  const w = outlineWalls(o)[index];
  if (!w) return null;
  if (Math.abs(delta) < 1e-9) return o.map((p): [number, number] => [p[0], p[1]]);
  const n = o.length, horizontal = w.side === 'top' || w.side === 'bottom', d = (w.side === 'bottom' || w.side === 'right' ? 1 : -1) * delta;
  const moved = o.map((p, i): [number, number] => (i === index || i === (index + 1) % n ? (horizontal ? [p[0], p[1] + d] : [p[0] + d, p[1]]) : [p[0], p[1]]));
  const out = outlineNormalize(moved);
  if (outlineIssues(out).length || outlineWalls(out).some((x) => x.length < minEdge - 1e-6) || outlineThin(out, minEdge)) return null;
  return out;
}

/**
 * A bump (depth > 0, outwards) or notch (depth < 0, inwards) in wall `index`: `width` metres wide, centred at `center` (the coordinate along the wall, from the outline origin,
 * like `outlineWallAt`) and clamped to the wall, so a notch that reaches a wall end cuts a corner. `depth` is the size of the bump or notch (at least 0.2 m). Returns the new
 * canonical outline, or null when it is not valid (a part would be cut off or a hole made), a wall would be shorter than `minEdge` (default 0.3 m), or the clamped width is too small.
 */
export function outlineBump(o: Outline, index: number, center: number, width: number, depth: number, minEdge = 0.3): Outline | null {
  const w = outlineWalls(o)[index];
  if (!w || Math.abs(depth) < 0.2 - 1e-9 || width < minEdge - 1e-9) return null;
  const lo = Math.max(w.from, center - width / 2), hi = Math.min(w.to, center + width / 2);
  if (hi - lo < minEdge - 1e-6) return null;
  const horizontal = w.side === 'top' || w.side === 'bottom', p1 = w.at + (w.side === 'bottom' || w.side === 'right' ? 1 : -1) * depth, q0 = Math.min(w.at, p1), q1 = Math.max(w.at, p1);
  const r = outlineCombine(o, outlineFromRect(horizontal ? { x: lo, y: q0, width: hi - lo, height: q1 - q0 } : { x: q0, y: lo, width: q1 - q0, height: hi - lo }), depth > 0 ? 'union' : 'subtract');
  if (r.outlines.length !== 1 || r.holes.length) return null;
  const out = r.outlines[0]!;
  if (outlineIssues(out).length || outlineWalls(out).some((x) => x.length < minEdge - 1e-6) || outlineThin(out, minEdge)) return null;
  return out;
}
