import { mapLayout } from './mapper.js';
/** `locked` (old files) means both; the explicit flags win when present. positionLocked = top-left corner cannot move, sizeLocked = width/height cannot change. */
export const positionLocked = (l) => !!l && (l.positionLocked ?? l.locked === true);
export const sizeLocked = (l) => !!l && (l.sizeLocked ?? l.locked === true);
export const clean = (v) => Number(v.toFixed(4));
export const snap = (v, s = .2) => clean(Math.round(v / s) * s);
export const rect = (r) => r.layout ?? (r.layout = { x: 0, y: 0, width: r.sizeCategory === 'large' ? 6 : r.sizeCategory === 'small' ? 3 : 4, height: r.sizeCategory === 'large' ? 4 : r.sizeCategory === 'small' ? 2 : 3 });
export const wallLength = (r, s) => s === 'top' || s === 'bottom' ? rect(r).width : rect(r).height;
export function norm(r, p) { const L = wallLength(r, p.side); p.offset = clean(Math.max(.05, Math.min(L - .05, p.offset ?? (p.position ?? .5) * L))); p.position = clean(p.offset / L); }
export function migrate(raw) { const g = { ...raw, schemaVersion: '2.14', ...(Array.isArray(raw.joints) ? { joints: raw.joints.map((j) => ({ ...j })) } : {}), wallAlignments: (raw.wallAlignments ?? []).map((a) => ({ ...a, roomIds: [...(a.roomIds ?? [])] })), relationships: (raw.relationships ?? []).map((l) => ({ ...l })), rooms: (raw.rooms ?? []).map((r) => ({ ...r, connectors: (r.connectors ?? []).map((p) => ({ ...p })), layout: r.layout ? { ...r.layout, x: clean(+r.layout.x), y: clean(+r.layout.y), width: clean(+r.layout.width), height: clean(+r.layout.height) } : undefined })) }; g.rooms.forEach(r => { if (r.layout)
    r.connectors.forEach(p => norm(r, p)); }); return g; }
export function point(g, p) { const r = g.rooms.find(x => x.id === p.roomId); norm(r, p); const R = rect(r), o = p.offset; return p.side === 'top' ? { x: clean(R.x + o), y: R.y } : p.side === 'bottom' ? { x: clean(R.x + o), y: clean(R.y + R.height) } : p.side === 'left' ? { x: R.x, y: clean(R.y + o) } : { x: clean(R.x + R.width), y: clean(R.y + o) }; }
export function setWorld(g, p, P) { const r = g.rooms.find(x => x.id === p.roomId), R = rect(r), L = wallLength(r, p.side), v = p.side === 'top' || p.side === 'bottom' ? P.x - R.x : P.y - R.y; p.offset = clean(Math.max(.05, Math.min(L - .05, v))); p.position = clean(p.offset / L); }
export function touch(g, a, b, t = .08) { const A = rect(g.rooms.find(r => r.id === a.roomId)), B = rect(g.rooms.find(r => r.id === b.roomId)), oy = Math.max(A.y, B.y) < Math.min(A.y + A.height, B.y + B.height), ox = Math.max(A.x, B.x) < Math.min(A.x + A.width, B.x + B.width); return (a.side === 'right' && b.side === 'left' && Math.abs(A.x + A.width - B.x) <= t && oy) || (a.side === 'left' && b.side === 'right' && Math.abs(A.x - B.x - B.width) <= t && oy) || (a.side === 'bottom' && b.side === 'top' && Math.abs(A.y + A.height - B.y) <= t && ox) || (a.side === 'top' && b.side === 'bottom' && Math.abs(A.y - B.y - B.height) <= t && ox); }
export function aligned(g, l, t = .2) { const M = new Map(g.rooms.flatMap(r => r.connectors).map(p => [p.id, p])), a = M.get(l.connectorA), b = M.get(l.connectorB); if (!a || !b || !touch(g, a, b))
    return false; const A = point(g, a), B = point(g, b); return Math.hypot(A.x - B.x, A.y - B.y) <= t; }
export function alignPair(g, l) { const M = new Map(g.rooms.flatMap(r => r.connectors).map(p => [p.id, p])), a = M.get(l.connectorA), b = M.get(l.connectorB); if (!a || !b || !touch(g, a, b, .5))
    return false; const A = point(g, a), B = point(g, b), P = a.side === 'top' || a.side === 'bottom' ? { x: clean((A.x + B.x) / 2), y: A.y } : { x: A.x, y: clean((A.y + B.y) / 2) }; setWorld(g, a, P); setWorld(g, b, P); return true; }
