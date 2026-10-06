import type { RenderedConnector } from "../model/RenderedConnector.js";
import type { ResolvedWindow } from "../model/ResolvedWindow.js";
export interface ArchitecturalSymbolsPatchOptions {
    readonly scale?: number;
    readonly padding?: number;
    readonly minX: number;
    readonly minY: number;
    readonly connectors?: readonly RenderedConnector[];
    readonly windows?: readonly ResolvedWindow[];
}
/** Adds permanent symbols to an SVG after walls and before labels. */
export declare function addArchitecturalSymbols(svg: string, options: ArchitecturalSymbolsPatchOptions): string;
