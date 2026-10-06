import type { Boundary } from "../model/Boundary.js";
import type { SharedBoundary } from "../model/SharedBoundary.js";
import type { WallSegment } from "../model/WallSegment.js";
export interface WallSegmentOptions {
    readonly tolerance?: number;
}
/**
 * Segments every boundary into canonical shared and external intervals.
 *
 * One segment is emitted for every interval between overlap breakpoints.
 * Shared intervals retain their SharedBoundary and adjacent-room references.
 */
export declare function generateWallSegments(boundaries: readonly Boundary[], sharedBoundaries: readonly SharedBoundary[], options?: WallSegmentOptions): WallSegment[];
