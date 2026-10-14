# Wall Segments v0.5 patch

This patch adds canonical wall-segment generation to the existing v0.4 project.

## Add

- `src/model/WallSegment.ts`
- `src/geometry/WallSegmentGenerator.ts`
- `test/WallSegmentGenerator.test.ts`

Keep all existing files and tests. Then run:

```bash
npm test
```

## Behaviour

The generator splits every boundary at shared-overlap breakpoints and classifies each interval as `external` or `shared`. Shared intervals retain the generated shared-boundary ID and adjacent room ID.
