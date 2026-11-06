/**
 * Shaped areas (v2.19): an outside area (deck, driveway, garden, path, other) can have the same rectilinear shape as a room: the optional `outline` (corners in metres, relative to the area's
 * layout top-left corner, see shape.ts) next to its `layout` (the bounding box). Without `outline` the area is its rectangle (or its ellipse when `shape` is 'ellipse'; ellipses cannot be shaped).
 * Pure + deterministic; every function returns a NEW graph. Embedded into the editor HTML with toString(): no imports of values, helpers inside the functions; sibling globals:
 * `areaOutlineOf`, `reshapeArea`, and the shape functions `outlineBounds`, `outlineBump`, `outlineCombine`, `outlineFromRect`, `outlineIssues`, `outlineMoveWall`, `outlineNormalize`,
 * `outlineThin`, `outlineWalls`.
 * Entities and objects that sit in an area (`areaId`) keep their place on the ground: their positions (relative to the area's corner) are re-based when the corner moves.
 */
import { outlineBounds, outlineBump, outlineCombine, outlineFromRect, outlineIssues, outlineMoveWall, outlineNormalize, outlineThin, outlineWalls } from './shape.js';
import type { Outline } from './shape.js';

interface ALayout { x: number; y: number; width: number; height: number }
interface AArea { id: string; name?: string; kind?: string; shape?: string; roofed?: boolean; layout?: ALayout; outline?: Outline }
export interface AreaShapeGraph {
  areas?: AArea[];
  entityPlacements?: { areaId?: string; position?: number[] }[];
  objects?: { areaId?: string; position?: number[] }[];
}
export interface AreaShapeResult<G> { graph: G; ok: boolean; message: string; id: string }

/** The shape of an area relative to its layout's top-left corner: its valid outline in canonical form, else the rectangle of its layout. */
export function areaOutlineOf(a: { layout?: { width: number; height: number }; outline?: Outline }): Outline {
  if (a.outline && outlineIssues(a.outline).length === 0) return outlineNormalize(a.outline);
  return outlineFromRect({ x: 0, y: 0, width: a.layout ? a.layout.width : 0, height: a.layout ? a.layout.height : 0 });
}

/**
 * Gives an area a new shape: `outline` is relative to the area's CURRENT top-left corner and may reach beyond it. The layout becomes the new bounding box (minimum 0.5 m), the outline is stored
 * relative to it and dropped when it is a rectangle, and the entities and objects of the area keep their place on the ground. Ellipses (and trees) cannot be shaped.
 */
export function reshapeArea<G extends AreaShapeGraph>(input: { graph: G; id: string; outline: Outline }): AreaShapeResult<G> {
  const g0 = input.graph, fail = (m: string): AreaShapeResult<G> => ({ graph: g0, ok: false, message: m, id: input.id });
  const a0 = (g0.areas || []).find((a) => a.id === input.id);
  if (!a0 || !a0.layout) return fail('No such area.');
  if (a0.shape === 'ellipse') return fail('Only rectangular areas can be shaped: set Shape to Rectangle first.');
  const o = outlineNormalize(input.outline);
  if (o.length < 4 || outlineIssues(o).length) return fail('That shape is not valid.');
  const b = outlineBounds(o), rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  if (b.width < 0.5 - 1e-9 || b.height < 0.5 - 1e-9) return fail('An area must stay at least 0.5 m wide and high.');
  const g = JSON.parse(JSON.stringify(g0)) as G, a = (g.areas || []).find((x) => x.id === input.id)!, L = a.layout!;
  const rel = outlineNormalize(o.map((q): [number, number] => [q[0] - b.x, q[1] - b.y]));
  L.x = rnd(L.x + b.x); L.y = rnd(L.y + b.y); L.width = b.width; L.height = b.height;
  if (rel.length === 4) delete a.outline; else a.outline = rel;
  for (const e of g.entityPlacements || []) if (e.areaId === input.id && Array.isArray(e.position)) e.position = [rnd(e.position[0]! - b.x), rnd(e.position[1]! - b.y)];
  for (const ob of g.objects || []) if (ob.areaId === input.id && Array.isArray(ob.position)) ob.position = [rnd(ob.position[0]! - b.x), rnd(ob.position[1]! - b.y)];
  return { graph: g, ok: true, message: rel.length === 4 ? 'The area is a rectangle.' : 'Shape changed.', id: input.id };
}

/** Moves wall `wall` (index in `areaOutlineOf`) of an area along its outward normal by `delta` metres (outwards positive). Refused when the shape would become invalid or a wall shorter than `minEdge` (default 0.3 m). */
export function moveAreaWall<G extends AreaShapeGraph>(input: { graph: G; id: string; wall: number; delta: number; minEdge?: number }): AreaShapeResult<G> {
  const g = input.graph, a = (g.areas || []).find((x) => x.id === input.id), fail = (m: string): AreaShapeResult<G> => ({ graph: g, ok: false, message: m, id: input.id });
  if (!a || !a.layout) return fail('No such area.');
  if (a.shape === 'ellipse') return fail('Only rectangular areas can be shaped: set Shape to Rectangle first.');
  const o = areaOutlineOf(a);
  if (!outlineWalls(o)[input.wall]) return fail('No such wall.');
  if (Math.abs(input.delta) < 1e-9) return { graph: g, ok: true, message: 'No change.', id: input.id };
  const n = outlineMoveWall(o, input.wall, input.delta, input.minEdge);
  if (!n) return fail('That would make the shape invalid or a wall shorter than ' + (input.minEdge ?? 0.3) + ' m.');
  return reshapeArea({ graph: g, id: input.id, outline: n });
}

