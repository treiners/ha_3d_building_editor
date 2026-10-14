import type { Connector } from "../model/Connector.js";
import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { WindowOpening } from "../model/WindowOpening.js";
import { validateOpenings, type OpeningValidationOptions } from "./OpeningValidator.js";
import type { ValidationIssue } from "./ValidationIssue.js";
export function validateBuildingFloor(floor:GeneratedFloor,connectors:readonly Connector[],windows:readonly WindowOpening[],options:OpeningValidationOptions={}):ValidationIssue[]{return validateOpenings(floor,connectors,windows,options);}
