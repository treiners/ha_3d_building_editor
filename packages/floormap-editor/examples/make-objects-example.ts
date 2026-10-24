// Writes the example house with objects: node dist/examples/make-objects-example.js ../shared/reference-home-connectors.json examples/house-with-objects.json examples/house-with-objects.html
import { readFileSync, writeFileSync } from 'node:fs';
import { editorHtml } from '../src/editor.js';
import { buildObjectsExample, objectsExampleIssues } from './objects-example.js';

const [input = '../shared/reference-home-connectors.json', json = 'examples/house-with-objects.json', html = 'examples/house-with-objects.html'] = process.argv.slice(2);
const saved = buildObjectsExample(JSON.parse(readFileSync(input, 'utf8')));
writeFileSync(json, JSON.stringify(saved, null, 2) + '\n');
writeFileSync(html, editorHtml(saved));
const n = (saved.objects || []).length, e = (saved.entityPlacements || []).length, issues = objectsExampleIssues(saved);
console.log('Wrote ' + json + ' and ' + html + ': ' + n + ' objects, ' + e + ' entities on objects' + (issues.length ? ', ISSUES: ' + issues.join('; ') : ', no issues') + '.');
