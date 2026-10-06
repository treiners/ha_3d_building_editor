import { readFileSync, writeFileSync } from "node:fs";

import { resolveConnectors } from "../src/generation/ConnectorResolver.js";
import { generateFloorGeometry } from "../src/generation/GeometryPipeline.js";
import { resolveWallOpenings } from "../src/generation/OpeningResolver.js";
import { resolveWindows } from "../src/generation/WindowResolver.js";
import { renderEditableInspectionHtml } from "../src/interaction/EditableInspectionDocument.js";
import { buildInspectionModel } from "../src/interaction/InspectionModel.js";
import {
  openingTargetStyles,
  renderOpeningClickTargets,
} from "../src/interaction/OpeningClickTargets.js";
import type { Connector } from "../src/model/Connector.js";
import type { Room } from "../src/model/Room.js";
import type { WindowOpening } from "../src/model/WindowOpening.js";
import { addArchitecturalSymbols } from "../src/svg/SvgArchitecturalSymbolsPatch.js";
import { renderFloorSvg } from "../src/svg/SvgRenderer.js";
import { enableRoomAndWallInspection } from "../src/svg/SvgRendererInspectionPatch.js";

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
const output = process.argv[3] ?? "examples/reference-apartment-openings-editor.html";

const buildingDocument = JSON.parse(
  readFileSync(input, "utf8"),
) as BuildingFile;

const source = buildingDocument.building.floors[0];
if (source === undefined) {
  throw new Error("No floor found.");
}

const connectorDefinitions = source.connectors ?? [];
const windowDefinitions = (source.openings ?? []).filter(
  (opening): opening is WindowOpening => opening.type === "window",
);

const generatedFloor = generateFloorGeometry(source.rooms);
const resolvedConnectors = resolveConnectors(
  connectorDefinitions,
  generatedFloor,
);
const openingResolution = resolveWallOpenings(
  generatedFloor,
  resolvedConnectors,
);
const visibleFloor = {
  ...generatedFloor,
  wallSegments: openingResolution.wallSegments,
};
const resolvedWindows = resolveWindows(
  windowDefinitions,
  generatedFloor,
);

let svg = renderFloorSvg(
  source.rooms,
  visibleFloor,
  {
    title: buildingDocument.building.name ?? "Reference Apartment",
  },
);

svg = enableRoomAndWallInspection(svg);

const allPoints = source.rooms.flatMap((room) => room.geometry.shape);
const minX = Math.min(...allPoints.map((point) => point[0]));
const minY = Math.min(...allPoints.map((point) => point[1]));
const scale = 80;
const padding = 32;

svg = addArchitecturalSymbols(
  svg,
  {
    minX,
    minY,
    scale,
    padding,
    connectors: resolvedConnectors,
    windows: resolvedWindows,
  },
);

const openingTargets = renderOpeningClickTargets(
  visibleFloor,
  connectorDefinitions,
  windowDefinitions,
  {
    scale,
    x: (value: number) => (value - minX) * scale + padding,
    y: (value: number) => (value - minY) * scale + padding,
  },
);

svg = svg
  .replace(
    "</style>",
    `${openingTargetStyles}\n</style>`,
  )
  .replace(
    '<g class="labels">',
    `<g class="opening-targets">${openingTargets}</g>\n<g class="labels">`,
  );

const inspectionModel = buildInspectionModel(
  source.rooms,
  visibleFloor,
  connectorDefinitions,
  windowDefinitions,
);

const html = renderEditableInspectionHtml(
  svg,
  inspectionModel,
  buildingDocument,
  {
    title: buildingDocument.building.name ?? "Openings Editor",
  },
);

writeFileSync(output, html, "utf8");
console.log(
  `Generated ${output} with ${resolvedConnectors.length} connector symbol(s), ` +
  `${resolvedWindows.length} window symbol(s), and ${openingTargets.length > 0 ? "active" : "no"} opening targets.`,
);
