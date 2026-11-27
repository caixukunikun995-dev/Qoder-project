import { TILE, VIEW_W, VIEW_H, COLORS, WALL_H, CRATE_H } from '../config.js';
import { Renderer } from '../engine/renderer.js';

export const TILECODE = { FLOOR: 0, WALL: 1, CRATE: 2, SITE_A: 3, SITE_B: 4, SPAWN_T: 5, SPAWN_CT: 6 };
const { FLOOR, WALL, CRATE, SITE_A, SITE_B, SPAWN_T, SPAWN_CT } = TILECODE;

// 有限调色板 ramps（像素艺术原则：少色、刻意 dither、避免 pillow shading）
const SAND = ['#d8b878', '#cfae6c', '#c5a260', '#b89454', '#a8854a'];
const WALL_TOP = ['#9c8460', '#8a7452', '#7a6547', '#6a563c'];
const WALL_FACE = ['#5a4a33', '#4a3c28', '#3a2f1f'];
const WOOD = ['#c99a5e', '#b8935a', '#9c7b46', '#7a5c33'];

export class GameMap {
  constructor(def) {
    this.def = def;
    this.cols = def.cols; this.rows = def.rows;
    this.w = def.cols * TILE; this.h = def.rows * TILE;
    this.grid = [];
    for (let r = 0; r < this.rows; r++) this.grid.push(new Array(this.cols).fill(FLOOR));
    const fill = (c0, r0, c1, r1, code) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.inB(c, r)) this.grid[r][c] = code; };
    def.paint(fill);
    this.sites = { A: this._site(def.sites.A), B: this._site(def.sites.B) };
    this.spawnRects = { T: this._rect(def.spawns.T), CT: this._rect(def.spawns.CT) };
    this._ground = null; this._blocks = null;
  }
  // 静态地面一次性烘焙到离屏画布，每帧单 blit（大幅提帧）
  bakeGround() {
    if (this._ground) return;
    const W = this.w + this.h, H = (this.w + this.h) / 2 + TILE * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const r = new Renderer(c); r.scale = 1; r.begin();
    r.ctx.fillStyle = '#332e26'; r.ctx.fillRect(0, 0, W, H);
    const cam = { x: -this.h, y: 0, zoom: 1, worldToScreen: (x, y, z = 0) => [(x - y) + this.h, (x + y) / 2 - z] };
    this.renderGround(r, cam);
    this._ground = c;
  }
  blitGround(g, cam) {
    this.bakeGround();
    const vw = VIEW_W / (cam.zoom || 1), vh = VIEW_H / (cam.zoom || 1);
    g.ctx.drawImage(this._ground, cam.x + this.h, cam.y, vw, vh, 0, 0, vw, vh);
  }
  _rect(a) { return { c0: a[0], r0: a[1], c1: a[2], r1: a[3] }; }
  inB(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  _site(a) { const x = a[0] * TILE, y = a[1] * TILE, w = (a[2] - a[0] + 1) * TILE, h = (a[3] - a[1] + 1) * TILE; return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }; }
  tile(c, r) { return this.inB(c, r) ? this.grid[r][c] : WALL; }
  solid(c, r) { const t = this.tile(c, r); return t === WALL || t === CRATE; }
  walkable(c, r) { return this.inB(c, r) && !this.solid(c, r); }
  siteAt(x, y) { for (const k of ['A', 'B']) { const s = this.sites[k]; if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return k; } return null; }
  spawns(team, count) {
    const sr = this.spawnRects[team]; const pts = [];
    const cy = (sr.r0 + sr.r1 + 1) / 2 * TILE;
    const width = sr.c1 - sr.c0 + 1;
    for (let i = 0; i < count; i++) { const t = (i + 0.5) / count; pts.push({ x: (sr.c0 + width * t) * TILE, y: cy }); }
    return pts;
  }
  nearestWalkable(c, r) {
    if (this.walkable(c, r)) return { c, r };
    for (let rad = 1; rad < 8; rad++)
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++)
          if (this.walkable(c + dc, r + dr)) return { c: c + dc, r: r + dr };
    return { c, r };
  }
  // 等距地面 pass：diamond tiles + 调色板 dither + 方向光软阴影
  renderGround(g, cam) {
    const T = TILE;
    const ctx = g.ctx;
    const dia = (sx, sy, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + T, sy + T / 2); ctx.lineTo(sx, sy + T); ctx.lineTo(sx - T, sy + T / 2); ctx.closePath(); ctx.fill(); };
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      if (this.solid(c, r)) continue;
      const sx = (c - r) * T - cam.x, sy = (c + r) * T / 2 - cam.y;
      const t = this.grid[r][c];
      const hsh = (c * 7 + r * 13) % 7;
      dia(sx, sy, (c + r) & 1 ? SAND[1] : SAND[2]);
      if (hsh === 0) dia(sx - 4, sy + 2, SAND[0]);
      else if (hsh === 2) { ctx.fillStyle = SAND[3]; ctx.fillRect(sx - 3, sy + T / 2 - 1, 2, 2); ctx.fillRect(sx + 2, sy + T / 2 + 1, 2, 2); }
      else if (hsh === 3) { ctx.fillStyle = SAND[3]; ctx.fillRect(sx - 4, sy + T / 2, 6, 1); }
      else if (hsh === 1) { ctx.fillStyle = SAND[4]; ctx.fillRect(sx + 1, sy + T / 2 - 2, 1, 1); }
      if (this.solid(c, r - 1) || this.solid(c - 1, r)) {
        ctx.save(); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + T, sy + T / 2); ctx.lineTo(sx, sy + T); ctx.lineTo(sx - T, sy + T / 2); ctx.closePath(); ctx.clip();
        const gr = ctx.createLinearGradient(sx, sy, sx, sy + T); gr.addColorStop(0, 'rgba(20,14,8,0.35)'); gr.addColorStop(1, 'rgba(20,14,8,0)');
        ctx.fillStyle = gr; ctx.fillRect(sx - T, sy, T * 2, T); ctx.restore();
      }
      if (t === SITE_A) dia(sx, sy, 'rgba(184,86,63,0.22)');
      else if (t === SITE_B) dia(sx, sy, 'rgba(63,127,184,0.22)');
      else if (t === SPAWN_T) dia(sx, sy, 'rgba(207,143,79,0.14)');
      else if (t === SPAWN_CT) dia(sx, sy, 'rgba(79,143,206,0.14)');
    }
    for (const k of ['A', 'B']) {
      const s = this.sites[k];
      const [nx, ny] = cam.worldToScreen(s.x, s.y);
      const [ex, ey] = cam.worldToScreen(s.x + s.w, s.y);
      const [sx2, sy2] = cam.worldToScreen(s.x + s.w, s.y + s.h);
      const [wx2, wy2] = cam.worldToScreen(s.x, s.y + s.h);
      const col = k === 'A' ? '#e88a6f' : '#6fa8e8';
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(ex, ey); ctx.lineTo(sx2, sy2); ctx.lineTo(wx2, wy2); ctx.closePath(); ctx.stroke();
      const [cx2, cy2] = cam.worldToScreen(s.cx, s.cy);
      g.text(k, cx2, cy2, { color: col, size: 22, align: 'center', baseline: 'middle', bold: true });
    }
    for (const [c, r, t] of (this.def.labels || [])) {
      const [lx, ly] = cam.worldToScreen(c * T, r * T);
      g.text(t, lx, ly, { color: 'rgba(242,234,216,0.5)', size: 7, align: 'center', font: '"Microsoft YaHei", sans-serif' });
    }
  }
  solidBlocks(cam) {
    const T = TILE;
    if (!this._blocks) {
      this._blocks = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const t = this.grid[r][c];
        if (t === WALL || t === CRATE) this._blocks.push({ c, r, t, depth: (c + r + 1) * T });
      }
    }
    const list = [];
    for (const b of this._blocks) {
      const sx = (b.c - b.r) * T - cam.x, sy = (b.c + b.r) * T / 2 - cam.y;
      if (sx < -T * 2 || sx > VIEW_W + T * 2 || sy < -T * 3 || sy > VIEW_H + T * 2) continue;
      list.push(b);
    }
    return list;
  }
  // 等距立体块：top diamond + 左/右面 + 方向光 + selout + 软阴影
  drawBlock(g, cam, c, r, t) {
    const T = TILE; const ctx = g.ctx;
    const H = t === WALL ? WALL_H : CRATE_H;
    const sx = (c - r) * T - cam.x, sy = (c + r) * T / 2 - cam.y;
    const n = this.solid(c, r - 1), e = this.solid(c + 1, r), s = this.solid(c, r + 1), w = this.solid(c - 1, r);
    ctx.fillStyle = 'rgba(20,14,8,0.28)';
    ctx.beginPath(); ctx.moveTo(sx, sy + 2); ctx.lineTo(sx + T, sy + T / 2 + 2); ctx.lineTo(sx, sy + T + 2); ctx.lineTo(sx - T, sy + T / 2 + 2); ctx.closePath(); ctx.fill();
    const top = t === WALL ? WALL_TOP : WOOD;
    const faceL = t === WALL ? WALL_FACE[0] : WOOD[2];
    const faceR = t === WALL ? WALL_FACE[2] : WOOD[3];
    ctx.fillStyle = faceL;
    ctx.beginPath(); ctx.moveTo(sx - T, sy + T / 2 - H); ctx.lineTo(sx, sy + T - H); ctx.lineTo(sx, sy + T); ctx.lineTo(sx - T, sy + T / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = faceR;
    ctx.beginPath(); ctx.moveTo(sx, sy + T - H); ctx.lineTo(sx + T, sy + T / 2 - H); ctx.lineTo(sx + T, sy + T / 2); ctx.lineTo(sx, sy + T); ctx.closePath(); ctx.fill();
    ctx.fillStyle = top[1];
    ctx.beginPath(); ctx.moveTo(sx, sy - H); ctx.lineTo(sx + T, sy + T / 2 - H); ctx.lineTo(sx, sy + T - H); ctx.lineTo(sx - T, sy + T / 2 - H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = top[3]; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx - T / 2, sy + T / 4 - H); ctx.lineTo(sx + T / 2, sy + 3 * T / 4 - H); ctx.stroke();
    if (t === CRATE) { ctx.strokeStyle = top[0]; ctx.beginPath(); ctx.moveTo(sx - T / 2, sy + 3 * T / 4 - H); ctx.lineTo(sx + T / 2, sy + T / 4 - H); ctx.stroke(); }
    if (!n || !w) { ctx.strokeStyle = top[0]; ctx.beginPath(); ctx.moveTo(sx - T, sy + T / 2 - H); ctx.lineTo(sx, sy - H); ctx.stroke(); }
    if (!n || !e) { ctx.strokeStyle = top[0]; ctx.beginPath(); ctx.moveTo(sx, sy - H); ctx.lineTo(sx + T, sy + T / 2 - H); ctx.stroke(); }
    if (!s || !w) { ctx.strokeStyle = top[3]; ctx.beginPath(); ctx.moveTo(sx - T, sy + T / 2 - H); ctx.lineTo(sx, sy + T - H); ctx.stroke(); }
    if (!s || !e) { ctx.strokeStyle = top[3]; ctx.beginPath(); ctx.moveTo(sx, sy + T - H); ctx.lineTo(sx + T, sy + T / 2 - H); ctx.stroke(); }
    if (t === CRATE) { ctx.fillStyle = '#3a3a40'; ctx.fillRect(sx - 1, sy - H - 1, 2, 2); ctx.fillRect(sx - 1, sy + T - H - 1, 2, 2); }
  }
}
