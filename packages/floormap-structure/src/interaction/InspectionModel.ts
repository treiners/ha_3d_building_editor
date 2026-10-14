import type { Connector } from "../model/Connector.js";
import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { InspectionRecord, InspectionSelection } from "../model/InspectionSelection.js";
import type { Room } from "../model/Room.js";
import type { WindowOpening } from "../model/WindowOpening.js";

export interface InspectionModel {
  readonly records: readonly InspectionRecord[];
  readonly byKey: Readonly<Record<string, InspectionRecord>>;
}

function polygonArea(shape: readonly (readonly [number, number])[]): number {
  let twiceArea = 0;
  for (let i = 0; i < shape.length; i += 1) {
    const a = shape[i];
    const b = shape[(i + 1) % shape.length];
    if (a && b) twiceArea += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(twiceArea) / 2;
}

export function selectionKey(selection: InspectionSelection): string {
  return `${selection.type}:${selection.id}`;
}

export function buildInspectionModel(
  rooms: readonly Room[],
  floor: GeneratedFloor,
  connectors: readonly Connector[] = [],
  windows: readonly WindowOpening[] = [],
): InspectionModel {
  const records: InspectionRecord[] = [];

  for (const room of rooms) {
    records.push({
      type: "room",
      id: room.id,
      title: room.name,
      properties: {
        area: Number(polygonArea(room.geometry.shape).toFixed(3)),
        boundaries: floor.boundaries.filter((b) => b.roomId === room.id).map((b) => b.id),
        connectors: connectors.filter((c) => c.roomA === room.id || c.roomB === room.id).map((c) => c.id),
        windows: windows.filter((window) => window.roomId === room.id).map((window) => window.id),
      },
    });
  }

  for (const wall of floor.wallSegments) {
    records.push({
      type: "wall",
      id: wall.id,
      title: wall.id,
      properties: {
        room: wall.roomId,
        boundary: wall.boundaryId,
        classification: wall.classification,
        length: Number(wall.length.toFixed(3)),
        ...(wall.adjacentRoomId ? { adjacentRoom: wall.adjacentRoomId } : {}),
      },
    });
  }

  for (const connector of connectors) {
    const width = connector.geometry?.width ?? connector.width ?? 0;
    records.push({
      type: "connector",
      id: connector.id,
      title: connector.id,
      properties: {
        connectorType: connector.type,
        roomA: connector.roomA,
        ...(connector.roomB ? { roomB: connector.roomB } : {}),
        boundaryA: connector.boundaryA,
        ...(connector.boundaryB ? { boundaryB: connector.boundaryB } : {}),
        offset: connector.offset,
        width,
      },
    });
  }

  for (const window of windows) {
    records.push({
      type: "window",
      id: window.id,
      title: window.id,
      properties: {
        room: window.roomId,
        boundary: window.boundaryId,
        offset: window.offset,
        width: window.geometry?.width ?? 1,
      },
    });
  }

  records.sort((a, b) => selectionKey(a).localeCompare(selectionKey(b)));
  return {
    records,
    byKey: Object.fromEntries(records.map((record) => [selectionKey(record), record])),
  };
}
