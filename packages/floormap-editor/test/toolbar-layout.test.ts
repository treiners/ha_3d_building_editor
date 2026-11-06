import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { editorHtml } from '../src/editor.js';

const html = editorHtml({ rooms: [], relationships: [], wallAlignments: [] });
const count = (s: string) => html.split(s).length - 1;
const tb = html.slice(html.indexOf('<div class="toolbar">'), html.indexOf('<div class="canvas">'));

describe('toolbar layout option', () => {
  it('has each new element exactly once', () => {
    for (const s of ['id="zoomgrp"', 'id="tb-layout"', 'class="tbbreak"', 'id="tb-extra"']) assert.equal(count(s), 1, s);
    assert.equal(count("document.getElementById('tb-extra').appendChild(btn)"), 2, 'Issues and Export use the fixed slot');
  });
  it('keeps all zoom, file and history ids inside the toolbar markup', () => {
    for (const id of ['undo', 'redo', 'zoom-out', 'zoom-reset', 'zoom-in', 'fit-all', 'grid-step', 'load', 'save']) assert.ok(tb.includes('id="' + id + '"'), id);
  });
  it('CSS for the grouped layout is scoped to body.tbg and the break is hidden by default', () => {
    assert.ok(html.includes('.tbbreak{display:none}'));
    assert.ok(!/(^|[};])\.toolbar>\*\{order/.test(html), 'order rules must start with body.tbg');
  });
  it('script moves the zoom group to the status bar and back', () => {
    assert.ok(html.includes("document.querySelector('.statusbar').appendChild(zg)"));
    assert.ok(html.includes('zhome.insertBefore(zg,zref)'));
  });
});
