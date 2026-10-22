// Safety net for renames and splits of the page script (refactoring steps 4 and 5): every name the generated
// page script uses must be declared in it or be a standard JavaScript / browser (DOM) global. A rename that leaves
// a reference behind (for example in another module) shows up here at once, instead of as a runtime
// ReferenceError in a rarely used tool. Uses the TypeScript checker on the largest <script> of the reference page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { editorHtml } from '../src/editor.js';
import { freeIdentifiers } from './helpers/free-identifiers.js';

/** Names that are valid in the browser although the checker may not know them (none known yet; add with a reason). */
const ALLOWED: string[] = [];

test('page script uses no undeclared names', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const html = editorHtml(JSON.parse(readFileSync(join(here, '../../../shared/reference-home-connectors.json'), 'utf8')));
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).sort((a, b) => b.length - a.length);
  assert.ok(scripts.length > 0, 'no <script> in the generated page');
  const free = freeIdentifiers(scripts[0]!, ['lib.es2022.d.ts', 'lib.dom.d.ts']).filter((n) => !ALLOWED.includes(n));
  assert.deepEqual(free, [], `undeclared names in the page script: ${free.join(', ')}`);
});
