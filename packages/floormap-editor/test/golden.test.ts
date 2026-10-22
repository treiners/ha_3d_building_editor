// Golden-file safety net for the refactoring (docs/REFACTORING-LOG.md, step 0).
// The generated editor HTML for the reference home must stay byte-identical during pure
// refactoring steps. For an intentional change run `npm run golden:update` and commit the new file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { editorHtml } from '../src/editor.js';

// Tests run from dist/test: fixture is in packages/shared, golden file stays in the source tree (test/golden).
const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../shared/reference-home-connectors.json');
const goldenPath = join(here, '../../test/golden/editor.html');

const generate = (): string => editorHtml(JSON.parse(readFileSync(fixturePath, 'utf8')));

/** Short description of the first difference (the HTML has very long lines, so show a window, not a diff). */
function describeFirstDifference(actual: string, expected: string): string {
  let i = 0;
  const n = Math.min(actual.length, expected.length);
  while (i < n && actual[i] === expected[i]) i++;
  const line = actual.slice(0, i).split('\n').length;
  const col = i - (actual.lastIndexOf('\n', i - 1) + 1) + 1;
  const win = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 80));
  return `first difference at line ${line}, column ${col} (offset ${i}); lengths ${actual.length} vs ${expected.length}\n  now:    ${win(actual)}\n  golden: ${win(expected)}`;
}

test('generated editor HTML equals the golden file', () => {
  const html = generate();
  if (process.env.GOLDEN_UPDATE === '1') {
    mkdirSync(dirname(goldenPath), { recursive: true });
    writeFileSync(goldenPath, html);
    return;
  }
  assert.ok(existsSync(goldenPath), 'golden file missing: run `npm run golden:update` once and commit test/golden/editor.html');
  const golden = readFileSync(goldenPath, 'utf8');
  assert.ok(html === golden, describeFirstDifference(html, golden));
});

test('generation is deterministic (two runs are identical)', () => {
  assert.equal(generate(), generate());
});

// Existing regression test also counts this; kept here because refactoring steps may touch many strings.
test('literal "ignoreIds:hidden()" occurs exactly 7 times in the generated HTML', () => {
  assert.equal(generate().split('ignoreIds:hidden()').length - 1, 7);
});
