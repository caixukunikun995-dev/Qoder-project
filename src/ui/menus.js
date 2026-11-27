import { VIEW_W, VIEW_H, COLORS, TEAM, TIMING } from '../config.js';
import { VERSION, CHANGELOG, STUDIO } from '../version.js';
import { MAPS } from '../world/maps.js';
const CJK = '"Microsoft YaHei", sans-serif';

export function drawCoverBackground(g) {
  const bands = ['#20293f', '#2c3a57', '#4a4a68', '#8a5a62', '#c97a4a'];
  const bh = [40, 36, 34, 34, 30]; let y = 0;
  for (let i = 0; i < bands.length; i++) { g.rect(0, y, VIEW_W, bh[i], bands[i]); y += bh[i]; }
  g.circle(352, 64, 22, '#f2c069'); g.circle(352, 64, 16, '#f7d78a');
  g.rect(0, 150, VIEW_W, 20, '#6e4a3a');
  for (let x = 0; x < VIEW_W; x += 40) g.circle(x + 20, 152, 14, '#6e4a3a');
  g.rect(0, 168, VIEW_W, VIEW_H - 168, '#4a3628');
  g.rect(0, 168, VIEW_W, 3, '#5a4433');
  _soldier(g, 120, 150, '#2f5f8e', '#4f8fce', 1);
  _soldier(g, 352, 152, '#8e5f2f', '#cf8f4f', -1);
  for (let yy = 0; yy < VIEW_H; yy += 3) g.rect(0, yy, VIEW_W, 1, 'rgba(0,0,0,0.06)');
}
function _soldier(g, x, y, dark, base, dir) {
  g.rect(x - 5, y + 10, 4, 12, dark); g.rect(x + 1, y + 10, 4, 12, dark);
  g.rect(x - 6, y - 6, 12, 18, base); g.rect(x - 6, y - 6, 12, 4, dark);
  g.circle(x, y - 11, 5, dark); g.circle(x + dir, y - 11, 3, base);
  g.rect(dir > 0 ? x + 4 : x - 16, y - 2, 12, 3, '#26262a');
  g.rect(dir > 0 ? x + 14 : x - 18, y - 3, 4, 2, '#26262a');
}

const hover = (game, b) => game.input.mouse.x >= b.x && game.input.mouse.x <= b.x + b.w && game.input.mouse.y >= b.y && game.input.mouse.y <= b.y + b.h;
function button(g, game, b, label, size = 11, accent = false) {
  const h = hover(game, b);
  g.rect(b.x, b.y, b.w, b.h, h ? 'rgba(255,255,255,0.16)' : COLORS.panel);
  g.stroke(b.x, b.y, b.w, b.h, h || accent ? COLORS.player : COLORS.panelLine);
  g.text(label, b.x + b.w / 2, b.y + b.h / 2, { align: 'center', baseline: 'middle', color: COLORS.text, size, font: CJK });
}

export function mainMenuLayout() {
  const w = 180, h = 22, x = (VIEW_W - w) / 2;
  return [
    { id: 'start', label: '开始匹配', x, y: 138, w, h },
    { id: 'about', label: '关于游戏', x, y: 166, w, h },
    { id: 'exit', label: '退出游戏', x, y: 194, w, h },
  ];
}
export function drawTitle(g, game) {
  game.drawBackground(g);
  g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,12,16,0.35)');
  g.text('CS RUSH', VIEW_W / 2, 52, { align: 'center', color: COLORS.text, size: 40, bold: true });
  g.text('轻量战术射击 · 维护时来一局', VIEW_W / 2, 100, { align: 'center', color: COLORS.player, size: 11, font: CJK });
  for (const b of mainMenuLayout()) button(g, game, b, b.label);
  g.text(`v${VERSION} · ${STUDIO.event}`, VIEW_W / 2, 246, { align: 'center', color: COLORS.dim, size: 7, font: CJK });
}

