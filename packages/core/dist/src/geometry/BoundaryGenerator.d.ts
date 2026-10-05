import type { Boundary } from "../model/Boundary.js";
import type { Room } from "../model/Room.js";
export declare class BoundaryGenerationError extends Error {
    constructor(message: string);
}
/**
 * Generates one boundary for every edge of a room polygon.
 *
 * Polygon closure is implicit: the final vertex connects to the first.
 * Boundary IDs are deterministic and use `<room-id>-b<edge-index>`.
 * The input room is never modified.
 */
export declare function generateBoundaries(room: Room): Boundary[];
