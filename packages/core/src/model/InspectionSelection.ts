export type InspectionEntityType = "room" | "wall" | "connector" | "window";

export interface InspectionSelection {
  readonly type: InspectionEntityType;
  readonly id: string;
}

export interface InspectionRecord {
  readonly type: InspectionEntityType;
  readonly id: string;
  readonly title: string;
  readonly properties: Readonly<Record<string, string | number | readonly string[]>>;
}
