// Golden-file safety net for the refactoring (docs/REFACTORING-LOG.md, step 0 and 5b).
// Two fingerprints of the generated editor page for the reference home:
//   1. the BYTES (test/golden/editor.html): must stay identical during pure moves of code,
//   2. the TOKENS of the page script (test/golden/page-tokens.sha256): the same code, whatever the formatting.
// A formatting-only change fails (1) and passes (2): then `npm run golden:update-bytes` is the right command.
// Any change of behaviour fails (2) as well: then read the message, and only for an intended change run `npm run golden:update`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { editorHtml } from '../src/editor.js';
import { pageTokens } from './helpers/page-tokens.js';

// Tests run from dist/test: fixture is in packages/shared, golden files stay in the source tree (test/golden).
const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../shared/reference-home-connectors.json');
const goldenPath = join(here, '../../test/golden/editor.html');
const tokensPath = join(here, '../../test/golden/page-tokens.sha256');

// GOLDEN_UPDATE: 1 = both fingerprints, bytes = only the bytes, tokens = only the tokens.
const mode = process.env.GOLDEN_UPDATE ?? '';
const updateBytes = mode === '1' || mode === 'bytes';
const updateTokens = mode === '1' || mode === 'tokens';

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

/** SHA-256 of the token list of the largest <script> of the page. */
function pageScriptTokenHash(html: string): string {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).sort((a, b) => b.length - a.length);
  assert.ok(scripts.length > 0, 'no <script> in the generated page');
  return createHash('sha256').update(pageTokens(scripts[0]!).join('\u0001')).digest('hex');
}

test('generated editor HTML equals the golden file (bytes)', () => {
  const html = generate();
  if (updateBytes) {
    mkdirSync(dirname(goldenPath), { recursive: true });
    writeFileSync(goldenPath, html);
    return;
  }
  assert.ok(existsSync(goldenPath), 'golden file missing: run `npm run golden:update` once and commit test/golden/editor.html');
  const golden = readFileSync(goldenPath, 'utf8');
  assert.ok(html === golden, describeFirstDifference(html, golden) + '\n  (if page-tokens still passes this is formatting only: npm run golden:update-bytes)');
});

test('page script is the same code as in the golden fingerprint (tokens, formatting-insensitive)', () => {
  const hash = pageScriptTokenHash(generate());
  if (updateTokens) {
    mkdirSync(dirname(tokensPath), { recursive: true });
    writeFileSync(tokensPath, hash + '\n');
    return;
  }
  assert.ok(existsSync(tokensPath), 'token fingerprint missing: run `npm run golden:update` once and commit test/golden/page-tokens.sha256');
  assert.equal(hash, readFileSync(tokensPath, 'utf8').trim(), 'the page script contains different code (not just different formatting)');
});

test('generation is deterministic (two runs are identical)', () => {
  assert.equal(generate(), generate());
});

// Existing regression test also counts this; kept here because refactoring steps may touch many strings.
// Formatting-insensitive on purpose (a formatter writes `ignoreIds: hidden()`).
test('literal "ignoreIds:hidden()" occurs exactly 7 times in the generated HTML', () => {
  assert.equal((generate().match(/ignoreIds:\s*hidden\(\)/g) || []).length, 7);
});
