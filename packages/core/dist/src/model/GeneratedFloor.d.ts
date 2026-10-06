import type { Boundary } from "./Boundary.js";
import type { SharedBoundary } from "./SharedBoundary.js";
import type { WallSegment } from "./WallSegment.js";
/** Renderer-independent geometry generated for one floor. */
export interface GeneratedFloor {
    readonly boundaries: readonly Boundary[];
    readonly sharedBoundaries: readonly SharedBoundary[];
    readonly wallSegments: readonly WallSegment[];
}
