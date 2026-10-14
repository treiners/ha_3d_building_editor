import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { editorHtml } from '../src/editor.js';

const IDS = ['load', 'save', 'file', 'run-mapper', 'undo', 'redo', 'move-mode', 'tool', 'no-overlap', 'show-bars', 'glue-touch', 'align-connectors', 'close-gaps', 'fit-room', 'status', 'joints', 'panel',
  'new-name', 'new-size', 'new-side', 'new-conn', 'new-width', 'new-door', 'add-room', 'connect-rooms', 'add-toggle', 'add-panel', 'conn-table', 'align-side', 'add-alignment', 'alignments', 'mapping', 'gap', 'zoom-out', 'zoom-reset', 'zoom-in',
  'fit-all', 'grid-step', 'canvas', 'b-wt', 'b-wh', 'b-ft', 'classic', 'conn-summary'];

describe('mode + inspector layout', () => {
  const h = editorHtml({ rooms: [], relationships: [] });
  it('every control keeps its id exactly once (the editor script and the smoke tests rely on them)', () => {
    for (const id of IDS) assert.equal(h.split('id="' + id + '"').length - 1, 1, id);
  });
  it('three mode tabs, three mode sections, tool and move-mode as segmented buttons that drive the (classic) selects', () => {
    assert.equal(h.split('data-ui-tab="').length - 1, 3);
    for (const m of ['layout', 'connectors', 'building']) assert.ok(h.includes('class="sec sec-' + m + '"'));
    assert.equal(h.split('data-seg="tool"').length - 1, 2); assert.equal(h.split('data-seg="move-mode"').length - 1, 3);
  });
  it('the three map actions, zoom and the view switch live in the toolbar above the plan; the trash icon is created next to the room name', () => {
    const canvas = h.indexOf('id="canvas"');
    for (const id of ['run-mapper', 'close-gaps', 'fit-room', 'zoom-in', 'zoom-out', 'fit-all', 'mapping', 'gap', 'undo', 'redo']) assert.ok(h.indexOf('id="' + id + '"') < canvas, id);
    assert.ok(h.includes('id="delete-room"') && h.includes('class="nm"') && h.includes('id="i-trash"'));
  });
  it('the plan style is scoped to #canvas: a bare svg rule would also turn the icon sprite and icons into white boxes', () => {
    assert.ok(h.includes('#canvas{width:100%;height:100%;background:#fff'));
    assert.ok(!/[};>\s]svg\{/.test(h.slice(h.indexOf('<style>'), h.indexOf('</style>'))));
    assert.ok(h.includes('<svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden">'));
  });
  it('the inspector (#panel) and the settings drawer are outside the mode sections; status moved to a bar under the canvas', () => {
    const panel = h.indexOf('id="panel"'), firstSec = h.indexOf('class="sec sec-layout"');
    assert.ok(panel > 0 && panel < firstSec);
    assert.ok(h.indexOf('<details class="card"><summary>Settings') > h.indexOf('class="sec sec-building"'));
    assert.ok(h.indexOf('class="statusbar"') > h.indexOf('id="canvas"'));
  });
});
