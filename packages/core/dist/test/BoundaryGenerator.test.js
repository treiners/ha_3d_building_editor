import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoundaryGenerationError, generateBoundaries, } from "../src/geometry/BoundaryGenerator.js";
function rectangleRoom() {
    return {
        id: "living",
        name: "Living Room",
        type: "living-room",
        geometry: {
            shape: [
                [0, 0],
                [4, 0],
                [4, 3],
                [0, 3],
            ],
        },
    };
}
describe("generateBoundaries", () => {
    it("generates one boundary per polygon edge", () => {
        const boundaries = generateBoundaries(rectangleRoom());
        assert.equal(boundaries.length, 4);
        assert.deepEqual(boundaries.map((boundary) => boundary.id), ["living-b0", "living-b1", "living-b2", "living-b3"]);
    });
    it("uses consecutive vertices and closes the final edge", () => {
        const boundaries = generateBoundaries(rectangleRoom());
        assert.deepEqual(boundaries[0]?.start, { x: 0, y: 0 });
        assert.deepEqual(boundaries[0]?.end, { x: 4, y: 0 });
        assert.deepEqual(boundaries[3]?.start, { x: 0, y: 3 });
        assert.deepEqual(boundaries[3]?.end, { x: 0, y: 0 });
    });
    it("calculates boundary lengths in metres", () => {
        const boundaries = generateBoundaries(rectangleRoom());
        assert.deepEqual(boundaries.map((boundary) => boundary.length), [4, 3, 4, 3]);
    });
    it("supports non-rectangular polygons", () => {
        const room = {
            id: "study",
            name: "Study",
            geometry: {
                shape: [
                    [0, 0],
                    [3, 0],
                    [4, 2],
                    [1, 4],
                    [0, 2],
                ],
            },
        };
        const boundaries = generateBoundaries(room);
        assert.equal(boundaries.length, 5);
        assert.equal(boundaries[1]?.length, Math.hypot(1, 2));
        assert.deepEqual(boundaries[4]?.end, { x: 0, y: 0 });
    });
    it("does not mutate the input room", () => {
        const room = rectangleRoom();
        const before = JSON.stringify(room);
        generateBoundaries(room);
        assert.equal(JSON.stringify(room), before);
    });
    it("rejects polygons with fewer than three vertices", () => {
        const room = {
            id: "invalid",
            name: "Invalid",
            geometry: { shape: [[0, 0], [1, 0]] },
        };
        assert.throws(() => generateBoundaries(room), (error) => error instanceof BoundaryGenerationError &&
            error.message.includes("at least three vertices"));
    });
    it("rejects zero-length edges", () => {
        const room = {
            id: "invalid",
            name: "Invalid",
            geometry: {
                shape: [
                    [0, 0],
                    [2, 0],
                    [2, 0],
                    [0, 2],
                ],
            },
        };
        assert.throws(() => generateBoundaries(room), (error) => error instanceof BoundaryGenerationError &&
            error.message.includes("zero-length edge"));
    });
    it("rejects non-finite coordinates", () => {
        const room = {
            id: "invalid",
            name: "Invalid",
            geometry: {
                shape: [
                    [0, 0],
                    [Number.NaN, 0],
                    [0, 2],
                ],
            },
        };
        assert.throws(() => generateBoundaries(room), (error) => error instanceof BoundaryGenerationError &&
            error.message.includes("non-finite vertex"));
    });
});
