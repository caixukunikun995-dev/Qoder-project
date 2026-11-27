import { VIEW_W, VIEW_H, COLORS } from '../config.js';

// 原生分辨率渲染：画布物理尺寸 = CSS 尺寸 × DPR，逻辑坐标仍为 480×270，
// 通过 setTransform 缩放，使文字/几何在高分屏下保持锐利。
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.emissive = null;
    this.worldZoom = 1;
  }
  resize() { this.scale = this.canvas.width / VIEW_W || 1; }
  begin() {
    const g = this.ctx;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.imageSmoothingEnabled = false;
  }
  beginWorld() {
    const g = this.ctx;
    const s = this.scale * this.worldZoom;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.imageSmoothingEnabled = false;
  }
  clear(c = COLORS.bg) { this.ctx.fillStyle = c; this.ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  clearTransparent() { this.ctx.clearRect(0, 0, VIEW_W, VIEW_H); }
  rect(x, y, w, h, c) { const g = this.ctx; g.fillStyle = c; g.fillRect(x, y, w, h); }
  stroke(x, y, w, h, c, lw = 1) { const g = this.ctx; g.strokeStyle = c; g.lineWidth = lw; g.strokeRect(x, y, w, h); }
  circle(x, y, r, c) { const g = this.ctx; g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  ring(x, y, r, c, lw = 1) { const g = this.ctx; g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
  line(x0, y0, x1, y1, c, lw = 1) { const g = this.ctx; g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  ellipse(x, y, rx, ry, c) { const g = this.ctx; g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  glow(x, y, r, c0, c1) {
    this._glow(this.ctx, x, y, r, c0, c1);
    if (this.emissive) this._glow(this.emissive.ctx, x, y, r, c0, c1);
  }
  _glow(g, x, y, r, c0, c1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  gradRect(x, y, w, h, c0, c1) {
    const g = this.ctx;
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  vignette(w, h, strength) {
    const g = this.ctx;
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${strength})`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  text(s, x, y, opt = {}) {
    const g = this.ctx;
    const { color = COLORS.text, size = 8, align = 'left', baseline = 'top', font = 'monospace', bold = false } = opt;
    g.fillStyle = color;
    g.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
    g.textAlign = align; g.textBaseline = baseline;
    g.fillText(s, x, y);
  }
}
