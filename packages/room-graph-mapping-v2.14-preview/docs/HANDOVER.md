# HANDOVER: entity / sensor placement mode (next major integration)

Written at the end of the 3.0.0-beta.1 work on `packages/room-graph-mapping-v2.14-preview` (folder name unchanged, graph `schemaVersion` still `2.14`). `docs/HANDOFF.md` is the older hand-off of the floor-plan editor and is historical; this file is about the **new entity mode**. Read `CLAUDE.md` and `README.md` first (rules, commands, source map, how the embedded browser code works), then this note.

## 1. Goal
A second editor mode in the same HTML app for placing **entities** (sensors, lights, contacts, ... = the link to Home Assistant) on the finished floor plan.
- In entity mode **no floor-plan editing is possible** (no moving rooms, walls, corners, connectors, no mapper / close gaps / fit, no building values). The plan is a read-only background.
- Entities belong to a **room** or a **connector**; later also to other objects (furniture, appliances) inside a room.
- Positions are stored **relative to the room**, so the plan can still be changed in floor-plan mode without losing the placement. A config option may later switch to plan (global) coordinates.
- Result is saved in the same JSON file as `entityPlacements`.

## 2. Proposed data format
The user's draft, kept and extended (all new fields optional, files without `entityPlacements` behave as before):
```json
{
  "entitySettings": { "coordinates": "room", "gridStep": 0.1 },
  "entityPlacements": [
    { "id": "living-ceiling-light", "type": "light", "name": "Living ceiling light",
      "haEntityId": "light.living_ceiling", "roomId": "living",
      "position": [2.2, 1.3], "height": 2.2 },
    { "id": "living-motion-sensor", "type": "motion-sensor", "roomId": "living",
      "position": [0.2, 1.1], "height": 2.1,
      "facingDegrees": 90, "fieldOfViewDegrees": 100, "range": 3.5 },
    { "id": "bedroom-door-contact", "type": "door-contact",
      "connectorId": "bedroom-front-left-door" }
  ]
}
```
Rules and decisions proposed (confirm with the user):
- **Anchor:** exactly one of `roomId` | `connectorId` (later `objectId`). Resolution order `objectId` > `connectorId` > `roomId`. For a connector the world position is the connector point (`offset` along its wall); optional `side` (`"A"` | `"B"`, which room of the pair) for later.
- **Room-relative coordinates:** `position = [x, y]` in metres from the room's **top-left corner**, x right, y down (same axes as the plan, same as `layout`). World position = `[room.layout.x + x, room.layout.y + y]`. `entitySettings.coordinates` is `"room"` (default, also when absent) or `"plan"` (positions are global; the editor converts on load and save and warns that they go stale when rooms move). The user's draft values (e.g. `[14.2, 1.3]`) look like plan coordinates: the importer must not guess, it needs the setting (or a one-time conversion helper).
- **Optional later:** `anchorCorner` (`tl` default | `tr` | `bl` | `br` | `center`) so an entity near the right wall follows the right wall when the room is resized.
- **`height`:** metres above the floor, 0 .. `buildingDefaults.wallHeight`. Defaults by type from a catalogue (ceiling light = 2.2 in the draft); like everything else, *Save graph* writes the defaults explicitly (extend `fillDefaults`).
- **Orientation:** `facingDegrees` clockwise from "up" on the plan (north, -y): 0 = up, 90 = right, direction vector `(sin a, -cos a)`. State this in the docs; the draft's `90` then means "looking right". `fieldOfViewDegrees` full opening angle, `range` metres.
- **IDs:** `id` is the stable placement id (unique among entities, slug like `living-motion-sensor`, `-2` suffix on clash, editable). `haEntityId` (HA id such as `light.living_ceiling`) is the optional binding to Home Assistant; `name` optional label.
- **`type` vocabulary:** data-driven catalogue (see 4). Types decide the allowed anchor, default height, extra fields and the HA domain / device class used later.
- **Integrity:** deleting a room deletes its entities, removing a connector deletes the entities bound to it (both pure functions in `src/edit.ts` get a cascade, with a status message "N entities removed"; undo restores). Entities outside their room after a resize are kept and flagged, never silently moved.

## 3. UX suggestion
**App-level mode switch** in the header above the existing tabs: `Floor plan | Entities`. Everything of the current UI (tabs Layout / Connectors / Building, toolbar actions, tool and move mode, settings drawer) belongs to *Floor plan* and is hidden or disabled in *Entities*. Keep shared: undo / redo (graph snapshots already include everything), zoom / fit / grid, view switch, load / save, status bar. Show a small banner "Layout locked" in entity mode.