export function mapSelectLayout() {
  return {
    cards: [
      { id: 'dust2', x: 28, y: 56, w: 200, h: 110 },
      { id: 'mirage', x: 252, y: 56, w: 200, h: 110 },
    ],
    format: { x: 150, y: 176, w: 180, h: 18 },
    confirm: { x: 150, y: 198, w: 180, h: 20 },
    back: { x: 150, y: 222, w: 180, h: 16 },
  };
}
function drawMapThumb(g, def, x, y, w, h) {
  g.rect(x, y, w, h, '#2b303b');
  const sx = w / def.cols, sy = h / def.rows;
  g.rect(x + 29 * sx, y, 6 * sx, h, 'rgba(255,255,255,0.06)');
  for (const k of ['A', 'B']) {
    const a = def.sites[k];
    g.rect(x + a[0] * sx, y + a[1] * sy, (a[2] - a[0] + 1) * sx, (a[3] - a[1] + 1) * sy, k === 'A' ? 'rgba(184,86,63,0.55)' : 'rgba(63,127,184,0.55)');
  }
  for (const t of ['T', 'CT']) {
    const a = def.spawns[t];
    g.rect(x + a[0] * sx, y + a[1] * sy, (a[2] - a[0] + 1) * sx, (a[3] - a[1] + 1) * sy, t === 'T' ? 'rgba(207,143,79,0.5)' : 'rgba(79,143,206,0.5)');
  }
  g.stroke(x, y, w, h, COLORS.panelLine);
}
export function drawMapSelect(g, game) {
  game.drawBackground(g);
  g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,12,16,0.62)');
  g.text('选择地图与赛制', VIEW_W / 2, 28, { align: 'center', color: COLORS.text, size: 16, bold: true, font: CJK });
  const L = mapSelectLayout();
  for (const c of L.cards) {
    const def = MAPS[c.id]; const sel = game.selMap === c.id; const h = hover(game, c);
    g.rect(c.x, c.y, c.w, c.h, COLORS.panel);
    g.stroke(c.x, c.y, c.w, c.h, sel ? COLORS.player : (h ? COLORS.panelLine : 'rgba(255,255,255,0.1)'));
    drawMapThumb(g, def, c.x + 8, c.y + 8, c.w - 16, 56);
    g.text(def.name, c.x + c.w / 2, c.y + 72, { align: 'center', color: sel ? COLORS.player : COLORS.text, size: 11, font: CJK, bold: true });
    g.text(def.subtitle, c.x + c.w / 2, c.y + 88, { align: 'center', color: COLORS.dim, size: 8, font: CJK });
  }
  button(g, game, L.format, `赛制：${game.selFormat.name}`, 9);
  button(g, game, L.confirm, '确认并匹配', 10, true);
  button(g, game, L.back, '返回', 9);
}

export function drawMatching(g, game) {
  game.drawBackground(g);
  g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,12,16,0.7)');
  const dots = '.'.repeat(1 + Math.floor(game.time * 2) % 3);
  g.text(`正在匹配中${dots}`, VIEW_W / 2, 110, { align: 'center', color: COLORS.text, size: 16, bold: true, font: CJK });
  g.text(`(${Math.floor(game.matchElapsed)}s)`, VIEW_W / 2, 134, { align: 'center', color: COLORS.player, size: 12 });
  g.text(`${MAPS[game.rematch ? game.mapId : game.selMap].name} · ${(game.rematch ? game.format : game.selFormat).name}`, VIEW_W / 2, 156, { align: 'center', color: COLORS.dim, size: 9, font: CJK });
  g.text('Esc 取消', VIEW_W / 2, 200, { align: 'center', color: COLORS.dim, size: 7, font: CJK });
}

export function drawLoading(g, game) {
  game.drawBackground(g);
  g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,12,16,0.45)');
  g.text(MAPS[game.mapId].name, VIEW_W / 2, 110, { align: 'center', color: COLORS.text, size: 20, bold: true, font: CJK });
  g.text('加载地图…', VIEW_W / 2, 140, { align: 'center', color: COLORS.dim, size: 9, font: CJK });
  const w = 240, x = (VIEW_W - w) / 2, y = 170;
  g.rect(x, y, w, 6, 'rgba(0,0,0,0.5)');
  g.rect(x, y, w * Math.min(1, game.loadT / TIMING.loading), 6, COLORS.player);
}

