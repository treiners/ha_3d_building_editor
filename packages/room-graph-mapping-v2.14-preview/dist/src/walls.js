/**
 * Wall dragging with auto-resize (Phase 2). Pure + deterministic.
 *
 * Dragging a wall of room R along its normal moves that wall; everything that is attached to it follows:
 *  - the room on the other side of an attached wall changes size (its facing wall moves with it),
 *  - a room that reaches its minimum size is pushed along, and so on down the chain ("squeeze, then push"),
 *  - rooms that are not attached are never pushed: they block (when noOverlap is on).
 * Hard stops: a room whose position is locked (its top-left corner is fixed, so only its right/bottom walls can move),
 * a size-locked room can only be translated as a whole, maximum sizes, doors/passages that would be cut off, and
 * walls running along the dragged direction that would lose their shared part.
 *
 * Model (per axis a, the axis of the drag): every room has two variables lo_i / hi_i (its walls on that axis).
 * All rules are difference constraints  v_j - v_i >= c.  A constraint that is violated is repaired by pushing v_j
 * UP (the drag direction; a drag in the negative direction is solved on mirrored coordinates). Pushing a locked
 * variable, or violating a hard constraint, makes that drag distance infeasible. The drag is swept in grid steps from
 * zero and stops at the last feasible step, so the result is exact (no scaling back) and never tunnels.
 *
 * `planWall` calls `deriveJoints` (embedded next to it in the editor HTML, imported in Node).
 */
