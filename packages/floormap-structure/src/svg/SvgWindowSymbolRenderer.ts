import type { ResolvedWindow } from "../model/ResolvedWindow.js";
import type { SvgWindowTransform } from "./SvgWindowRenderer.js";

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderSvgWindowSymbols(
  windows: readonly ResolvedWindow[],
  transform: SvgWindowTransform,
): string {
  return windows.map((window) => {
    const x1 = transform.x(window.start.x);
    const y1 = transform.y(window.start.y);
    const x2 = transform.x(window.end.x);
    const y2 = transform.y(window.end.y);
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length === 0) return "";
    const nx = -(y2 - y1) / length;
    const ny = (x2 - x1) / length;
    const frameOffset = 3;
    return [
      `<g class="architectural-symbol window-symbol" data-inspect-type="window" data-inspect-id="${escapeXml(window.openingId)}">`,
      `<line class="window-glazing" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`,
      `<line class="window-frame" x1="${x1 + nx * frameOffset}" y1="${y1 + ny * frameOffset}" x2="${x2 + nx * frameOffset}" y2="${y2 + ny * frameOffset}" />`,
      `<line class="window-frame" x1="${x1 - nx * frameOffset}" y1="${y1 - ny * frameOffset}" x2="${x2 - nx * frameOffset}" y2="${y2 - ny * frameOffset}" />`,
      `</g>`,
    ].join("");
  }).join("\n");
}

export const svgWindowSymbolStyles = [
  `.window-symbol{pointer-events:stroke;cursor:pointer}`,
  `.window-glazing{fill:none;stroke:#38bdf8;stroke-width:5;stroke-linecap:butt}`,
  `.window-frame{fill:none;stroke:#075985;stroke-width:1.5;stroke-linecap:butt}`,
].join("\n");
