# Prototype Milestones

## Status (2026-10-14)

The milestones below predate the current package structure (`room-graph`, `floormap-editor`, `floormap-structure`). Rough mapping:

| Milestone | Status | Where |
|---|---|---|
| 0 Foundation | done | repository, docs, TypeScript packages, npm workspaces |
| 1 Semantic model | partly | `floormap-structure` (model, JSON); the room graph schema lives in `room-graph` / `floormap-editor` |
| 2 2D viewer | done | SVG in `floormap-structure`, canvas in `floormap-editor` |
| 3 Room editor | partly | rectangular rooms in `floormap-editor`; polygon rooms not started |
| 4 Connectivity | done | connectors and relationships in `room-graph` and `floormap-editor` |
| 5 Doors and windows | partly | door/window details in `floormap-editor`; opening edits in `floormap-structure` |
| 6 Geometry engine | partly | wall and opening generation in `floormap-structure` |
| 7-10 3D viewer, Home Assistant, visualisation, MVP | not started | |

Next in the editor: polygon rooms (wall-graph model, schema 2.15).

## Milestone 0 - Foundation

Deliverables:

- Repository structure
- Vision document
- Architecture document
- Domain model
- TypeScript workspace

## Milestone 1 - Semantic Building Model

Deliverables:

- Building class
- Floor class
- Room class
- Connector class
- Device class
- JSON import/export

Success Criteria:

- Apartment model represented
- Single-storey house represented
- Two-storey house represented

## Milestone 2 - 2D Viewer

Deliverables:

- Room rendering
- Labels
- Zoom
- Pan

## Milestone 3 - Room Editor

Deliverables:

- Rectangle room tool
- Polygon room tool
- Select room
- Delete room

## Milestone 4 - Connectivity

Deliverables:

- Door connectors
- Passage connectors
- Visual relationship display

## Milestone 5 - Doors and Windows

Deliverables:

- Opening placement
- Window placement
- Opening editing

## Milestone 6 - Geometry Engine

Deliverables:

- Floor generation
- Wall generation
- Opening generation

## Milestone 7 - 3D Viewer

Deliverables:

- Three.js renderer
- Camera controls
- Floor visibility
- Room highlighting

## Milestone 8 - Home Assistant Integration

Deliverables:

- Entity bindings
- Live state updates
- Basic service interactions

## Milestone 9 - Information Visualisation

Deliverables:

- Occupancy overlays
- Temperature display
- Door and window states
- Light status visualisation

## Milestone 10 - MVP Release

Deliverables:

- Home Assistant panel
- Documentation
- Example homes
- HACS package
