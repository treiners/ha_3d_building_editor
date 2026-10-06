import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderSvgWindows, svgWindowStyles } from "../src/svg/SvgWindowRenderer.js";
const window = { id: "resolved:w1", openingId: "w1", roomId: "living", boundaryId: "living-b0", start: { x: 1, y: 0 }, end: { x: 2, y: 0 }, centre: { x: 1.5, y: 0 }, width: 1, height: 1, sillHeight: .9, rotationDegrees: 0 };
describe("renderSvgWindows", () => {
    it("renders a light-blue window line", () => { const svg = renderSvgWindows([window], { x: (v) => v * 10, y: (v) => v * 10 }); assert.match(svg, /class="window"/); assert.match(svg, /x1="10" y1="0" x2="20" y2="0"/); });
    it("provides window styling", () => { assert.match(svgWindowStyles, /#38bdf8/); });
});
