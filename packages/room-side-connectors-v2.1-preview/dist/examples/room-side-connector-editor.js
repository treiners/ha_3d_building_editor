import { readFileSync, writeFileSync } from "node:fs";
import { createEmptyBuildingGraph } from "../src/room-entry/BuildingGraphStore.js";
import { renderRoomGraphEditorHtml } from "../src/room-entry/RoomGraphEditorDocument.js";
const input = process.argv[2], output = process.argv[3] ?? "examples/room-side-connector-editor.html";
const model = input ? JSON.parse(readFileSync(input, "utf8")) : createEmptyBuildingGraph();
writeFileSync(output, renderRoomGraphEditorHtml(model), "utf8");
console.log(`Generated ${output}.`);
