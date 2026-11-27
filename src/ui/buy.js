import { VIEW_W, VIEW_H, COLORS, WEAPONS, GEAR, NADES, TEAM, weaponsFor } from '../config.js';
import { nadePrice } from '../game/weapons.js';
const CJK = '"Microsoft YaHei", sans-serif';

const COLS = [
  { key: 'gear', title: '1 装备' },
  { key: 'pistol', title: '2 手枪' },
  { key: 'mid', title: '3 中级' },
  { key: 'rifle', title: '4 步枪' },
  { key: 'nade', title: '5 投掷物' },
];
const CW = 90, GAP = 5, X0 = 6, Y0 = 32, CH = 40;

// 与参考截图逐格对齐的物品顺序（贴图模式），避免买 AWP 得 AUG 等错位
const IMG_ORDER = {
  CT: {
    gear: ['kevlar', 'helmet', 'zeus', 'kit'],
    pistol: ['usp', 'dual', 'p250', 'fn57', 'deagle'],
    mid: ['mp5', 'xm1014', 'bizon', 'mp7', 'mp9'],
    rifle: ['famas', 'm4a4', 'm4a1s', 'awp', 'aug'],
    nade: ['flash', 'smoke', 'he', 'fire', 'decoy'],
  },
  T: {
    gear: ['kevlar', 'helmet', 'zeus'],
    pistol: ['glock', 'dual', 'p250', 'tec9', 'deagle'],
    mid: ['mp5', 'xm1014', 'bizon', 'mp7', 'mac10'],
    rifle: ['galil', 'ak47', 'awp', 'sg553', 'ssg08'],
    nade: ['flash', 'smoke', 'he', 'fire', 'decoy'],
  },
};

function colItems(game, key) {
  const side = game.playerSide;
  const imgMode = !!(game.buyPix && game.buyPix[side]);
  const ids = imgMode ? IMG_ORDER[side][key] : null;
  const nadeEntry = (id) => ({
    kind: 'nade', id,
    name: id === 'fire' ? (side === TEAM.T ? NADES.fire.nameT : NADES.fire.nameCT) : NADES[id].name,
    price: nadePrice(game.player, id),
  });
  if (ids) {
    return ids.map(id => {
      if (key === 'nade') return nadeEntry(id);
      if (key === 'gear' && id !== 'zeus') return { kind: 'gear', id, name: GEAR[id].name, price: GEAR[id].price };
      return { kind: 'weapon', id, name: WEAPONS[id].name, price: WEAPONS[id].price };
    });
  }
  if (key === 'gear') {
    const list = [
      { kind: 'gear', id: 'kevlar', name: GEAR.kevlar.name, price: GEAR.kevlar.price },
      { kind: 'gear', id: 'helmet', name: GEAR.helmet.name, price: GEAR.helmet.price },
      { kind: 'weapon', id: 'zeus', name: WEAPONS.zeus.name, price: WEAPONS.zeus.price },
    ];
    if (side === TEAM.CT) list.push({ kind: 'gear', id: 'kit', name: GEAR.kit.name, price: GEAR.kit.price });
    return list;
  }
  if (key === 'nade') return ['flash', 'smoke', 'he', 'fire', 'decoy'].map(nadeEntry);
  return weaponsFor(side, key).map(w => ({ kind: 'weapon', id: w.id, name: w.name, price: w.price }));
}

export function buyLayout(game) {
  const cells = [];
  const imgMode = !!(game.buyPix && game.buyPix[game.playerSide]);
  COLS.forEach((c, ci) => {
    colItems(game, c.key).forEach((it, ri) => {
      if (imgMode) {
        const cw = 464 / 5, ch = 236 / 5;
        cells.push({ ...it, cat: c.key, x: 8 + ci * cw + 2, y: 26 + ri * ch + 2, w: cw - 4, h: ch - 4 });
      } else {
        cells.push({ ...it, cat: c.key, x: X0 + ci * (CW + GAP), y: Y0 + ri * CH, w: CW, h: CH - 3 });
      }
    });
  });
  return cells;
}

function icon(g, cell, x, y) {
  const b = COLORS.buyBlue; const id = cell.id; const cat = cell.cat;
  if (cat === 'gear') {
    if (id === 'kevlar' || id === 'helmet') { g.rect(x + 4, y + 3, 10, 12, b); g.rect(x + 6, y + 1, 6, 3, b); if (id === 'helmet') g.circle(x + 9, y + 1, 3, b); }
    else if (id === 'kit') { g.line(x + 3, y + 3, x + 12, y + 12, b, 2); g.line(x + 12, y + 3, x + 3, y + 12, b, 2); }
    return;
  }
  if (cat === 'nade') {
    if (id === 'he') g.circle(x + 9, y + 8, 5, b);
    else if (id === 'fire') { g.rect(x + 6, y + 4, 6, 10, b); g.rect(x + 7, y + 1, 4, 3, b); }
    else if (id === 'flash') { g.rect(x + 6, y + 3, 6, 11, b); g.rect(x + 5, y + 5, 8, 2, b); }
    else { g.rect(x + 6, y + 2, 6, 12, b); g.rect(x + 7, y + 0, 4, 2, b); }
    g.rect(x + 8, y + 1, 3, 2, b);
    return;
  }
  if (id === 'zeus') { g.rect(x + 4, y + 6, 9, 4, '#e8c060'); g.rect(x + 5, y + 9, 3, 5, '#e8c060'); return; }
  const sniper = id === 'awp' || id === 'ssg08';
  const shotgun = id === 'xm1014';
  const pistol = cat === 'pistol';
  if (pistol) { g.rect(x + 4, y + 5, 10, 4, b); g.rect(x + 5, y + 8, 3, 6, b); }
  else if (sniper) { g.rect(x + 2, y + 7, 16, 3, b); g.rect(x + 6, y + 4, 5, 2, b); g.rect(x + 8, y + 9, 3, 5, b); g.rect(x + 1, y + 6, 3, 5, b); }
  else if (shotgun) { g.rect(x + 2, y + 6, 14, 3, b); g.rect(x + 6, y + 9, 5, 3, b); g.rect(x + 3, y + 8, 3, 5, b); }
  else { g.rect(x + 2, y + 5, 13, 4, b); g.rect(x + 7, y + 8, 3, 6, b); g.rect(x + 1, y + 4, 3, 6, b); g.rect(x + 14, y + 6, 3, 2, b); }
}

