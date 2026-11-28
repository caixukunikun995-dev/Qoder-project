import { VIEW_W, VIEW_H, COLORS, TEAM } from '../config.js';
const CJK = '"Microsoft YaHei", sans-serif';

function fmt(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; }

function avatar(g, game, a, x, y) {
  const col = a.team === TEAM.CT ? COLORS.ct : COLORS.t;
  g.text(a.isPlayer ? '你' : a.name, x, y - 6, { color: a.alive ? COLORS.text : COLORS.dim, size: 5, font: CJK });
  g.rect(x, y, 10, 12, a.alive ? col : 'rgba(40,44,52,0.9)');
  if (!a.alive) { g.line(x + 2, y + 2, x + 8, y + 10, 'rgba(224,90,90,0.8)', 1); g.line(x + 2, y + 10, x + 8, y + 2, 'rgba(224,90,90,0.8)', 1); }
  if (a.isPlayer) g.stroke(x - 0.5, y - 0.5, 11, 13, '#ffffff', 1);
  g.rect(x, y + 13, 18, 2, 'rgba(255,255,255,0.15)');
  g.rect(x, y + 13, 18 * (a.hp / a.maxHp), 2, col);
  g.text(`${Math.ceil(a.hp)}`, x, y + 16, { color: a.alive ? (a.hp > 25 ? COLORS.good : COLORS.bad) : COLORS.dim, size: 5 });
}

function healthIcon(g, x, y, c) { g.rect(x + 3, y, 3, 9, c); g.rect(x, y + 3, 9, 3, c); }
function shieldIcon(g, x, y, c) { const q = g.ctx; q.fillStyle = c; q.fillRect(x, y, 9, 5); q.beginPath(); q.moveTo(x, y + 5); q.lineTo(x + 4.5, y + 9); q.lineTo(x + 9, y + 5); q.closePath(); q.fill(); }
function vestIcon(g, x, y, c) { g.rect(x, y + 1, 8, 7, c); g.rect(x + 2, y, 4, 2, c); }
function helmIcon(g, x, y, c) { const q = g.ctx; q.fillStyle = c; q.beginPath(); q.arc(x + 4, y + 4, 4, Math.PI, 0); q.closePath(); q.fill(); q.fillRect(x, y + 4, 8, 2); }
function kitIcon(g, x, y, c) { g.line(x, y, x + 7, y + 7, c, 1.5); g.line(x + 7, y, x, y + 7, c, 1.5); }

function weaponIcon(g, x, y, def) {
  const c = '#d8d8dc'; const id = def.id; const cat = def.cat;
  if (cat === 'melee') { g.rect(x + 10, y + 6, 16, 3, c); g.rect(x + 6, y + 6, 4, 5, '#8a8f98'); const q = g.ctx; q.fillStyle = c; q.beginPath(); q.moveTo(x + 26, y + 6); q.lineTo(x + 31, y + 7.5); q.lineTo(x + 26, y + 9); q.closePath(); q.fill(); }
  else if (cat === 'pistol' || id === 'zeus') { g.rect(x + 12, y + 4, 12, 4, c); g.rect(x + 13, y + 8, 4, 5, c); }
  else if (id === 'awp' || id === 'ssg08') { g.rect(x + 2, y + 6, 30, 3, c); g.rect(x + 12, y + 2, 8, 3, c); g.rect(x + 16, y + 9, 4, 5, c); g.rect(x, y + 5, 4, 5, c); }
  else if (id === 'xm1014') { g.rect(x + 4, y + 6, 24, 3, c); g.rect(x + 12, y + 9, 7, 3, c); g.rect(x + 2, y + 5, 4, 5, c); }
  else if (cat === 'mid') { g.rect(x + 6, y + 5, 20, 4, c); g.rect(x + 26, y + 6, 6, 2, c); g.rect(x + 12, y + 9, 4, 6, c); g.rect(x + 2, y + 4, 4, 6, c); }
  else { g.rect(x + 4, y + 5, 22, 4, c); g.rect(x + 26, y + 6, 8, 2, c); g.rect(x + 12, y + 9, 4, 6, c); g.rect(x, y + 4, 4, 6, c); g.rect(x + 16, y + 2, 4, 3, c); }
}

function nadeIcon(g, x, y, id, c) {
  if (id === 'he') g.circle(x + 4, y + 5, 4, c);
  else if (id === 'fire') { g.rect(x + 2, y + 3, 5, 7, c); g.rect(x + 3, y + 1, 3, 2, c); }
  else if (id === 'flash') { g.rect(x + 2, y + 2, 5, 8, c); g.rect(x + 1, y + 4, 7, 2, c); }
  else { g.rect(x + 2, y + 1, 5, 9, c); g.rect(x + 3, y, 3, 2, c); }
}

