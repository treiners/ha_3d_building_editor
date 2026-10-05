import type { PointTuple } from "./Point.js";
export interface RoomGeometry {
    readonly shape: readonly PointTuple[];
}
export interface Room {
    readonly id: string;
    readonly name: string;
    readonly type?: string;
    readonly geometry: RoomGeometry;
}
