import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderEditableInspectionHtml } from "../src/interaction/EditableInspectionDocument.js";
describe("editable inspection document", () => { it("contains offset editor and JSON download", () => { const h = renderEditableInspectionHtml("<svg></svg>", { records: [], byKey: {} }, { building: { floors: [{ rooms: [] }] } }); assert.match(h, /Apply offset/); assert.match(h, /Download updated JSON/); assert.match(h, /updateLine/); }); });
