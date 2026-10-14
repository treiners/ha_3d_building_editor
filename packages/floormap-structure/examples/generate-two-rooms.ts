import { writeFileSync } from "node:fs";

import { generateFloorGeometry }
    from "../src/generation/GeometryPipeline.js";

import { renderFloorSvg }
    from "../src/svg/SvgRenderer.js";

import type { Room }
    from "../src/model/Room.js";

const rooms: Room[] = [
    {
        id: "left",
        name: "Left Room",
        geometry: {
            shape: [
                [0, 0],
                [4, 0],
                [4, 4],
                [0, 4]
            ]
        }
    },
    {
        id: "right",
        name: "Right Room",
        geometry: {
            shape: [
                [4, 0],
                [8, 0],
                [8, 4],
                [4, 4]
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
            title: "Two Room Example"
        }
    );

writeFileSync(
    "two-room.svg",
    svg,
    "utf8"
);

console.log(
    "Generated two-room.svg"
);
