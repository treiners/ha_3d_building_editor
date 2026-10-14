# SVG Polish v0.7.1 patch

Replace `src/svg/SvgRenderer.ts` and add `test/SvgRendererPolish.test.ts`.

Changes:

- room labels use the polygon centroid;
- room labels are centred horizontally and vertically;
- boundary labels are hidden by default;
- optional boundary labels use boundary midpoints;
- wall lines use square caps and miter joins;
- XML-sensitive labels and titles are escaped.

Run:

```bash
npm test
npm run build
```

Existing example scripts work unchanged. To display boundary IDs, pass:

```ts
{ showBoundaryIds: true }
```
