import { readFileSync } from "node:fs";
import { generateFloorGeometry } from "../src/generation/GeometryPipeline.js";
import { validateBuildingFloor } from "../src/validation/BuildingValidator.js";
const input = process.argv[2] ?? "examples/reference-apartment-v1.2.json";
const doc = JSON.parse(readFileSync(input, "utf8"));
const source = doc.building.floors[0];
if (!source)
    throw new Error("No floor found.");
const floor = generateFloorGeometry(source.rooms);
const issues = validateBuildingFloor(floor, source.connectors ?? [], source.openings ?? []);
for (const i of issues)
    console.log(`${i.severity.toUpperCase()} ${i.code} ${i.objectId}: ${i.message}`);
console.log(`${issues.length} validation issue(s).`);
process.exitCode = issues.some(i => i.severity === "error") ? 1 : 0;
