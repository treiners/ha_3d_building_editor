import type { Boundary } from "../model/Boundary.js";
import type { Point } from "../model/Point.js";
export type OverlapType = "full" | "contained" | "partial" | "none";
export interface BoundaryOverlap {
    readonly type: OverlapType;
    readonly length: number;
    readonly start?: Point;
    readonly end?: Point;
    readonly aStart?: number;
    readonly aEnd?: number;
    readonly bStart?: number;
    readonly bEnd?: number;
}
export interface BoundaryOverlapOptions {
    readonly tolerance?: number;
}
/**
 * Detects collinear overlap between two non-zero boundaries.
 *
 * The result interval is oriented from boundary A's start to end. Local
 * offsets for both boundaries are returned to support later connector and
 * wall-segmentation work.
 */
export declare function detectOverlap(a: Boundary, b: Boundary, options?: BoundaryOverlapOptions): BoundaryOverlap;
