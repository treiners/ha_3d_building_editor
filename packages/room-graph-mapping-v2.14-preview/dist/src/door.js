/**
 * Plan symbol of a hinged door on wall `side` of its room: opening centre P, opening width w.
 * Seen from INSIDE the room facing the wall, "left" hinge = left hand side. H hinge point, J free jamb (closed leaf end),
 * E leaf end at `openAngle` degrees, swinging into the room (inward) or away from it (outward). Coordinates y down.
 * Pure, self-contained (embedded into the editor with toString).
 */
export function doorGeometry(side, P, w, spec) {
    const r = (v) => Math.round(v * 1e4) / 1e4 + 0;
    const hl = side === 'top' ? [-1, 0] : side === 'bottom' ? [1, 0] : side === 'left' ? [0, 1] : [0, -1];
    const n = side === 'top' ? [0, 1] : side === 'bottom' ? [0, -1] : side === 'left' ? [1, 0] : [-1, 0];
    const s = spec.hinge === 'right' ? -1 : 1, d = [hl[0] * s, hl[1] * s], q = spec.swing === 'outward' ? -1 : 1, m = [n[0] * q, n[1] * q];
    const a = (Math.max(10, Math.min(180, spec.openAngle)) * Math.PI) / 180;
    const H = { x: P.x + d[0] * w / 2, y: P.y + d[1] * w / 2 };
    const J = { x: H.x - d[0] * w, y: H.y - d[1] * w };
    const E = { x: H.x - d[0] * w * Math.cos(a) + m[0] * w * Math.sin(a), y: H.y - d[1] * w * Math.cos(a) + m[1] * w * Math.sin(a) };
    const cross = (J.x - H.x) * (E.y - H.y) - (J.y - H.y) * (E.x - H.x), sweep = cross > 0 ? 1 : 0;
    const f = (v) => String(r(v));
    return { H: { x: r(H.x), y: r(H.y) }, J: { x: r(J.x), y: r(J.y) }, E: { x: r(E.x), y: r(E.y) },
        path: 'M' + f(H.x) + ' ' + f(H.y) + 'L' + f(J.x) + ' ' + f(J.y) + 'A' + f(w) + ' ' + f(w) + ' 0 0 ' + sweep + ' ' + f(E.x) + ' ' + f(E.y) + 'Z',
        leaf: f(H.x) + ' ' + f(H.y) + ' ' + f(E.x) + ' ' + f(E.y) };
}
/** Open angle (degrees, 10..180, rounded to 5) for a pointer at Q while dragging the leaf end. */
export function doorAngle(side, P, w, spec, Q) {
    const g = doorGeometry(side, P, w, { hinge: spec.hinge, swing: spec.swing, openAngle: 90 });
    const ex = (g.J.x - g.H.x) / w, ey = (g.J.y - g.H.y) / w, nx = (g.E.x - g.H.x) / w, ny = (g.E.y - g.H.y) / w;
    const vx = Q.x - g.H.x, vy = Q.y - g.H.y, along = vx * ex + vy * ey, across = vx * nx + vy * ny;
    const deg = (Math.atan2(across, along) * 180) / Math.PI;
    return Math.max(10, Math.min(180, Math.round(deg / 5) * 5));
}
/** The same physical door seen from the room on the other side of the wall. */
export function mirrorDoor(spec) {
    return { hinge: spec.hinge === 'left' ? 'right' : 'left', swing: spec.swing === 'inward' ? 'outward' : 'inward', openAngle: spec.openAngle };
}
