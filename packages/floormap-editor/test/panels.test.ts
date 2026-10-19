import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { editorHtml } from '../src/editor.js';

const html = editorHtml({ rooms: [], relationships: [], wallAlignments: [] }), side = html.slice(html.indexOf('<aside class="side">'), html.indexOf('</aside>')), css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const at = (s: string) => side.indexOf(s);
const connSec = side.slice(at('<div class="sec sec-connectors">'), at('<div class="sec sec-building">'));

describe('sidebar panels and connector table', () => {
  it('connector width bars are switched on by default (the option lives in the settings view)', () => {
    assert.ok(side.includes('<input id="show-bars" type="checkbox" checked>'));
    assert.ok(at('<input id="show-bars"') > at('id="settings-view"') && at('<input id="show-bars"') < at('class="sec sec-layout"'));
  });
  it('every tab starts with a panel (no bare headings) and the other blocks are panels too', () => {
    for (const t of ['sec-layout', 'sec-connectors', 'sec-building']) assert.ok(side.includes('<div class="sec ' + t + '"><div class="card">'), t);
    for (const h of ['Rooms', 'Wall alignment', 'Connectors', 'Add connector', 'Building', 'Place', 'Entities', 'Add area', 'Layout', 'Entities', 'Interface']) assert.ok(side.includes('<div class="card"><h2>' + h) || side.includes('<div class="card"><div class="sechead"><h2>' + h), h);
  });
  it('the markup of the sidebar is balanced (every panel is closed)', () => {
    assert.equal((side.match(/<div[\s>]/g) || []).length, (side.match(/<\/div>/g) || []).length);
    assert.equal((side.match(/<details[\s>]/g) || []).length, (side.match(/<\/details>/g) || []).length);
  });
  it('panel css: light grey card with rounded corners, name header joins its card; the connector table shows 8 rows (28 px each + header = 252 px, max-height 262 px) and scrolls', () => {
    assert.ok(css.includes('.card{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;'));
    assert.ok(css.includes('.nm+.card{margin-top:0;border-top:0;border-radius:0 0 10px 10px}'));
    assert.ok(css.includes('.ctable td,.ctable th{height:28px;'));
    assert.ok(css.includes('.ctwrap{max-height:262px;overflow-y:auto;'));
    assert.ok(262 >= 28 * 9 + 9 && 262 < 28 * 10, 'room for exactly 8 rows plus the header');
  });
});

describe('Connectors tab order, room panel, structured inspector', () => {
  it('order: Add connector first, Connectors table second, the selected-connector inspector (#panel-conn) third; nothing else in the tab', () => {
    const a = connSec.indexOf('<h2>Add connector'), b = connSec.indexOf('<h2>Connectors<span'), c = connSec.indexOf('id="panel-conn"');
    assert.ok(a > 0 && b > a && c > b);
    assert.equal(connSec.includes('Connection settings'), false);
    assert.ok(connSec.indexOf('id="connect-rooms"') > a && connSec.indexOf('id="connect-rooms"') < b, 'Connect lives in the Add connector panel');
  });
  it('the explanation of Add connector is a hover tip, not a paragraph; the tip css shows it on hover and focus', () => {
    const add = connSec.slice(connSec.indexOf('<h2>Add connector'), connSec.indexOf('<h2>Connectors<span'));
    assert.ok(add.includes('<span class="tip" tabindex="0">i<span class="tipbox">Pick a type, then click on a wall'));
    assert.equal(add.includes('<div class="mini">Pick a type'), false);
    assert.ok(css.includes('.tipbox{display:none;') && css.includes('.tip:hover .tipbox,.tip:focus .tipbox{display:block}'));
  });
  it('the room panel is hidden in the Connectors and Building tabs (unless classic)', () => {
    assert.ok(css.includes('body[data-ui=building]:not(.classic) #panel,body[data-ui=connectors]:not(.classic) #panel{display:none}'));
    assert.equal(css.includes('details.card{display:none}'), false, 'entity detail panels must not be hidden by a tab rule');
  });
  it('the connector inspector is a table (Room, Connects to, Type, Width, Door type + door / window rows)', () => {
    assert.ok(css.includes('.ptable{width:100%;border-collapse:collapse;') && css.includes('.pin{display:flex;'));
    for (const label of ["row('Room'", "row('Connects to'", "row('Type'", "row('Width'", "row('Door type'", "row('Hinge'", "row('Swing'", "row('Opening angle'", "row('Sill height'", "row('Head height'"]) assert.ok(html.includes(label), label);
    assert.equal(html.includes("<b>Connector</b>"), false);
  });
});

describe('settings view (gear)', () => {
  it('a gear button sits at the top right of the sidebar head, the settings view comes right after it', () => {
    const head = side.slice(at('<div class="sidehead">'), at('<div class="modes">'));
    assert.ok(head.indexOf('<h1>Room mapping 3.0 beta</h1>') < head.indexOf('id="gear"') && head.indexOf('id="gear"') < head.indexOf('id="settings-view"'));
    assert.ok(css.includes('.sidehead{display:flex;align-items:center;justify-content:space-between'));
  });
  it('all setting options are collected in sections: Layout, Connectors, Entities, Interface (ids unchanged, each exactly once)', () => {
    const view = side.slice(at('id="settings-view"'), at('<div class="modes">'));
    const sections = [...view.matchAll(/<div class="card"><h2>([^<]+)<\/h2>/g)].map(m => m[1]);
    assert.deepEqual(sections, ['Layout', 'Connectors', 'Entities', 'Interface']);
    for (const id of ['no-overlap', 'glue-touch', 'show-bars', 'new-conn', 'new-width', 'new-door', 'ent-cov', 'ent-resize', 'classic']) { assert.equal((html.slice(0, html.indexOf('<script>')).match(new RegExp(' id="' + id + '"', 'g')) || []).length, 1, id); assert.ok(view.includes(' id="' + id + '"'), id + ' is in the settings view'); }
    assert.equal(side.includes('<summary>Settings'), false);
  });
  it('while the view is open everything else in the sidebar is hidden (body[data-settings="1"])', () => {
    assert.ok(css.includes('body[data-settings="1"] .side>*:not(.sidehead):not(.setview):not(svg){display:none}') && css.includes('body[data-settings="1"] .setview{display:block}'));
  });
});
