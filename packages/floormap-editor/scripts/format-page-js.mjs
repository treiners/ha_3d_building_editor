// Formats the JavaScript inside ONE template-string file of the page script (refactoring step 5b, docs/REFACTORING-LOG.md).
//
//   node scripts/format-page-js.mjs src/editor-core-aligns.ts            dry run: sizes + equivalence check, writes nothing
//   node scripts/format-page-js.mjs src/editor-core-aligns.ts --write
//
// How: takes the text of the template literal, evaluates it to the JavaScript the page really receives ("cooked"), formats it
// with Prettier (one statement per line, tab width 1 so the page stays small), checks that the token list is unchanged
// (test/helpers/page-tokens: ignores only whitespace, comments, semicolons, parentheses, quote style, number spelling),
// escapes the result back into template-literal text (backslash, backtick, ${, non-ASCII as \uXXXX) and checks that it cooks
// to exactly the formatted text. Aborts (nothing written) on any mismatch, on ${...} interpolations, or without Prettier.
// After --write: `npm test` (bytes golden fails, token golden passes), `npm run golden:update-bytes`, `npm run smoke`.
// Needs `npm run build` first (it uses dist/test/helpers/page-tokens.js) and `npm i -D prettier`.
import { readFileSync, writeFileSync } from 'node:fs';
import { pageTokens } from '../dist/test/helpers/page-tokens.js';

const [file, ...flags] = process.argv.slice(2);
const write = flags.includes('--write');
const fail = (m) => { console.error('ABORT: ' + m); process.exit(1); };
if (!file) fail('usage: node scripts/format-page-js.mjs <src/editor-file.ts> [--write]');
const prettier = await import('prettier').catch(() => null);
if (!prettier) fail('prettier is not installed: run `npm i -D prettier`');

const text = readFileSync(file, 'utf8');
const m = /export const \w+\s*(?::[^=]+)?=\s*`/.exec(text);
if (!m) fail('no `export const x = ```-style template literal found (arrow-function parts with parameters are not supported yet)');
const base = m.index + m[0].length, close = text.lastIndexOf('`');
const raw = text.slice(base, close);
if (/(^|[^\\])\$\{/.test(raw)) fail('the template has ${...} interpolations; handle this file by hand');

const cook = (r) => new Function('return `' + r + '`')();
const toRaw = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  .replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

const cooked = cook(raw);
const formatted = (await prettier.format(cooked, { parser: 'babel', singleQuote: true, printWidth: 110, tabWidth: 1, trailingComma: 'none', semi: true, quoteProps: 'preserve' })).replace(/\n$/, '');

const a = pageTokens(cooked), b = pageTokens(formatted);
if (a.length !== b.length || a.some((t, i) => t !== b[i])) {
  const i = a.findIndex((t, k) => t !== b[k]);
  fail(`token lists differ at token ${i}: "${a[i]}" vs "${b[i]}" (formatter changed the code?)`);
}
const newRaw = toRaw(formatted);
if (cook(newRaw) !== formatted) fail('escaping round trip failed (script bug)');

const lines = (s) => s.split('\n').length;
console.log(`${file}: ${cooked.length} -> ${formatted.length} chars (${Math.round((formatted.length / cooked.length - 1) * 100)}%), ${lines(cooked)} -> ${lines(formatted)} lines, ${a.length} tokens unchanged`);
if (!write) { console.log('dry run: add --write to apply.'); process.exit(0); }
writeFileSync(file, text.slice(0, base) + newRaw + text.slice(close));
console.log('written. Now: npm test, npm run golden:update-bytes, npm run smoke.');
