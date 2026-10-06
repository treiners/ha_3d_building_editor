/** Adds unified inspection metadata to room polygons and wall lines. */
export function addRoomAndWallInspectionMetadata(svg) {
    return svg
        .replaceAll(/data-room-id="([^"]+)"(?![^>]*data-inspect-type)/g, 'data-room-id="$1" data-inspect-type="room" data-inspect-id="$1"')
        .replaceAll(/data-wall-id="([^"]+)"(?![^>]*data-inspect-type)/g, 'data-wall-id="$1" data-inspect-type="wall" data-inspect-id="$1"');
}
export const svgInspectionMetadataStyles = [
    `.room[data-inspect-type="room"]{pointer-events:all;cursor:pointer}`,
    `.wall[data-inspect-type="wall"]{pointer-events:stroke;cursor:pointer}`,
    `.room[data-inspect-type="room"]:hover{fill:#dbeafe}`,
    `.wall[data-inspect-type="wall"]:hover{filter:drop-shadow(0 0 3px #f59e0b)}`,
].join("\n");
