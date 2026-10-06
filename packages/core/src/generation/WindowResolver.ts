import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { ResolvedWindow } from "../model/ResolvedWindow.js";
import type { WindowOpening } from "../model/WindowOpening.js";

export interface WindowResolverOptions {
  readonly tolerance?: number;
  readonly defaultWidth?: number;
  readonly defaultHeight?: number;
  readonly defaultSillHeight?: number;
}

export function resolveWindows(
  windows: readonly WindowOpening[],
  floor: GeneratedFloor,
  options: WindowResolverOptions = {},
): ResolvedWindow[] {
  const tolerance = options.tolerance ?? 0.01;
  const defaultWidth = options.defaultWidth ?? 1.0;
  const defaultHeight = options.defaultHeight ?? 1.0;
  const defaultSillHeight = options.defaultSillHeight ?? 0.9;
  const boundaries = new Map(floor.boundaries.map((boundary) => [boundary.id, boundary]));

  return windows.map((window) => {
    const boundary = boundaries.get(window.boundaryId);
    if (!boundary) throw new Error(`Window '${window.id}' references missing boundary '${window.boundaryId}'.`);
    if (boundary.roomId !== window.roomId) throw new Error(`Window '${window.id}' boundary does not belong to room '${window.roomId}'.`);

    const width = window.geometry?.width ?? defaultWidth;
    const height = window.geometry?.height ?? defaultHeight;
    const sillHeight = window.geometry?.sillHeight ?? defaultSillHeight;
    if (![window.offset, width, height, sillHeight].every(Number.isFinite) || window.offset < -tolerance || width <= 0 || height <= 0 || sillHeight < 0) {
      throw new Error(`Window '${window.id}' has invalid dimensions or offset.`);
    }
    if (window.offset + width > boundary.length + tolerance) {
      throw new Error(`Window '${window.id}' does not fit on boundary '${window.boundaryId}'.`);
    }

    const pointAt = (distance: number) => {
      const ratio = distance / boundary.length;
      return {
        x: boundary.start.x + (boundary.end.x - boundary.start.x) * ratio,
        y: boundary.start.y + (boundary.end.y - boundary.start.y) * ratio,
      };
    };
    const start = pointAt(Math.max(0, window.offset));
    const end = pointAt(Math.min(boundary.length, window.offset + width));

    return {
      id: `resolved:${window.id}`,
      openingId: window.id,
      roomId: window.roomId,
      boundaryId: window.boundaryId,
      start,
      end,
      centre: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
      width: Math.hypot(end.x - start.x, end.y - start.y),
      height,
      sillHeight,
      rotationDegrees: Math.atan2(boundary.end.y - boundary.start.y, boundary.end.x - boundary.start.x) * 180 / Math.PI,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
