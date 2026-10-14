import { addRoomAndWallInspectionMetadata, svgInspectionMetadataStyles } from "./SvgInspectionMetadata.js";

/**
 * Applies v1.3.2 metadata to an SVG already produced by renderFloorSvg.
 * This deliberately avoids replacing the full SvgRenderer implementation.
 */
export function enableRoomAndWallInspection(svg: string): string {
  const withMetadata = addRoomAndWallInspectionMetadata(svg);
  return withMetadata.replace("</style>", `${svgInspectionMetadataStyles}\n</style>`);
}
