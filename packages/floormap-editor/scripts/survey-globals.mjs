// Read-only survey of the page script's top-level names (refactoring step 4, docs/REFACTORING-LOG.md).
// Usage (after `npm run build`):  node scripts/survey-globals.mjs
// Parses the largest <script> of the generated reference-home page with the TypeScript parser and prints, for every
// top-level `let` / `var`: how often it is referenced and how often it is written. Reassigned `let` variables are the
// candidates for the state object (S.*); `const`s and functions are summarised. The count is syntactic: it ignores
// property names but not shadowing, so treat small numbers as approximate. Changes nothing.
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { editorHtml } from '../dist/src/editor.js';

const fixture = new URL('../../shared/reference-home-connectors.json', import.meta.url);
const html = editorHtml(JSON.parse(readFileSync(fixture, 'utf8')));
const blocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).sort((a, b) => b.length - a.length);
const sf = ts.createSourceFile('page.js', blocks[0], ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);

/** name -> { kind: 'let' | 'var' | 'const' | 'function', refs, writes } for every top-level declaration. */
const globals = new Map();
for (const st of sf.statements) {
  if (ts.isVariableStatement(st)) {
    const kind = st.declarationList.flags & ts.NodeFlags.Const ? 'const' : st.declarationList.flags & ts.NodeFlags.Let ? 'let' : 'var';
    for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) globals.set(d.name.text, { kind, refs: 0, writes: 0 });
  } else if (ts.isFunctionDeclaration(st) && st.name) globals.set(st.name.text, { kind: 'function', refs: 0, writes: 0 });
}

const ASSIGN = new Set([ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken]);
(function walk(n) {
  if (ts.isIdentifier(n) && globals.has(n.text)) {
    const p = n.parent;
    const isProp = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n);
    if (!isProp) {
      const info = globals.get(n.text);
      info.refs++;
      if ((ts.isBinaryExpression(p) && p.left === n && ASSIGN.has(p.operatorToken.kind)) || ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken))) info.writes++;
    }
  }
  ts.forEachChild(n, walk);
})(sf);

const rows = [...globals.entries()].map(([name, i]) => ({ name, ...i }));
const by = (k) => rows.filter((r) => r.kind === k);
console.log(`script ${blocks[0].length} chars; top-level: ${by('let').length} let, ${by('var').length} var, ${by('const').length} const, ${by('function').length} function`);
console.log('\nlet / var (name refs writes), most referenced first:');
for (const r of [...by('let'), ...by('var')].sort((a, b) => b.refs - a.refs)) console.log(`  ${r.name.padEnd(18)} ${String(r.refs).padStart(4)} ${String(r.writes).padStart(3)}`);
console.log('\nmost referenced const / function (top 25):');
console.log('  ' + [...by('const'), ...by('function')].sort((a, b) => b.refs - a.refs).slice(0, 25).map((r) => `${r.name}:${r.refs}`).join(' '));
