/**
 * Moves the whole plan so that the top-left corner of the house is (0, 0): the minimum x / y of all rooms except `Outside` becomes 0.
 * Applied when saving, never while editing (the user never sees coordinates). Rooms (incl. `Outside`), outside areas and, when
 * `entitySettings.coordinates` is "plan", entity positions are shifted together; everything else is room-relative and unchanged.
 * Pure: returns a new graph, a plan already at the origin comes back unchanged (idempotent). Embedded in the editor HTML with toString().
 */
export function shiftOrigin(graph: any): any {
  const g: any = JSON.parse(JSON.stringify(graph)), rnd = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  const vis = (g.rooms || []).filter((r: any) => r.layout && String(r.name).toLowerCase() !== 'outside');
  if (!vis.length) return g;
  const dx = Math.min(...vis.map((r: any) => r.layout.x)), dy = Math.min(...vis.map((r: any) => r.layout.y));
  if (!dx && !dy) return g;
  for (const r of g.rooms) if (r.layout) { r.layout.x = rnd(r.layout.x - dx); r.layout.y = rnd(r.layout.y - dy); }
  for (const a of g.areas || []) if (a.layout) { a.layout.x = rnd(a.layout.x - dx); a.layout.y = rnd(a.layout.y - dy); }
  for (const s of g.stairs || []) { s.x = rnd(s.x - dx); s.y = rnd(s.y - dy); }
  if (g.entitySettings && g.entitySettings.coordinates === 'plan') for (const e of g.entityPlacements || []) if (Array.isArray(e.position)) e.position = [rnd(e.position[0] - dx), rnd(e.position[1] - dy)];
  return g;
}
