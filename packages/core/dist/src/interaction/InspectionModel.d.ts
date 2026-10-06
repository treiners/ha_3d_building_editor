import type { Connector } from "../model/Connector.js";
import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { InspectionRecord, InspectionSelection } from "../model/InspectionSelection.js";
import type { Room } from "../model/Room.js";
import type { WindowOpening } from "../model/WindowOpening.js";
export interface InspectionModel {
    readonly records: readonly InspectionRecord[];
    readonly byKey: Readonly<Record<string, InspectionRecord>>;
}
export declare function selectionKey(selection: InspectionSelection): string;
export declare function buildInspectionModel(rooms: readonly Room[], floor: GeneratedFloor, connectors?: readonly Connector[], windows?: readonly WindowOpening[]): InspectionModel;
