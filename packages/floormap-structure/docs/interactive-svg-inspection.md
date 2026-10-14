# Interactive SVG Inspection v1.2

## Scope
- Click rooms, wall segments, connectors and windows.
- Highlight the selected SVG element.
- Show read-only properties in an inspector panel.
- Keep geometry, rendering and interaction data separate.

## Not included
- Dragging, resizing or editing.
- Persistence back to JSON.
- Home Assistant entity binding.

## Selection data
Rooms expose area, boundary IDs, connectors and windows. Walls expose boundary, classification, length and adjacent room. Connectors expose type, rooms, boundaries, offset and width. Windows expose room, boundary, offset and width.
