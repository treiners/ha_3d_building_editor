import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateWallSegments } from "../src/geometry/WallSegmentGenerator.js";
import type { Boundary } from "../src/model/Boundary.js";
import type { SharedBoundary } from "../src/model/SharedBoundary.js";

function boundary(id: string, roomId: string, x1: number, y1: number, x2: number, y2: number): Boundary {
  return { id, roomId, edgeIndex: 0, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, length: Math.hypot(x2-x1, y2-y1) };
}

function shared(
  id: string,
  boundaryA: string,
  boundaryB: string,
  roomA: string,
  roomB: string,
  aStart: number,
  aEnd: number,
  bStart = 0,
  bEnd = aEnd - aStart,
): SharedBoundary {
  return {
    id, boundaryA, boundaryB, roomA, roomB,
    start: { x: aStart, y: 0 }, end: { x: aEnd, y: 0 },
    length: aEnd-aStart, relation: "contained",
    aStart, aEnd, bStart, bEnd,
  };
}

describe("generateWallSegments", () => {
  it("creates one external segment when a boundary has no overlap", () => {
    const result = generateWallSegments([boundary("a-b0", "a", 0, 0, 10, 0)], []);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.classification, "external");
    assert.equal(result[0]?.length, 10);
  });

  it("creates one shared segment for a fully shared boundary", () => {
    const a = boundary("a-b0", "a", 0, 0, 10, 0);
    const b = boundary("b-b0", "b", 10, 0, 0, 0);
    const overlap = shared("shared:a-b0:b-b0", "a-b0", "b-b0", "a", "b", 0, 10, 0, 10);
    const result = generateWallSegments([a], [overlap]);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.classification, "shared");
    assert.equal(result[0]?.adjacentRoomId, "b");
  });

  it("splits external, shared, external around a contained overlap", () => {
    const a = boundary("a-b0", "a", 0, 0, 10, 0);
    const overlap = shared("shared:a-b0:b-b0", "a-b0", "b-b0", "a", "b", 3, 7);
    const result = generateWallSegments([a], [overlap]);
    assert.deepEqual(result.map(x => x.classification), ["external", "shared", "external"]);
    assert.deepEqual(result.map(x => x.length), [3, 4, 3]);
    assert.deepEqual(result.map(x => [x.localStart, x.localEnd]), [[0,3],[3,7],[7,10]]);
  });

  it("supports multiple neighbouring rooms on one boundary", () => {
    const hall = boundary("hall-b0", "hall", 0, 0, 10, 0);
    const first = shared("shared:hall:a", "hall-b0", "a-b0", "hall", "a", 0, 4);
    const second = shared("shared:hall:b", "hall-b0", "b-b0", "hall", "b", 4, 10);
    const result = generateWallSegments([hall], [first, second]);
    assert.deepEqual(result.map(x => x.classification), ["shared", "shared"]);
    assert.deepEqual(result.map(x => x.adjacentRoomId), ["a", "b"]);
    assert.deepEqual(result.map(x => x.length), [4, 6]);
  });

  it("uses boundary-B offsets when processing the second boundary", () => {
    const b = boundary("b-b0", "b", 10, 0, 0, 0);
    const overlap = shared("shared:a-b0:b-b0", "a-b0", "b-b0", "a", "b", 3, 7, 2, 6);
    const result = generateWallSegments([b], [overlap]);
    assert.deepEqual(result.map(x => x.classification), ["external", "shared", "external"]);
    assert.deepEqual(result.map(x => x.length), [2, 4, 4]);
    assert.equal(result[1]?.adjacentRoomId, "a");
  });

  it("generates deterministic IDs using boundary order and segment index", () => {
    const result = generateWallSegments([boundary("living-b2", "living", 0, 0, 10, 0)], []);
    assert.equal(result[0]?.id, "wall:living-b2:0");
  });

  it("rejects ambiguous shared intervals", () => {
    const a = boundary("a-b0", "a", 0, 0, 10, 0);
    const first = shared("shared:a:one", "a-b0", "one-b0", "a", "one", 2, 8);
    const second = shared("shared:a:two", "a-b0", "two-b0", "a", "two", 4, 6);
    assert.throws(
      () => generateWallSegments([a], [first, second]),
      /ambiguous overlapping shared intervals/,
    );
  });
});
