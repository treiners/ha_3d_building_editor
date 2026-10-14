# Opening Validator v1.1

Add all files while keeping existing source and tests.

```bash
npm test
npm run build
node dist/examples/validate-reference-apartment.js examples/reference-apartment-v1.2.json
```

The command prints structured warnings/errors and exits with code 1 when errors exist. Shared-wall windows are warnings by default.
