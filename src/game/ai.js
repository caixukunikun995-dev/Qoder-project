import { TEAM, BOT, TILE, TIMING } from '../config.js';
import { dist, norm, angleTo, angleLerp, angleDiff, rand, choice } from '../engine/math.js';
import { moveActor } from '../engine/collision.js';
import { tryFire, switchSlot } from './weapons.js';

function findPath(map, sx, sy, tx, ty, level = 0) {
  const sc = map.nearestWalkable(Math.floor(sx / TILE), Math.floor(sy / TILE), level);
  const tc = map.nearestWalkable(Math.floor(tx / TILE), Math.floor(ty / TILE), level);
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
    if (c > 0) { const n = cur - 1; if (!seen[n] && map.walkableL(c - 1, r, level)) { seen[n] = 1; prev[n] = cur; q.push(n); } }
    if (c < cols - 1) { const n = cur + 1; if (!seen[n] && map.walkableL(c + 1, r, level)) { seen[n] = 1; prev[n] = cur; q.push(n); } }
    if (r > 0) { const n = cur - cols; if (!seen[n] && map.walkableL(c, r - 1, level)) { seen[n] = 1; prev[n] = cur; q.push(n); } }
    if (r < map.rows - 1) { const n = cur + cols; if (!seen[n] && map.walkableL(c, r + 1, level)) { seen[n] = 1; prev[n] = cur; q.push(n); } }
  }
  if (!found) return [];
  const path = []; let cur = goal;
  while (cur !== start && cur >= 0) { const c = cur % cols, r = (cur / cols) | 0; path.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }); cur = prev[cur]; }
  path.reverse(); return path;
}

// 跨层寻路：本层走到楼梯口 → 传送标记点 → 目标层继续；每个路点带楼层标签供传送后跳段
function routeTo(game, bot, tx, ty, tl) {
  const bl = bot.level || 0;
  const tag = (p, lv) => p.map(w => ({ x: w.x, y: w.y, lv }));
  if (bl === tl) return tag(findPath(game.map, bot.x, bot.y, tx, ty, bl), bl);
  let best = null, bd = Infinity;
  for (const s of game.map.stairs) {
    const ex = bl === 0 ? s.down : s.up;
    const d = dist(bot.x, bot.y, ex.x, ex.y);
    if (d < bd) { bd = d; best = s; }
  }
  if (!best) return [];
  const entry = { x: best.x + best.w / 2, y: best.y + best.h / 2 };
  const exit = bl === 0 ? best.up : best.down;
  const p1 = tag(findPath(game.map, bot.x, bot.y, entry.x, entry.y, bl), bl);
  const p2 = tag(findPath(game.map, exit.x, exit.y, tx, ty, tl), tl);
  return p1.concat([{ x: exit.x, y: exit.y, lv: tl }], p2);
}

function visibleEnemy(game, bot) {
  let best = null, bd = BOT.sight;
  for (const a of game.actors) {
    if (!a.alive || a.team === bot.team) continue;
    const d = dist(bot.x, bot.y, a.x, a.y);
    if (d >= bd) continue;
    // 视野锥：只看得见朝向 ±fov/2 内的目标；但 44px 内的贴身目标无视锥角（个人空间）
    if (d > 44 && angleDiff(bot.angle, angleTo(bot.x, bot.y, a.x, a.y)) > BOT.fov / 2) continue;
    if (game.losBetween(bot, a)) { bd = d; best = a; }
  }
  return best;
}

// 子弹预判：未来 0.5s 内最接近点会命中本体（含半径余量）且来自视野锥内 → 返回该弹
function incomingBullet(game, bot) {
  for (const b of game.bullets) {
    if (!b.alive || b.team === bot.team) continue;
    if ((b.level || 0) !== (bot.level || 0) && !game.map.crossOverlook(b.owner, bot)) continue;
    const rx = bot.x - b.x, ry = bot.y - b.y;
    const vx = b.dx * b.speed, vy = b.dy * b.speed;
    const v2 = vx * vx + vy * vy;
    if (v2 <= 0) continue;
    const t = (rx * vx + ry * vy) / v2;
    if (t <= 0 || t > 0.5) continue;
    const cx = rx - vx * t, cy = ry - vy * t;
    if (Math.hypot(cx, cy) > bot.radius + 7) continue;
    const shooter = b.owner;
    if (dist(bot.x, bot.y, shooter.x, shooter.y) > 44 && angleDiff(bot.angle, angleTo(bot.x, bot.y, shooter.x, shooter.y)) > BOT.fov / 2) continue;
    return b;
  }
  return null;
}

