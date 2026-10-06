import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addInspectionAttributes, renderInteractiveInspectionHtml } from "../src/interaction/InteractiveSvgDocument.js";
describe("interactive SVG document", () => {
    it("adds inspectable room and wall attributes", () => { const x = addInspectionAttributes('<svg><polygon data-room-id="living"/><line data-wall-id="wall-1"/></svg>'); assert.match(x, /data-inspect-type="room"/); assert.match(x, /data-inspect-type="wall"/); });
    it("embeds inspector data and click handling", () => { const html = renderInteractiveInspectionHtml('<svg><polygon data-room-id="living"/></svg>', { records: [], byKey: { "room:living": { type: "room", id: "living", title: "Living", properties: { area: 12 } } } }); assert.match(html, /Interactive Floor Inspection/); assert.match(html, /addEventListener\('click'/); assert.match(html, /room:living/); });
});
