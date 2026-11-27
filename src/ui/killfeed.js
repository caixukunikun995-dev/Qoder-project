import { VIEW_W, COLORS } from '../config.js';
const CJK = '"Microsoft YaHei", sans-serif';

// CS2 风格击杀播报：右上角
export function drawKillfeed(g, game) {
  let y = 30;
  for (const k of game.killfeed) {
    const a = Math.min(1, k.life);
    g.text(k.t, VIEW_W - 8, y, { align: 'right', color: `rgba(242,234,216,${a})`, size: 7, font: CJK });
    y += 10;
  }
}
