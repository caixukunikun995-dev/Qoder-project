export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
export function angleLerp(a, b, t) {
  const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
export const angleDiff = (a, b) => Math.abs(((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI);
