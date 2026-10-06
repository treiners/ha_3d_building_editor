import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderFloorSvg } from "../src/svg/SvgRenderer.js";
const room = { id: "a", name: "Room A", geometry: { shape: [[0, 0], [4, 0], [4, 4], [0, 4]] } };
const floor = { boundaries: [], sharedBoundaries: [], wallSegments: [] };
const door = { id: "rendered:door", connectorId: "door", type: "door", roomA: "a", boundaryA: "a-b0", start: { x: 1, y: 0 }, end: { x: 2, y: 0 }, centre: { x: 1.5, y: 0 }, width: 1, rotationDegrees: 0 };
describe("SVG connector integration", () => {
    it("renders connector overlays after walls", () => { const svg = renderFloorSvg([room], floor, { connectors: [door], showConnectorGuides: true }); assert.match(svg, /class="connector-guides"/); assert.match(svg, /connector-door/); assert.ok(svg.indexOf('class="walls"') < svg.indexOf('class="connector-guides"')); });
    it("renders no connector elements when omitted", () => { const svg = renderFloorSvg([room], floor); assert.match(svg, /<g class="connector-guides"><\/g>/); });
});
