import { detectOverlap, } from "./BoundaryOverlapDetector.js";
function canonicalPair(a, b) {
    return a.id.localeCompare(b.id) <= 0 ? [a, b] : [b, a];
}
/**
 * Finds shared physical intervals across all boundaries for one floor.
 * Each unordered cross-room pair is compared exactly once.
 */
export function generateSharedBoundaries(boundaries, options = {}) {
    const shared = [];
    for (let i = 0; i < boundaries.length; i += 1) {
        const first = boundaries[i];
        if (first === undefined)
            continue;
        for (let j = i + 1; j < boundaries.length; j += 1) {
            const second = boundaries[j];
            if (second === undefined || first.roomId === second.roomId)
                continue;
            const [a, b] = canonicalPair(first, second);
            const overlap = detectOverlap(a, b, options);
            if (overlap.type === "none" ||
                overlap.start === undefined ||
                overlap.end === undefined ||
                overlap.aStart === undefined ||
                overlap.aEnd === undefined ||
                overlap.bStart === undefined ||
                overlap.bEnd === undefined) {
                continue;
            }
            shared.push({
                id: `shared:${a.id}:${b.id}`,
                boundaryA: a.id,
                boundaryB: b.id,
                roomA: a.roomId,
                roomB: b.roomId,
                start: overlap.start,
                end: overlap.end,
                length: overlap.length,
                relation: overlap.type,
                aStart: overlap.aStart,
                aEnd: overlap.aEnd,
                bStart: overlap.bStart,
                bEnd: overlap.bEnd,
            });
        }
    }
    return shared.sort((left, right) => left.id.localeCompare(right.id));
}
