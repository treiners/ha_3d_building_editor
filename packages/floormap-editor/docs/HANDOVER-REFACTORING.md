# HANDOVER: refactoring and alignment with the visualisation (feature freeze at 3.1)

Written at the end of the 3.1 feature work on `packages/floormap-editor`. Read `CLAUDE.md` first (rules, commands, source map), then this note. `docs/HANDOFF.md` and `docs/HANDOVER.md` are historical. Feature docs: `docs/V3.1-FLOORS.md` (floors, stairs, contract check, underlay), `docs/V2.15-*.md`, `docs/V2.16-*.md`, `docs/BACKLOG.md`.

**Status:** all unit tests were green at the last run on the real machine (floors, stairs, origin, contract, round trip, underlay, coverage, areas-floors were verified in a sandbox with the real modules). Features added after the last full green run, only checked by unit tests and by reading the code: stair corner handles, the floating room box (`editor-roombox.ts`), the area / ground-floor fix and the new contract messages. **First step of any work: `npm test && npm run smoke`, write down the baseline** (the older `browser-smoke.mjs` once failed at scenario 6d in a sandbox).

## 1. Why refactor now
- The package grew from "mapper + editor" to floors, stairs, entities, areas, site, underlay and a contract check. Most of the growth sits in the browser code, which is awkward to change safely (see 2).
- The visualisation / building-card package has to read the same file. Today the file format is defined by the *code* of this package (`save.ts`, `floors.ts`, ...), not by a shared definition. That is the main alignment risk.
- No behaviour change is wanted. Every step below must be provable: same generated HTML (byte for byte) or same tests plus smoke results.

## 2. How the code is organised today (the pain points)
**Pure modules** (`mapper, joints, history, moves, walls, edit, defaults, areas, entities, origin, floors, stairs, save, contract, underlay`): TypeScript functions on plain JSON, tested in Node, and *also* embedded into the editor HTML with `fn.toString()`. Rules: no value imports, no outer-scope references, helpers inside the function, siblings only as documented in each file header (e.g. `planWall` calls `deriveJoints`, `checkContract` calls `deriveJoints` + `validateEntities` + `validateAreas` + `stairsHost`). The embed list is hand-written in `editor.ts` (`${[mapLayout, ..., stairResize, savedGraph, checkContract, ...].map(f=>f.toString())}`). Forgetting a sibling gives a ReferenceError only in the browser; every module therefore has an "embedded source evaluates and matches Node" test.

**Browser code**: `src/editor.ts` (dense script core as one template string, never reformat, exact-substring edits only) plus feature files that export `xxxCss` / `xxxJs` strings (`editor-entities, -settings, -openings, -site, -north, -floors, -stairs, -roombox, -contract, -underlay`; CSS and shell HTML were moved to `editor-css.ts` and `editor-shell.ts` in 3.1, output byte-identical). All of it shares one global script scope: globals `g` (graph), `sel`, `selPort`, `view`, `step`, `appMode`, `selE`, `selM`, `selS`, `hist`, functions `render, fit, rec, panel, world, snap, room, hidden, applyWallResult, ...`.

**Pain points, in order of cost**
1. **`render()` is wrapped by every feature** (`const r0=render; render=function(){r0.apply(...); ...}`): north, floors, stairs, roombox, underlay each add one layer. The order of the `${xxxJs}` lines in `editor.ts` therefore decides drawing order (underlay first child, ghost, rooms, stairs on top) and which handler sees an event first. `fit` is overridden by floors; `$('save').onclick` is replaced by the contract panel; `$('file').onchange` is wrapped by floors. These overrides are invisible from the code that is overridden.
2. **Global mutable state and top-level `let`** (`let selS` in `stairsJs`, `let appMode` in `entityJs`): feature files depend on the include order (a TDZ error appears if a file uses a variable before its `let` line has run). `roombox` must come after `stairs` for this reason.
3. **String constraints**: the JS strings must not contain backticks, `${` or backslashes. A test counts the literal text `ignoreIds:hidden()` in the generated HTML (expects 7), so new code has to avoid that exact spelling (use a local variable). Other tests compare status texts / structure strings.
4. **Dense `editor.ts`**: every edit of a long line echoes the whole line twice; tooling and review are painful. The pure modules are fine.
5. **Types**: pure modules use `any` for graph, room, connector, stair. Shapes are only documented in comments. `core.ts` has `Graph` / `Room` / `Layout` types that the newer modules do not use.
6. **Duplicated helpers** (rounding to 4 decimals, clamp, deep copy by JSON, "visible rooms = not named Outside") are re-implemented inside many functions because of the embedding rules.
7. **Tests**: the jsdom smoke scripts are outside `npm test` (run with `npm run smoke`), cannot see layout (`getScreenCTM`, rects are 0), and need stubs (`setPointerCapture`, `confirm`, `URL.createObjectURL`).

