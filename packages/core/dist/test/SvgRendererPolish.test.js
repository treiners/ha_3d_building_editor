import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { polygonCentroid, renderFloorSvg } from "../src/svg/SvgRenderer.js";
const room = {
    id: "living",
    name: "Living Room",
    geometry: { shape: [[0, 0], [4, 0], [4, 3], [0, 3]] },
};
const floor = {
    boundaries: [
        { id: "living-b0", roomId: "living", edgeIndex: 0, start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, length: 4 },
    ],
    sharedBoundaries: [],
    wallSegments: [
        { id: "wall:living-b0:0", boundaryId: "living-b0", roomId: "living", classification: "external", start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, length: 4, localStart: 0, localEnd: 4 },
    ],
};
describe("SVG renderer polish", () => {
    it("calculates the centroid of a rectangle", () => {
        assert.deepEqual(polygonCentroid(room.geometry.shape), { x: 2, y: 1.5 });
    });
    it("places the room label at the polygon centroid", () => {
        const svg = renderFloorSvg([room], floor, { scale: 80, padding: 32 });
        assert.match(svg, /class="room-label"[^>]*x="192" y="152"/);
    });
    it("hides boundary labels by default", () => {
        const svg = renderFloorSvg([room], floor);
        assert.doesNotMatch(svg, /class="boundary-label"/);
    });
    it("places visible boundary labels at boundary midpoints", () => {
        const svg = renderFloorSvg([room], floor, { scale: 80, padding: 32, showBoundaryIds: true });
        assert.match(svg, /class="boundary-label"[^>]*x="192" y="32"[^>]*>living-b0<\/text>/);
    });
    it("uses square line caps and miter joins", () => {
        const svg = renderFloorSvg([room], floor);
        assert.match(svg, /stroke-linecap:square;stroke-linejoin:miter/);
    });
    it("escapes labels and titles", () => {
        const unsafe = { ...room, name: "Living & <Dining>" };
        const svg = renderFloorSvg([unsafe], floor, { title: 'A "Home" & More' });
        assert.match(svg, /Living &amp; &lt;Dining&gt;/);
        assert.match(svg, /A &quot;Home&quot; &amp; More/);
    });
});