import { deriveJoints } from './joints.js';
export function planWall(input) {
    const { graph, joints, roomId, side } = input;
    const step = input.step > 0 ? input.step : 0.2, EPS = 1e-6;
    const SIZES = input.sizes ?? { small: [3, 2], medium: [4, 3], large: [6, 4] };
    const noOverlap = input.noOverlap !== false;
    const ign = new Set(input.ignoreIds ?? []);
    const rnd = (v) => Math.round(v * 1e4) / 1e4 + 0; // + 0 turns -0 into 0
    const axis = side === 'left' || side === 'right' ? 'x' : 'y';
    const rooms = graph.rooms.filter(r => r.layout);
    const L = new Map(rooms.map(r => [r.id, r.layout]));
    const cat = new Map(rooms.map(r => [r.id, r.sizeCategory]));
    const lo0 = (id) => (axis === 'x' ? L.get(id).x : L.get(id).y);
    const hi0 = (id) => lo0(id) + (axis === 'x' ? L.get(id).width : L.get(id).height);
    const olo = (id) => (axis === 'x' ? L.get(id).y : L.get(id).x); // other axis
    const ohi = (id) => olo(id) + (axis === 'x' ? L.get(id).height : L.get(id).width);
    const posLocked = (id) => { const l = L.get(id); return l.positionLocked ?? l.locked === true; };
    const sizeLocked = (id) => { const l = L.get(id); return l.sizeLocked ?? l.locked === true; };
    const ok = joints.filter(j => j.status === 'ok' && L.has(j.roomA) && L.has(j.roomB));
    if (!L.has(roomId))
        return { layouts: {}, openings: [], delta: 0, blocked: false, reason: '', ids: [], message: '', moved: [] };
    const K = (id, e) => id + '|' + e, ZERO = '#0';
    const base = new Map([[ZERO, 0]]);
    const fixedBase = new Set([ZERO]);
    const cons = [];
    const add = (i, j, c, push, tag, ids) => { cons.push({ i, j, c, push, tag, ids }); };
    const eq = new Set();
    for (const r of rooms) {
        const id = r.id, s0 = hi0(id) - lo0(id), def = SIZES[cat.get(id) ?? 'medium'] ?? SIZES.medium, d = axis === 'x' ? def[0] : def[1];
        base.set(K(id, 'lo'), lo0(id));
        base.set(K(id, 'hi'), hi0(id));
        add(K(id, 'lo'), K(id, 'hi'), Math.min(s0, Math.max(1, d * 0.5)), true, 'min', [id]); // not smaller than the minimum (or than it is now)
        add(K(id, 'hi'), K(id, 'lo'), -Math.max(s0, d * 2.5), false, 'max', [id]); // not larger than the maximum (or than it is now)
        if (sizeLocked(id)) {
            add(K(id, 'lo'), K(id, 'hi'), s0, true, 'size', [id]);
            add(K(id, 'hi'), K(id, 'lo'), -s0, true, 'size', [id]);
        }
        if (posLocked(id))
            fixedBase.add(K(id, 'lo'));
    }
    for (const h of input.hold ?? [])
        if (L.has(h.id) && (h.side === 'left' || h.side === 'right' ? 'x' : 'y') === axis)
            fixedBase.add(K(h.id, h.side === 'right' || h.side === 'bottom' ? 'hi' : 'lo'));
    for (const j of ok) {
        const A = j.roomA, B = j.roomB;
        if (j.axis !== axis) { // the wall is crossed by the drag direction: rooms stay glued together
            const [p, q] = j.sideA === 'right' || j.sideA === 'bottom' ? [K(A, 'hi'), K(B, 'lo')] : [K(A, 'lo'), K(B, 'hi')];
            add(p, q, 0, true, 'joint', [A, B]);
            add(q, p, 0, true, 'joint', [A, B]);
            eq.add(p + '>' + q);
        }
        else { // the wall runs along the drag direction: keep the shared part and the opening
            const w = j.overlap ? j.overlap[1] - j.overlap[0] : 0, keep = Math.min(j.openingWidth + 0.1, w);
            add(K(B, 'lo'), K(A, 'hi'), keep, false, 'tangent', [A, B]);
            add(K(A, 'lo'), K(B, 'hi'), keep, false, 'tangent', [A, B]);
            const p = j.opening, half = j.openingWidth / 2;
            for (const id of [A, B]) {
                if (lo0(id) <= p - half + EPS)
                    add(K(id, 'lo'), ZERO, -(p - half), false, 'opening', [A, B]);
                if (hi0(id) >= p + half - EPS)
                    add(ZERO, K(id, 'hi'), p + half, false, 'opening', [A, B]);
            }
        }
    }
    for (const a of input.alignments ?? []) { // collinear walls of an alignment group stay collinear (walls not at the same level now are left alone)
        if ((a.side === 'left' || a.side === 'right' ? 'x' : 'y') !== axis)
            continue;
        const hiW = a.side === 'right' || a.side === 'bottom', ids = a.roomIds.filter(id => L.has(id)), at = (id) => (hiW ? hi0(id) : lo0(id));
        for (let p = 0; p < ids.length; p++)
            for (let q = p + 1; q < ids.length; q++) {
                if (Math.abs(at(ids[p]) - at(ids[q])) > 0.01)
                    continue;
                const kp = K(ids[p], hiW ? 'hi' : 'lo'), kq = K(ids[q], hiW ? 'hi' : 'lo');
                add(kp, kq, 0, true, 'align', [ids[p], ids[q]]);
                add(kq, kp, 0, true, 'align', [ids[p], ids[q]]);
            }
    }
    if (input.glueTouching) { // rooms that merely touch (no relationship) follow the wall like attached ones, without a door to protect
        const rel = new Set(joints.map(j => (j.roomA < j.roomB ? j.roomA + '|' + j.roomB : j.roomB + '|' + j.roomA)));
        for (let a = 0; a < rooms.length; a++)
            for (let b = a + 1; b < rooms.length; b++) {
                const p = rooms[a].id, q = rooms[b].id;
                if (ign.has(p) || ign.has(q) || rel.has(p < q ? p + '|' + q : q + '|' + p))
                    continue; // related (attached, broken or detached on purpose): handled above
                if (Math.min(ohi(p), ohi(q)) - Math.max(olo(p), olo(q)) <= 0.1)
                    continue; // no real shared wall part
                const f = Math.abs(hi0(p) - lo0(q)) <= 1e-3 ? p : Math.abs(hi0(q) - lo0(p)) <= 1e-3 ? q : '';
                if (!f)
                    continue;
                const t = f === p ? q : p;
                add(K(f, 'hi'), K(t, 'lo'), 0, true, 'joint', [f, t]);
                add(K(t, 'lo'), K(f, 'hi'), 0, true, 'joint', [f, t]);
                eq.add(K(f, 'hi') + '>' + K(t, 'lo'));
            }
    }
    if (noOverlap) {
        for (let a = 0; a < rooms.length; a++)
            for (let b = a + 1; b < rooms.length; b++) {
                const p = rooms[a].id, q = rooms[b].id;
                if (ign.has(p) || ign.has(q))
                    continue; // hidden room: ignored
                if (Math.min(ohi(p), ohi(q)) - Math.max(olo(p), olo(q)) <= EPS)
                    continue; // do not face each other along this axis
                if (Math.min(hi0(p), hi0(q)) - Math.max(lo0(p), lo0(q)) > EPS)
                    continue; // already overlapping: nothing to protect
                const [f, t] = hi0(p) <= lo0(q) + EPS ? [p, q] : [q, p];
                if (!eq.has(K(f, 'hi') + '>' + K(t, 'lo')))
                    add(K(f, 'hi'), K(t, 'lo'), 0, false, 'overlap', [f, t]);
            }
    }
    const dragKey = side === 'right' || side === 'bottom' ? K(roomId, 'hi') : K(roomId, 'lo');
    const solve = (target, sign) => {
        const val = new Map();
        for (const [k, x] of base)
            val.set(k, sign * x);
        val.set(dragKey, sign * target);
        const cs = sign === 1 ? cons : cons.map(c => ({ ...c, i: c.j, j: c.i })); // mirrored coordinates: v'_i - v'_j >= c
        const fixed = new Set(fixedBase);
        fixed.add(dragKey);
        for (let guard = 0; guard < 4000; guard++) {
            let changed = false;
            for (const c of cs) {
                if (val.get(c.j) - val.get(c.i) >= c.c - EPS)
                    continue;
                if (!c.push)
                    return { v: null, why: { tag: c.tag, ids: c.ids } };
                if (fixed.has(c.j))
                    return { v: null, why: { tag: fixedBase.has(c.j) && c.j !== dragKey ? 'locked' : c.tag, ids: fixedBase.has(c.j) && c.j !== dragKey ? [c.j.split('|')[0]] : c.ids } };
                val.set(c.j, val.get(c.i) + c.c);
                changed = true;
            }
            if (!changed)
                return { v: val, why: null };
        }
        return { v: null, why: { tag: 'joint', ids: [roomId] } };
    };
    const apply = (val, sign) => {
        const out = new Map();
        for (const r of rooms) {
            const l = L.get(r.id), nlo = sign * val.get(K(r.id, 'lo')), nhi = sign * val.get(K(r.id, 'hi')); // un-mirror: same variables, negated
            if (Math.abs(nlo - lo0(r.id)) < EPS && Math.abs(nhi - hi0(r.id)) < EPS)
                continue;
            out.set(r.id, axis === 'x' ? { x: rnd(nlo), y: l.y, width: rnd(nhi - nlo), height: l.height } : { x: l.x, y: rnd(nlo), width: l.width, height: rnd(nhi - nlo) });
        }
        return out;
    };
    const safe = (changed) => {
        const rs = graph.rooms.map(r => (changed.has(r.id) ? { ...r, layout: { ...r.layout, ...changed.get(r.id) } } : r));
        const after = new Map(deriveJoints({ rooms: rs, relationships: graph.relationships, joints: graph.joints }).joints.map(j => [j.id, j]));
        for (const j of ok) {
            const a = after.get(j.id);
            if (!a || !a.touching || (a.narrow && !j.narrow))
                return { tag: 'joint', ids: [j.roomA, j.roomB] };
        }
        return null;
    };
    // sweep the drag from the current wall position in grid steps; stop at the first step that is not possible
    const sign = input.delta >= 0 ? 1 : -1;
    const N = Math.ceil(Math.abs(input.delta) / step - 1e-9), D = Math.abs(input.delta); // the last step may be shorter than a grid step (exact targets)
    const cur = base.get(dragKey);
    let best = new Map(), bestM = 0, why = null;
    if (N > 0 && fixedBase.has(dragKey))
        why = { tag: 'locked', ids: [roomId] }; // this wall belongs to a room whose position is locked
    for (let m = 1; m <= N && !why; m++) {
        const s = solve(cur + sign * Math.min(m * step, D), sign);
        if (!s.v) {
            why = s.why;
            break;
        }
        const changed = apply(s.v, sign), w = safe(changed);
        if (w) {
            why = w;
            break;
        }
        best = changed;
        bestM = m;
    }
    const openings = [];
    const dim = (id) => best.get(id) ?? L.get(id);
    for (const j of ok) {
        if (!best.has(j.roomA) && !best.has(j.roomB))
            continue;
        const A = dim(j.roomA), B = dim(j.roomB), x = j.axis === 'x';
        const a0 = x ? A.x : A.y, a1 = a0 + (x ? A.width : A.height), b0 = x ? B.x : B.y, b1 = b0 + (x ? B.width : B.height);
        const lo = Math.max(a0, b0), hi = Math.min(a1, b1), half = j.openingWidth / 2;
        const p = hi - lo >= j.openingWidth ? Math.min(hi - half, Math.max(lo + half, j.opening)) : (lo + hi) / 2;
        openings.push({ connectorA: j.connectorA, connectorB: j.connectorB, world: rnd(p) });
    }
    const layouts = {};
    for (const [id, l] of [...best.entries()].sort((p, q) => (p[0] < q[0] ? -1 : 1)))
        layouts[id] = l;
    const blocked = bestM < N, reason = blocked ? (why ? why.tag : 'joint') : '';
    return { layouts, openings, delta: rnd(sign * Math.min(bestM * step, D)), blocked, reason, ids: blocked && why ? why.ids : [], message: blocked ? 'The wall cannot move further.' : '', moved: Object.keys(layouts) };
}
/**
 * Corner resize through the wall solver: a corner drag is two wall drags, x first, then y on the result of x
 * (connector offsets and joints are carried over between the two). Each axis stops on its own at the last feasible
 * step; the first blocked axis supplies reason / ids. Pure + deterministic; calls `planWall` and `deriveJoints`
 * as siblings (embedded next to them in the editor HTML).
 */
