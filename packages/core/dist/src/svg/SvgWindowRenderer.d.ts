import type { ResolvedWindow } from "../model/ResolvedWindow.js";
export interface SvgWindowTransform {
    readonly x: (value: number) => number;
    readonly y: (value: number) => number;
}
export declare function renderSvgWindows(windows: readonly ResolvedWindow[], transform: SvgWindowTransform): string;
export declare const svgWindowStyles: string;
