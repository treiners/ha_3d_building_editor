import { generateBoundaries } from "../geometry/BoundaryGenerator.js";
import { generateSharedBoundaries } from "../geometry/SharedBoundaryGenerator.js";
import { generateWallSegments } from "../geometry/WallSegmentGenerator.js";
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
export function generateFloorGeometry(
  rooms: readonly Room[],
  options: GeometryPipelineOptions = {},
): GeneratedFloor {
  const boundaries = rooms.flatMap((room) => generateBoundaries(room));
  const sharedBoundaries = generateSharedBoundaries(
    boundaries,
    options.overlap,
  );
  const wallSegments = generateWallSegments(
    boundaries,
    sharedBoundaries,
    options.wallSegments,
  );

  return {
    boundaries,
    sharedBoundaries,
    wallSegments,
  };
}