export function overtimeLayout() {
  return { yes: { x: 120, y: 152, w: 110, h: 24 }, no: { x: 250, y: 152, w: 110, h: 24 } };
}
export function drawOvertime(g, game) {
  g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,12,16,0.72)');
  g.rect(90, 70, 300, 120, COLORS.panel); g.stroke(90, 70, 300, 120, COLORS.panelLine);
  g.text(`比分 CT ${game.scores.CT} : ${game.scores.T} T · 平局`, VIEW_W / 2, 84, { align: 'center', color: COLORS.text, size: 12, font: CJK, bold: true });
  g.text('是否进入加时赛？', VIEW_W / 2, 108, { align: 'center', color: COLORS.player, size: 14, font: CJK, bold: true });
  g.text('加时 $16000 · 攻防换边 · MR3', VIEW_W / 2, 130, { align: 'center', color: COLORS.dim, size: 8, font: CJK });
  const L = overtimeLayout();
  button(g, game, L.yes, '是 · 进入加时', 10, true);
  button(g, game, L.no, '否 · 结束比赛', 10);
}

export function matchEndLayout() {
  return { rematch: { x: 150, y: 196, w: 180, h: 20 }, exit: { x: 150, y: 220, w: 180, h: 20 } };
}
export function drawMatchEnd(g, game) {
  g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(8,10,14,0.85)');
  const w = game.matchWinner;
  const title = !w ? '平局' : (w === game.playerSide ? '胜利！' : '失败');
  const col = !w ? COLORS.dim : (w === game.playerSide ? COLORS.good : COLORS.bad);
  g.text(title, VIEW_W / 2, 18, { align: 'center', color: col, size: 22, bold: true, font: CJK });
  g.text(`最终比分 CT ${game.scores.CT} : ${game.scores.T} T`, VIEW_W / 2, 44, { align: 'center', color: COLORS.text, size: 10, font: CJK });
  const x = 70, y = 60, pw = 340, ph = 124;
  g.rect(x, y, pw, ph, 'rgba(12,14,18,0.92)'); g.stroke(x, y, pw, ph, 'rgba(255,255,255,0.15)');
  g.text('玩家', x + 24, y + 5, { color: COLORS.dim, size: 7, font: CJK });
  g.text('击杀', x + 210, y + 5, { align: 'center', color: COLORS.dim, size: 7, font: CJK });
  g.text('阵亡', x + 258, y + 5, { align: 'center', color: COLORS.dim, size: 7, font: CJK });
  g.text('金钱', x + 310, y + 5, { align: 'center', color: COLORS.dim, size: 7, font: CJK });
  const rows = [...game.actors].sort((a, b) => (a.team === b.team ? b.kills - a.kills : (a.team === 'CT' ? -1 : 1)));
  rows.forEach((a, i) => {
    const ry = y + 18 + i * 17;
    if (a.isPlayer) g.rect(x + 2, ry - 2, pw - 4, 16, 'rgba(90,160,255,0.15)');
    g.rect(x + 10, ry + 2, 8, 8, a.team === TEAM.CT ? COLORS.ct : COLORS.t);
    g.text(a.isPlayer ? '你' : a.name, x + 24, ry, { color: a.isPlayer ? COLORS.player : COLORS.text, size: 8, font: CJK });
    g.text(`${a.kills}`, x + 210, ry, { align: 'center', color: COLORS.text, size: 8 });
    g.text(`${a.deaths}`, x + 258, ry, { align: 'center', color: COLORS.dim, size: 8 });
    g.text(`$${a.money}`, x + 310, ry, { align: 'center', color: COLORS.money, size: 8 });
  });
  const L = matchEndLayout();
  button(g, game, L.rematch, '开始匹配', 11, true);
  button(g, game, L.exit, '退出游戏', 11);
}

