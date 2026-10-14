# Connector Rendering v0.8 patch

## Add

- `src/model/Connector.ts`
- `src/model/RenderedConnector.ts`
- `src/generation/ConnectorResolver.ts`
- `src/svg/SvgConnectorRenderer.ts`
- `test/ConnectorResolver.test.ts`
- `test/SvgConnectorRenderer.test.ts`

## Integration with SvgRenderer

Resolve connectors after generating the floor:

```ts
const renderedConnectors = resolveConnectors(connectors, floor);
```

Import `renderSvgConnectors` and `svgConnectorStyles` into `SvgRenderer.ts`. Add `svgConnectorStyles` to the SVG `<style>` block and add the rendered connector string after the walls group and before labels. Reuse the existing `sx` and `sy` functions:

```ts
const connectorElements = renderSvgConnectors(renderedConnectors, { x: sx, y: sy });
```

v0.8 renders doors in green, external doors in dark green, and open passages in orange. The overlay sits on top of the existing wall colour; actual wall cutting is deferred to connector-opening resolution.