export function planCorner(input) {
    const rnd = (v) => Math.round(v * 1e4) / 1e4 + 0;
    const sides = input.corner === 'br' ? ['right', 'bottom'] : ['left', 'top'];
    const g0 = input.graph;
    const start = new Map(g0.rooms.filter((r) => r.layout).map((r) => [r.id, { ...r.layout }]));
    const clamp = (v, l) => Math.max(0.05, Math.min(l - 0.05, v));
    const openings = new Map();
    const plans = [];
    let g = g0, joints = input.joints;
    for (let k = 0; k < 2; k++) {
        const p = planWall({ graph: g, joints, roomId: input.roomId, side: sides[k], delta: k === 0 ? input.dx : input.dy, step: input.step, noOverlap: input.noOverlap, glueTouching: input.glueTouching, alignments: input.alignments, ignoreIds: input.ignoreIds, sizes: input.sizes });
        plans.push(p);
        for (const o of p.openings)
            openings.set(o.connectorA, o);
        if (k === 0) { // carry the x result into the graph for the y step: new layouts, connectors keep their world position, openings applied
            const rooms = g.rooms.map((r) => {
                const n = p.layouts[r.id];
                if (!n)
                    return { ...r, connectors: (r.connectors || []).map((c) => ({ ...c })) }; // clone: never mutate the input graph
                const o = r.layout, L = { ...o, ...n };
                const connectors = (r.connectors || []).map((c) => {
                    const h = c.side === 'top' || c.side === 'bottom', oldLen = h ? o.width : o.height, newLen = h ? L.width : L.height;
                    const off = c.offset ?? (c.position ?? 0.5) * oldLen;
                    return { ...c, offset: clamp((h ? o.x : o.y) + off - (h ? L.x : L.y), newLen) };
                });
                return { ...r, layout: L, connectors };
            });
            for (const o of p.openings)
                for (const r of rooms)
                    for (const c of r.connectors || []) {
                        if (c.id !== o.connectorA && c.id !== o.connectorB)
                            continue;
                        const h = c.side === 'top' || c.side === 'bottom', L = r.layout;
                        c.offset = clamp(o.world - (h ? L.x : L.y), h ? L.width : L.height);
                    }
            g = { ...g, rooms };
            joints = deriveJoints({ rooms: g.rooms, relationships: g.relationships, joints: g.joints }).joints;
        }
    }
    const fin = new Map(start);
    for (const p of plans)
        for (const id of Object.keys(p.layouts))
            fin.set(id, p.layouts[id]);
    const layouts = {};
    for (const id of [...fin.keys()].sort()) {
        const a = start.get(id), b = fin.get(id);
        if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6 || Math.abs(a.width - b.width) > 1e-6 || Math.abs(a.height - b.height) > 1e-6)
            layouts[id] = { x: rnd(b.x), y: rnd(b.y), width: rnd(b.width), height: rnd(b.height) };
    }
    const first = plans.find(p => p.blocked);
    return {
        layouts, openings: [...openings.values()], dx: plans[0].delta, dy: plans[1].delta, blocked: !!first,
        reason: first ? first.reason : '', ids: first ? first.ids : [], message: first ? first.message : '', moved: Object.keys(layouts),
    };
}
/**
 * Snaps the walls of an alignment group to the level of the reference room's wall, using the wall solver (one wall
 * drag per room, in the order given; each result is carried into the next step). The reference and the walls already
 * aligned are held in place. A wall that cannot get there (locks, sizes, doors, overlaps) moves as far as it can and is
 * reported in `failed`. Pure + deterministic; calls `planWall` and `deriveJoints` as siblings.
 */
