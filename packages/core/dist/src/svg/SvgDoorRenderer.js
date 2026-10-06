function escapeXml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function formatted(value) {
    return Number(value.toFixed(3)).toString();
}
/** Renders a deliberately abstract leaf and swing arc for a hinged door. */
export function renderSvgDoorSymbol(connector, transform) {
    const x1 = transform.x(connector.start.x);
    const y1 = transform.y(connector.start.y);
    const x2 = transform.x(connector.end.x);
    const y2 = transform.y(connector.end.y);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const width = Math.hypot(dx, dy);
    if (width === 0)
        return "";
    const normalX = -dy / width;
    const normalY = dx / width;
    const direction = connector.style === "right" ? -1 : 1;
    const leafX = x1 + normalX * width * direction;
    const leafY = y1 + normalY * width * direction;
    const sweep = direction > 0 ? 1 : 0;
    const className = connector.type === "external-door"
        ? "architectural-symbol door-symbol external-door-symbol"
        : "architectural-symbol door-symbol";
    return [
        `<g class="${className}" data-inspect-type="connector" data-inspect-id="${escapeXml(connector.connectorId)}">`,
        `<line class="door-leaf" x1="${formatted(x1)}" y1="${formatted(y1)}" x2="${formatted(leafX)}" y2="${formatted(leafY)}" />`,
        `<path class="door-swing" d="M ${formatted(x2)} ${formatted(y2)} A ${formatted(width)} ${formatted(width)} 0 0 ${sweep} ${formatted(leafX)} ${formatted(leafY)}" />`,
        `</g>`,
    ].join("");
}
export function renderSvgDoors(connectors, transform) {
    return connectors
        .filter((connector) => connector.type === "door" || connector.type === "external-door")
        .map((connector) => renderSvgDoorSymbol(connector, transform))
        .join("\n");
}
export const svgDoorSymbolStyles = [
    `.door-symbol{pointer-events:stroke;cursor:pointer}`,
    `.door-leaf{fill:none;stroke:#334155;stroke-width:3;stroke-linecap:round}`,
    `.door-swing{fill:none;stroke:#64748b;stroke-width:1.5;stroke-dasharray:4 3}`,
    `.external-door-symbol .door-leaf{stroke:#166534;stroke-width:4}`,
].join("\n");
