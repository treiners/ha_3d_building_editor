# Boundary Overlap Detection Rules v1.0

## 1. Purpose

Boundary overlap detection identifies when polygon edges from different rooms occupy the same physical line and therefore represent a shared wall.

This algorithm is foundational for:

- internal versus external wall classification;
- elimination of duplicate walls;
- connector validation;
- wall segmentation;
- room adjacency;
- later navigation and information propagation.

## 2. Inputs

The detector receives generated boundaries with:

```json
{
  "id": "living-b1",
  "roomId": "living",
  "floorId": "ground",
  "start": [4, 0],
  "end": [4, 4]
}
```

Only boundaries on the same floor are compared.

## 3. Outputs

The detector returns:

```text
SharedBoundary[]
ExternalBoundarySegment[]
OverlapIssue[]
```

Example shared record:

```json
{
  "id": "shared:living-b1:dining-b3:0",
  "boundaryA": "living-b1",
  "boundaryB": "dining-b3",
  "rooms": ["living", "dining"],
  "start": [4, 0],
  "end": [4, 4],
  "length": 4,
  "relation": "full"
}
```

## 4. Tolerances

Default coordinate tolerance:

```text
0.01 m
```

Default angular/collinearity tolerance should be derived from coordinate tolerance and segment length rather than stored as degrees.

Tolerance must be configurable but consistent for one generation run.

Tolerance is used for:

- endpoint equality;
- point-on-line tests;
- collinearity;
- interval contact;
- minimum overlap length.

## 5. Pre-validation

Reject or report boundaries that:

- have non-finite coordinates;
- have length less than or equal to tolerance;
- reference missing rooms;
- reference different floors when compared as a pair.

Do not compare boundaries belonging to the same room for shared-wall detection. Self-overlap is a polygon validation issue.

## 6. Direction Independence

Boundary direction does not affect overlap.

These are equivalent geometrically:

```text
A: (4,0) -> (4,4)
B: (4,4) -> (4,0)
```

Direction remains important only when converting a global overlap position into a boundary-local offset.

## 7. Collinearity Test

Two segments may overlap only when they are collinear within tolerance.

For segment A from `a0` to `a1` and point `p`, use the two-dimensional cross product:

```text
cross(a1 - a0, p - a0)
```

The distance of each endpoint of B from A's infinite line must be within tolerance.

A robust implementation should compare perpendicular distance, not raw cross-product magnitude, because cross-product magnitude scales with segment length.

## 8. Canonical Projection Axis

Once two boundaries are collinear, project them onto a one-dimensional axis.

Use the normalised direction vector of boundary A:

```text
d = normalize(a1 - a0)
```

Projected scalar for point `p`:

```text
t = dot(p - a0, d)
```

Boundary A interval becomes:

```text
[0, length(A)]
```

Boundary B becomes:

```text
[min(t0, t1), max(t0, t1)]
```

## 9. Overlap Interval

For intervals `[aMin, aMax]` and `[bMin, bMax]`:

```text
overlapStart = max(aMin, bMin)
overlapEnd   = min(aMax, bMax)
overlapLength = overlapEnd - overlapStart
```

Classification:

- `overlapLength > tolerance`: physical overlap;
- `abs(overlapLength) <= tolerance`: endpoint contact only;
- `overlapLength < -tolerance`: disjoint.

Endpoint contact alone does not create a shared wall.

## 10. Full Overlap

A full overlap exists when the overlapping interval covers both boundaries within tolerance.

Examples:

```text
A: 0 to 4
B: 0 to 4
```

and reversed direction.

Output relation:

```text
full
```

## 11. Contained Overlap

One segment may be completely contained within another.

Example:

```text
A: 0 to 10
B: 3 to 7
```

Output relation:

```text
contained
```

A must be segmented into:

```text
0 to 3 external
3 to 7 shared
7 to 10 external
```

## 12. Partial Overlap

A partial overlap exists when neither boundary contains the other.

Example:

```text
A: 0 to 6
B: 4 to 10
```

Overlap:

```text
4 to 6
```

Each source boundary may therefore contain both shared and external intervals.

## 13. Disjoint Collinear Boundaries

Collinearity alone does not mean overlap.

Example:

```text
A: 0 to 3
B: 4 to 7
```

No shared record is created.

## 14. Multiple Neighbours on One Boundary

A long room boundary may overlap multiple neighbouring rooms.

Example:

