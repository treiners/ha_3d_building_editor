const DEFAULT_TOLERANCE = 0.01;
function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}
function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
function pointAt(boundary, distance) {
    const ratio = distance / boundary.length;
    return {
        x: boundary.start.x + (boundary.end.x - boundary.start.x) * ratio,
        y: boundary.start.y + (boundary.end.y - boundary.start.y) * ratio,
    };
}
function connectorIntervalOnBoundary(connector, boundary) {
    const direction = {
        x: (boundary.end.x - boundary.start.x) / boundary.length,
        y: (boundary.end.y - boundary.start.y) / boundary.length,
    };
    const first = dot(subtract(connector.start, boundary.start), direction);
    const second = dot(subtract(connector.end, boundary.start), direction);
    return {
        start: Math.min(first, second),
        end: Math.max(first, second),
        connectorId: connector.connectorId,
        type: connector.type,
    };
}
function splitWallSegment(segment, cuts, boundary, tolerance) {
    const relevant = cuts
        .map((cut) => ({
        ...cut,
        start: Math.max(segment.localStart, cut.start),
        end: Math.min(segment.localEnd, cut.end),
    }))
        .filter((cut) => cut.end - cut.start > tolerance)
        .sort((a, b) => a.start - b.start);
    for (let index = 1; index < relevant.length; index += 1) {
        const previous = relevant[index - 1];
        const current = relevant[index];
        if (previous !== undefined && current !== undefined && current.start < previous.end - tolerance) {
            throw new Error(`Wall segment '${segment.id}' contains overlapping connector openings.`);
        }
    }
    const pieces = [];
    let cursor = segment.localStart;
    let pieceIndex = 0;
    for (const cut of relevant) {
        if (cut.start - cursor > tolerance) {
            pieces.push({
                ...segment,
                id: `${segment.id}:piece${pieceIndex}`,
                start: pointAt(boundary, cursor),
                end: pointAt(boundary, cut.start),
                length: cut.start - cursor,
                localStart: cursor,
                localEnd: cut.start,
            });
            pieceIndex += 1;
        }
        cursor = Math.max(cursor, cut.end);
    }
    if (segment.localEnd - cursor > tolerance) {
        pieces.push({
            ...segment,
            id: `${segment.id}:piece${pieceIndex}`,
            start: pointAt(boundary, cursor),
            end: pointAt(boundary, segment.localEnd),
            length: segment.localEnd - cursor,
            localStart: cursor,
            localEnd: segment.localEnd,
        });
    }
    return relevant.length === 0 ? [segment] : pieces;
}
/**
 * Cuts resolved door and passage intervals out of generated wall segments.
 * Both boundary A and boundary B are cut for an internal connector.
 */
export function resolveWallOpenings(floor, connectors, options = {}) {
    const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
    if (!Number.isFinite(tolerance) || tolerance < 0) {
        throw new RangeError("Opening tolerance must be finite and non-negative.");
    }
    const boundaries = new Map(floor.boundaries.map((boundary) => [boundary.id, boundary]));
    const cutsByBoundary = new Map();
    const openings = [];
    for (const connector of connectors) {
        for (const boundaryId of [connector.boundaryA, connector.boundaryB].filter((value) => value !== undefined)) {
            const boundary = boundaries.get(boundaryId);
            if (boundary === undefined) {
                throw new Error(`Connector '${connector.connectorId}' references missing boundary '${boundaryId}'.`);
            }
            const interval = connectorIntervalOnBoundary(connector, boundary);
            if (interval.start < -tolerance || interval.end > boundary.length + tolerance) {
                throw new Error(`Connector '${connector.connectorId}' falls outside boundary '${boundaryId}'.`);
            }
            const normalised = {
                ...interval,
                start: Math.max(0, interval.start),
                end: Math.min(boundary.length, interval.end),
            };
            const existing = cutsByBoundary.get(boundaryId) ?? [];
            existing.push(normalised);
            cutsByBoundary.set(boundaryId, existing);
            openings.push({
                id: `opening:${connector.connectorId}:${boundaryId}`,
                connectorId: connector.connectorId,
                type: connector.type,
                boundaryId,
                start: pointAt(boundary, normalised.start),
                end: pointAt(boundary, normalised.end),
                localStart: normalised.start,
                localEnd: normalised.end,
                width: normalised.end - normalised.start,
            });
        }
    }
    const wallSegments = floor.wallSegments.flatMap((segment) => {
        const boundary = boundaries.get(segment.boundaryId);
        if (boundary === undefined) {
            throw new Error(`Wall segment '${segment.id}' references missing boundary '${segment.boundaryId}'.`);
        }
        return splitWallSegment(segment, cutsByBoundary.get(segment.boundaryId) ?? [], boundary, tolerance);
    });
    return {
        wallSegments,
        openings: openings.sort((a, b) => a.id.localeCompare(b.id)),
    };
}
