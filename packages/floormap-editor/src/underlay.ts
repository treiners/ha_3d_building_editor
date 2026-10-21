/**
 * Image underlay helpers (pure, embedded). The underlay is a rectangle { x, y, w, h } in plan metres; it is a view setting and never saved.
 * `underlayInit`: a freshly loaded image gets 80% of the visible width, centred in the view, with the image's aspect ratio.
 * `underlayScale`: two-click calibration: the image is scaled about the first point so that the distance between the two clicked points becomes `real` metres.
 */
export function underlayInit(view: { x: number; y: number; w: number; h: number }, natW: number, natH: number): { x: number; y: number; w: number; h: number } {
  const w = view.w * 0.8, h = (w * natH) / natW;
  return { x: view.x + (view.w - w) / 2, y: view.y + (view.h - h) / 2, w, h };
}

export function underlayScale(u: { x: number; y: number; w: number; h: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, real: number): { x: number; y: number; w: number; h: number } {
  const d = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y));
  if (!(d > 1e-6) || !(real > 0)) return u;
  const f = real / d;
  return { x: p1.x + (u.x - p1.x) * f, y: p1.y + (u.y - p1.y) * f, w: u.w * f, h: u.h * f };
}