```text
Room A boundary: 0 to 10
Room B:          0 to 4
Room C:          4 to 10
```

Produce two shared records, provided their intervals do not overlap beyond tolerance.

If more than one room overlaps the same physical interval, report an ambiguous overlap error.

## 15. Segmentation Rules

For each source boundary:

1. collect all overlap start and end distances in local coordinates;
2. add boundary distances `0` and `length`;
3. sort and merge positions within tolerance;
4. create intervals between consecutive positions;
5. classify each interval as shared or external;
6. discard intervals at or below tolerance.

This process yields the canonical wall segments for later geometry generation.

## 16. Stable Generated IDs

Generated shared-boundary IDs should not depend on comparison order.

Recommended pattern:

```text
shared:<sorted-boundary-a>:<sorted-boundary-b>:<segment-index>
```

External segment IDs:

```text
external:<boundary-id>:<segment-index>
```

Segment indices are assigned in source-boundary direction after tolerance-normalised sorting.

## 17. Local Offset Conversion

A shared overlap has one global line interval but two boundary-local coordinate systems.

For each boundary, calculate:

```text
localStart
localEnd
reversedRelativeToShared
```

This allows a connector attached through `boundaryA` to be resolved against `boundaryB`, even if boundary directions are opposite.

## 18. Connector Consistency

A two-room connector is valid only if:

- both boundaries exist;
- the boundaries belong to the connector's rooms;
- the boundaries share a physical overlap;
- the connector interval lies fully inside that overlap;
- width is positive;
- no conflicting opening occupies the same interval.

The connector's authoritative offset is measured on `boundaryA`.

The engine derives the corresponding interval on `boundaryB`.

## 19. Open Passage Consistency

An open passage follows the same overlap rules as a door but does not generate a leaf.

If its width equals the full shared interval within tolerance, the shared wall is removed entirely for that interval.

## 20. External Connector Consistency

An external door is valid only when its entire interval lies on an external boundary segment.

If a partial shared overlap cuts through the intended external door interval, validation fails.

## 21. Window Consistency

In Version 1, a window's complete horizontal interval must lie on an external boundary segment.

A window on a shared segment is invalid.

## 22. Room Adjacency Output

Each shared boundary creates a geometric adjacency relationship:

```json
{
  "roomA": "living",
  "roomB": "dining",
  "sharedLength": 4
}
```

Geometric adjacency does not imply navigability. Navigation requires a connector such as a door or open passage.

## 23. Complexity and Optimisation

A simple implementation may compare all boundary pairs on a floor:

```text
O(n^2)
```

This is acceptable for the initial prototype and small homes.

Later optimisation options include:

- axis-aligned bounding-box rejection;
- spatial hashing;
- R-tree indexing;
- grouping by approximate line equation.

Optimisation must not change results.

## 24. Reference Apartment Expectations

Using the agreed apartment coordinates, the detector should find at least these intended adjacencies:

```text
living <-> dining
bedroom <-> bathroom
```

The current approximate polygons also create other geometric contacts that must be inspected separately from intended connector topology. This is useful: it verifies that geometry adjacency and navigable connectivity are distinct concepts.

The apartment fixture should therefore assert both:

- all geometric overlaps found by coordinates;
- all connectors explicitly declared by the domain model.

## 25. Error Conditions

Report errors for:

- zero-length boundaries;
- ambiguous triple overlap on the same interval;
- connector references boundaries without an overlap;
- connector interval outside shared overlap;
- external door on shared interval;
- window on shared interval;
- inconsistent room and boundary references.

Report warnings for:

- extremely short shared intervals;
- near-collinear segments slightly outside tolerance;
- rooms touching only at one point;
- unintended adjacency without connector.

## 26. Minimum Test Matrix

1. same direction exact match;
2. reversed exact match;
3. contained overlap;
4. partial overlap;
5. disjoint collinear segments;
6. parallel non-collinear segments;
7. perpendicular intersection;
8. endpoint contact only;
9. coordinate difference within tolerance;
10. coordinate difference outside tolerance;
11. one boundary shared with two neighbours;
12. ambiguous triple overlap;
13. connector within overlap;
14. connector outside overlap;
15. external opening on external segment;
16. external opening crossing into shared segment;
17. apartment reference fixture.

## 27. Acceptance Criteria

The overlap detector is accepted when it produces stable, deterministic shared and external segments for the reference apartment and synthetic test cases, regardless of boundary direction and small coordinate noise.
