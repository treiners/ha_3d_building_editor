// Ratchet for the typing work (refactoring step 3): the number of explicit `any` per source file may only go down.
// `tsc` cannot forbid `any` file by file, so this test pins the current count in test/any-budget.json.
//   - more `any` than the budget  -> fail (type it, or ask before raising the budget),
//   - fewer                       -> pass, and `npm run any:update` lowers the budget so the gain is kept,
//   - a new file                  -> budget 0, i.e. new code must be typed.
// Counted: `: any`, `<any>`, `, any`, `| any`, `(any`, `as any`, `any[]` in code (comments are removed first).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Tests run from dist/test; sources and the budget file live in the source tree.
const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../../src');
const budgetPath = join(here, '../../test/any-budget.json');

const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const countAny = (s: string): number => (stripComments(s).match(/[:<,|(]\s*any\b|\bas\s+any\b|\bany\[\]/g) || []).length;

function currentCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of readdirSync(srcDir).filter((n) => n.endsWith('.ts')).sort()) counts[f] = countAny(readFileSync(join(srcDir, f), 'utf8'));
  return counts;
}

test('explicit any per source file stays within the budget', () => {
  const now = currentCounts();
  if (process.env.ANY_BUDGET_UPDATE === '1') {
    const old: Record<string, number> = existsSync(budgetPath) ? JSON.parse(readFileSync(budgetPath, 'utf8')) : {};
    const raised = Object.keys(now).filter((f) => f in old && now[f] > old[f]);
    assert.deepEqual(raised, [], `refusing to raise the budget for: ${raised.join(', ')}`);
    writeFileSync(budgetPath, JSON.stringify(now, null, 1) + '\n');
    return;
  }
  assert.ok(existsSync(budgetPath), 'budget file missing: run `npm run any:update` once and commit test/any-budget.json');
  const budget: Record<string, number> = JSON.parse(readFileSync(budgetPath, 'utf8'));
  const over = Object.keys(now).filter((f) => now[f] > (budget[f] ?? 0)).map((f) => `${f}: ${now[f]} > ${budget[f] ?? 0}`);
  assert.deepEqual(over, [], `more explicit any than allowed (type it): ${over.join('; ')}`);
});
