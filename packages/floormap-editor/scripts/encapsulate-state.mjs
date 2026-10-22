// Moves a module's private top-level `let` variables into ONE object (refactoring step 4, docs/REFACTORING-LOG.md).
//
//   node scripts/encapsulate-state.mjs src/editor-entities.ts entUi eact,placing,fRoom      (dry run: report + samples)
//   node scripts/encapsulate-state.mjs src/editor-entities.ts entUi eact,placing,fRoom --write
//
// The browser modules are JavaScript inside a template string, so the script parses the text between the backticks with
// the TypeScript parser, resolves every identifier with the type checker (shadowed locals and property names are NOT
// touched) and rewrites `placing` -> `entUi.placing`, `{placing}` -> `{placing: entUi.placing}`, and the `let` declaration
// -> `const entUi={placing:...}`. It refuses (ABORT, nothing written) when:
//   - the template has ${...} interpolations, a name is not a top-level let/var of this file, or an initializer uses another moved name,
//   - the object name or a moved name is used in another src/*.ts file (it would break or collide),
//   - the rewritten text no longer parses.
// After --write: `npm test` (page-names test catches dangling references), `npm run golden:update`, `npm run smoke`.
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

const [file, obj, namesArg, ...flags] = process.argv.slice(2);
if (!file || !obj || !namesArg) { console.error('usage: node scripts/encapsulate-state.mjs <src/editor-x.ts> <objectName> <name1,name2,...> [--write]'); process.exit(2); }
const write = flags.includes('--write');
const names = new Set(namesArg.split(',').map((s) => s.trim()).filter(Boolean));
const fail = (m) => { console.error('ABORT: ' + m); process.exit(1); };

// 1. the JavaScript text inside the template literal that declares the first moved name
//    (a file may hold several templates, e.g. CSS and JS). ${...} interpolations are replaced by same-length ones so
//    that positions stay valid; edits never touch them (checked below).
const text = readFileSync(file, 'utf8');
const templates = [];
for (const m of text.matchAll(/export const \w+\s*(?::[^=]+)?=\s*`/g)) {
  const base = m.index + m[0].length;
  let end = base;
  while (end < text.length && !(text[end] === '`' && text[end - 1] !== '\\')) end++;
  templates.push({ base, end });
}
if (!templates.length) fail('no `export const x = ```-style template literal found');
const first = [...names][0];
const hit = templates.filter((t) => new RegExp(`(let|var)\\s+[^;]*\\b${first}\\b`).test(text.slice(t.base, t.end)));
if (hit.length !== 1) fail(`could not tell which template declares "${first}" (${hit.length} candidates)`);
const base = hit[0].base, close = hit[0].end;
const holes = [];
/** Replaces every ${...} by same-length ones (so the text parses as plain JS); records the spans when `record` is set. */
function neutralize(str, record) {
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '$' && str[i + 1] === '{' && str[i - 1] !== '\\') {
      let depth = 0, j = i + 1;
      for (; j < str.length; j++) { if (str[j] === '{') depth++; else if (str[j] === '}' && --depth === 0) break; }
      if (record) record.push([i, j + 1]);
      str = str.slice(0, i) + '1'.repeat(j + 1 - i) + str.slice(j + 1);
      i = j;
    }
  }
  return str;
}
const src = neutralize(text.slice(base, close), holes);
const orig = text.slice(base, close);

// 2. checker over that text (as a plain script, DOM globals known)
const options = { allowJs: true, checkJs: false, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [] };
const host = ts.createCompilerHost(options);
const getSourceFile = host.getSourceFile.bind(host), readFile = host.readFile.bind(host), fileExists = host.fileExists.bind(host);
host.getSourceFile = (f, v, ...r) => (f === '/chunk.js' ? ts.createSourceFile(f, src, v, true) : getSourceFile(f, v, ...r));
host.readFile = (f) => (f === '/chunk.js' ? src : readFile(f));
host.fileExists = (f) => f === '/chunk.js' || fileExists(f);
const program = ts.createProgram(['/chunk.js'], options, host);
const checker = program.getTypeChecker();
const sf = program.getSourceFile('/chunk.js');