Sidebar in entity mode, tabs **Place | List**:
- **Palette** (Place tab): catalogue grouped (Lighting, Sensors, Contacts, Climate, ...) with search; click a type, then click in a room to place (or drag from the palette). Placement grid 0.1 m, hold Alt for free placement. Connector-bound types are placed by clicking a connector (valid targets are highlighted; type must match: door-contact on door connectors, window-contact on window connectors).
- **Inspector** (same pattern as room / connector inspector): id, name, type, `haEntityId`, parent (room or connector, read-only), x / y fields (small, auto-apply), height, and for directional types facing / field of view / range. Trash icon next to the name.
- **List tab:** table of all entities (name, type, parent, HA id, status icons for warnings), filters by room and type, a toggle "HA entities not placed yet" (see 5). Tapping a row selects the entity and rings it on the plan (same pattern as the connector table).
- **Plan layer:** rooms drawn pale, no wall / corner / connector handles; entities as SVG icons (sprite, `#i-...`) with optional labels; coverage cone (field of view and range) of the **selected** entity, optional tickbox "Show coverage" for all (same pattern as the door swing and the connector width bars); handles on the plan for facing (rotate), range and field of view of the selected entity.
- **Interactions:** drag to move (clamped inside the room; dropping into another room re-parents and recomputes the relative position), arrow keys nudge by the grid, Delete removes, background click deselects, undo / redo for every step, one undo step per finished gesture (use `rec(before)` exactly like the other gestures).
- **Diagnostics** (a collapsible panel in the List tab): orphaned parent, outside its room, height outside 0..wallHeight, duplicate id, connector type mismatch, two contacts on the two connectors of one door, rooms without any sensor of a chosen type (later: coverage gaps).

## 4. Suggested implementation structure
New pure, tested modules (same rules as the other embedded modules: no value imports, helpers inside the function, sibling globals only as documented in `CLAUDE.md`):
- `src/entities.ts`: `ENTITY_TYPES` catalogue (inside the functions that need it, because of `toString`), `addEntity`, `moveEntity` (with re-parent), `removeEntity`, `validateEntities`, `entityWorld` (room-relative to plan and back), `coverageSector` (polygon points for facing / FOV / range), `nearestAnchor`, `fillEntityDefaults` (or extend `fillDefaults`).
- Cascade in `removeRoom` / `removeConnector` (`src/edit.ts`).
- **Keep `editor.ts` growth small.** It is one dense template string and every edit echoes full long lines, so put the entity-mode HTML / CSS / JS in its own file (for example `src/editor-entities.ts` exporting three strings) and concatenate them in `editor.ts` with a handful of hooks:
  - `let appMode='plan'` (do not reuse the existing `mode`, which is `'mapping'` / `'gap'`), `document.body.dataset.app`;
  - at the top of the `pointerdown` handler: `if(appMode==='entities')return entityPointer(e)`; same guard for keyboard shortcuts, the toolbar buttons that edit, and drag handlers;
  - `render()` appends `entityLayer()` and the inspector hook;
  - CSS: scope everything (`body[data-app=entities] ...`). **Never add a bare element selector like `svg{}`**: that once turned the icon sprite into a full-screen white box (there is a regression test).
- Shared contract the entity code may rely on (all globals in the editor script): `g` (the graph, replaced on undo / load), `$`, `svg` (`#canvas`), `sel`, `selPort`, `view`, `step`, `clean`, `snap`, `room(id)`, `rect(room)` (= `layout`), `ports()`, `port(id)`, `linkFor(id)`, `len(room, side)`, `dpoint(port)` / `drect(room)` (display coordinates), `world(e)` (pointer to plan coordinates), `fit()`, `render()`, `panel()`, `rec(before)` + `hist`, `editApply(result, before, selectIds)`, `hidden()` (ids of the `Outside` room), `ICON_TRASH`, `setUi` / `uiSync` (floor-plan tabs).
- Embed order: append the new pure functions to the list in `editor.ts` (`mapLayout, ..., fillDefaults, connectRooms, ...`) and to the order documented in `CLAUDE.md`.
- Tests (conventions of this package): hand-computed unit tests with the arithmetic in the test name (relative to world, re-parent, cascade, validation, sector points), an "embedded source evaluates and matches Node" test, an HTML structure test (ids once, scoped CSS), and jsdom scenarios in a new smoke script (place by click, drag, rotate handle, list row ring, mode lock: wall / corner / connector drags do nothing in entity mode).

