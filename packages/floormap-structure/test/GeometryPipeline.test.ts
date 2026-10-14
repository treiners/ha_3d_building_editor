import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFloorGeometry } from "../src/generation/GeometryPipeline.js";
import type { Room } from "../src/model/Room.js";

function room(
  id: string,
  shape: readonly (readonly [number, number])[],
): Room {
  return {
    id,
    name: id,
    geometry: { shape },
  };
}

describe("generateFloorGeometry", () => {
  it("generates a complete floor result for one rectangle room", () => {
    const result = generateFloorGeometry([
      room("living", [[0,0],[4,0],[4,3],[0,3]]),
    ]);

    assert.equal(result.boundaries.length, 4);
    assert.equal(result.sharedBoundaries.length, 0);
    assert.equal(result.wallSegments.length, 4);
    assert.ok(result.wallSegments.every((segment) => segment.classification === "external"));
  });

  it("detects a shared wall between two adjacent rooms", () => {
    const result = generateFloorGeometry([
      room("left", [[0,0],[4,0],[4,4],[0,4]]),
      room("right", [[4,0],[8,0],[8,4],[4,4]]),
    ]);

    assert.equal(result.boundaries.length, 8);
    assert.equal(result.sharedBoundaries.length, 1);
    assert.equal(result.sharedBoundaries[0]?.relation, "full");

    const sharedSegments = result.wallSegments.filter(
      (segment) => segment.classification === "shared",
    );
    assert.equal(sharedSegments.length, 2);
    assert.deepEqual(
      sharedSegments.map((segment) => segment.adjacentRoomId).sort(),
      ["left", "right"],
    );
  });

  it("supports partial adjacency and wall segmentation", () => {
    const result = generateFloorGeometry([
      room("large", [[0,0],[10,0],[10,4],[0,4]]),
      room("small", [[3,4],[7,4],[7,7],[3,7]]),
    ]);

    assert.equal(result.sharedBoundaries.length, 1);
    assert.equal(result.sharedBoundaries[0]?.relation, "contained");

    const largeBottom = result.wallSegments.filter(
      (segment) => segment.boundaryId === "large-b2",
    );
    assert.deepEqual(
      largeBottom.map((segment) => segment.classification),
      ["external", "shared", "external"],
    );
    assert.deepEqual(
      largeBottom.map((segment) => segment.length),
      [3, 4, 3],
    );
  });

  it("generates twenty boundaries for the five-room reference layout", () => {
    const result = generateFloorGeometry([
      room("living", [[0,0],[4,0],[4,4],[0,4]]),
      room("dining", [[4,0],[8,0],[8,4],[4,4]]),
      room("kitchen", [[0,4],[5,4],[5,7],[0,7]]),
      room("bedroom", [[5,4],[8,4],[8,7],[5,7]]),
      room("bathroom", [[5,7],[8,7],[8,9],[5,9]]),
    ]);

    assert.equal(result.boundaries.length, 20);
    assert.ok(result.sharedBoundaries.length > 0);
    assert.ok(result.wallSegments.length >= result.boundaries.length);
    assert.ok(result.wallSegments.every((segment) => segment.length > 0));
  });

  it("produces stable shared boundaries and wall segments when room order changes", () => {
    const left = room("left", [[0,0],[4,0],[4,4],[0,4]]);
    const right = room("right", [[4,0],[8,0],[8,4],[4,4]]);

    const forward = generateFloorGeometry([left, right]);
    const reversed = generateFloorGeometry([right, left]);

    assert.deepEqual(reversed.sharedBoundaries, forward.sharedBoundaries);
    assert.deepEqual(reversed.wallSegments, forward.wallSegments);
  });

  it("passes custom overlap tolerance through the pipeline", () => {
    const result = generateFloorGeometry(
      [
        room("upper", [[0,0],[4,0],[4,2],[0,2]]),
        room("lower", [[0,2.005],[4,2.005],[4,4],[0,4]]),
      ],
      { overlap: { tolerance: 0.01 } },
    );

    assert.equal(result.sharedBoundaries.length, 1);
  });
});
