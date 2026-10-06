import { renderSvgDoors, svgDoorSymbolStyles } from "./SvgDoorRenderer.js";
import { renderSvgPassages, svgPassageSymbolStyles } from "./SvgPassageRenderer.js";
import { renderSvgWindowSymbols, svgWindowSymbolStyles } from "./SvgWindowSymbolRenderer.js";
export function renderSvgArchitecturalSymbols(options, transform) {
    return [
        renderSvgPassages(options.connectors ?? [], transform),
        renderSvgDoors(options.connectors ?? [], transform),
        renderSvgWindowSymbols(options.windows ?? [], transform),
    ].filter((value) => value.length > 0).join("\n");
}
export const svgArchitecturalSymbolStyles = [
    `.architectural-symbol.selected{filter:drop-shadow(0 0 5px #f59e0b)}`,
    `.architectural-symbol:hover{filter:drop-shadow(0 0 4px #f59e0b)}`,
    svgDoorSymbolStyles,
    svgPassageSymbolStyles,
    svgWindowSymbolStyles,
].join("\n");
