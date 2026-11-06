# HANDOVER 3.2: heights, openings, touch, dock, autosave, entities per connector

Written at the end of the v3.2 work on `packages/floormap-editor`. Read `CLAUDE.md` first (rules, commands, source map, how the page script and the embedded functions work), then `docs/V3.2-HEIGHTS-WINDOWS-TOUCH.md` (feature notes of this round), `docs/FILE-FORMAT.md` (generated, always current) and `docs/HANDOVER-2.18.md` (older state: objects, room shapes phases 1-5, open phase 6 / 7). `docs/HANDOFF.md` and `docs/HANDOVER.md` are historical.

## 1. State (what exists now)
All new file keys are optional; defaults for openings are written explicitly on *Save graph* (`src/defaults.ts`).

**Heights**
- `room.elevation` / `area.elevation` (height from floor, 0..10 m, default 0, only written when not 0). Room box > *Heights* card (`editor-heights.ts`, appended after every render), Site box > *Height from floor*. A raised room / area shows `+0.45 m` only while the **m** toggle is on (`editor-dims.ts`; label placed in the room, avoiding notches, font 0.12).
- Wall heights: `room.wallHeights {top,right,bottom,left}` and `room.wallHeight` (resolution wall > room > floor height > `buildingDefaults.wallHeight` > 2.4: `wallHeightOf`, `src/heights.ts`). The room box has no wall fields any more.
- **Walls mode** (5th app mode, `src/editor-walls.ts`, pure `src/wallheights.ts`): rooms read-only, every wall (`roomId:side`, shapes: one height per side) is a coloured strip with the value; click / Shift-click selects, the wall box sets the height. A wall touching the facing wall of another room (0.08 m, shared > 0.05 m) is ONE physical wall: both sides are set together (`setWallHeights`), free walls alone. Contract warning `height-shared-wall-height`; `height-elevation-range`, `height-window-above-wall`. The user said he still has to think about this mode.

**Openings**
- Window `type`: fixed, slide-vertical, slide-horizontal, tilt, hinged, tilt-turn; `hinge` / `swing` (hinged, tilt-turn), `slide` (slide-horizontal). Door: `glazing: "glass"` (glass sliding door = doorType sliding + glazing), `door.tilt` (tilt and turn), `door.slide` for sliding and pocket doors (no hinge / swing / openAngle; width follows the movement: one half slides over the other). `slide` is stored as `start` | `end` (smaller / larger x or y) and shown as left / right seen from the room of the selected connector. Plan symbols for the selected connector. UI rows are added by `editor-opening-opts.ts` (core connector code only got small edits).
- **Connect to** (connector box, unconnected door / passage): link to an existing free connector of the neighbour room or create the partner (`src/link.ts`: `linkConnectors`, `addPartner`; the partner needs `roomId`; notch walls use `wallAt` from the real world point).
- Objects keep 0.1 m free in front of sliding / pocket doors (no swing zone).

**Entities** (`src/entities.ts`, `editor-entities.ts`)
- Any number of entities per connector and per object, also the same type twice. `role` (`open` default, not written; `tilt` only on something that can tilt) for door / window contacts. Checks: `role-mismatch`, `invalid-option`; the old `double-contact` check is gone.
- Plan: 1-2 entities side by side along the wall, 3 or more = one count badge; hover 0.4 s (or tap) opens a ring around the connector. Connector box > **Entities** block (list, trash, `+ type` buttons). Objects: `+ other entity...` select. While a type is armed, clicks also place on top of existing icons.

**UI**
- Right-hand **dock** (`editor-dock.ts`): all floating boxes in one scrolling column, title click collapses (kept in `localStorage floormap-dock`, no auto-collapse). Zoom buttons moved to the status bar. **T** toggle (all text labels). Higher contrast for connector bars (`editor-css.ts`).
- **Touch** (`editor-touch.ts`, `src/viewport.ts` `viewGesture`): one finger pans on empty background, two fingers pinch + pan (a started drag is undone), Pan and one-shot Shift buttons, coarse-pointer CSS, portrait layout. Alt has no touch replacement.
- **Autosave** (`editor-autosave.ts`): the whole graph in `localStorage` (`floormap-autosave:` + path), restored on load through the same steps as Load; `?fresh=1` discards it. Undo history is not kept.
- Shift while dragging a room corner locks the move to x or y (`editor-core-pointer.ts`).

