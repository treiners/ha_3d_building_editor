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
