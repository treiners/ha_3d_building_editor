import { readFileSync, writeFileSync } from "node:fs";
import { resolveConnectors } from "../src/generation/ConnectorResolver.js";
import { generateFloorGeometry } from "../src/generation/GeometryPipeline.js";
import { resolveWallOpenings } from "../src/generation/OpeningResolver.js";
import { resolveWindows } from "../src/generation/WindowResolver.js";
import type { Connector } from "../src/model/Connector.js";
import type { Room } from "../src/model/Room.js";
import type { WindowOpening } from "../src/model/WindowOpening.js";
import { renderFloorSvg } from "../src/svg/SvgRenderer.js";
import { renderSvgWindows, svgWindowStyles } from "../src/svg/SvgWindowRenderer.js";

interface BuildingFile {
  building: {
    name?: string;
    floors: Array<{
      rooms: Room[];
      connectors?: Connector[];
      openings?: WindowOpening[];
    }>;
  };
}

const input = process.argv[2] ?? "examples/reference-apartment-v1.2.json";
const output = process.argv[3] ?? "examples/reference-apartment-windows.svg";
const document = JSON.parse(readFileSync(input, "utf8")) as BuildingFile;
const source = document.building.floors[0];
if (!source) throw new Error("Reference apartment does not contain a floor.");

const generated = generateFloorGeometry(source.rooms);
const connectors = resolveConnectors(source.connectors ?? [], generated);
const opened = resolveWallOpenings(generated, connectors);
const visibleFloor = { ...generated, wallSegments: opened.wallSegments };
const windows = resolveWindows(
  (source.openings ?? []).filter((opening) => opening.type === "window"),
  generated,
  { defaultWidth: 1.0, defaultHeight: 1.0, defaultSillHeight: 0.9 },
);

let svg = renderFloorSvg(source.rooms, visibleFloor, {
  title: document.building.name ?? "Reference Apartment with Windows",
});

const allPoints = source.rooms.flatMap((room) => room.geometry.shape);
const minX = Math.min(...allPoints.map((point) => point[0]));
const minY = Math.min(...allPoints.map((point) => point[1]));
const scale = 80;
const padding = 32;
const windowElements = renderSvgWindows(windows, {
  x: (value) => (value - minX) * scale + padding,
  y: (value) => (value - minY) * scale + padding,
});

svg = svg
  .replace("</style>", `${svgWindowStyles}\n</style>`)
  .replace('<g class="labels">', `<g class="windows">${windowElements}</g>\n<g class="labels">`);

writeFileSync(output, svg, "utf8");
console.log(`Generated ${output} with ${windows.length} window(s).`);