export function alignmentAxis(a) { return a.side === 'top' || a.side === 'bottom' ? 'y' : 'x'; }
export function moveAlignmentGroup(g, a, delta) { for (const id of a.roomIds) {
    const r = g.rooms.find(x => x.id === id);
    if (!r || positionLocked(rect(r)))
        continue;
    if (alignmentAxis(a) === 'y')
        rect(r).y = clean(rect(r).y + delta);
    else
        rect(r).x = clean(rect(r).x + delta);
} g.relationships.forEach(l => alignPair(g, l)); }
const overlap = (a, b, p = .05) => a.x < b.x + b.width + p && a.x + a.width + p > b.x && a.y < b.y + b.height + p && a.y + a.height + p > b.y;
function layoutArea(g) { if (!g.rooms.length)
    return 0; const minX = Math.min(...g.rooms.map(r => rect(r).x)), minY = Math.min(...g.rooms.map(r => rect(r).y)), maxX = Math.max(...g.rooms.map(r => rect(r).x + rect(r).width)), maxY = Math.max(...g.rooms.map(r => rect(r).y + rect(r).height)); return clean((maxX - minX) * (maxY - minY)); }
export function metrics(g) { let O = 0; for (let i = 0; i < g.rooms.length; i++)
    for (let j = i + 1; j < g.rooms.length; j++)
        if (overlap(rect(g.rooms[i]), rect(g.rooms[j]), 0))
            O++; const S = g.relationships.filter(l => aligned(g, l)).length; return { overlaps: O, satisfied: S, open: g.relationships.length - S, area: layoutArea(g) }; }
function cloneLayouts(g) { return new Map(g.rooms.map(r => [r.id, { ...rect(r) }])); }
function restoreLayouts(g, m) { for (const r of g.rooms) {
    const x = m.get(r.id);
    if (x)
        r.layout = { ...x };
} }
/** Apply a mapper result: layouts for the rooms the mapper placed, plus shared opening offsets (green connectors). */
function applyMap(g, res, ids) {
    const P = new Map(g.rooms.flatMap(r => r.connectors).map(p => [p.id, p]));
    for (const r of g.rooms) {
        if (!ids.has(r.id))
            continue;
        const L = res.layouts[r.id];
        r.layout = { ...L, x: clean(L.x), y: clean(L.y), width: clean(L.width), height: clean(L.height) };
        r.connectors.forEach(p => norm(r, p));
    }
    for (const o of res.openings) {
        const a = P.get(o.connectorA), b = P.get(o.connectorB);
        if (!a || !b || (!ids.has(a.roomId) && !ids.has(b.roomId)))
            continue;
        for (const [p, off] of [[a, o.offsetA], [b, o.offsetB]]) {
            const r = g.rooms.find(x => x.id === p.roomId);
            norm(r, p);
            p.offset = clean(Math.max(.05, Math.min(wallLength(r, p.side) - .05, off)));
            p.position = clean(p.offset / wallLength(r, p.side));
        }
    }
}
/** Load path: keep every supplied layout, place only the rooms that have none. */
export function mapOnlyMissing(g) {
    const missing = new Set(g.rooms.filter(r => !r.layout).map(r => r.id));
    if (!missing.size)
        return;
    applyMap(g, mapLayout(g, { moveOnly: [...missing] }), missing);
}
/** Explicit "Run mapper": locked rooms stay, every other room is re-placed (its size is kept). */
export function runMapper(g) {
    const before = cloneLayouts(g), free = new Set(g.rooms.filter(r => !positionLocked(rect(r))).map(r => r.id));
    applyMap(g, mapLayout(g, { moveOnly: [...free] }), free);
    const moved = g.rooms.filter(r => { const a = before.get(r.id), b = rect(r); return a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height; }).map(r => r.id);
    return { metrics: metrics(g), movedRooms: moved };
}
export function validateGraph(raw) { const e = []; if (!raw || typeof raw !== 'object')
    e.push('The JSON root must be an object.'); if (!Array.isArray(raw?.rooms))
    e.push('The graph must contain a rooms array.'); if (!Array.isArray(raw?.relationships))
    e.push('The graph must contain a relationships array.'); return e; }
