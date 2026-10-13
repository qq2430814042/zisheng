// audio.js — 程序化音效：五声音阶，四种音色可选（待机静音，无常驻环境铺底）
export const TIMBRES = [
  { id: "qin", label: "古琴" },
  { id: "zhong", label: "编钟" },
  { id: "xiao", label: "洞箫" },
  { id: "shui", label: "水滴" },
];

export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.timbre = "qin";
  }

  async enable() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        const ctx = new Ctx();
        this.ctx = ctx;
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        this.master = master;
      }
      await this.ctx.resume();
      this.enabled = true;
      this.master.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.6);
      return true;
    } catch (e) {
      return false;
    }
  }

  disable() {
    if (!this.ctx || !this.master) return;
    this.enabled = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  setTimbre(name) {
    if (!TIMBRES.some((t) => t.id === name)) return false;
    this.timbre = name;
    return true;
  }

  pluck(freq) {
    if (!this.enabled || !this.ctx) return;
    try {
      const f = freq * (1 + (Math.random() - 0.5) * 0.006); // 轻微失谐，去掉电味
      if (this.timbre === "zhong") this._zhong(f);
      else if (this.timbre === "xiao") this._xiao(f);
      else if (this.timbre === "shui") this._shui(f);
      else this._qin(f);
    } catch (e) {
      /* ignore */
    }
  }

  // 通用增益包络：快起 → 指数衰减
  _env(t, attack, peak, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  // 古琴：拨弦 + 柔和低八度共鸣
  _qin(freq) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const g = this._env(t, 0.012, 0.2, 1.7);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    o.connect(g);
    g.connect(lp);
    lp.connect(this.master);
    o.start(t);
    o.stop(t + 1.8);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = freq / 2;
    const sg = this._env(t, 0.04, 0.055, 2.2);
    sub.connect(sg);
    sg.connect(this.master);
    sub.start(t);
    sub.stop(t + 2.3);
  }

  // 编钟：非谐 FM 金属声 + 高频泛音
  _zhong(freq) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const car = ctx.createOscillator();
    car.type = "sine";
    car.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.value = freq * 2.76;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(freq * 1.4, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.02, t + 1.1);
    mod.connect(mg);
    mg.connect(car.frequency);
    const g = this._env(t, 0.006, 0.17, 2.4);
    car.connect(g);
    g.connect(this.master);

    const part = ctx.createOscillator();
    part.type = "sine";
    part.frequency.value = freq * 4.1;
    const pg = this._env(t, 0.004, 0.03, 1.3);
    part.connect(pg);
    pg.connect(this.master);

    car.start(t);
    car.stop(t + 2.6);
    mod.start(t);
    mod.stop(t + 2.6);
    part.start(t);
    part.stop(t + 1.5);
  }

  // 洞箫：缓起，双管微失谐 + 轻颤音
  _xiao(freq) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = this._env(t, 0.09, 0.15, 1.25);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1700;
    [
      [freq, 1],
      [freq * 1.004, 0.6],
    ].forEach(([f, amp]) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 5.1;
      const lg = ctx.createGain();
      lg.gain.value = 3.2;
      lfo.connect(lg);
      lg.connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og);
      og.connect(g);
      o.start(t);
      o.stop(t + 1.5);
      lfo.start(t);
      lfo.stop(t + 1.5);
    });
    g.connect(lp);
    lp.connect(this.master);
  }

  // 水滴：下滑音 + 轻泛音
  _shui(freq) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 2.3, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
    const g = this._env(t, 0.005, 0.2, 0.8);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 1);

    const oct = ctx.createOscillator();
    oct.type = "sine";
    oct.frequency.value = freq * 2;
    const og = this._env(t, 0.004, 0.035, 0.5);
    oct.connect(og);
    og.connect(this.master);
    oct.start(t);
    oct.stop(t + 0.7);
  }
}

// 五声音阶（宫商角徵羽）
export const NOTES = {
  gong: 261.63,
  shang: 293.66,
  jue: 329.63,
  zhi: 392.0,
  yu: 440.0,
  gongHigh: 523.25,
};
