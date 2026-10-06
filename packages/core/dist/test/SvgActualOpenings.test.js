import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderFloorSvg } from "../src/svg/SvgRenderer.js";
const room = { id: "room", name: "Room", geometry: { shape: [[0, 0], [4, 0], [4, 4], [0, 4]] } };
const floor = {
    boundaries: [], sharedBoundaries: [],
    wallSegments: [
        { id: "left", boundaryId: "room-b0", roomId: "room", classification: "external", start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, length: 1, localStart: 0, localEnd: 1 },
        { id: "right", boundaryId: "room-b0", roomId: "room", classification: "external", start: { x: 2, y: 0 }, end: { x: 4, y: 0 }, length: 2, localStart: 2, localEnd: 4 },
    ],
};
const connector = { id: "rendered:door", connectorId: "door", type: "door", roomA: "room", boundaryA: "room-b0", start: { x: 1, y: 0 }, end: { x: 2, y: 0 }, centre: { x: 1.5, y: 0 }, width: 1, rotationDegrees: 0 };
describe("actual SVG openings", () => {
    it("renders cut wall pieces as a visible gap", () => {
        const svg = renderFloorSvg([room], floor, { connectors: [connector] });
        assert.match(svg, /data-wall-id="left"/);
        assert.match(svg, /data-wall-id="right"/);
        assert.doesNotMatch(svg, /<line class="connector connector-door"/);
    });
    it("shows coloured connector guides only when requested", () => {
        const svg = renderFloorSvg([room], floor, { connectors: [connector], showConnectorGuides: true });
        assert.match(svg, /connector-door/);
    });
    it("places connector debug guides after walls", () => {
        const svg = renderFloorSvg([room], floor, { connectors: [connector], showConnectorGuides: true });
        assert.ok(svg.indexOf('class="walls"') < svg.indexOf('class="connector-guides"'));
    });
});
