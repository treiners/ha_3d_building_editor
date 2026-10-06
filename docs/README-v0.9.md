# Opening Resolution v0.9

Add:

- `src/model/OpeningResolution.ts`
- `src/generation/OpeningResolver.ts`
- `test/OpeningResolver.test.ts`
- `examples/json-to-svg-openings.ts`

The resolver cuts door and passage intervals out of wall segments. Internal connectors cut both source boundaries; external doors cut one.

Run:

```bash
npm test
npm run build
node dist/examples/json-to-svg-openings.js examples/reference-apartment-v1.2.json
```

The example writes `examples/reference-apartment-v1.2-openings.svg`. Connector colours remain as debug guides. Remove the `connectors` option in the example to inspect wall gaps without overlays.
