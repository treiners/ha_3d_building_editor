/**
 * Contract check before saving: *Save graph* builds the file exactly as it will be written (`savedGraph`), runs `checkContract` and, when there is anything
 * to report, shows the problems in a panel with "Save anyway" / "Cancel". A clean file is saved straight away.
 * `contractJs` must not contain backticks, dollar-brace or backslashes.
 */
export const contractCss = '#contract{position:absolute;left:50%;top:48px;transform:translateX(-50%);width:min(560px,90%);max-height:60%;overflow:auto;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:10px 14px;z-index:5;font-size:13px}#contract[hidden]{display:none}#contract .ch{display:flex;justify-content:space-between;align-items:center}#contract .ce{color:#b91c1c;font-weight:600;margin-top:6px}#contract .cw{color:#b45309;font-weight:600;margin-top:6px}#contract ul{margin:4px 0 4px 18px;padding:0}#contract .cb{display:flex;gap:6px;margin-top:8px}#contract button{margin:0;padding:4px 10px}';

export const contractJs = `
(function(){
const cv=document.querySelector('.canvas');cv.style.position='relative';
const box=document.createElement('div');box.id='contract';box.hidden=true;cv.appendChild(box);
const E=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
let pending=null;
function download(o){const a=document.createElement('a'),b=new Blob([JSON.stringify(o,null,2)],{type:'application/json'});a.href=URL.createObjectURL(b);a.download='room-graph.json';a.click()}
function list(items){return '<ul>'+items.slice(0,30).map(x=>'<li>'+E(x.message)+'</li>').join('')+(items.length>30?'<li>... and '+(items.length-30)+' more</li>':'')+'</ul>'}
function show(r){let h='<div class="ch"><b>Check before saving</b><button data-c="x" title="Close">&#10005;</button></div>';
 if(r.errors.length)h+='<div class="ce">Errors ('+r.errors.length+'): the building-card may not work with this file</div>'+list(r.errors);
 if(r.warnings.length)h+='<div class="cw">Warnings ('+r.warnings.length+')</div>'+list(r.warnings);
 h+='<div class="cb"><button data-c="save">Save anyway</button><button data-c="x">Cancel</button></div>';box.innerHTML=h;box.hidden=false}
box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.c==='save'&&pending){download(pending.out);$('status').textContent='Saved with '+pending.r.errors.length+' error(s) and '+pending.r.warnings.length+' warning(s).'}box.hidden=true;pending=null});
$('save').onclick=()=>{const out=savedGraph(g),r=checkContract(out);if(!r.errors.length&&!r.warnings.length){download(out);$('status').textContent='Saved. Contract check passed (no errors, no warnings).';return}pending={out:out,r:r};show(r)};
})();
`;
