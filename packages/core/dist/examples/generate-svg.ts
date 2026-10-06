import { writeFileSync } from "node:fs";

import { generateFloorGeometry }
    from "../src/generation/GeometryPipeline.js";

import { renderFloorSvg }
    from "../src/svg/SvgRenderer.js";

import type { Room }
    from "../src/model/Room.js";

const rooms: Room[] = [
    {
        id: "living",
        name: "Living Room",
        geometry: {
            shape: [
                [0, 0],
                [4, 0],
                [4, 3],
                [0, 3]
            ]
        }
    }
];

const floor =
    generateFloorGeometry(rooms);

const svg =
    renderFloorSvg(
        rooms,
        floor,
        {
            title: "Test Floor"
        }
    );

writeFileSync(
    "test-floor.svg",
    svg,
    "utf8"
);

console.log("Generated test-floor.svg");
