import type { Mood } from './index';
import { glide, midi, Synth } from './synth';
import type { Timbre } from './synth';

const PALETTES: readonly { lead: Timbre; pad: Timbre; root: number; scale: readonly number[] }[] = [
  { lead: 'lyre', pad: 'flute', root: 50, scale: [0, 2, 3, 5, 7, 9, 10] },
  { lead: 'harp', pad: 'flute', root: 53, scale: [0, 2, 4, 5, 7, 9, 11] },
  { lead: 'bell', pad: 'organ', root: 48, scale: [0, 2, 3, 5, 7, 8, 10] },
  { lead: 'lute', pad: 'strings', root: 55, scale: [0, 2, 4, 5, 7, 9, 11] },
  { lead: 'piano', pad: 'brass', root: 48, scale: [0, 2, 3, 5, 7, 9, 10] },
  { lead: 'synth', pad: 'synth', root: 50, scale: [0, 2, 4, 6, 7, 9, 11] },
];
const TEMPO: Record<Mood, number> = { menu: 60, calm: 70, tension: 82, war: 100, crisis: 88, chronicle: 106, victory: 78, defeat: 48 };
const PROGRESSION = [0, 3, 5, 4, 0, 5, 3, 4];
interface Layer { gain: GainNode; mood: Mood; era: number; step: number; next: number; retire: number }