## 3. Proposed refactoring plan (each step independently shippable, behaviour unchanged)
**Step 0 - safety net (do first, small).** Add a golden-file test: generate the editor HTML from `reference-home-connectors.json` and compare with a stored copy (or its hash); intentional changes then need an explicit update. Put the jsdom smoke scripts behind `npm run smoke` in CI and record the baseline. Keep the round-trip test (`test/roundtrip.test.ts`) green: load -> save -> load -> save must be identical.

**Step 1 - automatic embedding.** Replace the hand-written embed list by one manifest (for example `src/embed.ts`: an ordered array of `{ fn, needs: [...] }`) plus ONE generic test that (a) evaluates the whole embedded block, (b) checks that every free identifier of every function is either a global of the block or a standard global (a small `new Function` + static scan, or `acorn` as a dev dependency). Removes the "forgot a sibling" class of bug; the per-module embedded tests can shrink to one.

**Step 2 - hooks instead of wrapping.** Introduce a tiny registry in the script core: `hooks.afterRender(fn)`, `hooks.beforeSave(fn)`, `hooks.onLoad(fn)`, `hooks.onKey(fn)` with a documented order, and convert the feature files one by one (north, roombox, underlay, stairs, floors, contract). `fit` and `save` become overridable named steps (`viewFit`, `buildSavedGraph`). Gain: order is explicit, no TDZ problems, features can be tested in isolation.

**Step 3 - state object.** Group the loose globals into a few objects (`S.graph`, `S.sel`, `S.view`, `S.mode`, `S.ui`), moved over file by file with a search-and-replace that is checked by the golden/smoke tests. Do NOT rename `g` in one go.

**Step 4 - split the script core of `editor.ts`** along its natural seams: view / geometry helpers, drawing (`render` and layers), pointer handling (`pointerdown / move / end`, `active`, `g0`, `j0`), panels (`panel`, tables), file I/O, keyboard. Still template strings at first (so the golden test can stay byte-identical until the end of the step), then optionally real TypeScript/JS source files that a small build step inlines.

**Step 5 - typed schema (shared, see 4).** Move `Graph`, `Room`, `Connector`, `Relationship`, `Floor`, `Stair`, `Area`, `EntityPlacement`, `Layout`, `EntitySettings`, `BuildingDefaults` into one `schema.ts`, use them in the pure modules (types are erased by `tsc`, so embedding is unaffected), remove `any` module by module. Keep `strict` on.

**Step 6 - bundler decision (optional, last).** If steps 1-5 are done, the browser script could be built from real modules with esbuild. Known trap: esbuild with `keepNames` injects helpers that break `fn.toString()` embedding; either keep embedding with `tsc`, or stop embedding and bundle the pure modules directly (then Node tests and the browser import the same files and the `toString` rules disappear). This is the biggest change; decide with the user after step 4.

**Order and risk.** 0 (low) -> 1 (low) -> 2 (medium: touches every feature file but each is small) -> 5 (low-medium) -> 3 (medium) -> 4 (high effort, mechanical) -> 6 (decision). Stop after any step; the package stays releasable.

## 4. Alignment with the visualisation package
I have **not** seen the visualisation package, so this section is a checklist to complete together. Goal: one definition of the file format used by both.

**Proposal:** a small shared package (name to be chosen, e.g. `packages/shared` already holds the reference graph) that exports: the TypeScript types and a JSON Schema for the *saved* graph, `migrate`, `checkContract` (pure, no DOM) and the format documentation. The editor imports it (embedding `checkContract` as today); the visualisation runs `checkContract` on load and shows/logs the same messages. Changes to the format then happen in one place, and the round-trip test lives next to the schema.

