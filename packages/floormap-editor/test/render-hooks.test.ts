// Structure test for the render hooks (refactoring step 2, docs/REFACTORING-LOG.md, src/editor-hooks.ts).
// Draw order on the canvas is the order of the render steps, so it is pinned here: steps run around the core
// render in registration order, and the registry must exist before the first step is registered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { editorHtml } from '../src/editor.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = editorHtml(JSON.parse(readFileSync(join(here, '../../../shared/reference-home-connectors.json'), 'utf8')));
const at = (needle: string): number => {
  const i = html.indexOf(needle);
  assert.ok(i >= 0, `missing in generated HTML: ${needle}`);
  assert.equal(html.indexOf(needle, i + 1), -1, `must occur once: ${needle}`);
  return i;
};

test('render hook registry is defined once, before the first step is registered', () => {
  assert.ok(at('const renderBefore=[],renderAfter=[]') < at('onRender(function(){if(addOp&&addGhost'));
});

test('render steps are registered in the historical draw order: openings, entities, site, north, floors, stairs, room box, underlay', () => {
  const order = [
    'onRender(function(){if(addOp&&addGhost',
    "onRender(()=>{if(appMode!=='entities')return;",
    "onRender(()=>{let n=svg.querySelector('[data-room]')",
    'onRender(northDraw)',
    'onRender(()=>{ghostDraw();floorBar()})',
    'onRender(()=>{draw();panel()})',
    "function sync(){p.hidden=!(room(",
    "const cb=$('panel-conn')",
    'onRender(()=>{udraw();ubar()})',
  ].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('the entity size sync runs before the core render', () => {
  at('onBeforeRender(()=>{const sy=syncEntitySizes(g,entUi.entSizes)');
});

test('no feature wraps render() by hand any more: only the registry replaces it', () => {
  assert.equal(html.split('render=function(){').length - 1, 1);
});

test('Fit is defined once (floors module) and covers site areas', () => {
  assert.equal(html.split('fit=function(){').length - 1, 1);
  assert.ok(html.includes("filter(r=>r.layout&&r.name.toLowerCase()!=='outside').map(r=>r.layout).concat((g.areas||[])"));
});

test('Load: only the registry wraps the file handler; floors splitting is an onAfterLoad step; core dl() is gone', () => {
  assert.equal(html.split("$('file').onchange=async function(").length - 1, 1);
  assert.ok(at('onAfterLoad(()=>{if(Array.isArray(g.floors)') > at('function onAfterLoad('));
  assert.equal(html.includes('function dl('), false);
});

test('restore and app mode are wrapped only by the registry; entities and site register steps', () => {
  assert.equal(html.split('restore=function(').length - 1, 1);
  assert.equal(html.split('entSetApp=function(').length - 1, 1);
  assert.ok(at('onBeforeRestore(()=>{entUi.entSizes=null})') > at('function onBeforeRestore('));
  assert.ok(at("onBeforeAppMode(m=>{siteUi.siteKind=null;") > at('function onBeforeAppMode('));
});
