import { TEAM, TEAM_SIZE, TIMING, ECON, OT, WEAPONS, GEAR, BOT, weaponsFor } from '../config.js';
import { choice, dist, rand } from '../engine/math.js';
import { buyWeapon, buyGear } from './weapons.js';

export function startMatch(game) {
  game.scores = { CT: 0, T: 0 };
  game.round = 0;
  game.killfeed.length = 0; game.msgs.length = 0;
  game.lossTier = { CT: 0, T: 0 };
  game.roundsPlayed = 0;
  game.ot = false; game.otBlock = 0; game.otScores = { CT: 0, T: 0 }; game.otRoundsPlayed = 0;
  game.matchWinner = null;
  // 随机分配玩家开局阵营（CT 或 T），机器人随之补齐双方 5 人
  const side = Math.random() < 0.5 ? TEAM.CT : TEAM.T;
  const other = side === TEAM.CT ? TEAM.T : TEAM.CT;
  game.playerSide = side;
  game.player.team = side;
  let bi = 0;
  for (const a of game.actors) {
    if (a.isPlayer) continue;
    a.team = bi < TEAM_SIZE - 1 ? side : other; bi++;
    a.name = `${a.team}-${a.id}`;
  }
  for (const a of game.actors) { a.money = ECON.start; a.resetLoadout(); a.kills = 0; a.deaths = 0; a.dmgDealt = 0; a.headshots = 0; a.plants = 0; a.defuses = 0; a.roundDmg = 0; }
  startRound(game, true);
}

export function swapSides(game) {
  for (const a of game.actors) { a.team = a.team === TEAM.CT ? TEAM.T : TEAM.CT; a.name = a.isPlayer ? '你' : `${a.team}-${a.id}`; a.refillPistol(); }
  game.playerSide = game.player.team;
  // 比分/连败补偿/加时比分跟随队伍而非侧标签，换边后玩家阵营保留自己的得分
  const sw = (o) => { const t = o.CT; o.CT = o.T; o.T = t; };
  sw(game.scores); sw(game.lossTier); sw(game.otScores);
}

function assignRoles(game) {
  const ts = game.actors.filter(a => a.team === TEAM.T && a.alive);
  const carrier = game.player.team === TEAM.T ? game.player : choice(ts);
  const bots = ts.filter(a => !a.isPlayer);
  const keys = Object.keys(game.map.sites);
  const main = choice(keys);
  const alt = choice(keys.filter(k => k !== main));
  // 每回合随机进攻战术，且避免与上一回合完全相同
  const tactics = ['rush', 'split', 'lurk'];
  let tactic = choice(tactics);
  if (tactic === game.lastTactic) tactic = choice(tactics.filter(t => t !== tactic));
  game.lastTactic = tactic;
  const altCount = tactic === 'split' ? Math.max(1, Math.floor(bots.length / 2)) : tactic === 'lurk' ? 1 : 0;
  const nonCarrier = bots.filter(a => a !== carrier);
  const altSet = new Set(nonCarrier.slice(nonCarrier.length - altCount));
  const mk = (role, site) => ({ role, site, path: [], pathI: 0, repathT: 0, reactT: BOT.reaction, lastTarget: { x: 0, y: 0 }, strafeT: 0, strafeDir: 1, haste: false, hasteT: 0, waitT: 0, holdT: 0, hold: null, faceAngle: null, burstT: 0, burstOn: true, invT: 0, inv: null, upper: false, pathLevel: 0 });
  for (const a of bots) {
    const isAlt = altSet.has(a);
    const role = a === carrier ? 'carrier' : (tactic === 'lurk' && isAlt ? 'lurk' : 'push');
    a.brain = mk(role, isAlt ? alt : main);
    a.brain.lastTarget = { x: a.x, y: a.y };
    if (role === 'lurk') a.brain.waitT = rand(4, 9);
  }
  game.tPlan = { tactic, main, alt, rotated: false, lastBucket: -1 };
  const cts = game.actors.filter(a => a.team === TEAM.CT && !a.isPlayer);
  cts.forEach((a, i) => { a.brain = mk('defend', keys[i % keys.length]); a.brain.lastTarget = { x: a.x, y: a.y }; });
  // 每个包点派一名守军上二楼俯视口驻守，形成立体交叉火力
  for (const room of game.map.upper) {
    const guard = cts.find(a => a.brain.site === room.site && !a.brain.upper);
    if (guard) guard.brain.upper = true;
  }
  return carrier;
}

