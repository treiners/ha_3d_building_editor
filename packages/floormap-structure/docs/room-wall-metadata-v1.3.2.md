# Room and Wall Metadata v1.3.2

This patch unifies selection metadata for room polygons and wall lines.

## Integration

In `examples/reference-apartment-openings-editor.ts`, import:

```ts
import { enableRoomAndWallInspection } from "../src/svg/SvgRendererInspectionPatch.js";
```

Immediately after calling `renderFloorSvg`, apply:

```ts
svg = enableRoomAndWallInspection(svg);
```

Do this before inserting opening targets.

## Expected behaviour

- room polygons expose `data-inspect-type="room"` and `data-inspect-id`;
- wall lines expose `data-inspect-type="wall"` and `data-inspect-id`;
- rooms receive pointer events across their filled polygon;
- walls receive pointer events along their stroke;
- the delegated click handler in the patched `EditableInspectionDocument.ts` handles both entity types.
