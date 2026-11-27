import { VIEW_W, VIEW_H } from '../config.js';

const PREVENT = new Set(['KeyB', 'KeyE', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Space', 'Tab', 'ShiftLeft']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, clicked: false };

    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (PREVENT.has(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    canvas.addEventListener('mousemove', (e) => this._move(e));
    canvas.addEventListener('mousedown', (e) => {
      this._move(e);
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _move(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width * VIEW_W;
    this.mouse.y = (e.clientY - r.top) / r.height * VIEW_H;
  }

  down(code) { return this.keys.has(code); }
  justPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; }
}
