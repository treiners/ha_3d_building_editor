# Architecture

## Overview

The system is built around a semantic building model. The building model is the authoritative source of truth. All editors, renderers and Home Assistant integrations consume this model.

```text
Building Model
      |
      +-- Validation
      +-- Storage
      +-- Geometry Engine
      +-- 2D Editor
      +-- 3D Renderer
      +-- Home Assistant Adapter
```

## Design Principles

- Rooms are first-class objects.
- Connectivity between rooms is part of the model.
- Information is more important than architectural precision.
- 2D editing is the primary editing experience.
- 3D views are generated from semantic data.
- Home Assistant remains an integration layer.
- Extensibility is designed in from the beginning.

## Packages

Current state (implemented as independent projects, wired together by npm workspaces):

```text
packages/
├── room-graph/          rooms + connectors + relationships, no coordinates
├── floormap-editor/     graph -> floor plan; refine by dragging (main tool)
├── floormap-structure/  floor-plan model, geometry pipeline, validation, SVG
└── shared/              shared fixtures (reference-home-connectors.json)
```

Planned (not started): `renderer-3d`, `ha-panel`, Home Assistant adapter. The responsibilities listed for `core` below are today covered by `floormap-structure`; `editor-2d` is today `room-graph` + `floormap-editor`.

```text
room-graph -> floormap-editor -> floormap-structure -> renderer-3d -> ha-panel
(graph)       (layout)           (walls, openings,     (planned)      (planned)
                                  validation, SVG)
```

Planned package layout:

```text
packages/
├── core/
├── editor-2d/
├── renderer-3d/
├── ha-panel/
└── shared/
```

## Core Package

Responsible for:

- Domain model
- Validation
- Commands
- Persistence
- Geometry generation
- Versioning

## Editor-2D Package

Responsible for:

- Room creation
- Polygon editing
- Selection
- Snapping
- Undo/redo
- Pan and zoom

## Renderer-3D Package

Responsible for:

- Three.js visualisation
- Camera control
- Floor visibility
- Object highlighting
- Future animations

## Home Assistant Package

Responsible for:

- Entity binding
- State updates
- Service calls
- Dashboard integration

## Data Flow

```text
User
  ↓
2D Editor
  ↓
Building Model
  ↓
Geometry Engine
  ↓
3D Renderer
  ↓
Home Assistant Visualisation
```
