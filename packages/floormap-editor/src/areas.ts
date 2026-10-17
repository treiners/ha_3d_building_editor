/**
 * Outside areas (deck, driveway, garden / plot, pond, path): flat labelled footprints in plan coordinates, kept in the optional graph key `areas`.
 * They are NOT part of the room graph (no connectors, no solvers, no mapper); entities can sit in them (`areaId`, see entities.ts).
 * Shapes: axis-aligned `rect` or `ellipse` inside `layout` { x, y, width, height } (metres, y down). Pure + deterministic; mutating functions return a NEW graph.
 * Embedded into the editor HTML with toString(): no imports, helpers inside the functions; sibling global `areaKinds` only.
 */
export interface AreaResult { graph: any; ok: boolean; message: string; id: string }

/** Kind catalogue: label, default shape and size [w, h] in metres, colours. `plot` kinds (garden) may surround rooms without a warning. */
export function areaKinds(): Record<string, any> {
  return {
    deck: { label: 'Deck', shape: 'rect', size: [4, 3], fill: '#e7d3b5', stroke: '#a16207' },
    driveway: { label: 'Driveway', shape: 'rect', size: [6, 3], fill: '#d4d4d8', stroke: '#52525b' },
    garden: { label: 'Garden', shape: 'rect', size: [10, 8], fill: '#dcfce7', stroke: '#16a34a', plot: true },
    pond: { label: 'Pond', shape: 'ellipse', size: [2.5, 1.8], fill: '#bfdbfe', stroke: '#2563eb' },
    path: { label: 'Path', shape: 'rect', size: [4, 1], fill: '#f1e4c9', stroke: '#b45309' },
    other: { label: 'Other', shape: 'rect', size: [3, 3], fill: '#e5e7eb', stroke: '#6b7280' },
  };
}

/**
 * Adds an area. Either `layout` (a drawn box) or `at` (a click: the kind's default size centred on the point). `snap` = grid step. Minimum size 0.5 m.
 * Id: slug of `id` or the name, next free `-N`; default name = kind label, numbered when that kind already exists.
 */
export function addArea(input: { graph: any; kind?: string; name?: string; id?: string; at?: { x: number; y: number }; layout?: { x: number; y: number; width: number; height: number }; snap?: number }): AreaResult {
  const g: any = JSON.parse(JSON.stringify(input.graph)), K = areaKinds(), kind = input.kind || 'other', k = K[kind];
  const fail = (m: string): AreaResult => ({ graph: input.graph, ok: false, message: m, id: '' });
  if (!k) return fail('Unknown area kind "' + kind + '".');
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0, st = input.snap && input.snap > 0 ? input.snap : 0, sn = (v: number) => (st ? Math.round(v / st) * st : v), MIN = 0.5;
  let L: any;
  if (input.layout) L = { x: rnd(sn(input.layout.x)), y: rnd(sn(input.layout.y)), width: rnd(Math.max(MIN, sn(input.layout.width))), height: rnd(Math.max(MIN, sn(input.layout.height))) };
  else if (input.at) L = { x: rnd(sn(input.at.x - k.size[0] / 2)), y: rnd(sn(input.at.y - k.size[1] / 2)), width: k.size[0], height: k.size[1] };
  else return fail('Click on the plan to place the area.');
  const list: any[] = g.areas || (g.areas = []), same = list.filter(a => a.kind === kind).length;
  const name = input.name || k.label + (same ? ' ' + (same + 1) : '');
  const base = String(input.id || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'area';
  let id = base, n = 2;
  while (list.some(a => a.id === id)) id = base + '-' + n++;
  list.push({ id, name, kind, shape: k.shape, layout: L });
  return { graph: g, ok: true, message: 'Added ' + k.label.toLowerCase() + ' "' + name + '".', id };
}

/** Edits one area: name, kind, shape (rect | ellipse), x, y, width, height (min 0.5), roofed. Unknown values are ignored. */
export function updateArea(input: { graph: any; id: string; patch: any }): AreaResult {
  const g: any = JSON.parse(JSON.stringify(input.graph)), a = (g.areas || []).find((o: any) => o.id === input.id), P = input.patch || {};
  if (!a) return { graph: input.graph, ok: false, message: 'No such area.', id: input.id };
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0, num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : NaN);
  if (typeof P.name === 'string' && P.name.trim()) a.name = P.name.trim();
  if (typeof P.kind === 'string' && areaKinds()[P.kind]) a.kind = P.kind;
  if (P.shape === 'rect' || P.shape === 'ellipse') a.shape = P.shape;
  if (!isNaN(num(P.x))) a.layout.x = rnd(P.x);
  if (!isNaN(num(P.y))) a.layout.y = rnd(P.y);
  if (!isNaN(num(P.width))) a.layout.width = rnd(Math.max(0.5, P.width));
  if (!isNaN(num(P.height))) a.layout.height = rnd(Math.max(0.5, P.height));
  if (typeof P.roofed === 'boolean') { if (P.roofed) a.roofed = true; else delete a.roofed; }
  return { graph: g, ok: true, message: 'Updated "' + a.name + '".', id: a.id };
}

