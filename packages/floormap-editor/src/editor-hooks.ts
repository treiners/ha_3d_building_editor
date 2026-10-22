/**
 * Hooks of the generated editor (refactoring step 2).
 *
 * Features used to wrap core functions themselves (`const r0=render; render=function(){r0(); ...}`), so the
 * behaviour depended on the order of the module lines in editor.ts and on closures nobody could see.
 * Now a feature registers a step instead:
 *   onBeforeRender(fn)   before the core render (e.g. keep derived data in sync),
 *   onRender(fn)         after the core render (draw layers, panels),
 *   onBeforeRestore(fn)  before undo / redo restores a snapshot; fn(snapshotOrNull, label), also called when
 *                        there is nothing to restore (snapshot null),
 *   onBeforeAppMode(fn)  before the app mode changes (floor plan / entities / site); fn(newMode),
 *   onAfterLoad(fn)      after the Load button handler has finished (also after a load error, like the
 *                        wrapper it replaces; fn must tolerate the unchanged graph).
 * Steps run in registration order, which is the order of the module lines in editor.ts, i.e. exactly the
 * order the nested wrappers had. Results of steps are ignored.
 *
 * Must be placed in editor.ts BEFORE the first module that registers a step (`openingJs`) and AFTER the core
 * code that defines `render`, `restore` and the Load handler. `entSetApp` is a function declaration of the
 * entity module (hoisted), so it can be wrapped here.
 * Save has no hook: the contract module owns the Save button (the core `dl` function it replaced was removed).
 */
export const hooksJs = `
const renderBefore=[],renderAfter=[],restoreBefore=[],appModeBefore=[],loadAfter=[];
function onBeforeRender(fn){renderBefore.push(fn)}
function onRender(fn){renderAfter.push(fn)}
function onBeforeRestore(fn){restoreBefore.push(fn)}
function onBeforeAppMode(fn){appModeBefore.push(fn)}
function onAfterLoad(fn){loadAfter.push(fn)}
{const r0=render;render=function(){for(const h of renderBefore)h();r0.apply(this,arguments);for(const h of renderAfter)h()}}
{const s0=restore;restore=function(s,l){for(const h of restoreBefore)h(s,l);s0(s,l)}}
{const a0=entSetApp;entSetApp=function(m){for(const h of appModeBefore)h(m);a0(m)}}
{const l0=$('file').onchange;$('file').onchange=async function(e){await l0.call(this,e);for(const h of loadAfter)h()}}
`;
