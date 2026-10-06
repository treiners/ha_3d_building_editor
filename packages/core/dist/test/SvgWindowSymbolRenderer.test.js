import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderSvgWindowSymbols, svgWindowSymbolStyles } from "../src/svg/SvgWindowSymbolRenderer.js";
const tx = { x: (v) => v * 10, y: (v) => v * 10 };
describe("window symbols", () => { it("renders permanent glazing and two frame lines", () => { const w = { openingId: "w", start: { x: 1, y: 0 }, end: { x: 2, y: 0 } }; const s = renderSvgWindowSymbols([w], tx); assert.match(s, /window-glazing/); assert.equal((s.match(/window-frame/g) || []).length, 2); assert.match(s, /data-inspect-id="w"/); }); it("uses visible blue glazing", () => assert.match(svgWindowSymbolStyles, /#38bdf8/)); });
