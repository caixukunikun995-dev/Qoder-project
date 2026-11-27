import { WEAPONS, GEAR, NADES, TEAM, BOT, SPREAD, spreadCat } from '../config.js';
import { rand, dist } from '../engine/math.js';
import { segmentBlocked } from '../engine/collision.js';
import { Bullet } from '../entities/bullet.js';

export function tryFire(game, actor, angle) {
  if (!actor.alive || actor.reloadT > 0 || actor.fireCd > 0) return false;
  const w = actor.cur(); const def = WEAPONS[w.id];
  if (w.mag <= 0) { startReload(actor); return false; }
  if (def.id === 'zeus') return fireZeus(game, actor, def, angle);
  w.mag--; actor.fireCd = def.delay * (actor.isPlayer ? 1 : BOT.fireMul);
  actor.recoil = Math.min(actor.recoil + 0.02, 0.12);
  actor.muzzleT = 0.06;
  const cat = spreadCat(def);
  const spread = actor.isPlayer
    ? def.spread * 0.25 + (actor.moving ? SPREAD.move[cat] * (actor.walking ? 0.5 : 1) : 0) + actor.heat + (actor.blind > 0 ? 0.25 : 0)
    : def.spread + (actor.moving ? 0.03 : 0) + actor.recoil + (actor.blind > 0 ? 0.25 : 0);
  actor.heat = Math.min(actor.heat + SPREAD.heatPerShot[cat], SPREAD.heatMax[cat]);
  const mz = actor.mzW;
  const bx = mz ? mz[0] : actor.x + Math.cos(angle) * (actor.radius + 3);
  const by = mz ? mz[1] : actor.y + Math.sin(angle) * (actor.radius + 3);
  const bdef = actor.isPlayer ? def : { ...def, dmg: def.dmg * BOT.dmgMul };
  const pellets = def.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const a = angle + rand(-spread, spread);
    game.bullets.push(new Bullet(bx, by, a, bdef, actor));
  }
  game.audio.shot(def.cat === 'rifle' && def.delay > 1 ? 'sniper' : def.cat === 'rifle' ? 'rifle' : def.cat === 'mid' ? 'smg' : 'pistol');
  game.muzzle(actor, angle);
  game.casing(actor, angle);
  game.muzzleSmoke(actor, angle);
  if (w.mag === 0) startReload(actor);
  return true;
}

// 宙斯 speed 为 0，走弹道会生成永不消失的子弹，因此按一次性近战即时判定处理
function fireZeus(game, actor, def, angle) {
  actor.fireCd = def.delay;
  actor.zeus = null;
  actor.slot = actor.primary ? 'primary' : 'secondary';
  const mz = actor.mzW;
  const spx = mz ? mz[0] : actor.x + Math.cos(angle) * (actor.radius + 3);
  const spy = mz ? mz[1] : actor.y + Math.sin(angle) * (actor.radius + 3);
  game.audio.shot('pistol');
  game.muzzle(actor, angle);
  for (const a of game.actors) {
    if (!a.alive || a.team === actor.team || a === actor) continue;
    if (dist(spx, spy, a.x, a.y) > def.range || segmentBlocked(game.map, spx, spy, a.x, a.y)) continue;
    game.damage(actor, a, def.dmg, def.kill);
    game.spark(a.x, a.y);
    break;
  }
  return true;
}

export function startReload(actor) {
  const w = actor.cur(); const def = WEAPONS[w.id];
  if (actor.reloadT > 0 || w.mag >= def.mag || w.reserve <= 0) return;
  actor.reloadT = def.reload; actor._reloading = w;
}
export function finishReload(actor) {
  const w = actor._reloading || actor.cur(); const def = WEAPONS[w.id];
  const need = def.mag - w.mag; const take = Math.min(need, w.reserve);
  w.mag += take; w.reserve -= take; actor._reloading = null;
}
export function switchSlot(actor, slot) {
  if (slot === 'primary' && !actor.primary) return;
  if (slot === 'zeus' && !actor.zeus) return;
  if (actor.slot !== slot) { actor.slot = slot; actor.reloadT = 0; actor._reloading = null; actor.fireCd = Math.max(actor.fireCd, 0.25); }
}

export function buyWeapon(game, actor, id) {
  const d = WEAPONS[id];
  if (!d || (d.side !== 'both' && d.side !== actor.team)) return false;
  if (actor.money < d.price) return false;
  if (d.cat === 'gear') {
    if (actor.zeus) return false;
    actor.money -= d.price; actor.zeus = { id: d.id, mag: d.mag, reserve: d.reserve }; actor.slot = 'zeus';
    return true;
  }
  if (d.cat === 'pistol') {
    if (actor.secondary && actor.secondary.id === id) return false;
    actor.money -= d.price;
    if (actor.secondary) game.drops.push({ x: actor.x, y: actor.y, id: actor.secondary.id, mag: actor.secondary.mag, reserve: actor.secondary.reserve });
    actor.equipSecondary(id);
    return true;
  }
  if (actor.primary && actor.primary.id === id) return false;
  actor.money -= d.price;
  if (actor.primary) game.drops.push({ x: actor.x, y: actor.y, id: actor.primary.id, mag: actor.primary.mag, reserve: actor.primary.reserve });
  actor.equipPrimary(id); return true;
}
export function buyGear(actor, id) {
  const g = GEAR[id];
  if (!g || actor.money < g.price) return false;
  if (g.side && g.side !== actor.team) return false;
  if (id === 'kevlar') { if (actor.armor >= 100) return false; actor.armor = 100; }
  else if (id === 'helmet') { if (actor.armor >= 100 && actor.helmet) return false; actor.armor = 100; actor.helmet = true; }
  else if (id === 'kit') { if (actor.kit) return false; actor.kit = true; }
  actor.money -= g.price; return true;
}
export function nadePrice(actor, id) {
  if (id === 'fire') return actor.team === TEAM.T ? NADES.fire.priceT : NADES.fire.priceCT;
  return NADES[id].price;
}
export function buyNade(actor, id) {
  const max = id === 'flash' ? 2 : 1;
  if ((actor.nades[id] || 0) >= max) return false;
  const p = nadePrice(actor, id);
  if (actor.money < p) return false;
  actor.money -= p; actor.nades[id] = (actor.nades[id] || 0) + 1; return true;
}
export function throwNade(game, actor, type, angle) {
  if ((actor.nades[type] || 0) <= 0) return false;
  actor.nades[type]--;
  game.grenades.push({ x: actor.x, y: actor.y, vx: Math.cos(angle) * 160, vy: Math.sin(angle) * 160, type, team: actor.team, owner: actor, fuse: 1.4, life: 0 });
  game.audio.ui();
  return true;
}
