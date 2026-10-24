// The file-format document (docs/FILE-FORMAT.md) must match the code, in both directions:
//   - the committed document equals what src/file-format-doc.ts generates (defaults, entity types, area kinds, written version),
//   - every field that a saved reference home really contains is mentioned in the document (so a new field cannot go undocumented).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fileFormatMarkdown } from '../src/file-format-doc.js';
import { savedGraph } from '../src/save.js';

const here = dirname(fileURLToPath(import.meta.url));
const docPath = join(here, '../../docs/FILE-FORMAT.md');

test('docs/FILE-FORMAT.md equals the generated document', () => {
  assert.ok(existsSync(docPath), 'docs/FILE-FORMAT.md missing: run `npm run build && npm run docs:format`');
  assert.ok(readFileSync(docPath, 'utf8') === fileFormatMarkdown(), 'docs/FILE-FORMAT.md is out of date: run `npm run build && npm run docs:format` and commit it');
});

test('every field of a saved reference home is documented', () => {
  const saved = savedGraph(JSON.parse(readFileSync(join(here, '../../../shared/reference-home-connectors.json'), 'utf8')));
  const doc = fileFormatMarkdown();
  const undocumented = new Set<string>();
  const check = (where: string, obj: Record<string, unknown>) => { for (const k of Object.keys(obj)) if (!doc.includes('`' + k + '`') && !doc.includes(k + '?') && !doc.includes(k + ',')) undocumented.add(`${where}.${k}`); };
  check('graph', saved);
  for (const room of saved.rooms ?? []) { check('room', room); if (room.layout) check('layout', room.layout); for (const c of room.connectors ?? []) check('connector', c); }
  for (const r of saved.relationships ?? []) check('relationship', r);
  for (const x of saved.stairs ?? []) check('stair', x);
  for (const x of saved.areas ?? []) check('area', x);
  for (const x of saved.entityPlacements ?? []) check('entity', x);
  assert.deepEqual([...undocumented].sort(), [], 'fields in a saved file that docs/FILE-FORMAT.md does not mention (add them to src/file-format-doc.ts)');
});
