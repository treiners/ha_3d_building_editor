export function deriveJoints(graph, opts = {}) {
    const EPS = 1e-6, TOUCH = opts.touch ?? 0.08, MARGIN = opts.margin ?? 0.1, ALIGN = opts.aligned ?? 0.2;
    const OPEN = { door: 0.9, 'open-passage': 1.2, window: 1.2 };
    const OPP = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    const rnd = (v) => Math.round(v * 1e4) / 1e4;
    const rooms = new Map(), ports = new Map();
    for (const r of graph.rooms) {
        rooms.set(r.id, r);
        for (const p of r.connectors)
            ports.set(p.id, p);
    }
    const override = new Map();
    for (const o of graph.joints ?? [])
        override.set(o.relationshipId, o.state);
    const joints = [];
    const summary = { total: 0, ok: 0, broken: 0, detached: 0, invalid: 0, unplaced: 0, narrow: 0 };
    for (const rel of graph.relationships) {
        const ca = ports.get(rel.connectorA), cb = ports.get(rel.connectorB);
        const state = override.get(rel.id) ?? 'attached';
        const base = {
            id: 'joint:' + rel.id, relationshipId: rel.id, roomA: ca?.roomId ?? '', roomB: cb?.roomId ?? '',
            sideA: ca?.side ?? '', sideB: cb?.side ?? '', connectorA: rel.connectorA, connectorB: rel.connectorB, state,
            gap: 0, overlap: null, axis: 'x', opening: 0, openingWidth: 0, openingAligned: false, touching: false, narrow: false,
            slide: null, movable: { a: false, b: false },
        };
        const add = (status, reasons, extra = {}) => {
            joints.push({ ...base, ...extra, status, reasons });
            summary.total++;
            summary[status]++;
            if (status === 'ok' && extra.narrow)
                summary.narrow++;
        };
        if (!ca || !cb) {
            add('invalid', ['unknown-connector']);
            continue;
        }
        if (ca.roomId === cb.roomId) {
            add('invalid', ['same-room']);
            continue;
        }
        if (OPP[ca.side] !== cb.side) {
            add('invalid', ['non-opposing-sides']);
            continue;
        }
        const A = rooms.get(ca.roomId)?.layout, B = rooms.get(cb.roomId)?.layout;
        if (!A || !B) {
            add('unplaced', ['missing-layout']);
            continue;
        }
        const sa = ca.side, horizontalWall = sa === 'top' || sa === 'bottom';
        // normal gap and tangent intervals of the two walls
        const gap = sa === 'right' ? B.x - (A.x + A.width) : sa === 'left' ? A.x - (B.x + B.width) : sa === 'bottom' ? B.y - (A.y + A.height) : A.y - (B.y + B.height);
        const a0 = horizontalWall ? A.x : A.y, a1 = a0 + (horizontalWall ? A.width : A.height);
        const b0 = horizontalWall ? B.x : B.y, b1 = b0 + (horizontalWall ? B.width : B.height);
        const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
        const overlap = hi > lo ? [rnd(lo), rnd(hi)] : null;
        const cw = (p) => (typeof p.width === 'number' && p.width > 0 ? p.width : OPEN[p.type] ?? 0.9), w = Math.max(cw(ca), cw(cb)), need = w + MARGIN;
        // connector position along its wall, clamped like the editor's norm()
        const hint = (p, len) => {
            const v = typeof p.offset === 'number' && Number.isFinite(p.offset) ? p.offset : (typeof p.position === 'number' ? p.position : 0.5) * len;
            return Math.max(0.05, Math.min(len - 0.05, v));
        };
        const pa = a0 + hint(ca, a1 - a0), pb = b0 + hint(cb, b1 - b0);
        // normal coordinate of each wall line: the editor compares the two connector POINTS (normal + tangent)
        const na = sa === 'right' ? A.x + A.width : sa === 'left' ? A.x : sa === 'bottom' ? A.y + A.height : A.y;
        const nb = sa === 'right' ? B.x : sa === 'left' ? B.x + B.width : sa === 'bottom' ? B.y : B.y + B.height;
        const aligned = Math.hypot(na - nb, pa - pb) <= ALIGN + EPS;
        const touching = Math.abs(gap) <= TOUCH + EPS && !!overlap;
        const narrow = touching && overlap[1] - overlap[0] < need - EPS;
        const reasons = [];
        if (!touching) {
            if (Math.abs(gap) > TOUCH + EPS)
                reasons.push('gap');
            if (!overlap)
                reasons.push('no-overlap');
        }
        else if (!aligned)
            reasons.push('misaligned');
        // slide range for room B along the wall, keeping the shared interval >= need
        let slide = null;
        if (touching && a1 - a0 >= need - EPS && b1 - b0 >= need - EPS) {
            const min = a0 + need - b1, max = a1 - need - b0;
            const half = w / 2; // opening stays where it is: its whole width must remain inside the shared interval
            const fmin = Math.max(min, pa + half - b1), fmax = Math.min(max, pa - half - b0);
            slide = { min: rnd(min), max: rnd(max), fixedOpening: fmin <= fmax ? { min: rnd(fmin), max: rnd(fmax) } : null };
        }
        const extra = {
            gap: rnd(gap), overlap, axis: horizontalWall ? 'x' : 'y', opening: rnd(pa), openingWidth: w,
            openingAligned: aligned, touching, narrow, slide, movable: { a: !(A.positionLocked ?? A.locked === true), b: !(B.positionLocked ?? B.locked === true) },
        };
        if (state === 'detached')
            add('detached', reasons, extra);
        else if (touching && aligned)
            add('ok', [], extra);
        else
            add('broken', reasons, extra);
    }
    return { joints, summary };
}
