import { PLAYER, BOT, WEAPONS, TEAM, defaultPistol } from '../config.js';

let NEXT_ID = 1;

export class Actor {
  constructor(team, isPlayer = false) {
    this.id = NEXT_ID++;
    this.team = team; this.isPlayer = isPlayer;
    this.radius = isPlayer ? PLAYER.radius : BOT.radius;
    this.x = 0; this.y = 0; this.angle = -Math.PI / 2;
    this.hp = isPlayer ? PLAYER.hp : BOT.hp; this.armor = 0; this.helmet = false; this.kit = false;
    this.alive = true;
    this.money = 0;
    this.primary = null;
    this.secondary = { id: defaultPistol(team), mag: 0, reserve: 0 };
    this.slot = 'secondary';
    this.nades = { flash: 0, smoke: 0, he: 0, fire: 0, decoy: 0 };
    this.fireCd = 0; this.reloadT = 0; this._reloading = null; this.recoil = 0;
    this.moveX = 0; this.moveY = 0; this.moving = false; this.walking = false;
    this.footT = 0; this.flash = 0; this.blind = 0; this.deadT = 0;
    this.brain = null;
    this.kills = 0; this.deaths = 0; this.roundKills = 0;
    this.planting = false; this.defusing = false;
    this.name = isPlayer ? '你' : `${team}-${this.id}`;
    this.refillPistol();
  }
  refillPistol() { const d = WEAPONS[defaultPistol(this.team)]; this.secondary = { id: d.id, mag: d.mag, reserve: d.reserve }; }
  cur() { return this.slot === 'primary' && this.primary ? this.primary : this.secondary; }
  curDef() { return WEAPONS[this.cur().id]; }
  equipPrimary(id) { const d = WEAPONS[id]; this.primary = { id, mag: d.mag, reserve: d.reserve }; this.slot = 'primary'; }
  resetLoadout() {
    this.primary = null; this.armor = 0; this.helmet = false; this.kit = false;
    this.nades = { flash: 0, smoke: 0, he: 0, fire: 0, decoy: 0 };
    this.refillPistol(); this.slot = 'secondary';
  }
  resetForRound() {
    this.hp = PLAYER.hp; this.alive = true; this.blind = 0;
    this.fireCd = 0; this.reloadT = 0; this._reloading = null; this.recoil = 0; this.flash = 0;
    this.moveX = this.moveY = 0; this.planting = false; this.defusing = false;
    if (this.primary) { const d = WEAPONS[this.primary.id]; this.primary.mag = d.mag; this.primary.reserve = d.reserve; }
    const pd = WEAPONS[this.secondary.id]; this.secondary.mag = pd.mag; this.secondary.reserve = pd.reserve;
    this.slot = this.primary ? 'primary' : 'secondary';
  }
  takeDamage(dmg) {
    if (!this.alive) return false;
    if (this.armor > 0) { const absorb = Math.min(this.armor, dmg * 0.5); this.armor -= absorb; dmg -= absorb; }
    this.hp -= dmg; this.flash = 0.12;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.deaths++; this.deadT = 0; return true; }
    return false;
  }
}