function botBuy(game, a) {
  const rifles = weaponsFor(a.team, 'rifle').filter(w => w.delay < 1);
  const best = rifles.sort((x, y) => y.price - x.price)[0];
  if (best && a.money >= best.price && Math.random() < 0.45) buyWeapon(game, a, best.id);
  else {
    const mids = weaponsFor(a.team, 'mid').filter(w => w.auto);
    const m = mids.sort((x, y) => y.price - x.price)[0];
    if (m && a.money >= m.price) buyWeapon(game, a, m.id);
    else if (a.money >= WEAPONS.deagle.price) buyWeapon(game, a, 'deagle');
    else if (a.money >= WEAPONS.p250.price) buyWeapon(game, a, 'p250');
  }
  if (a.money >= GEAR.helmet.price && Math.random() < 0.6) buyGear(a, 'helmet');
  else if (a.money >= GEAR.kevlar.price) buyGear(a, 'kevlar');
  if (a.team === TEAM.CT && a.money >= GEAR.kit.price && Math.random() < 0.5) buyGear(a, 'kit');
}

export function startRound(game, pistol = false) {
  game.round = (game.round || 0) + 1;
  game.roundsPlayed++;
  if (game.ot) game.otRoundsPlayed++;
  game.state = 'buy'; game.stateT = TIMING.buy; game.roundReason = '';
  game.killfeed.length = 0; game.msgs.length = 0;
  const ctSpawns = game.map.spawns(TEAM.CT, TEAM_SIZE);
  const tSpawns = game.map.spawns(TEAM.T, TEAM_SIZE);
  let ci = 0, ti = 0;
  for (const a of game.actors) {
    if (pistol) a.resetLoadout();
    a.resetForRound();
    a.roundKills = 0;
    if (a.team === TEAM.CT) { const s = ctSpawns[ci++ % ctSpawns.length]; a.x = s.x; a.y = s.y; a.angle = -Math.PI / 2; }
    else { const s = tSpawns[ti++ % tSpawns.length]; a.x = s.x; a.y = s.y; a.angle = Math.PI / 2; }
  }
  const carrier = assignRoles(game);
  if (game.player.team === TEAM.T && game.tPlan) {
    const names = { rush: '全员快攻', split: '两路夹击', lurk: '单摸牵制' };
    game.addMsg(`本回合战术：${names[game.tPlan.tactic]} · 主攻 ${game.tPlan.main} 点`);
  }
  if (!pistol) for (const a of game.actors) if (!a.isPlayer) botBuy(game, a);
  game.bomb = { state: 'carried', carrier, x: carrier.x, y: carrier.y, level: carrier.level || 0, timer: TIMING.bomb, plantT: 0, defuseProgress: 0, site: null, beepT: 0, defuser: null };
  game.buyOpen = true;
  game.drops.length = 0;
  game.bullets.length = 0;
  game.grenades.length = 0;
  game.clouds.length = 0;
  game.fires.length = 0;
  game.effects.length = 0;
  game.particles.length = 0;
  game.decals.length = 0;
  game.nadeCharge = 0;
  game.addMsg(`第 ${game.round} 回合 · ${pistol ? '手枪局' : '购买阶段'}`);
}

export function updateRound(game, dt) {
  if (game.state === 'buy') {
    game.stateT -= dt;
    if (game.stateT <= 0) { game.state = 'live'; game.stateT = TIMING.round; game.buyOpen = false; game.addMsg('回合开始！'); }
    return;
  }
  if (game.state === 'live') {
    game.stateT -= dt;
    updateBomb(game, dt);
    checkWin(game);
    return;
  }
  if (game.state === 'roundend') {
    game.stateT -= dt;
    if (game.stateT <= 0) advance(game);
  }
}

function advance(game) {
  const f = game.format;
  if (game.ot) {
    if (game.otScores.CT >= OT.win || game.otScores.T >= OT.win) return endMatch(game, game.otScores.CT >= OT.win ? TEAM.CT : TEAM.T);
    if (game.otScores.CT === OT.half && game.otScores.T === OT.half) { game.state = 'overtime'; return; }
    if (game.otRoundsPlayed === OT.half) { swapSides(game); for (const a of game.actors) a.money = OT.start; return startRound(game, false); }
    return startRound(game, false);
  }
  if (game.scores.CT >= f.win || game.scores.T >= f.win) return endMatch(game, game.scores.CT >= f.win ? TEAM.CT : TEAM.T);
  if (game.scores.CT === f.tie && game.scores.T === f.tie) { game.state = 'overtime'; return; }
  if (game.roundsPlayed === f.half) {
    swapSides(game);
    for (const a of game.actors) a.money = ECON.start;
    game.addMsg('半场换边 · 手枪局');
    return startRound(game, true);
  }
  return startRound(game, false);
}

export function enterOT(game) {
  game.ot = true; game.otBlock++;
  game.otScores = { CT: 0, T: 0 }; game.otRoundsPlayed = 0;
  swapSides(game);
  for (const a of game.actors) { a.money = OT.start; a.resetLoadout(); }
  game.addMsg(`加时赛 ${game.otBlock} · $${OT.start} · 换边`);
  startRound(game, false);
}
export function declineOT(game) { endMatch(game, null); }
function endMatch(game, winner) {
  game.state = 'matchend'; game.matchWinner = winner;
  const p = game.player;
  try {
    const b = JSON.parse(localStorage.getItem('csrush_best') || 'null') || { matches: 0, wins: 0, bestKills: 0, bestDmg: 0 };
    b.matches++; if (winner === game.playerSide) b.wins++;
    b.bestKills = Math.max(b.bestKills, p.kills); b.bestDmg = Math.max(b.bestDmg, Math.round(p.dmgDealt));
    localStorage.setItem('csrush_best', JSON.stringify(b));
    game.best = b;
  } catch {}
  if (winner === game.playerSide) game.audio.win(); else if (winner) game.audio.lose();
}