export function planAlign(input) {
    const rnd = (v) => Math.round(v * 1e4) / 1e4 + 0;
    const side = input.side, hiW = side === 'right' || side === 'bottom', horiz = side === 'left' || side === 'right';
    const g0 = input.graph;
    const start = new Map(g0.rooms.filter((r) => r.layout).map((r) => [r.id, { ...r.layout }]));
    const lvl = (l) => (horiz ? (hiW ? l.x + l.width : l.x) : (hiW ? l.y + l.height : l.y));
    const clamp = (v, l) => Math.max(0.05, Math.min(l - 0.05, v));
    const ref = input.roomIds[0];
    if (!ref || !start.has(ref))
        return { layouts: {}, openings: [], level: 0, aligned: [], failed: [] };
    const level = rnd(lvl(start.get(ref)));
    const hold = [{ id: ref, side }];
    const aligned = [ref], failed = [], openings = new Map(), plans = [];
    let g = g0, joints = input.joints;
    for (const id of input.roomIds.slice(1)) {
        const cur = g.rooms.find((r) => r.id === id);
        if (!cur || !cur.layout || id === ref)
            continue;
        const delta = rnd(level - lvl(cur.layout));
        if (Math.abs(delta) < 1e-6) {
            aligned.push(id);
            hold.push({ id, side });
            continue;
        }
        const p = planWall({ graph: g, joints, roomId: id, side, delta, step: input.step, noOverlap: input.noOverlap, glueTouching: input.glueTouching, alignments: input.alignments, ignoreIds: input.ignoreIds, sizes: input.sizes, hold: hold.slice() });
        plans.push(p);
        for (const o of p.openings)
            openings.set(o.connectorA, o);
        if (p.blocked)
            failed.push({ id, reason: p.reason, ids: p.ids });
        else {
            aligned.push(id);
            hold.push({ id, side });
        }
        const rooms = g.rooms.map((r) => {
            const n = p.layouts[r.id];
            if (!n)
                return { ...r, connectors: (r.connectors || []).map((c) => ({ ...c })) };
            const o = r.layout, L = { ...o, ...n };
            const connectors = (r.connectors || []).map((c) => {
                const h = c.side === 'top' || c.side === 'bottom', oldLen = h ? o.width : o.height, newLen = h ? L.width : L.height;
                const off = c.offset ?? (c.position ?? 0.5) * oldLen;
                return { ...c, offset: clamp((h ? o.x : o.y) + off - (h ? L.x : L.y), newLen) };
            });
            return { ...r, layout: L, connectors };
        });
        for (const o of p.openings)
            for (const r of rooms)
                for (const c of r.connectors || []) {
                    if (c.id !== o.connectorA && c.id !== o.connectorB)
                        continue;
                    const h = c.side === 'top' || c.side === 'bottom', L = r.layout;
                    c.offset = clamp(o.world - (h ? L.x : L.y), h ? L.width : L.height);
                }
        g = { ...g, rooms };
        joints = deriveJoints({ rooms: g.rooms, relationships: g.relationships, joints: g.joints }).joints;
    }
    const fin = new Map(start);
    for (const p of plans)
        for (const id of Object.keys(p.layouts))
            fin.set(id, p.layouts[id]);
    const layouts = {};
    for (const id of [...fin.keys()].sort()) {
        const a = start.get(id), b = fin.get(id);
        if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6 || Math.abs(a.width - b.width) > 1e-6 || Math.abs(a.height - b.height) > 1e-6)
            layouts[id] = { x: rnd(b.x), y: rnd(b.y), width: rnd(b.width), height: rnd(b.height) };
    }
    return { layouts, openings: [...openings.values()], level, aligned, failed };
}
/**
 * "Close gaps": every relationship whose walls face each other with a positive gap (and a shared part) is closed by
 * dragging one of the two walls to contact with the wall solver: first the wall of room A, if that is blocked the wall
 * of room B. Locks, sizes, doors and overlaps are honoured exactly as for a manual wall drag, so a gap that cannot be
 * closed is reported in `failed` and left alone. Joints are processed in relationship-id order and each result is carried
 * into the next one. Connector points are NOT re-aligned here (the editor runs its connector alignment afterwards).
 * Pure + deterministic; calls `planWall` and `deriveJoints` as siblings.
 */