export function drawBuy(g, game) {
  g.rect(0, 0, VIEW_W, VIEW_H, COLORS.buyBg);
  const p = game.player;
  g.text(`$${p.money}`, 6, 4, { color: COLORS.buyBlue, size: 10, bold: true });
  g.text(`剩余购买时间 ${Math.max(0, Math.ceil(game.stateT))}s`, VIEW_W / 2, 4, { align: 'center', color: COLORS.text, size: 9, font: CJK });
  g.text(`下回合连败补偿 $${1400 + 500 * (game.lossTier ? game.lossTier[game.playerSide] : 0)}`, VIEW_W - 6, 4, { align: 'right', color: COLORS.dim, size: 7, font: CJK });
  const mx = game.input.mouse.x, my = game.input.mouse.y;
  const img = game.buyPix && game.buyPix[game.playerSide];
  if (img) {
    g.ctx.imageSmoothingEnabled = true;
    g.ctx.drawImage(img, 8, 26, 464, 236);
    for (const cell of buyLayout(game)) {
      const hover = mx >= cell.x && mx <= cell.x + cell.w && my >= cell.y && my <= cell.y + cell.h;
      const owned = isOwned(game, cell);
      const afford = p.money >= cell.price;
      if (owned) g.rect(cell.x, cell.y, cell.w, cell.h, 'rgba(0,0,0,0.45)');
      else if (!afford) g.rect(cell.x, cell.y, cell.w, cell.h, 'rgba(120,20,20,0.30)');
      if (hover) g.stroke(cell.x, cell.y, cell.w, cell.h, COLORS.buyBlue, 1);
      if (cell.kind === 'nade' && p.nades[cell.id] > 0) g.text(`x${p.nades[cell.id]}`, cell.x + cell.w - 3, cell.y + 2, { align: 'right', color: COLORS.good, size: 7 });
    }
  } else {
    COLS.forEach((c, ci) => g.text(c.title, X0 + ci * (CW + GAP) + 2, 20, { color: COLORS.text, size: 9, font: CJK, bold: true }));
    for (const cell of buyLayout(game)) {
      const hover = mx >= cell.x && mx <= cell.x + cell.w && my >= cell.y && my <= cell.y + cell.h;
      const owned = isOwned(game, cell);
      const afford = p.money >= cell.price;
      g.rect(cell.x, cell.y, cell.w, cell.h, hover ? COLORS.buyHi : COLORS.buyCell);
      g.stroke(cell.x, cell.y, cell.w, cell.h, hover ? COLORS.buyBlue : 'rgba(255,255,255,0.08)');
      icon(g, cell, cell.x + 3, cell.y + 6);
      const nc = owned ? COLORS.dim : (afford ? COLORS.text : COLORS.bad);
      g.text(cell.name, cell.x + 24, cell.y + 5, { color: nc, size: 6, font: CJK });
      g.text(owned ? '已拥有' : `$${cell.price}`, cell.x + 24, cell.y + 16, { color: owned ? COLORS.dim : (afford ? COLORS.buyBlue : COLORS.bad), size: 7 });
      if (cell.kind === 'nade' && p.nades[cell.id] > 0) g.text(`x${p.nades[cell.id]}`, cell.x + cell.w - 4, cell.y + 5, { align: 'right', color: COLORS.good, size: 6 });
    }
  }
  g.text('点击购买 · B 关闭 · Enter 开始回合 · 1/2/3 切枪 · G 投掷 H 切换投掷物', VIEW_W / 2, VIEW_H - 10, { align: 'center', color: COLORS.dim, size: 7, font: CJK });
}
function isOwned(game, cell) {
  const p = game.player;
  if (cell.kind === 'weapon') return cell.id === 'zeus' ? !!p.zeus : ((p.primary && p.primary.id === cell.id) || (p.secondary && p.secondary.id === cell.id));
  if (cell.kind === 'gear') return cell.id === 'kit' ? p.kit : (cell.id === 'helmet' ? p.helmet : p.armor >= 100);
  return false;
}
export function buyHitTest(game, mx, my) {
  for (const c of buyLayout(game)) if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) return c;
  return null;
}
