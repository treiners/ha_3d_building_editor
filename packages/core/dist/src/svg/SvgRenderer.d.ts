import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { PointTuple } from "../model/Point.js";
import type { RenderedConnector } from "../model/RenderedConnector.js";
import type { Room } from "../model/Room.js";
export interface SvgRenderOptions {
    readonly scale?: number;
    readonly padding?: number;
    readonly background?: string;
    readonly showBoundaryIds?: boolean;
    readonly title?: string;
    readonly connectors?: readonly RenderedConnector[];
    /** Debug overlay only. Actual openings are represented by cut wall segments. */
    readonly showConnectorGuides?: boolean;
}
export declare function polygonCentroid(shape: readonly PointTuple[]): {
    readonly x: number;
    readonly y: number;
};
export declare function renderFloorSvg(rooms: readonly Room[], floor: GeneratedFloor, options?: SvgRenderOptions): string;
