import { renderSvgConnectors, svgConnectorStyles } from "./SvgConnectorRenderer.js";
const DEFAULT_SCALE = 80;
const DEFAULT_PADDING = 32;
function escapeXml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}
export function polygonCentroid(shape) {
    let crossSum = 0;
    let xSum = 0;
    let ySum = 0;
    for (let index = 0; index < shape.length; index += 1) {
        const current = shape[index];
        const next = shape[(index + 1) % shape.length];
        if (current === undefined || next === undefined)
            continue;
        const cross = current[0] * next[1] - next[0] * current[1];
        crossSum += cross;
        xSum += (current[0] + next[0]) * cross;
        ySum += (current[1] + next[1]) * cross;
    }
    if (Math.abs(crossSum) > 1e-12) {
        return { x: xSum / (3 * crossSum), y: ySum / (3 * crossSum) };
    }
    const sum = shape.reduce((result, point) => ({ x: result.x + point[0], y: result.y + point[1] }), { x: 0, y: 0 });
    return { x: sum.x / shape.length, y: sum.y / shape.length };
}
export function renderFloorSvg(rooms, floor, options = {}) {
    const scale = options.scale ?? DEFAULT_SCALE;
    const padding = options.padding ?? DEFAULT_PADDING;
    const title = options.title ?? "Floor plan";
    if (!Number.isFinite(scale) || scale <= 0)
        throw new RangeError("SVG scale must be positive.");
    if (!Number.isFinite(padding) || padding < 0)
        throw new RangeError("SVG padding must be non-negative.");
    const points = rooms.flatMap((room) => room.geometry.shape);
    if (points.length === 0)
        throw new Error("Cannot render an empty floor.");
    const minX = Math.min(...points.map((point) => point[0]));
    const maxX = Math.max(...points.map((point) => point[0]));
    const minY = Math.min(...points.map((point) => point[1]));
    const maxY = Math.max(...points.map((point) => point[1]));
    const width = (maxX - minX) * scale + padding * 2;
    const height = (maxY - minY) * scale + padding * 2;
    const sx = (x) => (x - minX) * scale + padding;
    const sy = (y) => (y - minY) * scale + padding;
    const roomShapes = rooms.map((room) => `<polygon class="room" data-room-id="${escapeXml(room.id)}" points="${room.geometry.shape.map((point) => `${sx(point[0])},${sy(point[1])}`).join(" ")}" />`).join("\n");
    const roomLabels = rooms.map((room) => {
        const point = polygonCentroid(room.geometry.shape);
        return `<text class="room-label" data-room-id="${escapeXml(room.id)}" x="${sx(point.x)}" y="${sy(point.y)}">${escapeXml(room.name)}</text>`;
    }).join("\n");
    const walls = floor.wallSegments.map((wall) => `<line class="wall wall-${wall.classification}" data-wall-id="${escapeXml(wall.id)}" x1="${sx(wall.start.x)}" y1="${sy(wall.start.y)}" x2="${sx(wall.end.x)}" y2="${sy(wall.end.y)}" />`).join("\n");
    const connectorElements = options.showConnectorGuides
        ? renderSvgConnectors(options.connectors ?? [], { x: sx, y: sy })
        : "";
    const boundaryLabels = options.showBoundaryIds
        ? floor.boundaries.map((boundary) => `<text class="boundary-label" data-boundary-id="${escapeXml(boundary.id)}" x="${sx((boundary.start.x + boundary.end.x) / 2)}" y="${sy((boundary.start.y + boundary.end.y) / 2)}">${escapeXml(boundary.id)}</text>`).join("\n")
        : "";
    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}">`,
        `<title>${escapeXml(title)}</title>`,
        `<style>`,
        `.background{fill:${options.background ?? "#f5f7fa"}}`,
        `.room{fill:#eef3f8;stroke:none}`,
        `.wall{fill:none;stroke-linecap:square;stroke-linejoin:miter}`,
        `.wall-external{stroke:#20252b;stroke-width:6}`,
        `.wall-shared{stroke:#2563eb;stroke-width:4}`,
        svgConnectorStyles,
        `.room-label{font:600 14px system-ui,sans-serif;text-anchor:middle;dominant-baseline:middle;fill:#17202a;pointer-events:none}`,
        `.boundary-label{font:9px ui-monospace,monospace;text-anchor:middle;dominant-baseline:middle;fill:#6b7280;paint-order:stroke;stroke:#fff;stroke-width:3px;pointer-events:none}`,
        `</style>`,
        `<rect class="background" width="100%" height="100%" />`,
        `<g class="rooms">${roomShapes}</g>`,
        `<g class="walls">${walls}</g>`,
        `<g class="connector-guides">${connectorElements}</g>`,
        `<g class="labels">${roomLabels}${boundaryLabels}</g>`,
        `</svg>`,
    ].join("\n");
}
