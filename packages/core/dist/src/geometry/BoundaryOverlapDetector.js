const DEFAULT_TOLERANCE = 0.01;
function noOverlap() {
    return { type: "none", length: 0 };
}
function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
function addScaled(origin, direction, distance) {
    return {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
    };
}
function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}
function cross(a, b) {
    return a.x * b.y - a.y * b.x;
}
function clampNear(value, target, tolerance) {
    return Math.abs(value - target) <= tolerance ? target : value;
}
/**
 * Detects collinear overlap between two non-zero boundaries.
 *
 * The result interval is oriented from boundary A's start to end. Local
 * offsets for both boundaries are returned to support later connector and
 * wall-segmentation work.
 */
export function detectOverlap(a, b, options = {}) {
    const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
    if (!Number.isFinite(tolerance) || tolerance < 0) {
        throw new RangeError("Overlap tolerance must be a finite, non-negative number.");
    }
    if (a.length <= 0 || b.length <= 0) {
        throw new RangeError("Boundaries must have positive length.");
    }
    const aVector = subtract(a.end, a.start);
    const aLength = Math.hypot(aVector.x, aVector.y);
    const direction = { x: aVector.x / aLength, y: aVector.y / aLength };
    // Perpendicular distances from B's endpoints to A's infinite line.
    const bStartRelative = subtract(b.start, a.start);
    const bEndRelative = subtract(b.end, a.start);
    const startDistance = Math.abs(cross(direction, bStartRelative));
    const endDistance = Math.abs(cross(direction, bEndRelative));
    if (startDistance > tolerance || endDistance > tolerance) {
        return noOverlap();
    }
    const b0 = dot(bStartRelative, direction);
    const b1 = dot(bEndRelative, direction);
    const bMin = Math.min(b0, b1);
    const bMax = Math.max(b0, b1);
    let overlapStart = Math.max(0, bMin);
    let overlapEnd = Math.min(aLength, bMax);
    overlapStart = clampNear(overlapStart, 0, tolerance);
    overlapEnd = clampNear(overlapEnd, aLength, tolerance);
    const overlapLength = overlapEnd - overlapStart;
    // Endpoint-only contact is not a wall overlap.
    if (overlapLength <= tolerance) {
        return noOverlap();
    }
    const coversA = overlapStart <= tolerance && aLength - overlapEnd <= tolerance;
    const coversB = Math.abs(overlapLength - b.length) <= tolerance;
    let type;
    if (coversA && coversB) {
        type = "full";
    }
    else if (coversA || coversB) {
        type = "contained";
    }
    else {
        type = "partial";
    }
    const start = addScaled(a.start, direction, overlapStart);
    const end = addScaled(a.start, direction, overlapEnd);
    const bDirection = {
        x: (b.end.x - b.start.x) / b.length,
        y: (b.end.y - b.start.y) / b.length,
    };
    const bLocal0 = dot(subtract(start, b.start), bDirection);
    const bLocal1 = dot(subtract(end, b.start), bDirection);
    return {
        type,
        length: overlapLength,
        start,
        end,
        aStart: overlapStart,
        aEnd: overlapEnd,
        bStart: Math.min(bLocal0, bLocal1),
        bEnd: Math.max(bLocal0, bLocal1),
    };
}