function siteSpot(game, site, id) {
  const s = game.map.sites[site];
  return { x: s.cx + ((id * 37) % 5 - 2) * 9, y: s.cy + ((id * 53) % 5 - 2) * 9 };
}

// 驻守点：目标附近贴掩体的可行走格，避免木桩站在空旷点中心
function holdSpot(game, bot, base, level) {
  const m = game.map;
  const bc = Math.floor(base.x / TILE), br = Math.floor(base.y / TILE);
  const cands = [];
  for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
    const c = bc + dc, r = br + dr;
    if (!m.walkableL(c, r, level)) continue;
    if (m.solidL(c + 1, r, level) || m.solidL(c - 1, r, level) || m.solidL(c, r + 1, level) || m.solidL(c, r - 1, level)) cands.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE });
  }
  return cands.length ? choice(cands) : { x: base.x, y: base.y };
}

// 包点压力探测：某点 T 人数占优（守点队友阵亡/以少打多）即视为受威胁，供 CT 提前回防
function threatSite(game) {
  let best = null, bestScore = 0;
  for (const k of Object.keys(game.map.sites)) {
    const s = game.map.sites[k];
    let t = 0, ct = 0;
    for (const a of game.actors) {
      if (!a.alive || dist(a.x, a.y, s.cx, s.cy) > 80) continue;
      if (a.team === TEAM.T) t++; else ct++;
    }
    if (t > 0 && t > ct && t - ct > bestScore) { bestScore = t - ct; best = k; }
  }
  return best;
}

// T 各进攻方向的进展评分：存活 + 已压到点内 + 击杀，用于判断哪边更顺利
function siteStrength(game, site) {
  const s = game.map.sites[site];
  let alive = 0, near = 0, kills = 0;
  for (const a of game.actors) {
    if (a.team !== TEAM.T || !a.alive || !a.brain || a.brain.site !== site) continue;
    alive++; kills += a.roundKills || 0;
    if (dist(a.x, a.y, s.cx, s.cy) < 90) near++;
  }
  return { alive, near, kills, score: alive * 3 + near * 4 + kills * 2 };
}

// 转点：开局一段时间后，把进攻兵力集中到进展更顺利的一侧（只转一次，避免来回摇摆）
function evalRotation(game) {
  const p = game.tPlan;
  if (!p || p.rotated || game.bomb.state !== 'carried') return;
  const bucket = Math.floor(game.time / 2);
  if (p.lastBucket === bucket) return;
  p.lastBucket = bucket;
  if (TIMING.round - game.stateT < 10) return;
  const m = siteStrength(game, p.main), o = siteStrength(game, p.alt);
  if (m.near + o.near === 0 && m.kills + o.kills === 0) return;
  let target;
  if (m.alive === 0 && o.alive > 0) target = p.alt;
  else if (o.alive === 0 && m.alive > 0) target = p.main;
  else if (o.score > m.score && o.alive > 0) target = p.alt;
  else if (m.alive > 0) target = p.main;
  else return;
  p.rotated = true; p.main = target;
  let moved = false;
  for (const a of game.actors) {
    if (a.team !== TEAM.T || a.isPlayer || !a.alive || !a.brain) continue;
    if (a.brain.site !== target) { a.brain.site = target; a.brain.repathT = 0; moved = true; }
  }
  if (moved && game.player.team === TEAM.T) game.addMsg(`调整进攻 · 集中 ${target} 点`);
}

