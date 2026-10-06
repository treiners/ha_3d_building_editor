import type { Connector } from "../model/Connector.js";
import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { WindowOpening } from "../model/WindowOpening.js";
import type { ValidationIssue } from "./ValidationIssue.js";
export interface OpeningValidationOptions {
    readonly tolerance?: number;
    readonly defaultWindowWidth?: number;
    readonly internalWindowSeverity?: "warning" | "error";
}
export declare function validateOpenings(floor: GeneratedFloor, connectors: readonly Connector[], windows: readonly WindowOpening[], options?: OpeningValidationOptions): ValidationIssue[];
