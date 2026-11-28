import { VIEW_W, VIEW_H, VIEW_ZOOM, CHAR_SCALE, TEAM, TEAM_SIZE, COLORS, PLAYER, WEAPONS, ECON, TIMING, FORMATS, SPREAD, spreadCat, isSniper, SCOPE, defaultPistol, NADE_THROW, BOT, DIFFICULTIES } from '../config.js';
import { Renderer } from '../engine/renderer.js';
import { Input } from '../engine/input.js';
import { Camera } from '../engine/camera.js';
import { Audio } from '../engine/audio.js';
import { GameMap, UP_H } from '../world/map.js';
import { MAPS } from '../world/maps.js';
import { Actor } from '../entities/actor.js';
import { moveActor, segmentBlocked } from '../engine/collision.js';
import { dist, angleTo, norm, rand } from '../engine/math.js';
import { tryFire, startReload, finishReload, switchSlot, buyWeapon, buyGear, buyNade, throwNade, stepNade, previewNade } from './weapons.js';
import { updateBot } from './ai.js';
import { startMatch, updateRound, enterOT, declineOT } from './rounds.js';
import { drawHUD } from '../ui/hud.js';
import { drawMinimap } from '../ui/minimap.js';
import { drawKillfeed } from '../ui/killfeed.js';
import { drawBuy, buyHitTest } from '../ui/buy.js';
import { drawCoverBackground, drawTitle, drawMapSelect, drawAbout, drawExit, drawMatching, drawLoading, drawOvertime, drawMatchEnd, drawRoundEnd, drawDifficulty, drawPause, drawSettings, mainMenuLayout, mapSelectLayout, aboutBack, exitBack, overtimeLayout, matchEndLayout, difficultyLayout, pauseLayout, settingsLayout, titleGear } from '../ui/menus.js';

const CJK = '"Microsoft YaHei", sans-serif';
const hit = (b, inp) => inp.mouse.x >= b.x && inp.mouse.x <= b.x + b.w && inp.mouse.y >= b.y && inp.mouse.y <= b.y + b.h;
const NADE_ORDER = ['he', 'flash', 'smoke', 'fire', 'decoy'];
const NADE_COL = { he: '#7fce7f', flash: '#e8e4d0', smoke: '#cfcfcf', fire: '#e07a3a', decoy: '#c8b06a' };
const NADE_RADIUS = { he: 60, flash: 140, smoke: 52, fire: 30, decoy: 8 };
const GUN_TIP = (id, cat) => id === 'zeus' ? 7 : cat === 'melee' ? 10 : cat === 'pistol' ? 7 : (id === 'awp' || id === 'ssg08') ? 17 : id === 'xm1014' ? 14 : cat === 'mid' ? 13 : 15;

export class Game {
  constructor(canvas) {
    this.g = new Renderer(canvas);
    this.input = new Input(canvas);
    this.cam = new Camera();
    this.cam.zoom = VIEW_ZOOM;
    this.audio = new Audio();
    this.mapId = 'mirage';
    this.map = new GameMap(MAPS.mirage);
    this.format = FORMATS.mr6;
    this.selMap = 'mirage'; this.selFormat = FORMATS.mr6;
    this.playerSide = TEAM.CT;
    this.actors = []; this.bullets = []; this.effects = []; this.killfeed = []; this.msgs = [];
    this.grenades = []; this.clouds = []; this.fires = [];
    this.particles = []; this.decals = []; this.drops = [];
    this.nadeSel = 'he';
    this.nadeCharge = 0;
    this.difficulty = 'normal';
    try { const d = localStorage.getItem('csrush_diff'); if (d && DIFFICULTIES[d]) this.difficulty = d; } catch {}
    Object.assign(BOT, DIFFICULTIES[this.difficulty].bot);
    this.settings = { vol: 1, shake: true, recoil: 1, spread: true };
    try {
      const s = JSON.parse(localStorage.getItem('csrush_settings') || 'null');
      if (s) {
        if (typeof s.vol === 'number') this.settings.vol = Math.max(0, Math.min(1, s.vol));
        if (typeof s.shake === 'boolean') this.settings.shake = s.shake;
        if (typeof s.recoil === 'number') this.settings.recoil = Math.max(0, Math.min(2, s.recoil));
        if (typeof s.spread === 'boolean') this.settings.spread = s.spread;
      }
    } catch {}
    this.audio.setVolume(this.settings.vol);
    this.pauseFrom = 'title';
    this.best = null;
    try { this.best = JSON.parse(localStorage.getItem('csrush_best') || 'null'); } catch {}
    this.state = 'title'; this.stateT = 0; this.round = 0;
    this.scores = { CT: 0, T: 0 }; this.lossTier = { CT: 0, T: 0 };
    this.bomb = null; this.buyOpen = false; this.matchWinner = null; this.roundWinner = null; this.roundReason = '';
    this.ot = false; this.otBlock = 0; this.otScores = { CT: 0, T: 0 };
    this.matchTarget = 0; this.matchElapsed = 0; this.loadT = 0; this.rematch = false;
    this.shake = 0; this.time = 0;
    this.aboutScroll = 0;
    this.player = null;
    this._buildActors();
    this.bgCanvas = document.createElement('canvas'); this.bgCanvas.width = VIEW_W; this.bgCanvas.height = VIEW_H;
    this.bgG = new Renderer(this.bgCanvas);
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCanvas.width = 120; this.bloomCanvas.height = 68;
    this.bloomG = new Renderer(this.bloomCanvas);
    this.g.emissive = this.bloomG;
    this.pixCanvas = null;
    this.scopeCanvas = document.createElement('canvas');
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
  setDifficulty(id) {
    this.difficulty = id;
    Object.assign(BOT, DIFFICULTIES[id].bot);
    try { localStorage.setItem('csrush_diff', id); } catch {}
  }
  saveSettings() { try { localStorage.setItem('csrush_settings', JSON.stringify(this.settings)); } catch {} }
  beginMatching(rematch) { this.rematch = rematch; this.matchTarget = rand(TIMING.matchMin, TIMING.matchMax); this.matchElapsed = 0; this.state = 'matching'; }
  newMatch() { startMatch(this); this.cam.follow(this.player.x, this.player.y, this.map.w, this.map.h, 1); }

  _cloudsBlock(ax, ay, bx, by, level) {
    const d = Math.hypot(bx - ax, by - ay); const steps = Math.max(1, Math.ceil(d / 6));
    for (const cl of this.clouds) {
      if ((cl.level || 0) !== level) continue;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps; const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (dist(x, y, cl.x, cl.y) < cl.r) return true;
      }
    }
    return false;
  }
  los(ax, ay, bx, by, level = 0) {
    if (segmentBlocked(this.map, ax, ay, bx, by, level)) return false;
    return !this._cloudsBlock(ax, ay, bx, by, level);
  }
  // 跨层视线：仅二楼俯视口（overlook）内可互视，其余楼层隔绝对射
  losBetween(a, b) {
    const la = a.level || 0, lb = b.level || 0;
    if (la === lb) return this.los(a.x, a.y, b.x, b.y, la);
    if (!this.map.crossOverlook(a, b)) return false;
    return !this._cloudsBlock(a.x, a.y, b.x, b.y, Math.min(la, lb));
  }

