export class BoundaryGenerationError extends Error {
    constructor(message) {
        super(message);
        this.name = "BoundaryGenerationError";
    }
}
function toPoint(tuple) {
    return { x: tuple[0], y: tuple[1] };
}
function distance(start, end) {
    return Math.hypot(end.x - start.x, end.y - start.y);
}
function validateRoom(room) {
    if (room.id.trim().length === 0) {
        throw new BoundaryGenerationError("Room id must not be empty.");
    }
    const { shape } = room.geometry;
    if (shape.length < 3) {
        throw new BoundaryGenerationError(`Room '${room.id}' must contain at least three vertices.`);
    }
    shape.forEach((point, index) => {
        const [x, y] = point;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new BoundaryGenerationError(`Room '${room.id}' contains a non-finite vertex at index ${index}.`);
        }
    });
}
/**
 * Generates one boundary for every edge of a room polygon.
 *
 * Polygon closure is implicit: the final vertex connects to the first.
 * Boundary IDs are deterministic and use `<room-id>-b<edge-index>`.
 * The input room is never modified.
 */
export function generateBoundaries(room) {
    validateRoom(room);
    const { shape } = room.geometry;
    const boundaries = [];
    for (let edgeIndex = 0; edgeIndex < shape.length; edgeIndex += 1) {
        const startTuple = shape[edgeIndex];
        const endTuple = shape[(edgeIndex + 1) % shape.length];
        // The prior validation and loop bounds guarantee both values exist.
        if (startTuple === undefined || endTuple === undefined) {
            throw new BoundaryGenerationError(`Room '${room.id}' contains an incomplete edge at index ${edgeIndex}.`);
        }
        const start = toPoint(startTuple);
        const end = toPoint(endTuple);
        const length = distance(start, end);
        if (length === 0) {
            throw new BoundaryGenerationError(`Room '${room.id}' contains a zero-length edge at index ${edgeIndex}.`);
        }
        boundaries.push({
            id: `${room.id}-b${edgeIndex}`,
            roomId: room.id,
            edgeIndex,
            start,
            end,
            length,
        });
    }
    return boundaries;
}
