const overlaps = (a, b, t) => Math.min(a.end, b.end) - Math.max(a.start, b.start) > t;
export function validateOpenings(floor, connectors, windows, options = {}) {
    const tolerance = options.tolerance ?? 0.01;
    const defaultWindowWidth = options.defaultWindowWidth ?? 1.0;
    const internalSeverity = options.internalWindowSeverity ?? "warning";
    const boundaries = new Map(floor.boundaries.map(b => [b.id, b]));
    const issues = [];
    const intervals = [];
    for (const window of windows) {
        const boundary = boundaries.get(window.boundaryId);
        if (!boundary) {
            issues.push({ code: "WINDOW_BOUNDARY_NOT_FOUND", severity: "error", objectId: window.id, boundaryId: window.boundaryId, message: `Window '${window.id}' references missing boundary '${window.boundaryId}'.` });
            continue;
        }
        if (boundary.roomId !== window.roomId)
            issues.push({ code: "WINDOW_ROOM_BOUNDARY_MISMATCH", severity: "error", objectId: window.id, boundaryId: window.boundaryId, message: `Window '${window.id}' boundary does not belong to room '${window.roomId}'.` });
        const width = window.geometry?.width ?? defaultWindowWidth;
        if (!Number.isFinite(window.offset) || !Number.isFinite(width) || window.offset < 0 || width <= 0) {
            issues.push({ code: "WINDOW_INVALID_INTERVAL", severity: "error", objectId: window.id, boundaryId: window.boundaryId, message: `Window '${window.id}' has an invalid offset or width.` });
            continue;
        }
        const end = window.offset + width;
        if (end > boundary.length + tolerance)
            issues.push({ code: "WINDOW_OUTSIDE_BOUNDARY", severity: "error", objectId: window.id, boundaryId: window.boundaryId, message: `Window '${window.id}' does not fit on boundary '${window.boundaryId}'.` });
        const boundarySegments = floor.wallSegments.filter(s => s.boundaryId === window.boundaryId);
        const midpoint = window.offset + width / 2;
        const containing = boundarySegments.find(s => midpoint >= s.localStart - tolerance && midpoint <= s.localEnd + tolerance);
        if (containing?.classification === "shared")
            issues.push({ code: "WINDOW_ON_SHARED_WALL", severity: internalSeverity, objectId: window.id, boundaryId: window.boundaryId, message: `Window '${window.id}' is located on a shared wall.` });
        intervals.push({ id: window.id, kind: "window", boundaryId: window.boundaryId, start: window.offset, end });
    }
    for (const connector of connectors) {
        const width = connector.geometry?.width ?? connector.width;
        if (width === undefined || !Number.isFinite(width) || width <= 0)
            continue;
        for (const boundaryId of [connector.boundaryA, connector.boundaryB].filter((x) => x !== undefined)) {
            const boundary = boundaries.get(boundaryId);
            if (!boundary) {
                issues.push({ code: "CONNECTOR_BOUNDARY_NOT_FOUND", severity: "error", objectId: connector.id, boundaryId, message: `Connector '${connector.id}' references missing boundary '${boundaryId}'.` });
                continue;
            }
            let start = connector.offset;
            if (boundaryId === connector.boundaryB) {
                const shared = floor.sharedBoundaries.find(s => (s.boundaryA === connector.boundaryA && s.boundaryB === boundaryId) || (s.boundaryB === connector.boundaryA && s.boundaryA === boundaryId));
                if (shared) {
                    const aStart = shared.boundaryA === connector.boundaryA ? shared.aStart : shared.bStart;
                    const bStart = shared.boundaryA === boundaryId ? shared.aStart : shared.bStart;
                    const bEnd = shared.boundaryA === boundaryId ? shared.aEnd : shared.bEnd;
                    const relative = connector.offset - aStart;
                    start = boundary.start.x === floor.boundaries.find(b => b.id === connector.boundaryA)?.end.x && boundary.start.y === floor.boundaries.find(b => b.id === connector.boundaryA)?.end.y ? bEnd - relative - width : bStart + relative;
                }
            }
            const end = start + width;
            if (start < -tolerance || end > boundary.length + tolerance)
                issues.push({ code: "CONNECTOR_OUTSIDE_BOUNDARY", severity: "error", objectId: connector.id, boundaryId, message: `Connector '${connector.id}' does not fit on boundary '${boundaryId}'.` });
            intervals.push({ id: connector.id, kind: connector.type, boundaryId, start, end });
        }
    }
    for (let i = 0; i < intervals.length; i++)
        for (let j = i + 1; j < intervals.length; j++) {
            const a = intervals[i], b = intervals[j];
            if (a.boundaryId !== b.boundaryId || a.id === b.id || !overlaps(a, b, tolerance))
                continue;
            const pair = [a.kind, b.kind].sort().join("_").toUpperCase().replaceAll("-", "_");
            issues.push({ code: `${pair}_OVERLAP`, severity: "error", objectId: a.id, relatedObjectId: b.id, boundaryId: a.boundaryId, message: `Opening '${a.id}' overlaps '${b.id}' on boundary '${a.boundaryId}'.` });
        }
    return issues.sort((a, b) => `${a.severity}:${a.code}:${a.objectId}`.localeCompare(`${b.severity}:${b.code}:${b.objectId}`));
}
