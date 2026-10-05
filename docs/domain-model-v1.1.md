# Domain Model v1.1

## Purpose

The Domain Model defines the semantic representation of a building.

It describes:

- spaces
- relationships
- geometry
- openings
- Home Assistant associations

independently of any editor or renderer.

The domain model is the authoritative source of truth.

---

# Architectural Principles

## Room First

Rooms are the primary modelling object.

Users think in:

- Living Room
- Kitchen
- Bedroom
- Bathroom

not walls, meshes, or CAD elements.

---

## Connectivity Matters

The model must understand:

- movement between spaces
- access from outside
- relationships between rooms

This is represented through Connectors.

---

## Shape Before Precision

The system represents the home.

It is not intended as CAD software.

Approximate dimensions are acceptable.

---

## Topology and Geometry

The model consists of two layers.

### Topology Layer

Represents:

- rooms
- connectors
- devices

Example:

```text
Living Room
    |
Dining Room
    |
Kitchen
```

### Geometry Layer

Represents:

- polygons
- dimensions
- positions
- openings

The same topology can support multiple visualisations.

---

# Root Structure

```json
{
  "schemaVersion": "1.1",
  "building": {}
}
```

---

# Building

Represents an entire building.

## Attributes

```json
{
  "id": "home",
  "name": "My Home",
  "floors": [],
  "devices": [],
  "views": []
}
```

---

# Floor

Represents one level within a building.

## Attributes

```json
{
  "id": "ground",
  "name": "Ground Floor",
  "elevation": 0,
  "rooms": [],
  "connectors": [],
  "openings": []
}
```

---

# Room

Represents a meaningful space.

## Examples

- Living Room
- Dining Room
- Kitchen
- Bedroom
- Bathroom
- Garage
- Hallway

## Attributes

```json
{
  "id": "living",
  "name": "Living Room",
  "type": "living-room",
  "geometry": {
    "shape": []
  }
}
```

---

# Room Geometry

Uses a simple polygon.

Example:

```json
{
  "shape": [
    [0,0],
    [5,0],
    [5,4],
    [0,4]
  ]
}
```

Coordinates use metres.

Precision is not required.

Consistency is.

---

# Boundary

## Purpose

Boundaries are generated from room polygons.

They provide attachment points for:

- doors
- windows
- openings
- future wall features

Users do not create boundaries directly.

The system generates them automatically.

---

## Example

Room:

```json
{
  "shape": [
    [0,0],
    [4,0],
    [4,4],
    [0,4]
  ]
}
```

Generated boundaries:

```text
b0 = (0,0) → (4,0)
b1 = (4,0) → (4,4)
b2 = (4,4) → (0,4)
b3 = (0,4) → (0,0)
```

---

## Boundary Object

```json
{
  "id": "living-b0",
  "roomId": "living",
  "edgeIndex": 0
}
```

---

# Connector

Represents movement between spaces.

---

## Connector Types

### Door

```json
{
  "type": "door"
}
```

### Open Passage

```json
{
  "type": "open-passage"
}
```

### External Door

```json
{
  "type": "external-door"
}
```

### Stair

```json
{
  "type": "stair"
}
```

---

## Connector Structure

```json
{
  "id": "door1",
  "type": "door",
  "roomA": "living",
  "roomB": "kitchen",

  "boundaryA": "living-b1",
  "boundaryB": "kitchen-b3",

  "offset": 1.25
}
```

---

## Offset

Offset is measured from the first vertex of the boundary.

Example:

```text
Boundary length = 4.0m

Offset = 1.5m
```

means the opening begins 1.5m from the start of the boundary.

---

# Connector Geometry

```json
{
  "width": 0.82,
  "height": 2.04,
  "style": "single-hinged"
}
```

---

## Supported Door Styles

```text
single-hinged
double-hinged
sliding
```

Future styles may be added.

---

# Opening

Represents a wall feature.

Examples:

- Window
- Vent
- Skylight

---

# Window

```json
{
  "id": "window1",
  "type": "window",
  "roomId": "living",
  "boundaryId": "living-b0",
  "offset": 1.2
}
```

---

# Window Geometry

```json
{
  "width": 1.2,
  "height": 1.0,
  "sillHeight": 0.9
}
```

---

# Device

Represents a Home Assistant entity.

Example:

```json
{
  "id": "living-light",
  "roomId": "living",
  "entityId": "light.living_room",
  "deviceType": "light"
}
```

---

# View

Represents a saved visualisation.

```json
{
  "id": "overview",
  "name": "Overview",
  "visibleFloors": [
    "ground"
  ]
}
```

---

# Generated Walls

Walls are generated geometry.

Walls are NOT first-class domain objects.

Wall geometry is derived from:

- room polygons
- boundaries
- connectors
- openings

Default values:

```json
{
  "wallThickness": 0.15,
  "wallHeight": 2.4
}
```

---

# Validation Rules

## Room

- valid polygon
- no self-intersection
- unique ID

## Boundary

- references existing room
- edgeIndex must exist

## Connector

- referenced rooms must exist
- referenced boundaries must exist

## External Door

- exactly one room

## Opening

- room and boundary must exist

## Device

- referenced room must exist

---

# Reference Models

The model must successfully represent:

1. Apartment
2. Family House
3. Two-storey House
4. Small Office

without introducing custom objects or exceptions.
