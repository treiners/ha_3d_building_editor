# Geometry Rules v1.0

## 1. Purpose

This specification defines how the application derives editable 2D representations and renderable 3D geometry from the semantic building domain model.

The domain model is authoritative. Generated boundaries, walls, floor meshes, openings, door leaves, window frames and scene objects are derived data and must be reproducible.

The geometry layer must support the project's core objective: a recognisable, useful representation of a home without requiring architectural precision or specialist modelling knowledge.

## 2. Scope

Version 1 covers:

- planar floors;
- polygonal rooms;
- generated room boundaries;
- shared and external boundary classification;
- practical wall thickness and height;
- doors, external doors and open passages;
- windows;
- floor surfaces;
- room labels;
- basic device positions;
- 2D and 3D scene data.

Version 1 does not cover:

- curved or sloped walls;
- complex roofs;
- detailed stairs;
- structural engineering;
- BIM or IFC semantics;
- furniture collision;
- photorealistic materials;
- ceiling geometry;
- terrain.

## 3. Core Principles

### 3.1 Rooms are authoritative

A room polygon defines the usable space of a room. Users edit rooms, connectors and openings rather than meshes or wall solids.

### 3.2 Walls are generated

Walls are derived from polygon boundaries. They are not stored as primary domain objects.

### 3.3 Geometry is deterministic

The same validated model and geometry settings must produce equivalent geometry, identifiers and classifications.

### 3.4 Approximate dimensions are valid

Coordinates use metres, but survey-grade accuracy is not required. Relative scale, recognisable shape and internal consistency are more important.

### 3.5 Generated data is replaceable

Generated geometry may be cached, but it must be safe to discard and regenerate.

## 4. Coordinate System

### 4.1 Floor coordinates

Room polygons use two-dimensional floor coordinates:

```text
+x = right/east on the editing plane
+y = down/south on the editing plane
```

The 2D editor may transform this system for screen display.

### 4.2 Three-dimensional coordinates

The 3D renderer maps floor coordinates into a horizontal plane:

```text
domain x -> scene x
domain y -> scene z
height   -> scene y
```

This mapping keeps the 3D vertical axis consistent with common Three.js conventions.

### 4.3 Units

The canonical unit is the metre.

Recommended defaults:

```json
{
  "wallThickness": 0.15,
  "wallHeight": 2.4,
  "floorThickness": 0.1,
  "coordinateTolerance": 0.01
}
```

## 5. Room Polygon Rules

A room shape is an ordered list of vertices. Closure is implicit: the final vertex connects to the first.

Example:

```json
{
  "shape": [[0, 0], [4, 0], [4, 4], [0, 4]]
}
```

A valid polygon must:

- contain at least three distinct vertices;
- have non-zero area;
- not self-intersect;
- not contain zero-length edges after tolerance normalisation;
- remain on one floor;
- use finite numeric coordinates.

Polygon winding should be normalised by the geometry engine. Domain files may use either clockwise or counter-clockwise order, but generated boundaries must use the stored vertex order so boundary IDs remain stable.

## 6. Rectangle Construction Tool

A rectangle is an editor operation, not a separate model type.

Dragging from `(x1, y1)` to `(x2, y2)` creates four polygon vertices. The tool must reject rectangles whose width or height is below the configured minimum room dimension.

Suggested initial minimum:

```text
0.25 m
```

## 7. Boundary Generation

For a room with `n` polygon vertices, generate `n` boundaries.

For vertex `i`:

```text
start = shape[i]
end   = shape[(i + 1) mod n]
```

Generated identifier:

```text
<room-id>-b<edge-index>
```

Example:

```json
{
  "id": "living-b1",
  "roomId": "living",
  "edgeIndex": 1,
  "start": [4, 0],
  "end": [4, 4],
  "length": 4
}
```

If explicit boundary records are stored in a reference file, the engine must validate that each ID and `edgeIndex` agrees with the polygon. Start, end and length remain generated properties.

## 8. Boundary Classification

Each complete boundary or segmented boundary interval is classified as one of:

```text
external
shared
unresolved
```

- `external`: no overlapping room boundary exists.
- `shared`: an overlapping boundary from another room exists.
- `unresolved`: overlapping geometry is ambiguous or invalid.

A partially shared boundary is segmented into shared and external intervals.

## 9. Shared Wall Generation

Two overlapping boundaries describe one physical wall, not two.

A generated shared wall record must reference both source boundaries and the overlap interval.

```json
{
  "id": "wall:living-b1:dining-b3:0",
  "type": "internal",
  "boundaryA": "living-b1",
  "boundaryB": "dining-b3",
  "start": [4, 0],
  "end": [4, 4]
}
```

Stable IDs should be derived from sorted boundary IDs and a segment index.

## 10. External Wall Generation

A boundary interval without a matching room boundary produces an external wall segment.

The generated external wall must retain its source boundary ID so connectors and windows can be resolved.

