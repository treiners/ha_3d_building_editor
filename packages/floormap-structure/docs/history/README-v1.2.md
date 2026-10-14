# Interactive SVG Inspection v1.2

Add all package files and keep existing source/tests.

```bash
npm test
npm run build
node dist/examples/reference-apartment-interactive.js examples/reference-apartment-v1.2.json
open examples/reference-apartment-interactive.html
```

The HTML file is standalone and opens directly in a browser. Click a room or rendered wall to inspect it. Connector/window inspection becomes available when their SVG elements are included by the existing render pipeline.
