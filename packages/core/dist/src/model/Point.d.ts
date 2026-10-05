/** A position in floor coordinates, measured in metres. */
export interface Point {
    readonly x: number;
    readonly y: number;
}
/** JSON-friendly point representation used by the domain model. */
export type PointTuple = readonly [x: number, y: number];
