export interface WindowGeometry {
  readonly width?: number;
  readonly height?: number;
  readonly sillHeight?: number;
}

export interface WindowOpening {
  readonly id: string;
  readonly type: "window";
  readonly roomId: string;
  readonly boundaryId: string;
  readonly offset: number;
  readonly geometry?: WindowGeometry;
}
