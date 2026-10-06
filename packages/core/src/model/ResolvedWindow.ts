import type { Point } from "./Point.js";

export interface ResolvedWindow {
  readonly id: string;
  readonly openingId: string;
  readonly roomId: string;
  readonly boundaryId: string;
  readonly start: Point;
  readonly end: Point;
  readonly centre: Point;
  readonly width: number;
  readonly height: number;
  readonly sillHeight: number;
  readonly rotationDegrees: number;
}
