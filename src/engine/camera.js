import { VIEW_W, VIEW_H } from '../config.js';
import { clamp } from './math.js';

// 等距 45°（2:1 diamond）投影：sx = (x - y)，sy = (x + y)/2 - z
export class Camera {
  constructor() { this.x = 0; this.y = 0; this.zoom = 1; }
  follow(tx, ty, mapW, mapH, dt = 1) {
    const vw = VIEW_W / this.zoom, vh = VIEW_H / this.zoom;
    const cx = tx - ty, cy = (tx + ty) / 2;
    const minX = -mapH, maxX = mapW, minY = 0, maxY = (mapW + mapH) / 2;
    const gx = clamp(cx, minX + vw / 2, maxX - vw / 2);
    const gy = clamp(cy, minY + vh / 2, maxY - vh / 2);
    const k = Math.min(1, dt * 10);
    this.x += (gx - vw / 2 - this.x) * k;
    this.y += (gy - vh / 2 - this.y) * k;
  }
  worldToScreen(x, y, z = 0) { return [(x - y) - this.x, (x + y) / 2 - z - this.y]; }
  screenToWorld(sx, sy) { const a = sx + this.x, b = sy + this.y; return [(a + 2 * b) / 2, (2 * b - a) / 2]; }
  screenDirToWorld(sx, sy) { return [(sx + 2 * sy) / 2, (2 * sy - sx) / 2]; }
}
