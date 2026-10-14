# Changelog

All notable changes to this project are documented in this file.

## [1.4.0] - 2026-10-06

### Added

- Permanent architectural symbols for internal doors, external doors, open passages, and windows.
- Door leaves and swing arcs for hinged-door connectors.
- Distinct styling for external doors.
- Visible window glazing and frame lines without requiring hover.
- Interactive selection for rooms, walls, connectors, and windows.
- Inspector details for IDs, boundaries, classifications, room relationships, offsets, widths, and related entities.
- Constrained offset editing for doors, passages, and windows along their assigned boundaries.
- Export of edited building definitions to JSON.
- Opening validation for missing boundaries, room/boundary mismatches, invalid dimensions, out-of-bound openings, shared-wall windows, and opening overlaps.
- Room and wall inspection metadata with delegated click handling.
- Reference apartment examples for validation, symbols, and interactive editing.
- Automated tests for architectural symbols, inspection metadata, click targets, editing, windows, and opening validation.

### Changed

- Connector openings are represented by actual cut wall segments rather than relying on coloured connector overlays.
- Connector guides are treated as optional debugging aids.
- Windows and connectors are now first-class inspectable entities.
- The interactive reference apartment uses resolved wall openings and permanent architectural symbols.
- SVG rendering now separates visible symbols from larger transparent interaction targets.

### Fixed

- Corrected connector click-handler wiring through delegated events.
- Added missing room and wall inspection metadata.
- Fixed editor generation order so the floor source is loaded before geometry resolution.
- Removed duplicate raw/resolved window declarations in the editor example.
- Corrected raw window definitions versus resolved-window usage across editing, inspection, and rendering.

### Validation behaviour

- Windows on shared walls produce warnings by default.
- Missing boundaries, invalid intervals, out-of-bound openings, and overlapping openings produce errors.
- Touching opening endpoints are not treated as overlaps within the configured tolerance.

### Release significance

v1.4 is the first cohesive release of the foundational 2D building editor. It completes the initial pipeline from structured building data through geometry, wall openings, validation, architectural SVG rendering, interactive inspection, constrained editing, and JSON export.

## Pre-release development milestones

- Boundary generation and overlap detection.
- Shared-boundary and wall-segment generation.
- Geometry pipeline and SVG floor-plan rendering.
- Connector resolution and actual wall openings.
- Window resolution and rendering.
- Opening validation.
- Interactive inspection and opening editing.
