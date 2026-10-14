# HA 3D Building Editor

A lightweight building-mapping engine and interactive SVG floor-plan editor designed for abstract, easy-to-create home layouts rather than construction-grade CAD drawings.

The project uses a renderer-independent domain model for rooms, boundaries, walls, connectors, openings, and windows. The same model is intended to support future Home Assistant integration and a Three.js viewer.

## First release: v1.4

Version 1.4 completes the foundational 2D modelling stage. It combines geometry generation, architectural validation, SVG rendering, element inspection, constrained opening edits, JSON export, and permanent architectural symbols.

### Highlights

- Generate room boundaries, shared boundaries, and external/shared wall segments.
- Resolve doors, external doors, open passages, and windows against room boundaries.
- Cut connector openings into wall geometry.
- Render visible architectural symbols:
  - hinged-door leaves and swing arcs;
  - distinct external-door styling;
  - open-passage markers;
  - permanently visible window glazing and frames.
- Select and inspect rooms, walls, connectors, and windows.
- View boundary IDs and related entity information.
- Change door, passage, and window offsets along their current boundary.
- Export edited building definitions as JSON.
- Validate opening placement, dimensions, boundary references, shared-wall windows, and opening overlaps.

## Design direction

The editor deliberately prioritises a simple and intuitive workflow over CAD-level precision. The goal is to create a useful abstract building map with minimal measuring, while keeping the underlying model structured enough for automation, validation, Home Assistant entities, and future 3D visualisation.

## Architecture

```text
Building JSON
    ↓
Domain model
    ↓
Geometry pipeline
    ↓
Validation
    ↓
Generated floor
    ├── SVG editor
    └── Future Three.js viewer
```

The geometry and domain layers remain independent of the renderer. SVG currently provides the editing and inspection experience; Three.js is planned as a later visualisation layer.

## Build and test

```bash
npm install
npm test
npm run build
```

## Generate the interactive reference apartment

```bash
node dist/examples/reference-apartment-openings-editor.js \
  examples/reference-apartment-v1.2.json

open examples/reference-apartment-openings-editor.html
```

The generated HTML document is standalone and can be opened directly in a browser.

## Validate an edited model

```bash
node dist/examples/validate-reference-apartment.js \
  examples/reference-apartment-v1.2.json
```

The validator reports structured errors and warnings. Shared-wall windows are warnings by default, while invalid geometry and overlapping openings are errors.

## Current scope

Included in v1.4:

- single-floor room geometry;
- shared and external walls;
- doors, external doors, passages, and windows;
- architectural symbols;
- inspection and constrained offset editing;
- JSON export and opening validation.

Not yet included:

- full room-shape editing workflow;
- moving openings between boundaries;
- stairs, floor voids, and ceiling voids;
- multi-floor editing;
- Home Assistant entity binding;
- Three.js visualisation.

## Release title

**v1.4: Interactive Architectural Floor Plan Foundation**

## Release summary

The first release establishes a complete renderer-independent building model and an interactive SVG editor. Rooms, walls, doors, passages, and windows are visible and selectable; opening offsets can be adjusted and exported; and the resulting model can be validated before later Home Assistant and 3D integration.
