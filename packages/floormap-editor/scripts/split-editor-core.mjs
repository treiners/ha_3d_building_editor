// Splits the core script of src/editor.ts into one file per function group (refactoring step 5, docs/REFACTORING-LOG.md).
//
//   node scripts/split-editor-core.mjs            dry run: prints the plan, checks the anchors, writes nothing
//   node scripts/split-editor-core.mjs --write    creates src/editor-core-*.ts and rewrites the template in src/editor.ts
//
// Pure move: every chunk is a run of whole template lines copied RAW (escapes untouched) into its own file, and the
// template in editor.ts keeps the same lines in the same order as `${xJs}` references, so the generated page must stay
// BYTE-IDENTICAL: `npm test` (golden test unchanged) is the gate. The script aborts (nothing written) when an anchor line is
// missing, appears twice or is out of order, or when the reconstructed template differs from the original.
import ts from 'typescript';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const write = process.argv.includes('--write');
const EDITOR = 'src/editor.ts';
const lines = readFileSync(EDITOR, 'utf8').split('\n');
const fail = (m) => { console.error('ABORT: ' + m); process.exit(1); };

/** Chunks in page order. `start` = prefix of the first line; the chunk runs up to the next chunk's start (or `endBefore`). */
const CHUNKS = [
  { id: 'base', start: 'let g=${data};', endBefore: '${embeddedSource()}', param: 'data', title: 'State and coordinate basics',
    doc: 'The graph `g`, DOM handles, selection, view, grid snapping, room / connector lookup, wall geometry helpers, world <-> display coordinates and `fit`. First in the script; every other chunk depends on it. `data` is the graph as JSON.' },
  { id: 'history', start: 'function applyMap(', title: 'Mapper result, undo / redo, shortcuts',
    doc: 'Applying a mapper result, the snapshot history (`rec` after a finished gesture, `restore`), `chrome()` (button / status state) and the Ctrl+Z / Ctrl+Y shortcuts. `restore` and `render` are wrapped by editor-hooks.ts.' },
  { id: 'moves', start: 'let moveMode=', title: 'Move modes and locks',
    doc: 'Move modes Free / Slide / Slide + pull (`applyPlan`), the joint overlay, detaching on purpose, position / size lock helpers.' },
  { id: 'walls', start: 'let tool=', title: 'Tools and wall dragging',
    doc: 'Tool state, overlap blocking and its messages, the wall grab strips and applying wall / corner plans.' },
  { id: 'connectors', start: 'function portTarget(', title: 'Connectors, doors, windows, building values',
    doc: 'Connector targets, door / window specs, building values, the connector card, swing and width layers, partner lookup.' },
  { id: 'layers', start: 'function ghostLayer(', title: 'Ghost preview, connector table, selection ring',
    doc: 'The ghost shown while dragging, the trash icon, the connector table and the ring around the selected connector.' },
  { id: 'aligns', start: 'function alignOff(', title: 'Wall alignments',
    doc: 'Wall alignment groups (offsets, rows, realign) and applying the result of a wall drag.' },
  { id: 'edges', start: 'function edgeLines(', title: 'Room edges, render and side panel',
    doc: 'Drawing the edges and handles of the selected room, then the core `render` (all layers) and `panel` (side panel). `render` is wrapped by editor-hooks.ts.' },
  { id: 'pointer', start: "svg.addEventListener('pointerdown'", title: 'Canvas pointer, wheel and edit helpers',
    doc: 'Canvas `pointerdown` (start of every gesture; its move / up handlers are set up inside), the wheel (zoom, pan) and the shared `editApply` / `holdPairs` helpers.' },
  { id: 'actions', start: "$('add-room').onclick", title: 'Room actions',
    doc: 'Add room, connect rooms, delete room (side panel buttons).' },
  { id: 'click', start: "document.addEventListener('click'", endBefore: '${openingJs}', imports: [['hooksJs', './editor-hooks.js']], title: 'Document click handler and UI toggles',
    doc: 'The document-wide click handler (panels, tables, buttons) and the UI toggles `setUi` / `uiSync`. Ends with `${hooksJs}`: the hook registry must directly follow the core code it wraps.' },
];


/** Top-level function and variable names of a chunk (parsed; ${...} interpolations are neutralised first). */
function topLevel(js) {
  let t = js;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '$' && t[i + 1] === '{') { let d = 0, j = i + 1; for (; j < t.length; j++) { if (t[j] === '{') d++; else if (t[j] === '}' && --d === 0) break; } t = t.slice(0, i) + '1'.repeat(j + 1 - i) + t.slice(j + 1); i = j; }
  }
  const sf = ts.createSourceFile('chunk.js', t, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const functions = [], vars = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) functions.push(st.name.text);
    else if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) vars.push(d.name.text);
  }
  return { functions, vars };
}

