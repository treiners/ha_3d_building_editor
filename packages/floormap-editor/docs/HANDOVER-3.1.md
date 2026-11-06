# HANDOVER 3.1: state after merge rooms, shaped areas, shared walls, issues panel, export

Package `packages/floormap-editor`, version `3.1.0` (UI title "Room mapping 3.1"; the graph `schemaVersion` is written as `3.0`, 2.14 files are read and upgraded; every addition since is an optional key, see `docs/FILE-FORMAT.md`). Read `CLAUDE.md` first (rules, commands, source map, how the page script and the embedded functions work), then the doc of the area you touch. `docs/HANDOFF.md`, `docs/HANDOVER.md` and `docs/HANDOVER-2.18.md` are historical (HANDOVER-2.18 still has useful gotchas in section 4).

## 1. State of the editor
- **Four app modes:** Floor plan, Site (outside areas), Entities, Objects. Sidebar tabs in Floor plan: **Plan | Building**. Plan holds the combined **Add** card (+ Room, + Door, + Passage, + Window, Connect two selected rooms), Wall alignment and the Connectors table; selecting a connector no longer switches tab. Default move mode is **Slide + pull**.
- **Rooms:** rectangles or shapes (`outline`: L, U, T, bays). Shape tool: drag a wall, Shift + drag = bump / notch. **A wall (or bump) shared with ONE other room moves for both rooms** (`reshapeWithPartner` in `src/room-shape.ts`; geometry decides, doors or not; Alt = move only this room; several rooms on the stretch, the Outside room, size / corner locks refuse with a message). **Merge rooms:** Shift-click two rooms, "Merge into <first>" (`mergeRooms`; union must be one shape without hole; same floor; connectors, objects, entities re-based).
- **Drag walls / corners (`planWall`, `planCorner`):** settings *Block overlaps*, *Resize touching rooms too*, *Slide doors along when a wall would cut them off* (`slideOpenings`), *Min / Max room size* (empty = automatic). Joints between rooms whose bounding boxes differ by more than 0.1 m (shaped rooms, "ok" through their outline) get no glue constraint. `planWall` still works on bounding boxes: it does not know notches (phase 7 is only done for the Shape tool).
- **Areas (Site):** kinds deck, driveway, garden, pond, tree, path, other. **Shaped areas** (`areas[].outline`, `src/area-shape.ts`: `reshapeArea`, `moveAreaWall`, `pullAreaWall`, `mergeAreas`; merge only same kind and same roofed state, no ellipses); areas snap to the real walls of rooms and other areas, handles and wall strips are drawn on top (`siteWallLayer`); areas are checked against real room outlines (a deck in a notch is no overlap). **Trees:** ellipse = canopy, centre = trunk (only the trunk must lie outside rooms), key C hides canopies (then they do not catch clicks), optional `species` text.
- **Objects:** the `fan` type (ceiling fan, drawn as a fan) with entity types `fan-speed` and `fan-direction` (object-only, one each per fan: `objectOnly`, `objectTypes`, `single` in the entity catalogue).
- **Views and output:** layer toggles (Rooms / Site / Entities / Objects), `m` (wall lengths) and `m²` (room areas) toggles, **Areas card** in the Building tab, **Export** (SVG, PNG, one-page PDF; `editor-export.ts`, built in, includes north arrow from the compass and a scale bar), **Issues panel** (`editor-issues.ts`; `checkContract(graph, true)` adds `target` to issues), room colours in settings (browser only), double-click a room = zoom to it (second double-click or background = fit).
- **Floors, stairs, underlay, compass, contract, save:** unchanged since 3.1 (see `docs/V3.1-FLOORS.md`, `CLAUDE.md`).

## 2. New files of this phase
| File | Role |
|---|---|
| `src/area-shape.ts` | pure: `areaOutlineOf`, `reshapeArea`, `moveAreaWall`, `pullAreaWall`, `mergeAreas` (embedded) |
| `src/dimensions.ts` | pure: `roomAreas`, `wallLabels` (embedded) |
| `src/room-shape.ts` | + `mergeRooms`, `shapeWallPartners`, `reshapeWithPartner`; `moveRoomWall` / `pullRoomWall` take `alone` |
| `src/editor-merge.ts` | merge button in the room box (`mergeJs`) |
| `src/editor-issues.ts`, `src/editor-dims.ts`, `src/editor-export.ts` | Issues panel, dimension toggles + Areas card, export (each `...Js` string; no backticks, dollar-brace or backslashes; `exportSvgString` is a top-level function so smoke tests can call it) |
| `test/merge-rooms`, `area-shape`, `dimensions`, `issues`, `fan`, `walls-shaped` `.test.ts` | hand-computed scenes + "embedded source matches Node" tests |
| `scripts/browser-smoke-export.mjs` | export builder, menu, north arrow (PNG / PDF need a real browser: not covered) |

## 3. How we work (keep)
- The assistant has no shell: it edits through the Filesystem tools, **the user runs** `npm run build && npm run docs:format`, `npm run golden:update` (read the "first difference" line first), `npm test && npm run smoke` and pastes failures. After a change of expectations that is *intended* (new button, new catalogue entry), update the test and say so; never loosen a guard.
- The user wants **few questions, short answers, low token use**; the premise is "a first model that the user refines by dragging". New behaviour behind a switch, existing editing behaviour unchanged unless confirmed; ask before schema changes.
- Gotchas met this phase: a `function dl(` in the page is forbidden by `render-hooks.test` (use unique names); lists of embedded functions in older tests need new siblings; a test graph needs `roomId` on its connectors or every joint is `invalid`; a room at its minimum size is **pushed along** unless position-locked; a global bare element CSS rule breaks the icon sprite; `drect` returns `{x,y,w,h}` (not width / height).

## 4. Open / ideas (user keeps the order)
1. **Roof / ceilings (postponed on purpose):** ceiling shape defined by key markers, not by room height; walls extend to the roof or stop at hanging ceilings. Wait until the 3D visualisation (separate package) has caught up; it must also read `outline` (rooms and areas).
2. Autosave and recovery in the browser; copy / paste rooms with contents; entity coverage gaps (highlight of the uncovered floor part); Home Assistant entity source (file import first).
3. Room shapes: split a room (inverse of merge, creates an open passage); `planWall` / `planClose` / `planFit` aware of notches; entities hosted by the real area outline (today bounding box); several rooms on one wall in the Shape tool.
4. Fit / Close gaps / Align use the automatic min / max room size (the settings reach Drag walls and corners only).
5. Check by hand (not covered by jsdom): PNG and PDF export, double-click zoom, handle clicks on top of rooms in Site mode, the Issues panel zoom, dimension labels at different zoom levels (font sizes are in plan units).

## 5. Starting prompt for the new chat
> I'm continuing `packages/floormap-editor` in `ha_3d_building_editor` (filesystem access is enabled). Read `CLAUDE.md` and `docs/HANDOVER-3.1.md`, run `npm test` and `npm run smoke`, then fix the bugs I paste below (hand-computed test first, then the fix) and continue with the open items in section 4. Keep token use low, ask as little as possible, edit `src/editor-*.ts` only with exact-match substring edits, and verify against the files on disk. My bugs: ...
