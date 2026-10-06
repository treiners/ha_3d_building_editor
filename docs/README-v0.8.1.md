# SVG Connector Integration v0.8.1

Replace `src/svg/SvgRenderer.ts`; add `examples/json-to-svg.ts` and `test/SvgConnectorIntegration.test.ts`.

Build and convert the apartment JSON:

```bash
npm test
npm run build
node dist/examples/json-to-svg.js examples/reference-apartment-v1.2.json
```

The output is `examples/reference-apartment-v1.2.svg`. Doors are green, external doors dark green, and open passages orange.
