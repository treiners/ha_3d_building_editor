export function renderSvgWindows(windows, transform) {
    return windows.map((window) => `<line class="window" data-window-id="${window.openingId}" x1="${transform.x(window.start.x)}" y1="${transform.y(window.start.y)}" x2="${transform.x(window.end.x)}" y2="${transform.y(window.end.y)}" />`).join("\n");
}
export const svgWindowStyles = [
    `.window{fill:none;stroke:#38bdf8;stroke-width:5;stroke-linecap:butt}`,
    `.window-frame{stroke:#075985;stroke-width:1}`,
].join("\n");
