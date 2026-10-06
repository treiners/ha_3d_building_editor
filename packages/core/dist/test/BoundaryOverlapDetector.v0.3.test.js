import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectOverlap } from "../src/geometry/BoundaryOverlapDetector.js";
function boundary(id, x1, y1, x2, y2) {
    return {
        id,
        roomId: `room-${id}`,
        edgeIndex: 0,
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        length: Math.hypot(x2 - x1, y2 - y1),
    };
}
describe("detectOverlap v0.3", () => {
    it("detects contained overlap", () => {
        const a = boundary("a", 0, 0, 10, 0);
        const b = boundary("b", 3, 0, 7, 0);
        const result = detectOverlap(a, b);
        assert.equal(result.type, "contained");
        assert.equal(result.length, 4);
        assert.deepEqual(result.start, { x: 3, y: 0 });
        assert.deepEqual(result.end, { x: 7, y: 0 });
        assert.equal(result.aStart, 3);
        assert.equal(result.aEnd, 7);
        assert.equal(result.bStart, 0);
        assert.equal(result.bEnd, 4);
    });
    it("detects reversed contained overlap", () => {
        const a = boundary("a", 0, 0, 10, 0);
        const b = boundary("b", 7, 0, 3, 0);
        const result = detectOverlap(a, b);
        assert.equal(result.type, "contained");
        assert.equal(result.length, 4);
        assert.deepEqual(result.start, { x: 3, y: 0 });
        assert.deepEqual(result.end, { x: 7, y: 0 });
        assert.equal(result.bStart, 0);
        assert.equal(result.bEnd, 4);
    });
    it("detects partial overlap", () => {
        const a = boundary("a", 0, 0, 6, 0);
        const b = boundary("b", 4, 0, 10, 0);
        const result = detectOverlap(a, b);
        assert.equal(result.type, "partial");
        assert.equal(result.length, 2);
        assert.deepEqual(result.start, { x: 4, y: 0 });
        assert.deepEqual(result.end, { x: 6, y: 0 });
        assert.equal(result.aStart, 4);
        assert.equal(result.aEnd, 6);
        assert.equal(result.bStart, 0);
        assert.equal(result.bEnd, 2);
    });
    it("accepts collinear overlap within tolerance", () => {
        const a = boundary("a", 0, 0, 4, 0);
        const b = boundary("b", 0, 0.005, 4, 0.005);
        const result = detectOverlap(a, b);
        assert.equal(result.type, "full");
        assert.ok(Math.abs(result.length - 4) < 1e-9);
    });
    it("rejects parallel boundaries outside tolerance", () => {
        const a = boundary("a", 0, 0, 4, 0);
        const b = boundary("b", 0, 0.02, 4, 0.02);
        assert.deepEqual(detectOverlap(a, b), { type: "none", length: 0 });
    });
});
