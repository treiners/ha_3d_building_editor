/**
 * Initial mapper (v2.15 draft): graph without coordinates -> non-overlapping, topologically sensible layout.
 *
 * Design constraints
 *  - Pure + deterministic (no DOM, no Math.random, no Date). Same input => same output, whatever the input order.
 *  - ONE self-contained function with no imports and no outer-scope references, so `mapLayout.toString()`
 *    can be embedded into the generated editor HTML (see editor.ts) and the exact same code runs in Node tests.
 *  - Never touches rooms that are not allowed to move (locked, or not listed in `moveOnly`).
 *
 * Coordinates: metres, x right, y DOWN. Wall offsets start at the left edge (top/bottom walls) or the top edge (left/right).
 */
export type MapSide = 'top' | 'right' | 'bottom' | 'left';
export interface MapPort { id: string; roomId: string; side: MapSide; type: string; position?: number; offset?: number; width?: number }
export interface MapLayout { x: number; y: number; width: number; height: number; locked?: boolean; positionLocked?: boolean; sizeLocked?: boolean }
export interface MapRoom { id: string; sizeCategory: 'small' | 'medium' | 'large'; connectors: MapPort[]; layout?: Partial<MapLayout> }
export interface MapLink { id: string; connectorA: string; connectorB: string; importance: string }
export interface MapOptions {
  /** ids of rooms the mapper may place/move. Default: every room that has no x/y yet. Locked rooms never move. */
  moveOnly?: string[];
  gridStep?: number;
  sizes?: Record<'small' | 'medium' | 'large', [number, number]>;
}
export interface MapIssue { code: string; severity: 'error' | 'warning'; message: string; ids: string[] }
export interface MapOpening { relationshipId: string; connectorA: string; offsetA: number; connectorB: string; offsetB: number }
export interface MapResult {
  layouts: Record<string, MapLayout>;   // every room (fixed rooms are returned unchanged)
  placed: string[];                     // ids that were placed/moved by the mapper
  openings: MapOpening[];               // satisfied relationships with a shared opening point (metre offsets)
  issues: MapIssue[];
  metrics: { overlaps: number; satisfied: number; open: number; area: number };
}