export function drawHUD(g, game) {
  const p = game.player;
  g.rect(150, 4, 180, 18, 'rgba(10,12,16,0.8)'); g.stroke(150, 4, 180, 18, 'rgba(255,255,255,0.15)');
  g.text(`${game.scores.CT}`, 192, 7, { align: 'center', color: COLORS.ct, size: 12, bold: true });
  g.text(`${game.scores.T}`, 302, 7, { align: 'center', color: COLORS.t, size: 12, bold: true });
  let label, lc = COLORS.text;
  if (game.state === 'buy') { label = fmt(Math.max(0, game.stateT)); lc = COLORS.money; }
  else if (game.bomb && game.bomb.state === 'planted' && game.state === 'live') { label = fmt(Math.max(0, game.bomb.timer)); lc = COLORS.bad; }
  else label = fmt(Math.max(0, game.stateT));
  g.text(label, 240, 7, { align: 'center', color: lc, size: 12, bold: true });
  if (game.bomb && game.bomb.state === 'planted' && game.state === 'live') g.circle(222, 13, 2.5, COLORS.bad);
  const cts = game.actors.filter(a => a.team === TEAM.CT);
  const ts = game.actors.filter(a => a.team === TEAM.T);
  cts.forEach((a, i) => avatar(g, game, a, 88 + i * 20, 6));
  ts.forEach((a, i) => avatar(g, game, a, 332 + i * 20, 6));
  g.text(`回合 ${game.round} · ${game.format.name}${game.ot ? ' · 加时' + game.otBlock : ''}`, 240, 25, { align: 'center', color: COLORS.dim, size: 6, font: CJK });

  g.text(`$${p.money}`, 10, VIEW_H - 56, { color: COLORS.money, size: 10, bold: true });
  const hpCol = p.hp > 25 ? '#ffffff' : COLORS.bad;
  healthIcon(g, 12, VIEW_H - 42, hpCol);
  g.text(`${Math.ceil(p.hp)}`, 26, VIEW_H - 45, { color: hpCol, size: 14, bold: true });
  g.rect(26, VIEW_H - 30, 60, 2, 'rgba(255,255,255,0.15)');
  g.rect(26, VIEW_H - 30, 60 * (p.hp / 100), 2, hpCol);
  const arCol = p.armor > 0 ? '#ffffff' : 'rgba(255,255,255,0.35)';
  shieldIcon(g, 12, VIEW_H - 22, arCol);
  g.text(`${Math.ceil(p.armor)}`, 26, VIEW_H - 25, { color: arCol, size: 14, bold: true });
  if (p.helmet) helmIcon(g, 60, VIEW_H - 22, '#cfcfd4');
  else if (p.armor > 0) vestIcon(g, 60, VIEW_H - 22, '#cfcfd4');
  if (p.kit) kitIcon(g, 74, VIEW_H - 21, '#9fd08a');

  const owned = ['he', 'flash', 'smoke', 'fire', 'decoy'].filter(n => p.nades[n] > 0);
  let nx = VIEW_W - 12;
  for (const n of owned.reverse()) {
    const sel = n === game.nadeSel;
    if (sel) g.rect(nx - 12, VIEW_H - 56, 14, 14, 'rgba(90,160,255,0.3)');
    nadeIcon(g, nx - 10, VIEW_H - 54, n, sel ? '#ffffff' : '#b9b9bf');
    g.text(`${p.nades[n]}`, nx - 2, VIEW_H - 45, { align: 'right', color: COLORS.dim, size: 6 });
    nx -= 16;
  }
  if (owned.length) g.text('按住 G 蓄力投掷 · H 换雷', VIEW_W - 10, VIEW_H - 64, { align: 'right', color: COLORS.dim, size: 6, font: CJK });
  const def = p.curDef();
  g.text(def.name, VIEW_W - 10, VIEW_H - 38, { align: 'right', color: COLORS.dim, size: 7, font: CJK });
  weaponIcon(g, VIEW_W - 78, VIEW_H - 28, def);
  const w = p.cur();
  if (def.cat === 'melee') {
    g.text('近战', VIEW_W - 34, VIEW_H - 26, { align: 'right', color: '#ffffff', size: 12, font: CJK });
  } else if (p.reloadT > 0) {
    g.text('换弹', VIEW_W - 34, VIEW_H - 26, { align: 'right', color: COLORS.dim, size: 12, font: CJK });
    g.rect(VIEW_W - 70, VIEW_H - 12, 60, 2, 'rgba(255,255,255,0.15)');
    g.rect(VIEW_W - 70, VIEW_H - 12, 60 * (1 - p.reloadT / def.reload), 2, COLORS.player);
  } else {
    g.text(`${w.mag}`, VIEW_W - 34, VIEW_H - 27, { align: 'right', color: '#ffffff', size: 15, bold: true });
    g.text(`/ ${w.reserve}`, VIEW_W - 8, VIEW_H - 22, { align: 'right', color: COLORS.dim, size: 9 });
  }

  if (!p.alive && game.state === 'live') g.text('观战中', VIEW_W / 2, VIEW_H - 40, { align: 'center', color: COLORS.dim, size: 8, font: CJK });
}
