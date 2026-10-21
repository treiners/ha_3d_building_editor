/**
 * Stairs: a rectangle (seen from above) that connects two floors that lie directly above each other. Saved format:
 * `graph.stairs = [{ id, name?, lower: floorId, upper: floorId, x, y, length, width, direction, fromRoom?, toRoom? }]`.
 * - `x, y` = top-left corner of the rectangle in plan metres (all floors share one frame); `length` runs along `direction`, `width` across it.
 * - `direction` = the way the stair climbs, seen on the plan: "right" (+x), "left" (-x), "up" (-y, north on screen), "down" (+y).
 * - A thick bar marks where the stair lands on a floor: on the LOWER floor at the start (the side opposite to `direction`), on the UPPER floor at the end
 *   (the side `direction` points to). Example: direction "right" = bar on the left in the room below, bar on the right in the room above.
 * - `fromRoom` / `toRoom` are DERIVED on save (`stairsFill`): the room that contains the middle of the bar on the lower / upper floor (null = none).
 * Stairs are global (never stashed per floor). All functions are pure and embedded into the editor with toString();
 * siblings: stairBar -> stairRect, stairsVisible -> stairRect + stairBar, stairsHost -> stairBar, stairsFill -> stairsHost.
 */
export function stairRect(s: any): { x: number; y: number; w: number; h: number } {
  const horiz = s.direction === 'left' || s.direction === 'right';
  return { x: s.x, y: s.y, w: horiz ? s.length : s.width, h: horiz ? s.width : s.length };
}

/** The thick bar of a stair as seen on the lower or the upper floor (thickness 0.2 m, at most a quarter of the length). */
export function stairBar(s: any, role: 'lower' | 'upper'): { x: number; y: number; w: number; h: number } {
  const R = stairRect(s), horiz = s.direction === 'left' || s.direction === 'right', t = Math.min(0.2, Math.max(0.05, (horiz ? R.w : R.h) / 4));
  const back: any = { left: 'right', right: 'left', up: 'down', down: 'up' }, end = role === 'upper' ? s.direction : back[s.direction];
  return end === 'left' ? { x: R.x, y: R.y, w: t, h: R.h } : end === 'right' ? { x: R.x + R.w - t, y: R.y, w: t, h: R.h } : end === 'up' ? { x: R.x, y: R.y, w: R.w, h: t } : { x: R.x, y: R.y + R.h - t, w: R.w, h: t };
}

/** Stairs to draw on the current floor (the ones that start or end here), with their rectangle and bar. */
export function stairsVisible(graph: any): { id: string; name: string; role: 'lower' | 'upper'; direction: string; rect: { x: number; y: number; w: number; h: number }; bar: { x: number; y: number; w: number; h: number } }[] {
  const cur = graph._fl ? graph._fl.cur : null;
  return (graph.stairs || []).filter((s: any) => s.lower === cur || s.upper === cur).map((s: any) => {
    const role: 'lower' | 'upper' = s.lower === cur ? 'lower' : 'upper';
    return { id: s.id, name: s.name || s.id, role, direction: s.direction, rect: stairRect(s), bar: stairBar(s, role) };
  });
}

/** New stair at (x, y) between the current floor and the floor above it (or, on the top floor, the floor below). Needs at least two floors. Defaults: 3 m long, 1 m wide, climbing to the right. */
export function stairsAdd(input: { graph: any; x: number; y: number }): any {
  const g: any = JSON.parse(JSON.stringify(input.graph)), fl = g._fl;
  if (!fl || !g.floors || g.floors.length < 2) return g;
  const i = g.floors.findIndex((f: any) => f.id === fl.cur), lower = i < g.floors.length - 1 ? g.floors[i].id : g.floors[i - 1].id, upper = i < g.floors.length - 1 ? g.floors[i + 1].id : g.floors[i].id;
  g.stairs = g.stairs || [];
  const used = new Set<string>(g.stairs.map((s: any) => s.id)); let n = 1;
  while (used.has('stairs-' + n)) n++;
  g.stairs.push({ id: 'stairs-' + n, name: 'Stairs ' + n, lower, upper, x: input.x, y: input.y, length: 3, width: 1, direction: 'right' });
  return g;
}

