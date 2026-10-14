export type ConnectorType = "door" | "open-passage" | "external-door" | "stair";

export interface ConnectorGeometry {
  readonly width: number;
  readonly height?: number;
  readonly style?: "single-hinged" | "double-hinged" | "sliding";
  readonly swingDirection?: "left" | "right";
}

export interface Connector {
  readonly id: string;
  readonly type: ConnectorType;
  readonly roomA: string;
  readonly roomB?: string;
  readonly boundaryA: string;
  readonly boundaryB?: string;
  readonly offset: number;
  readonly width?: number;
  readonly geometry?: ConnectorGeometry;
}
