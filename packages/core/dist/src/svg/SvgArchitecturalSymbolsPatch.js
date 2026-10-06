import { renderSvgArchitecturalSymbols, svgArchitecturalSymbolStyles } from "./SvgArchitecturalSymbols.js";
/** Adds permanent symbols to an SVG after walls and before labels. */
export function addArchitecturalSymbols(svg, options) {
    const scale = options.scale ?? 80;
    const padding = options.padding ?? 32;
    const symbols = renderSvgArchitecturalSymbols(options, {
        x: (value) => (value - options.minX) * scale + padding,
        y: (value) => (value - options.minY) * scale + padding,
    });
    return svg
        .replace("</style>", `${svgArchitecturalSymbolStyles}\n</style>`)
        .replace('<g class="labels">', `<g class="architectural-symbols">${symbols}</g>\n<g class="labels">`);
}
