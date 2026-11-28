// 程序化音效：全部由 WebAudio 合成，零外部素材，保证原创
export class Audio {
  constructor() { this.ctx = null; this.master = null; this.muted = false; this.noise = null; this.vol = 1; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32 * this.vol;
    this.master.connect(this.ctx.destination);
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
  }
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = 0.32 * v; }
  toggle() { this.muted = !this.muted; return this.muted; }

  _env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  _noise(t, dur, freq, peak, type = 'lowpass') {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain(); this._env(g, t, 0.002, dur, peak);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }
  _tone(t, freq, dur, peak, type = 'square', slideTo) {
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain(); this._env(g, t, 0.003, dur, peak);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _ok() { return this.ctx && !this.muted; }

  shot(kind) {
    if (!this._ok()) return; const t = this.ctx.currentTime;
    const cfg = { sniper: [1100, 0.28, 0.9, 80], rifle: [2200, 0.10, 0.55, 150], smg: [2800, 0.07, 0.45, 180], pistol: [3000, 0.08, 0.5, 170] }[kind] || [2500, 0.08, 0.5, 160];
    this._noise(t, cfg[1], cfg[0], cfg[2]);
    this._tone(t, cfg[3], 0.10, 0.28, 'square', 40);
  }
  reload() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tone(t, 320, 0.05, 0.2, 'square'); this._tone(t + 0.12, 220, 0.06, 0.2, 'square'); }
  hit() { if (!this._ok()) return; this._tone(this.ctx.currentTime, 520, 0.05, 0.25, 'square', 300); }
  kill() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tone(t, 700, 0.06, 0.3, 'square'); this._tone(t + 0.07, 1050, 0.09, 0.3, 'square'); }
  hurt() { if (!this._ok()) return; this._noise(this.ctx.currentTime, 0.12, 700, 0.4); }
  beep(high) { if (!this._ok()) return; this._tone(this.ctx.currentTime, high ? 1400 : 900, 0.05, 0.22, 'square'); }
  plant() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tone(t, 400, 0.08, 0.25, 'sawtooth'); this._tone(t + 0.1, 600, 0.1, 0.25, 'sawtooth'); }
  defuse() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tone(t, 500, 0.07, 0.25, 'square'); this._tone(t + 0.09, 750, 0.12, 0.25, 'square'); }
  explosion() { if (!this._ok()) return; const t = this.ctx.currentTime; this._noise(t, 0.7, 500, 1.0); this._tone(t, 70, 0.6, 0.6, 'sine', 30); }
  footstep() { if (!this._ok()) return; this._noise(this.ctx.currentTime, 0.04, 500, 0.10); }
  throwWhoosh() { if (!this._ok()) return; this._noise(this.ctx.currentTime, 0.13, 1100, 0.16, 'bandpass'); }
  nadeBounce() { if (!this._ok()) return; this._noise(this.ctx.currentTime, 0.05, 850, 0.16); }
  slash() { if (!this._ok()) return; const t = this.ctx.currentTime; this._noise(t, 0.09, 5200, 0.35, 'highpass'); this._tone(t, 1800, 0.08, 0.2, 'sawtooth', 500); }
  ui() { if (!this._ok()) return; this._tone(this.ctx.currentTime, 660, 0.04, 0.18, 'square'); }
  buy() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tone(t, 880, 0.05, 0.2, 'square'); this._tone(t + 0.06, 1320, 0.07, 0.2, 'square'); }
  win() { if (!this._ok()) return; const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => this._tone(t + i * 0.12, f, 0.16, 0.25, 'square')); }
  lose() { if (!this._ok()) return; const t = this.ctx.currentTime; [440, 349, 262].forEach((f, i) => this._tone(t + i * 0.16, f, 0.22, 0.25, 'sawtooth')); }
}
