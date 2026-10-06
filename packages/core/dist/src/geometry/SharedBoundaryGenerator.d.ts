import type { Boundary } from "../model/Boundary.js";
import type { SharedBoundary } from "../model/SharedBoundary.js";
import { type BoundaryOverlapOptions } from "./BoundaryOverlapDetector.js";
/**
 * Finds shared physical intervals across all boundaries for one floor.
 * Each unordered cross-room pair is compared exactly once.
 */
export declare function generateSharedBoundaries(boundaries: readonly Boundary[], options?: BoundaryOverlapOptions): SharedBoundary[];
