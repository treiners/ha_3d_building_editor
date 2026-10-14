import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BoundaryGenerationError,
  generateBoundaries,
} from "../src/geometry/BoundaryGenerator.js";
import type { Room } from "../src/model/Room.js";

function rectangleRoom(): Room {
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
    assert.deepEqual(
      boundaries.map((boundary) => boundary.id),
      ["living-b0", "living-b1", "living-b2", "living-b3"],
    );
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

    assert.deepEqual(
      boundaries.map((boundary) => boundary.length),
      [4, 3, 4, 3],
    );
  });

  it("supports non-rectangular polygons", () => {
    const room: Room = {
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
    const room: Room = {
      id: "invalid",
      name: "Invalid",
      geometry: { shape: [[0, 0], [1, 0]] },
    };

    assert.throws(
      () => generateBoundaries(room),
      (error: unknown) =>
        error instanceof BoundaryGenerationError &&
        error.message.includes("at least three vertices"),
    );
  });

  it("rejects zero-length edges", () => {
    const room: Room = {
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

    assert.throws(
      () => generateBoundaries(room),
      (error: unknown) =>
        error instanceof BoundaryGenerationError &&
        error.message.includes("zero-length edge"),
    );
  });
  
  

  it("supports very small room polygons", () => {
    const room: Room = {
        id: "tiny-room",
        name: "Tiny Room",
        geometry: {
            shape: [
                [0, 0],
                [0.1, 0],
                [0.1, 0.1],
                [0, 0.1]
            ]
        }
    };

    const boundaries = generateBoundaries(room);

    assert.equal(boundaries.length, 4);
    assert.ok(Math.abs(boundaries[0]!.length - 0.1) < 1e-9);
    assert.ok(Math.abs(boundaries[1]!.length - 0.1) < 1e-9);	
    assert.ok(Math.abs(boundaries[2]!.length - 0.1) < 1e-9);
    assert.ok(Math.abs(boundaries[3]!.length - 0.1) < 1e-9);
  });


  it("supports concave room polygons", () => {
    const room: Room = {
        id: "concave-room",
        name: "Concave Room",
        geometry: {
            shape: [
                [0, 0],
                [4, 0],
                [4, 2],
                [2, 2],
                [2, 4],
                [0, 4]
            ]
        }
    };

    const boundaries = generateBoundaries(room);

    assert.equal(boundaries.length, 6);

    assert.equal(boundaries[0]?.id, "concave-room-b0");
    assert.equal(boundaries[5]?.id, "concave-room-b5");

    assert.deepEqual(boundaries[5]?.start, {
        x: 0,
        y: 4
    });

    assert.deepEqual(boundaries[5]?.end, {
        x: 0,
        y: 0
    });
  });


  it("rejects non-finite coordinates", () => {
    const room: Room = {
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

    assert.throws(
      () => generateBoundaries(room),
      (error: unknown) =>
        error instanceof BoundaryGenerationError &&
        error.message.includes("non-finite vertex"),
    );
  });
});
