// Generic guard for the functions that are copied into the editor page via `fn.toString()`
// (manifest: src/embed.ts, rules: CLAUDE.md "How the browser code works").
// One test for the whole list replaces having to remember a per-module "embedded source" test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { embeddedFunctions, embeddedSource } from '../src/embed.js';
import { editorHtml } from '../src/editor.js';
import { freeIdentifiers } from './helpers/free-identifiers.js';

/** Globals the page provides to every browser and that are safe to use in embedded code although not in the ES2022 lib typings. */
const ALLOWED_GLOBALS = ['structuredClone'];

const names = embeddedFunctions.map((f) => f.name);
const source = embeddedSource();

test('every embedded function is named and listed once', () => {
  assert.ok(names.every((n) => n.length > 0), 'anonymous function in the manifest (use a named function declaration)');
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, [], `duplicate names in the manifest: ${dup.join(', ')}`);
});

test('every embedded function is serialised as a function declaration', () => {
  const missing = names.filter((n) => !new RegExp(`function\\s+${n}\\s*\\(`).test(source));
  assert.deepEqual(missing, [], `not a plain "function name(" declaration after toString (helper injected or arrow function?): ${missing.join(', ')}`);
});

test('embedded block is self-contained: no identifier outside the block and the ES2022 globals', () => {
  const free = freeIdentifiers(source).filter((n) => !ALLOWED_GLOBALS.includes(n));
  assert.deepEqual(free, [], `embedded code uses names that do not exist in the page: ${free.join(', ')}`);
});

test('embedded block evaluates (sloppy mode, like the page) and defines every manifest function', () => {
  const defined = new Function(`${source}\nreturn {${names.join(',')}}`)() as Record<string, unknown>;
  const notFunctions = names.filter((n) => typeof defined[n] !== 'function');
  assert.deepEqual(notFunctions, []);
});

test('generated page contains the embedded block verbatim', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixture = join(here, '../../../shared/reference-home-connectors.json');
  const html = editorHtml(JSON.parse(readFileSync(fixture, 'utf8')));
  assert.ok(html.includes(source));
});
