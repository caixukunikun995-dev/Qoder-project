import { TEAM, BOT, TILE } from '../config.js';
import { dist, norm, angleTo, angleLerp, rand, choice } from '../engine/math.js';
import { moveActor } from '../engine/collision.js';
import { tryFire } from './weapons.js';

function findPath(map, sx, sy, tx, ty) {
  const sc = map.nearestWalkable(Math.floor(sx / TILE), Math.floor(sy / TILE));
  const tc = map.nearestWalkable(Math.floor(tx / TILE), Math.floor(ty / TILE));
  const cols = map.cols; const key = (c, r) => r * cols + c;
  const start = key(sc.c, sc.r), goal = key(tc.c, tc.r);
  if (start === goal) return [];
  const prev = new Int32Array(cols * map.rows).fill(-1);
  const seen = new Uint8Array(cols * map.rows);
  const q = [start]; seen[start] = 1; let head = 0; let found = false;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) { found = true; break; }
    const c = cur % cols, r = (cur / cols) | 0;
    if (c > 0) { const n = cur - 1; if (!seen[n] && map.walkable(c - 1, r)) { seen[n] = 1; prev[n] = cur; q.push(n); } }
    if (c < cols - 1) { const n = cur + 1; if (!seen[n] && map.walkable(c + 1, r)) { seen[n] = 1; prev[n] = cur; q.push(n); } }
    if (r > 0) { const n = cur - cols; if (!seen[n] && map.walkable(c, r - 1)) { seen[n] = 1; prev[n] = cur; q.push(n); } }
    if (r < map.rows - 1) { const n = cur + cols; if (!seen[n] && map.walkable(c, r + 1)) { seen[n] = 1; prev[n] = cur; q.push(n); } }
  }
  if (!found) return [];
  const path = []; let cur = goal;
  while (cur !== start && cur >= 0) { const c = cur % cols, r = (cur / cols) | 0; path.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }); cur = prev[cur]; }
  path.reverse(); return path;
}

function visibleEnemy(game, bot) {
  let best = null, bd = BOT.sight;
  for (const a of game.actors) {
    if (!a.alive || a.team === bot.team) continue;
    const d = dist(bot.x, bot.y, a.x, a.y);
    if (d < bd && game.los(bot.x, bot.y, a.x, a.y)) { bd = d; best = a; }
  }
  return best;
}

function siteSpot(game, site, id) {
  const s = game.map.sites[site];
  return { x: s.cx + ((id * 37) % 5 - 2) * 9, y: s.cy + ((id * 53) % 5 - 2) * 9 };
}

function objectiveTarget(game, bot) {
  const b = bot.brain;
  if (game.bomb.state === 'planted') {
    if (bot.team === TEAM.CT) return { x: game.bomb.x, y: game.bomb.y };
    // T 下包后主动猎杀最近的 CT（含拆包者），不再原地守点
    let best = null, bd = Infinity;
    for (const a of game.actors) {
      if (!a.alive || a.team !== TEAM.CT) continue;
      const d = dist(bot.x, bot.y, a.x, a.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) return { x: best.x, y: best.y };
    return { x: game.bomb.x + ((bot.id * 29) % 5 - 2) * 14, y: game.bomb.y + ((bot.id * 41) % 5 - 2) * 14 };
  }
  return siteSpot(game, b.site, bot.id);
}

function moveAlongPath(game, bot, target, dt) {
  const b = bot.brain;
  if (b.repathT <= 0 || !b.path.length || dist(bot.x, bot.y, b.lastTarget.x, b.lastTarget.y) > 24) {
    b.path = findPath(game.map, bot.x, bot.y, target.x, target.y);
    b.pathI = 0; b.repathT = 0.6; b.lastTarget = { x: target.x, y: target.y };
  }
  if (b.pathI < b.path.length) {
    const wp = b.path[b.pathI];
    if (dist(bot.x, bot.y, wp.x, wp.y) < 4) { b.pathI++; bot.moving = false; return; }
    const [nx, ny] = norm(wp.x - bot.x, wp.y - bot.y);
    moveActor(game.map, bot, nx * BOT.speed * dt, ny * BOT.speed * dt);
    bot.angle = angleLerp(bot.angle, Math.atan2(ny, nx), Math.min(1, dt * 6));
    bot.moving = true; bot.moveX = nx; bot.moveY = ny;
    bot.footT -= dt; if (bot.footT <= 0) { game.audio.footstep(); game.dust(bot.x, bot.y); bot.footT = 0.34; }
  } else bot.moving = false;
}

export function updateBot(game, bot, dt) {
  if (!bot.alive || !bot.brain) return;
  const b = bot.brain;
  b.repathT -= dt; b.reactT -= dt;
  if (bot.blind > 0) bot.blind -= dt;
  bot.planting = false; bot.defusing = false;

  const enemy = bot.blind > 0 ? null : visibleEnemy(game, bot);
  const engaging = enemy && dist(bot.x, bot.y, enemy.x, enemy.y) < BOT.fireRange;

  if (enemy) {
    const want = angleTo(bot.x, bot.y, enemy.x, enemy.y);
    bot.angle = angleLerp(bot.angle, want, Math.min(1, dt * 11));
    if (engaging && b.reactT <= 0 && game.los(bot.x, bot.y, enemy.x, enemy.y)) {
      tryFire(game, bot, bot.angle + rand(-BOT.aimError, BOT.aimError));
    }
  }

  if (engaging) {
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafeDir = choice([-1, 1]); b.strafeT = rand(0.4, 0.9); }
    const [ex, ey] = norm(enemy.x - bot.x, enemy.y - bot.y);
    moveActor(game.map, bot, -ey * b.strafeDir * BOT.speed * 0.4 * dt, ex * b.strafeDir * BOT.speed * 0.4 * dt);
    bot.moving = true;
  } else {
    moveAlongPath(game, bot, objectiveTarget(game, bot), dt);
  }

  const enemyNear = enemy && dist(bot.x, bot.y, enemy.x, enemy.y) < 130;
  const bomb = game.bomb;
  if (bot.team === TEAM.T) {
    if (bomb.state === 'carried' && bomb.carrier === bot && game.map.siteAt(bot.x, bot.y) && !enemyNear) bot.planting = true;
  } else if (bomb.state === 'planted' && dist(bot.x, bot.y, bomb.x, bomb.y) < 14 && !enemyNear) {
    bot.defusing = true;
  }
  if (!enemy) b.reactT = BOT.reaction;
}