/** Deletes an area and the entities anchored to it. */
export function removeArea(input: { graph: any; id: string }): AreaResult {
  const g: any = JSON.parse(JSON.stringify(input.graph)), a = (g.areas || []).find((o: any) => o.id === input.id);
  if (!a) return { graph: input.graph, ok: false, message: 'No such area.', id: input.id };
  g.areas = g.areas.filter((o: any) => o.id !== input.id);
  const ne = (g.entityPlacements || []).length;
  if (ne) g.entityPlacements = g.entityPlacements.filter((e: any) => e.areaId !== input.id);
  const nr = ne - (g.entityPlacements || []).length;
  return { graph: g, ok: true, message: 'Deleted area "' + a.name + '".' + (nr ? ' ' + nr + (nr === 1 ? ' entity' : ' entities') + ' removed.' : ''), id: input.id };
}

/** The smallest area containing the point (ellipses honour their curve); ties go to the smaller id. null when none. */
export function areaAt(graph: any, x: number, y: number): any {
  let best: any = null, ba = Infinity;
  for (const a of graph.areas || []) {
    const L = a.layout;
    if (!L || x < L.x - 1e-6 || x > L.x + L.width + 1e-6 || y < L.y - 1e-6 || y > L.y + L.height + 1e-6) continue;
    if (a.shape === 'ellipse') { const u = (x - (L.x + L.width / 2)) / (L.width / 2), v = (y - (L.y + L.height / 2)) / (L.height / 2); if (u * u + v * v > 1 + 1e-9) continue; }
    const s = L.width * L.height;
    if (s < ba - 1e-9 || (Math.abs(s - ba) <= 1e-9 && a.id < best.id)) { best = a; ba = s; }
  }
  return best;
}

/** Problems of the areas (sorted by id, then code): duplicate-id, unknown-kind, too-small, overlaps-room (not for plot kinds such as garden; ellipses are sampled). */
export function validateAreas(graph: any): { id: string; code: string; message: string }[] {
  const out: { id: string; code: string; message: string }[] = [], K = areaKinds(), list: any[] = graph.areas || [], seen: Record<string, number> = {};
  const add = (id: string, code: string, message: string) => out.push({ id, code, message });
  for (const a of list) {
    seen[a.id] = (seen[a.id] || 0) + 1;
    const k = K[a.kind], L = a.layout;
    if (!k) { add(a.id, 'unknown-kind', 'Unknown kind "' + a.kind + '".'); continue; }
    if (!L || !(L.width >= 0.5 - 1e-9) || !(L.height >= 0.5 - 1e-9)) { add(a.id, 'too-small', 'Smaller than 0.5 m.'); continue; }
    if (k.plot) continue;
    for (const r of graph.rooms || []) {
      const R = r.layout;
      if (!R || String(r.name).toLowerCase() === 'outside') continue;
      const x0 = Math.max(L.x, R.x), x1 = Math.min(L.x + L.width, R.x + R.width), y0 = Math.max(L.y, R.y), y1 = Math.min(L.y + L.height, R.y + R.height);
      if (x1 - x0 <= 1e-6 || y1 - y0 <= 1e-6) continue;
      let hit = a.shape !== 'ellipse';
      for (let i = 0; i < 10 && !hit; i++) for (let j = 0; j < 10 && !hit; j++) {
        const px = x0 + ((i + 0.5) * (x1 - x0)) / 10, py = y0 + ((j + 0.5) * (y1 - y0)) / 10, u = (px - (L.x + L.width / 2)) / (L.width / 2), v = (py - (L.y + L.height / 2)) / (L.height / 2);
        if (u * u + v * v <= 1) hit = true;
      }
      if (hit) { add(a.id, 'overlaps-room', 'Overlaps room "' + r.name + '".'); break; }
    }
  }
  for (const id of Object.keys(seen)) if (seen[id]! > 1) add(id, 'duplicate-id', 'Id used ' + seen[id] + ' times.');
  return out.sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : p.code < q.code ? -1 : p.code > q.code ? 1 : 0));
}

/** Copy with every area default written out (shape per kind, roofed false, positions rounded to 4 decimals). A graph without areas is returned unchanged (as a copy). */
export function fillAreaDefaults(graph: any): any {
  const g: any = JSON.parse(JSON.stringify(graph));
  if (!(g.areas || []).length) return g;
  const K = areaKinds(), rnd = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
  for (const a of g.areas) {
    const k = K[a.kind];
    if (k && !a.shape) a.shape = k.shape;
    if (!a.name && k) a.name = k.label;
    if (typeof a.roofed !== 'boolean') a.roofed = false;
    if (a.layout) for (const key of ['x', 'y', 'width', 'height']) a.layout[key] = rnd(a.layout[key]);
  }
  return g;
}
