import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { resolveConnectors } from "../src/generation/ConnectorResolver.js";
import { generateFloorGeometry } from "../src/generation/GeometryPipeline.js";
import { resolveWallOpenings } from "../src/generation/OpeningResolver.js";
import type { Connector } from "../src/model/Connector.js";
import type { Room } from "../src/model/Room.js";
import { renderFloorSvg } from "../src/svg/SvgRenderer.js";

interface BuildingFile {
  building: {
    name?: string;
    floors: Array<{ rooms: Room[]; connectors?: Connector[] }>;
  };
}

const input = process.argv[2];
if (!input) {
  console.error("Usage: node dist/examples/json-to-svg-actual-openings.js <building.json> [output.svg] [--guides]");
  process.exit(1);
}

const document = JSON.parse(readFileSync(input, "utf8")) as BuildingFile;
const source = document.building.floors[0];
if (!source) throw new Error("Building file does not contain a floor.");

const generated = generateFloorGeometry(source.rooms);
const connectors = resolveConnectors(source.connectors ?? [], generated);
const openingResolution = resolveWallOpenings(generated, connectors);
const visibleFloor = { ...generated, wallSegments: openingResolution.wallSegments };
const output = process.argv[3]?.startsWith("--")
  ? input.slice(0, input.length - extname(input).length) + "-actual-openings.svg"
  : process.argv[3] ?? input.slice(0, input.length - extname(input).length) + "-actual-openings.svg";
const showGuides = process.argv.includes("--guides");

const svg = renderFloorSvg(source.rooms, visibleFloor, {
  title: document.building.name ?? basename(input),
  connectors,
  showConnectorGuides: showGuides,
});
writeFileSync(output, svg, "utf8");
console.log(`Generated ${output}: ${openingResolution.openings.length} opening record(s), connector guides ${showGuides ? "shown" : "hidden"}.`);
