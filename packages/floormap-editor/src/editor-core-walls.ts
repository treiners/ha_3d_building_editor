/**
 * Tools and wall dragging (part of the page script, see editor.ts for the order of the parts).
 * Tool state, overlap blocking and its messages, the wall grab strips and applying wall / corner plans.
 * Functions: blockMsg, wallLayer, applyWall, applyCorner.
 * Top-level lets / consts: tool, noOverlap, glueTouch, hidden.
 * Plain JavaScript in a template string, copied unchanged from editor.ts: edit with exact-substring replacements and run `npm test` (golden test) afterwards.
 */
export const coreWallsJs=`let tool='rooms';
const noOverlap=()=>$('no-overlap').checked,glueTouch=()=>$('glue-touch').checked,hidden=()=>g.rooms.filter(r=>r.name.toLowerCase()==='outside').map(r=>r.id);
function blockMsg(res){const nm=i=>room(i)?.name||i,a=(res.ids||[]).map(nm);switch(res.reason){case'overlap':return'Blocked: '+(a.join(' and ')||'another room')+' would overlap. Untick "Block overlaps" to allow it.';case'locked':return(a[0]||'A room')+' is locked in place.';case'max':return(a[0]||'A room')+' has reached its maximum size.';case'opening':case'tangent':return'Blocked: this would cut off the door or passage between '+a.join(' and ')+'.';default:return res.message||'Blocked by attached walls.'}}
function wallLayer(){if(tool!=='walls'||mode!=='mapping')return'';let out='';for(const r of g.rooms){if(r.name.toLowerCase()==='outside')continue;const R=rect(r);for(const s of['left','right','top','bottom']){const v=s==='left'||s==='right',n=s==='left'?R.x:s==='right'?R.x+R.width:s==='top'?R.y:R.y+R.height;out+='<line class="wallhit '+(v?'wallx':'wally')+'" data-wall="'+r.id+'" data-side="'+s+'" '+(v?'x1="'+n+'" x2="'+n+'" y1="'+R.y+'" y2="'+(R.y+R.height):'y1="'+n+'" y2="'+n+'" x1="'+R.x+'" x2="'+(R.x+R.width))+'"/>'}}return out}
function applyWall(P){const A=active,ax=A.side==='left'||A.side==='right'?'x':'y';A.want={d:snap(P[ax]-A.P[ax])};applyWallResult(planWall({graph:A.g0,joints:A.j0,roomId:A.id,side:A.side,delta:snap(P[ax]-A.P[ax]),step,noOverlap:noOverlap(),glueTouching:glueTouch(),alignments:A.g0.wallAlignments,ignoreIds:hidden()}))}
function applyCorner(P){const A=active;A.want={dx:snap(P.x-A.P.x),dy:snap(P.y-A.P.y)};applyWallResult(planCorner({graph:A.g0,joints:A.j0,roomId:A.id,corner:A.corner,dx:snap(P.x-A.P.x),dy:snap(P.y-A.P.y),step,noOverlap:noOverlap(),glueTouching:glueTouch(),alignments:A.g0.wallAlignments,ignoreIds:hidden()}))}`;
