import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { resolveConnectors } from "../src/generation/ConnectorResolver.js";
import { generateFloorGeometry } from "../src/generation/GeometryPipeline.js";
import { resolveWallOpenings } from "../src/generation/OpeningResolver.js";
import { renderFloorSvg } from "../src/svg/SvgRenderer.js";
const input = process.argv[2];
if (!input) {
    console.error("Usage: node dist/examples/json-to-svg-openings.js <building.json> [output.svg]");
    process.exit(1);
}
const document = JSON.parse(readFileSync(input, "utf8"));
const source = document.building.floors[0];
if (!source)
    throw new Error("No floor found.");
const generated = generateFloorGeometry(source.rooms);
const connectors = resolveConnectors(source.connectors ?? [], generated);
const opened = resolveWallOpenings(generated, connectors);
const visibleFloor = { ...generated, wallSegments: opened.wallSegments };
const output = process.argv[3] ?? input.slice(0, input.length - extname(input).length) + "-openings.svg";
// Connector overlays remain enabled as debug guides. Remove `connectors` below to show gaps only.
const svg = renderFloorSvg(source.rooms, visibleFloor, { title: document.building.name ?? basename(input), connectors });
writeFileSync(output, svg, "utf8");
console.log(`Generated ${output}: ${opened.openings.length} boundary opening(s).`);
