// Test helper: finds identifiers that a block of plain JavaScript uses but never declares
// (and that are not standard ES2022 globals). Used by test/embed.test.ts to prove that the
// functions embedded into the editor HTML are self-contained, i.e. that no sibling is missing.
// Implementation: the TypeScript checker in checkJs mode, with no DOM and no Node typings, so
// `document`, `window`, `require`, ... are reported as unknown names.
import ts from 'typescript';

/** Diagnostic codes TypeScript uses for "Cannot find name 'x'" (2304, 2552) and its lib-hint variants (2580-2585). */
const NOT_FOUND_CODES = [2304, 2552, 2580, 2581, 2582, 2583, 2584, 2585];

export function freeIdentifiers(source: string, libs: string[] = ['lib.es2022.d.ts']): string[] {
  const fileName = '/embedded.js';
  const options: ts.CompilerOptions = {
    allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true,
    target: ts.ScriptTarget.ES2022, lib: libs, types: [],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.getSourceFile = (f, languageVersion, ...rest) =>
    f === fileName ? ts.createSourceFile(f, source, languageVersion) : getSourceFile(f, languageVersion, ...rest);
  host.readFile = (f) => (f === fileName ? source : readFile(f));
  host.fileExists = (f) => f === fileName || fileExists(f);
  const program = ts.createProgram([fileName], options, host);
  const names = new Set<string>();
  for (const d of program.getSemanticDiagnostics(program.getSourceFile(fileName))) {
    if (!NOT_FOUND_CODES.includes(d.code)) continue;
    const m = /Cannot find name '([^']+)'/.exec(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    if (m) names.add(m[1]);
  }
  return [...names].sort();
}
