/**
 * Export: an "Export" button in the toolbar opens a small menu (SVG / PNG / PDF). The plan is exported as it is shown (layer toggles, wall lengths and areas included) but without the editing
 * chrome (handles, wall strips, connector points, selection): the page's SVG is cloned, every visible element gets its computed paint styles written inline (so the file looks the same without
 * the page's css), the symbols of the icon sprite are copied into `defs`, and a white background and a scale bar are added. PNG is the SVG drawn on a canvas (2400 px wide), PDF is that image
 * (JPEG) on one A4 / A3-style page written by a tiny built-in PDF writer. Only the current floor is exported. Needs no library and no network.
 * `exportJs` must not contain backticks, dollar-brace or backslashes.
 */
export const exportJs = `
let exportW=2400,exportH=1600;
function exportSvgString(){
const rs=g.rooms.filter(r=>r.layout&&String(r.name).toLowerCase()!=='outside'),as=(g.areas||[]).filter(a=>a.layout);
if(!rs.length&&!as.length)return null;
let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
for(const o of rs.concat(as)){const L=o.layout;x0=Math.min(x0,L.x);y0=Math.min(y0,L.y);x1=Math.max(x1,L.x+L.width);y1=Math.max(y1,L.y+L.height)}
const pad=1.2,x=x0-pad,y=y0-pad,w=x1-x0+2*pad,h=y1-y0+2*pad+1;
const keep={sel:[...sel],port:selPort,a:typeof siteUi!=='undefined'?siteUi.selA:null,x:typeof siteUi!=='undefined'?siteUi.selX:null};
sel.clear();selPort=null;if(typeof siteUi!=='undefined'){siteUi.selA=null;siteUi.selX=null}
render();
const live=svg.querySelectorAll('*'),clone=svg.cloneNode(true),cl=clone.querySelectorAll('*');
const props=['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','font-size','font-family','font-weight','font-style','text-anchor','paint-order','visibility'];
const ui='.handle,.ahandle,.awalls,.awall,[data-wall],[data-resize],[data-swing],[data-shape],.wallhit,.port,.bar,.jointwall,.jointarrow,.ring,.ghost,.area-draw,[data-port],.ent-ring,.ent-h,.ent-hl,.ent-hint,.obj-h,.obj-rs';
const drop=[];
for(let i=0;i<live.length&&i<cl.length;i++){
const el=live[i],cs=getComputedStyle(el);
if(cs.display==='none'||el.matches(ui)){drop.push(cl[i]);continue}
for(const p of props){const v=cs.getPropertyValue(p);if(v)cl[i].style.setProperty(p,v)}
}
for(const d of drop)d.remove();
sel.clear();for(const id of keep.sel)sel.add(id);selPort=keep.port;if(typeof siteUi!=='undefined'){siteUi.selA=keep.a;siteUi.selX=keep.x}
render();
const syms=[...document.querySelectorAll('symbol')].map(s=>s.outerHTML).join('');
const bar=[1,2,5,10,20].filter(v=>v<=w/3).pop()||1,bx=x+pad,by=y+h-.5;
const scale='<g stroke="#334155" stroke-width=".06" fill="none"><path d="M'+bx+' '+(by-.15)+'V'+by+'H'+(bx+bar)+'V'+(by-.15)+'"/></g><text x="'+(bx+bar/2)+'" y="'+(by-.25)+'" text-anchor="middle" font-size=".3" fill="#334155" font-family="sans-serif">'+bar+' m</text>';
const px=2400,py=Math.round(px*h/w);
const na=(+g.northDegrees||0)*Math.PI/180,cx=x+w-.9,cy=y+.9,nx=Math.sin(na)*.36,ny=-Math.cos(na)*.36;
const north='<g><circle cx="'+cx+'" cy="'+cy+'" r=".5" fill="#fff" stroke="#94a3b8" stroke-width=".04"/><line x1="'+(cx-nx*.5)+'" y1="'+(cy-ny*.5)+'" x2="'+(cx+nx)+'" y2="'+(cy+ny)+'" stroke="#475569" stroke-width=".05"/><circle cx="'+(cx+nx)+'" cy="'+(cy+ny)+'" r=".13" fill="#dc2626"/><text x="'+(cx+nx)+'" y="'+(cy+ny+.05)+'" text-anchor="middle" font-size=".15" font-weight="bold" fill="#fff" font-family="sans-serif">N</text></g>';
exportW=px;exportH=py;
return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="'+x+' '+y+' '+w+' '+h+'" width="'+px+'" height="'+py+'"><defs>'+syms+'</defs><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#fff"/>'+clone.innerHTML+scale+north+'</svg>';
}
(function(){
const NL=String.fromCharCode(10);
function exportDownload(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function toCanvas(s,done){
const W=exportW,H=exportH;
const img=new Image();
img.onload=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.drawImage(img,0,0,W,H);done(c,W,H)};
img.onerror=()=>{$('status').textContent='Export failed: the browser could not draw the plan.'};
img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
}
function pdfBlob(jpg,w,h){
const land=w>=h,pw=land?842:595,ph=land?595:842,mg=28,k=Math.min((pw-2*mg)/w,(ph-2*mg)/h),iw=w*k,ih=h*k,ix=(pw-iw)/2,iy=(ph-ih)/2;
const enc=new TextEncoder(),parts=[],offs=[];let n=0;
const push=b=>{const u=typeof b==='string'?enc.encode(b):b;parts.push(u);n+=u.length};
const obj=(i,body)=>{offs[i]=n;push(i+' 0 obj'+NL+body+NL+'endobj'+NL)};
push('%PDF-1.4'+NL);
obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pw+' '+ph+'] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
const cs='q '+iw.toFixed(2)+' 0 0 '+ih.toFixed(2)+' '+ix.toFixed(2)+' '+iy.toFixed(2)+' cm /Im0 Do Q';
obj(4,'<< /Length '+cs.length+' >>'+NL+'stream'+NL+cs+NL+'endstream');
offs[5]=n;push('5 0 obj'+NL+'<< /Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>'+NL+'stream'+NL);push(jpg);push(NL+'endstream'+NL+'endobj'+NL);
const xo=n;push('xref'+NL+'0 6'+NL+'0000000000 65535 f '+NL);
for(let i=1;i<=5;i++)push(String(offs[i]).padStart(10,'0')+' 00000 n '+NL);
push('trailer'+NL+'<< /Size 6 /Root 1 0 R >>'+NL+'startxref'+NL+xo+NL+'%%EOF');
return new Blob(parts,{type:'application/pdf'});
}
function run(kind){
const s=exportSvgString();
if(!s){$('status').textContent='Nothing to export yet.';return}
if(kind==='svg'){exportDownload(new Blob([s],{type:'image/svg+xml'}),'floor-plan.svg');$('status').textContent='Exported floor-plan.svg';return}
toCanvas(s,(c,W,H)=>{
if(kind==='png')c.toBlob(b=>{exportDownload(b,'floor-plan.png');$('status').textContent='Exported floor-plan.png'},'image/png');
else{const u=c.toDataURL('image/jpeg',.92),bin=atob(u.split(',')[1]),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);exportDownload(pdfBlob(a,W,H),'floor-plan.pdf');$('status').textContent='Exported floor-plan.pdf'}
});
}
const btn=document.createElement('button'),grp=document.createElement('div'),files=document.querySelector('.files');
btn.id='export-btn';btn.textContent='Export';btn.title='Export the plan as SVG, PNG or PDF (as shown, without editing handles)';
document.getElementById('tb-extra').appendChild(btn);
const menu=document.createElement('div');menu.id='export-menu';menu.hidden=true;
menu.innerHTML='<button data-exp="svg" title="Vector graphic, scales without loss">SVG</button><button data-exp="png" title="Image, 2400 px wide">PNG</button><button data-exp="pdf" title="One page, A4 / A3 landscape or portrait">PDF</button>';
const st=document.createElement('style');
st.textContent='#export-menu{position:absolute;right:12px;top:48px;z-index:6;display:flex;gap:6px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:8px}#export-menu[hidden]{display:none}#export-menu button{margin:0}';
document.head.appendChild(st);
document.querySelector('.canvas').appendChild(menu);
btn.onclick=()=>{menu.hidden=!menu.hidden};
menu.addEventListener('click',e=>{const b=e.target.closest('[data-exp]');if(!b)return;menu.hidden=true;run(b.dataset.exp)});
})();
`;
