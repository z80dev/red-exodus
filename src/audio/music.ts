import type { Mood } from './index';
import { glide, midi, Synth } from './synth';
import type { Timbre } from './synth';

const PALETTES: readonly { lead: Timbre; pad: Timbre; root: number; scale: readonly number[] }[] = [
  { lead: 'piano', pad: 'synth', root: 50, scale: [0, 2, 3, 5, 7, 9, 10] },
  { lead: 'piano', pad: 'synth', root: 53, scale: [0, 2, 4, 5, 7, 9, 11] },
  { lead: 'piano', pad: 'synth', root: 48, scale: [0, 2, 3, 5, 7, 8, 10] },
  { lead: 'harp', pad: 'synth', root: 55, scale: [0, 2, 4, 5, 7, 9, 11] },
  { lead: 'piano', pad: 'strings', root: 48, scale: [0, 2, 3, 5, 7, 9, 10] },
  { lead: 'piano', pad: 'synth', root: 50, scale: [0, 2, 4, 6, 7, 9, 11] },
];
const TEMPO: Record<Mood, number> = { menu: 54, calm: 58, tension: 68, war: 78, crisis: 72, chronicle: 84, victory: 64, defeat: 46 };
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
  private stormIntensity = 0;
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
  setStormIntensity(value: number): void {
    this.stormIntensity = Math.max(0, Math.min(1, value));
  }
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
      const chordVoices = Math.min(3, 1 + Math.floor(era / 2));
      for (let i = 0; i < chordVoices; i++) {
        s.tone(target, p.pad, { at: at + i * 0.045, duration: beat * 10, frequency: midi(note(chord + i * 2) - 12), gain: 0.026, attack: beat * 1.8, pan: (i - 1) * 0.52, cutoff: dark ? 600 : 1250 });
      }
      s.tone(target, 'sine', { at, duration: beat * 9, frequency: midi(note(chord) - 24), gain: 0.035, attack: 0.8 });
    }
    const space = mood === 'menu' || mood === 'defeat' ? 4 : urgent ? (mood === 'crisis' ? 2 : 1) : era < 2 ? 4 : 3;
    if (step % space === 0 && (step % 16 < 12 || urgent)) {
      const pattern = [0, 4, 2, 4, 6, 4, 2, 1];
      const degree = chord + pattern[Math.floor(step / space) % 8];
      const frequency = midi(note(degree) + (era >= 3 ? 12 : 0));
      const o = { at, duration: beat * (era >= 4 ? 2.5 : 2), frequency, gain: (0.038 + Math.random() * 0.007) * intensity, pan: Math.sin(step * 0.6) * 0.48, attack: 0.012 };
      s.tone(target, p.lead, o);
      if (era >= 3 && step % 8 === 0) s.tone(target, 'piano', { ...o, frequency: frequency / 2, gain: 0.022, duration: beat * 2.4, attack: 0.08 });
      if (era >= 5 && step % 16 === 8) s.tone(target, 'synth', { ...o, frequency: frequency * 2, gain: 0.015, duration: beat * 3, attack: 0.2, pan: -o.pan });
    }
    if (urgent && step % (mood === 'crisis' ? 8 : 4) === 0) {
      s.tone(target, 'sine', { at, frequency: mood === 'crisis' ? 92 : 125, endFrequency: 48, duration: 0.7, gain: 0.055 * intensity });
    }
    // Finite low-pass wind beds avoid persistent loops while storm proximity swells the mix.
    if (step % 24 === 0) {
      const wind = this.stormIntensity;
      s.noise(target, { at, frequency: dark ? 290 : 540, endFrequency: 145, duration: beat * (12 + wind * 8), attack: beat * 4, gain: 0.018 + wind * 0.075, pan: -0.55 }, 'lowpass');
      s.noise(target, { at: at + beat * 2, frequency: 980, endFrequency: 380, duration: beat * 8, attack: beat * 3, gain: 0.012 + wind * 0.035, pan: 0.65 }, 'lowpass');
      if (era >= 2 && step % 48 === 0) s.fm(target, { at: at + beat, duration: 0.08, frequency: midi(era >= 4 ? 88 : 81), gain: 0.009, pan: 0.2 }, 3.7, 0.08);
      if (!dark && mood !== 'chronicle' && era >= 1) {
        s.tone(target, 'sine', { at: at + 1.2, frequency: 1700 + era * 80, endFrequency: 2200 + era * 100, duration: 0.12, gain: 0.006, pan: 0.65 });
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
