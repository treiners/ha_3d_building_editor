// Writes docs/FILE-FORMAT.md from src/file-format-doc.ts. Run after `npm run build`:  npm run docs:format
import { writeFileSync } from 'node:fs';
import { fileFormatMarkdown } from '../dist/src/file-format-doc.js';

writeFileSync(new URL('../docs/FILE-FORMAT.md', import.meta.url), fileFormatMarkdown());
console.log('docs/FILE-FORMAT.md written');
