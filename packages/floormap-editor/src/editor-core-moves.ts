/**
 * Move modes and locks (part of the page script, see editor.ts for the order of the parts).
 * Move modes Free / Slide / Slide + pull (`applyPlan`), the joint overlay, detaching on purpose, position / size lock helpers.
 * Functions: applyPlan, detachBroken, jointOverlay, posLocked, sizeLocked.
 * Top-level lets / consts: moveMode, MODE_HINT.
 * Plain JavaScript in a template string, copied unchanged from editor.ts: edit with exact-substring replacements and run `npm test` (golden test) afterwards.
 */
export const coreMovesJs=`let moveMode='free';
const MODE_HINT={free:'Move mode: Free - rooms move independently, no wall is kept.',slide:'Move mode: Slide - rooms stay attached and slide along shared walls. Alt+drag detaches.',pull:'Move mode: Slide + pull - neighbours are pulled along. Alt+drag detaches.'};
function applyPlan(dx,dy){const A=active;A.want={dx,dy};const res=planMove({graph:A.g0,joints:A.j0,roomId:A.id,dx,dy,mode:moveMode,step,noOverlap:noOverlap(),blockWholePlan:true,slideAlong:true,from:A.lastD,ignoreIds:hidden()});A.lastD=res.displacements[A.id];for(const r of g.rooms){const d=res.displacements[r.id],o=A.g0.rooms.find(x=>x.id===r.id),s=o.layout;r.connectors=o.connectors.map(p=>({...p}));rect(r).x=clean(s.x+(d?d.dx:0));rect(r).y=clean(s.y+(d?d.dy:0))}for(const o of res.openings){const a=port(o.connectorA),b=port(o.connectorB);if(a&&b){setWorld(a,{x:o.world,y:o.world});setWorld(b,{x:o.world,y:o.world})}}if(res.blocked)$('status').textContent=blockMsg(res)}
function detachBroken(j0){const now=new Map(deriveJoints(g).joints.map(j=>[j.relationshipId,j])),list=g.joints||(g.joints=[]);for(const j of j0){if(j.status!=='ok')continue;const n=now.get(j.relationshipId);if(n&&n.status!=='ok'){const o=list.find(x=>x.relationshipId===j.relationshipId);if(o)o.state='detached';else list.push({relationshipId:j.relationshipId,state:'detached'})}}}
function jointOverlay(){if(moveMode==='free'||mode!=='mapping')return'';const id=[...sel][0];if(!id)return'';let out='';for(const j of deriveJoints(g).joints){if(j.status!=='ok'||(j.roomA!==id&&j.roomB!==id)||!j.overlap)continue;const A=rect(room(j.roomA)),n=j.sideA==='right'?A.x+A.width:j.sideA==='left'?A.x:j.sideA==='bottom'?A.y+A.height:A.y,m=(j.overlap[0]+j.overlap[1])/2;out+=j.axis==='y'?'<line class="jointwall" x1="'+n+'" x2="'+n+'" y1="'+j.overlap[0]+'" y2="'+j.overlap[1]+'"/><text class="jointarrow" x="'+n+'" y="'+m+'">\u2195</text>':'<line class="jointwall" y1="'+n+'" y2="'+n+'" x1="'+j.overlap[0]+'" x2="'+j.overlap[1]+'"/><text class="jointarrow" x="'+m+'" y="'+n+'">\u2194</text>'}return out}
function posLocked(r){const l=rect(r);return l.positionLocked??l.locked===true}
function sizeLocked(r){const l=rect(r);return l.sizeLocked??l.locked===true}`;
