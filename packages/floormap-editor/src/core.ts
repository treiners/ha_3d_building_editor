import{mapLayout}from'./mapper.js';
import{outlineNormalize,outlineIssues,outlineBounds,outlineWallAt}from'./shape.js';
import type{JointOverride}from'./joints.js';
export type Side='top'|'right'|'bottom'|'left';
export interface Layout{x:number;y:number;width:number;height:number;locked?:boolean;positionLocked?:boolean;sizeLocked?:boolean}
/** `locked` (old files) means both; the explicit flags win when present. positionLocked = top-left corner cannot move, sizeLocked = width/height cannot change. */
export const positionLocked=(l?:Layout)=>!!l&&(l.positionLocked??l.locked===true);
export const sizeLocked=(l?:Layout)=>!!l&&(l.sizeLocked??l.locked===true);
export interface Port{id:string;roomId:string;side:Side;type:string;position?:number;offset?:number;width?:number;doorType?:string;door?:any;window?:any;glazing?:string}
export interface Room{id:string;name:string;type:string;sizeCategory:'small'|'medium'|'large';connectors:Port[];layout?:Layout;
/** Optional shape with 90 degree corners (v2.18, see shape.ts): corners in metres from the layout's top-left corner. Absent = rectangle. */
outline?:[number,number][];
/** Optional heights (v3.2, see heights.ts): `elevation` = height of the room above the floor baseline of its floor (m, default 0); `wallHeight` / `wallHeights` = wall height of the whole room / of single walls (m, default = floor height or building default). */
elevation?:number;wallHeight?:number;wallHeights?:Partial<Record<Side,number>>}
export interface Link{id:string;connectorA:string;connectorB:string;importance:string}
export interface Alignment{id:string;side:Side;roomIds:string[]}
export interface MapperMetrics{overlaps:number;satisfied:number;open:number;area:number}
export interface MapperResult{metrics:MapperMetrics;movedRooms:string[]}
export interface Graph{schemaVersion:'2.14'|'3.0';id:string;name:string;rooms:Room[];relationships:Link[];wallAlignments:Alignment[];joints?:JointOverride[];buildingDefaults?:{wallThickness:number;wallHeight:number;floorThickness:number}}
export const clean=(v:number)=>Number(v.toFixed(4));
export const snap=(v:number,s=.2)=>clean(Math.round(v/s)*s);
export const rect=(r:Room):Layout=>r.layout??(r.layout={x:0,y:0,width:r.sizeCategory==='large'?6:r.sizeCategory==='small'?3:4,height:r.sizeCategory==='large'?4:r.sizeCategory==='small'?2:3});
export const wallLength=(r:Room,s:Side)=>s==='top'||s==='bottom'?rect(r).width:rect(r).height;
export function norm(r:Room,p:Port){const L=wallLength(r,p.side);p.offset=clean(Math.max(.05,Math.min(L-.05,p.offset??(p.position??.5)*L)));p.position=clean(p.offset/L)}
export function migrate(raw:any):Graph{const g={...raw,schemaVersion:'3.0',...(Array.isArray(raw.joints)?{joints:raw.joints.map((j:any)=>({...j}))}:{}),wallAlignments:(raw.wallAlignments??[]).map((a:any)=>({...a,roomIds:[...(a.roomIds??[])]})),relationships:(raw.relationships??[]).map((l:any)=>({...l})),rooms:(raw.rooms??[]).map((r:any)=>({...r,connectors:(r.connectors??[]).map((p:any)=>({...p})),layout:r.layout?{...r.layout,x:clean(+r.layout.x),y:clean(+r.layout.y),width:clean(+r.layout.width),height:clean(+r.layout.height)}:undefined}))}as Graph;g.rooms.forEach(r=>{if(r.layout)r.connectors.forEach(p=>norm(r,p))});g.rooms.forEach(shapeRoom);return g}
/** Canonical outline; a plain rectangle drops it; a real shape fixes the size (the shape tool of a later phase is the only way to change it). Invalid outlines are kept for the contract check to report. */
function shapeRoom(r:Room){if(!Array.isArray(r.outline))return;const n=outlineNormalize(r.outline);r.outline=n;if(outlineIssues(n).length)return;const b=outlineBounds(n),L=r.layout,same=!L||(Math.abs(b.x)<1e-6&&Math.abs(b.y)<1e-6&&Math.abs(b.width-L.width)<1e-6&&Math.abs(b.height-L.height)<1e-6);if(n.length===4&&same){delete r.outline;return}if(L&&same)L.sizeLocked=true}
/** The wall a connector sits on in world coordinates: normal coordinate `n` and tangent extent `t0..t1` (the side of the bounding box, or for a room with its own shape the wall segment at the connector's offset, v2.18). */
function shapeOf(r:Room){return r.outline&&outlineIssues(r.outline).length===0?r.outline:null}
function wallSeg(g:Graph,p:Port){const r=g.rooms.find(x=>x.id===p.roomId)!,R=rect(r),h=p.side==='top'||p.side==='bottom',L=h?R.width:R.height,o=Math.max(.05,Math.min(L-.05,p.offset??(p.position??.5)*L)),ol=shapeOf(r),w=ol?outlineWallAt(ol,p.side,o,(p as{wallAt?:number}).wallAt):undefined,at=w?w.at:(p.side==='top'||p.side==='left'?0:h?R.height:R.width),f=w?w.from:0,t=w?w.to:L;return h?{n:R.y+at,t0:R.x+f,t1:R.x+t}:{n:R.x+at,t0:R.y+f,t1:R.y+t}}
export function point(g:Graph,p:Port){const r=g.rooms.find(x=>x.id===p.roomId)!;norm(r,p);const R=rect(r),o=p.offset!,s=wallSeg(g,p);return p.side==='top'?{x:clean(R.x+o),y:s.n}:p.side==='bottom'?{x:clean(R.x+o),y:clean(s.n)}:p.side==='left'?{x:s.n,y:clean(R.y+o)}:{x:clean(s.n),y:clean(R.y+o)}}
export function setWorld(g:Graph,p:Port,P:{x:number;y:number}){const r=g.rooms.find(x=>x.id===p.roomId)!,R=rect(r),L=wallLength(r,p.side),v=p.side==='top'||p.side==='bottom'?P.x-R.x:P.y-R.y,ol=shapeOf(r),w=ol?outlineWallAt(ol,p.side,Math.max(0,Math.min(L,v)),(p as{wallAt?:number}).wallAt):undefined;let lo=.05,hi=L-.05;if(w){lo=w.from+.05;hi=w.to-.05;if(hi<lo)lo=hi=(w.from+w.to)/2}p.offset=clean(Math.max(lo,Math.min(hi,v)));p.position=clean(p.offset/L)}
export function touch(g:Graph,a:Port,b:Port,t=.08){const ra=g.rooms.find(r=>r.id===a.roomId)!,rb=g.rooms.find(r=>r.id===b.roomId)!;if(shapeOf(ra)||shapeOf(rb)){const sa=wallSeg(g,a),sb=wallSeg(g,b),opp=(a.side==='right'&&b.side==='left')||(a.side==='left'&&b.side==='right')||(a.side==='bottom'&&b.side==='top')||(a.side==='top'&&b.side==='bottom');return opp&&Math.abs(sa.n-sb.n)<=t&&Math.max(sa.t0,sb.t0)<Math.min(sa.t1,sb.t1)}const A=rect(ra),B=rect(rb),oy=Math.max(A.y,B.y)<Math.min(A.y+A.height,B.y+B.height),ox=Math.max(A.x,B.x)<Math.min(A.x+A.width,B.x+B.width);return(a.side==='right'&&b.side==='left'&&Math.abs(A.x+A.width-B.x)<=t&&oy)||(a.side==='left'&&b.side==='right'&&Math.abs(A.x-B.x-B.width)<=t&&oy)||(a.side==='bottom'&&b.side==='top'&&Math.abs(A.y+A.height-B.y)<=t&&ox)||(a.side==='top'&&b.side==='bottom'&&Math.abs(A.y-B.y-B.height)<=t&&ox)}
export function aligned(g:Graph,l:Link,t=.2){const M=new Map(g.rooms.flatMap(r=>r.connectors).map(p=>[p.id,p])),a=M.get(l.connectorA),b=M.get(l.connectorB);if(!a||!b||!touch(g,a,b))return false;const A=point(g,a),B=point(g,b);return Math.hypot(A.x-B.x,A.y-B.y)<=t}
export function alignPair(g:Graph,l:Link){const M=new Map(g.rooms.flatMap(r=>r.connectors).map(p=>[p.id,p])),a=M.get(l.connectorA),b=M.get(l.connectorB);if(!a||!b||!touch(g,a,b,.5))return false;const A=point(g,a),B=point(g,b),P=a.side==='top'||a.side==='bottom'?{x:clean((A.x+B.x)/2),y:A.y}:{x:A.x,y:clean((A.y+B.y)/2)};setWorld(g,a,P);setWorld(g,b,P);return true}
export function alignmentAxis(a:Alignment){return a.side==='top'||a.side==='bottom'?'y':'x'}
export function moveAlignmentGroup(g:Graph,a:Alignment,delta:number){for(const id of a.roomIds){const r=g.rooms.find(x=>x.id===id);if(!r||positionLocked(rect(r)))continue;if(alignmentAxis(a)==='y')rect(r).y=clean(rect(r).y+delta);else rect(r).x=clean(rect(r).x+delta)}g.relationships.forEach(l=>alignPair(g,l))}
const overlap=(a:Layout,b:Layout,p=.05)=>a.x<b.x+b.width+p&&a.x+a.width+p>b.x&&a.y<b.y+b.height+p&&a.y+a.height+p>b.y;
function layoutArea(g:Graph){if(!g.rooms.length)return 0;const minX=Math.min(...g.rooms.map(r=>rect(r).x)),minY=Math.min(...g.rooms.map(r=>rect(r).y)),maxX=Math.max(...g.rooms.map(r=>rect(r).x+rect(r).width)),maxY=Math.max(...g.rooms.map(r=>rect(r).y+rect(r).height));return clean((maxX-minX)*(maxY-minY))}
export function metrics(g:Graph):MapperMetrics{let O=0;for(let i=0;i<g.rooms.length;i++)for(let j=i+1;j<g.rooms.length;j++)if(overlap(rect(g.rooms[i]!),rect(g.rooms[j]!),0))O++;const S=g.relationships.filter(l=>aligned(g,l)).length;return{overlaps:O,satisfied:S,open:g.relationships.length-S,area:layoutArea(g)}}
function cloneLayouts(g:Graph){return new Map(g.rooms.map(r=>[r.id,{...rect(r)}]))}function restoreLayouts(g:Graph,m:Map<string,Layout>){for(const r of g.rooms){const x=m.get(r.id);if(x)r.layout={...x}}}

