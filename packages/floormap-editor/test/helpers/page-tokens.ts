// Formatting-insensitive fingerprint of JavaScript (refactoring step 5b, docs/REFACTORING-LOG.md).
// pageTokens() lists the tokens of a script while ignoring everything a formatter may change without changing the
// program: whitespace and comments (not tokens at all), semicolons, parentheses, quote style (strings compare by
// value) and number spelling (.5 vs 0.5). Two scripts with the same token list are the same code, so a reformatting
// of the page script can be checked mechanically, while the byte-exact golden test still tells that the bytes changed.
import ts from 'typescript';

const IGNORED = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.SemicolonToken, ts.SyntaxKind.EndOfFileToken, ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.CloseParenToken,
]);

export function pageTokens(js: string): string[] {
  const sf = ts.createSourceFile('page.js', js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = n.getChildren(sf);
    if (children.length) { children.forEach(walk); return; }
    if (IGNORED.has(n.kind)) return;
    out.push(ts.isStringLiteral(n) ? 'S:' + n.text : ts.isNumericLiteral(n) ? 'N:' + Number(n.text) : n.getText(sf));
  };
  walk(sf);
  return out;
}