function updateBomb(game, dt) {
  const b = game.bomb;
  if (b.state === 'carried') {
    const c = b.carrier;
    if (c && c.alive) {
      b.x = c.x; b.y = c.y; b.level = c.level || 0;
      if (c.planting) {
        b.plantT += dt;
        if (b.plantT >= TIMING.plant) {
          b.state = 'planted'; b.site = game.map.siteAt(c.x, c.y); b.timer = TIMING.bomb; b.plantT = 0;
          game.audio.plant(); game.addKill(`${c.name} 在 ${b.site} 点下包`);
          c.money = Math.min(ECON.max, c.money + ECON.plant); c.plants++; game.addMsg('炸弹已安放！');
        }
      } else b.plantT = Math.max(0, b.plantT - dt * 2);
    } else {
      const ts = game.actors.filter(a => a.team === TEAM.T && a.alive);
      if (ts.length) { b.carrier = choice(ts); if (b.carrier.brain) b.carrier.brain.role = 'carrier'; b.plantT = 0; }
    }
  } else if (b.state === 'planted') {
    b.timer -= dt; b.beepT -= dt;
    if (b.beepT <= 0) { game.audio.beep(b.timer < 10); b.beepT = Math.max(0.12, b.timer / TIMING.bomb * 0.9); }
    const defuser = game.actors.find(a => a.team === TEAM.CT && a.alive && a.defusing && (a.level || 0) === (b.level || 0) && dist(a.x, a.y, b.x, b.y) < 16);
    b.defuser = defuser || null;
    if (defuser) {
      const need = defuser.kit ? TIMING.defuseKit : TIMING.defuse;
      b.defuseProgress += dt / need;
      if (b.defuseProgress >= 1) { b.state = 'defused'; game.audio.defuse(); defuser.money = Math.min(ECON.max, defuser.money + ECON.defuse); defuser.defuses++; game.addKill(`${defuser.name} 拆除了炸弹`); }
    } else b.defuseProgress = Math.max(0, b.defuseProgress - dt * 0.5);
    if (b.state === 'planted' && b.timer <= 0) { b.state = 'exploded'; game.audio.explosion(); game.explode(b.x, b.y, b.level || 0); }
  }
}

function checkWin(game) {
  const ctAlive = game.actors.some(a => a.team === TEAM.CT && a.alive);
  const tAlive = game.actors.some(a => a.team === TEAM.T && a.alive);
  const b = game.bomb;
  if (b.state === 'exploded') return endRound(game, TEAM.T, 'bomb');
  if (b.state === 'defused') return endRound(game, TEAM.CT, 'defuse');
  if (!ctAlive) return endRound(game, TEAM.T, 'elim');
  if (!tAlive && b.state !== 'planted') return endRound(game, TEAM.CT, 'elim');
  if (game.stateT <= 0 && b.state !== 'planted') return endRound(game, TEAM.CT, 'time');
}

const REASON_TEXT = { bomb: '炸弹引爆', defuse: '炸弹拆除', elim: '全灭对方', time: '时间耗尽' };
export function endRound(game, winner, reason) {
  if (game.state !== 'live') return;
  game.state = 'roundend'; game.stateT = TIMING.roundEnd;
  game.roundReason = REASON_TEXT[reason] || reason; game.roundWinner = winner;
  let mvp = null, best = 0;
  for (const a of game.actors) { const sc = (a.roundKills || 0) * 1000 + (a.roundDmg || 0); if (sc > best) { best = sc; mvp = a; } }
  game.roundMvp = mvp;
  game.scores[winner]++;
  if (game.ot) game.otScores[winner]++;
  const loser = winner === TEAM.CT ? TEAM.T : TEAM.CT;
  const winReward = (reason === 'bomb' || reason === 'defuse') ? ECON.winBomb : ECON.winElim;
  const lossReward = Math.min(ECON.lossMax, ECON.lossBase + ECON.lossStep * game.lossTier[loser]);
  game.lossTier[loser] = Math.min(4, game.lossTier[loser] + 1);
  game.lossTier[winner] = Math.max(0, game.lossTier[winner] - 1);
  for (const a of game.actors) a.money = Math.min(ECON.max, a.money + (a.team === winner ? winReward : lossReward));
  if (winner === game.playerSide) game.audio.win(); else game.audio.lose();
  game.addMsg(`${winner} 获胜 · ${game.roundReason}`);
}
