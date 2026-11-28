import { TILE, VIEW_W, VIEW_H, COLORS, WALL_H, CRATE_H } from '../config.js';
import { Renderer } from '../engine/renderer.js';

export const TILECODE = { FLOOR: 0, WALL: 1, CRATE: 2, SITE_A: 3, SITE_B: 4, SPAWN_T: 5, SPAWN_CT: 6, SITE_C: 7, ROCK: 8, BARREL: 9, SANDBAG: 10, CACTUS: 11, GRASS: 12, SNOWDRIFT: 13, WATER: 14 };
const { FLOOR, WALL, CRATE, SITE_A, SITE_B, SITE_C, SPAWN_T, SPAWN_CT, ROCK, BARREL, SANDBAG, CACTUS, GRASS, SNOWDRIFT, WATER } = TILECODE;
export const SITE_COL = { A: '#e88a6f', B: '#6fa8e8', C: '#8fd08a' };
export const UP_H = 22; // 二楼楼板高度
const PROP_H = { [ROCK]: 9, [BARREL]: 8, [SANDBAG]: 4, [CACTUS]: 6 };
const SOLID = new Set([WALL, CRATE, ROCK, BARREL, SANDBAG, CACTUS, WATER]);

// 场景主题调色板：沙（默认）/ 丛林 / 雪地。floor=地面 diamond 五色 ramp，
// wallTop/wallFace=墙与木箱挤出面，upper=二楼地板，rock/bag=巨石与沙袋配色
const THEMES = {
  sand: {
    floor: ['#d8b878', '#cfae6c', '#c5a260', '#b89454', '#a8854a'],
    wallTop: ['#9c8460', '#8a7452', '#7a6547', '#6a563c'], wallFace: ['#5a4a33', '#4a3c28', '#3a2f1f'],
    wood: ['#c99a5e', '#b8935a', '#9c7b46', '#7a5c33'],
    upper: ['#cbb08a', '#c2a67e'],
    rock: { top: '#b89e74', l: '#8f7850', r: '#7a6540', line: '#c9b088' },
    bag: { top: '#c8b088', l: '#98805a', r: '#84704c', line: '#6e5b3e' },
  },
  jungle: {
    floor: ['#5f7f4c', '#567345', '#4c683d', '#688a54', '#425c36'],
    wallTop: ['#6f7f5c', '#5f6f4e', '#526044', '#454f3a'], wallFace: ['#333d2a', '#2a3322', '#20281a'],
    wood: ['#8a6a3e', '#7a5c36', '#5f4628', '#4a3620'],
    upper: ['#7f9a68', '#748e5e'],
    rock: { top: '#8fa07e', l: '#6f8062', r: '#5c6c52', line: '#a8bc94' },
    bag: { top: '#96a878', l: '#6e8452', r: '#5c7044', line: '#4c5c38' },
  },
  snow: {
    floor: ['#e6ecf2', '#dbe3eb', '#d0d9e3', '#eff4f9', '#c4cfd9'],
    wallTop: ['#b3c3d4', '#a2b4c8', '#90a4ba', '#7e94ac'], wallFace: ['#59697c', '#4b5a6c', '#3d4a5a'],
    wood: ['#7a6a5a', '#6a5c4e', '#54483c', '#403830'],
    upper: ['#eef3f8', '#e2e9f0'],
    rock: { top: '#c2ccd6', l: '#93a1b0', r: '#7e8c9b', line: '#dde5ec' },
    bag: { top: '#f2f6fa', l: '#ccd6e0', r: '#b8c4d0', line: '#98a6b4' },
  },
};

