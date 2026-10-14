# Changelog

Suite timeline, newest first. Each entry names the package and links to its own changelog for details. Packages are versioned independently.

## 2026-10-13 - floormap-editor 3.0.0-beta.1
First beta of the floor-plan editor (formerly `room-graph-mapping-v2.14-preview`): initial mapper, move modes, wall and corner dragging with auto-resize, locks, undo / redo, Close gaps / Fit, room and connector editing, connector and door/window details, building defaults, new UI. Graph `schemaVersion` stays 2.14 (all additions optional).
Details: [packages/floormap-editor/CHANGELOG.md](packages/floormap-editor/CHANGELOG.md)

## 2026-10-14 - repository restructure
- Packages renamed: `room-graph-mapping-v2.14-preview` -> `floormap-editor`, `room-side-connectors-v2.1-preview` -> `room-graph`, `core` -> `floormap-structure`.
- Shared fixture `reference-home-connectors.json` moved to `packages/shared/`.
- Core-specific docs moved to `packages/floormap-structure/docs`; old README versions to `docs/history`.
- Root `package.json` with npm workspaces; root README now led by the floormap editor.

## 2026-10-06 - floormap-structure 1.4.0
First release of the 2D modelling stage: geometry generation, validation, SVG rendering, inspection, constrained opening edits, JSON export, permanent architectural symbols.
Details: [packages/floormap-structure/CHANGELOG.md](packages/floormap-structure/CHANGELOG.md)
