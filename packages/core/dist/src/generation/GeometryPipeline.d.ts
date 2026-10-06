import type { BoundaryOverlapOptions } from "../geometry/BoundaryOverlapDetector.js";
import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { Room } from "../model/Room.js";
import type { WallSegmentOptions } from "../geometry/WallSegmentGenerator.js";
export interface GeometryPipelineOptions {
    readonly overlap?: BoundaryOverlapOptions;
    readonly wallSegments?: WallSegmentOptions;
}
/**
 * Runs the renderer-independent geometry pipeline for one floor.
 *
 * Room order does not affect the generated shared-boundary or wall-segment
 * ordering because downstream generators return deterministic sorted output.
 */
export declare function generateFloorGeometry(rooms: readonly Room[], options?: GeometryPipelineOptions): GeneratedFloor;
