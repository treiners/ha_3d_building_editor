# Handoff: room-graph-mapping v2.14 preview

State after Phases 0-3 and the user-feedback rounds on movement. Read `CLAUDE.md` first for rules and commands; this note is the narrative.

## 1. The project in three milestones
1. `packages/core`: underlying floor-plan model and visualisation (`examples/reference-apartment-openings-editor.html`).
2. `packages/room-side-connectors-v2.1-preview`: editor for rooms, connectors and windows. Together with the relationship editor it produced `packages/reference-home-connectors.json`, a floor-plan **graph without coordinates** (schema 2.1: `sizeCategory` small/medium/large, connector `position` 0..1).
3. `packages/room-graph-mapping-v2.14-preview` (this package): loads that graph, builds a first layout automatically, then lets the user refine it by moving rooms, dragging walls and corners, aligning walls, and adding / removing rooms and connectors. Precision is not the goal at this stage.

Constraint from the user: work only in this package; leave the existing editing behaviour (Move mode Free, Tool Move rooms) alone unless they confirm a change.

## 2. What exists now
**Initial mapping** (`src/mapper.ts`, `core.mapOnlyMissing`, browser Load handler): rooms with a layout are kept, only missing ones are placed; "Run mapper" re-places every room that is not position-locked. Details in `docs/V2.14-MAPPER.md`.

**Foundation** (`src/joints.ts`, `src/history.ts`): joints (shared walls) with the same status rule as the editor's `aligned()`; snapshot undo/redo; "Joints: N attached" line. `docs/V2.15-FOUNDATION.md`.

**Move modes** (`src/moves.ts`, `docs/V2.15-MOVE-MODES.md`): Free (original), Slide along walls, Slide + pull neighbours; Alt+drag detaches on purpose. Added after feedback:
- a move that would shift the whole floor plan (the largest attached group) is refused;
- the hidden `Outside` room never blocks (overlap) and does not count as part of the plan;
- when another room blocks the way the room keeps sliding along it (`slideAlong`); a room without attached joints is swept from its current position (`from`), so it can be dragged around obstacles in one continuous move;
- openings travel with the rooms when both move together along the wall;
- connectors are restored from the drag-start snapshot on every move (`applyPlan`), Free / Alt drags keep green pairs aligned with `holdPairs`; no cumulative re-aligning per pointer move (that caused jumps and, after a regression, pairs 0.2 m apart);
- a connector can only be dragged within the shared part of its two walls.

**Locks and overlaps** (`docs/V2.15-WALLS.md`): independent position / size locks (applied immediately, no Apply needed), "Block overlaps", "Resize touching rooms too" (rooms that merely touch, without a relationship, follow a dragged wall).

**Wall tool, corners, alignments** (`src/walls.ts`): `planWall` (drag any wall, squeeze then push, locks, maximum sizes, openings, touching rooms, alignment constraints, exact end on non-grid distances), `planCorner` (corner handle = two wall drags, in Slide modes), `planAlign` ("Add alignment" snaps to the first selected room = reference; "Re-align" for inactive groups; the reference is drawn thick and marked "(reference)").

**Room / connector editing** (`src/edit.ts`, `docs/V2.15-EDITING.md`): add a room next to the selected one (with a door / passage), connect two touching rooms (both connectors + relationship in one step), remove a connector (pair), delete a room (connectors, relationships, joint overrides, alignment memberships). Rooms stay rectangles.

## 3. How to verify the current state
```bash
npm install && npm test        # every test/*.test.ts
node dist/examples/generate.js ../reference-home-connectors.json examples/room-graph_mapping.html
npm i -D jsdom && node scripts/browser-smoke.mjs
```
Then open the generated HTML. Load shows 13 attached joints, no overlaps. Try: Slide + pull, drag Dining there and back (graph identical); Tool "Drag walls" on the Living / Dining wall; select two rooms and "Add alignment"; add a room next to the Kitchen with a door; drag the new room around the plan.

## 4. Decisions and their reasons
- Pure, tested modules embedded into the HTML with `toString()` instead of rewriting the big script. Extracting the script into real modules is deferred.
- Joint status follows the editor's rule exactly (an earlier stricter rule disagreed with the mapper line in 14 of 300 random edits).
- Planners sweep the drag from its start in grid steps and stop at the first blocked step (exact stops, no tunnelling, dragging back returns to the start). Exception: rooms without attached joints sweep from their current position.
- Default Move mode stays **Free**; no default chosen for Slide vs Slide + pull (the rigid-group fallback of Slide + pull remains the main source of surprises).
- Alignment groups: only walls that are level now are constrained; Free mode never changes or removes a group (inactive groups show a Re-align button).
- Free mode: green pairs stay aligned during a drag (recomputed from the start snapshot); corner resize in Free mode is unchanged (one room, per-move align).
- Default sizes small 3x2, medium 4x3, large 6x4 m (the editor's own). Min/max room size factors (0.5 / 2.5) and opening widths (door 0.9, passage 1.2 m) are assumptions.
- Process lessons: new files must be written to the user's disk (not the assistant's sandbox); a test written for old behaviour was rewritten once on the user's request (whole-plan block).

## 5. Known limitations
- Rooms are rectangles only. `Outside` is placed like any room but hidden; connectors to it and windows cannot be created in the room editing yet, and Outside cannot be selected.
- Free-mode corner handles resize one room only (no pushing, may overlap).
- Alignment groups are ignored by Slide / Slide + pull room moves (Free moves the whole group).
- Movement is in grid steps (0.2 m default; Grid selector goes to 0.05 m).
- Pairs of connectors exactly 0.2 m apart sit on the tolerance edge and can show red (Align connectors fixes them).
- `render()` recomputes joints each time (fine for ~15 rooms).
- The mapper's final polish moves one room at a time, so locked rooms that leave no space can leave an overlap (reported, not hidden).

## 6. Next steps (suggested order)
1. Stronger visual for inactive alignments (colour bar); room / connector editing also in the graph editor (same schema).
2. Alignment groups in Slide / Slide + pull moves; connectors to `Outside`, windows.
3. Feedback tools: ghost preview while dragging, "Fit to neighbours", "Close gaps".
4. **Polygon rooms, 90 degree corners only.** Start with L-shapes as 2-3 rectangle parts glued together without a drawn wall (reuses joints, planners, solver); full wall-graph model (vertices, edges, rooms as loops, connectors referencing an edge, schema 2.15 with migration) only if that is not enough. Rectilinear polygons keep the per-axis difference-constraint structure of `planWall`.
5. Decide whether to drop the rigid-group fallback of Slide + pull.
6. Housekeeping: extract the editor script from the template string into modules once the feature set stabilises; CHANGELOG entry for this package if wanted (the root `CHANGELOG.md` belongs to core 1.4.0 and was not touched).

## 7. Starting prompt for a new chat
> I'm continuing work on `packages/room-graph-mapping-v2.14-preview` in `ha_3d_building_editor` (filesystem access is enabled). Read `CLAUDE.md` and `docs/HANDOFF.md` first, run `npm test`, then work on: <next step>. Keep Free mode and existing behaviour unchanged, edit `src/editor.ts` only with exact-match substring edits, write files to my disk (not your sandbox), and verify by running the tests and `scripts/browser-smoke.mjs` against the files on disk.
