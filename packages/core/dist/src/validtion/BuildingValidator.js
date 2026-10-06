import { validateOpenings } from "./OpeningValidator.js";
export function validateBuildingFloor(floor, connectors, windows, options = {}) { return validateOpenings(floor, connectors, windows, options); }
