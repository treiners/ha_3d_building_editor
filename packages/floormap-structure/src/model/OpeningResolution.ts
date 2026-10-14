import type { Point } from "./Point.js";
import type { WallSegment } from "./WallSegment.js";

export interface ResolvedWallOpening {
  readonly id: string;
  readonly connectorId: string;
  readonly type: "door" | "external-door" | "open-passage";
  readonly boundaryId: string;
  readonly start: Point;
  readonly end: Point;
  readonly localStart: number;
  readonly localEnd: number;
  readonly width: number;
}

export interface OpeningResolution {
  readonly wallSegments: readonly WallSegment[];
  readonly openings: readonly ResolvedWallOpening[];
}
