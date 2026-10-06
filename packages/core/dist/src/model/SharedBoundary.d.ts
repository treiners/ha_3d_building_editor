import type { Point } from "./Point.js";
import type { OverlapType } from "../geometry/BoundaryOverlapDetector.js";
export type SharedBoundaryRelation = Exclude<OverlapType, "none">;
/** A generated physical overlap between boundaries of two different rooms. */
export interface SharedBoundary {
    readonly id: string;
    readonly boundaryA: string;
    readonly boundaryB: string;
    readonly roomA: string;
    readonly roomB: string;
    readonly start: Point;
    readonly end: Point;
    readonly length: number;
    readonly relation: SharedBoundaryRelation;
    readonly aStart: number;
    readonly aEnd: number;
    readonly bStart: number;
    readonly bEnd: number;
}
