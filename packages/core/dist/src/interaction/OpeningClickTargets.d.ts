import type { Connector } from "../model/Connector.js";
import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { WindowOpening } from "../model/WindowOpening.js";
export interface SvgViewportTransform {
    readonly x: (value: number) => number;
    readonly y: (value: number) => number;
    readonly scale: number;
}
export declare function renderOpeningClickTargets(floor: GeneratedFloor, connectors: readonly Connector[], windows: readonly WindowOpening[], transform: SvgViewportTransform): string;
export declare const openingTargetStyles: string;
