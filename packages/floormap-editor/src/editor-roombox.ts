/**
 * The room panel (name, lock position / size, width and height, delete) as a floating box on the canvas, like the stair panel, instead of a card in the
 * sidebar. The existing `panel()` still writes into `#panel`; this file only moves that element onto the canvas and shows it while a room is selected
 * in Floor plan mode (not while a stair is selected). Its CSS is injected from here and scoped to `#panel`.
 * `roomboxJs` must not contain backticks, dollar-brace or backslashes.
 */
export const roomboxJs = `
(function(){
const cv=document.querySelector('.canvas'),p=$('panel'),st=document.createElement('style');
st.textContent='#panel.floatbox{position:absolute;right:10px;top:84px;width:250px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:6px 10px 8px;z-index:4;font-size:13px}#panel.floatbox[hidden]{display:none}#panel.floatbox .nm{background:none;border:0;padding:0;margin:0}#panel.floatbox .card{background:none;border:0;padding:0;margin:4px 0 0}#panel.floatbox .nm+.card{margin-top:4px}#panel.floatbox h2{font-size:15px;margin:2px 0}#panel.floatbox .rw input{width:56px}';
document.head.appendChild(st);cv.style.position='relative';cv.appendChild(p);p.classList.add('floatbox');
function sync(){p.hidden=!(room([...sel][0])&&appMode==='plan'&&!selS)}
{const r0=render;render=function(){r0.apply(this,arguments);sync()}}
sync();
})();
`;
