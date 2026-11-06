// Optional smoke test for the export (needs jsdom, run after `npm run build`, from the package folder). Canvas / PNG / PDF need a real browser; here the SVG builder and the menu are checked.
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { editorHtml } from '../dist/src/editor.js';

const room = (id, x) => ({ id, name: id, type: 'other', sizeCategory: 'medium', connectors: [], layout: { x, y: 0, width: 4, height: 3 } });
const graph = { schemaVersion: '2.14', rooms: [room('a', 0), room('b', 4), { ...room('o', -20), name: 'Outside' }], relationships: [] };
const d = new JSDOM(editorHtml(graph), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
await new Promise(r => setTimeout(r, 50));
const w = d.window, doc = w.document, $ = id => doc.getElementById(id);

// 1. the Export button opens a menu with SVG, PNG and PDF
assert.ok($('export-btn')); assert.equal($('export-menu').hidden, true);
$('export-btn').click(); assert.equal($('export-menu').hidden, false);
assert.deepEqual([...doc.querySelectorAll('[data-exp]')].map(b => b.dataset.exp), ['svg', 'png', 'pdf']);

// 2. the SVG covers the two rooms (0..8 x 0..3 plus a 1.2 m margin and 1 m for the scale bar), not the Outside room, keeps the room selection untouched and has no editing chrome
w.eval("sel.add('a');render()");
const s = w.eval('exportSvgString()');
assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(s, /viewBox="-1\.2 -1\.2 10\.4 6\.4"/);
assert.match(s, /width="2400" height="1477"/);
assert.match(s, /<rect x="-1\.2" y="-1\.2" width="10\.4" height="6\.4" fill="#fff"\/>/);
assert.match(s, /2 m<\/text>/);
assert.match(s, />N<\/text><\/g><\/svg>$/, 'the north arrow is the last element');
assert.equal(s.includes('data-port'), false); assert.equal(s.includes('data-wall'), false); assert.equal(s.includes('class="handle'), false);
assert.equal(w.eval('sel.has("a")'), true, 'the selection is restored after the export');

// 3. an empty plan exports nothing
w.eval('g.rooms=[];g.areas=[]');
assert.equal(w.eval('exportSvgString()'), null);
console.log('export smoke OK');
process.exit(0);
