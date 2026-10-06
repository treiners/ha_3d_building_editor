import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import { generateBoundaries } from "../src/geometry/BoundaryGenerator.js";
import type { Room } from "../src/model/Room.js";

describe("Reference Apartment", () => {

    const apartmentPath = path.resolve(
        "examples",
        "reference-apartment-v1.2.json"
    );

    const apartment = JSON.parse(
        fs.readFileSync(apartmentPath, "utf-8")
    );

    const floor = apartment.building.floors[0];

    it("contains five rooms", () => {
        assert.equal(floor.rooms.length, 5);
    });

    it("generates four boundaries for every room", () => {

        const counts = floor.rooms.map((room: Room) =>
            generateBoundaries(room).length
        );

        assert.deepEqual(
            counts,
            [4, 4, 4, 4, 4]
        );
    });

    it("generates twenty boundaries in total", () => {

        const total = floor.rooms
            .flatMap((room: Room) =>
                generateBoundaries(room)
            )
            .length;

        assert.equal(total, 20);
    });

    it("creates deterministic boundary ids", () => {

        const living = floor.rooms.find(
            (room: Room) => room.id === "living"
        );

        assert.ok(living);

        const boundaries =
            generateBoundaries(living);

        assert.deepEqual(
            boundaries.map(b => b.id),
            [
                "living-b0",
                "living-b1",
                "living-b2",
                "living-b3"
            ]
        );
    });

});
