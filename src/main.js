import { Game } from './game/game.js';
import { VIEW_W, VIEW_H } from './config.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;

// 原生分辨率渲染：backing store = CSS 尺寸 × DPR，逻辑坐标仍为 480×270。
// 上限 2560×1440，避免 4K + 高 DPR 下填充率爆掉。
const MAX_PIXELS = 2560 * 1440;
function fitCanvas() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const cssW = Math.max(VIEW_W, Math.floor(VIEW_W * s));
  const cssH = Math.max(VIEW_H, Math.floor(VIEW_H * s));
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const cap = Math.sqrt(MAX_PIXELS / (VIEW_W * VIEW_H));
  const scale = Math.min(cssW / VIEW_W * (window.devicePixelRatio || 1), cap);
  const w = Math.round(VIEW_W * scale), h = Math.round(VIEW_H * scale);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
let lastW = window.innerWidth, lastH = window.innerHeight, lastDpr = window.devicePixelRatio;
fitCanvas();
window.addEventListener('resize', fitCanvas);
setInterval(() => {
  const w = window.innerWidth, h = window.innerHeight, d = window.devicePixelRatio;
  if (w !== lastW || h !== lastH || d !== lastDpr) { lastW = w; lastH = h; lastDpr = d; fitCanvas(); }
}, 1000);

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  while (acc >= STEP) { game.update(STEP); acc -= STEP; }
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
