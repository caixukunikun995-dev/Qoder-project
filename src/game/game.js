import { VIEW_W, VIEW_H, VIEW_ZOOM, CHAR_SCALE, TEAM, TEAM_SIZE, COLORS, PLAYER, WEAPONS, ECON, TIMING, FORMATS } from '../config.js';
import { Renderer } from '../engine/renderer.js';
import { Input } from '../engine/input.js';
import { Camera } from '../engine/camera.js';
import { Audio } from '../engine/audio.js';
import { GameMap } from '../world/map.js';
import { MAPS } from '../world/maps.js';
import { Actor } from '../entities/actor.js';
import { moveActor, segmentBlocked, tileAt } from '../engine/collision.js';
import { dist, angleTo, norm, rand } from '../engine/math.js';
import { tryFire, startReload, finishReload, switchSlot, buyWeapon, buyGear, buyNade, throwNade } from './weapons.js';
import { updateBot } from './ai.js';
import { startMatch, updateRound, enterOT, declineOT } from './rounds.js';
import { drawHUD } from '../ui/hud.js';
import { drawMinimap } from '../ui/minimap.js';
import { drawKillfeed } from '../ui/killfeed.js';
import { drawBuy, buyHitTest } from '../ui/buy.js';
import { drawCoverBackground, drawTitle, drawMapSelect, drawAbout, drawExit, drawMatching, drawLoading, drawOvertime, drawMatchEnd, drawRoundEnd, mainMenuLayout, mapSelectLayout, aboutBack, exitBack, overtimeLayout, matchEndLayout } from '../ui/menus.js';

const CJK = '"Microsoft YaHei", sans-serif';
const hit = (b, inp) => inp.mouse.x >= b.x && inp.mouse.x <= b.x + b.w && inp.mouse.y >= b.y && inp.mouse.y <= b.y + b.h;
const NADE_ORDER = ['he', 'flash', 'smoke', 'fire', 'decoy'];
const GUN_TIP = (id, cat) => id === 'zeus' ? 7 : cat === 'pistol' ? 7 : (id === 'awp' || id === 'ssg08') ? 17 : id === 'xm1014' ? 14 : cat === 'mid' ? 13 : 15;

export class Game {
  constructor(canvas) {
    this.g = new Renderer(canvas);
    this.input = new Input(canvas);
    this.cam = new Camera();
    this.cam.zoom = VIEW_ZOOM;
    this.audio = new Audio();
    this.mapId = 'dust2';
    this.map = new GameMap(MAPS.dust2);
    this.format = FORMATS.mr6;
    this.selMap = 'dust2'; this.selFormat = FORMATS.mr6;
    this.playerSide = TEAM.CT;
    this.actors = []; this.bullets = []; this.effects = []; this.killfeed = []; this.msgs = [];
    this.grenades = []; this.clouds = []; this.fires = [];
    this.particles = []; this.decals = []; this.drops = [];
    this.nadeSel = 'he';
    this.state = 'title'; this.stateT = 0; this.round = 0;
    this.scores = { CT: 0, T: 0 }; this.lossTier = { CT: 0, T: 0 };
    this.bomb = null; this.buyOpen = false; this.matchWinner = null; this.roundWinner = null; this.roundReason = '';
    this.ot = false; this.otBlock = 0; this.otScores = { CT: 0, T: 0 };
    this.matchTarget = 0; this.matchElapsed = 0; this.loadT = 0; this.rematch = false;
    this.shake = 0; this.time = 0;
    this.player = null;
    this._buildActors();
    this.bgCanvas = document.createElement('canvas'); this.bgCanvas.width = VIEW_W; this.bgCanvas.height = VIEW_H;
    this.bgG = new Renderer(this.bgCanvas);
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCanvas.width = 120; this.bloomCanvas.height = 68;
    this.bloomG = new Renderer(this.bloomCanvas);
    this.g.emissive = this.bloomG;
    this.pixCanvas = null;
    this.bgImg = new Image();
    this.bgImg.onload = () => this._makePixelBg();
    this.bgImg.src = 'assets/bg-source.png';
    this.buyPix = { T: null, CT: null };
    this._loadBuy('T', 'assets/buy-t.png');
    this._loadBuy('CT', 'assets/buy-ct.png');
  }

  _loadBuy(side, src) {
    const im = new Image();
    im.onload = () => {
      const sw = im.naturalWidth, sh = im.naturalHeight;
      const cropY = Math.floor(sh * 0.16);
      const c = document.createElement('canvas'); c.width = 928; c.height = 472;
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = true;
      cx.drawImage(im, 0, cropY, sw, sh - cropY, 0, 0, 928, 472);
      this.buyPix[side] = c;
    };
    im.src = src;
  }