// 1. locate the anchors
const first = lines.findIndex((l) => l.startsWith(CHUNKS[0].start));
if (first < 0) fail(`anchor not found: ${CHUNKS[0].start}`);
let cursor = first;
for (const c of CHUNKS) {
  const hits = lines.map((l, i) => (l.startsWith(c.start) ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) fail(`anchor "${c.start}" must match exactly one line (found ${hits.length})`);
  if (hits[0] < cursor) fail(`anchor "${c.start}" is out of order`);
  c.from = hits[0]; cursor = hits[0];
}
CHUNKS.forEach((c, i) => {
  const next = CHUNKS[i + 1];
  const end = c.endBefore ? lines.findIndex((l, j) => j > c.from && l.startsWith(c.endBefore)) : next.from;
  if (end < 0) fail(`endBefore "${c.endBefore}" not found`);
  c.to = end; c.text = lines.slice(c.from, c.to);
  if (c.endBefore && next && next.from < c.to) fail(`chunk "${c.id}" would overlap the next one`);
  const top = topLevel(c.text.join('\n'));
  c.names = top.functions; c.consts = top.vars;
});
// a chunk with endBefore must be followed directly by that line (so nothing is lost between chunks)
for (let i = 0; i < CHUNKS.length - 1; i++) if (!CHUNKS[i].endBefore && CHUNKS[i].to !== CHUNKS[i + 1].from) fail('gap between chunks');
if (CHUNKS[0].to !== CHUNKS[1].from - 1) fail('expected exactly one line (the embedded functions) between the first two chunks');

// 2. build the new files and the new editor.ts lines
const fileOf = (c) => `src/editor-core-${c.id}.ts`;
const constOf = (c) => `core${c.id[0].toUpperCase()}${c.id.slice(1)}Js`;
const newFile = (c) => {
  const head = `/**\n * ${c.title} (part of the page script, see editor.ts for the order of the parts).\n * ${c.doc}\n` +
    `${c.names.length ? ` * Functions: ${c.names.join(', ')}.\n` : ''}${c.consts.length ? ` * Top-level lets / consts: ${c.consts.join(', ')}.\n` : ''}` +
    ` * Plain JavaScript in a template string, copied unchanged from editor.ts: edit with exact-substring replacements and run \`npm test\` (golden test) afterwards.\n */\n`;
  const imp = (c.imports || []).map(([n, f]) => `import{${n}}from'${f}';\n`).join('');
  const body = c.text.join('\n');
  return c.param ? `${imp}${head}export const ${constOf(c)}=(${c.param}:string)=>\`${body}\`;\n` : `${imp}${head}export const ${constOf(c)}=\`${body}\`;\n`;
};
const call = (c) => (c.param ? `\${${constOf(c)}(${c.param})}` : `\${${constOf(c)}}`);

const out = [];
let i = 0;
const byFrom = new Map(CHUNKS.map((c) => [c.from, c]));
while (i < lines.length) {
  const c = byFrom.get(i);
  if (c) { out.push(call(c)); i = c.to; } else { out.push(lines[i]); i++; }
}
// import lines go after the last existing import
const lastImport = out.reduce((a, l, j) => (l.startsWith('import') ? j : a), -1);
out.splice(lastImport + 1, 0, ...CHUNKS.map((c) => `import{${constOf(c)}}from'./editor-core-${c.id}.js';`));

// 3. reconstruct the old template region from the new structure and compare
const expand = (l) => { const c = CHUNKS.find((k) => call(k) === l); return c ? c.text.join('\n') : l; };
const region = (arr, a, b) => arr.slice(a, b).map(expand).join('\n');
const newFirst = out.findIndex((l) => l === call(CHUNKS[0]));
const oldEnd = CHUNKS[CHUNKS.length - 1].to;
const newEnd = out.findIndex((l, j) => j > newFirst && l.startsWith(CHUNKS[CHUNKS.length - 1].endBefore));
if (region(lines, first, oldEnd) !== region(out, newFirst, newEnd)) fail('reconstruction differs from the original template (script bug)');

// 4. report
console.log(`editor.ts: ${lines.length} lines -> ${out.length}; core script lines ${first + 1}-${oldEnd} split into ${CHUNKS.length} files:`);
for (const c of CHUNKS) console.log(`  ${fileOf(c).padEnd(34)} lines ${String(c.from + 1).padStart(3)}-${String(c.to).padEnd(3)} ${String(c.text.join('\n').length).padStart(6)} chars  ${c.names.slice(0, 5).join(', ')}${c.names.length > 5 ? ', ...' : ''}`);
if (!write) { console.log('dry run: add --write to apply, then run `npm test` (golden test must pass UNCHANGED).'); process.exit(0); }
for (const c of CHUNKS) if (existsSync(fileOf(c))) fail(`${fileOf(c)} already exists`);
for (const c of CHUNKS) writeFileSync(fileOf(c), newFile(c));
writeFileSync(EDITOR, out.join('\n'));
console.log('written. Now: npm test  (golden test must pass without golden:update), then npm run smoke.');