  addKill(t) { this.killfeed.unshift({ t, life: 5 }); if (this.killfeed.length > 5) this.killfeed.pop(); }
  addMsg(t) { this.msgs.unshift({ t, life: 3 }); if (this.msgs.length > 3) this.msgs.pop(); }
  spark(x, y) { this.effects.push({ type: 'spark', x, y, life: 0.15, max: 0.15 }); }
  muzzle(a, angle) { this.effects.push({ type: 'muzzle', x: a.x + Math.cos(angle) * (a.radius + 4), y: a.y + Math.sin(angle) * (a.radius + 4), life: 0.05, max: 0.05 }); }
  blood(x, y, level = 0) { this.effects.push({ type: 'oil', x, y, life: 0.3, max: 0.3, level }); }
  explode(x, y, level = 0) {
    this.effects.push({ type: 'boom', x, y, life: 0.6, max: 0.6, level }); this.shake = 0.6; this.boomSmoke(x, y);
    for (const a of this.actors) if (a.alive && (a.level || 0) === level && dist(a.x, a.y, x, y) < 70) this.damage(null, a, 200, 0, true);
  }

  damage(from, target, dmg, kill = 300, silent = false, head = false) {
    if (!target.alive) return;
    const hp0 = target.hp;
    const died = target.takeDamage(dmg, head);
    const dealt = hp0 - target.hp;
    if (from) { from.dmgDealt += dealt; from.roundDmg += dealt; if (head && died) from.headshots++; }
    this.blood(target.x, target.y, target.level || 0);
    if (!silent) { if (target.isPlayer) { this.audio.hurt(); this.shake = Math.max(this.shake, 0.25); } else this.audio.hit(); }
    if (died) {
      this.addKill(`${from ? from.name : '炸弹'} 击杀了 ${target.name}`);
      if (target.primary) this.drops.push({ x: target.x, y: target.y, level: target.level || 0, id: target.primary.id, mag: target.primary.mag, reserve: target.primary.reserve });
      if (target.secondary && target.secondary.id !== defaultPistol(target.team)) this.drops.push({ x: target.x, y: target.y, level: target.level || 0, id: target.secondary.id, mag: target.secondary.mag, reserve: target.secondary.reserve });
      target.primary = null; target.zeus = null; target.refillPistol(); target.slot = 'secondary';
      if (from) { from.kills++; from.roundKills = (from.roundKills || 0) + 1; if (kill) from.money = Math.min(ECON.max, from.money + kill); }
      if (!silent) this.audio.kill();
      if (target.isPlayer) { this.addMsg('你阵亡了 · 观战队友'); this.nadeCharge = 0; }
    }
  }

