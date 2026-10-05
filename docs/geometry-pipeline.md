# Geometry Pipeline v1.0

## 1. Purpose

This document defines the staged transformation from building-domain JSON to renderer-ready 2D and 3D data.

The pipeline keeps domain validation, computational geometry and presentation adapters separate. This allows the same building model to support an SVG editor, a future Canvas renderer and a Three.js visualisation.

## 2. Pipeline Overview

```text
Input JSON
   |
   v
Parse and Schema Validation
   |
   v
Domain Normalisation
   |
   v
Room Geometry Validation
   |
   v
Boundary Generation
   |
   v
Boundary Overlap Detection
   |
   v
Canonical Wall Segmentation
   |
   v
Connector and Opening Resolution
   |
   v
Floor and Wall Geometry Generation
   |
   v
Renderer-independent Scene Model
   |                    |
   v                    v
SVG/2D Adapter       Three.js/3D Adapter
```

## 3. Stage 0: Input Acquisition

Inputs may come from:

- a bundled example JSON file;
- browser file import;
- local application storage;
- Home Assistant storage in a later milestone.

The pipeline receives text or a parsed object. It must never execute content from the input.

## 4. Stage 1: Parse and Schema Validate

Responsibilities:

- parse JSON;
- verify supported `schemaVersion`;
- verify required root properties;
- check required identifier and numeric fields;
- reject malformed structures;
- produce structured issues.

Output:

```text
ParsedBuildingDocument
SchemaIssue[]
```

No geometry work begins if parsing or required root validation fails.

## 5. Stage 2: Domain Normalisation

Responsibilities:

- apply documented default values;
- normalise optional collections to empty arrays;
- create fast lookup maps by ID;
- validate uniqueness of IDs;
- preserve source order for user-facing display;
- do not silently repair ambiguous references.

Suggested lookup indexes:

```text
floorsById
roomsById
boundariesById
connectorsById
openingsById
devicesById
```

## 6. Stage 3: Room Geometry Validation

For each room:

- validate vertex count;
- remove or report consecutive duplicate vertices;
- detect zero-length edges;
- calculate signed area;
- detect self-intersection;
- calculate bounding box;
- calculate display label point;
- identify invalid or degenerate rooms.

Output:

```text
ValidatedRoomGeometry[]
GeometryIssue[]
```

Rooms with fatal geometry errors are excluded from later geometry generation but remain available for editor diagnostics.

## 7. Stage 4: Boundary Generation

Generate one boundary per valid polygon edge.

Calculate:

- ID;
- floor ID;
- room ID;
- edge index;
- start and end;
- direction vector;
- length;
- bounding box.

If the source contains explicit boundary declarations, verify them against generated edges.

Output:

```text
GeneratedBoundary[]
```

## 8. Stage 5: Boundary Overlap Detection

Compare boundaries on the same floor according to `boundary-overlap-rules.md`.

Output:

```text
SharedBoundary[]
BoundaryOverlapIssue[]
```

This stage records geometric adjacency only. It does not assume that adjacent rooms are navigably connected.

## 9. Stage 6: Canonical Wall Segmentation

For each generated boundary:

- gather shared overlap intervals;
- convert overlap intervals into local boundary distances;
- split into non-overlapping intervals;
- classify each interval as shared, external or unresolved;
- deduplicate shared physical intervals.

Output:

```text
CanonicalWallSegment[]
```

Each physical shared wall segment appears once.

Example:

```json
{
  "id": "wall:shared:living-b1:dining-b3:0",
  "classification": "shared",
  "sourceBoundaries": ["living-b1", "dining-b3"],
  "roomIds": ["living", "dining"],
  "start": [4, 0],
  "end": [4, 4]
}
```

## 10. Stage 7: Connector Resolution

Resolve each connector against boundaries and wall segments.

### Internal door or passage

Validate:

- room and boundary references;
- geometric shared overlap;
- interval fits inside the overlap;
- width and height;
- style support;
- conflict with other openings.

### External door

Validate:

- exactly one room;
- one valid boundary;
- interval lies on an external wall segment.

Output:

```text
ResolvedConnector[]
ConnectorIssue[]
```

A resolved connector contains world-coordinate opening endpoints plus local offsets for both source boundaries.

## 11. Stage 8: Opening Resolution

Resolve windows and future non-navigable openings.

Validate:

- room and boundary references;
- external wall classification for Version 1 windows;
- horizontal interval;
- sill and height;
- wall-height fit;
- conflicts with connectors and other openings.

Output:

```text
ResolvedOpening[]
OpeningIssue[]
```

## 12. Stage 9: Wall Cut Planning

Before mesh generation, collect openings per canonical wall segment.

For each wall, construct a cut plan:

```text
solid interval
opening interval
solid interval
```

For 3D, openings also have vertical intervals, allowing wall geometry above doors and around windows.

Initial implementation should generate wall pieces around openings rather than rely on expensive runtime constructive solid geometry.

