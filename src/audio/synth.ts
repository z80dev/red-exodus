/** Bounded, self-cleaning WebAudio voices. No assets, worklets, or per-frame audio work. */
export type Timbre = 'lyre' | 'harp' | 'flute' | 'organ' | 'bell' | 'lute' | 'strings' | 'piano' | 'brass' | 'synth' | 'sine';
export interface VoiceOptions {
  at: number; duration: number; frequency: number; gain: number; pan?: number;
  attack?: number; cutoff?: number; endFrequency?: number;
}
const HARMONICS: Record<Timbre, readonly number[]> = {
  lyre: [1, 0.48, 0.19, 0.11, 0.05, 0.035],
  harp: [1, 0.3, 0.11, 0.045, 0.025],
  flute: [1, 0.06, 0.12, 0.02],
  organ: [1, 0.34, 0.22, 0.28, 0.09, 0.16, 0.035, 0.055],
  bell: [1, 0.08, 0.13],
  lute: [1, 0.55, 0.31, 0.16, 0.1, 0.08, 0.025],
  strings: [1, 0.48, 0.32, 0.24, 0.18, 0.15, 0.1, 0.08],
  piano: [1, 0.48, 0.17, 0.095, 0.065, 0.035],
  brass: [1, 0.7, 0.55, 0.4, 0.24, 0.1, 0.06],
  synth: [1, 0.18, 0.11, 0.04],
  sine: [1],
};
const PLUCKED: Partial<Record<Timbre, true>> = { lute: true, lyre: true, harp: true, piano: true };
export class Synth {
  readonly context: AudioContext;
  readonly noiseBuffer: AudioBuffer;
  private voices = new Map<AudioScheduledSourceNode, () => void>();
  private waves: Record<Timbre, PeriodicWave>;
  readonly maxVoices = 144;
  constructor(context: AudioContext) {
    this.context = context;
    this.waves = Object.fromEntries(Object.entries(HARMONICS).map(([name, partials]) => {
      const real = new Float32Array(partials.length + 1);
      const imaginary = new Float32Array(partials.length + 1);
      imaginary.set(partials, 1);
      return [name, context.createPeriodicWave(real, imaginary)];
    })) as Record<Timbre, PeriodicWave>;
    this.noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.025) / 1.025;
      data[i] = white * 0.65 + brown * 2;
    }
  }
  get activeVoices(): number { return this.voices.size; }
  private route(source: AudioScheduledSourceNode, target: AudioNode, o: VoiceOptions, nodes: AudioNode[] = []): void {
    const c = this.context;
    const envelope = c.createGain();
    const pan = c.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, o.pan ?? 0));
    const start = Math.max(c.currentTime, o.at);
    const duration = Math.max(0.025, o.duration);
    const attack = Math.min(duration * 0.45, o.attack ?? 0.008);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(Math.max(0, o.gain), start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.00001, start + duration);
    envelope.gain.linearRampToValueAtTime(0, start + duration + 0.012);
    const chain = [source, ...nodes, envelope, pan];
    chain.forEach((node, i) => node.connect(chain[i + 1] ?? target));
    const cleanup = () => { chain.forEach(node => node.disconnect()); this.voices.delete(source); };
    this.voices.set(source, cleanup);
    source.onended = cleanup;
    source.start(start);
    source.stop(start + duration + 0.025);
  }
  tone(target: AudioNode, timbre: Timbre, o: VoiceOptions): void {
    if (this.voices.size >= this.maxVoices) return;
    const c = this.context;
    const oscillator = c.createOscillator();
    const filter = c.createBiquadFilter();
    oscillator.setPeriodicWave(this.waves[timbre]);
    const start = Math.max(c.currentTime, o.at);
    const frequency = Math.max(20, Math.min(12000, o.frequency));
    oscillator.frequency.setValueAtTime(frequency, start);
    if (o.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, o.endFrequency), start + o.duration);
    filter.type = 'lowpass';
    const cutoff = o.cutoff ?? (PLUCKED[timbre] ? frequency * 7 : frequency * 3.5);
    filter.frequency.setValueAtTime(Math.min(15000, cutoff), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, Math.min(15000, cutoff * 0.4)), start + o.duration);
    filter.Q.value = timbre === 'brass' ? 1.2 : 0.4;
    this.route(oscillator, target, o, [filter]);
  }
  /** Two coupled sine partials create the metallic transient of coins, bells, and glass. */
  fm(target: AudioNode, o: VoiceOptions, ratio = 2.76, depth = 0.7): void {
    if (this.voices.size + 2 > this.maxVoices) return;
    const c = this.context;
    const carrier = c.createOscillator();
    const modulator = c.createOscillator();
    const modulation = c.createGain();
    const at = Math.max(c.currentTime, o.at);
    carrier.frequency.value = o.frequency;
    modulator.frequency.value = o.frequency * ratio;
    modulation.gain.setValueAtTime(o.frequency * depth, at);
    modulation.gain.exponentialRampToValueAtTime(0.01, at + o.duration);
    modulator.connect(modulation).connect(carrier.frequency);
    modulator.onended = () => { modulator.disconnect(); modulation.disconnect(); this.voices.delete(modulator); };
    this.voices.set(modulator, () => { modulator.disconnect(); modulation.disconnect(); });
    modulator.start(at);
    modulator.stop(at + o.duration + 0.025);
    this.route(carrier, target, o);
  }
  noise(target: AudioNode, o: VoiceOptions, type: BiquadFilterType = 'bandpass'): void {
    if (this.voices.size >= this.maxVoices) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(o.frequency, Math.max(this.context.currentTime, o.at));
    if (o.endFrequency) filter.frequency.exponentialRampToValueAtTime(o.endFrequency, o.at + o.duration);
    this.route(source, target, o, [filter]);
  }
  stop(): void {
    for (const [source, cleanup] of this.voices) {
      source.onended = null;
      source.stop();
      cleanup();
    }
    this.voices.clear();
  }
}

export function impulse(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 1.8);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      smooth = smooth * 0.6 + (Math.random() * 2 - 1) * 0.4;
      const t = i / length;
      data[i] = smooth * Math.pow(1 - t, 3.5) * Math.min(1, i / (context.sampleRate * 0.016));
    }
  }
  return buffer;
}

export const midi = (note: number): number => 440 * 2 ** ((note - 69) / 12);
export function glide(param: AudioParam, value: number, now: number, seconds = 0.08): void {
  param.cancelAndHoldAtTime(now);
  param.linearRampToValueAtTime(value, now + seconds);
}