export class GameMap {
  constructor(def) {
    this.def = def;
    this.theme = THEMES[def.theme] || THEMES.sand;
    this.cols = def.cols; this.rows = def.rows;
    this.w = def.cols * TILE; this.h = def.rows * TILE;
    this.grid = [];
    for (let r = 0; r < this.rows; r++) this.grid.push(new Array(this.cols).fill(FLOOR));
    const fill = (c0, r0, c1, r1, code) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.inB(c, r)) this.grid[r][c] = code; };
    def.paint(fill);
    this.sites = {};
    for (const k of Object.keys(def.sites)) this.sites[k] = this._site(def.sites[k]);
    this.spawnRects = { T: this._rect(def.spawns.T), CT: this._rect(def.spawns.CT) };
    this.upper = (def.upper || []).map(u => {
      const r = this._rect(u.rect);
      const ov = this._rect(u.overlook);
      const room = { name: u.name, ...r, x: r.c0 * TILE, y: r.r0 * TILE, w: (r.c1 - r.c0 + 1) * TILE, h: (r.r1 - r.r0 + 1) * TILE, overlook: { x: ov.c0 * TILE, y: ov.r0 * TILE, w: (ov.c1 - ov.c0 + 1) * TILE, h: (ov.r1 - ov.r0 + 1) * TILE } };
      room.cx = room.x + room.w / 2; room.cy = room.y + room.h / 2;
      room.site = this.siteAt(room.overlook.x + room.overlook.w / 2, room.overlook.y + room.overlook.h / 2);
      return room;
    });
    this.stairs = (def.stairs || []).map(s => {
      const r = this._rect(s.rect);
      return { ...r, x: r.c0 * TILE, y: r.r0 * TILE, w: (r.c1 - r.c0 + 1) * TILE, h: (r.r1 - r.r0 + 1) * TILE, up: { x: (s.up[0] + 0.5) * TILE, y: (s.up[1] + 0.5) * TILE }, down: { x: (s.down[0] + 0.5) * TILE, y: (s.down[1] + 0.5) * TILE } };
    });
    this._ground = null; this._groundScale = 0; this._blocks = null;
  }
  // 静态地面一次性烘焙到离屏画布，每帧单 blit（大幅提帧）
  // 烘焙倍率跟随显示倍率，否则高分屏下地板会被放大成锯齿块；
  // 面积上限 9M 像素：96×72 大图取 1×，避免多张 bake 同时存活超出浏览器 canvas 内存预算导致上下文被回收（整屏变透明）
  bakeGround(scale = 1) {
    const W = this.w + this.h, H = (this.w + this.h) / 2 + TILE * 2;
    const bs = Math.max(1, Math.min(3, Math.round(scale), Math.floor(Math.sqrt(9e6 / (W * H)))));
    if (this._ground && this._groundScale === bs) return;
    if (this._ground) { this._ground.width = 0; this._ground.height = 0; }
    const c = document.createElement('canvas'); c.width = W * bs; c.height = H * bs;
    const r = new Renderer(c); r.scale = bs; r.begin();
    r.ctx.fillStyle = '#332e26'; r.ctx.fillRect(0, 0, W, H);
    const cam = { x: -this.h, y: 0, zoom: 1, worldToScreen: (x, y, z = 0) => [(x - y) + this.h, (x + y) / 2 - z] };
    this.renderGround(r, cam);
    this._ground = c; this._groundScale = bs;
  }
  blitGround(g, cam) {
    this.bakeGround(g.scale);
    const bs = this._groundScale;
    const vw = VIEW_W / (cam.zoom || 1), vh = VIEW_H / (cam.zoom || 1);
    const ctx = g.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this._ground, (cam.x + this.h) * bs, cam.y * bs, vw * bs, vh * bs, 0, 0, vw, vh);
    ctx.imageSmoothingEnabled = false;
  }
  heightAt(x, y, level = 0) {
    if (level === 1) return this.inUpper(x, y) ? 0 : WALL_H;
    const t = this.tile(Math.floor(x / TILE), Math.floor(y / TILE));
    return t === WALL ? WALL_H : PROP_H[t] || (t === CRATE ? CRATE_H : 0);
  }
  inUpper(x, y) { return this.upper.some(u => x >= u.x && x < u.x + u.w && y >= u.y && y < u.y + u.h); }
  upperAt(x, y) { return this.upper.find(u => x >= u.x && x < u.x + u.w && y >= u.y && y < u.y + u.h) || null; }
  upperTile(c, r) { const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE; return this.inUpper(x, y); }
  stairAt(x, y) { return this.stairs.find(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) || null; }
  // 跨层射击：二楼俯视野（overlook）内的地面目标可互射，其余跨层不可
  crossOverlook(a, b) {
    const hi = a.level === 1 ? a : b.level === 1 ? b : null;
    const lo = hi === a ? b : a;
    if (!hi || hi.level !== 1 || lo.level !== 0) return false;
    const room = this.upperAt(hi.x, hi.y);
    if (!room) return false;
    const ov = room.overlook;
    return lo.x >= ov.x && lo.x < ov.x + ov.w && lo.y >= ov.y && lo.y < ov.y + ov.h;
  }
  _rect(a) { return { c0: a[0], r0: a[1], c1: a[2], r1: a[3] }; }
  inB(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  _site(a) { const x = a[0] * TILE, y = a[1] * TILE, w = (a[2] - a[0] + 1) * TILE, h = (a[3] - a[1] + 1) * TILE; return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }; }
  tile(c, r) { return this.inB(c, r) ? this.grid[r][c] : WALL; }
  solid(c, r) { return SOLID.has(this.tile(c, r)); }
  // 仙人掌与水面不挡视线（水挡移动）
  opaque(c, r) { const t = this.tile(c, r); return SOLID.has(t) && t !== CACTUS && t !== WATER; }
  solidL(c, r, level = 0) { return level === 1 ? !this.upperTile(c, r) : this.solid(c, r); }
  // 二楼居高临下：楼板外是开阔上空，视线/子弹不被下层墙与栏杆遮挡
  opaqueL(c, r, level = 0) { return level === 1 ? false : this.opaque(c, r); }
  walkable(c, r) { return this.inB(c, r) && !this.solid(c, r); }
  walkableL(c, r, level = 0) { return level === 1 ? this.upperTile(c, r) : this.walkable(c, r); }
  siteAt(x, y) { for (const k of Object.keys(this.sites)) { const s = this.sites[k]; if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return k; } return null; }
  spawns(team, count) {
    const sr = this.spawnRects[team]; const pts = [];
    const cy = (sr.r0 + sr.r1 + 1) / 2 * TILE;
    const width = sr.c1 - sr.c0 + 1;
    for (let i = 0; i < count; i++) { const t = (i + 0.5) / count; pts.push({ x: (sr.c0 + width * t) * TILE, y: cy }); }
    return pts;
  }
  nearestWalkable(c, r, level = 0) {
    if (this.walkableL(c, r, level)) return { c, r };
    for (let rad = 1; rad < 8; rad++)
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++)
          if (this.walkableL(c + dc, r + dr, level)) return { c: c + dc, r: r + dr };
    return { c, r };
  }
  // 等距地面 pass：diamond tiles + 调色板 dither + 方向光软阴影
  renderGround(g, cam) {
    const T = TILE;
    const ctx = g.ctx;
    const dia = (sx, sy, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + T, sy + T / 2); ctx.lineTo(sx, sy + T); ctx.lineTo(sx - T, sy + T / 2); ctx.closePath(); ctx.fill(); };
    const FL = this.theme.floor;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      if (this.opaque(c, r)) continue;
      const sx = (c - r) * T - cam.x, sy = (c + r) * T / 2 - cam.y;
      const t = this.grid[r][c];
      const hsh = (c * 7 + r * 13) % 7;
      dia(sx, sy, (c + r) & 1 ? FL[1] : FL[2]);
      if (hsh === 0) dia(sx - 4, sy + 2, FL[0]);
      else if (hsh === 2) { ctx.fillStyle = FL[3]; ctx.fillRect(sx - 3, sy + T / 2 - 1, 2, 2); ctx.fillRect(sx + 2, sy + T / 2 + 1, 2, 2); }
      else if (hsh === 3) { ctx.fillStyle = FL[3]; ctx.fillRect(sx - 4, sy + T / 2, 6, 1); }
      else if (hsh === 1) { ctx.fillStyle = FL[4]; ctx.fillRect(sx + 1, sy + T / 2 - 2, 1, 1); }
      if (t === WATER) {
        dia(sx, sy, '#3a6a8e');
        ctx.fillStyle = 'rgba(200,230,245,0.35)';
        ctx.fillRect(sx - 5 + ((c * 5 + r * 3) % 6), sy + T / 2 - 1, 4, 1);
        ctx.fillRect(sx - 2 + ((c * 3 + r * 7) % 5), sy + T / 2 + 3, 3, 1);
      } else if (t === GRASS) {
        ctx.fillStyle = '#3c5630';
        for (let i = 0; i < 3; i++) ctx.fillRect(sx - 4 + i * 4, sy + T / 2 - 3 - (i % 2), 1, 4);
        ctx.fillStyle = '#7fa060';
        ctx.fillRect(sx - 4, sy + T / 2 - 3, 1, 3); ctx.fillRect(sx + 4, sy + T / 2 - 4, 1, 3);
      } else if (t === SNOWDRIFT) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.arc(sx, sy + T / 2, 5, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(200,215,230,0.6)';
        ctx.beginPath(); ctx.arc(sx + 3, sy + T / 2, 3, Math.PI, 0); ctx.closePath(); ctx.fill();
      }
      if (this.solid(c, r - 1) || this.solid(c - 1, r)) {
        ctx.save(); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + T, sy + T / 2); ctx.lineTo(sx, sy + T); ctx.lineTo(sx - T, sy + T / 2); ctx.closePath(); ctx.clip();
        const gr = ctx.createLinearGradient(sx, sy, sx, sy + T); gr.addColorStop(0, 'rgba(20,14,8,0.35)'); gr.addColorStop(1, 'rgba(20,14,8,0)');
        ctx.fillStyle = gr; ctx.fillRect(sx - T, sy, T * 2, T); ctx.restore();
      }
      if (t === SITE_A) dia(sx, sy, 'rgba(184,86,63,0.22)');
      else if (t === SITE_B) dia(sx, sy, 'rgba(63,127,184,0.22)');
      else if (t === SITE_C) dia(sx, sy, 'rgba(127,206,127,0.22)');
      else if (t === SPAWN_T) dia(sx, sy, 'rgba(207,143,79,0.14)');
      else if (t === SPAWN_CT) dia(sx, sy, 'rgba(79,143,206,0.14)');
    }
    for (const k of Object.keys(this.sites)) {
      const s = this.sites[k];
      const [nx, ny] = cam.worldToScreen(s.x, s.y);
      const [ex, ey] = cam.worldToScreen(s.x + s.w, s.y);
      const [sx2, sy2] = cam.worldToScreen(s.x + s.w, s.y + s.h);
      const [wx2, wy2] = cam.worldToScreen(s.x, s.y + s.h);
      const col = SITE_COL[k];
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(ex, ey); ctx.lineTo(sx2, sy2); ctx.lineTo(wx2, wy2); ctx.closePath(); ctx.stroke();
      const [cx2, cy2] = cam.worldToScreen(s.cx, s.cy);
      g.text(k, cx2, cy2, { color: col, size: 22, align: 'center', baseline: 'middle', bold: true });
    }
    for (const s of this.stairs) {
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = cam.worldToScreen(s.x + s.w * (i + 0.5) / 3, s.y + s.h / 2);
        ctx.fillStyle = i === 1 ? '#8a7452' : '#6a563c';
        ctx.fillRect(ax - 3, ay - 1 + i, 6, 2);
      }
      const [mx, my] = cam.worldToScreen(s.x + s.w / 2, s.y + s.h / 2);
      g.text('楼梯', mx, my - 6, { color: 'rgba(242,234,216,0.45)', size: 5, font: '"Microsoft YaHei", sans-serif' });
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
        if (SOLID.has(t)) this._blocks.push({ c, r, t, depth: (c + r + 1) * T });
      }
    }
    const list = [];
    const iz = 1 / (cam.zoom || 1);
    for (const b of this._blocks) {
      const sx = (b.c - b.r) * T - cam.x, sy = (b.c + b.r) * T / 2 - cam.y;
      if (sx < -T * 2 || sx > VIEW_W * iz + T * 2 || sy < -T * 3 || sy > VIEW_H * iz + T * 2) continue;
      list.push(b);
    }
    return list;
  }
  // 等距立体块：top diamond + 左/右面 + 方向光 + selout + 软阴影
  drawBlock(g, cam, c, r, t) {
    const T = TILE; const ctx = g.ctx;
    if (t === WATER) return; // 水面是地面装饰，不挤出
    if (t === ROCK || t === BARREL || t === SANDBAG || t === CACTUS) return this._drawProp(g, cam, c, r, t);
    const H = t === WALL ? WALL_H : CRATE_H;
    const sx = (c - r) * T - cam.x, sy = (c + r) * T / 2 - cam.y;
    const n = this.solid(c, r - 1), e = this.solid(c + 1, r), s = this.solid(c, r + 1), w = this.solid(c - 1, r);
    ctx.fillStyle = 'rgba(20,14,8,0.28)';
    ctx.beginPath(); ctx.moveTo(sx, sy + 2); ctx.lineTo(sx + T, sy + T / 2 + 2); ctx.lineTo(sx, sy + T + 2); ctx.lineTo(sx - T, sy + T / 2 + 2); ctx.closePath(); ctx.fill();
    const WT = this.theme.wallTop, WF = this.theme.wallFace;
    const top = t === WALL ? WT : this.theme.wood;
    const faceL = t === WALL ? WF[0] : this.theme.wood[2];
    const faceR = t === WALL ? WF[2] : this.theme.wood[3];
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
  // 沙漠障碍：砂岩巨石 / 锈桶 / 沙袋 / 仙人掌（仙人掌挡移动不挡视线）
  _drawProp(g, cam, c, r, t) {
    const T = TILE; const ctx = g.ctx;
    const sx = (c - r) * T - cam.x, sy = (c + r) * T / 2 - cam.y;
    const H = PROP_H[t];
    ctx.fillStyle = 'rgba(20,14,8,0.26)';
    ctx.beginPath(); ctx.moveTo(sx, sy + 2); ctx.lineTo(sx + T, sy + T / 2 + 2); ctx.lineTo(sx, sy + T + 2); ctx.lineTo(sx - T, sy + T / 2 + 2); ctx.closePath(); ctx.fill();
    const dia = (h, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx, sy - h); ctx.lineTo(sx + T, sy + T / 2 - h); ctx.lineTo(sx, sy + T - h); ctx.lineTo(sx - T, sy + T / 2 - h); ctx.closePath(); ctx.fill(); };
    const faces = (h, cl, cr) => {
      ctx.fillStyle = cl; ctx.beginPath(); ctx.moveTo(sx - T, sy + T / 2 - h); ctx.lineTo(sx, sy + T - h); ctx.lineTo(sx, sy + T); ctx.lineTo(sx - T, sy + T / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = cr; ctx.beginPath(); ctx.moveTo(sx, sy + T - h); ctx.lineTo(sx + T, sy + T / 2 - h); ctx.lineTo(sx + T, sy + T / 2); ctx.lineTo(sx, sy + T); ctx.closePath(); ctx.fill();
    };
    if (t === ROCK) {
      const rk = this.theme.rock;
      faces(H, rk.l, rk.r); dia(H, rk.top);
      ctx.strokeStyle = rk.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx - T / 2, sy + T / 4 - H); ctx.lineTo(sx, sy - H + 2); ctx.lineTo(sx + T / 2, sy + T / 4 - H); ctx.stroke();
      ctx.strokeStyle = this.theme.wallTop[3]; ctx.beginPath(); ctx.moveTo(sx - 3, sy + T / 2 - H + 3); ctx.lineTo(sx + 2, sy + T / 2 - H + 6); ctx.stroke();
    } else if (t === BARREL) {
      faces(H, '#6e3a26', '#5a2e1e'); dia(H, '#a05a3c');
      ctx.strokeStyle = '#4a2418'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx - T, sy + T / 2 - H + 3); ctx.lineTo(sx, sy + T - H + 3); ctx.lineTo(sx + T, sy + T / 2 - H + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - T, sy + T / 2 - 2); ctx.lineTo(sx, sy + T - 2); ctx.lineTo(sx + T, sy + T / 2 - 2); ctx.stroke();
      ctx.strokeStyle = '#c07a50'; ctx.beginPath(); ctx.moveTo(sx - T / 2, sy + T / 4 - H); ctx.lineTo(sx + T / 2, sy + 3 * T / 4 - H); ctx.stroke();
    } else if (t === SANDBAG) {
      const bg = this.theme.bag;
      faces(H, bg.l, bg.r); dia(H, bg.top);
      ctx.strokeStyle = bg.line; ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(sx + i * 5, sy + T / 2 - H + 2, 2.4, 0, Math.PI); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(sx - T, sy + T / 2 - 1); ctx.lineTo(sx, sy + T - 1); ctx.lineTo(sx + T, sy + T / 2 - 1); ctx.stroke();
    } else {
      ctx.fillStyle = '#426836'; ctx.fillRect(sx - 2, sy + T / 2 - 11, 4, 11);
      ctx.fillStyle = '#5a8a4a'; ctx.fillRect(sx - 2, sy + T / 2 - 11, 2, 11);
      ctx.fillStyle = '#426836'; ctx.fillRect(sx - 6, sy + T / 2 - 8, 4, 2); ctx.fillRect(sx - 6, sy + T / 2 - 10, 2, 4);
      ctx.fillRect(sx + 2, sy + T / 2 - 6, 4, 2); ctx.fillRect(sx + 4, sy + T / 2 - 9, 2, 5);
      ctx.fillStyle = '#7aa862'; ctx.fillRect(sx - 2, sy + T / 2 - 11, 1, 10);
    }
  }
  // 二楼楼板：高架地面 + 护栏 + 支柱 + 楼梯踏步；玩家在下层时半透明ghost
  drawUpper(g, cam, room, alpha) {
    const T = TILE; const ctx = g.ctx;
    const TH = this.theme;
    ctx.save(); ctx.globalAlpha = alpha;
    for (const [px, py] of [[room.x, room.y], [room.x + room.w, room.y], [room.x, room.y + room.h], [room.x + room.w, room.y + room.h]]) {
      const [sx, sy] = cam.worldToScreen(px, py);
      ctx.fillStyle = TH.wallFace[1]; ctx.fillRect(sx - 2, sy - UP_H, 4, UP_H);
      ctx.fillStyle = TH.wallFace[0]; ctx.fillRect(sx - 2, sy - UP_H, 1, UP_H);
    }
    for (let r = room.r0; r <= room.r1; r++) for (let c = room.c0; c <= room.c1; c++) {
      const sx = (c - r) * T - cam.x, sy = (c + r) * T / 2 - cam.y - UP_H;
      ctx.fillStyle = (c + r) & 1 ? TH.upper[0] : TH.upper[1];
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + T, sy + T / 2); ctx.lineTo(sx, sy + T); ctx.lineTo(sx - T, sy + T / 2); ctx.closePath(); ctx.fill();
      if ((c * 7 + r * 13) % 7 === 0) { ctx.fillStyle = TH.upper[0]; ctx.fillRect(sx - 3, sy + T / 2 - 1, 3, 1); }
      const edge = c === room.c0 || c === room.c1 || r === room.r0 || r === room.r1;
      if (edge && !this.stairAt((c + 0.5) * T, (r + 0.5) * T)) {
        const h = 5;
        ctx.fillStyle = TH.wallTop[3]; ctx.beginPath(); ctx.moveTo(sx - T, sy + T / 2 - h); ctx.lineTo(sx, sy + T - h); ctx.lineTo(sx, sy + T); ctx.lineTo(sx - T, sy + T / 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = TH.wallFace[1]; ctx.beginPath(); ctx.moveTo(sx, sy + T - h); ctx.lineTo(sx + T, sy + T / 2 - h); ctx.lineTo(sx + T, sy + T / 2); ctx.lineTo(sx, sy + T); ctx.closePath(); ctx.fill();
        ctx.fillStyle = TH.wallTop[1]; ctx.beginPath(); ctx.moveTo(sx, sy - h); ctx.lineTo(sx + T, sy + T / 2 - h); ctx.lineTo(sx, sy + T - h); ctx.lineTo(sx - T, sy + T / 2 - h); ctx.closePath(); ctx.fill();
      }
    }
    for (const s of this.stairs) {
      if (s.up.x < room.x || s.up.x >= room.x + room.w || s.up.y < room.y || s.up.y >= room.y + room.h) continue;
      for (let i = 0; i < 3; i++) {
        const t = (i + 1) / 3;
        const wx = s.down.x + (s.up.x - s.down.x) * t, wy = s.down.y + (s.up.y - s.down.y) * t;
        const [sx, sy] = cam.worldToScreen(wx, wy);
        const h = UP_H * t;
        ctx.fillStyle = TH.wallTop[2]; ctx.fillRect(sx - 5, sy - h, 10, 3);
        ctx.fillStyle = TH.wallTop[3]; ctx.fillRect(sx - 5, sy - h + 3, 10, h);
      }
    }
    ctx.restore();
  }
}