## 13. Stage 10: Floor Surface Generation

Triangulate each valid room polygon.

Output fields may include:

```text
vertices
triangleIndices
roomId
floorId
elevation
```

Keep one logical floor surface per room for state highlighting.

## 14. Stage 11: Wall Geometry Generation

### 2D output

Generate wall centre-line and thickness polygons suitable for SVG or Canvas.

### 3D output

Generate rectangular wall prisms or piecewise wall meshes using:

- segment start and end;
- wall thickness;
- wall height;
- floor elevation;
- cut plan.

Shared walls are generated once.

## 15. Stage 12: Door Geometry Generation

For each resolved door:

- generate the opening in the wall;
- generate a 2D symbol;
- generate optional swing arc;
- generate a 3D leaf or sliding panel;
- store closed and open transforms;
- attach semantic connector ID.

Door state animation belongs to a renderer or interaction layer, not the geometry core.

## 16. Stage 13: Window Geometry Generation

For each resolved window:

- preserve the wall opening;
- generate simplified frame data;
- generate optional glass panel data;
- attach semantic opening ID.

Detailed glazing and photorealistic materials are outside Version 1.

## 17. Stage 14: Device and Label Placement

Resolve devices into floor/world coordinates.

Generate room label placement using an interior point.

These are semantic scene objects, not permanent meshes in the geometry core.

## 18. Stage 15: Renderer-independent Scene Model

The final core output should not contain SVG DOM nodes or Three.js classes.

Suggested structure:

```text
GeneratedBuildingScene
  floors
  rooms
  boundaries
  walls
  connectors
  openings
  devices
  labels
  issues
```

Each item retains source semantic IDs for selection and Home Assistant binding.

## 19. Stage 16: 2D Adapter

The initial editor adapter should use SVG because it offers:

- precise vector rendering;
- straightforward hit testing via elements;
- scalable labels and symbols;
- CSS-based highlighting;
- easy debugging in browser tools.

The adapter converts scene data into:

- room polygons;
- wall polygons or lines;
- door and window symbols;
- room labels;
- selection overlays;
- validation markers.

SVG is an implementation choice for the prototype, not part of the domain model.

## 20. Stage 17: 3D Adapter

The Three.js adapter maps generated scene data into:

- floor meshes;
- wall meshes;
- door objects;
- window objects;
- device markers;
- labels or overlays;
- floor groups and visibility layers.

Each visual object should include semantic IDs in metadata for picking and state updates.

## 21. Incremental Recalculation

The first implementation may regenerate the complete floor after each edit.

Later optimisation may recalculate only impacted items:

- edited room;
- neighbouring boundaries;
- affected walls;
- attached connectors and openings.

Correctness takes priority over incremental performance during the prototype.

## 22. Caching

Caches may include:

- derived boundaries;
- spatial indexes;
- triangulations;
- generated wall meshes.

Caches must be keyed by source data and settings and must never become authoritative.

## 23. Diagnostics

Each stage should append issues with:

```text
code
severity
message
sourceId
floorId
stage
optional geometry location
```

Example codes:

```text
ROOM_SELF_INTERSECTION
BOUNDARY_ZERO_LENGTH
CONNECTOR_NO_SHARED_WALL
WINDOW_NOT_EXTERNAL
OPENING_INTERVAL_CONFLICT
```

## 24. First Proof of Concept

The first executable proof of concept should:

1. load `reference-apartment-v1.2.json`;
2. parse and validate it;
3. generate boundaries;
4. detect overlaps;
5. generate shared and external segments;
6. print or save structured JSON output;
7. run automated assertions.

No graphical interface is required for this proof.

## 25. Second Proof of Concept

Render the generated rooms, boundaries and overlap classifications as SVG:

- room fill;
- room labels;
- external boundaries in one style;
- shared boundaries in another;
- unresolved geometry highlighted;
- IDs available for inspection.

## 26. Third Proof of Concept

Resolve connectors and openings, then draw:

- open passage gap;
- internal doors;
- external doors;
- windows;
- error markers for invalid placements.

## 27. Fourth Proof of Concept

Generate the first basic Three.js scene from the same scene model:

- floor surfaces;
- wall prisms;
- openings;
- orbit controls;
- floor visibility;
- room selection.

## 28. Performance Targets

No hard performance requirement is needed for Version 1, but the prototype should avoid unnecessary recomputation inside render loops.

Geometry generation should occur when model data changes. Home Assistant state changes should update only visual state and animation where geometry remains unchanged.

## 29. Security and Data Integrity

- Treat imported JSON as untrusted data.
- Do not execute scripts or expressions from models.
- Validate numeric limits to avoid pathological geometry.
- Limit vertex and object counts in the editor if needed.
- Escape room names and labels before rendering as HTML.

## 30. Acceptance Criteria

The pipeline is accepted when one validated apartment JSON document can drive both a 2D representation and a basic 3D representation through the same renderer-independent generated scene, with stable IDs and structured diagnostics.