**Planners** (`src/walls.ts`)
- The dragged room keeps its other wall (stops at its minimum size) unless it is size-locked (then it is carried).
- Overlap blocking and "rooms that merely touch are glued" use the real shape of rooms with an `outline` (extent over the shared part of the other axis), so a room can be dragged into a notch and a U-shaped room is not pulled by a room under its bounding box.

## 2. Open points and things that were never seen working
Everything below was written without a shell or browser (the assistant only edits files; the user runs `npm test`, `npm run smoke` and pastes failures). Treat as unverified until the user confirms:
- Dock (collapse, scrolling, boxes that move there: `panel`, `stairbox`, `panel-conn`, `ent-inspector`, `site-inspector`, `obj-inspector`, `wall-inspector`), cluster ring hover, touch gestures on a real tablet, Walls mode, Autosave together with floors and the image underlay (not sure the underlay is part of the graph), Connect to on notch walls (`wallAt`), the glue fix for the U-shape scene (assumed no door pair between the rooms).
- Walls mode follow-ups: per-segment heights on notch walls, sloped walls (`{start,end}`), heights in the solver / 3D visualisation (separate package, reads the JSON only).
- Possible additions: coverage hint "tilting window without tilt sensor", Alt replacement on touch, Shift axis lock for whole-room moves, undo history in autosave.
- From earlier: phase 6 (merge / split rooms) and phase 7 (wall solver / mapper fully aware of notches), see `docs/HANDOVER-2.18.md`.
- The user keeps a bug list from testing; ask for the next batch.

## 3. Things learned (gotchas)
- New page modules are added in `src/editor.ts` (import + `${xJs}` in this order: ... `touchJs`, `mergeJs`, `issuesJs`, `dimsJs`, `exportJs`, `wallsJs`, `boxesJs`, `dockJs`, `autosaveJs`, ...). `touchJs` must come before `wallsJs` (capture-phase pointer listeners on the canvas run in registration order). Modules use the hooks `onRender`, `onBeforeAppMode` and globals of the core; they must not contain backticks, dollar-brace or backslashes, and must be self-contained (own CSS via a `<style>` element, DOM added by script).
- Core logic is not edited when avoidable: new behaviour hangs on `onRender` (rows / blocks appended to the connector card, heights card in the room box), capture listeners, or small exact-substring edits. `rec(before)` takes the JSON string of the graph before the change; a connector object needs `roomId` (a connector without it makes every render throw and freezes the UI).
- Pure functions are pasted into the page with `toString()`: add them to the manifest in `src/embed.ts`; tests that evaluate embedded source with a fixed sibling list (`test/contract.test.ts`, entities, walls) need the new siblings (`contract.test.ts` includes `wallList`, `sharedWallIssues`, all `shape.ts` functions, `heightIssues`, `wallHeightOf`). Explicit `any` per source file is budgeted (`test/any-budget.test.ts`): type new code (`TConn` in `entities.ts`, `HGraph` in `heights.ts`, `WGraph` in `wallheights.ts`).
- jsdom (smoke scripts) has no `matchMedia`; guard such calls. A thrown error at page load stops the whole page script and shows up as many unrelated smoke failures.
- Tests that expressed the old one-entity-per-connector rule were changed on purpose (entities, entities-objects, smoke-entities). The generated docs: after changing `src/file-format-doc.ts` run `npm run build && npm run docs:format`.
- `window.dimUiLen()` exposes the **m** toggle of `editor-dims.ts` to other modules (area labels in Site mode).
- Commands: `npm run build && npm run docs:format && npm run golden:update && npm test`, then `npm run smoke`. `golden:update` after every intended page change.

## 4. Starting prompt for the new chat
> I'm continuing `packages/floormap-editor` in `ha_3d_building_editor` (filesystem access is enabled). Read `CLAUDE.md`, `docs/HANDOVER-3.2.md`, `docs/V3.2-HEIGHTS-WINDOWS-TOUCH.md` and skim `docs/HANDOVER-2.18.md`, run `npm run build && npm run docs:format && npm run golden:update && npm test` and `npm run smoke`, and tell me the baseline. Then fix the bugs I paste below (hand-computed test first, then the fix). Keep token use low, ask as little as possible, edit `src/editor-*.ts` only with exact-match substring edits and verify against the files on disk. My bugs: ...
