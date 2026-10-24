// Structure tests for the connector, entity and site boxes (src/editor-boxes.ts). Layout itself needs eyes (jsdom has no layout);
// these tests pin what can break silently: ids, the order after the room box, and CSS that stays scoped to the three boxes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { editorHtml } from '../src/editor.js';
import { boxesJs } from '../src/editor-boxes.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = editorHtml(JSON.parse(readFileSync(join(here, '../../../shared/reference-home-connectors.json'), 'utf8')));

test('the three elements the boxes move exist exactly once', () => {
  for (const id of ['panel-conn', 'ent-inspector', 'site-inspector', 'obj-inspector']) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
});

test('the boxes module runs after the room box (it measures it) and before the contract module', () => {
  const room = html.indexOf("p.classList.add('floatbox')"), boxes = html.indexOf("const cb=$('panel-conn')"), contract = html.indexOf('checkContract', boxes);
  assert.ok(room > 0 && boxes > room && contract > boxes);
});

/** Runs the module against stub objects and returns the CSS it injects and the elements it moved. */
function runBoxes(): { css: string; moved: number } {
  let css = '', moved = 0;
  const stub = () => ({ classList: { add() {} }, style: {} as Record<string, string>, hidden: false, offsetTop: 0, offsetHeight: 0 });
  const doc = {
    querySelector: () => ({ style: {}, appendChild() { moved++; } }),
    createElement: () => ({ textContent: '' }),
    head: { appendChild: (s: { textContent: string }) => { css = s.textContent; } },
  };
  new Function('document', '$', 'onRender', 'selPort', 'port', 'appMode', 'selS', 'entSel', 'siteUi', 'siteGet', boxesJs)(
    doc, () => stub(), () => {}, null, () => null, 'plan', null, () => [], {}, () => null);
  return { css, moved };
}

test('every CSS selector of the boxes is scoped to a box id (#panel-conn, #ent-inspector, #site-inspector, #obj-inspector, #panel, #stairbox)', () => {
  const { css, moved } = runBoxes();
  assert.equal(moved, 4, 'four elements are moved onto the canvas');
  const selectors = css.split('}').map((r) => r.split('{')[0]!.trim()).filter(Boolean).flatMap((s) => s.split(',')).map((s) => s.trim());
  assert.ok(selectors.length > 30);
  const bare = selectors.filter((s) => !/^#(panel-conn|ent-inspector|site-inspector|obj-inspector|panel|stairbox)(\.|\s|\[|$)/.test(s));
  assert.deepEqual(bare, [], 'unscoped selector in the boxes CSS (a bare element selector once broke the icon sprite)');
});

test('all five boxes share one width (room, stair, connector, entity, site)', () => {
  const { css } = runBoxes();
  assert.ok(css.includes('#panel-conn.floatbox,#ent-inspector.floatbox,#site-inspector.floatbox,#obj-inspector.floatbox{position:absolute;right:10px;top:84px;width:250px'));
  assert.ok(css.includes('#stairbox{width:250px'));
  assert.ok(html.includes('#panel.floatbox{position:absolute;right:10px;top:84px;width:250px'));
});

test('checkbox lists in the entity and site box run in one column', () => {
  const { css } = runBoxes();
  assert.ok(css.includes('#ent-inspector.floatbox .emulti{flex-direction:column'));
  assert.ok(css.includes('#site-inspector.floatbox .emulti{flex-direction:column'));
});

test('the boxes module is plain page script: no backticks, dollar-brace or backslashes', () => {
  assert.equal(/[`\\]|\$\{/.test(boxesJs), false);
});
