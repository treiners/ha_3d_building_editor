import type { Point } from "./Point.js";

export type RenderedConnectorType = "door" | "open-passage" | "external-door";

/** Renderer-independent connector resolved to world coordinates. */
export interface RenderedConnector {
  readonly id: string;
  readonly connectorId: string;
  readonly type: RenderedConnectorType;
  readonly roomA: string;
  readonly roomB?: string;
  readonly boundaryA: string;
  readonly boundaryB?: string;
  readonly start: Point;
  readonly end: Point;
  readonly centre: Point;
  readonly width: number;
  readonly rotationDegrees: number;
  readonly style?: string;
}
