# Room Graph (room-side connector graph v2.1 preview)

Part of the HA 3D Building Editor suite (see the root README); its output feeds `floormap-editor`. Formerly `room-side-connectors-v2.1-preview`.

Adds square room nodes, continuous dragging, wall-side connector entry, visible connector markers, and connector-to-connector relationships.

```bash
npm install
npm test
npm run build
node dist/examples/room-side-connector-editor.js examples/reference-home-connectors.json
open examples/room-side-connector-editor.html
```
