import type { Connector } from "../model/Connector.js";
import type { GeneratedFloor } from "../model/GeneratedFloor.js";
import type { RenderedConnector } from "../model/RenderedConnector.js";
export interface ConnectorResolverOptions {
    readonly tolerance?: number;
}
/** Resolves semantic connectors to exact coordinates on boundary A. */
export declare function resolveConnectors(connectors: readonly Connector[], floor: GeneratedFloor, options?: ConnectorResolverOptions): RenderedConnector[];