// 3. the declarations of the moved names (top level only)
const symToName = new Map(), declNames = new Set(), statements = [];
for (const st of sf.statements) {
  if (!ts.isVariableStatement(st)) continue;
  const isConst = !!(st.declarationList.flags & ts.NodeFlags.Const);
  const targets = [], others = [];
  for (const d of st.declarationList.declarations) {
    if (ts.isIdentifier(d.name) && names.has(d.name.text)) {
      if (isConst) fail(`"${d.name.text}" is a const, not a let`);
      symToName.set(checker.getSymbolAtLocation(d.name), d.name.text); declNames.add(d.name);
      targets.push({ name: d.name.text, init: d.initializer ? src.slice(d.initializer.getStart(sf), d.initializer.end) : 'undefined', initRange: d.initializer ? [d.initializer.getStart(sf), d.initializer.end] : null });
    } else others.push(src.slice(d.getStart(sf), d.end));
  }
  if (targets.length) statements.push({ st, targets, others, kw: st.declarationList.flags & ts.NodeFlags.Let ? 'let' : 'var' });
}
const found = new Set(statements.flatMap((s) => s.targets.map((t) => t.name)));
const missing = [...names].filter((n) => !found.has(n));
if (missing.length) fail(`not a top-level let/var in ${basename(file)}: ${missing.join(', ')}`);

// 4. collisions with other files
const dir = dirname(file);
const word = (n) => new RegExp(`(^|[^A-Za-z0-9_$.])${n}(?![A-Za-z0-9_$])`, 'g');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && x !== basename(file))) {
  const other = readFileSync(join(dir, f), 'utf8');
  if (new RegExp(`\\b${obj}\\b`).test(other)) fail(`object name "${obj}" already appears in ${f}`);
  for (const n of names) { const c = (other.match(word(n)) || []).length; if (c) fail(`"${n}" also appears in ${f} (${c}x): it is shared, not private to this module`); }
}
let objClash = false;
(function find(n) { if (ts.isIdentifier(n) && n.text === obj) objClash = true; ts.forEachChild(n, find); })(sf);
if (objClash) fail(`"${obj}" is already used inside ${basename(file)}`);

// 5. edits
const edits = [], counts = new Map([...names].map((n) => [n, 0])), samples = new Map();
(function walk(n) {
  if (ts.isIdentifier(n) && !declNames.has(n)) {
    let sym = checker.getSymbolAtLocation(n);
    const shorthand = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n;
    if (shorthand) sym = checker.getShorthandAssignmentValueSymbol(n.parent);
    const name = sym && symToName.get(sym);
    if (name) {
      const start = n.getStart(sf);
      edits.push({ start, end: n.end, text: shorthand ? `${name}: ${obj}.${name}` : `${obj}.${name}` });
      counts.set(name, counts.get(name) + 1);
      const list = samples.get(name) || []; if (list.length < 2) list.push(src.slice(Math.max(0, start - 30), n.end + 30).replace(/\s+/g, ' ')); samples.set(name, list);
    }
  }
  ts.forEachChild(n, walk);
})(sf);
for (const s of statements) for (const t of s.targets) if (t.initRange && edits.some((e) => e.start >= t.initRange[0] && e.end <= t.initRange[1])) fail(`the initializer of "${t.name}" uses another moved name`);

const objText = `const ${obj}={${statements.flatMap((s) => s.targets).map((t) => `${t.name}:${t.init}`).join(',')}};`;
statements.forEach((s, i) => {
  const keep = s.others.length ? `${s.kw} ${s.others.join(',')};` : '';
  edits.push({ start: s.st.getStart(sf), end: s.st.end, text: i === 0 ? `${keep}${keep ? ' ' : ''}${objText}` : keep });
});
edits.sort((a, b) => b.start - a.start);
for (const e of edits) for (const h of holes) if (e.start < h[1] && e.end > h[0]) fail('an edit would touch a ${...} interpolation; handle by hand');
for (let i = 1; i < edits.length; i++) if (edits[i].end > edits[i - 1].start) fail('overlapping edits (nested use of a moved name); handle by hand');
let out = orig;
for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

// 6. the result must still parse
const check = ts.createSourceFile('/out.js', neutralize(out), ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
const bad = check.parseDiagnostics;
if (bad.length) fail('the rewritten text does not parse: ' + ts.flattenDiagnosticMessageText(bad[0].messageText, '\n'));

console.log(`${basename(file)}: ${[...names].length} names -> ${obj}.* ; ${edits.length - statements.length} references rewritten, ${statements.length} declaration statement(s) replaced`);
for (const [n, c] of counts) console.log(`  ${n.padEnd(14)} ${String(c).padStart(3)} refs   e.g. ${(samples.get(n) || [''])[0]}`);
console.log(`  declaration -> ${objText.slice(0, 160)}${objText.length > 160 ? '...' : ''}`);
if (write) { writeFileSync(file, text.slice(0, base) + out + text.slice(close)); console.log('written.'); } else console.log('dry run: add --write to apply.');
