/**
 * Dimensions and areas in the page: two toggle buttons (`m` = wall lengths, `m2` = room areas) at the end of the layer group in the toolbar draw small labels on top of the rooms
 * (pointer-events none, hidden together with the rooms), and an "Areas" card at the end of the Building tab lists the floor area of every room, per floor and in total (all floors,
 * computed from the file as it would be saved). Nothing is stored in the plan file; the two toggles are remembered in this browser. Pure helpers: `roomAreas`, `wallLabels` (dimensions.ts).
 * `dimsJs` must not contain backticks, dollar-brace or backslashes.
 */
export const dimsJs = `
(function(){
const E=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const dimUi={len:false,area:false,text:true};
window.dimUiLen=function(){return dimUi.len};
try{const s=JSON.parse(localStorage.getItem('floormap-dims')||'{}');dimUi.len=!!s.len;dimUi.area=!!s.area;dimUi.text=s.text!==false}catch(x){}
const st=document.createElement('style');
st.textContent='.dimlayer text{font-size:.2px;fill:#475569;paint-order:stroke;stroke:#fff;stroke-width:.06px;stroke-linejoin:round;pointer-events:none}.dimlayer text.dim-area{font-size:.26px;fill:#1e293b}.dimlayer text.dim-elev{font-size:.12px}body.hide-text #canvas text{display:none}body.hide-text #canvas .dimlayer text,body.hide-text #canvas text.jointarrow{display:inline}body.hide-rooms .dimlayer{display:none}#areas-card table{width:100%;border-collapse:collapse;font-size:12px}#areas-card td{padding:1px 4px}#areas-card td.n{text-align:right;white-space:nowrap}#areas-card tr.f td{font-weight:600;padding-top:6px}#areas-card tr.t td{font-weight:600;border-top:1px solid #cbd5e1}';
document.head.appendChild(st);
document.body.classList.toggle('hide-text',!dimUi.text);
const vg=document.querySelector('.visgrp');
function mkBtn(k,html,title){const b=document.createElement('button');b.dataset.dim=k;b.innerHTML=html;b.title=title;b.classList.toggle('active',dimUi[k]);b.onclick=()=>{dimUi[k]=!dimUi[k];b.classList.toggle('active',dimUi[k]);document.body.classList.toggle('hide-text',!dimUi.text);try{localStorage.setItem('floormap-dims',JSON.stringify(dimUi))}catch(x){}render()};vg.appendChild(b)}
mkBtn('len','m','Show the length of every wall (metres)');
mkBtn('area','m&#178;','Show the floor area of every room (square metres)');
mkBtn('text','T','Show or hide the text labels on the plan (room names and so on)');
function dimLayer(){
if(!dimUi.len&&!dimUi.area||mode==='gap')return'';
let s='<g class="dimlayer">';
for(const r of g.rooms){
if(!r.layout||String(r.name).toLowerCase()==='outside')continue;
const ox=0,oy=0;
if(dimUi.len)for(const w of wallLabels(r)){
const d=w.side,dx=d==='left'?.12:d==='right'?-.12:0,dy=d==='top'?.3:d==='bottom'?-.12:0,an=d==='left'?'start':d==='right'?'end':'middle';
s+='<text x="'+(w.x+ox+dx)+'" y="'+(w.y+oy+dy)+'" text-anchor="'+an+'">'+w.length+'</text>';
}
if(dimUi.len&&r.elevation>0){const tx='+'+r.elevation+' m',tw=tx.length*.075,sh=shapeOfRoom(r),W=r.layout.width,H=r.layout.height;let px=.15,py=H-.2,done=false;
for(let y=H-.2;y>=.3&&!done;y-=.1)for(let x=.15;x+tw<=W&&!done;x+=.1)if(outlineHasRect(sh,{x:x,y:y-.14,width:tw,height:.18})){px=Math.round(x*100)/100;py=Math.round(y*100)/100;done=true}
s+='<text class="dim-elev" x="'+(r.layout.x+px)+'" y="'+(r.layout.y+py)+'" text-anchor="start">'+tx+'</text>'}
if(dimUi.area){
const lr=outlineLabelRect(shapeOfRoom(r)),a=roomAreas({rooms:[r]}).rooms[0];
if(lr&&a)s+='<text class="dim-area" x="'+(r.layout.x+ox+lr.x+lr.width/2)+'" y="'+(r.layout.y+oy+lr.y+lr.height/2+.5)+'" text-anchor="middle">'+a.area.toFixed(1)+' m&#178;</text>';
}
}
return s+'</g>';
}
const sb=document.querySelector('.sec-building'),card=document.createElement('div');
card.className='card';card.id='areas-card';sb.appendChild(card);
function drawAreas(){
let sg;
try{sg=savedGraph(g)}catch(x){return}
const a=roomAreas(sg);
let h='<h2>Areas</h2>';
if(!a.rooms.length){card.innerHTML=h+'<div class="mini">No rooms with a place yet.</div>';return}
h+='<table>';
const many=a.floors.length>1;
for(const f of a.floors){
if(many)h+='<tr class="f"><td>'+E(f.name)+'</td><td class="n">'+f.area.toFixed(1)+' m&#178;</td></tr>';
for(const r of a.rooms)if(r.floor===f.floor)h+='<tr><td>'+E(r.name)+'</td><td class="n">'+r.area.toFixed(1)+' m&#178;</td></tr>';
}
h+='<tr class="t"><td>Total ('+a.rooms.length+' rooms)</td><td class="n">'+a.total.toFixed(1)+' m&#178;</td></tr></table>';
card.innerHTML=h;
}
let tm=0;
onRender(()=>{const h=dimLayer();if(h)svg.insertAdjacentHTML('beforeend',h);clearTimeout(tm);tm=setTimeout(drawAreas,250)});
drawAreas();
})();
`;
