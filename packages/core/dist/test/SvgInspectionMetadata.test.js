import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addRoomAndWallInspectionMetadata, svgInspectionMetadataStyles } from "../src/svg/SvgInspectionMetadata.js";
import { enableRoomAndWallInspection } from "../src/svg/SvgRendererInspectionPatch.js";
describe("room and wall inspection metadata", () => {
    it("adds room metadata", () => {
        const svg = addRoomAndWallInspectionMetadata('<polygon class="room" data-room-id="living" />');
        assert.match(svg, /data-inspect-type="room" data-inspect-id="living"/);
    });
    it("adds wall metadata", () => {
        const svg = addRoomAndWallInspectionMetadata('<line class="wall" data-wall-id="wall:living-b0:0" />');
        assert.match(svg, /data-inspect-type="wall" data-inspect-id="wall:living-b0:0"/);
    });
    it("does not duplicate existing metadata", () => {
        const input = '<polygon data-room-id="living" data-inspect-type="room" data-inspect-id="living" />';
        assert.equal(addRoomAndWallInspectionMetadata(input), input);
    });
    it("injects pointer-event styles", () => {
        assert.match(svgInspectionMetadataStyles, /pointer-events:all/);
        assert.match(svgInspectionMetadataStyles, /pointer-events:stroke/);
    });
    it("patches a complete SVG", () => {
        const svg = enableRoomAndWallInspection('<svg><style></style><polygon data-room-id="living"/><line data-wall-id="w1"/></svg>');
        assert.match(svg, /data-inspect-type="room"/);
        assert.match(svg, /data-inspect-type="wall"/);
        assert.match(svg, /pointer-events:stroke/);
    });
});
