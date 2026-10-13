import { readFileSync, writeFileSync } from 'node:fs';
import { editorHtml } from '../src/editor.js';
const i = process.argv[2] ?? 'examples/reference.json', o = process.argv[3] ?? 'examples/editor-v2.14.html';
writeFileSync(o, editorHtml(JSON.parse(readFileSync(i, 'utf8'))));
console.log(`Generated ${o}`);
