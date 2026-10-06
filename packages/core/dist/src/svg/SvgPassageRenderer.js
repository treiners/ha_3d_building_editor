function escapeXml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
export function renderSvgPassages(connectors, transform) {
    return connectors
        .filter((connector) => connector.type === "open-passage")
        .map((connector) => {
        const x1 = transform.x(connector.start.x);
        const y1 = transform.y(connector.start.y);
        const x2 = transform.x(connector.end.x);
        const y2 = transform.y(connector.end.y);
        return `<line class="architectural-symbol passage-symbol" data-inspect-type="connector" data-inspect-id="${escapeXml(connector.connectorId)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    })
        .join("\n");
}
export const svgPassageSymbolStyles = [
    `.passage-symbol{fill:none;stroke:#f59e0b;stroke-width:3;stroke-linecap:butt;stroke-dasharray:10 5;pointer-events:stroke;cursor:pointer}`,
].join("\n");
