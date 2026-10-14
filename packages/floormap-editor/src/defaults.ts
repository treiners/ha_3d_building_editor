/**
 * Copy of a graph with every default written out, for saving: building defaults, the width of every connector
 * (default by type), the door spec of every hinged door (left / inward / 85 degrees; the partner connector of a pair is
 * the mirror image) and the window spec of every window. Values that are already set are kept. The input is not changed.
 * Pure, self-contained (embedded into the editor with toString).
 */
export function fillDefaults(graph: any): any {
  const E: any = JSON.parse(JSON.stringify(graph));
  E.buildingDefaults = { wallThickness: 0.16, wallHeight: 2.4, floorThickness: 0.12, ...(E.buildingDefaults || {}) };
  const ports: any[] = E.rooms.flatMap((r: any) => r.connectors || []);
  const DEF: any = { door: 0.9, 'open-passage': 1.2, window: 1.2 };
  const hinged = (c: any) => c.type === 'door' && (!c.doorType || String(c.doorType).indexOf('hinged') === 0);
  const spec = (c: any) => {
    const d = c.door || {};
    return { hinge: d.hinge === 'right' || (!d.hinge && c.doorType === 'hinged-right') ? 'right' : 'left', swing: d.swing === 'outward' ? 'outward' : 'inward', openAngle: d.openAngle > 0 ? d.openAngle : 85 };
  };
  const mirror = (s: any) => ({ hinge: s.hinge === 'left' ? 'right' : 'left', swing: s.swing === 'inward' ? 'outward' : 'inward', openAngle: s.openAngle });
  for (const l of E.relationships || []) {
    const a = ports.find(c => c.id === l.connectorA), b = ports.find(c => c.id === l.connectorB);
    if (a && b && hinged(a) && hinged(b)) { const s = a.door ? spec(a) : b.door ? mirror(spec(b)) : spec(a); a.door = s; b.door = mirror(s); }
  }
  for (const c of ports) {
    c.width = c.width > 0 ? c.width : DEF[c.type] ?? 0.9;
    if (hinged(c) && !c.door) c.door = spec(c);
    if (c.type === 'window') c.window = { type: 'fixed', sillHeight: 0.8, headHeight: 2.1, frameDepth: 0.08, ...(c.window || {}) };
  }
  return E;
}
