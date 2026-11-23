/**
 * Procedural Web Audio API Sound Synthesizer
 * Zero external audio files — every sound is synthesized in real time.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private ready(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  playPropMorph(toProp: boolean): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Snappy pitch-sweep pop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(toProp ? 220 : 540, now);
    osc.frequency.exponentialRampToValueAtTime(toProp ? 680 : 210, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);

    // Filtered noise puff
    this.playNoiseBurst(ctx, 0.11, toProp ? 1600 : 1100, 0.11);
  }

  playSnapAlign(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.055);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playGoldPickup(countAfterPickup: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const basePitch = 523.25 * Math.pow(1.12, Math.max(0, countAfterPickup - 1));
    const notes = [basePitch, basePitch * 1.25, basePitch * 1.5];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.065;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playExitUnlock(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [392.0, 493.88, 587.33, 783.99];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.05;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  playFootstep(sprinting: boolean): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const jitter = 0.92 + Math.random() * 0.16;
    osc.type = 'sine';
    osc.frequency.setValueAtTime((sprinting ? 145 : 115) * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.055);
    gain.gain.setValueAtTime(sprinting ? 0.09 : 0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playSprint(): void {
    const ctx = this.ready();
    if (!ctx) return;
    this.playNoiseBurst(ctx, 0.22, 950, 0.12);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  playScannerPulse(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1120, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.18);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  playWrongPropBuzzer(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.16].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + offset;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(135, t);
      osc.frequency.linearRampToValueAtTime(102, t + 0.13);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  playArrestSiren(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.linearRampToValueAtTime(980, now + 0.22);
    osc.frequency.linearRampToValueAtTime(620, now + 0.44);
    osc.frequency.linearRampToValueAtTime(1040, now + 0.68);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.04);
    gain.gain.setValueAtTime(0.16, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.88);
  }

  playVictoryFanfare(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.085;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  playCountdownTick(accent: boolean): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 880 : 620, now);
    gain.gain.setValueAtTime(accent ? 0.18 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (accent ? 0.16 : 0.075));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (accent ? 0.18 : 0.08));
  }

  private playNoiseBurst(
    ctx: AudioContext,
    duration: number,
    cutoffHz: number,
    volume: number,
  ): void {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoffHz;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }
}

export const soundEngine = new SoundEngine();
