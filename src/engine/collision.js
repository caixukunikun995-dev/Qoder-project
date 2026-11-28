import { TILE } from '../config.js';

export function tileAt(map, x, y) {
  return map.solid(Math.floor(x / TILE), Math.floor(y / TILE));
}

export function rectHits(map, x, y, r, level = 0) {
  const minC = Math.floor((x - r) / TILE), maxC = Math.floor((x + r) / TILE);
  const minR = Math.floor((y - r) / TILE), maxR = Math.floor((y + r) / TILE);
  for (let c = minC; c <= maxC; c++)
    for (let r = minR; r <= maxR; r++)
      if (map.solidL(c, r, level)) return true;
  return false;
}

// 轴分离移动，避免穿墙；level 决定在哪一层碰撞
export function moveActor(map, ent, dx, dy) {
  const r = ent.radius, lv = ent.level || 0;
  const nx = ent.x + dx;
  if (!rectHits(map, nx, ent.y, r, lv)) ent.x = nx;
  const ny = ent.y + dy;
  if (!rectHits(map, ent.x, ny, r, lv)) ent.y = ny;
}

// 线段是否被墙阻挡（采样法，用于视线与弹道）
export function segmentBlocked(map, ax, ay, bx, by, level = 0) {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(d / 4));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (map.opaqueL(Math.floor((ax + (bx - ax) * t) / TILE), Math.floor((ay + (by - ay) * t) / TILE), level)) return true;
  }
  return false;
}

export function lineOfSight(map, ax, ay, bx, by, level = 0) {
  return !segmentBlocked(map, ax, ay, bx, by, level);
}