## 5. Home Assistant link (open design, keep it behind an interface)
- Standalone (external tool): an **entity source** is a JSON / CSV file exported from HA (id, name, domain, device class, area). The List tab shows "not placed yet" entities; placing one pre-selects its type from the domain / device class and writes `haEntityId`.
- Embedded in HA (HACS panel): the same interface fed by the HA WebSocket (`get_states`, area registry). Do not mix HA calls into the pure modules; the editor talks only to `EntitySource.list()`.
- Icons: material design icons match HA; the existing icon sprite (11 hand-drawn icons) can be extended or replaced.

## 6. Decisions to confirm with the user first
1. Room-relative from the top-left corner as default, `entityCoordinates` setting name and values, `anchorCorner` later or now?
2. Orientation convention (0 = up, clockwise) and `height` semantics (above floor).
3. Re-parent when an entity is dragged into another room: automatic, or confirm?
4. Binding field name `haEntityId`, `name` optional, and which entity source to build first (file import vs HA WebSocket).
5. MVP type list. Suggested: light, motion-sensor (facing / FOV / range), presence (mmWave, same fields), door-contact, window-contact, temperature, humidity, illuminance, smoke, water-leak, switch / button, plug, thermostat / TRV, camera (facing / FOV / range), cover / blind (window connector), lock (door connector), speaker.
6. May entities sit in the `Outside` room (outdoor sensors)? It is hidden when drawing today.
7. Coverage visualisation: only the selected entity, or all with a tickbox (suggested: both).
8. Single floor only for now (the graph has no levels); say so in the docs.

## 7. State of the package at hand-over (3.0.0-beta.1)
- 179 tests (178 pass, 1 skipped), `npm test` builds with `tsc` and runs `node --test dist/test/*.test.js`. Optional jsdom checks: `scripts/browser-smoke.mjs` (older; it failed at scenario 6d in the sandbox used for the last work, before and after the changes, so run it on the real machine first and note the baseline) and `scripts/browser-smoke-connectors.mjs` (passes; covers connectors, doors, windows, building values, layout, add room, connector table).
- Generate the editor: `node dist/examples/generate.js ../reference-home-connectors.json examples/room-graph_mapping.html`.
- *Save graph* writes every default explicitly (`src/defaults.ts`, `fillDefaults`); extend it for entity defaults.
- Relevant docs: `README.md`, `CHANGELOG.md`, `docs/V2.15-CONNECTORS.md` (connectors, door, window, building, Close gaps, Fit), `docs/V2.15-UI.md` (layout, icons).

## 8. Working notes from the last sessions
- Rules from `CLAUDE.md` still apply: change only this package, do not change existing floor-plan behaviour (new behaviour behind a switch), ask before schema changes and before changing a regression test's expectation (the add-room side fallback and the `ignoreIds:hidden()` count were changed on request and are in the changelog).
- Edit `src/editor.ts` only with small exact-substring replacements that match once; after each change rebuild and run the tests **from the real files on disk**. Without a shell on the user's machine the workflow was: copy the files into a sandbox, edit and test there, apply the same edits to the disk with exact-match edits, copy the files back and `cmp` them. Edits that touch the long lines of `editor.ts` echo whole lines, so keep new code in new files.
- jsdom limits: no layout (`getScreenCTM` missing), `setPointerCapture` must be stubbed, CSS is not evaluated: call functions through `window.eval(...)` and test geometry in pure modules.
- Gotchas met: a global `svg{}` CSS rule broke the sprite; `norm` / `setWorld` keep connectors half an opening width away from wall ends; counts of `ignoreIds:hidden()` in the editor are asserted by a test; `Outside` is a normal room that is only hidden when drawing.

## 9. Starting prompt for the new chat
> I'm continuing `packages/room-graph-mapping-v2.14-preview` in `ha_3d_building_editor` (filesystem access is enabled). Read `CLAUDE.md`, `README.md` and `docs/HANDOVER.md` first, run `npm test`, then work through the decisions in section 6 of the hand-over with me and implement the entity placement mode (section 3 and 4): pure `src/entities.ts` with tests first, then the mode in its own file with small hooks in `editor.ts`. Floor-plan behaviour must stay unchanged; edit `src/editor.ts` only with exact-match substring edits and verify against the files on disk.