export function planClose(input) {
    const rnd = (v) => Math.round(v * 1e4) / 1e4 + 0;
    const g0 = input.graph;
    const start = new Map(g0.rooms.filter((r) => r.layout).map((r) => [r.id, { ...r.layout }]));
    const clamp = (v, l) => Math.max(0.05, Math.min(l - 0.05, v));
    const toward = (s) => (s === 'right' || s === 'bottom' ? 1 : -1);
    let g = g0, joints = input.joints;
    const closed = [], failed = [];
    const todo = joints.filter(j => j.status === 'broken' && j.reasons.includes('gap') && !j.reasons.includes('no-overlap') && j.gap > 1e-6).map(j => j.relationshipId).sort();
    for (const rid of todo) {
        const j = joints.find(x => x.relationshipId === rid);
        if (!j || j.status !== 'broken' || j.gap <= 1e-6)
            continue;
        const tries = [
            { room: j.roomA, side: j.sideA, delta: rnd(toward(j.sideA) * j.gap) },
            { room: j.roomB, side: j.sideB, delta: rnd(toward(j.sideB) * j.gap) },
        ];
        let done = false, last = null;
        for (const t of tries) {
            const p = planWall({ graph: g, joints, roomId: t.room, side: t.side, delta: t.delta, step: input.step, noOverlap: input.noOverlap, glueTouching: input.glueTouching, alignments: input.alignments, ignoreIds: input.ignoreIds, sizes: input.sizes });
            last = p;
            if (p.blocked)
                continue;
            const rooms = g.rooms.map((r) => {
                const n = p.layouts[r.id];
                if (!n)
                    return { ...r, connectors: (r.connectors || []).map((c) => ({ ...c })) };
                const o = r.layout, L = { ...o, ...n };
                const connectors = (r.connectors || []).map((c) => {
                    const h = c.side === 'top' || c.side === 'bottom', oldLen = h ? o.width : o.height, newLen = h ? L.width : L.height;
                    const off = c.offset ?? (c.position ?? 0.5) * oldLen;
                    return { ...c, offset: clamp((h ? o.x : o.y) + off - (h ? L.x : L.y), newLen) };
                });
                return { ...r, layout: L, connectors };
            });
            for (const o of p.openings)
                for (const r of rooms)
                    for (const c of r.connectors || []) {
                        if (c.id !== o.connectorA && c.id !== o.connectorB)
                            continue;
                        const h = c.side === 'top' || c.side === 'bottom', L = r.layout;
                        c.offset = clamp(o.world - (h ? L.x : L.y), h ? L.width : L.height);
                    }
            g = { ...g, rooms };
            joints = deriveJoints({ rooms: g.rooms, relationships: g.relationships, joints: g.joints }).joints;
            done = true;
            break;
        }
        if (done)
            closed.push(rid);
        else
            failed.push({ relationshipId: rid, reason: last ? last.reason : 'joint', ids: last ? last.ids : [] });
    }
    const layouts = {};
    for (const r of [...g.rooms].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const a = start.get(r.id), b = r.layout;
        if (!a || !b)
            continue;
        if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6 || Math.abs(a.width - b.width) > 1e-6 || Math.abs(a.height - b.height) > 1e-6)
            layouts[r.id] = { x: rnd(b.x), y: rnd(b.y), width: rnd(b.width), height: rnd(b.height) };
    }
    return { layouts, closed, failed };
}
/**
 * "Fit to neighbours" for ONE room: each of its four walls is moved (with the wall solver, so locks, sizes, doors and
 * overlaps are honoured) to the nearest correction within `tolerance`:
 *  1. contact with the nearest facing neighbour: a gap is closed, a small overlap is pulled back (any room, related or not);
 *  2. otherwise the same level as a neighbouring room that touches the room beside that wall (collinear snap).
 * Walls are processed in the order left, right, top, bottom and each result is carried into the next. A wall that cannot
 * move is reported in `failed`. Pure + deterministic; calls `planWall` and `deriveJoints` as siblings.
 */
