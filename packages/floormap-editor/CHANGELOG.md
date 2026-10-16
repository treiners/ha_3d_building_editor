# Changelog

This file covers the package `floormap-editor` (formerly `room-graph-mapping-v2.14-preview`) only; the suite timeline is in the root `CHANGELOG.md`.

## Unreleased

### Added
- **Add opening** (Connectors tab, `+ Door` / `+ Passage` / `+ Window`): click on a wall to add a door, passage or window at that point, with a ghost preview. A second door between the same two rooms, exterior doors and windows were not possible before (Connect makes one door per room pair; windows only came from loaded files). On a shared wall a door or passage is a connected pair, elsewhere an unpaired exterior opening (orange), windows are always unpaired. Pure `addOpening` in `src/edit.ts`, UI in `src/editor-openings.ts`, one undo step. See `docs/V2.16-OPENINGS.md`. The Connect refusal for an already connected pair now points to it.
- **Entity placement mode** (`Floor plan | Entities` switch in the sidebar header). Place entities on the finished plan as the link to Home Assistant; the floor plan is read-only in this mode (no room, wall, corner or connector edits, no mapper / Close gaps / Fit, no Gap view). Undo / redo, zoom, fit, grid, load and save stay available. See `docs/V2.16-ENTITIES.md`.
  - Types: `light`, `motion-sensor` and `camera` (directional: facing, field of view, range), `environment-sensor` (`measures`: temperature, humidity, co2, illuminance, pressure, voc), `smoke-detector` (smoke / fire), `thermostat` (thermostat / TRV), `water-leak`, and connector-bound `door-contact`, `window-contact`, `lock` (doors) and `cover` (blind / shutter, windows and doors); one entity per type per connector. The type catalogue is data-driven (`entityCatalog()`).
  - Place tab (click a type, then a room or a highlighted door / window; grid 0.1 m, Alt = free, Shift = keep placing, Esc = cancel), inspector (name, id, HA entity id, x / y, height, directional values, measures, anchor corner), List tab (filters by room and type, click a row to select and ring it), collapsible diagnostics (unknown type, orphan, outside room, height range, duplicate id, type mismatch, double contact, invalid option).
  - **Coverage hints** in the List tab (hints, not errors): rooms without a motion sensor and doors without a door contact (covered when either end of the door has one; `Outside` is skipped). Click a hint to highlight it on the plan, `+` adds the missing sensor or contact in one step, `x` ignores a hint, two checkboxes switch each rule off (`entitySettings.checks`, `entitySettings.ignoredHints`).
  - Drag to move (dropping into another room re-parents), arrow keys nudge, Delete removes; coverage cone of the selected motion sensor with handles for facing, range and field of view, optional cones for all sensors. One undo step per gesture.
  - **Multi-select**: Shift-click, rubber-band rectangle, Ctrl/Cmd+A (current room); group drag, nudge and delete; Ctrl/Cmd+C / Ctrl/Cmd+V copy and paste room-anchored entities at the pointer (re-parenting into the room under each copy, ids get the next free `-N`); align (left, centre, right, top, middle, bottom) and distribute (horizontal, vertical) that keep every entity in its own room; shared height, facing, field of view and range for the selection. One undo step per action.
  - Entities are stored relative to their room (metres from the top-left corner) and follow it: moving a room changes nothing, resizing scales them (`entitySettings.resize` = `proportional` (default) or `anchor`, which keeps the distance to the nearest corner or an explicit `anchorCorner`). Works for every resize path and is part of the resize's undo step.
  - Graph keys `entityPlacements` and `entitySettings` (both optional; `schemaVersion` stays `2.14`; files without them behave as before). `entitySettings.coordinates: "plan"` is converted to room-relative on load. *Save graph* writes the defaults explicitly (settings, heights, directional values, measures; positions rounded to 4 decimals).
  - Deleting a room or a connector also removes the entities bound to it (status: "N entities removed"; undo restores).
- New files: `src/entities.ts` (pure, embedded into the HTML), `src/editor-entities.ts` (CSS / HTML / JS of the mode), `test/entities.test.ts`, `scripts/browser-smoke-entities.mjs`, `docs/V2.16-ENTITIES.md`. `src/editor.ts` only got a few hooks; the floor-plan `pointerdown` handler returns early in entity mode, all floor-plan behaviour is unchanged.

## 3.0.0-beta.1 - 2026-10-13

First beta of the floor-plan editor. The graph `schemaVersion` stays `2.14`; every new field is optional, so existing files load unchanged.

### Added
- **Mapper and foundation:** deterministic initial layout for graphs without coordinates (`Map`), joints (state of every shared wall), undo / redo.
- **Moving and resizing:** move modes Free / Slide / Slide + pull (Alt + drag detaches on purpose); independent position and size locks; *Block overlaps*; *Drag walls* tool with auto-resize (squeeze, then push); corner handles and wall alignments through the same wall solver; hidden `Outside` room; touching rooms resize together.
- **Tidying tools:** *Close gaps* (whole plan) and *Fit* (selected room, 0.3 m: close gaps, remove small overlaps, snap to neighbour walls).
- **Room editing:** add room next to the selected one, delete room, connect two rooms, remove connector.
- **Connector details:** optional `width` per connector (used by joints, the wall solver, the mapper and connect / add room), `doorType` (hinged / sliding / pocket), door spec `door { hinge, swing, openAngle }` with default left / inward / 85 (the partner connector is the mirror image), window spec `window { type, sillHeight, headHeight, frameDepth }` with default fixed / 0.8 / 2.1 / 0.08.
- **Building defaults:** `buildingDefaults { wallThickness 0.16, wallHeight 2.4, floorThickness 0.12 }` (metadata; walls are still zero-thickness lines).
- **Feedback on the plan:** door swing symbol with a drag handle (only for the selected hinged door), optional connector width bars, ghost preview while dragging (wanted position and affected rooms), connector selection with a ring on the plan.
- **UI:** toolbar, tabs Layout / Connectors / Building, inspector, connector table, SVG icons, add-room panel, status bar, *Classic layout* toggle.
- **Save graph writes all defaults** (building values, width of every connector, door spec of every hinged door, window spec of every window); `fillDefaults` in `src/defaults.ts`.
- Tests: 179 (hand-computed scenes, seeded property tests on the reference home, embedded-source checks) and two optional jsdom smoke scripts.

### Changed
- **Add room:** only the wanted side is tried. If it is occupied the room is added as a **free room** (no connection) at a free spot, instead of moving to another side. The unit test for the old fallback was changed accordingly.
- Connector points keep half the opening width from both wall ends, also when dragged or when the width changes.
- Selected-room border is as thin as the walls; a selected connector gets a ring.
- Saved file name is `room-graph.json`; page title and header read "Room mapping 3.0 beta".
- `test/hidden.test.ts` expects 7 `ignoreIds:hidden()` calls in the editor (one per planner call site).

### Known limitations
- Rectangular rooms only; L-shapes / polygons are planned after tester feedback.
- The door swing area is not checked against walls or neighbouring rooms.
- Wall alignments are honoured by the wall tool, corner handles and the alignment action, but not inside the Slide / Slide + pull room moves.
- The old `scripts/browser-smoke.mjs` failed at scenario 6d in the sandbox used for this release (also before the changes of this release); please run it on your machine.
