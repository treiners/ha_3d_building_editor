import { generateBoundaries } from "../geometry/BoundaryGenerator.js";
import { generateSharedBoundaries } from "../geometry/SharedBoundaryGenerator.js";
import { generateWallSegments } from "../geometry/WallSegmentGenerator.js";
/**
 * Runs the renderer-independent geometry pipeline for one floor.
 *
 * Room order does not affect the generated shared-boundary or wall-segment
 * ordering because downstream generators return deterministic sorted output.
 */
export function generateFloorGeometry(rooms, options = {}) {
    const boundaries = rooms.flatMap((room) => generateBoundaries(room));
    const sharedBoundaries = generateSharedBoundaries(boundaries, options.overlap);
    const wallSegments = generateWallSegments(boundaries, sharedBoundaries, options.wallSegments);
    return {
        boundaries,
        sharedBoundaries,
        wallSegments,
    };
}
