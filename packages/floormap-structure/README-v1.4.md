# Architectural Symbols v1.4

Add all files while keeping previous source and tests.

```bash
npm test
npm run build
node dist/examples/reference-apartment-symbols.js examples/reference-apartment-v1.2.json
open examples/reference-apartment-symbols.svg
```

For the interactive editor, call `addArchitecturalSymbols` after wall-opening resolution and before inserting transparent opening targets. The visible symbols and hit targets use the same inspection IDs.
