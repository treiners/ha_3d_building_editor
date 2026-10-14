# Boundary Generator Prototype

A dependency-light TypeScript proof of concept for generating deterministic room boundaries from polygon geometry.

## Included

- `BoundaryGenerator.ts`
- domain types for `Point`, `Room`, and `Boundary`
- automated tests using Node's built-in test runner
- strict TypeScript configuration

## Run

The archive does not include `node_modules`.

```bash
npm install
npm test
```

The tests compile the TypeScript project and then run the generated JavaScript with `node --test`.

## Current responsibility

`generateBoundaries(room)`:

- validates the room ID and basic polygon vertex data;
- creates one boundary per polygon edge;
- closes the final edge back to the first vertex;
- creates deterministic boundary IDs;
- calculates Euclidean lengths;
- rejects zero-length edges;
- does not mutate the source room.

Polygon self-intersection, non-zero area, boundary overlap detection, and tolerance-based normalisation belong to later geometry stages.