export function mapLayout(graph: { rooms: MapRoom[]; relationships: MapLink[] }, opts: MapOptions = {}): MapResult {
  const g = opts.gridStep ?? 0.2;
  const SIZES = opts.sizes ?? { small: [3, 2], medium: [4, 3], large: [6, 4] };
  const OPEN: Record<string, number> = { door: 0.9, 'open-passage': 1.2, window: 1.2 };
  const cw = (p: MapPort) => (typeof p.width === 'number' && p.width > 0 ? p.width : OPEN[p.type] ?? 0.9);
  const TOUCH = 0.011;
  const OPP: Record<string, string> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const hz = (s: string) => s === 'top' || s === 'bottom';
  const snap = (v: number) => Math.round(v / g) * g;
  const rnd = (v: number) => Math.round(v * 1e4) / 1e4;
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  interface Box { id: string; x: number; y: number; w: number; h: number; fixed: boolean; had: boolean }
  interface Edge { rel: MapLink; a: string; b: string; sa: string; ca: MapPort; cb: MapPort; ha: number; hb: number; open: number; wt: number }
  const issues: MapIssue[] = [];

  // 1. normalise ───────────────────────────────────────────────
  const rooms = [...graph.rooms].sort(byId);
  const only = opts.moveOnly ? new Set(opts.moveOnly) : null;
  const boxes = new Map<string, Box>();
  const ports = new Map<string, MapPort>();
  for (const r of rooms) {
    const L = r.layout ?? {};
    const sz = SIZES[r.sizeCategory] ?? SIZES.medium;
    const hasXY = typeof L.x === 'number' && typeof L.y === 'number' && Number.isFinite(L.x) && Number.isFinite(L.y);
    const movable = (only ? only.has(r.id) : !hasXY) && !(L.positionLocked ?? L.locked === true); // only a position lock pins a room; sizes are never changed
    const w = typeof L.width === 'number' && L.width > 0 ? L.width : sz[0];
    const h = typeof L.height === 'number' && L.height > 0 ? L.height : sz[1];
    boxes.set(r.id, { id: r.id, x: hasXY ? (L.x as number) : 0, y: hasXY ? (L.y as number) : 0, w, h, fixed: !movable, had: hasXY });
    for (const p of r.connectors) ports.set(p.id, p);
  }
  const wlen = (b: Box, s: string) => (hz(s) ? b.w : b.h);
  const hint = (p: MapPort, b: Box) => (typeof p.offset === 'number' && Number.isFinite(p.offset) ? p.offset : (typeof p.position === 'number' ? p.position : 0.5) * wlen(b, p.side));

  const edges: Edge[] = [];
  for (const rel of graph.relationships) {
    const ca = ports.get(rel.connectorA), cb = ports.get(rel.connectorB);
    if (!ca || !cb) { issues.push({ code: 'missing-connector', severity: 'error', message: 'Relationship ' + rel.id + ' references an unknown connector', ids: [rel.id] }); continue; }
    if (ca.roomId === cb.roomId) { issues.push({ code: 'same-room', severity: 'error', message: 'Relationship ' + rel.id + ' links a room to itself', ids: [rel.id] }); continue; }
    if (OPP[ca.side] !== cb.side) { issues.push({ code: 'non-opposing-sides', severity: 'warning', message: 'Relationship ' + rel.id + ': ' + ca.side + ' / ' + cb.side + ' cannot share a wall; ignored for placement', ids: [rel.id] }); continue; }
    if (ca.type === 'window' || cb.type === 'window') { issues.push({ code: 'window-relationship', severity: 'warning', message: 'Relationship ' + rel.id + ' involves a window; ignored for placement', ids: [rel.id] }); continue; }
    const A = boxes.get(ca.roomId)!, B = boxes.get(cb.roomId)!;
    edges.push({ rel, a: A.id, b: B.id, sa: ca.side, ca, cb, ha: hint(ca, A), hb: hint(cb, B),
      open: Math.max(cw(ca), cw(cb)), wt: rel.importance === 'required' ? 1 : 0.4 });
  }
  edges.sort((p, q) => (p.rel.id < q.rel.id ? -1 : p.rel.id > q.rel.id ? 1 : 0));
  const adj = new Map<string, Edge[]>();
  for (const r of rooms) adj.set(r.id, []);
  for (const e of edges) { adj.get(e.a)!.push(e); adj.get(e.b)!.push(e); }
  const degree = (id: string) => adj.get(id)!.reduce((s, e) => s + e.wt, 0);

  // geometry helpers ───────────────────────────────────────────
  const ovl = (p: Box, q: Box) => {
    const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
    return { ox, oy, hit: ox > 1e-6 && oy > 1e-6 };
  };
  const shared = (A: Box, B: Box, sa: string): [number, number] | null => {
    let gap: number, lo: number, hi: number;
    if (sa === 'right') { gap = B.x - (A.x + A.w); lo = Math.max(A.y, B.y); hi = Math.min(A.y + A.h, B.y + B.h); }
    else if (sa === 'left') { gap = A.x - (B.x + B.w); lo = Math.max(A.y, B.y); hi = Math.min(A.y + A.h, B.y + B.h); }
    else if (sa === 'bottom') { gap = B.y - (A.y + A.h); lo = Math.max(A.x, B.x); hi = Math.min(A.x + A.w, B.x + B.w); }
    else { gap = A.y - (B.y + B.h); lo = Math.max(A.x, B.x); hi = Math.min(A.x + A.w, B.x + B.w); }
    return Math.abs(gap) <= TOUCH && hi > lo ? [lo, hi] : null;
  };
  /** position of the room `target` of edge e so it touches `from` with connector hints aligned */
  const ideal = (e: Edge, from: Box, target: Box, fromIsA: boolean) => {
    if (fromIsA) {
      const hf = e.ha, ht = e.hb;
      if (e.sa === 'right') return { x: from.x + from.w, y: from.y + hf - ht };
      if (e.sa === 'left') return { x: from.x - target.w, y: from.y + hf - ht };
      if (e.sa === 'bottom') return { x: from.x + hf - ht, y: from.y + from.h };
      return { x: from.x + hf - ht, y: from.y - target.h };
    }
    const hf = e.hb, ht = e.ha; // from is B, target is A; B lies on side sa of A
    if (e.sa === 'right') return { x: from.x - target.w, y: from.y + hf - ht };
    if (e.sa === 'left') return { x: from.x + from.w, y: from.y + hf - ht };
    if (e.sa === 'bottom') return { x: from.x + hf - ht, y: from.y - target.h };
    return { x: from.x + hf - ht, y: from.y + from.h };
  };

  // 2. seed: BFS spanning tree per connected component ───────────
  const comps: string[][] = [];
  { const seen = new Set<string>();
    for (const r of rooms) {
      if (seen.has(r.id)) continue;
      const comp: string[] = [], q = [r.id]; seen.add(r.id);
      while (q.length) { const id = q.shift()!; comp.push(id);
        for (const e of adj.get(id)!) { const o = e.a === id ? e.b : e.a; if (!seen.has(o)) { seen.add(o); q.push(o); } } }
      comps.push(comp);
    } }
  let cursorX = 0;
  // components that already contain fixed rooms are laid out first, so free components go to the right of them
  comps.sort((p, q) => Number(q.some(i => boxes.get(i)!.fixed && boxes.get(i)!.had)) - Number(p.some(i => boxes.get(i)!.fixed && boxes.get(i)!.had)));
  for (const comp of comps) {
    const hasFixed = comp.some(id => boxes.get(id)!.fixed && boxes.get(id)!.had);
    const order = [...comp].sort((p, q) =>
      Number(boxes.get(q)!.fixed && boxes.get(q)!.had) - Number(boxes.get(p)!.fixed && boxes.get(p)!.had) || degree(q) - degree(p) || (p < q ? -1 : 1));
    const placed = new Set<string>();
    const queue: string[] = [];
    if (hasFixed) { for (const id of order) if (boxes.get(id)!.fixed && boxes.get(id)!.had) { placed.add(id); queue.push(id); } }
    else { const a = boxes.get(order[0])!; a.x = snap(cursorX); a.y = 0; placed.add(a.id); queue.push(a.id); }
    while (queue.length) {
      const id = queue.shift()!, P = boxes.get(id)!;
      const out = [...adj.get(id)!].sort((p, q) => q.wt - p.wt || (p.rel.id < q.rel.id ? -1 : 1));
      for (const e of out) {
        const oid = e.a === id ? e.b : e.a;
        if (placed.has(oid)) continue;
        const C = boxes.get(oid)!;
        if (!C.fixed) { const pos = ideal(e, P, C, e.a === id); C.x = snap(pos.x); C.y = snap(pos.y); }
        placed.add(oid); queue.push(oid);
      }
    }
    const free = comp.map(id => boxes.get(id)!).filter(b => !b.fixed);
    const mem = comp.map(id => boxes.get(id)!);
    if (!hasFixed) {
      const dx = snap(cursorX - Math.min(...mem.map(b => b.x)));
      for (const b of mem) b.x += dx;
    } else {
      // free rooms unreachable from fixed ones (no edge path) still need a spot: park to the right
      for (const b of free) if (!placed.has(b.id)) { b.x = snap(cursorX); b.y = 0; }
    }
    cursorX = Math.max(cursorX, ...mem.map(b => b.x + b.w)) + 1;
  }

  // 3. relax: springs + overlap projection ───────────────────────
  const all = [...boxes.values()].sort(byId);
  const free = all.filter(b => !b.fixed);
  const nudge = (b: Box, dx: number, dy: number) => { if (!b.fixed) { b.x += dx; b.y += dy; } };
  for (let it = 0; it < 300; it++) {
    for (const e of edges) {
      const A = boxes.get(e.a)!, B = boxes.get(e.b)!;
      let gap: number, tang: number;
      if (e.sa === 'right') { gap = B.x - (A.x + A.w); tang = B.y + e.hb - (A.y + e.ha); }
      else if (e.sa === 'left') { gap = B.x + B.w - A.x; tang = B.y + e.hb - (A.y + e.ha); }
      else if (e.sa === 'bottom') { gap = B.y - (A.y + A.h); tang = B.x + e.hb - (A.x + e.ha); }
      else { gap = B.y + B.h - A.y; tang = B.x + e.hb - (A.x + e.ha); }
      const lo = hz(e.sa) ? Math.max(A.x, B.x) : Math.max(A.y, B.y), hi = hz(e.sa) ? Math.min(A.x + A.w, B.x + B.w) : Math.min(A.y + A.h, B.y + B.h);
      const tw = hi - lo >= e.open + 0.2 ? 0.08 : 0.6;
      const dN = -gap * 0.5 * e.wt, dT = -tang * 0.5 * tw * e.wt;
      const fa = A.fixed ? 0 : 1, fb = B.fixed ? 0 : 1, tot = fa + fb || 1;
      if (hz(e.sa)) { nudge(B, dT * fb / tot, dN * fb / tot); nudge(A, -dT * fa / tot, -dN * fa / tot); }
      else { nudge(B, dN * fb / tot, dT * fb / tot); nudge(A, -dN * fa / tot, -dT * fa / tot); }
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const p = all[i], q = all[j], d = ovl(p, q);
      if (!d.hit) continue;
      const fp = p.fixed ? 0 : 1, fq = q.fixed ? 0 : 1, tot = fp + fq;
      if (!tot) continue;
      const sx = p.x + p.w / 2 <= q.x + q.w / 2 ? -1 : 1, sy = p.y + p.h / 2 <= q.y + q.h / 2 ? -1 : 1;
      if (d.ox <= d.oy) { const m = d.ox * 0.55; nudge(p, sx * m * fp / tot, 0); nudge(q, -sx * m * fq / tot, 0); }
      else { const m = d.oy * 0.55; nudge(p, 0, sy * m * fp / tot); nudge(q, 0, -sy * m * fq / tot); }
    }
  }
  for (const b of free) { b.x = snap(b.x); b.y = snap(b.y); }

  // 4. legalise: deterministic coordinate descent ────────────────
  const score = () => {
    let s = 0;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const d = ovl(all[i], all[j]); if (d.hit) s += 1000 + 400 * d.ox * d.oy; }
    for (const e of edges) {
      const A = boxes.get(e.a)!, B = boxes.get(e.b)!, iv = shared(A, B, e.sa);
      if (iv && iv[1] - iv[0] >= e.open) {
        const wa = (hz(e.sa) ? A.x : A.y) + e.ha, wb = (hz(e.sa) ? B.x : B.y) + e.hb;
        s += 0.3 * e.wt * Math.min(Math.abs(wa - wb), 3);
      } else {
        const gapN = e.sa === 'right' ? Math.abs(B.x - (A.x + A.w)) : e.sa === 'left' ? Math.abs(A.x - (B.x + B.w)) : e.sa === 'bottom' ? Math.abs(B.y - (A.y + A.h)) : Math.abs(A.y - (B.y + B.h));
        const cx = B.x + B.w / 2 - (A.x + A.w / 2), cy = B.y + B.h / 2 - (A.y + A.h / 2);
        const wrong = e.sa === 'right' ? cx < 0 : e.sa === 'left' ? cx > 0 : e.sa === 'bottom' ? cy < 0 : cy > 0;
        s += e.wt * (60 + 25 * gapN + (wrong ? 80 : 0));
      }
    }
    const minX = Math.min(...all.map(b => b.x)), maxX = Math.max(...all.map(b => b.x + b.w)), minY = Math.min(...all.map(b => b.y)), maxY = Math.max(...all.map(b => b.y + b.h));
    return s + 0.015 * (maxX - minX) * (maxY - minY) + 0.05 * Math.abs(maxX - minX - (maxY - minY));
  };
  const steps = [1, 2, 3, 5, 8].map(n => n * g);
  let best = score();
  for (let pass = 0; pass < 40; pass++) {
    let improved = false;
    for (const b of free) for (const stp of steps) for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ox = b.x, oy = b.y; b.x = rnd(ox + d[0] * stp); b.y = rnd(oy + d[1] * stp);
      const s = score();
      if (s < best - 1e-9) { best = s; improved = true; } else { b.x = ox; b.y = oy; }
    }
    if (!improved) break;
  }

  // 5. report ──────────────────────────────────────────────────
  const layouts: Record<string, MapLayout> = {};
  for (const r of rooms) { const b = boxes.get(r.id)!; layouts[r.id] = b.fixed && b.had ? { ...(r.layout as MapLayout) } : { x: rnd(b.x), y: rnd(b.y), width: rnd(b.w), height: rnd(b.h) }; if (!b.fixed && r.layout) { const out = layouts[r.id]!; if (r.layout.locked !== undefined) out.locked = r.layout.locked; if (r.layout.positionLocked !== undefined) out.positionLocked = r.layout.positionLocked; if (r.layout.sizeLocked !== undefined) out.sizeLocked = r.layout.sizeLocked; } }
  const openings: MapOpening[] = [];
  let sat = 0, open = 0;
  for (const e of edges) {
    const A = boxes.get(e.a)!, B = boxes.get(e.b)!, iv = shared(A, B, e.sa);
    if (!iv || iv[1] - iv[0] < e.open) {
      open++;
      issues.push({ code: 'unresolved-relationship', severity: e.wt === 1 ? 'error' : 'warning', message: e.a + ' (' + e.sa + ') / ' + e.b + ' is not geometrically satisfied', ids: [e.rel.id] });
      continue;
    }
    sat++;
    const wa = (hz(e.sa) ? A.x : A.y) + e.ha, wb = (hz(e.sa) ? B.x : B.y) + e.hb, half = e.open / 2;
    const world = Math.min(Math.max((wa + wb) / 2, iv[0] + half), iv[1] - half);
    openings.push({ relationshipId: e.rel.id, connectorA: e.ca.id, offsetA: rnd(world - (hz(e.sa) ? A.x : A.y)), connectorB: e.cb.id, offsetB: rnd(world - (hz(e.sa) ? B.x : B.y)) });
  }
  let overlaps = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (ovl(all[i], all[j]).hit) { overlaps++; issues.push({ code: 'overlap', severity: 'error', message: all[i].id + ' overlaps ' + all[j].id, ids: [all[i].id, all[j].id] }); }
  const minX = Math.min(...all.map(b => b.x)), maxX = Math.max(...all.map(b => b.x + b.w)), minY = Math.min(...all.map(b => b.y)), maxY = Math.max(...all.map(b => b.y + b.h));
  return { layouts, placed: free.map(b => b.id), openings, issues, metrics: { overlaps, satisfied: sat, open, area: all.length ? rnd((maxX - minX) * (maxY - minY)) : 0 } };
}
