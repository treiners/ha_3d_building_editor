import type { Point } from "./Point.js";

export type WallSegmentClassification = "external" | "shared";

/** A canonical interval along one source boundary. */
export interface WallSegment {
  readonly id: string;
  readonly boundaryId: string;
  readonly roomId: string;
  readonly classification: WallSegmentClassification;
  readonly start: Point;
  readonly end: Point;
  readonly length: number;
  readonly localStart: number;
  readonly localEnd: number;
  readonly sharedBoundaryId?: string;
  readonly adjacentRoomId?: string;
}
