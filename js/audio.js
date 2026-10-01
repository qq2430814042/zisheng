// audio.js — 程序化音景：环境铺底 + 五声音阶拨弦
export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
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

        const padGain = ctx.createGain();
        padGain.gain.value = 0.05;
        padGain.connect(master);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 420;
        filter.connect(padGain);
        [110, 164.81, 220].forEach((f, i) => {
          const o = ctx.createOscillator();
          o.type = i === 2 ? "sine" : "triangle";
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.value = 0.33;
          o.connect(g);
          g.connect(filter);
          o.start();
        });
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lg = ctx.createGain();
        lg.gain.value = 0.02;
        lfo.connect(lg);
        lg.connect(padGain.gain);
        lfo.start();
      }
      await this.ctx.resume();
      this.enabled = true;
      this.master.gain.setTargetAtTime(0.6, this.ctx.currentTime, 1.2);
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

  pluck(freq) {
    if (!this.enabled || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      o.connect(g);
      g.connect(lp);
      lp.connect(this.master);
      o.start(t);
      o.stop(t + 1.8);
    } catch (e) {
      /* ignore */
    }
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
