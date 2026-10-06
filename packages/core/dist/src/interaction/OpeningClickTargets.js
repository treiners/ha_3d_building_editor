function pointAt(boundary, distance) {
    const ratio = distance / boundary.length;
    return {
        x: boundary.start.x + (boundary.end.x - boundary.start.x) * ratio,
        y: boundary.start.y + (boundary.end.y - boundary.start.y) * ratio,
    };
}
export function renderOpeningClickTargets(floor, connectors, windows, transform) {
    const boundaries = new Map(floor.boundaries.map((boundary) => [boundary.id, boundary]));
    const elements = [];
    for (const connector of connectors) {
        const boundary = boundaries.get(connector.boundaryA);
        const width = connector.geometry?.width ?? connector.width;
        if (!boundary || width === undefined)
            continue;
        const start = pointAt(boundary, connector.offset);
        const end = pointAt(boundary, connector.offset + width);
        elements.push(`<line class="opening-target connector-target" data-inspect-type="connector" data-inspect-id="${connector.id}" data-edit-boundary="${boundary.id}" data-edit-offset="${connector.offset}" data-edit-width="${width}" x1="${transform.x(start.x)}" y1="${transform.y(start.y)}" x2="${transform.x(end.x)}" y2="${transform.y(end.y)}" />`);
    }
    for (const window of windows) {
        const boundary = boundaries.get(window.boundaryId);
        const width = window.geometry?.width ?? 1;
        if (!boundary)
            continue;
        const start = pointAt(boundary, window.offset);
        const end = pointAt(boundary, window.offset + width);
        elements.push(`<line class="opening-target window-target" data-inspect-type="window" data-inspect-id="${window.id}" data-edit-boundary="${boundary.id}" data-edit-offset="${window.offset}" data-edit-width="${width}" x1="${transform.x(start.x)}" y1="${transform.y(start.y)}" x2="${transform.x(end.x)}" y2="${transform.y(end.y)}" />`);
    }
    return elements.join("\n");
}
export const openingTargetStyles = [
    `.opening-target{fill:none;stroke:transparent;stroke-width:18;stroke-linecap:butt;cursor:grab;pointer-events:stroke}`,
    `.opening-target:hover{stroke:#f59e0b66}`,
    `.opening-target.selected{stroke:#f59e0baa}`,
].join("\n");
