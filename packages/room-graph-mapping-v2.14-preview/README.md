# Room Graph Mapping 3.0 beta

Package version `3.0.0-beta.1` (the folder keeps its old name `room-graph-mapping-v2.14-preview`; the graph `schemaVersion` is still `2.14`, all additions are optional fields).

A browser editor that turns a **room graph without coordinates** (rooms, connectors and relationships, as produced by the room-side-connectors editor) into a floor plan, and lets you refine it by moving rooms, dragging walls and corners, and describing doors, windows and the building. The result is one self-contained HTML file; the plan is saved as JSON.

## Quick start
```bash
npm install
npm test                                   # tsc build + node --test (179 tests)
node dist/examples/generate.js ../reference-home-connectors.json examples/room-graph_mapping.html
```
Open `examples/room-graph_mapping.html` in a browser. Optional end-to-end checks in a fake DOM: `npm i -D jsdom`, then `node scripts/browser-smoke.mjs` and `node scripts/browser-smoke-connectors.mjs`.

## What the editor does
- **Initial layout:** rooms without coordinates are placed by a deterministic mapper (*Map* button); rooms that already have a layout are kept.
- **Moving:** move mode *Free*, *Slide* (rooms keep their shared walls and slide along them) or *Slide + pull* (neighbours are pulled along); *Drag walls* tool (neighbours resize, squeeze, then get pushed); corner handles and wall alignments use the same solver; position and size locks; *Block overlaps*; undo / redo.
- **Tidying:** *Close gaps* (whole plan) and *Fit* (selected room, 0.3 m tolerance: close gaps, remove small overlaps, snap to neighbour walls).
- **Editing:** add a room next to the selected one (**+**; it is only connected when the wanted side is free, otherwise it is added as a free room), delete rooms, connect two rooms, remove connectors.
- **Connectors:** table of all connectors, width, door type, door swing (hinge, swing side with room names, open angle, drag handle on the plan), window sill / head height, optional width bars on the plan.
- **Building:** wall thickness, wall height, floor thickness.
- **Layout of the UI:** toolbar above the plan (undo / redo, Map / Close gaps / Fit, tool, move mode, zoom, grid, view, load / save), tabs *Layout | Connectors | Building*, an inspector for the selected room or connector, a status bar. A *Classic layout* checkbox shows the old stacked sidebar for comparison.

## File format additions (all optional)
*Save graph* writes every default explicitly:
```json
{
  "buildingDefaults": { "wallThickness": 0.16, "wallHeight": 2.4, "floorThickness": 0.12 },
  "rooms": [{ "connectors": [
    { "id": "...", "type": "door", "width": 0.9, "offset": 1.5,
      "door": { "hinge": "left", "swing": "inward", "openAngle": 85 } },
    { "id": "...", "type": "window", "width": 1.2, "offset": 2.0,
      "window": { "type": "fixed", "sillHeight": 0.8, "headHeight": 2.1, "frameDepth": 0.08 } }
  ] }]
}
```
The two connectors of a door are saved as mirror images (hinge and swing flipped), so both describe one physical door. `doorType` (`hinged`, `sliding`, `pocket`) is metadata; sliding and pocket doors have no swing. Walls are still drawn as zero-thickness lines; the building values are for later 3D / Home Assistant use.

## Documentation
`CLAUDE.md` (rules, source map, how the embedded browser code works), `CHANGELOG.md`, and `docs/`: `V2.14-MAPPER.md`, `V2.15-FOUNDATION.md`, `V2.15-MOVE-MODES.md`, `V2.15-WALLS.md`, `V2.15-EDITING.md`, `V2.15-CONNECTORS.md`, `V2.15-UI.md`, `HANDOFF.md` (historical).

## Not in this beta
Rectangular rooms only. L-shaped / polygon rooms are planned after tester feedback (design together with the requirements that come out of it). Packaging as a Home Assistant (HACS) panel versus a standalone tool is undecided.
