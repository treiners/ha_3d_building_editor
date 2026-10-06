import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { OpeningResolution } from "../model/OpeningResolution.js";
import type { RenderedConnector } from "../model/RenderedConnector.js";
export interface OpeningResolverOptions {
    readonly tolerance?: number;
}
/**
 * Cuts resolved door and passage intervals out of generated wall segments.
 * Both boundary A and boundary B are cut for an internal connector.
 */
export declare function resolveWallOpenings(floor: GeneratedFloor, connectors: readonly RenderedConnector[], options?: OpeningResolverOptions): OpeningResolution;
