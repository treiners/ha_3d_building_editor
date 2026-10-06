const DEFAULT_TOLERANCE = 0.01;
function pointAt(boundary, distance) {
    const ratio = distance / boundary.length;
    return {
        x: boundary.start.x + (boundary.end.x - boundary.start.x) * ratio,
        y: boundary.start.y + (boundary.end.y - boundary.start.y) * ratio,
    };
}
function mergePositions(values, tolerance) {
    const sorted = [...values].sort((a, b) => a - b);
    const merged = [];
    for (const value of sorted) {
        const last = merged.at(-1);
        if (last === undefined || Math.abs(value - last) > tolerance) {
            merged.push(value);
        }
    }
    return merged;
}
function intervalsForBoundary(boundary, sharedBoundaries) {
    const result = [];
    for (const shared of sharedBoundaries) {
        if (shared.boundaryA === boundary.id) {
            result.push({
                start: shared.aStart,
                end: shared.aEnd,
                sharedBoundaryId: shared.id,
                adjacentRoomId: shared.roomB,
            });
        }
        else if (shared.boundaryB === boundary.id) {
            result.push({
                start: shared.bStart,
                end: shared.bEnd,
                sharedBoundaryId: shared.id,
                adjacentRoomId: shared.roomA,
            });
        }
    }
    return result;
}
/**
 * Segments every boundary into canonical shared and external intervals.
 *
 * One segment is emitted for every interval between overlap breakpoints.
 * Shared intervals retain their SharedBoundary and adjacent-room references.
 */
export function generateWallSegments(boundaries, sharedBoundaries, options = {}) {
    const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
    if (!Number.isFinite(tolerance) || tolerance < 0) {
        throw new RangeError("Wall-segment tolerance must be finite and non-negative.");
    }
    const output = [];
    for (const boundary of [...boundaries].sort((a, b) => a.id.localeCompare(b.id))) {
        if (boundary.length <= tolerance)
            continue;
        const sharedIntervals = intervalsForBoundary(boundary, sharedBoundaries);
        const breakpoints = mergePositions([0, boundary.length, ...sharedIntervals.flatMap((item) => [item.start, item.end])], tolerance);
        let segmentIndex = 0;
        for (let index = 0; index < breakpoints.length - 1; index += 1) {
            const localStart = breakpoints[index];
            const localEnd = breakpoints[index + 1];
            if (localStart === undefined || localEnd === undefined)
                continue;
            if (localEnd - localStart <= tolerance)
                continue;
            const midpoint = (localStart + localEnd) / 2;
            const matching = sharedIntervals.filter((item) => midpoint >= item.start - tolerance && midpoint <= item.end + tolerance);
            if (matching.length > 1) {
                console.log("Boundary:", boundary.id);
                console.log(matching);
                throw new Error(`Boundary '${boundary.id}' has ambiguous overlapping shared intervals.`);
            }
            const shared = matching[0];
            const classification = shared === undefined ? "external" : "shared";
            output.push({
                id: `wall:${boundary.id}:${segmentIndex}`,
                boundaryId: boundary.id,
                roomId: boundary.roomId,
                classification,
                start: pointAt(boundary, localStart),
                end: pointAt(boundary, localEnd),
                length: localEnd - localStart,
                localStart,
                localEnd,
                ...(shared === undefined
                    ? {}
                    : {
                        sharedBoundaryId: shared.sharedBoundaryId,
                        adjacentRoomId: shared.adjacentRoomId,
                    }),
            });
            segmentIndex += 1;
        }
    }
    return output;
}
