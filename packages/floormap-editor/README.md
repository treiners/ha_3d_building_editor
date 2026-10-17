# Floormap Editor 3.0 beta

Package version `3.0.0-beta.1` (formerly `room-graph-mapping-v2.14-preview`; the graph `schemaVersion` is still `2.14`, all additions are optional fields). Part of the HA 3D Building Editor suite, see the root README.

A browser editor that turns a **room graph without coordinates** (rooms, connectors and relationships, as produced by the `room-graph` editor) into a floor plan, and lets you refine it by moving rooms, dragging walls and corners, and describing doors, windows and the building. The result is one self-contained HTML file; the plan is saved as JSON.

## Quick start
```bash
npm install
npm test                                   # tsc build + node --test
node dist/examples/generate.js ../shared/reference-home-connectors.json examples/room-graph_mapping.html
```
Open `examples/room-graph_mapping.html` in a browser. Optional end-to-end checks in a fake DOM: `npm i -D jsdom`, then `node scripts/browser-smoke.mjs`, `node scripts/browser-smoke-connectors.mjs` and `node scripts/browser-smoke-entities.mjs`.

## What the editor does
- **Initial layout:** rooms without coordinates are placed by a deterministic mapper (*Map* button); rooms that already have a layout are kept.
- **Moving:** move mode *Free*, *Slide* (rooms keep their shared walls and slide along them) or *Slide + pull* (neighbours are pulled along); *Drag walls* tool (neighbours resize, squeeze, then get pushed); corner handles and wall alignments use the same solver; position and size locks; *Block overlaps*; undo / redo.
- **Tidying:** *Close gaps* (whole plan) and *Fit* (selected room, 0.3 m tolerance: close gaps, remove small overlaps, snap to neighbour walls).
- **Editing:** add a room next to the selected one (**+**; it is only connected when the wanted side is free, otherwise it is added as a free room), delete rooms, connect two rooms, remove connectors.
- **Connectors:** table of all connectors, width, door type, door swing (hinge, swing side with room names, open angle, drag handle on the plan), window sill / head height, optional width bars on the plan.
- **Building:** wall thickness, wall height, floor thickness.
- **Layout of the UI:** toolbar above the plan (undo / redo, Map / Close gaps / Fit, tool, move mode, zoom, grid, view, load / save), tabs *Layout | Connectors | Building*, an inspector for the selected room or connector, a status bar. A *Classic layout* checkbox shows the old stacked sidebar for comparison.
- **Site mode** (`Floor plan | Site | Entities`): draw outside areas (deck, driveway, garden / plot, pond, path) as flat rectangles or ellipses around the house. They are footprints with a name and a kind, not part of the room graph, and they never affect the room solvers. Cameras, lights and outdoor sensors can be placed in them. See `docs/V2.16-AREAS.md`.
- **Add opening** (Connectors tab): click on a wall to add a door, passage or window, including a second door between the same two rooms and exterior doors and windows. See `docs/V2.16-OPENINGS.md`.
- **Entity placement mode** (`Floor plan | Entities` switch at the top of the sidebar): place lights, motion sensors, cameras, environment sensors (temperature, humidity, co2, ...), smoke / fire detectors, thermostats, water leak sensors, door / window contacts, locks and blinds on the finished plan, as the link to Home Assistant. The floor plan is read-only in this mode. Entities are stored relative to their room and follow it when it is moved or resized (proportionally, or keeping the distance to a corner, selectable). Motion sensors show a coverage cone with handles for facing, range and field of view. Place and List tabs, inspector, diagnostics. See `docs/V2.16-ENTITIES.md`.

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

Entities (written by the *Entities* mode, positions in metres from the room's top-left corner, `facingDegrees` clockwise from up):
```json
{
  "entitySettings": { "coordinates": "room", "gridStep": 0.1, "resize": "proportional" },
  "entityPlacements": [
    { "id": "living-ceiling-light", "type": "light", "roomId": "living", "position": [2.2, 1.3], "height": 2.2 },
    { "id": "living-motion-sensor", "type": "motion-sensor", "roomId": "living", "position": [0.2, 1.1], "height": 2.1,
      "facingDegrees": 90, "fieldOfViewDegrees": 100, "range": 3.5, "haEntityId": "binary_sensor.living_motion" },
    { "id": "living-environment-sensor", "type": "environment-sensor", "roomId": "living", "position": [3.5, 0.2], "height": 1.5,
      "measures": ["temperature", "humidity", "co2"] },
    { "id": "bedroom-door-contact", "type": "door-contact", "connectorId": "bedroom-front-left-door" }
  ]
}
```
Types: `light`, `motion-sensor`, `camera`, `environment-sensor`, `smoke-detector`, `thermostat`, `water-leak` (room entities) and `door-contact`, `window-contact`, `lock`, `cover` (bound to a connector). `entitySettings.resize` is `proportional` (default) or `anchor` (keep the distance to a corner, optional per-entity `anchorCorner`). Files without these keys are unchanged.

## Documentation
`CLAUDE.md` (rules, source map, how the embedded browser code works), `CHANGELOG.md`, and `docs/`: `V2.14-MAPPER.md`, `V2.15-FOUNDATION.md`, `V2.15-MOVE-MODES.md`, `V2.15-WALLS.md`, `V2.15-EDITING.md`, `V2.15-CONNECTORS.md`, `V2.15-UI.md`, `V2.16-ENTITIES.md` (entity placement mode), `V2.16-OPENINGS.md` (add doors, passages and windows), `V2.16-AREAS.md` (outside areas, Site mode), `HANDOFF.md` (historical), `HANDOVER.md` (entity mode plan, now implemented except the Home Assistant entity source).

## Not in this beta
Rectangular rooms only. L-shaped / polygon rooms are planned after tester feedback (design together with the requirements that come out of it). Entity placement has no Home Assistant entity source yet (importing HA entities to bind, "not placed yet" list), one floor only. Outside areas are rectangles and ellipses without rotation (polygons come with polygon rooms). Packaging as a Home Assistant (HACS) panel versus a standalone tool is undecided.
