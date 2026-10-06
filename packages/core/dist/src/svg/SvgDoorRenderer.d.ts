import type { RenderedConnector } from "../model/RenderedConnector.js";
import type { SvgCoordinateTransform } from "./SvgConnectorRenderer.js";
/** Renders a deliberately abstract leaf and swing arc for a hinged door. */
export declare function renderSvgDoorSymbol(connector: RenderedConnector, transform: SvgCoordinateTransform): string;
export declare function renderSvgDoors(connectors: readonly RenderedConnector[], transform: SvgCoordinateTransform): string;
export declare const svgDoorSymbolStyles: string;