## 11. Wall Placement

For the prototype, wall centre lines follow room polygon edges.

Wall thickness is applied symmetrically around the centre line. This may cause minor overlaps at corners, which are acceptable during the first 2D proof of concept. The 3D renderer should later apply corner joining or mesh union.

Alternative inside/outside wall alignment is deferred.

## 12. Wall Corners

Initial implementation may use intersecting rectangular wall prisms. Later implementations may use:

- mitred joins;
- bevelled joins;
- polygon offsetting;
- merged meshes.

The rendered result must avoid obvious holes at common orthogonal corners.

## 13. Connector Placement

A connector references one boundary for external access or two boundaries for room-to-room access.

The connector's `offset` is measured along `boundaryA` from its start vertex.

Version 1 defines offset as the position of the opening's first edge, not its centre.

For a corresponding `boundaryB` with reversed direction, the engine must transform the interval into boundary B's local distance.

A connector opening interval is:

```text
[offset, offset + width]
```

It is valid only if:

```text
offset >= 0
offset + width <= boundary length + tolerance
```

## 14. Doors

A door connector requires:

- one or two valid boundary references;
- width;
- height;
- style.

Recommended defaults:

```json
{
  "width": 0.82,
  "height": 2.04,
  "style": "single-hinged"
}
```

Supported MVP styles:

```text
single-hinged
double-hinged
sliding
```

Optional fields include:

```text
swingDirection
hingeSide
opensTowardRoomId
```

The 2D representation may show a door leaf and swing arc. The 3D representation may rotate or translate the door leaf based on state.

## 15. Open Passages

An open passage removes a horizontal interval from a shared wall. It does not generate a door leaf.

Required values:

- boundary references;
- offset;
- width.

Optional height may be added later for arches or partial-height openings. In Version 1 an open passage extends from the floor to wall height.

## 16. External Doors

An external door references exactly one room and one boundary. Its boundary interval must be classified as external.

An external door on a shared boundary is a validation error.

## 17. Windows

A window attaches to one boundary using:

- `boundaryId`;
- `offset`;
- `width`;
- `height`;
- `sillHeight`.

Window vertical interval:

```text
[sillHeight, sillHeight + height]
```

It must not exceed wall height beyond tolerance.

Version 1 supports windows only on external wall intervals. Internal windows may be introduced later.

## 18. Opening Conflicts

Two opening intervals on the same physical wall must not overlap unless an extension explicitly supports compound openings.

The engine must compare:

- door intervals;
- passage intervals;
- window horizontal intervals.

A horizontal overlap is invalid if the openings also overlap vertically.

## 19. Floor Geometry

Create one floor surface per room by triangulating the room polygon.

Using separate room surfaces supports:

- selection;
- highlighting;
- occupancy overlays;
- temperature colouring;
- visibility toggles.

Floor surfaces should use the floor elevation. Optional thickness extends downward from that elevation.

## 20. Room Labels

Place a room label at an interior label point.

The polygon centroid may be used for simple convex rooms. For concave rooms, the engine should later use a point guaranteed to lie inside the polygon.

Labels are presentation objects and are not persisted as geometry.

## 21. Device Placement

A device position uses floor coordinates and optional height:

```json
{
  "position": [2.5, 1.5],
  "height": 1.2
}
```

The engine should validate that a room-bound device is inside or on the boundary of its room polygon.

A later local-coordinate mode may position an object relative to a room or boundary.

## 22. Multi-floor Geometry

Each floor provides an elevation. All geometry generated for the floor is translated vertically by that elevation.

Rooms must not span multiple floors in Version 1. Stairs may connect floors topologically before detailed stair geometry is supported.

## 23. Geometry Output Model

The geometry engine should return renderer-independent data such as:

```text
GeneratedBoundary[]
SharedBoundary[]
WallSegment[]
FloorSurface[]
ResolvedConnector[]
ResolvedOpening[]
GeometryIssue[]
```

Three.js meshes and SVG paths are adapter outputs, not core geometry objects.

## 24. Error Handling

Geometry generation should collect structured issues instead of failing at the first non-fatal problem.

Suggested severities:

```text
error
warning
info
```

Examples:

- self-intersecting polygon: error;
- opening partly outside boundary: error;
- unconnected room: warning;
- non-standard wall height: info.

## 25. Required Tests

The initial automated test suite must include:

- rectangle boundary generation;
- polygon boundary generation;
- exact shared boundary;
- reversed shared boundary;
- partial overlap and segmentation;
- disjoint collinear boundaries;
- near-match within tolerance;
- near-match outside tolerance;
- valid internal door;
- valid external door;
- valid open passage;
- valid window;
- opening exceeds boundary;
- conflicting openings;
- apartment reference model.

## 26. Acceptance Criteria

The rules are accepted when the reference apartment can be loaded and converted into consistent renderer-independent geometry without stored wall objects, manual mesh editing or special-case apartment logic.