  update(dt) {
    this.time += dt;
    const inp = this.input;
    if (inp.justPressed('KeyM')) this.audio.toggle();
    const S = this.state;

    if (S === 'title') {
      if (inp.mouse.clicked) {
        if (hit(titleGear(), inp)) { this.audio.resume(); this.audio.ui(); this.pauseFrom = 'title'; this.state = 'settings'; inp.endFrame(); return; }
        const b = mainMenuLayout().find(b => hit(b, inp));
        if (b) { this.audio.resume(); this.audio.ui(); if (b.id === 'start') this.state = 'mapselect'; else if (b.id === 'diff') this.state = 'difficulty'; else if (b.id === 'about') { this.aboutScroll = 0; this.state = 'about'; } else { this.state = 'exit'; window.close(); } }
      } else if (inp.justPressed('Enter')) { this.audio.resume(); this.state = 'mapselect'; }
      inp.endFrame(); return;
    }
    if (S === 'difficulty') {
      const L = difficultyLayout();
      if (inp.mouse.clicked) {
        const o = L.options.find(o => hit(o, inp));
        if (o) { this.setDifficulty(o.id); this.audio.ui(); }
        else if (hit(L.back, inp)) { this.audio.ui(); this.state = 'title'; }
      } else if (inp.justPressed('Escape')) this.state = 'title';
      inp.endFrame(); return;
    }
    if (S === 'about') {
      if (inp.wheel) this.aboutScroll += inp.wheel * 0.5;
      if (inp.down('ArrowDown')) this.aboutScroll += 160 * dt;
      if (inp.down('ArrowUp')) this.aboutScroll -= 160 * dt;
      if ((inp.mouse.clicked && hit(aboutBack(), inp)) || inp.justPressed('Escape')) { this.audio.ui(); this.state = 'title'; }
      inp.endFrame(); return;
    }
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

    if (S === 'pause') {
      const L = pauseLayout();
      if (inp.mouse.clicked) {
        if (hit(L.resume, inp)) { this.audio.ui(); this.state = this.pauseFrom; }
        else if (hit(L.settings, inp)) { this.audio.ui(); this.state = 'settings'; }
        else if (hit(L.quit, inp)) { this.audio.ui(); this.state = 'title'; }
      } else if (inp.justPressed('Escape')) this.state = this.pauseFrom;
      inp.endFrame(); return;
    }
    if (S === 'settings') {
      const L = settingsLayout();
      const bar = L.volBar;
      if (inp.mouse.down && inp.mouse.x >= bar.x && inp.mouse.x <= bar.x + bar.w && inp.mouse.y >= bar.y - 5 && inp.mouse.y <= bar.y + bar.h + 5) {
        this.settings.vol = Math.max(0, Math.min(1, (inp.mouse.x - bar.x) / bar.w));
        this.audio.setVolume(this.settings.vol); this.saveSettings();
      }
      const rb = L.recoilBar;
      if (inp.mouse.down && inp.mouse.x >= rb.x && inp.mouse.x <= rb.x + rb.w && inp.mouse.y >= rb.y - 5 && inp.mouse.y <= rb.y + rb.h + 5) {
        this.settings.recoil = Math.max(0, Math.min(2, (inp.mouse.x - rb.x) / rb.w * 2));
        this.saveSettings();
      }
      if (inp.mouse.clicked) {
        if (hit(L.shake, inp)) { this.settings.shake = !this.settings.shake; this.saveSettings(); this.audio.ui(); }
        else if (hit(L.spread, inp)) { this.settings.spread = !this.settings.spread; this.saveSettings(); this.audio.ui(); }
        else if (hit(L.back, inp)) { this.audio.ui(); this.state = this.pauseFrom === 'title' ? 'title' : 'pause'; }
      } else if (inp.justPressed('Escape')) this.state = this.pauseFrom === 'title' ? 'title' : 'pause';
      inp.endFrame(); return;
    }

    // buy / live / roundend
    this.audio.resume();
    if (inp.justPressed('Escape')) { this.pauseFrom = S; this.state = 'pause'; inp.endFrame(); return; }
    if (S === 'buy') {
      if (inp.justPressed('KeyB')) this.buyOpen = !this.buyOpen;
      if (inp.justPressed('Enter')) this.stateT = 0;
      if (this.buyOpen && inp.mouse.clicked) {
        const cell = buyHitTest(this, inp.mouse.x, inp.mouse.y);
        if (cell) {
          const ok = cell.kind === 'weapon' ? buyWeapon(this, this.player, cell.id) : cell.kind === 'gear' ? buyGear(this.player, cell.id) : buyNade(this.player, cell.id);
          if (ok) this.audio.buy(); else this.audio.ui();
        }
      }
      inp.mouse.clicked = false;
    }
    updateRound(this, dt);

    if (this.state === 'live') {
      this._playerControl(dt);
      for (const a of this.actors) if (!a.isPlayer) updateBot(this, a, dt);
      this._updateNades(dt);
      for (const b of this.bullets) b.update(dt, this);
      this.bullets = this.bullets.filter(b => b.alive);
      for (const a of this.actors) {
        if (!a.alive || a.stairCd > 0) continue;
        const st = this.map.stairAt(a.x, a.y);
        if (!st) continue;
        if ((a.level || 0) === 0) { a.level = 1; a.x = st.up.x; a.y = st.up.y; }
        else { a.level = 0; a.x = st.down.x; a.y = st.down.y; }
        a.stairCd = 0.7;
        if (a.isPlayer) { this.addMsg(a.level ? '上到二楼' : '回到一楼'); this.audio.ui(); }
      }
      this._updateParticles(dt);
    } else {
      for (const a of this.actors) { a.moving = false; a.planting = false; a.defusing = false; a.scoping = false; a.scopeT = 0; }
    }

    for (const a of this.actors) {
      if (!a.alive) a.deadT += dt;
      if (a.fireCd > 0) a.fireCd -= dt;
      if (a.stairCd > 0) a.stairCd -= dt;
      if (a.muzzleT > 0) a.muzzleT -= dt;
      if (a.recoil > 0) a.recoil = Math.max(0, a.recoil - dt * 0.25);
      if (a.heat > 0) a.heat = Math.max(0, a.heat - SPREAD.heatDecay[spreadCat(a.curDef())] * dt);
      if (a.flash > 0) a.flash -= dt;
      if (a.blind > 0) a.blind -= dt;
      if (a.reloadT > 0) { a.reloadT -= dt; if (a.reloadT <= 0) finishReload(a); }
    }
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
      if (this.player.scoping) {
        const mw = this.cam.screenToWorld(inp.mouse.x / this.cam.zoom, inp.mouse.y / this.cam.zoom);
        fx = this.player.x + (mw[0] - this.player.x) * SCOPE.focus;
        fy = this.player.y + (mw[1] - this.player.y) * SCOPE.focus;
      }
    } else {
      const m = this.actors.find(a => a.team === this.playerSide && a.alive) || this.player;
      fx = m.x; fy = m.y;
    }
    const tz = this.player.scoping ? SCOPE.zoom : VIEW_ZOOM;
    this.cam.zoom += (tz - this.cam.zoom) * Math.min(1, dt * 8);
    this.cam.follow(fx, fy, this.map.w, this.map.h, dt);
    inp.endFrame();
  }

  _updateNades(dt) {
    for (const g of this.grenades) {
      stepNade(g, this.map, dt);
      if (g.bounced) this.audio.nadeBounce();
      if (g.life >= g.fuse) {
        g.dead = true;
        if (g.type === 'he') {
          this.effects.push({ type: 'boom', x: g.x, y: g.y, life: 0.4, max: 0.4, level: g.level || 0 }); this.audio.explosion(); this.boomSmoke(g.x, g.y);
          const pd = dist(this.player.x, this.player.y, g.x, g.y);
          this.shake = Math.max(this.shake, 0.55 * Math.max(0, 1 - pd / 200));
          for (const a of this.actors) if (a.alive && (a.level || 0) === (g.level || 0) && a.team !== g.team) { const d = dist(a.x, a.y, g.x, g.y); if (d < 60 && this.los(g.x, g.y, a.x, a.y, g.level || 0)) this.damage(g.owner, a, 60 * (1 - d / 60) + 10, 300); }
        }
        else if (g.type === 'flash') { this.audio.beep(true); for (const a of this.actors) if (a.alive && (a.level || 0) === (g.level || 0) && a.team !== g.team && dist(a.x, a.y, g.x, g.y) < 140 && this.los(g.x, g.y, a.x, a.y, g.level || 0)) a.blind = 2.0; }
        else if (g.type === 'smoke') { this.clouds.push({ x: g.x, y: g.y, r: NADE_RADIUS.smoke, life: 12, level: g.level || 0 }); this.audio.ui(); }
        else if (g.type === 'fire') { this.fires.push({ x: g.x, y: g.y, r: 30, life: 6, owner: g.owner, team: g.team, level: g.level || 0 }); this.audio.plant(); }
        else if (g.type === 'decoy') { this.audio.shot('rifle'); }
      }
    }
    this.grenades = this.grenades.filter(g => !g.dead);
    for (const c of this.clouds) c.life -= dt;
    this.clouds = this.clouds.filter(c => c.life > 0);
    for (const f of this.fires) {
      f.life -= dt;
      if (Math.random() < 0.3) this.ember(f.x, f.y);
      for (const a of this.actors) if (a.alive && (a.level || 0) === (f.level || 0) && a.team !== f.team && dist(a.x, a.y, f.x, f.y) < f.r) this.damage(f.owner, a, 14 * dt, 300, true);
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
  impact(x, y, level = 0) { this.decals.push({ x, y, life: 6, level }); if (this.decals.length > 60) this.decals.shift(); for (let i = 0; i < 3; i++) this._spawnP(x, y, rand(-40, 40), rand(-40, 40), 0.25, 'spark', 1, 'rgba(255,220,140,0.8)'); }
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
    if (!p.alive) { p.scoping = false; p.scopeT = 0; return; }
    const [px, py] = this.cam.worldToScreen(p.x, p.y);
    const c0 = Math.cos(p.angle), s0 = Math.sin(p.angle);
    const dir0 = (c0 - s0) >= 0 ? 1 : -1;
    const tilt0 = Math.max(-3, Math.min(3, ((c0 + s0) / 2) * 4));
    const bob0 = p.moving ? [0, -0.6, 0, -0.6][Math.floor(this.time * 10 + p.id) % 4] : 0;
    const gy0 = -9 + tilt0 + (p.reloadT > 0 ? 1.5 : 0);
    const tip = GUN_TIP(p.curDef().id, p.curDef().cat);
    const msx = px + dir0 * (tip - p.recoil * 4) * CHAR_SCALE;
    const msy = py + (gy0 + bob0) * CHAR_SCALE;
    p.mzS = [msx * this.cam.zoom, msy * this.cam.zoom];
    const [wdx, wdy] = this.cam.screenDirToWorld(inp.mouse.x - p.mzS[0], inp.mouse.y - p.mzS[1]);
    p.angle = Math.atan2(wdy, wdx);
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
    if (isSniper(def)) {
      if (inp.mouse.down) { p.scoping = true; p.scopeT += dt; }
      else { if (p.scoping) tryFire(this, p, p.angle); p.scoping = false; p.scopeT = 0; }
    } else {
      p.scoping = false; p.scopeT = 0;
      if (def.auto ? inp.mouse.down : inp.mouse.clicked) tryFire(this, p, p.angle);
    }
    if (inp.justPressed('KeyR')) { startReload(p); this.audio.reload(); }
    if (inp.justPressed('Digit1')) switchSlot(p, 'primary');
    if (inp.justPressed('Digit2')) switchSlot(p, 'secondary');
    if (inp.justPressed('Digit3')) switchSlot(p, 'zeus');
    if (inp.justPressed('Digit4')) switchSlot(p, 'knife');
    if (inp.down('KeyG') && (p.nades[this.nadeSel] || 0) > 0) {
      this.nadeCharge = Math.min(1, this.nadeCharge + dt / NADE_THROW.chargeTime);
    } else if (this.nadeCharge > 0 || inp.justPressed('KeyG')) {
      const power = this.nadeCharge;
      this.nadeCharge = 0;
      throwNade(this, p, this.nadeSel, p.angle, power);
    }
    if (inp.justPressed('KeyH')) {
      const owned = NADE_ORDER.filter(n => p.nades[n] > 0);
      if (owned.length) { const i = owned.indexOf(this.nadeSel); this.nadeSel = owned[(i + 1) % owned.length]; this.audio.ui(); }
    }
    const nearBomb = this.bomb.state === 'planted' && (p.level || 0) === (this.bomb.level || 0) && dist(p.x, p.y, this.bomb.x, this.bomb.y) < 16;
    const wantDefuse = p.team === TEAM.CT && nearBomb;
    const wantPlant = p.team === TEAM.T && this.bomb.carrier === p && this.bomb.state === 'carried' && (p.level || 0) === 0 && !!this.map.siteAt(p.x, p.y);
    const di = this.drops.findIndex(d => dist(p.x, p.y, d.x, d.y) < 16);
    if (di >= 0 && inp.justPressed('KeyE') && !wantDefuse && !wantPlant) {
      const d = this.drops[di];
      const def = WEAPONS[d.id];
      const ammo = { mag: d.mag ?? def.mag, reserve: d.reserve ?? def.reserve };
      if (def.cat === 'pistol') {
        if (p.secondary && p.secondary.id !== d.id) this.drops.push({ x: p.x, y: p.y, id: p.secondary.id, mag: p.secondary.mag, reserve: p.secondary.reserve });
        p.equipSecondary(d.id, ammo);
      } else {
        if (p.primary && p.primary.id !== d.id) this.drops.push({ x: p.x, y: p.y, id: p.primary.id, mag: p.primary.mag, reserve: p.primary.reserve });
        p.equipPrimary(d.id, ammo);
      }
      this.drops.splice(di, 1);
      this.audio.buy(); this.addMsg(`拾取 ${def.name}`);
    }
    p.defusing = p.team === TEAM.CT && inp.down('KeyE') && !p.moving && nearBomb;
    p.planting = p.team === TEAM.T && this.bomb.carrier === p && this.bomb.state === 'carried' && (p.level || 0) === 0 && !!this.map.siteAt(p.x, p.y) && inp.down('KeyE') && !p.moving;
  }

  render() {
    const g = this.g;
    g.resize(); g.begin();
    g.clear(COLORS.bg);
    const S = this.state;
    if (S === 'title') { drawTitle(g, this); return; }
    if (S === 'difficulty') { drawDifficulty(g, this); return; }
    if (S === 'settings' && this.pauseFrom === 'title') { this.drawBackground(g); drawSettings(g, this); return; }
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

    g.worldZoom = this.cam.zoom; this.bloomG.worldZoom = this.cam.zoom;
    g.beginWorld();
    this.bloomG.resize(); this.bloomG.beginWorld(); this.bloomG.clearTransparent();
    const ox = this.cam.x, oy = this.cam.y;
    if (this.shake > 0 && this.settings.shake && S !== 'pause' && S !== 'settings') { this.cam.x += (Math.random() * 2 - 1) * this.shake * 6; this.cam.y += (Math.random() * 2 - 1) * this.shake * 6; }
    const cam = this.cam;
    this.map.blitGround(g, cam);
    for (const d of this.decals) { const al = Math.min(1, d.life / 6); const [x, y] = cam.worldToScreen(d.x, d.y, d.level ? UP_H : 0); g.circle(x, y, 1, `rgba(30,25,20,${al * 0.7})`); }
    for (const f of this.fires) { const [x, y] = cam.worldToScreen(f.x, f.y, f.level ? UP_H : 0); g.glow(x, y, f.r, 'rgba(230,120,40,0.5)', 'rgba(230,120,40,0)'); g.circle(x, y, f.r * 0.7, `rgba(240,150,60,${0.3 + 0.1 * Math.sin(this.time * 10)})`); }
    for (const d of this.drops) {
      const [x, y] = cam.worldToScreen(d.x, d.y, d.level ? UP_H : 0);
      g.glow(x, y, 8, 'rgba(255,242,168,0.25)', 'rgba(255,242,168,0)');
      g.rect(x - 5, y - 2, 10, 2, '#d8d8dc'); g.rect(x - 1, y, 2, 3, '#d8d8dc');
      g.text(WEAPONS[d.id].name, x, y - 8, { align: 'center', color: 'rgba(242,234,216,0.7)', size: 5, font: CJK });
    }
    // 二楼楼板：玩家所在房间不透明，其余半透明幽灵化，避免遮挡一楼视野
    for (const room of this.map.upper) {
      const inside = (this.player.level || 0) === 1 && this.map.upperAt(this.player.x, this.player.y) === room;
      this.map.drawUpper(g, cam, room, inside ? 1 : 0.35);
    }
    const items = [];
    for (const b of this.map.solidBlocks(cam)) items.push({ y: b.depth, f: () => this.map.drawBlock(g, cam, b.c, b.r, b.t) });
    for (const a of this.actors) items.push({ y: a.x + a.y, f: () => this._drawActor(g, cam, a) });
    if (this.bomb && this.bomb.state === 'planted') items.push({ y: this.bomb.x + this.bomb.y, f: () => this._drawBomb(g, cam) });
    for (const gr of this.grenades) items.push({ y: gr.x + gr.y, f: () => this._drawNade(g, cam, gr) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.f();
    if (S === 'live') this._drawNadePreview(g, cam);
    for (const b of this.bullets) { const bz = 11 + (b.level ? UP_H : 0); const [x, y] = cam.worldToScreen(b.x, b.y, bz); const [tx, ty] = cam.worldToScreen(b.x - b.dx * 6, b.y - b.dy * 6, bz); g.glow(x, y, 5, 'rgba(255,242,168,0.35)', 'rgba(255,242,168,0)'); g.line(tx, ty, x, y, COLORS.bullet, 1.2); }
    for (const c of this.clouds) { const [x, y] = cam.worldToScreen(c.x, c.y, 6 + (c.level ? UP_H : 0)); g.circle(x, y, c.r, 'rgba(205,205,205,0.5)'); g.circle(x, y, c.r * 0.7, 'rgba(222,222,222,0.55)'); g.circle(x, y, c.r * 0.4, 'rgba(235,235,235,0.5)'); }
    this._drawEffects(g, cam);
    this._drawParticles(g, cam);
    this.cam.x = ox; this.cam.y = oy;
    g.begin();

    const mc = g.ctx;
    mc.save(); mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.globalCompositeOperation = 'lighter'; mc.globalAlpha = 0.55;
    mc.imageSmoothingEnabled = true;
    mc.drawImage(this.bloomCanvas, 0, 0, this.bloomCanvas.width, VIEW_H * 0.25, 0, 0, mc.canvas.width, mc.canvas.height);
    mc.globalAlpha = 1; mc.globalCompositeOperation = 'source-over';
    mc.restore();
    const lg = g.ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    lg.addColorStop(0, 'rgba(255,220,160,0.07)'); lg.addColorStop(0.5, 'rgba(255,220,160,0)'); lg.addColorStop(1, 'rgba(20,20,40,0.10)');
    g.ctx.fillStyle = lg; g.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    g.vignette(VIEW_W, VIEW_H, 0.32);
    if (S === 'live' && this.player.alive && this.player.scoping) this._drawScope(g);
    drawHUD(g, this);
    drawMinimap(g, this);
    drawKillfeed(g, this);
    this._drawMsgs(g);
    if (S === 'live') {
      const wid = this.player.curDef().id;
      if (this.player.alive) {
        const [mzx, mzy] = this.player.mzS || cam.worldToScreen(this.player.x, this.player.y, 11).map(v => v * cam.zoom);
        g.line(mzx, mzy, this.input.mouse.x, this.input.mouse.y, 'rgba(255,255,255,0.22)', 1);
        if (wid === 'awp' || wid === 'ssg08') {
          const a = this.player.angle; const R = WEAPONS[wid].range;
          const [wx1, wy1] = cam.worldToScreen(this.player.x + Math.cos(a) * R, this.player.y + Math.sin(a) * R, 11);
          const x1 = wx1 * cam.zoom, y1 = wy1 * cam.zoom;
          g.line(mzx, mzy, x1, y1, 'rgba(143,211,255,0.30)', 1);
          g.ring(x1, y1, 3, 'rgba(143,211,255,0.5)', 1);
        }
      }
      if (!this.player.scoping) this._drawCrosshair(g); this._drawNadeCharge(g); if (this.player.blind > 0) g.rect(0, 0, VIEW_W, VIEW_H, `rgba(255,255,255,${Math.min(0.9, this.player.blind / 2)})`);
    }
    if (S === 'buy' && this.buyOpen) drawBuy(g, this);
    if (S === 'buy' && !this.buyOpen) g.text('按 B 打开购买菜单 · Enter 直接开始', VIEW_W / 2, VIEW_H - 12, { align: 'center', color: COLORS.dim, size: 8, font: CJK });
    if (S === 'roundend') drawRoundEnd(g, this);
    if (S === 'overtime') drawOvertime(g, this);
    if (S === 'matchend') drawMatchEnd(g, this);
    if (S === 'pause') drawPause(g, this);
    if (S === 'settings') drawSettings(g, this);
  }

  _drawActor(g, cam, a) {
    const lz = (a.level || 0) ? UP_H : 0;
    const [x, y] = cam.worldToScreen(a.x, a.y, lz);
    const iz = 1 / (cam.zoom || 1);
    if (x < -40 || y < -50 || x > VIEW_W * iz + 40 || y > VIEW_H * iz + 40) return;
    const ctx = g.ctx;
    const CT = a.team === TEAM.CT;
    const core = CT ? '#6fd3ff' : '#ffb066';
    const plate = CT ? '#3d6ea8' : '#a8703d';
    const metal = '#43484f', hi = '#6a7078', dk = '#2b2f35';
    const ga = (a.level || 0) !== (this.player.level || 0) ? 0.45 : 1;
    if (!a.alive) {
      const al = Math.max(0, 1 - a.deadT / 2.5) * ga;
      if (al <= 0) return;
      ctx.globalAlpha = al;
      g.ellipse(x, y, 8, 3, 'rgba(20,18,22,0.5)');
      ctx.fillStyle = dk; ctx.fillRect(x - 6, y - 3, 10, 3);
      ctx.fillStyle = metal; ctx.fillRect(x - 4, y - 4, 7, 3);
      ctx.fillStyle = plate; ctx.fillRect(x + 3, y - 3, 3, 2);
      if (Math.sin(this.time * 6 + a.id) > 0.4) { ctx.fillStyle = core; ctx.fillRect(x - 1, y - 3, 1.5, 1.5); }
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
    ctx.globalAlpha = ga;
    const C = (cx, cy, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
    const L = (x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    // 活塞腿：液压杆 + 阵营膝环
    ctx.fillStyle = dk;
    ctx.fillRect(-2.5 + walk * 1.2, -6, 2, 6);
    ctx.fillRect(0.5 - walk * 1.2, -6, 2, 6);
    ctx.fillStyle = hi;
    ctx.fillRect(-2.5 + walk * 1.2, -4, 2, 1);
    ctx.fillRect(0.5 - walk * 1.2, -4, 2, 1);
    ctx.fillStyle = plate;
    ctx.fillRect(-2.5 + walk * 1.2, -3, 2, 1.2);
    ctx.fillRect(0.5 - walk * 1.2, -3, 2, 1.2);
    ctx.fillStyle = '#202329';
    ctx.fillRect(-2.5 + walk * 1.2, -1.5, 2, 1.5);
    ctx.fillRect(0.5 - walk * 1.2, -1.5, 2, 1.5);
    ctx.translate(0, bob);
    ctx.fillStyle = dk; ctx.fillRect(-dir * 4 - 1.2, -12, 2.4, 5);
    ctx.fillStyle = core; ctx.fillRect(-dir * 4 - 0.6, -11, 1.2, 1.2);
    L(-dir * 4, -12, -dir * 5.5, -14, 0.5, dk);
    // 枪铁胸甲 + 阵营能量核心
    const tg = ctx.createLinearGradient(0, -13, 0, -6);
    tg.addColorStop(0, hi); tg.addColorStop(0.5, metal); tg.addColorStop(1, dk);
    ctx.fillStyle = tg; ctx.fillRect(-3, -13, 6, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.strokeRect(-3, -13, 6, 7);
    ctx.fillStyle = plate; ctx.fillRect(-3, -13, 6, 1.4);
    C(0, -9.5, 1.5, dk); C(0, -9.5, 1.0, core);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-0.4, -10.2, 0.8, 0.6);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-2.5, -12); ctx.lineTo(-1, -7); ctx.moveTo(2.5, -12); ctx.lineTo(1, -7); ctx.stroke();
    ctx.fillStyle = plate;
    ctx.fillRect(-4.2, -13.2, 2, 2.4); ctx.fillRect(2.2, -13.2, 2, 2.4);
    ctx.fillStyle = hi;
    ctx.fillRect(-4.2, -13.2, 2, 0.8); ctx.fillRect(2.2, -13.2, 2, 0.8);
    const gy = -9 + tilt;
    L(-3, -12, dir * 4, gy, 1.6, metal);
    L(3, -12, dir * 5, gy + 1, 1.6, metal);
    this._drawGun25(ctx, a, dir, gy);
    C(dir * 4, gy, 1.1, dk); C(dir * 5, gy + 1, 1.1, dk);
    // 机械头盔：面甲 + 阵营目镜缝 + 天线
    const hg = ctx.createRadialGradient(-1, -17, 0.5, 0, -16, 3.2);
    hg.addColorStop(0, hi); hg.addColorStop(1, dk);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -16, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = plate; ctx.fillRect(-2.8, -17.4, 5.6, 1.2);
    ctx.fillStyle = core; ctx.fillRect(dir * 0.4 - 1.2, -16.4, 2.6, 0.9);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(dir * 0.4 - 1.2, -16.4, 0.8, 0.4);
    L(-dir * 2.2, -18, -dir * 3.2, -20.5, 0.5, dk);
    C(-dir * 3.2, -20.5, 0.6, core);
    ctx.restore();
    ctx.globalAlpha = ga;
    if (a.isPlayer) {
      g.glow(x, y - 10, 12, 'rgba(143,211,255,0.16)', 'rgba(143,211,255,0)');
      g.ctx.fillStyle = COLORS.player;
      g.ctx.beginPath(); g.ctx.moveTo(x, y - 30); g.ctx.lineTo(x - 3, y - 35); g.ctx.lineTo(x + 3, y - 35); g.ctx.closePath(); g.ctx.fill();
    }
    else if (a.team === this.playerSide) g.text(a.name, x, y - 29, { align: 'center', color: 'rgba(242,234,216,0.6)', size: 5, font: CJK });
    if (a.flash > 0) g.circle(x, y - 12, 6, 'rgba(255,255,255,0.65)');
    if (this.bomb && this.bomb.state === 'carried' && this.bomb.carrier === a) { g.glow(x - dir * 4, y - 12, 5, 'rgba(224,90,90,0.4)', 'rgba(224,90,90,0)'); g.rect(x - dir * 4 - 1, y - 13, 2, 2, COLORS.bomb); }
    if (a.hp < a.maxHp) {
      const w = 12, frac = a.hp / a.maxHp;
      g.rect(x - w / 2, y - 26, w, 2, 'rgba(0,0,0,0.5)');
      g.rect(x - w / 2, y - 26, w * frac, 2, frac > 0.5 ? COLORS.good : frac > 0.25 ? '#e0c060' : COLORS.bad);
    }
    if (a.planting || a.defusing) g.text(a.planting ? '下包…' : '拆包…', x, y - 31, { align: 'center', color: COLORS.text, size: 6, font: CJK });
    ctx.globalAlpha = 1;
  }

  _drawGun25(ctx, a, dir, gy) {
    const def = a.curDef(); const id = def.id; const cat = def.cat;
    const metal = '#2e2e33', hi = '#4a4a52', dk = '#1f1f24', wood = '#7a5a3a', woodHi = '#9c7b46';
    ctx.save(); ctx.translate(0, gy); ctx.scale(dir, 1); ctx.translate(-a.recoil * 4, a.reloadT > 0 ? 1.5 : 0);
    if (id === 'zeus') {
      ctx.fillStyle = '#d8b040'; ctx.fillRect(2, -1.5, 5, 3);
      ctx.fillStyle = '#f0d070'; ctx.fillRect(2, -1.5, 5, 1);
      ctx.fillStyle = dk; ctx.fillRect(2, 1.5, 2, 2.5);
      ctx.fillStyle = '#e8e8ec'; ctx.fillRect(7, -1.8, 3, 0.8); ctx.fillRect(7, 1, 3, 0.8);
    } else if (cat === 'melee') {
      ctx.fillStyle = '#c8ccd4'; ctx.fillRect(3, -1, 8, 1.6);
      ctx.fillStyle = '#eef2f8'; ctx.fillRect(3, -1, 8, 0.6);
      ctx.beginPath(); ctx.moveTo(11, -1); ctx.lineTo(13.5, -0.2); ctx.lineTo(11, 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#20232a'; ctx.fillRect(2, -1.4, 1.4, 2.6);
      ctx.fillStyle = '#3a3f48'; ctx.fillRect(0, -1, 2.2, 1.8);
      ctx.fillStyle = '#26292f'; ctx.fillRect(0, -0.2, 2.2, 1);
    } else if (cat === 'pistol') {
      ctx.fillStyle = metal; ctx.fillRect(2, -1.4, 6.5, 2);
      ctx.fillStyle = hi; ctx.fillRect(2, -1.4, 6.5, 0.8);
      ctx.fillStyle = metal; ctx.fillRect(2, 0.6, 2.2, 2.4);
      ctx.fillStyle = dk; ctx.fillRect(2, 0.6, 2.2, 0.6);
      ctx.fillStyle = hi; ctx.fillRect(2.2, -2, 1.2, 0.7);
      if (id === 'deagle') { ctx.fillStyle = '#8a8f98'; ctx.fillRect(1.2, -1.6, 1.2, 2.8); ctx.fillStyle = hi; ctx.fillRect(8.5, -1.2, 1.5, 1.6); }
      if (id === 'usp') { ctx.fillStyle = dk; ctx.fillRect(8, -1.2, 2.8, 1.5); }
    } else if (id === 'awp' || id === 'ssg08') {
      ctx.fillStyle = wood; ctx.fillRect(0, -1.2, 3.4, 2.4);
      ctx.fillStyle = woodHi; ctx.fillRect(0, -1.2, 3.4, 0.8);
      ctx.fillStyle = metal; ctx.fillRect(3.4, -1, 11, 1.8);
      ctx.fillStyle = hi; ctx.fillRect(3.4, -1, 11, 0.7);
      ctx.fillStyle = dk; ctx.fillRect(13.5, -0.8, 2.5, 1.2);
      ctx.fillStyle = '#26262c'; ctx.fillRect(5, -3.2, 5.5, 1.6);
      ctx.fillStyle = '#10121a'; ctx.fillRect(5.4, -2.9, 4.7, 1);
      ctx.fillStyle = 'rgba(143,211,255,0.55)'; ctx.fillRect(9.2, -2.8, 0.8, 0.8);
      ctx.fillStyle = metal; ctx.fillRect(6, 1, 1.8, 2.6);
      ctx.fillStyle = dk; ctx.fillRect(11, 0.8, 1, 2.4); ctx.fillRect(12, 2.6, 2.4, 0.8);
    } else if (id === 'xm1014') {
      ctx.fillStyle = wood; ctx.fillRect(0.5, -1.2, 3, 2.4);
      ctx.fillStyle = metal; ctx.fillRect(3.5, -1.2, 8.5, 2.2);
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(3.5, 0.8, 8, 1.4);
      ctx.fillStyle = hi; ctx.fillRect(3.5, -1.2, 8.5, 0.7);
      ctx.fillStyle = woodHi; ctx.fillRect(6.5, 0.4, 2.6, 1.8);
      ctx.fillStyle = dk; ctx.fillRect(11.8, -1, 1.6, 1.8);
    } else if (cat === 'mid') {
      ctx.fillStyle = metal; ctx.fillRect(1.5, -1.2, 7.5, 2.2);
      ctx.fillStyle = hi; ctx.fillRect(1.5, -1.2, 7.5, 0.7);
      ctx.fillStyle = dk; ctx.fillRect(9, -0.8, 2.6, 1.2);
      ctx.fillStyle = metal; ctx.fillRect(4.5, 1, 1.8, 3);
      ctx.fillStyle = metal; ctx.fillRect(2, 0.8, 1.8, 2.2);
      ctx.fillStyle = dk; ctx.fillRect(0.2, -1.4, 1.4, 2.6);
      if (id === 'mp5') { ctx.fillStyle = '#26262c'; ctx.fillRect(9, -1.2, 3.4, 1.8); }
      if (id === 'bizon') { ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(5.5, 2.6, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#20232a'; ctx.fillRect(4.5, 1, 2, 2); }
    } else {
      const isAk = id === 'ak47' || id === 'galil';
      if (isAk) {
        ctx.fillStyle = wood; ctx.fillRect(0, -1.4, 3.2, 2.8);
        ctx.fillStyle = woodHi; ctx.fillRect(0, -1.4, 3.2, 0.8);
        ctx.fillStyle = '#8a6a3a'; ctx.fillRect(3.2, -1.2, 8.2, 2.2);
        ctx.fillStyle = metal; ctx.fillRect(3.2, -1.2, 4, 2.2);
      } else {
        ctx.fillStyle = metal; ctx.fillRect(0.8, -1.4, 10.6, 2.4);
        ctx.fillStyle = hi; ctx.fillRect(0.8, -1.4, 10.6, 0.8);
        ctx.fillStyle = dk; ctx.fillRect(0.2, -1.6, 1.4, 2.8);
      }
      ctx.fillStyle = metal; ctx.fillRect(11.4, -0.9, 3.4, 1.4);
      ctx.fillStyle = dk; ctx.fillRect(14, -1, 1.8, 1.6);
      ctx.fillStyle = isAk ? wood : metal; ctx.fillRect(5.2, 1.2, 2.2, 3.4);
      ctx.fillStyle = dk; ctx.fillRect(5.2, 3.4, 2.2, 1.2);
      ctx.fillStyle = metal; ctx.fillRect(3.2, 0.9, 1.8, 2.4);
      if (isAk) {
        ctx.fillStyle = hi; ctx.fillRect(4.4, -2.4, 3.4, 1);
        ctx.fillStyle = dk; ctx.fillRect(3.6, -2.8, 1, 1.2); ctx.fillRect(4.6, -2.8, 1, 1.2);
      } else {
        ctx.fillStyle = hi; ctx.fillRect(6, -2.3, 3.6, 1);
        ctx.fillStyle = metal; ctx.fillRect(12.6, -2, 1.2, 1.2);
      }
    }
    if (a.muzzleT > 0) {
      ctx.fillStyle = 'rgba(255,235,160,0.95)'; ctx.beginPath(); ctx.arc(15.5, 0, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,90,0.8)';
      ctx.fillRect(17.5, -0.4, 3, 0.8); ctx.fillRect(15.1, -2.4, 0.8, 4.8);
    }
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
      else if (e.type === 'oil') { const [ox, oy] = cam.worldToScreen(e.x, e.y, e.level ? UP_H : 0); g.circle(ox, oy, 3 * (1 - t) + 1, `rgba(28,26,30,${t * 0.8})`); g.circle(ox + 3, oy - 2, 1.2, `rgba(255,190,90,${t * 0.7})`); g.circle(ox - 3, oy + 2, 1.0, `rgba(255,220,140,${t * 0.6})`); }
      else if (e.type === 'slash') {
        const [sx, sy] = cam.worldToScreen(e.x, e.y, (e.level ? UP_H : 0) + 6);
        const q = g.ctx; q.save(); q.translate(sx, sy); q.rotate(e.angle);
        q.strokeStyle = `rgba(240,244,255,${t * 0.9})`; q.lineWidth = 1.4;
        q.beginPath(); q.arc(0, 0, 10, -0.9, 0.9); q.stroke();
        q.strokeStyle = `rgba(143,211,255,${t * 0.5})`; q.lineWidth = 0.8;
        q.beginPath(); q.arc(0, 0, 13, -0.7, 0.7); q.stroke();
        q.restore();
      }
      else if (e.type === 'boom') {
        const [bx, by] = cam.worldToScreen(e.x, e.y, e.level ? UP_H : 0);
        g.glow(bx, by, 70, `rgba(255,180,80,${t * 0.6})`, 'rgba(255,180,80,0)');
        g.ring(bx, by, (1 - t) * 60 + 4, `rgba(255,160,60,${t})`, 3);
        g.circle(bx, by, (1 - t) * 30 + 2, `rgba(255,220,120,${t * 0.5})`);
        g.circle(bx + 8, by - 6, (1 - t) * 14 + 3, `rgba(90,90,90,${t * 0.4})`);
        g.circle(bx - 9, by + 4, (1 - t) * 12 + 3, `rgba(70,70,70,${t * 0.35})`);
      }
    }
  }

  _drawMsgs(g) {
    let y = 34;
    for (const m of this.msgs) {
      const a = Math.min(1, m.life);
      g.text(m.t, VIEW_W / 2, y, { align: 'center', color: `rgba(242,234,216,${a})`, size: 9, font: CJK, bold: true });
      y += 11;
    }
  }

  _drawNade(g, cam, n) {
    const lz = n.level ? UP_H : 0;
    const [gx, gy] = cam.worldToScreen(n.x, n.y, lz);
    const [x, y] = cam.worldToScreen(n.x, n.y, n.z + lz);
    const k = Math.max(0.3, 1 - n.z / 70);
    g.ellipse(gx, gy, 2.6 * k, 1.3 * k, `rgba(20,14,8,${0.32 * k})`);
    g.circle(x, y, 2.2, NADE_COL[n.type]);
    g.circle(x - 0.7, y - 0.8, 0.7, 'rgba(255,255,255,0.45)');
    if (Math.sin(n.life * 28) > 0) g.circle(x + 1.4, y - 1.8, 0.6, '#ffcf6f');
  }

  _drawNadePreview(g, cam) {
    const p = this.player;
    if (this.nadeCharge <= 0 || !p.alive || (p.nades[this.nadeSel] || 0) <= 0) return;
    const pv = previewNade(this, p, this.nadeSel, p.angle, this.nadeCharge);
    for (let i = 0; i < pv.pts.length; i++) {
      const [wx, wy, wz] = pv.pts[i];
      const [x, y] = cam.worldToScreen(wx, wy, wz);
      g.circle(x, y, 0.9, `rgba(242,234,216,${(0.25 + 0.45 * (i / pv.pts.length)).toFixed(3)})`);
    }
    const [bx, by] = cam.worldToScreen(pv.boom[0], pv.boom[1], 0);
    const r = NADE_RADIUS[pv.type];
    const ctx = g.ctx;
    ctx.save();
    ctx.strokeStyle = NADE_COL[pv.type]; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.ellipse(bx, by, r, r / 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    g.circle(bx, by, 1.4, NADE_COL[pv.type]);
  }

  _drawNadeCharge(g) {
    if (this.nadeCharge <= 0 || !this.player.alive) return;
    const { x, y } = this.input.mouse;
    const w = 26, h = 3, bx = x - w / 2, by = y + 12;
    g.rect(bx - 1, by - 1, w + 2, h + 2, 'rgba(12,14,19,0.7)');
    g.rect(bx, by, w * this.nadeCharge, h, this.nadeCharge >= 1 ? COLORS.good : NADE_COL[this.nadeSel]);
    const pct = Math.round((NADE_THROW.minPower + (1 - NADE_THROW.minPower) * this.nadeCharge) * 100);
    g.text(`${pct}%`, x, by + 5, { align: 'center', color: COLORS.dim, size: 6 });
  }

  _drawScope(g) {
    const p = this.player;
    const t = Math.min(1, p.scopeT / SCOPE.time);
    const r = SCOPE.r0 + (SCOPE.r1 - SCOPE.r0) * t;
    const blur = SCOPE.blur * t;
    const mx = this.input.mouse.x, my = this.input.mouse.y;
    const scale = g.scale;
    if (blur > 0.15) {
      const src = this.scopeCanvas; const pw = g.canvas.width, ph = g.canvas.height;
      if (src.width !== pw || src.height !== ph) { src.width = pw; src.height = ph; }
      const sc = src.getContext('2d'); sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, pw, ph); sc.drawImage(g.canvas, 0, 0);
      const ctx = g.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.arc(mx * scale, my * scale, r * scale, 0, Math.PI * 2); ctx.clip('evenodd');
      ctx.filter = `blur(${(blur * scale).toFixed(2)}px)`; ctx.drawImage(src, 0, 0); ctx.filter = 'none';
      ctx.restore();
    }
    g.ring(mx, my, r, 'rgba(143,211,255,0.55)', 1);
    g.ring(mx, my, r * 0.5, 'rgba(143,211,255,0.22)', 1);
    const c = 3 + (1 - t) * 3;
    g.line(mx - r, my, mx - c, my, 'rgba(143,211,255,0.8)', 1);
    g.line(mx + c, my, mx + r, my, 'rgba(143,211,255,0.8)', 1);
    g.line(mx, my - r, mx, my - c, 'rgba(143,211,255,0.8)', 1);
    g.line(mx, my + c, mx, my + r, 'rgba(143,211,255,0.8)', 1);
    g.circle(mx, my, 0.8, 'rgba(143,211,255,0.9)');
  }

  _drawCrosshair(g) {
    const { x, y } = this.input.mouse;
    const p = this.player;
    let gap = 1;
    if (this.settings.spread && p.alive) {
      const def = p.curDef();
      const move = p.moving ? SPREAD.move[spreadCat(def)] * (p.walking ? 0.5 : 1) : 0;
      gap = 1 + (def.spread * 0.25 + move + p.heat + p.recoil * 0.6 + (p.blind > 0 ? 0.25 : 0)) * 40;
    }
    gap = Math.min(9, gap);
    const i = gap, o = gap + 3;
    g.line(x - o, y, x - i, y, 'rgba(255,255,255,0.8)', 1);
    g.line(x + i, y, x + o, y, 'rgba(255,255,255,0.8)', 1);
    g.line(x, y - o, x, y - i, 'rgba(255,255,255,0.8)', 1);
    g.line(x, y + i, x, y + o, 'rgba(255,255,255,0.8)', 1);
  }
}
