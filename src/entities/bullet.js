import { tileAt } from '../engine/collision.js';

export class Bullet {
  constructor(x, y, angle, def, owner) {
    this.x = x; this.y = y;
    this.dx = Math.cos(angle); this.dy = Math.sin(angle);
    this.speed = def.speed; this.dmg = def.dmg; this.range = def.range;
    this.team = owner.team; this.owner = owner; this.kill = def.kill ?? 300;
    this.travel = 0; this.alive = true; this.kind = def.id;
  }
  update(dt, game) {
    let remaining = this.speed * dt;
    const step = 4;
    while (remaining > 0 && this.alive) {
      const s = Math.min(step, remaining); remaining -= s;
      this.x += this.dx * s; this.y += this.dy * s; this.travel += s;
      if (this.travel >= this.range) { this.alive = false; break; }
      if (tileAt(game.map, this.x, this.y)) { this.alive = false; game.impact(this.x, this.y); break; }
      for (const a of game.actors) {
        const dy = this.y - a.y;
        if (a.alive && a.team !== this.team && a !== this.owner && Math.abs(a.x - this.x) < a.radius + 1 && dy > -23 && dy < 3) {
          // 受击框上段对应 sprite 头部（头顶 -23、头底 ≈ -16），头盔只在这一段生效
          game.damage(this.owner, a, this.dmg, this.kill, false, dy < -15);
          this.alive = false; break;
        }
      }
    }
  }
}
