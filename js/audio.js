// Procedural Web Audio API Synthwave Soundtrack & Adaptive SFX Engine

const BASS_PATTERN = [
  73.42, 73.42, 146.83, 73.42,
  87.31, 73.42, 130.81, 116.54,
  73.42, 73.42, 146.83, 73.42,
  110.00, 98.00, 87.31, 77.78
];

const ARP_PATTERN = [
  293.66, 349.23, 440.00, 523.25,
  587.33, 523.25, 440.00, 349.23,
  293.66, 392.00, 466.16, 587.33,
  659.25, 587.33, 466.16, 440.00
];

export class ProceduralAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterFilter = null;
    this.compressor = null;
    this.delayNode = null;
    this.delayGain = null;
    this.analyser = null;
    this.noiseBuffer = null;
    this.spectrum = new Uint8Array(64);

    this.muted = false;
    this.playing = false;
    this.bpm = 132;
    this.stepTime = 60 / this.bpm / 4; // 16th note
    this.nextNoteTime = 0;
    this.currentStep = 0;
    this.timerId = null;

    // Adaptive combat state
    this.intensity = 0.2;
    this.combo = 1;
    this.bossActive = false;
    this.bulletTime = false;
    this._lastShotSound = 0;
    this._lastHitSound = 0;
    this._lastLaserSound = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.42;

      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 18000;
      this.masterFilter.Q.value = 1.2;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.15;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.78;
      this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);

      // Stereo / feedback delay bus for cosmic arps & chimes
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.value = (60 / this.bpm) * 0.75;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.36;
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2200;

      this.delayGain = this.ctx.createGain();
      this.delayGain.gain.value = 0.32;

      this.delayNode.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(this.delayNode);
      delayFilter.connect(this.delayGain);
      this.delayGain.connect(this.compressor);

      this.compressor.connect(this.masterFilter);
      this.masterFilter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Pre-generate 1.5s white noise buffer
      const sr = this.ctx.sampleRate;
      const length = Math.floor(sr * 1.5);
      this.noiseBuffer = this.ctx.createBuffer(1, length, sr);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  startMusic() {
    if (!this.init() || this.playing) return;
    this.playing = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.timerId = setInterval(() => this._scheduler(), 25);
  }

  stopMusic() {
    this.playing = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.03);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setCombatState({ intensity = 0.3, combo = 1, bossActive = false, bulletTime = false }) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    this.combo = combo;
    this.bossActive = bossActive;
    if (bulletTime !== this.bulletTime) {
      this.setBulletTime(bulletTime);
    }
  }

  setBulletTime(active) {
    this.bulletTime = active;
    if (!this.ctx || !this.masterFilter) return;
    const now = this.ctx.currentTime;
    const targetFreq = active ? 460 : 18000;
    this.masterFilter.frequency.cancelScheduledValues(now);
    this.masterFilter.frequency.setTargetAtTime(targetFreq, now, active ? 0.05 : 0.14);
  }

  _scheduler() {
    if (!this.playing || !this.ctx || this.ctx.state !== 'running') return;
    const lookahead = 0.11;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this._scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += this.stepTime;
      this.currentStep = (this.currentStep + 1) % 16;
    }
  }

  _scheduleStep(step, time) {
    if (this.muted) return;

    // 1. Punchy 4-on-the-floor Kick + syncopation during high intensity
    if (step % 4 === 0 || (this.intensity > 0.65 && step === 14)) {
      this._trigKick(time, step % 4 === 0 ? 0.68 : 0.42);
    }

    // 2. Breakbeat / Cyber Snare on 4 & 12
    if ((step === 4 || step === 12) && (this.intensity > 0.22 || this.bossActive)) {
      this._trigSnare(time, 0.25 + this.intensity * 0.2);
    }

    // 3. Crisp Hi-Hats
    if (step % 2 === 1 || this.intensity > 0.55) {
      const accent = step % 4 === 2 ? 0.16 : 0.07;
      this._trigHat(time, accent * (0.6 + this.intensity * 0.5));
    }

    // 4. Driving Acid / Reese Bassline
    const bassFreq = BASS_PATTERN[step];
    const playBass = step % 2 === 0 || this.intensity > 0.35 || this.bossActive;
    if (playBass) {
      const pitchShift = this.bulletTime ? 0.8909 : 1.0; // -2 semitones in bullet time
      this._trigBass(time, bassFreq * pitchShift, this.stepTime * (step % 2 === 0 ? 0.92 : 0.72));
    }

    // 5. Cosmic Ping-Pong Arp
    if (step % 2 === 0 || this.combo >= 8 || this.bossActive) {
      const arpFreq = ARP_PATTERN[step] * (this.bossActive && step % 4 === 0 ? 1.5 : 1.0);
      const pitchShift = this.bulletTime ? 0.5 : 1.0;
      this._trigArp(time, arpFreq * pitchShift, this.stepTime * 0.85);
    }
  }

  _trigKick(time, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  _trigSnare(time, vol) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1850;
    filter.Q.value = 1.1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    src.start(time);
    src.stop(time + 0.15);

    // Body punch
    const body = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(210, time);
    body.frequency.exponentialRampToValueAtTime(95, time + 0.08);
    bGain.gain.setValueAtTime(vol * 0.65, time);
    bGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    body.connect(bGain);
    bGain.connect(this.compressor);
    body.start(time);
    body.stop(time + 0.1);
  }

  _trigHat(time, vol) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7200;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    src.start(time);
    src.stop(time + 0.05);
  }

  _trigBass(time, freq, dur) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq, time);
    osc1.detune.value = -9;
    osc2.detune.value = 9;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const baseCutoff = 320 + this.intensity * 900 + Math.min(this.combo * 22, 900) + (this.bossActive ? 400 : 0);
    filter.frequency.setValueAtTime(baseCutoff * 1.4, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, baseCutoff * 0.45), time + dur);
    filter.Q.value = 5.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.02);
    osc2.stop(time + dur + 0.02);
  }

  _trigArp(time, freq, dur) {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const gain = this.ctx.createGain();
    const amp = 0.07 + this.intensity * 0.06;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(this.compressor);
    gain.connect(this.delayNode);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  _ready() {
    return this.ctx && !this.muted && this.ctx.state === 'running';
  }

  playShoot(type = 'pulse') {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (now - this._lastShotSound < 0.04) return;
    this._lastShotSound = now;

    if (type === 'tesla') {
      this.playLightning(0.35);
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'rail') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1180, now);
      osc.frequency.exponentialRampToValueAtTime(135, now + 0.22);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.compressor);
      gain.connect(this.delayNode);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'missile') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520 + Math.random() * 140, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.11);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      osc.type = 'square';
      const base = 760 + Math.random() * 120;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.075);
      gain.gain.setValueAtTime(0.085, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  }

  playLightning(scale = 0.6) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880 + Math.random() * 450, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.1);

    mod.type = 'square';
    mod.frequency.value = 75;
    modGain.gain.value = 320;
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.14 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    mod.start(now);
    osc.stop(now + 0.12);
    mod.stop(now + 0.12);
  }

  playExplosion(size = 1.0) {
    if (!this._ready() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const dur = Math.min(0.65, 0.18 + size * 0.22);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400 * Math.min(1.5, size), now);
    filter.frequency.exponentialRampToValueAtTime(90, now + dur);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(Math.min(0.45, 0.18 * size), now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.compressor);
    src.start(now);
    src.stop(now + dur + 0.02);

    // Sub impact thump
    const sub = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + dur * 0.85);
    sGain.gain.setValueAtTime(Math.min(0.5, 0.24 * size), now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.85);
    sub.connect(sGain);
    sGain.connect(this.compressor);
    sub.start(now);
    sub.stop(now + dur);
  }

  playDash() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.18);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.compressor);
    gain.connect(this.delayNode);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  playParry() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const notes = [1046.5, 1567.98, 2093.0, 2637.02];
    notes.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.022);
      gain.gain.setValueAtTime(0.18, now + i * 0.022);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.022 + 0.42);
      osc.connect(gain);
      gain.connect(this.compressor);
      gain.connect(this.delayNode);
      osc.start(now + i * 0.022);
      osc.stop(now + i * 0.022 + 0.44);
    });
    this.playExplosion(1.1);
  }

  playBlackHole() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const shimmer = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + 0.65);

    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(220, now);
    shimmer.frequency.exponentialRampToValueAtTime(660, now + 0.55);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

    sub.connect(gain);
    shimmer.connect(gain);
    gain.connect(this.compressor);
    gain.connect(this.delayNode);
    sub.start(now);
    shimmer.start(now);
    sub.stop(now + 0.75);
    shimmer.stop(now + 0.75);
  }

  playLevelUp() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const chord = [293.66, 349.23, 440.0, 523.25, 659.25];
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      osc.connect(gain);
      gain.connect(this.compressor);
      gain.connect(this.delayNode);
      osc.start(t);
      osc.stop(t + 0.78);
    });
  }

  playBossAlarm() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.34;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.linearRampToValueAtTime(440, t + 0.16);
      osc.frequency.linearRampToValueAtTime(190, t + 0.28);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);
      gain.connect(this.delayNode);
      osc.start(t);
      osc.stop(t + 0.31);
    }
  }

  playLaserLoop() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (now - this._lastLaserSound < 0.075) return;
    this._lastLaserSound = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(146.83 + Math.random() * 14, now);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  playHit() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (now - this._lastHitSound < 0.045) return;
    this._lastHitSound = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480 + Math.random() * 160, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.04);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  getAudioEnergy() {
    if (!this.analyser || !this.playing || this.muted) {
      return { bass: 0, mid: 0, high: 0, spectrum: this.spectrum };
    }
    this.analyser.getByteFrequencyData(this.spectrum);
    let bass = 0;
    let mid = 0;
    let high = 0;
    const len = this.spectrum.length;
    for (let i = 0; i < len; i++) {
      const v = this.spectrum[i] / 255;
      if (i < 6) bass += v;
      else if (i < 22) mid += v;
      else high += v;
    }
    return {
      bass: bass / 6,
      mid: mid / 16,
      high: high / Math.max(1, len - 22),
      spectrum: this.spectrum
    };
  }
}
