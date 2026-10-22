# REFACTORING LOG

Guidance: `HANDOVER-REFACTORING.md`. This file tracks decisions, baseline and step status. Update it at the end of every step (one short entry).

## Decisions (confirmed by the user)
- The 3D visualisation is external and only reads the JSON file. Keeping the saved format compatible is enough; minor format changes are adapted on the visualisation side. No shared-package work is planned now.
- `schemaVersion` stays `"2.14"` (optional fields only). A bump needs an explicit user decision.
- Stay on `tsc` + `fn.toString()` embedding until step 6 (bundler decision after step 5).
- Golden-HTML test accepted; updated on purpose with `npm run golden:update`.
- Refactoring comes before the backlog (polygon rooms, ghost snapping, per-floor mapper).
- `schemaVersion` bump to `3.0`: not part of the refactoring; `schema.ts` already allows `'2.14' | '3.0'`. Do it as one deliberate step (write 3.0, accept both, no-op migration) once the external visualisation is known to accept it. Open: does the visualisation check the version string?

## Principles
1. Pure moves: byte-identical generated HTML. Other changes: same tests + smoke results.
2. One step = one commit = one gate. A failed gate is reverted, not patched forward.
3. Naming: verbs for actions (`buildSavedGraph`, `viewFit`), nouns for state. Each new module has a header comment: purpose, inputs/outputs, allowed sibling globals, embedding rules.
4. Comments explain why (invariants, order dependencies, traps), not what.
5. Token economy: exact-substring edits, never echo long lines, report only failing test lines, script mechanical changes.
6. Never change an existing test expectation without asking.

## Steps and status
| Step | Content | Status |
|---|---|---|
| 0 | Baseline (`npm test && npm run smoke`), golden-HTML test + update script, smoke in CI, round-trip stays green | done (all green; golden file created with `npm run golden:update`; no CI config touched) |
| 1 | `src/embed.ts` manifest (ordered list + `embeddedSource()`), `test/embed.test.ts` generic test (names, declarations, free-identifier scan via TS checker, evaluation). `needs` lists dropped: the scan makes them redundant | done (354 tests, 353 pass, 1 skipped) |
| 2 | Hook registry in `src/editor-hooks.ts`: `onBeforeRender`, `onRender`, `onBeforeRestore`, `onBeforeAppMode`, `onAfterLoad`; all hand-written wrappers converted (done, green, smoke fully green). Side fixes: Fit includes areas, undo buttons refresh after compass, dead `dl()` removed (one stale assertion in `defaults.test.ts` changed with user OK) | done |
| 3 | `schema.ts` shared types, remove `any` module by module, `strict` on. Slice 3a (done): `src/schema.ts` (FloorplanGraph / WorkingGraph / Floor / Stair / Area / EntityPlacement ..., additive over core.ts types), `test/any-budget.test.ts` ratchet + `npm run any:update`. Slice 3b (done): internals of `origin`, `defaults`, `contract` typed with schema types; public parameters/returns stay `any` on purpose (tests pass partial literals; narrowing them could break existing tests, revisit with a `GraphInput` type). Only emitted-JS change: `checkContract` gets `const graph = input;`. STATUS: stopped here on purpose. `floors`, `stairs`, `areas`, `entities` (about 190 `any`) are pure and covered by 350+ tests; typing them needs many non-null assertions and the legacy stair format (`s.lower.room`), so it is deferred and the ratchet (`any-budget`) only lets it shrink. Resume when those files are touched anyway | partly done (deferred) |
| 4 | State encapsulation. Survey (`scripts/survey-globals.mjs`): 29 top-level `let`s; most are private to one module. `test/page-names.test.ts` (no undeclared names in the page script) guards renames. `scripts/encapsulate-state.mjs <file> <obj> <names> [--write]` moves a module's private lets into one object (scope-aware, aborts on shared names). Plan: entities (`entUi`: eact, placing, fRoom, fType, entHint, entClip, entPtr, entSizes, entCov, entTab), site (`siteUi`: sact, selA, siteKind); then stairs (`selS`) / openings (`addGhost`) if worthwhile. Shared lets (`g`, `active`, `view`, `selE`, `selM`, `selPort`, `mode`, `appMode`, `step`) stay global for now; `g` last, only with the scope-aware tool (593 syntactic refs, also a local name in embedded functions) | in progress |
| 5 | Split script core of `editor.ts` along seams (still template strings, byte-identical) | todo |
| 6 | Bundler decision (prototype one module first) | todo |

## Baseline (fill in during step 0)
- Date / commit:
- `npm test`: 357 tests, 356 pass, 0 fail, 1 skipped (after slice 2a and golden update)
- `npm run smoke`: `browser-smoke.mjs` and `browser-smoke-connectors.mjs` pass. KNOWN FAILURES BEFORE THE REFACTORING (user confirmed, not regressions): `browser-smoke-site.mjs:70` (floors' `fit` overrides site's `fit`, so Fit omits areas) and `browser-smoke-plan.mjs:17` (undo button not refreshed after a compass drag). Planned fix: separate commit after step 2, expectations unchanged.
- Golden hash of `examples/room-graph_mapping.html`:
- Count of `ignoreIds:hidden()` in generated HTML (must stay 7):

## Step log
- Step 1: editor.ts line with the hand-written function list replaced by `${embeddedSource()}`; old per-module embed tests left in place (remove later, needs user OK). Unused value imports remain in editor.ts (cleanup candidate, tsc does not flag them).
