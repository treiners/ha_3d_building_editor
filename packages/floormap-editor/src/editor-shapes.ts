/**
 * Room shapes in the page (v2.18 phase 2, see docs/V2.18-SHAPES.md): how a room with an `outline` is drawn. Rectangles are drawn exactly as before (`roomShape`
 * returns the same `<rect>` string); a room with a valid outline is drawn as a `<path>` with the same CSS classes (so selection, locks and hit testing work
 * unchanged), and its label sits in the middle of the largest rectangle inside it. Gap view scales the path like the rectangle.
 * Functions: roomOutline, roomShape, roomLabel. Uses the embedded shape functions (outlineIssues, outlineLabelRect).
 * `shapesJs` must not contain backticks, dollar-brace or backslashes.
 */
export const shapesJs = `
function roomOutline(r){const o=r.outline;return Array.isArray(o)&&o.length>=4&&outlineIssues(o).length===0?o:null}
function roomShape(r,R,cls){const o=roomOutline(r);if(!o)return'<rect class="'+cls+'" x="'+R.x+'" y="'+R.y+'" width="'+R.w+'" height="'+R.h+'"/>';const L=rect(r),sx=R.w/L.width,sy=R.h/L.height;return'<path class="'+cls+'" d="M'+o.map(p=>(R.x+p[0]*sx)+' '+(R.y+p[1]*sy)).join(' L')+' Z"/>'}
function roomLabel(r,R){const o=roomOutline(r);if(!o)return{x:R.x+R.w/2,y:R.y+R.h/2};const L=rect(r),q=outlineLabelRect(o);return{x:R.x+(q.x+q.width/2)*R.w/L.width,y:R.y+(q.y+q.height/2)*R.h/L.height}}
`;
