import type { RenderedConnector } from "../model/RenderedConnector.js";

export interface SvgCoordinateTransform {
  readonly x: (value: number) => number;
  readonly y: (value: number) => number;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Produces SVG overlay elements for resolved connectors. */
export function renderSvgConnectors(
  connectors: readonly RenderedConnector[],
  transform: SvgCoordinateTransform,
): string {
  return connectors.map((connector) => {
    const className = connector.type === "open-passage"
      ? "connector connector-open-passage"
      : connector.type === "external-door"
        ? "connector connector-external-door"
        : "connector connector-door";

    return `<line class="${className}" data-connector-id="${escapeXml(connector.connectorId)}" x1="${transform.x(connector.start.x)}" y1="${transform.y(connector.start.y)}" x2="${transform.x(connector.end.x)}" y2="${transform.y(connector.end.y)}" />`;
  }).join("\n");
}

export const svgConnectorStyles = [
  `.connector{fill:none;stroke-linecap:butt}`,
  `.connector-door{stroke:#16a34a;stroke-width:8}`,
  `.connector-external-door{stroke:#15803d;stroke-width:8}`,
  `.connector-open-passage{stroke:#f97316;stroke-width:8}`,
].join("\n");