/** Pulls a bump (depth > 0) or notch (depth < 0) of `width` metres out of wall `wall`, centred at `center` along the wall (from the area's corner). See `outlineBump`. */
export function pullAreaWall<G extends AreaShapeGraph>(input: { graph: G; id: string; wall: number; center: number; width: number; depth: number; minEdge?: number }): AreaShapeResult<G> {
  const g = input.graph, a = (g.areas || []).find((x) => x.id === input.id), fail = (m: string): AreaShapeResult<G> => ({ graph: g, ok: false, message: m, id: input.id });
  if (!a || !a.layout) return fail('No such area.');
  if (a.shape === 'ellipse') return fail('Only rectangular areas can be shaped: set Shape to Rectangle first.');
  const o = areaOutlineOf(a);
  if (!outlineWalls(o)[input.wall]) return fail('No such wall.');
  if (Math.abs(input.depth) < 0.2 - 1e-9) return fail('A bump or notch needs at least 0.2 m.');
  const n = outlineBump(o, input.wall, input.center, input.width, input.depth, input.minEdge);
  if (!n) return fail('That would cut the area apart, make a wall shorter than ' + (input.minEdge ?? 0.3) + ' m, or the bump is too narrow.');
  return reshapeArea({ graph: g, id: input.id, outline: n });
}

/**
 * Merges two areas into one: the first id is kept (id, name and the rest), the second disappears. Only areas of the same kind can be merged, and a roofed area only with a roofed one; ellipses
 * (and trees) cannot be merged. The two shapes may touch along part of an edge or overlap, but their union must be ONE shape without a hole and with no wall or part shorter / thinner than 0.3 m.
 * The union becomes the layout (bounding box) and `outline` (dropped when it is a rectangle); entities and objects of the second area move to the first (positions re-based).
 */
export function mergeAreas<G extends AreaShapeGraph>(input: { graph: G; ids: string[] }): AreaShapeResult<G> {
  const g0 = input.graph, ia = input.ids[0] || '', ib = input.ids[1] || '', fail = (m: string): AreaShapeResult<G> => ({ graph: g0, ok: false, message: m, id: ia });
  if (input.ids.length !== 2 || !ia || ia === ib) return fail('Select exactly two areas to merge.');
  const a0 = (g0.areas || []).find((x) => x.id === ia), b0 = (g0.areas || []).find((x) => x.id === ib);
  if (!a0 || !b0 || !a0.layout || !b0.layout) return fail('Both areas need a place on the plan.');
  const A0 = a0.layout, B0 = b0.layout, nm = (a: AArea) => a.name || a.id, rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  if (a0.kind !== b0.kind) return fail('Only areas of the same kind can be merged (' + nm(a0) + ' is a ' + a0.kind + ', ' + nm(b0) + ' is a ' + b0.kind + ').');
  if (!!a0.roofed !== !!b0.roofed) return fail('A roofed and an open area cannot be merged (' + nm(a0) + (a0.roofed ? ' is roofed, ' : ' is open, ') + nm(b0) + (b0.roofed ? ' is roofed).' : ' is open).'));
  if (a0.shape === 'ellipse' || b0.shape === 'ellipse') return fail('Ellipses cannot be merged: make them rectangles first.');
  const at = (s: Outline, x: number, y: number): Outline => s.map((q): [number, number] => [q[0] + x, q[1] + y]);
  const u = outlineCombine(at(areaOutlineOf(a0), A0.x, A0.y), at(areaOutlineOf(b0), B0.x, B0.y), 'union');
  if (u.outlines.length !== 1 || u.holes.length) return fail(nm(a0) + ' and ' + nm(b0) + ' must share part of an edge (or overlap) and form one shape without a hole.');
  const un = u.outlines[0]!;
  if (outlineIssues(un).length || outlineWalls(un).some((w) => w.length < 0.3 - 1e-6) || outlineThin(un, 0.3)) return fail('The merged area would have a wall shorter than 0.3 m or a part thinner than 0.3 m.');
  const b = outlineBounds(un), rel = outlineNormalize(un.map((q): [number, number] => [q[0] - b.x, q[1] - b.y]));
  const g = JSON.parse(JSON.stringify(g0)) as G, a = (g.areas || []).find((x) => x.id === ia)!, L = a.layout!, gs: AreaShapeGraph = g;
  L.x = rnd(b.x); L.y = rnd(b.y); L.width = b.width; L.height = b.height;
  if (rel.length > 4) a.outline = rel; else delete a.outline;
  gs.areas = (gs.areas || []).filter((x) => x.id !== ib);
  const srcOf = (id?: string): ALayout | undefined => (id === ia ? A0 : id === ib ? B0 : undefined);
  let moved = 0;
  for (const e of g.entityPlacements || []) { const s = srcOf(e.areaId); if (s && Array.isArray(e.position)) { e.position = [rnd(s.x + e.position[0]! - b.x), rnd(s.y + e.position[1]! - b.y)]; e.areaId = ia; moved++; } }
  for (const ob of g.objects || []) { const s = srcOf(ob.areaId); if (s && Array.isArray(ob.position)) { ob.position = [rnd(s.x + ob.position[0]! - b.x), rnd(s.y + ob.position[1]! - b.y)]; ob.areaId = ia; moved++; } }
  return { graph: g, ok: true, message: 'Merged ' + nm(b0) + ' into ' + nm(a0) + (rel.length > 4 ? ' (shaped area).' : ' (rectangle).') + (moved ? ' ' + moved + (moved === 1 ? ' item' : ' items') + ' moved over.' : ''), id: ia };
}
