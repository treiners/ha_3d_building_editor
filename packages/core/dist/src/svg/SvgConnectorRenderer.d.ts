import type { RenderedConnector } from "../model/RenderedConnector.js";
export interface SvgCoordinateTransform {
    readonly x: (value: number) => number;
    readonly y: (value: number) => number;
}
/** Produces SVG overlay elements for resolved connectors. */
export declare function renderSvgConnectors(connectors: readonly RenderedConnector[], transform: SvgCoordinateTransform): string;
export declare const svgConnectorStyles: string;
