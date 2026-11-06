import type { FloorplanGraph } from './schema.js';
import type { Port } from './core.js';
import { outlineNormalize, outlineIssues, outlineBounds } from './shape.js';

/**
 * Copy of a graph with every default written out, for saving: building defaults, the width of every connector
 * (default by type), the door spec of every hinged door (left / inward / 85 degrees, `tilt` kept; the partner connector of a pair is
 * the mirror image; sliding and pocket doors get only `door.slide` (start | end, default start; no hinge / swing / angle)) and the window spec of every window (hinged and tilt-turn windows
 * get `hinge` (left) and `swing` (inward), sliding left / right windows get `slide` (start)). Values that are already set are kept. The input is not changed.
 * Room outlines (v2.18) are written in canonical form; a plain rectangle drops its outline.
 * Pure (embedded into the editor with toString); siblings: outlineNormalize, outlineIssues, outlineBounds.
 */
export function fillDefaults(graph: any): any {
  const E: FloorplanGraph = JSON.parse(JSON.stringify(graph));
  E.buildingDefaults = { wallThickness: 0.16, wallHeight: 2.4, floorThickness: 0.12, ...(E.buildingDefaults || {}) };
  for (const r of E.rooms) {
    if (!r.outline) continue;
    const n = outlineNormalize(r.outline);
    if (outlineIssues(n).length) { r.outline = n; continue; }
    const b = outlineBounds(n), L = r.layout;
    if (n.length === 4 && L && Math.abs(b.x) < 1e-6 && Math.abs(b.y) < 1e-6 && Math.abs(b.width - L.width) < 1e-6 && Math.abs(b.height - L.height) < 1e-6) delete r.outline; else r.outline = n;
  }
  const ports: Port[] = E.rooms.flatMap((r) => r.connectors || []);
  const DEF: Record<string, number> = { door: 0.9, 'open-passage': 1.2, window: 1.2 };
  const hinged = (c: Port) => c.type === 'door' && (!c.doorType || String(c.doorType).indexOf('hinged') === 0);
  const spec = (c: Port) => {
    const d = c.door || {};
    return { hinge: d.hinge === 'right' || (!d.hinge && c.doorType === 'hinged-right') ? 'right' : 'left', swing: d.swing === 'outward' ? 'outward' : 'inward', openAngle: d.openAngle > 0 ? d.openAngle : 85, ...(d.tilt ? { tilt: true } : {}) };
  };
  const mirror = (s: ReturnType<typeof spec>) => ({ hinge: s.hinge === 'left' ? 'right' : 'left', swing: s.swing === 'inward' ? 'outward' : 'inward', openAngle: s.openAngle, ...(s.tilt ? { tilt: true } : {}) });
  for (const l of E.relationships || []) {
    const a = ports.find(c => c.id === l.connectorA), b = ports.find(c => c.id === l.connectorB);
    if (a && b && hinged(a) && hinged(b)) { const s = a.door ? spec(a) : b.door ? mirror(spec(b)) : spec(a); a.door = s; b.door = mirror(s); }
  }
  for (const c of ports) {
    c.width = c.width! > 0 ? c.width : DEF[c.type] ?? 0.9;
    if (hinged(c)) c.door = spec(c);
    else if (c.type === 'door' && !hinged(c)) c.door = { slide: c.door && c.door.slide === 'end' ? 'end' : 'start' };
    if (c.type === 'window') {
      const w = { type: 'fixed', sillHeight: 0.8, headHeight: 2.1, frameDepth: 0.08, ...(c.window || {}) } as { type: string; hinge?: string; swing?: string; slide?: string };
      if (w.type === 'hinged' || w.type === 'tilt-turn') { w.hinge = w.hinge === 'right' ? 'right' : 'left'; w.swing = w.swing === 'outward' ? 'outward' : 'inward'; }
      else if (w.type === 'slide-horizontal') w.slide = w.slide === 'end' ? 'end' : 'start';
      c.window = w;
    }
  }
  return E;
}