/** Changes a stair; values are clamped (length 0.6 - 12 m, width 0.5 - 4 m), unknown directions and non-numbers are ignored. */
export function stairsUpdate(input: { graph: any; id: string; patch: any }): any {
  const g: any = JSON.parse(JSON.stringify(input.graph)), s = (g.stairs || []).find((x: any) => x.id === input.id), p = input.patch || {};
  if (!s) return g;
  const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : null), clamp = (v: number, a: number, b: number) => Math.round(Math.max(a, Math.min(b, v)) * 1e4) / 1e4;
  if (num(p.length) !== null) s.length = clamp(p.length, 0.6, 12);
  if (num(p.width) !== null) s.width = clamp(p.width, 0.5, 4);
  if (num(p.x) !== null) s.x = Math.round(p.x * 1e4) / 1e4;
  if (num(p.y) !== null) s.y = Math.round(p.y * 1e4) / 1e4;
  if (['left', 'right', 'up', 'down'].includes(p.direction)) s.direction = p.direction;
  if (typeof p.name === 'string' && p.name.trim()) s.name = p.name.trim();
  return g;
}

export function stairsRemove(input: { graph: any; id: string }): any {
  const g: any = JSON.parse(JSON.stringify(input.graph));
  if (g.stairs) { g.stairs = g.stairs.filter((s: any) => s.id !== input.id); if (!g.stairs.length) delete g.stairs; }
  return g;
}

/** Id of the room that contains the middle of the stair's bar on the lower / upper floor (a SAVED graph: rooms carry `floor`), or null. */
export function stairsHost(graph: any, s: any, role: 'lower' | 'upper'): string | null {
  const b = stairBar(s, role), cx = b.x + b.w / 2, cy = b.y + b.h / 2, floor = role === 'lower' ? s.lower : s.upper, first = graph.floors && graph.floors[0] ? graph.floors[0].id : null;
  for (const r of graph.rooms || []) {
    const L = r.layout;
    if (!L || String(r.name).toLowerCase() === 'outside' || (r.floor || first) !== floor) continue;
    if (cx >= L.x - 1e-6 && cx <= L.x + L.width + 1e-6 && cy >= L.y - 1e-6 && cy <= L.y + L.height + 1e-6) return r.id;
  }
  return null;
}

/** For saving: writes the derived `fromRoom` / `toRoom` of every stair. */
export function stairsFill(graph: any): any {
  const g: any = JSON.parse(JSON.stringify(graph));
  for (const s of g.stairs || []) { s.fromRoom = stairsHost(g, s, 'lower'); s.toRoom = stairsHost(g, s, 'upper'); }
  return g;
}

/** Corner drag: the corner (fx, fy) opposite to the dragged one stays where it is, the dragged corner goes to (px, py); returns the new x, y, length, width (length 0.6 - 12 m, width 0.5 - 4 m; the direction decides which side is the length). */
export function stairResize(s: any, fx: number, fy: number, px: number, py: number): { x: number; y: number; length: number; width: number } {
  const horiz = s.direction === 'left' || s.direction === 'right', r4 = (v: number) => Math.round(v * 1e4) / 1e4, clamp = (v: number, a: number, b: number) => r4(Math.max(a, Math.min(b, v)));
  const w = clamp(Math.abs(px - fx), horiz ? 0.6 : 0.5, horiz ? 12 : 4), h = clamp(Math.abs(py - fy), horiz ? 0.5 : 0.6, horiz ? 4 : 12);
  return { x: r4(px >= fx ? fx : fx - w), y: r4(py >= fy ? fy : fy - h), length: horiz ? w : h, width: horiz ? h : w };
}
