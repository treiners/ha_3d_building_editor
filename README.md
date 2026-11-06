# HA 3D Building Editor

Tools for describing a home as an abstract floor plan, without CAD-level precision: create a room graph, turn it into a floor plan, refine it by dragging, and generate walls, openings and symbols from it. The result is meant for Home Assistant and a later 3D view.

## Floormap editor (3.2) - the main tool

[`packages/floormap-editor`](packages/floormap-editor) turns a **room graph without coordinates** into a floor plan and lets you refine it in the browser:

- deterministic initial layout (*Map*); rooms that already have coordinates are kept
- move modes Free / Slide / Slide + pull, wall and corner dragging with auto-resize, position and size locks, overlap blocking, undo / redo
- tidying tools *Close gaps* and *Fit*; add, connect and delete rooms and connectors
- connector details: width, door type (hinged, sliding, pocket, glass, tilt), door swing, window type with sill and head height; building defaults (wall thickness, wall height, floor thickness)
- rooms with their own shape (L, U, T), merge rooms, rename rooms, several floors with stairs, heights per room and wall
- **Site** mode for outside areas (deck, garden, trees), **Entities** mode for sensors, lights and contacts (with Home Assistant entity ids), **Objects** mode for appliances, furniture and your own categories (toilet, bathtub, outdoor)
- Issues panel with a check of the file before saving, SVG / PNG / PDF export, dimension and area labels, browser autosave, touch support, optional grouped toolbar
- output is one self-contained HTML file; the plan is saved as JSON ([file format](packages/floormap-editor/docs/FILE-FORMAT.md))

Planned: importing Home Assistant entities, then running the editor next to Home Assistant so changes show up in the 3D view without an export ([design](packages/floormap-editor/docs/HOME-ASSISTANT-INTEGRATION.md)).

Quick start:

```bash
cd packages/floormap-editor
npm install && npm test
node dist/examples/generate.js ../shared/reference-home-connectors.json examples/room-graph_mapping.html
```

## How the three packages fit together

```text
room-graph  ->  floormap-editor  ->  floormap-structure  ->  (Home Assistant panel, 3D viewer)
rooms and       layout: rooms get      walls, openings,
connectors,     coordinates and are    validation, SVG
no coordinates  refined by dragging
```

| Package | Purpose | Version |
|---|---|---|
| [`floormap-editor`](packages/floormap-editor) | Layout editor: graph in, floor plan out | 3.2.0 |
| [`room-graph`](packages/room-graph) | Editor for rooms, connectors and relationships (the graph) | - |
| [`floormap-structure`](packages/floormap-structure) | Internal floor-plan model, geometry pipeline and SVG visualisation | 1.4.0 (release), package.json 0.1.0 |
| [`shared`](packages/shared) | Shared test and example data (`reference-home-connectors.json`) | - |

The packages are independent projects with their own `package.json`, tests and changelog. The root `package.json` only wires them together as npm workspaces.

## Build and test everything

```bash
npm install
npm test            # runs the test suites of all three packages
```

## Documentation
- [`CHANGELOG.md`](CHANGELOG.md): suite timeline; each package has its own detailed changelog.
- [`docs/`](docs): project-level vision, architecture and milestones.
- Package docs: `packages/floormap-editor/docs` (file format, version notes, backlog, Home Assistant integration design), `packages/floormap-structure/docs` (geometry rules, domain model, opening rules; old versions in `docs/history`).

## Design direction
A simple, intuitive workflow beats CAD precision: a useful abstract building map with minimal measuring, structured enough for automation, validation, Home Assistant entities and 3D visualisation.