**The saved format as the editor writes it today (source of truth: `src/save.ts`)** - `schemaVersion` is still `"2.14"`; every addition is an optional field:
- Units metres; x to the right, y DOWN; the top-left corner of the house (visible rooms) is (0,0) after saving (`shiftOrigin`: rooms, areas, stairs, plan-coordinate entities). The room named `Outside` is a normal room that is only hidden when drawing.
- `rooms[]`: `id, name, sizeCategory, floor?, layout {x,y,width,height, positionLocked?, sizeLocked?}, connectors[]` (connector: `id, roomId, side, type (door | open-passage | window), offset` metres from the wall start, `width`, `door {hinge, swing, openAngle}` or `window {...}`; `position` 0..1 is legacy). `relationships[]` pair two connectors on opposite sides (`connectorA/B`, `importance`). `wallAlignments[]`, `joints[]` (override: `detached`).
- `buildingDefaults {wallThickness 0.16, wallHeight 2.4, floorThickness 0.12}` always written.
- `floors[] {id, name, height, elevation}` bottom to top; `room.floor`. `height` is the storey height (default wallHeight); `elevation` is DERIVED on save = sum over lower floors of (height + floorThickness), ignore it on load. Single-floor files have no `floors`.
- `stairs[] {id, name, lower, upper (floor ids, directly above each other), x, y, length, width, direction (right | left | up | down = climbing direction on the plan, up = -y), fromRoom, toRoom}`; rectangle top-left at x,y; `length` along `direction`; drawn on both floors with a thick bar at the landing end (lower floor: start = side opposite to `direction`; upper floor: end = side `direction` points to). `fromRoom` / `toRoom` are derived (room that contains the middle of the bar), may be null.
- `northDegrees` (optional, absent = 0): direction of north on the plan, clockwise from "up" (0 = north is up).
- `areas[]` (Site mode): `id, name, kind, shape (rect | ellipse), layout, roofed`; areas lie at ground level and are shared by all floors; only ground-floor rooms are compared for overlaps.
- `entitySettings {coordinates: "room" | "plan", gridStep, resize, checks {motion, doorContact, coverage?}}` and `entityPlacements[] {id, type, name?, haEntityId?, roomId | connectorId | areaId, position [x,y] relative to the anchor's top-left (metres), height above the floor, facingDegrees (clockwise from up), fieldOfViewDegrees, range}`. Entities belong to a floor through their room.

**Checklist for the alignment session**
1. List every key the visualisation reads and every key it assumes; compare with the list above (spot differences: y direction, origin, room-relative entity positions, offsets along walls, `position` vs `offset`).
2. Decide what the visualisation must ignore or recompute (`elevation`, `fromRoom`, `toRoom`, `_fl` must never appear in a saved file).
3. Stairs: how are they drawn in 3D (opening in the floor above, landing direction)? Does `fromRoom/toRoom` carry what it needs?
4. Heights: floor height vs wall height per room; roofs and individual wall heights are in `BACKLOG.md` (not implemented).
5. Versioning: keep `schemaVersion "2.14"` with optional fields, or bump (proposal: 2.16 or 3.1) with a migration; this is a schema decision for the user.
6. Contract check as a shared gate: which errors must block loading, which are warnings.
7. Reference data: one reference house with two floors, stairs, areas and entities in `packages/shared` that both packages test against.

## 5. Things to know before touching the code
- **Never serialise `g` directly.** While editing, `g.rooms / relationships / wallAlignments / entityPlacements` hold only the CURRENT floor; other floors are in `g._fl` (working key). Always go through `savedGraph(g)` (merge + defaults + derived fields + origin). Anything new that exports or analyses the plan (an HA export, a report) must use it.
- `shiftOrigin` runs only on save; the editor never shows coordinates.
- `floorsMerge` renames clashing ids across floors (suffix = floor id); in the editor ids may repeat across floors.
- Old 3.1-dev files with room-pair stairs are converted on load (`floorsSplit`).
- Keep `ignoreIds:hidden()` at exactly 7 occurrences in the generated HTML (test) - use a local variable in new code.
- The underlay lives in the browser only (object URLs, one per floor, never saved, not in undo).
- `#panel` (room box) was moved from the sidebar onto the canvas; `panel()` is unchanged.
- Include order of the feature files in `editor.ts` matters: `... floorsJs, stairsJs, roomboxJs, contractJs, underlayJs, render()`.

## 6. Working rules and method (unchanged)
- Change only this package. Do not change existing floor-plan behaviour; new behaviour behind a switch. Ask before schema changes, before deleting behaviour and before changing a regression test's expectation (this session changed, on purpose and mentioned in the changelog: the label "Lock position / Lock size" earlier, the entity / area message prefixes in the contract check).
- Edit `src/editor.ts` only with small exact-substring replacements that match once; verify from the files on disk. Edits of long lines echo the whole line - keep new code in new files.
- Verify with: `npm test` (tsc build + node --test), `npm run smoke`, the byte-identical HTML comparison for pure moves, and the round-trip test for format changes.
- Without a shell on the user's machine the workflow was: write files with the filesystem tools, copy them into a sandbox (`copy_file_user_to_claude`), compile and run the pure tests there (`tsc` + `node --test`; the real `core, mapper, joints, defaults, entities, areas` modules plus `../shared/reference-home-connectors.json` work in a sandbox), then ask the user to run `npm test && npm run smoke` and report the first failure lines. jsdom smoke scripts could not be run in the sandbox.

## 7. Open questions for the user
1. Bundler (step 6): keep `tsc` + `toString` embedding, or move to a bundle that the Node tests share?
2. Shared schema package: where should it live, and does the visualisation already have its own types to merge?
3. `schemaVersion`: bump with migration, or stay at 2.14 with optional fields?
4. Is the golden-HTML test acceptable (it fails on every intentional UI change until updated)?
5. Priority between the refactoring and the backlog (polygon rooms, ghost snapping while dragging, per-floor mapper).