/** Apply a mapper result: layouts for the rooms the mapper placed, plus shared opening offsets (green connectors). */
function applyMap(g:Graph,res:ReturnType<typeof mapLayout>,ids:Set<string>){
  const P=new Map(g.rooms.flatMap(r=>r.connectors).map(p=>[p.id,p]));
  for(const r of g.rooms){if(!ids.has(r.id))continue;const L=res.layouts[r.id]!;r.layout={...L,x:clean(L.x),y:clean(L.y),width:clean(L.width),height:clean(L.height)};r.connectors.forEach(p=>norm(r,p))}
  for(const o of res.openings){const a=P.get(o.connectorA),b=P.get(o.connectorB);if(!a||!b||(!ids.has(a.roomId)&&!ids.has(b.roomId)))continue;
    for(const[p,off]of[[a,o.offsetA],[b,o.offsetB]]as const){const r=g.rooms.find(x=>x.id===p.roomId)!;norm(r,p);p.offset=clean(Math.max(.05,Math.min(wallLength(r,p.side)-.05,off)));p.position=clean(p.offset/wallLength(r,p.side))}}
}
/** Load path: keep every supplied layout, place only the rooms that have none. */
export function mapOnlyMissing(g:Graph){
  const missing=new Set(g.rooms.filter(r=>!r.layout).map(r=>r.id));if(!missing.size)return;
  applyMap(g,mapLayout(g,{moveOnly:[...missing]}),missing);
}
/** Explicit "Run mapper": locked rooms stay, every other room is re-placed (its size is kept). */
export function runMapper(g:Graph):MapperResult{
  const before=cloneLayouts(g),free=new Set(g.rooms.filter(r=>!positionLocked(rect(r))).map(r=>r.id));
  applyMap(g,mapLayout(g,{moveOnly:[...free]}),free);
  const moved=g.rooms.filter(r=>{const a=before.get(r.id)!,b=rect(r);return a.x!==b.x||a.y!==b.y||a.width!==b.width||a.height!==b.height}).map(r=>r.id);
  return{metrics:metrics(g),movedRooms:moved}
}
export function validateGraph(raw:any){const e:string[]=[];if(!raw||typeof raw!=='object')e.push('The JSON root must be an object.');if(!Array.isArray(raw?.rooms))e.push('The graph must contain a rooms array.');if(!Array.isArray(raw?.relationships))e.push('The graph must contain a relationships array.');return e}
