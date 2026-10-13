# Changelog

This file covers the package `room-graph-mapping-v2.14-preview` only (the root `CHANGELOG.md` belongs to core).

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
