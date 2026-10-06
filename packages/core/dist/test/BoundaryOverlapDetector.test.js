import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectOverlap } from "../src/geometry/BoundaryOverlapDetector.js";
function boundary(id, x1, y1, x2, y2) {
    return {
        id,
        roomId: id.endsWith("a") ? "room-a" : "room-b",
        edgeIndex: 0,
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        length: Math.hypot(x2 - x1, y2 - y1),
    };
}
describe("detectOverlap", () => {
    it("detects exact full overlap", () => {
        const a = boundary("a", 4, 0, 4, 4);
        const b = boundary("b", 4, 0, 4, 4);
        const result = detectOverlap(a, b);
        assert.equal(result.type, "full");
        assert.equal(result.length, 4);
        assert.deepEqual(result.start, { x: 4, y: 0 });
        assert.deepEqual(result.end, { x: 4, y: 4 });
    });
    it("detects reversed full overlap", () => {
        const a = boundary("a", 4, 0, 4, 4);
        const b = boundary("b", 4, 4, 4, 0);
        const result = detectOverlap(a, b);
        assert.equal(result.type, "full");
        assert.equal(result.length, 4);
    });
    it("returns none for parallel non-collinear boundaries", () => {
        const a = boundary("a", 0, 0, 4, 0);
        const b = boundary("b", 0, 1, 4, 1);
        const result = detectOverlap(a, b);
        assert.deepEqual(result, { type: "none", length: 0 });
    });
    it("does not count endpoint-only contact as overlap", () => {
        const a = boundary("a", 0, 0, 4, 0);
        const b = boundary("b", 4, 0, 8, 0);
        const result = detectOverlap(a, b);
        assert.deepEqual(result, { type: "none", length: 0 });
    });
});
