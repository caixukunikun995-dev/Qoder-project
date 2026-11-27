import { VIEW_W, COLORS, TILE } from '../config.js';
import { dist } from '../engine/math.js';

// CS2 风格雷达：左上角方形深色面板，玩家朝向箭头+视野锥，队友/敌人/炸弹标记
export function drawMinimap(g, game) {
  const mw = 78, mh = 60, x0 = 8, y0 = 8;
  g.rect(x0 - 2, y0 - 2, mw + 4, mh + 4, 'rgba(8,10,14,0.8)');
  g.stroke(x0 - 2, y0 - 2, mw + 4, mh + 4, 'rgba(255,255,255,0.18)');
  g.rect(x0, y0, mw, mh, 'rgba(22,26,32,0.92)');
  const sx = mw / game.map.w, sy = mh / game.map.h;
  const cw = Math.ceil(TILE * sx), ch = Math.ceil(TILE * sy);
  for (let r = 0; r < game.map.rows; r++) for (let c = 0; c < game.map.cols; c++) {
    const t = game.map.tile(c, r);
    if (t === 1 || t === 2) g.rect(x0 + c * TILE * sx, y0 + r * TILE * sy, cw, ch, 'rgba(120,124,132,0.55)');
    else if (t === 3) g.rect(x0 + c * TILE * sx, y0 + r * TILE * sy, cw, ch, 'rgba(184,86,63,0.35)');
    else if (t === 4) g.rect(x0 + c * TILE * sx, y0 + r * TILE * sy, cw, ch, 'rgba(63,127,184,0.35)');
  }
  for (const k of ['A', 'B']) {
    const s = game.map.sites[k];
    g.text(k, x0 + s.cx * sx, y0 + s.cy * sy, { color: k === 'A' ? 'rgba(232,138,111,0.9)' : 'rgba(111,168,232,0.9)', size: 8, align: 'center', baseline: 'middle', bold: true });
  }
  const ctx = g.ctx;
  const mates = game.actors.filter(a => a.alive && a.team === game.playerSide);
  for (const a of game.actors) {
    if (!a.alive) continue;
    if (a.team !== game.playerSide) {
      const spotted = mates.some(m => dist(m.x, m.y, a.x, a.y) < 260 && game.los(m.x, m.y, a.x, a.y));
      if (!spotted) continue;
    }
    const ax = x0 + a.x * sx, ay = y0 + a.y * sy;
    const col = a.isPlayer ? '#ffffff' : (a.team === game.playerSide ? COLORS.ct : '#e05a5a');
    if (a.isPlayer) {
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a.angle);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 16, -0.45, 0.45); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a.angle);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, -2.6); ctx.lineTo(-3, 2.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (game.bomb && game.bomb.state === 'planted') {
    const bx = x0 + game.bomb.x * sx, by = y0 + game.bomb.y * sy;
    const blink = Math.sin(game.time * 8) > 0;
    g.circle(bx, by, 2.4, blink ? '#ff5a5a' : '#8e2a2a');
    g.text('C4', bx, by - 5, { color: '#ff8a8a', size: 6, align: 'center', bold: true });
  }
}
