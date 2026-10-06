import type { Connector } from "../model/Connector.js";
import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { WindowOpening } from "../model/WindowOpening.js";
import { type OpeningValidationOptions } from "./OpeningValidator.js";
import type { ValidationIssue } from "./ValidationIssue.js";
export declare function validateBuildingFloor(floor: GeneratedFloor, connectors: readonly Connector[], windows: readonly WindowOpening[], options?: OpeningValidationOptions): ValidationIssue[];