export function aboutBack() { return { x: 150, y: 236, w: 180, h: 18 }; }
const ABOUT_STEP = { staff: 11, head: 10, note: 9, gap: 3 };
function aboutContentHeight() {
  let h = 12 + STUDIO.staff.length * ABOUT_STEP.staff + 4 + 12;
  for (const c of CHANGELOG) h += ABOUT_STEP.head + c.notes.length * ABOUT_STEP.note + ABOUT_STEP.gap;
  return h;
}
export function aboutMaxScroll() { return Math.max(0, aboutContentHeight() - 144); }
export function drawAbout(g, game) {
  const x = 50, y = 22, w = 380, h = 206;
  g.rect(x, y, w, h, COLORS.panel); g.stroke(x, y, w, h, COLORS.panelLine);
  g.text('关于游戏', x + w / 2, y + 8, { align: 'center', color: COLORS.text, size: 14, bold: true, font: CJK });
  g.text(`当前版本 v${VERSION}`, x + w / 2, y + 26, { align: 'center', color: COLORS.player, size: 10, font: CJK });
  const top = y + 40, viewH = 144;
  const max = aboutMaxScroll();
  const scroll = Math.max(0, Math.min(max, game.aboutScroll || 0));
  game.aboutScroll = scroll;
  const ctx = g.ctx;
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 1, top, w - 14, viewH); ctx.clip();
  ctx.translate(0, -scroll);
  let yy = top;
  g.text(`开发团队：${STUDIO.name}`, x + 12, yy, { color: COLORS.text, size: 8, font: CJK }); yy += 12;
  for (const s of STUDIO.staff) { g.text(`· ${s.role} — ${s.name}`, x + 16, yy, { color: COLORS.dim, size: 8, font: CJK }); yy += ABOUT_STEP.staff; }
  yy += 4;
  g.text('版本迭代', x + 12, yy, { color: COLORS.text, size: 9, font: CJK, bold: true }); yy += 12;
  for (const c of CHANGELOG) {
    g.text(`v${c.v}（${c.date}）`, x + 16, yy, { color: COLORS.player, size: 8, font: CJK }); yy += ABOUT_STEP.head;
    for (const n of c.notes) { g.text('· ' + n, x + 22, yy, { color: COLORS.dim, size: 7, font: CJK }); yy += ABOUT_STEP.note; }
    yy += ABOUT_STEP.gap;
  }
  ctx.restore();
  if (max > 0) {
    const trackH = viewH, thumbH = Math.max(12, trackH * viewH / (viewH + max));
    const thumbY = top + (trackH - thumbH) * (scroll / max);
    g.rect(x + w - 9, top, 3, trackH, 'rgba(255,255,255,0.10)');
    g.rect(x + w - 9, thumbY, 3, thumbH, 'rgba(143,211,255,0.55)');
    g.text('滚轮 / ↑↓ 浏览', x + w - 14, y + h - 12, { align: 'right', color: COLORS.dim, size: 7, font: CJK });
  }
  g.text(STUDIO.repo, x + 12, y + h - 12, { color: COLORS.dim, size: 7 });
  button(g, game, aboutBack(), '返回主菜单', 9);
}

export function exitBack() { return { x: 150, y: 180, w: 180, h: 22 }; }
export function drawExit(g, game) {
  game.drawBackground(g);
  g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,12,16,0.6)');
  g.text('感谢游玩 CS Rush', VIEW_W / 2, 90, { align: 'center', color: COLORS.text, size: 20, bold: true, font: CJK });
  g.text('浏览器不允许脚本关闭标签页，已为你停留在此。', VIEW_W / 2, 124, { align: 'center', color: COLORS.dim, size: 9, font: CJK });
  button(g, game, exitBack(), '返回主菜单', 10);
}

export function drawRoundEnd(g, game) {
  g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(8,10,14,0.35)');
  const teamCol = game.roundWinner === TEAM.CT ? COLORS.ct : COLORS.t;
  const x = 90, y = 96, w = 300, h = 70;
  g.rect(x, y, w, h, 'rgba(12,14,18,0.92)');
  g.rect(x, y, 4, h, teamCol);
  g.stroke(x, y, w, h, 'rgba(255,255,255,0.15)');
  g.text(`${game.roundWinner === TEAM.CT ? '反恐精英' : '恐怖分子'} 获胜`, x + 16, y + 10, { color: teamCol, size: 16, bold: true, font: CJK });
  g.text(game.roundReason, x + 16, y + 32, { color: COLORS.text, size: 9, font: CJK });
  g.text(`比分 CT ${game.scores.CT} : ${game.scores.T} T`, x + w - 12, y + 12, { align: 'right', color: COLORS.dim, size: 9 });
  if (game.roundMvp) g.text(`★ MVP  ${game.roundMvp.name}  (${game.roundMvp.roundKills} 击杀)`, x + 16, y + 48, { color: '#e8c060', size: 8, font: CJK });
  g.text(`下一回合 ${Math.max(0, Math.ceil(game.stateT))}s`, x + w - 12, y + 48, { align: 'right', color: COLORS.dim, size: 7, font: CJK });
}
