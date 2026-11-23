/** Names of the interface and battle sounds. */
export type SoundName =
  | 'select'
  | 'ackMove'
  | 'ackAttack'
  | 'ackWork'
  | 'error'
  | 'bullet'
  | 'cannon'
  | 'artillery'
  | 'flak'
  | 'explosion'
  | 'delivered'
  | 'constructed'
  | 'revealed';

interface ToneSpec {
  readonly freq: number;
  readonly to?: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly gain: number;
  readonly delay?: number;
}

interface NoiseSpec {
  readonly duration: number;
  readonly filter: number;
  readonly gain: number;
}

interface SoundSpec {
  readonly tones?: readonly ToneSpec[];
  readonly noise?: NoiseSpec;
  /** Minimum seconds between two plays of the same sound. */
  readonly throttle: number;
}

const SOUNDS: Readonly<Record<SoundName, SoundSpec>> = {
  select: { tones: [{ freq: 880, to: 1320, duration: 0.06, type: 'square', gain: 0.05 }], throttle: 0.05 },
  ackMove: {
    tones: [
      { freq: 520, duration: 0.07, type: 'triangle', gain: 0.12 },
      { freq: 780, duration: 0.09, type: 'triangle', gain: 0.12, delay: 0.07 },
    ],
    throttle: 0.1,
  },
  ackAttack: {
    tones: [
      { freq: 300, duration: 0.08, type: 'sawtooth', gain: 0.07 },
      { freq: 220, duration: 0.12, type: 'sawtooth', gain: 0.07, delay: 0.08 },
    ],
    throttle: 0.1,
  },
  ackWork: {
    tones: [
      { freq: 660, duration: 0.06, type: 'sine', gain: 0.12 },
      { freq: 990, duration: 0.08, type: 'sine', gain: 0.1, delay: 0.06 },
    ],
    throttle: 0.1,
  },
  error: { tones: [{ freq: 140, duration: 0.18, type: 'square', gain: 0.06 }], throttle: 0.2 },
  bullet: { noise: { duration: 0.05, filter: 3200, gain: 0.08 }, throttle: 0.06 },
  flak: { noise: { duration: 0.08, filter: 1800, gain: 0.08 }, throttle: 0.08 },
  cannon: { noise: { duration: 0.22, filter: 600, gain: 0.22 }, throttle: 0.1 },
  artillery: {
    noise: { duration: 0.35, filter: 400, gain: 0.25 },
    tones: [{ freq: 90, to: 40, duration: 0.3, type: 'sine', gain: 0.2 }],
    throttle: 0.15,
  },
  explosion: {
    noise: { duration: 0.6, filter: 500, gain: 0.35 },
    tones: [{ freq: 70, to: 30, duration: 0.5, type: 'sine', gain: 0.3 }],
    throttle: 0.12,
  },
  delivered: {
    tones: [
      { freq: 1046, duration: 0.07, type: 'sine', gain: 0.05 },
      { freq: 1568, duration: 0.1, type: 'sine', gain: 0.04, delay: 0.06 },
    ],
    throttle: 0.4,
  },
  constructed: {
    tones: [
      { freq: 392, duration: 0.1, type: 'triangle', gain: 0.12 },
      { freq: 523, duration: 0.1, type: 'triangle', gain: 0.12, delay: 0.1 },
      { freq: 784, duration: 0.18, type: 'triangle', gain: 0.12, delay: 0.2 },
    ],
    throttle: 0.3,
  },
  revealed: { tones: [{ freq: 1200, to: 600, duration: 0.25, type: 'sine', gain: 0.07 }], throttle: 0.5 },
};

/**
 * Original procedurally synthesised sound effects (no audio assets). Audio starts only after a
 * user gesture, as browsers require, and each sound is rate-limited to avoid noise during battles.
 */
export class SoundBoard {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<SoundName, number>();
  enabled = true;

  /** Must be called from a user gesture handler. */
  unlock(): void {
    if (this.context || typeof AudioContext === 'undefined') return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.context.destination);
    this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  play(name: SoundName, volume = 1): void {
    const context = this.context;
    if (!this.enabled || !context || !this.master || volume <= 0.01) return;
    const spec = SOUNDS[name];
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < spec.throttle) return;
    this.lastPlayed.set(name, now);
    for (const tone of spec.tones ?? []) this.tone(context, tone, volume, now);
    if (spec.noise) this.noise(context, spec.noise, volume, now);
  }

  private tone(context: AudioContext, spec: ToneSpec, volume: number, now: number): void {
    const start = now + (spec.delay ?? 0);
    const oscillator = context.createOscillator();
    oscillator.type = spec.type;
    oscillator.frequency.setValueAtTime(spec.freq, start);
    if (spec.to) oscillator.frequency.exponentialRampToValueAtTime(spec.to, start + spec.duration);
    const gain = this.envelope(context, spec.gain * volume, start, spec.duration);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + spec.duration + 0.02);
  }

  private noise(context: AudioContext, spec: NoiseSpec, volume: number, now: number): void {
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = spec.filter;
    source.connect(filter);
    filter.connect(this.envelope(context, spec.gain * volume, now, spec.duration));
    source.start(now, Math.random() * 0.5);
    source.stop(now + spec.duration + 0.02);
  }

  private envelope(context: AudioContext, peak: number, start: number, duration: number): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.master!);
    return gain;
  }
}
