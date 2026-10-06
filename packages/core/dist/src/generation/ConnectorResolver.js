const DEFAULT_TOLERANCE = 0.01;
function pointAt(boundary, distance) {
    const ratio = distance / boundary.length;
    return {
        x: boundary.start.x + (boundary.end.x - boundary.start.x) * ratio,
        y: boundary.start.y + (boundary.end.y - boundary.start.y) * ratio,
    };
}
function renderedType(type) {
    if (type === "door" || type === "open-passage" || type === "external-door")
        return type;
    return undefined;
}
/** Resolves semantic connectors to exact coordinates on boundary A. */
export function resolveConnectors(connectors, floor, options = {}) {
    const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
    if (!Number.isFinite(tolerance) || tolerance < 0) {
        throw new RangeError("Connector tolerance must be finite and non-negative.");
    }
    const boundaries = new Map(floor.boundaries.map((boundary) => [boundary.id, boundary]));
    const output = [];
    for (const connector of connectors) {
        const type = renderedType(connector.type);
        if (type === undefined)
            continue;
        const boundaryA = boundaries.get(connector.boundaryA);
        if (boundaryA === undefined) {
            throw new Error(`Connector '${connector.id}' references missing boundary '${connector.boundaryA}'.`);
        }
        if (boundaryA.roomId !== connector.roomA) {
            throw new Error(`Connector '${connector.id}' boundary A does not belong to room A.`);
        }
        if (connector.boundaryB !== undefined) {
            const boundaryB = boundaries.get(connector.boundaryB);
            if (boundaryB === undefined) {
                throw new Error(`Connector '${connector.id}' references missing boundary '${connector.boundaryB}'.`);
            }
            if (connector.roomB === undefined || boundaryB.roomId !== connector.roomB) {
                throw new Error(`Connector '${connector.id}' boundary B does not belong to room B.`);
            }
        }
        const width = connector.geometry?.width ?? connector.width;
        if (width === undefined || !Number.isFinite(width) || width <= 0) {
            throw new Error(`Connector '${connector.id}' must have a positive width.`);
        }
        if (!Number.isFinite(connector.offset) || connector.offset < -tolerance) {
            throw new Error(`Connector '${connector.id}' has an invalid offset.`);
        }
        if (connector.offset + width > boundaryA.length + tolerance) {
            throw new Error(`Connector '${connector.id}' does not fit on boundary '${boundaryA.id}'.`);
        }
        const startDistance = Math.max(0, connector.offset);
        const endDistance = Math.min(boundaryA.length, connector.offset + width);
        const start = pointAt(boundaryA, startDistance);
        const end = pointAt(boundaryA, endDistance);
        const centre = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const rotationDegrees = Math.atan2(boundaryA.end.y - boundaryA.start.y, boundaryA.end.x - boundaryA.start.x) * 180 / Math.PI;
        output.push({
            id: `rendered:${connector.id}`,
            connectorId: connector.id,
            type,
            roomA: connector.roomA,
            ...(connector.roomB === undefined ? {} : { roomB: connector.roomB }),
            boundaryA: connector.boundaryA,
            ...(connector.boundaryB === undefined ? {} : { boundaryB: connector.boundaryB }),
            start,
            end,
            centre,
            width: endDistance - startDistance,
            rotationDegrees,
            ...(connector.geometry?.style === undefined ? {} : { style: connector.geometry.style }),
        });
    }
    return output.sort((a, b) => a.id.localeCompare(b.id));
}
