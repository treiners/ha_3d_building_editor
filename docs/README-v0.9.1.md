# Actual SVG Openings v0.9.1

This patch makes resolved wall gaps the default SVG presentation. Coloured connector lines become optional debug guides.

## Apply

Replace:

- `src/svg/SvgRenderer.ts`

Add:

- `examples/json-to-svg-actual-openings.ts`
- `test/SvgActualOpenings.test.ts`

Keep all earlier files and tests.

## Run

```bash
npm test
npm run build
node dist/examples/json-to-svg-actual-openings.js examples/reference-apartment-v1.2.json
```

To include coloured connector debugging guides:

```bash
node dist/examples/json-to-svg-actual-openings.js examples/reference-apartment-v1.2.json --guides
```

Without `--guides`, door and passage locations are visible as actual gaps in the wall lines.
