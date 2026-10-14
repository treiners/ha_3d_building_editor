# Geometry Pipeline v0.6 patch

This patch adds the first authoritative entry point for generating complete floor geometry.

## Add

- `src/model/GeneratedFloor.ts`
- `src/generation/GeometryPipeline.ts`
- `test/GeometryPipeline.test.ts`

Keep all existing files and tests, then run:

```bash
npm test
```

## Pipeline

```text
Room[]
  -> Boundary[]
  -> SharedBoundary[]
  -> WallSegment[]
  -> GeneratedFloor
```

`GeneratedFloor` is renderer-independent and will become the input for the future SVG and Three.js adapters.