function objectiveTarget(game, bot) {
  const b = bot.brain;
  const bomb = game.bomb;
  if (bomb.state === 'planted') {
    if (bot.team === TEAM.CT) return { x: bomb.x, y: bomb.y, level: bomb.level || 0 };
    // T 下包后主动猎杀最近的 CT（含拆包者），不再原地守点
    let best = null, bd = Infinity;
    for (const a of game.actors) {
      if (!a.alive || a.team !== TEAM.CT) continue;
      const d = dist(bot.x, bot.y, a.x, a.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) return { x: best.x, y: best.y, level: best.level || 0 };
    return { x: bomb.x + ((bot.id * 29) % 5 - 2) * 14, y: bomb.y + ((bot.id * 41) % 5 - 2) * 14, level: bomb.level || 0 };
  }
  if (b.invT > 0 && b.inv && !(bot.team === TEAM.T && bomb.carrier === bot)) return { x: b.inv.x, y: b.inv.y, level: bot.level || 0 };
  if (bot.team === TEAM.CT && b.upper) {
    const room = game.map.upper.find(u => u.site === b.site);
    if (room) return { x: room.cx + ((bot.id * 37) % 5 - 2) * 9, y: room.cy + ((bot.id * 53) % 5 - 2) * 9, level: 1 };
  }
  const s = siteSpot(game, b.site, bot.id);
  return { x: s.x, y: s.y, level: 0 };
}

function moveAlongPath(game, bot, target, dt) {
  const b = bot.brain;
  if (b.repathT <= 0 || !b.path.length || b.pathLevel !== (bot.level || 0) || dist(bot.x, bot.y, b.lastTarget.x, b.lastTarget.y) > 24) {
    b.path = routeTo(game, bot, target.x, target.y, target.level || 0);
    b.pathI = 0; b.repathT = 0.6; b.lastTarget = { x: target.x, y: target.y }; b.pathLevel = bot.level || 0;
  }
  while (b.pathI < b.path.length && b.path[b.pathI].lv !== (bot.level || 0)) b.pathI++;
  if (b.pathI < b.path.length) {
    const wp = b.path[b.pathI];
    if (dist(bot.x, bot.y, wp.x, wp.y) < 4) { b.pathI++; bot.moving = false; return; }
    const [nx, ny] = norm(wp.x - bot.x, wp.y - bot.y);
    const sp = BOT.speed * (b.haste ? 1.35 : 1) * (b.invT > 0 ? 0.55 : 1);
    moveActor(game.map, bot, nx * sp * dt, ny * sp * dt);
    bot.angle = angleLerp(bot.angle, Math.atan2(ny, nx), Math.min(1, dt * 6));
    bot.moving = true; bot.moveX = nx; bot.moveY = ny;
    bot.footT -= dt; if (bot.footT <= 0) { game.audio.footstep(); game.dust(bot.x, bot.y); bot.footT = 0.34; }
  } else bot.moving = false;
}

export function updateBot(game, bot, dt) {
  if (!bot.alive || !bot.brain) return;
  const b = bot.brain;
  b.repathT -= dt; b.reactT -= dt;
  b.burstT -= dt;
  if (b.burstT <= 0) { b.burstOn = !b.burstOn; b.burstT = b.burstOn ? rand(0.45, 0.8) : rand(0.25, 0.5); }
  bot.planting = false; bot.defusing = false;

  if (bot.team === TEAM.CT) {
    if (game.bomb.state === 'planted') { b.haste = dist(bot.x, bot.y, game.bomb.x, game.bomb.y) > 60; }
    else {
      // 受威胁点守军不足时立即改防该点（回防后驻守，避免来回摇摆），赶路期间提速
      const alert = threatSite(game);
      if (alert && alert !== b.site) { b.site = alert; b.hasteT = 5; }
      if (b.hasteT > 0) b.hasteT -= dt;
      b.haste = b.hasteT > 0;
    }
  } else {
    b.haste = false;
    evalRotation(game);
    if (b.waitT > 0) b.waitT -= dt;
  }

  // 枪声调查：同层近距离的新鲜敌方枪声 → 慢速摸向声源 4 秒
  const ls = game.lastShot;
  if (ls && ls.team !== bot.team && (ls.level || 0) === (bot.level || 0) && game.time - ls.t < 0.5 && dist(bot.x, bot.y, ls.x, ls.y) < 260) { b.inv = { x: ls.x, y: ls.y }; b.invT = 4; }
  if (b.invT > 0) b.invT -= dt; else b.inv = null;

  const enemy = bot.blind > 0 ? null : visibleEnemy(game, bot);
  const ed = enemy ? dist(bot.x, bot.y, enemy.x, enemy.y) : Infinity;
  const engaging = enemy && ed < BOT.fireRange;

  // 子弹闪避：视野锥内发现预测命中弹 → 按难度概率垂直弹道侧身
  if (b.dodgeT > 0) b.dodgeT -= dt;
  if (b.dodgeCd > 0) b.dodgeCd -= dt;
  if (b.dodgeT <= 0 && b.dodgeCd <= 0 && bot.blind <= 0) {
    const ib = incomingBullet(game, bot);
    if (ib) {
      b.dodgeCd = 0.9;
      if (Math.random() < BOT.dodge) {
        const rx = bot.x - ib.x, ry = bot.y - ib.y;
        let px = -ib.dy, py = ib.dx;
        if (px * rx + py * ry < 0) { px = -px; py = -py; }
        b.dodgeX = px; b.dodgeY = py; b.dodgeT = 0.32;
      }
    }
  }

  if (enemy) {
    const want = angleTo(bot.x, bot.y, enemy.x, enemy.y);
    bot.angle = angleLerp(bot.angle, want, Math.min(1, dt * 11));
    const w = bot.cur(); const wd = bot.curDef();
    const dry = wd.cat !== 'melee' && w.mag <= 0 && w.reserve <= 0;
    const enemyBack = Math.cos(angleTo(enemy.x, enemy.y, bot.x, bot.y) - enemy.angle) < -0.4;
    const melee = ed < 34 && (dry || (enemyBack && b.reactT <= 0));
    if (melee) {
      // 弹尽或摸到背后：切军刀（背刺一击必杀）
      if (bot.slot !== 'knife') switchSlot(bot, 'knife');
      if (b.reactT <= 0 && bot.fireCd <= 0) tryFire(game, bot, bot.angle + rand(-0.06, 0.06));
    } else {
      if (bot.slot === 'knife') switchSlot(bot, bot.primary ? 'primary' : 'secondary');
      if (engaging && b.reactT <= 0 && b.burstOn && game.losBetween(bot, enemy)) {
        tryFire(game, bot, bot.angle + rand(-BOT.aimError, BOT.aimError));
      }
    }
  }

  const retreat = enemy && bot.hp < 35 && ed > 50;
  if (b.dodgeT > 0) {
    moveActor(game.map, bot, b.dodgeX * BOT.speed * 1.25 * dt, b.dodgeY * BOT.speed * 1.25 * dt);
    bot.moving = true; bot.moveX = b.dodgeX; bot.moveY = b.dodgeY;
  } else if (retreat) {
    // 残血且拉开距离后撤退出接触，边退边面向敌人
    const [ax, ay] = norm(bot.x - enemy.x, bot.y - enemy.y);
    moveActor(game.map, bot, ax * BOT.speed * 0.8 * dt, ay * BOT.speed * 0.8 * dt);
    bot.moving = true;
  } else if (engaging) {
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafeDir = choice([-1, 1]); b.strafeT = rand(0.4, 0.9); }
    const [ex, ey] = norm(enemy.x - bot.x, enemy.y - bot.y);
    moveActor(game.map, bot, -ey * b.strafeDir * BOT.speed * 0.4 * dt, ex * b.strafeDir * BOT.speed * 0.4 * dt);
    bot.moving = true;
  } else if (b.waitT > 0) {
    bot.moving = false;
  } else {
    const target = objectiveTarget(game, bot);
    const sameFloor = (bot.level || 0) === (target.level || 0);
    const atSpot = dist(bot.x, bot.y, target.x, target.y) < 12 && sameFloor;
    // 驻守锁：一旦在驻守点附近就持续驻守，避免找掩体时 arrived 翻转被拉回点中心抖动
    const holding = b.hold && dist(bot.x, bot.y, b.hold.x, b.hold.y) < 70 && sameFloor;
    if (bot.team === TEAM.CT && game.bomb.state !== 'planted' && (holding || atSpot)) {
      b.holdT -= dt;
      if (b.holdT <= 0 || !b.hold) {
        b.holdT = rand(2.5, 5);
        b.hold = holdSpot(game, bot, target, bot.level || 0);
        const s = game.map.sites[b.site];
        const ts = game.map.spawns(TEAM.T, 1)[0];
        const up = (bot.level || 0) === 1 && s;
        b.faceAngle = angleTo(b.hold.x, b.hold.y, up ? s.cx : ts.x, up ? s.cy : ts.y);
      }
      if (dist(bot.x, bot.y, b.hold.x, b.hold.y) > 3) moveAlongPath(game, bot, { x: b.hold.x, y: b.hold.y, level: bot.level || 0 }, dt);
      else {
        bot.moving = false;
        bot.angle = angleLerp(bot.angle, b.faceAngle + Math.sin(game.time * 0.7 + bot.id) * 0.45, Math.min(1, dt * 4));
      }
    } else if (bot.team === TEAM.T && game.bomb.state === 'carried' && b.role !== 'carrier' && (holding || atSpot)) {
      b.holdT -= dt;
      if (b.holdT <= 0 || !b.hold) { b.holdT = rand(1.5, 3); b.hold = holdSpot(game, bot, target, 0); }
      moveAlongPath(game, bot, { x: b.hold.x, y: b.hold.y, level: 0 }, dt);
    } else {
      if (dist(bot.x, bot.y, target.x, target.y) > 80) b.hold = null;
      moveAlongPath(game, bot, target, dt);
    }
  }

  const enemyNear = enemy && ed < 130;
  const bomb = game.bomb;
  if (bot.team === TEAM.T) {
    if (bomb.state === 'carried' && bomb.carrier === bot && (bot.level || 0) === 0 && game.map.siteAt(bot.x, bot.y) && !enemyNear) bot.planting = true;
  } else if (bomb.state === 'planted' && (bot.level || 0) === (bomb.level || 0) && dist(bot.x, bot.y, bomb.x, bomb.y) < 14 && !enemyNear) {
    bot.defusing = true;
  }
  if (!enemy) b.reactT = BOT.reaction;
}