/** Audio-clock lookahead: suspended/background time never queues a burst of missed notes. */
export class Score {
  private synth: Synth;
  private destination: AudioNode;
  private layers: Layer[] = [];
  private timer: number | undefined;
  private mood: Mood = 'menu';
  private era = 0;
  private rise = 0;
  private slammed = false;
  constructor(synth: Synth, destination: AudioNode) { this.synth = synth; this.destination = destination; }
  get layerCount(): number { return this.layers.length; }
  get schedulerRunning(): boolean { return this.timer !== undefined; }
  start(): void {
    if (this.timer) return;
    this.transition(this.mood, this.era);
    this.timer = window.setInterval(() => this.schedule(), 40);
    this.schedule();
  }
  set(mood: Mood, era: number): void {
    if (mood === this.mood && era === this.era) return;
    this.mood = mood;
    this.era = era;
    this.rise = 0;
    this.slammed = false;
    if (this.timer) this.transition(mood, era);
  }
  chronicleProgress(progress: number): void { this.rise = Math.max(0, Math.min(1, progress)); }
  slam(): void {
    if (this.mood !== 'chronicle') return;
    this.slammed = true;
    const now = this.synth.context.currentTime;
    for (const layer of this.layers) glide(layer.gain.gain, 0, now, 0.025);
  }
  private transition(mood: Mood, era: number): void {
    const c = this.synth.context;
    const now = c.currentTime;
    for (const layer of this.layers) {
      // Once retired, never prolong its lifetime on repeated mood switches.
      if (layer.retire !== Infinity) continue;
      glide(layer.gain.gain, 0, now, 1.4);
      layer.retire = now + 1.5;
    }
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(this.destination);
    glide(gain.gain, 0.8, now, 1.8);
    this.layers.push({ gain, mood, era, step: 0, next: now + 0.06, retire: Infinity });
    // Rapid clicking cannot retain unbounded graphs, even with a suspended context.
    while (this.layers.length > 4) this.layers.shift()!.gain.disconnect();
  }
  private schedule(): void {
    const c = this.synth.context;
    if (c.state !== 'running') return;
    const now = c.currentTime;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (layer.retire <= now) { layer.gain.disconnect(); this.layers.splice(i, 1); continue; }
      if (layer.retire !== Infinity || (layer.mood === 'chronicle' && this.slammed)) continue;
      if (layer.next < now) layer.next = now + 0.025;
      const beat = 60 / TEMPO[layer.mood];
      while (layer.next < now + 0.18) {
        this.step(layer, beat);
        layer.next += beat / 2;
        layer.step++;
      }
    }
  }
  private step(layer: Layer, beat: number): void {
    const { gain: target, mood, era, step } = layer;
    const p = PALETTES[era];
    const dark = mood === 'crisis' || mood === 'war' || mood === 'defeat' || mood === 'tension';
    const scale = dark ? (era === 0 || mood === 'crisis' ? [0, 1, 3, 5, 7, 8, 10] : [0, 2, 3, 5, 7, 8, 10]) : p.scale;
    const chord = PROGRESSION[Math.floor(step / 16) % PROGRESSION.length];
    const note = (degree: number) => p.root + scale[((degree % 7) + 7) % 7] + Math.floor(degree / 7) * 12;
    const at = layer.next + Math.random() * 0.012;
    const s = this.synth;
    const urgent = mood === 'war' || mood === 'crisis' || mood === 'chronicle';
    const intensity = mood === 'chronicle' ? 0.4 + this.rise * 0.6 : 1;
    if (step % 16 === 0) {
      for (let i = 0; i < 3; i++) {
        s.tone(target, p.pad, { at: at + i * 0.032, duration: beat * 9, frequency: midi(note(chord + i * 2) - 12), gain: 0.035, attack: beat * 1.2, pan: (i - 1) * 0.52, cutoff: dark ? 850 : 1800 });
      }
      s.tone(target, 'sine', { at, duration: beat * 8, frequency: midi(note(chord) - 24), gain: 0.04, attack: 0.5 });
    }
    const space = mood === 'menu' || mood === 'defeat' ? 4 : (urgent || era === 1 || era === 5 ? 1 : 2);
    if (step % space === 0 && (step % 16 < 12 || urgent)) {
      const pattern = [0, 4, 2, 4, 6, 4, 2, 1];
      const degree = chord + pattern[Math.floor(step / space) % 8];
      const frequency = midi(note(degree) + (era === 2 ? 12 : 0));
      const o = { at, duration: beat * (era === 2 ? 2.8 : 1.8), frequency, gain: (0.043 + Math.random() * 0.012) * intensity, pan: Math.sin(step * 0.6) * 0.55, attack: era === 5 ? 0.04 : 0.007 };
      if (era === 2) s.fm(target, o, 2.01, 0.15);
      else s.tone(target, p.lead, o);
      if (era === 4 && step % 8 === 0) s.tone(target, 'brass', { ...o, frequency: frequency / 2, gain: 0.03, duration: 0.6, attack: 0.09 });
    }
    if ((urgent && step % 4 === 0) || (era === 0 && step % 8 === 0)) {
      s.tone(target, 'sine', { at, frequency: urgent ? 125 : 160, endFrequency: 48, duration: 0.45, gain: 0.095 * intensity });
      s.noise(target, { at, frequency: 550, duration: 0.14, gain: 0.045 * intensity }, 'lowpass');
    }
    if (urgent && step % (mood === 'chronicle' && this.rise > 0.65 ? 1 : 2) === 1) {
      s.noise(target, { at, frequency: 2300, duration: 0.07, gain: 0.025 * intensity, pan: step % 4 === 1 ? -0.35 : 0.35 });
    }
    // Camera-independent atmosphere, rendered as finite voices rather than persistent loops.
    if (step % 32 === 0) {
      s.noise(target, { at, frequency: dark ? 350 : 750, endFrequency: 280, duration: beat * 14, attack: beat * 4, gain: dark ? 0.045 : 0.025, pan: -0.6 }, 'lowpass');
      s.noise(target, { at: at + beat * 2, frequency: 1100, endFrequency: 500, duration: beat * 10, attack: beat * 3, gain: 0.017, pan: 0.7 });
      if (!dark && mood !== 'chronicle') {
        for (let j = 0; j < 3; j++) s.tone(target, 'sine', { at: at + 1.2 + j * 0.17, frequency: 1700 + j * 180, endFrequency: 2300 + j * 80, duration: 0.12, gain: 0.008, pan: 0.65 });
      }
    }
  }
  stop(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.layers.forEach(layer => layer.gain.disconnect());
    this.layers.length = 0;
  }
}