export function planFit(input) {
    const rnd = (v) => Math.round(v * 1e4) / 1e4 + 0, EPS = 1e-6, tol = input.tolerance ?? 0.3;
    const clamp = (v, l) => Math.max(0.05, Math.min(l - 0.05, v));
    const hid = new Set(input.ignoreIds || []);
    const g0 = input.graph;
    const startRooms = new Map(g0.rooms.filter((r) => r.layout).map((r) => [r.id, { ...r.layout }]));
    let g = g0, joints = input.joints;
    const applied = [], failed = [];
    const wall = (L, s) => (s === 'left' ? L.x : s === 'right' ? L.x + L.width : s === 'top' ? L.y : L.y + L.height);
    const other = (s) => (s === 'left' ? 'right' : s === 'right' ? 'left' : s === 'top' ? 'bottom' : 'top');
    for (const s of ['left', 'right', 'top', 'bottom']) {
        const me = g.rooms.find((r) => r.id === input.roomId);
        if (!me || !me.layout)
            break;
        const R = me.layout, v = s === 'left' || s === 'right', sign = s === 'right' || s === 'bottom' ? 1 : -1;
        const a0 = (L) => (v ? L.y : L.x), a1 = (L) => (v ? L.y + L.height : L.x + L.width);
        const p0 = (L) => (v ? L.x : L.y), p1 = (L) => (v ? L.x + L.width : L.y + L.height);
        let best = null;
        for (const r of g.rooms) {
            if (r.id === input.roomId || !r.layout || hid.has(r.id))
                continue;
            const N = r.layout, shared = Math.min(a1(R), a1(N)) - Math.max(a0(R), a0(N));
            const facing = wall(N, other(s)), gap = sign > 0 ? facing - wall(R, s) : wall(R, s) - facing;
            const beyond = sign > 0 ? facing > wall(R, other(s)) + EPS && wall(N, s) > wall(R, s) + EPS : facing < wall(R, other(s)) - EPS && wall(N, s) < wall(R, s) - EPS;
            const cand = [];
            if (shared > 0.05 && beyond && Math.abs(gap) > EPS && Math.abs(gap) <= tol)
                cand.push({ kind: gap > 0 ? 'gap' : 'overlap', delta: rnd(sign * gap), mag: Math.abs(gap), pri: 0, id: r.id });
            const beside = Math.min(p1(R), p1(N)) - Math.max(p0(R), p0(N)) > 0.05 && (Math.abs(a1(N) - a0(R)) <= 0.08 || Math.abs(a0(N) - a1(R)) <= 0.08);
            const diff = wall(N, s) - wall(R, s);
            if (beside && Math.abs(diff) > EPS && Math.abs(diff) <= tol)
                cand.push({ kind: 'align', delta: rnd(diff), mag: Math.abs(diff), pri: 1, id: r.id });
            for (const c of cand)
                if (!best || c.pri < best.pri || (c.pri === best.pri && (c.mag < best.mag - EPS || (Math.abs(c.mag - best.mag) <= EPS && c.id < best.id))))
                    best = c;
        }
        if (!best)
            continue;
        const p = planWall({ graph: g, joints, roomId: input.roomId, side: s, delta: best.delta, step: input.step, noOverlap: input.noOverlap, glueTouching: input.glueTouching, alignments: input.alignments, ignoreIds: input.ignoreIds, sizes: input.sizes });
        if (p.blocked) {
            failed.push({ side: s, kind: best.kind, reason: p.reason, ids: p.ids });
            continue;
        }
        const rooms = g.rooms.map((r) => {
            const n = p.layouts[r.id];
            if (!n)
                return { ...r, connectors: (r.connectors || []).map((c) => ({ ...c })) };
            const o = r.layout, L = { ...o, ...n };
            const connectors = (r.connectors || []).map((c) => {
                const h = c.side === 'top' || c.side === 'bottom', oldLen = h ? o.width : o.height, newLen = h ? L.width : L.height;
                const off = c.offset ?? (c.position ?? 0.5) * oldLen;
                return { ...c, offset: clamp((h ? o.x : o.y) + off - (h ? L.x : L.y), newLen) };
            });
            return { ...r, layout: L, connectors };
        });
        for (const o of p.openings)
            for (const r of rooms)
                for (const c of r.connectors || []) {
                    if (c.id !== o.connectorA && c.id !== o.connectorB)
                        continue;
                    const h = c.side === 'top' || c.side === 'bottom', L = r.layout;
                    c.offset = clamp(o.world - (h ? L.x : L.y), h ? L.width : L.height);
                }
        g = { ...g, rooms };
        joints = deriveJoints({ rooms: g.rooms, relationships: g.relationships, joints: g.joints }).joints;
        applied.push({ side: s, kind: best.kind, delta: best.delta });
    }
    const layouts = {};
    for (const r of [...g.rooms].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const a = startRooms.get(r.id), b = r.layout;
        if (!a || !b)
            continue;
        if (Math.abs(a.x - b.x) > EPS || Math.abs(a.y - b.y) > EPS || Math.abs(a.width - b.width) > EPS || Math.abs(a.height - b.height) > EPS)
            layouts[r.id] = { x: rnd(b.x), y: rnd(b.y), width: rnd(b.width), height: rnd(b.height) };
    }
    return { layouts, applied, failed };
}
