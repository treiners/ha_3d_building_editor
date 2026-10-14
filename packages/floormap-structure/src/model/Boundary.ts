import type { Point } from "./Point.js";

/** A generated edge of a room polygon. */
export interface Boundary {
  readonly id: string;
  readonly roomId: string;
  readonly edgeIndex: number;
  readonly start: Point;
  readonly end: Point;
  readonly length: number;
}