  _makePixelBg() {
    const im = this.bgImg; if (!im.naturalWidth) return;
    const sw = Math.floor(im.naturalWidth * 0.78), sh = Math.floor(im.naturalHeight * 0.96);
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = true;
    cx.drawImage(im, 0, 0, sw, sh, 0, 0, 320, 180);
    this.pixCanvas = c;
  }
  drawBackground(g) {
    if (this.pixCanvas) {
      g.ctx.imageSmoothingEnabled = false;
      g.ctx.drawImage(this.pixCanvas, 0, 0, VIEW_W, VIEW_H);
      g.ctx.imageSmoothingEnabled = false;
      g.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,12,16,0.35)');
    } else drawCoverBackground(g);
  }

  _buildActors() {
    this.player = new Actor(TEAM.CT, true); this.actors.push(this.player);
    for (let i = 0; i < TEAM_SIZE - 1; i++) this.actors.push(new Actor(TEAM.CT, false));
    for (let i = 0; i < TEAM_SIZE; i++) this.actors.push(new Actor(TEAM.T, false));
  }

  setMap(id) { this.mapId = id; this.map = new GameMap(MAPS[id]); }
  beginMatching(rematch) { this.rematch = rematch; this.matchTarget = rand(TIMING.matchMin, TIMING.matchMax); this.matchElapsed = 0; this.state = 'matching'; }
  newMatch() { startMatch(this); this.cam.follow(this.player.x, this.player.y, this.map.w, this.map.h, 1); }

  los(ax, ay, bx, by) {
    if (segmentBlocked(this.map, ax, ay, bx, by)) return false;
    const d = Math.hypot(bx - ax, by - ay); const steps = Math.max(1, Math.ceil(d / 6));
    for (const cl of this.clouds) {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps; const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (dist(x, y, cl.x, cl.y) < cl.r) return false;
      }
    }
    return true;
  }

  addKill(t) { this.killfeed.unshift({ t, life: 5 }); if (this.killfeed.length > 5) this.killfeed.pop(); }
  addMsg(t) { this.msgs.unshift({ t, life: 3 }); if (this.msgs.length > 3) this.msgs.pop(); }
  spark(x, y) { this.effects.push({ type: 'spark', x, y, life: 0.15, max: 0.15 }); }
  muzzle(a, angle) { this.effects.push({ type: 'muzzle', x: a.x + Math.cos(angle) * (a.radius + 4), y: a.y + Math.sin(angle) * (a.radius + 4), life: 0.05, max: 0.05 }); }
  blood(x, y) { this.effects.push({ type: 'blood', x, y, life: 0.3, max: 0.3 }); }
  explode(x, y) {
    this.effects.push({ type: 'boom', x, y, life: 0.6, max: 0.6 }); this.shake = 0.6; this.boomSmoke(x, y);
    for (const a of this.actors) if (a.alive && dist(a.x, a.y, x, y) < 70) this.damage(null, a, 200, 0, true);
  }

  damage(from, target, dmg, kill = 300, silent = false) {
    if (!target.alive) return;
    const died = target.takeDamage(dmg);
    this.blood(target.x, target.y);
    if (!silent) { if (target.isPlayer) { this.audio.hurt(); this.shake = Math.max(this.shake, 0.25); } else this.audio.hit(); }
    if (died) {
      this.addKill(`${from ? from.name : '炸弹'} 击杀了 ${target.name}`);
      if (target.primary) this.drops.push({ x: target.x, y: target.y, id: target.primary.id });
      if (from && kill) { from.kills++; from.roundKills = (from.roundKills || 0) + 1; from.money = Math.min(ECON.max, from.money + kill); }
      if (!silent) this.audio.kill();
      if (target.isPlayer) this.addMsg('你阵亡了 · 观战队友');
    }
  }

  update(dt) {
    this.time += dt;
    const inp = this.input;
    if (inp.justPressed('KeyM')) this.audio.toggle();
    const S = this.state;

    if (S === 'title') {
      if (inp.mouse.clicked) {
        const b = mainMenuLayout().find(b => hit(b, inp));
        if (b) { this.audio.resume(); this.audio.ui(); if (b.id === 'start') this.state = 'mapselect'; else if (b.id === 'about') this.state = 'about'; else { this.state = 'exit'; window.close(); } }
      } else if (inp.justPressed('Enter')) { this.audio.resume(); this.state = 'mapselect'; }
      inp.endFrame(); return;
    }
    if (S === 'about') { if ((inp.mouse.clicked && hit(aboutBack(), inp)) || inp.justPressed('Escape')) { this.audio.ui(); this.state = 'title'; } inp.endFrame(); return; }
    if (S === 'exit') { if ((inp.mouse.clicked && hit(exitBack(), inp)) || inp.justPressed('Escape')) { this.audio.ui(); this.state = 'title'; } inp.endFrame(); return; }
    if (S === 'mapselect') {
      const L = mapSelectLayout();
      if (inp.mouse.clicked) {
        const c = L.cards.find(c => hit(c, inp));
        if (c) { this.selMap = c.id; this.audio.ui(); }
        else if (hit(L.format, inp)) { this.selFormat = this.selFormat.id === 'mr6' ? FORMATS.mr12 : FORMATS.mr6; this.audio.ui(); }
        else if (hit(L.confirm, inp)) { this.audio.resume(); this.beginMatching(false); }
        else if (hit(L.back, inp)) { this.audio.ui(); this.state = 'title'; }
      } else if (inp.justPressed('Escape')) this.state = 'title';
      inp.endFrame(); return;
    }
    if (S === 'matching') {
      this.matchElapsed += dt;
      if (inp.justPressed('Escape')) { this.state = 'title'; inp.endFrame(); return; }
      if (this.matchElapsed >= this.matchTarget) { this.state = 'loading'; this.loadT = 0; }
      inp.endFrame(); return;
    }
    if (S === 'loading') {
      this.loadT += dt;
      if (this.loadT >= TIMING.loading) {
        if (!this.rematch) { this.setMap(this.selMap); this.format = this.selFormat; }
        this.newMatch();
      }
      inp.endFrame(); return;
    }
    if (S === 'overtime') {
      const L = overtimeLayout();
      if (inp.mouse.clicked) {
        if (hit(L.yes, inp)) { this.audio.buy(); enterOT(this); }
        else if (hit(L.no, inp)) { this.audio.ui(); declineOT(this); }
      }
      inp.endFrame(); return;
    }
    if (S === 'matchend') {
      const L = matchEndLayout();
      if (inp.mouse.clicked) {
        if (hit(L.rematch, inp)) { this.audio.resume(); this.beginMatching(true); }
        else if (hit(L.exit, inp)) { this.audio.ui(); this.state = 'exit'; window.close(); }
      } else if (inp.justPressed('Enter')) { this.audio.resume(); this.beginMatching(true); }
      inp.endFrame(); return;
    }

    // buy / live / roundend
    this.audio.resume();
    if (S === 'buy') {
      if (inp.justPressed('KeyB')) this.buyOpen = !this.buyOpen;
      if (inp.justPressed('Enter')) this.stateT = 0;
      if (this.buyOpen && inp.mouse.clicked) {
        const cell = buyHitTest(this, inp.mouse.x, inp.mouse.y);
        if (cell) {
          const ok = cell.kind === 'weapon' ? buyWeapon(this.player, cell.id) : cell.kind === 'gear' ? buyGear(this.player, cell.id) : buyNade(this.player, cell.id);
          if (ok) this.audio.buy(); else this.audio.ui();
        }
      }
    }
    updateRound(this, dt);

    if (this.state === 'live') {
      this._playerControl(dt);
      for (const a of this.actors) if (!a.isPlayer) updateBot(this, a, dt);
      this._updateNades(dt);
      this._updateParticles(dt);
    } else {
      for (const a of this.actors) { a.moving = false; a.planting = false; a.defusing = false; }
    }

    for (const a of this.actors) {
      if (!a.alive) a.deadT += dt;
      if (a.fireCd > 0) a.fireCd -= dt;
      if (a.recoil > 0) a.recoil = Math.max(0, a.recoil - dt * 0.25);
      if (a.flash > 0) a.flash -= dt;
      if (a.blind > 0) a.blind -= dt;
      if (a.reloadT > 0) { a.reloadT -= dt; if (a.reloadT <= 0) finishReload(a); }
    }
    for (const b of this.bullets) b.update(dt, this);
    this.bullets = this.bullets.filter(b => b.alive);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter(e => e.life > 0);
    for (const k of this.killfeed) k.life -= dt;
    this.killfeed = this.killfeed.filter(k => k.life > 0);
    for (const m of this.msgs) m.life -= dt;
    this.msgs = this.msgs.filter(m => m.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);

    let fx, fy;
    if (this.player.alive) {
      const wid = this.player.curDef().id;
      const look = (wid === 'awp' || wid === 'ssg08') ? 110 : 0; // 狙击朝准星方向预移视野
      fx = this.player.x + Math.cos(this.player.angle) * look;
      fy = this.player.y + Math.sin(this.player.angle) * look;
    } else {
      const m = this.actors.find(a => a.team === this.playerSide && a.alive) || this.player;
      fx = m.x; fy = m.y;
    }
    this.cam.follow(fx, fy, this.map.w, this.map.h, dt);
    inp.endFrame();
  }

  _updateNades(dt) {
    for (const g of this.grenades) {
      g.life += dt;
      const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
      if (!tileAt(this.map, nx, ny)) { g.x = nx; g.y = ny; } else { g.vx *= -0.4; g.vy *= -0.4; }
      g.vx -= g.vx * 2.5 * dt; g.vy -= g.vy * 2.5 * dt;
      if (g.life >= g.fuse) {
        g.dead = true;
        if (g.type === 'he') { this.effects.push({ type: 'boom', x: g.x, y: g.y, life: 0.4, max: 0.4 }); this.audio.explosion(); for (const a of this.actors) if (a.alive && a.team !== g.team) { const d = dist(a.x, a.y, g.x, g.y); if (d < 60) this.damage(g.owner, a, 60 * (1 - d / 60) + 10, 300); } }
        else if (g.type === 'flash') { this.audio.beep(true); for (const a of this.actors) if (a.alive && a.team !== g.team && dist(a.x, a.y, g.x, g.y) < 140 && this.los(g.x, g.y, a.x, a.y)) a.blind = 2.0; }
        else if (g.type === 'smoke') { this.clouds.push({ x: g.x, y: g.y, r: 34, life: 12 }); this.audio.ui(); }
        else if (g.type === 'fire') { this.fires.push({ x: g.x, y: g.y, r: 30, life: 6, owner: g.owner, team: g.team }); this.audio.plant(); }
        else if (g.type === 'decoy') { this.audio.shot('rifle'); }
      }
    }
    this.grenades = this.grenades.filter(g => !g.dead);
    for (const c of this.clouds) c.life -= dt;
    this.clouds = this.clouds.filter(c => c.life > 0);
    for (const f of this.fires) {
      f.life -= dt;
      if (Math.random() < 0.3) this.ember(f.x, f.y);
      for (const a of this.actors) if (a.alive && a.team !== f.team && dist(a.x, a.y, f.x, f.y) < f.r) this.damage(f.owner, a, 14 * dt, 300, true);
    }
    this.fires = this.fires.filter(f => f.life > 0);
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'casing' || p.type === 'dust') { p.vx -= p.vx * 4 * dt; p.vy -= p.vy * 4 * dt; }
      if (p.type === 'smoke') p.vy -= 6 * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const d of this.decals) d.life -= dt;
    this.decals = this.decals.filter(d => d.life > 0);
  }
  _spawnP(x, y, vx, vy, life, type, size, col) { this.particles.push({ x, y, vx, vy, life, max: life, type, size, col }); if (this.particles.length > 240) this.particles.shift(); }
  casing(a, angle) { const ca = angle + 2.2; this._spawnP(a.x + Math.cos(ca) * 6, a.y + Math.sin(ca) * 6, Math.cos(ca) * 40 + rand(-10, 10), Math.sin(ca) * 40 + rand(-10, 10), 0.5, 'casing', 1.5, '#d8b060'); }
  muzzleSmoke(a, angle) { this._spawnP(a.x + Math.cos(angle) * 10, a.y + Math.sin(angle) * 10, Math.cos(angle) * 20, Math.sin(angle) * 20 - 6, 0.4, 'smoke', 2, 'rgba(200,200,200,0.4)'); }
  dust(x, y) { this._spawnP(x + rand(-3, 3), y + rand(0, 3), rand(-8, 8), rand(-6, -2), 0.35, 'dust', 1.5, 'rgba(200,180,140,0.35)'); }
  impact(x, y) { this.decals.push({ x, y, life: 6 }); if (this.decals.length > 60) this.decals.shift(); for (let i = 0; i < 3; i++) this._spawnP(x, y, rand(-40, 40), rand(-40, 40), 0.25, 'spark', 1, 'rgba(255,220,140,0.8)'); }
  ember(x, y) { this._spawnP(x + rand(-10, 10), y + rand(-10, 10), rand(-6, 6), rand(-24, -10), 0.6, 'ember', 1.2, 'rgba(255,150,60,0.8)'); }
  boomSmoke(x, y) { for (let i = 0; i < 6; i++) this._spawnP(x + rand(-8, 8), y + rand(-8, 8), rand(-10, 10), rand(-30, -12), 0.9, 'smoke', rand(3, 6), 'rgba(90,90,90,0.5)'); for (let i = 0; i < 8; i++) this._spawnP(x, y, rand(-70, 70), rand(-70, 70), 0.4, 'ember', 1.5, 'rgba(255,180,80,0.9)'); }
  _drawParticles(g, cam) {
    for (const p of this.particles) {
      const [x, y] = cam.worldToScreen(p.x, p.y); const t = p.life / p.max;
      const fade = (base) => p.col.replace(/[\d.]+\)$/, base + ')');
      if (p.type === 'casing') g.rect(x, y, 2, 1, p.col);
      else if (p.type === 'dust') g.circle(x, y, p.size * (1.4 - t), fade(t * 0.35));
      else if (p.type === 'smoke') g.circle(x, y, p.size * (1.6 - t), fade(t * 0.5));
      else if (p.type === 'spark') g.circle(x, y, p.size * t, fade(t));
      else if (p.type === 'ember') { g.glow(x, y, 4, fade(t * 0.5), 'rgba(255,150,60,0)'); g.circle(x, y, p.size * t, fade(t)); }
    }
  }

  _playerControl(dt) {
    const p = this.player, inp = this.input;
    if (!p.alive) return;
    const [px, py] = this.cam.worldToScreen(p.x, p.y);
    const c0 = Math.cos(p.angle), s0 = Math.sin(p.angle);
    const dir0 = (c0 - s0) >= 0 ? 1 : -1;
    const tilt0 = Math.max(-3, Math.min(3, ((c0 + s0) / 2) * 4));
    const bob0 = p.moving ? [0, -0.6, 0, -0.6][Math.floor(this.time * 10 + p.id) % 4] : 0;
    const gy0 = -9 + tilt0 + (p.reloadT > 0 ? 1.5 : 0);
    const tip = GUN_TIP(p.curDef().id, p.curDef().cat);
    const msx = px + dir0 * (tip - p.recoil * 4) * CHAR_SCALE;
    const msy = py + (gy0 + bob0) * CHAR_SCALE;
    const [wdx, wdy] = this.cam.screenDirToWorld(inp.mouse.x - msx, inp.mouse.y - msy);
    p.angle = Math.atan2(wdy, wdx);
    p.mzS = [msx, msy];
    p.mzW = this.cam.screenToWorld(msx, msy + 11);
    let mx = 0, my = 0;
    if (inp.down('KeyW')) my -= 1; if (inp.down('KeyS')) my += 1;
    if (inp.down('KeyA')) mx -= 1; if (inp.down('KeyD')) mx += 1;
    p.walking = inp.down('ShiftLeft') || inp.down('ShiftRight');
    if (mx || my) {
      const [nx, ny] = norm(mx, my);
      const sp = p.walking ? PLAYER.walkSpeed : PLAYER.speed;
      moveActor(this.map, p, nx * sp * dt, ny * sp * dt);
      p.moving = true; p.moveX = nx; p.moveY = ny;
      p.footT -= dt; if (p.footT <= 0 && !p.walking) { this.audio.footstep(); this.dust(p.x, p.y); p.footT = 0.3; }
    } else p.moving = false;

    const def = p.curDef();
    if (def.auto ? inp.mouse.down : inp.mouse.clicked) tryFire(this, p, p.angle);
    if (inp.justPressed('KeyR')) { startReload(p); this.audio.reload(); }
    if (inp.justPressed('Digit1')) switchSlot(p, 'primary');
    if (inp.justPressed('Digit2')) switchSlot(p, 'secondary');
    if (inp.justPressed('KeyG')) throwNade(this, p, this.nadeSel, p.angle);
    if (inp.justPressed('KeyH')) {
      const owned = NADE_ORDER.filter(n => p.nades[n] > 0);
      if (owned.length) { const i = owned.indexOf(this.nadeSel); this.nadeSel = owned[(i + 1) % owned.length]; this.audio.ui(); }
    }
    const nearBomb = this.bomb.state === 'planted' && dist(p.x, p.y, this.bomb.x, this.bomb.y) < 16;
    const di = this.drops.findIndex(d => dist(p.x, p.y, d.x, d.y) < 16);
    if (di >= 0 && inp.justPressed('KeyE')) {
      const d = this.drops[di];
      p.equipPrimary(d.id); this.drops.splice(di, 1);
      this.audio.buy(); this.addMsg(`拾取 ${WEAPONS[d.id].name}`);
    }
    p.defusing = p.team === TEAM.CT && inp.down('KeyE') && !p.moving && nearBomb;
    p.planting = p.team === TEAM.T && this.bomb.carrier === p && this.bomb.state === 'carried' && !!this.map.siteAt(p.x, p.y) && inp.down('KeyE') && !p.moving;
  }

  render() {
    const g = this.g;
    g.resize(); g.begin();
    g.clear(COLORS.bg);
    const S = this.state;
    if (S === 'title') { drawTitle(g, this); return; }
    if (S === 'mapselect') { drawMapSelect(g, this); return; }
    if (S === 'exit') { drawExit(g, this); return; }
    if (S === 'matching') { drawMatching(g, this); return; }
    if (S === 'loading') { drawLoading(g, this); return; }
    if (S === 'about') {
      this.bgG.resize(); this.bgG.begin();
      this.drawBackground(this.bgG);
      const ctx = g.ctx; ctx.save(); ctx.filter = 'blur(3px)'; ctx.drawImage(this.bgCanvas, 0, 0); ctx.restore();
      drawAbout(g, this); return;
    }

    g.worldZoom = VIEW_ZOOM; this.cam.zoom = VIEW_ZOOM; this.bloomG.worldZoom = VIEW_ZOOM;
    g.beginWorld();
    this.bloomG.beginWorld(); this.bloomG.clearTransparent();
    const ox = this.cam.x, oy = this.cam.y;
    if (this.shake > 0) { this.cam.x += (Math.random() * 2 - 1) * this.shake * 6; this.cam.y += (Math.random() * 2 - 1) * this.shake * 6; }
    const cam = this.cam;
    this.map.blitGround(g, cam);
    for (const d of this.decals) { const al = Math.min(1, d.life / 6); const [x, y] = cam.worldToScreen(d.x, d.y); g.circle(x, y, 1, `rgba(30,25,20,${al * 0.7})`); }
    for (const f of this.fires) { const [x, y] = cam.worldToScreen(f.x, f.y); g.glow(x, y, f.r, 'rgba(230,120,40,0.5)', 'rgba(230,120,40,0)'); g.circle(x, y, f.r * 0.7, `rgba(240,150,60,${0.3 + 0.1 * Math.sin(this.time * 10)})`); }
    for (const d of this.drops) {
      const [x, y] = cam.worldToScreen(d.x, d.y);
      g.glow(x, y, 8, 'rgba(255,242,168,0.25)', 'rgba(255,242,168,0)');
      g.rect(x - 5, y - 2, 10, 2, '#d8d8dc'); g.rect(x - 1, y, 2, 3, '#d8d8dc');
      g.text(WEAPONS[d.id].name, x, y - 8, { align: 'center', color: 'rgba(242,234,216,0.7)', size: 5, font: CJK });
    }
    const items = [];
    for (const b of this.map.solidBlocks(cam)) items.push({ y: b.depth, f: () => this.map.drawBlock(g, cam, b.c, b.r, b.t) });
    for (const a of this.actors) items.push({ y: a.x + a.y, f: () => this._drawActor(g, cam, a) });
    if (this.bomb && this.bomb.state === 'planted') items.push({ y: this.bomb.x + this.bomb.y, f: () => this._drawBomb(g, cam) });
    for (const gr of this.grenades) items.push({ y: gr.x + gr.y, f: () => { const [x, y] = cam.worldToScreen(gr.x, gr.y, 2); g.circle(x, y, 2, gr.type === 'he' ? '#7fce7f' : gr.type === 'fire' ? '#e07a3a' : '#cfcfcf'); } });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.f();
    for (const b of this.bullets) { const [x, y] = cam.worldToScreen(b.x, b.y, 11); const [tx, ty] = cam.worldToScreen(b.x - b.dx * 6, b.y - b.dy * 6, 11); g.glow(x, y, 5, 'rgba(255,242,168,0.35)', 'rgba(255,242,168,0)'); g.line(tx, ty, x, y, COLORS.bullet, 1.2); }
    for (const c of this.clouds) { const [x, y] = cam.worldToScreen(c.x, c.y, 6); g.circle(x, y, c.r, 'rgba(205,205,205,0.5)'); g.circle(x, y, c.r * 0.7, 'rgba(222,222,222,0.55)'); g.circle(x, y, c.r * 0.4, 'rgba(235,235,235,0.5)'); }
    this._drawEffects(g, cam);
    this._drawParticles(g, cam);
    this.cam.x = ox; this.cam.y = oy;
    g.begin();

    const mc = g.ctx;
    mc.save(); mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.globalCompositeOperation = 'lighter'; mc.globalAlpha = 0.55;
    mc.imageSmoothingEnabled = true;
    mc.drawImage(this.bloomCanvas, 0, 0, mc.canvas.width, mc.canvas.height);
    mc.globalAlpha = 1; mc.globalCompositeOperation = 'source-over';
    mc.restore();
    const lg = g.ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    lg.addColorStop(0, 'rgba(255,220,160,0.07)'); lg.addColorStop(0.5, 'rgba(255,220,160,0)'); lg.addColorStop(1, 'rgba(20,20,40,0.10)');
    g.ctx.fillStyle = lg; g.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    g.vignette(VIEW_W, VIEW_H, 0.32);
    drawHUD(g, this);
    drawMinimap(g, this);
    drawKillfeed(g, this);
    this._drawMsgs(g);
    if (S === 'live') {
      const wid = this.player.curDef().id;
      if (this.player.alive) {
        const [mzx, mzy] = this.player.mzS || cam.worldToScreen(this.player.x, this.player.y, 11);
        g.line(mzx, mzy, this.input.mouse.x, this.input.mouse.y, 'rgba(255,255,255,0.22)', 1);
        if (wid === 'awp' || wid === 'ssg08') {
          const a = this.player.angle; const R = WEAPONS[wid].range;
          const [x1, y1] = cam.worldToScreen(this.player.x + Math.cos(a) * R, this.player.y + Math.sin(a) * R, 11);
          g.line(mzx, mzy, x1, y1, 'rgba(143,211,255,0.30)', 1);
          g.ring(x1, y1, 3, 'rgba(143,211,255,0.5)', 1);
        }
      }
      this._drawCrosshair(g); if (this.player.blind > 0) g.rect(0, 0, VIEW_W, VIEW_H, `rgba(255,255,255,${Math.min(0.9, this.player.blind / 2)})`);
    }
    if (S === 'buy' && this.buyOpen) drawBuy(g, this);
    if (S === 'buy' && !this.buyOpen) g.text('按 B 打开购买菜单 · Enter 直接开始', VIEW_W / 2, VIEW_H - 12, { align: 'center', color: COLORS.dim, size: 8, font: CJK });
    if (S === 'roundend') drawRoundEnd(g, this);
    if (S === 'overtime') drawOvertime(g, this);
    if (S === 'matchend') drawMatchEnd(g, this);
  }

  _drawActor(g, cam, a) {
    const [x, y] = cam.worldToScreen(a.x, a.y);
    if (x < -40 || y < -50 || x > VIEW_W + 40 || y > VIEW_H + 40) return;
    const ctx = g.ctx;
    const CT = a.team === TEAM.CT;
    const base = CT ? '#4f8fce' : '#cf8f4f';
    const dark = CT ? '#2f5f8e' : '#8e5f2f';
    const lite = CT ? '#7fb3e6' : '#e8b078';
    if (!a.alive) {
      const al = Math.max(0, 1 - a.deadT / 2.5);
      if (al <= 0) return;
      ctx.globalAlpha = al;
      g.ellipse(x, y, 8, 3, 'rgba(90,20,16,0.45)');
      ctx.fillStyle = dark; ctx.fillRect(x - 6, y - 3, 10, 3);
      ctx.fillStyle = base; ctx.fillRect(x - 4, y - 4, 7, 3);
      ctx.fillStyle = CT ? '#2c4a66' : '#8a6a3a'; ctx.beginPath(); ctx.arc(x + 5, y - 2, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26262a'; ctx.fillRect(x - 8, y - 2, 6, 1.5);
      ctx.globalAlpha = 1;
      return;
    }
    const adx = Math.cos(a.angle), ady = Math.sin(a.angle);
    const sdx = adx - ady, sdy = (adx + ady) / 2;
    const dir = sdx >= 0 ? 1 : -1;
    const tilt = Math.max(-3, Math.min(3, sdy * 4));
    const wf = a.moving ? Math.floor(this.time * 10 + a.id) % 4 : 0;
    const walk = [-1.5, 0, 1.5, 0][wf];
    const bob = [0, -0.6, 0, -0.6][wf];
    g.ellipse(x, y + 1, 6, 2.4, 'rgba(0,0,0,0.32)');
    ctx.save(); ctx.translate(x, y); ctx.scale(CHAR_SCALE, CHAR_SCALE);
    const C = (cx, cy, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
    const L = (x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    ctx.fillStyle = dark;
    ctx.fillRect(-2.5 + walk * 1.2, -6, 2, 6);
    ctx.fillRect(0.5 - walk * 1.2, -6, 2, 6);
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(-2.5 + walk * 1.2, -1.5, 2, 1.5);
    ctx.fillRect(0.5 - walk * 1.2, -1.5, 2, 1.5);
    ctx.translate(0, bob);
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(-dir * 4 - 1.2, -12, 2.4, 5);
    L(-dir * 4, -12, -dir * 5.5, -14, 0.5, '#2b2b30');
    const tg = ctx.createLinearGradient(0, -13, 0, -6);
    tg.addColorStop(0, lite); tg.addColorStop(0.5, base); tg.addColorStop(1, dark);
    ctx.fillStyle = tg; ctx.fillRect(-3, -13, 6, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5; ctx.strokeRect(-3, -13, 6, 7);
    ctx.fillStyle = dark; ctx.fillRect(-2.5, -12, 5, 5);
    ctx.fillStyle = CT ? '#24486e' : '#6e4a26';
    ctx.fillRect(-1.5, -11, 2, 1.6); ctx.fillRect(-1.5, -8.6, 2, 1.6);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-2.5, -12); ctx.lineTo(2.5, -7); ctx.moveTo(2.5, -12); ctx.lineTo(-2.5, -7); ctx.stroke();
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(-2.5 + walk * 1.2, -4, 2, 1.2); ctx.fillRect(0.5 - walk * 1.2, -4, 2, 1.2);
    if (CT) { ctx.fillStyle = '#22262c'; ctx.fillRect(-3.4, -11, 1, 2); }
    else { ctx.fillStyle = '#6e4a26'; ctx.fillRect(-1, -13.5, 2, 1); }
    const gy = -9 + tilt;
    L(-3, -12, dir * 4, gy, 1.6, base);
    L(3, -12, dir * 5, gy + 1, 1.6, base);
    this._drawGun25(ctx, a, dir, gy);
    C(dir * 4, gy, 1.1, '#3a3a40'); C(dir * 5, gy + 1, 1.1, '#3a3a40');
    const hg = ctx.createRadialGradient(-1, -17, 0.5, 0, -16, 3.2);
    if (CT) { hg.addColorStop(0, '#5a7f9e'); hg.addColorStop(1, '#2c4a66'); }
    else { hg.addColorStop(0, '#c9a06a'); hg.addColorStop(1, '#8a6a3a'); }
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -16, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.stroke();
    if (CT) {
      C(-2.6, -16, 0.9, '#22262c'); C(2.6, -16, 0.9, '#22262c');
      L(dir * 2, -15, dir * 3.5, -14, 0.5, '#22262c');
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(-1, -17, 1.1, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#6e4a26'; ctx.fillRect(dir * 2.2 - (dir < 0 ? 2 : 0), -17.6, 2, 1.6);
      L(-dir * 2, -15, -dir * 3.5, -13, 0.8, '#6e4a26');
    }
    ctx.fillStyle = 'rgba(20,20,24,0.8)'; ctx.fillRect(dir * 1.2 - 0.8, -16.8, 1.6, 1.4);
    ctx.restore();
    if (a.isPlayer) {
      g.glow(x, y - 10, 12, 'rgba(143,211,255,0.16)', 'rgba(143,211,255,0)');
      g.ctx.fillStyle = COLORS.player;
      g.ctx.beginPath(); g.ctx.moveTo(x, y - 30); g.ctx.lineTo(x - 3, y - 35); g.ctx.lineTo(x + 3, y - 35); g.ctx.closePath(); g.ctx.fill();
    }
    else if (a.team === this.playerSide) g.text(a.name, x, y - 29, { align: 'center', color: 'rgba(242,234,216,0.6)', size: 5, font: CJK });
    if (a.flash > 0) g.circle(x, y - 12, 6, 'rgba(255,255,255,0.65)');
    if (this.bomb && this.bomb.state === 'carried' && this.bomb.carrier === a) { g.glow(x - dir * 4, y - 12, 5, 'rgba(224,90,90,0.4)', 'rgba(224,90,90,0)'); g.rect(x - dir * 4 - 1, y - 13, 2, 2, COLORS.bomb); }
    if (a.hp < 100) {
      const w = 12, frac = a.hp / 100;
      g.rect(x - w / 2, y - 26, w, 2, 'rgba(0,0,0,0.5)');
      g.rect(x - w / 2, y - 26, w * frac, 2, frac > 0.5 ? COLORS.good : frac > 0.25 ? '#e0c060' : COLORS.bad);
    }
    if (a.planting || a.defusing) g.text(a.planting ? '下包…' : '拆包…', x, y - 31, { align: 'center', color: COLORS.text, size: 6, font: CJK });
  }

  _drawGun25(ctx, a, dir, gy) {
    const def = a.curDef(); const id = def.id; const cat = def.cat;
    const metal = '#2e2e33', hi = '#4a4a52', wood = '#7a5a3a';
    ctx.save(); ctx.translate(0, gy); ctx.scale(dir, 1); ctx.translate(-a.recoil * 4, a.reloadT > 0 ? 1.5 : 0);
    if (id === 'zeus') { ctx.fillStyle = '#e8c060'; ctx.fillRect(2, -1, 5, 2); ctx.fillRect(2, 1, 2, 2); }
    else if (cat === 'pistol') { ctx.fillStyle = metal; ctx.fillRect(2, -1, 5, 2); ctx.fillStyle = hi; ctx.fillRect(2, -1, 5, 1); ctx.fillStyle = metal; ctx.fillRect(2, 1, 2, 2); }
    else if (id === 'awp' || id === 'ssg08') { ctx.fillStyle = wood; ctx.fillRect(0, -1, 3, 2); ctx.fillStyle = metal; ctx.fillRect(3, -1, 10, 2); ctx.fillRect(13, -0.5, 4, 1); ctx.fillStyle = hi; ctx.fillRect(5, -2.5, 4, 1.5); ctx.fillStyle = metal; ctx.fillRect(6, 1, 2, 3); }
    else if (id === 'xm1014') { ctx.fillStyle = wood; ctx.fillRect(1, -1, 9, 2); ctx.fillStyle = metal; ctx.fillRect(10, -0.5, 4, 1); ctx.fillRect(5, 1, 3, 2); }
    else if (cat === 'mid') { ctx.fillStyle = metal; ctx.fillRect(2, -1, 8, 2); ctx.fillRect(10, -0.5, 3, 1); ctx.fillStyle = hi; ctx.fillRect(2, -1, 8, 1); ctx.fillStyle = metal; ctx.fillRect(4, 1, 2, 3); ctx.fillRect(0, -1, 2, 2); }
    else { ctx.fillStyle = (id === 'ak47' || id === 'galil') ? wood : metal; ctx.fillRect(0, -1, 3, 2); ctx.fillStyle = metal; ctx.fillRect(3, -1, 8, 2); ctx.fillRect(11, -0.5, 4, 1); ctx.fillStyle = hi; ctx.fillRect(3, -1, 8, 1); ctx.fillStyle = id === 'ak47' ? wood : metal; ctx.fillRect(5, 1, 2, 3); ctx.fillStyle = metal; ctx.fillRect(8, -2, 2, 1); }
    if (a.fireCd > 0 && a.fireCd > def.delay - 0.06) { ctx.fillStyle = 'rgba(255,230,150,0.9)'; ctx.beginPath(); ctx.arc(16, 0, 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  _drawBomb(g, cam) {
    const b = this.bomb; if (!b || b.state !== 'planted') return;
    const [x, y] = cam.worldToScreen(b.x, b.y);
    g.rect(x - 3, y - 2, 6, 4, '#3a2a2a'); g.rect(x - 3, y - 2, 6, 1, '#5a3a3a');
    const blink = Math.sin(this.time * (b.timer < 10 ? 16 : 6)) > 0;
    if (blink) g.glow(x + 2, y - 1, 10, 'rgba(255,90,90,0.5)', 'rgba(255,90,90,0)');
    g.circle(x + 2, y - 1, 1, blink ? '#ff5a5a' : '#5a2a2a');
    if (b.defuseProgress > 0) { g.rect(x - 8, y - 8, 16, 2, '#222'); g.rect(x - 8, y - 8, 16 * b.defuseProgress, 2, COLORS.good); }
  }

  _drawEffects(g, cam) {
    for (const e of this.effects) {
      const [x, y] = cam.worldToScreen(e.x, e.y); const t = e.life / e.max;
      if (e.type === 'spark') { g.glow(x, y, 6, `rgba(255,220,120,${t * 0.6})`, 'rgba(255,220,120,0)'); g.circle(x, y, 1.5 * t + 0.5, `rgba(255,240,180,${t})`); }
      else if (e.type === 'muzzle') { g.glow(x, y, 16, `rgba(255,220,140,${t * 0.7})`, 'rgba(255,220,140,0)'); g.circle(x, y, 2.5 * t + 1, `rgba(255,245,200,${t})`); }
      else if (e.type === 'blood') { g.circle(x, y, 3 * (1 - t) + 1, `rgba(192,57,43,${t * 0.8})`); g.circle(x + 3, y - 2, 1.2, `rgba(192,57,43,${t * 0.6})`); g.circle(x - 3, y + 2, 1.0, `rgba(192,57,43,${t * 0.6})`); }
      else if (e.type === 'boom') {
        g.glow(x, y, 70, `rgba(255,180,80,${t * 0.6})`, 'rgba(255,180,80,0)');
        g.ring(x, y, (1 - t) * 60 + 4, `rgba(255,160,60,${t})`, 3);
        g.circle(x, y, (1 - t) * 30 + 2, `rgba(255,220,120,${t * 0.5})`);
        g.circle(x + 8, y - 6, (1 - t) * 14 + 3, `rgba(90,90,90,${t * 0.4})`);
        g.circle(x - 9, y + 4, (1 - t) * 12 + 3, `rgba(70,70,70,${t * 0.35})`);
      }
    }
  }

  _drawMsgs(g) {
    let y = 24;
    for (const m of this.msgs) {
      const a = Math.min(1, m.life);
      g.text(m.t, VIEW_W / 2, y, { align: 'center', color: `rgba(242,234,216,${a})`, size: 9, font: CJK, bold: true });
      y += 11;
    }
  }

  _drawCrosshair(g) {
    const { x, y } = this.input.mouse;
    g.line(x - 4, y, x - 1, y, 'rgba(255,255,255,0.8)', 1);
    g.line(x + 1, y, x + 4, y, 'rgba(255,255,255,0.8)', 1);
    g.line(x, y - 4, x, y - 1, 'rgba(255,255,255,0.8)', 1);
    g.line(x, y + 1, x, y + 4, 'rgba(255,255,255,0.8)', 1);
  }
}
