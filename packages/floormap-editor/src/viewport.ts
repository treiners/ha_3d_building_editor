/**
 * Touch / pointer view gestures (v3.2): the new view rectangle after a one-finger pan or a two-finger pinch.
 * `view` = visible world rectangle { x, y, w, h } (metres), `scale` = screen pixels per metre at the start, `centre` = middle of the drawing area
 * in client pixels at the start (the SVG keeps the view centred, `xMidYMid meet`), `from` / `to` = the finger (or the midpoint of two fingers)
 * in client pixels at the start / now, `k` = zoom factor (finger distance now / at the start; 1 = pan only). The world point that was under `from`
 * ends up under `to`. The width is kept between 1 and 500 m. Pure, deterministic, embedded with toString().
 */
export function viewGesture(i: { view: { x: number; y: number; w: number; h: number }; scale: number; centre: { x: number; y: number }; from: { x: number; y: number }; to: { x: number; y: number }; k?: number }): { x: number; y: number; w: number; h: number } {
  const V = i.view, s = i.scale > 0 ? i.scale : 1;
  let k = typeof i.k === 'number' && isFinite(i.k) && i.k > 0 ? i.k : 1;
  const w1 = Math.max(1, Math.min(500, V.w / k));
  k = V.w / w1;
  const h1 = V.h / k, a1 = s * k;
  const px = V.x + V.w / 2 + (i.from.x - i.centre.x) / s, py = V.y + V.h / 2 + (i.from.y - i.centre.y) / s;
  const cx = px - (i.to.x - i.centre.x) / a1, cy = py - (i.to.y - i.centre.y) / a1;
  const r = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
  return { x: r(cx - w1 / 2), y: r(cy - h1 / 2), w: r(w1), h: r(h1) };
}
