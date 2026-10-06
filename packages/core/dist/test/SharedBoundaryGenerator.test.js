import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSharedBoundaries } from "../src/geometry/SharedBoundaryGenerator.js";
function boundary(id, roomId, x1, y1, x2, y2) {
    return {
        id,
        roomId,
        edgeIndex: 0,
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        length: Math.hypot(x2 - x1, y2 - y1),
    };
}
describe("generateSharedBoundaries", () => {
    it("creates one shared record for a full overlap", () => {
        const result = generateSharedBoundaries([
            boundary("living-b1", "living", 4, 0, 4, 4),
            boundary("dining-b3", "dining", 4, 4, 4, 0),
        ]);
        assert.equal(result.length, 1);
        assert.equal(result[0]?.id, "shared:dining-b3:living-b1");
        assert.equal(result[0]?.relation, "full");
        assert.equal(result[0]?.length, 4);
    });
    it("ignores boundaries belonging to the same room", () => {
        const result = generateSharedBoundaries([
            boundary("living-b0", "living", 0, 0, 4, 0),
            boundary("living-copy", "living", 0, 0, 4, 0),
        ]);
        assert.deepEqual(result, []);
    });
    it("ignores non-overlapping boundary pairs", () => {
        const result = generateSharedBoundaries([
            boundary("a-b0", "a", 0, 0, 4, 0),
            boundary("b-b0", "b", 0, 1, 4, 1),
        ]);
        assert.deepEqual(result, []);
    });
    it("creates contained and partial shared records", () => {
        const result = generateSharedBoundaries([
            boundary("a-contained", "a", 0, 0, 10, 0),
            boundary("b-contained", "b", 3, 0, 7, 0),
            boundary("c-partial", "c", 8, 0, 12, 0),
        ]);
        assert.equal(result.length, 2);
        assert.deepEqual(result.map((item) => item.relation).sort(), ["contained", "partial"]);
    });
    it("produces stable output regardless of input order", () => {
        const a = boundary("living-b1", "living", 4, 0, 4, 4);
        const b = boundary("dining-b3", "dining", 4, 4, 4, 0);
        assert.deepEqual(generateSharedBoundaries([b, a]), generateSharedBoundaries([a, b]));
    });
    it("finds multiple neighbours along one long boundary", () => {
        const result = generateSharedBoundaries([
            boundary("hall-b0", "hall", 0, 0, 10, 0),
            boundary("room-a-b2", "room-a", 0, 0, 4, 0),
            boundary("room-b-b2", "room-b", 4, 0, 10, 0),
        ]);
        const hallRelations = result.filter((item) => item.boundaryA === "hall-b0" || item.boundaryB === "hall-b0");
        assert.equal(hallRelations.length, 2);
        assert.deepEqual(hallRelations.map((item) => item.length).sort((x, y) => x - y), [4, 6]);
    });
});
