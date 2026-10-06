import type { RenderedConnector } from "../model/RenderedConnector.js";
import type { ResolvedWindow } from "../model/ResolvedWindow.js";
import type { SvgCoordinateTransform } from "./SvgConnectorRenderer.js";
export interface ArchitecturalSymbolRenderOptions {
    readonly connectors?: readonly RenderedConnector[];
    readonly windows?: readonly ResolvedWindow[];
}
export declare function renderSvgArchitecturalSymbols(options: ArchitecturalSymbolRenderOptions, transform: SvgCoordinateTransform): string;
export declare const svgArchitecturalSymbolStyles: string;
