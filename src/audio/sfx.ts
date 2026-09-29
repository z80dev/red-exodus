import { midi, Synth } from './synth';
import type { Timbre } from './synth';

export const SFX_NAMES = [
  'click', 'tap', 'open', 'close', 'hover', 'error', 'buy', 'sell', 'reroll', 'cardFlip', 'cardDeal',
  'packOpen', 'chronicleTick', 'renownAdd', 'splendorAdd', 'splendorMul', 'scoreSlam', 'targetPass',
  'targetFail', 'triumph', 'mandateLoss', 'eraFanfare', 'crisisReveal', 'victory', 'defeat', 'endTurn',
  'levelUp', 'select', 'move', 'attack', 'found', 'build', 'research',
  'stormHowl', 'stormHit', 'podStreak', 'podImpact', 'thaw', 'breakthrough', 'cryo',
] as const;
export type KnownSfxName = typeof SFX_NAMES[number];
export const EVENT_SFX_NAMES = ['hooves', 'wheels', 'sail', 'arrows', 'cannon', 'unitDied', 'cityGrew', 'wonderBuilt', 'warDeclared', 'cityCaptured', 'borderGrew', 'campCleared', 'ruinExplored', 'doctrineTriggered'] as const;

/** Gain values are pre-mix: layers sum into the compressor and a hard-bounded soft limiter. */
export function playSfx(synth: Synth, target: AudioNode, name: string, pitch: number, volume: number): void {
  const at = synth.context.currentTime + 0.006;
  const ratio = Math.max(0.35, Math.min(3, pitch));
  const tone = (note: number, duration = 0.3, gain = 0.12, delay = 0, timbre: Timbre = 'sine', pan = 0) => {
    synth.tone(target, timbre, { at: at + delay, frequency: midi(note) * ratio, duration, gain: gain * volume, pan });
  };
  const chime = (note: number, delay = 0, gain = 0.1, duration = 0.65) => {
    synth.fm(target, { at: at + delay, frequency: midi(note) * ratio, duration, gain: gain * volume, pan: Math.sin(note) * 0.25 }, 2.01, 0.3);
  };
  const noise = (frequency: number, duration: number, gain: number, delay = 0, endFrequency?: number) => {
    synth.noise(target, { at: at + delay, frequency, duration, gain: gain * volume, endFrequency });
  };
  const impact = (gain = 0.3, delay = 0) => {
    synth.tone(target, 'sine', { at: at + delay, frequency: 155 * ratio, endFrequency: 38, duration: 0.5, gain: gain * volume });
    noise(720, 0.14, gain * 0.65, delay);
  };
  const fanfare = (notes: readonly number[], speed = 0.14, timbre: Timbre = 'piano') => {
    notes.forEach((note, i) => {
      tone(note, i === notes.length - 1 ? 1.4 : 0.42, 0.075, i * speed, timbre, -0.18);
      tone(note - 12, 0.7, 0.055, i * speed + 0.015, timbre, 0.18);
    });
    chime(notes[notes.length - 1] + 12, (notes.length - 1) * speed, 0.065, 1.3);
  };
  switch (name) {
    case 'hover': tone(84, 0.045, 0.025); break;
    case 'click': case 'tap': noise(2100, 0.018, 0.055); synth.fm(target, { at, duration: 0.075, frequency: midi(77) * ratio, gain: 0.045 * volume }, 3.2, 0.16); break;
    case 'select': tone(72, 0.1, 0.05, 0, 'synth'); chime(79, 0.035, 0.025, 0.18); break;
    case 'open': noise(1400, 0.16, 0.035, 0, 3200); tone(55, 0.22, 0.045, 0, 'synth'); tone(67, 0.2, 0.04, 0.04, 'synth'); break;
    case 'close': noise(1800, 0.12, 0.035, 0, 400); tone(55, 0.14, 0.04, 0, 'synth'); tone(48, 0.18, 0.035, 0.035, 'synth'); break;
    case 'error': tone(47, 0.17, 0.07, 0, 'synth'); tone(46, 0.16, 0.06, 0.12, 'synth'); break;
    case 'cardFlip': noise(3500, 0.045, 0.07, 0, 700); synth.fm(target, { at: at + 0.05, duration: 0.07, frequency: midi(65) * ratio, gain: 0.03 * volume }, 3.4, 0.12); break;
    case 'cardDeal': noise(1500, 0.075, 0.06, 0, 3500); tone(55, 0.08, 0.045, 0.065, 'synth'); break;
    case 'buy': [84, 91, 96].forEach((n, i) => chime(n, i * 0.065, 0.07, 0.4)); noise(5100, 0.08, 0.025); break;
    case 'sell': [91, 84, 79].forEach((n, i) => chime(n, i * 0.06, 0.065, 0.35)); break;
    case 'reroll': noise(350, 0.36, 0.12, 0, 6500); [72, 76, 79].forEach((n, i) => tone(n, 0.12, 0.055, 0.18 + i * 0.035, 'lyre')); break;
    case 'packOpen': noise(300, 0.6, 0.12, 0, 5500); impact(0.13, 0.18); [72, 79, 84, 88, 91].forEach((n, i) => chime(n, 0.22 + i * 0.075, 0.06, 1)); break;
    case 'chronicleTick': chime(84, 0, 0.08, 0.21); tone(96, 0.045, 0.025); break;
    case 'renownAdd': chime(79, 0, 0.12); chime(86, 0.065, 0.07); break;
    case 'splendorAdd': chime(72, 0, 0.12); tone(79, 0.5, 0.075, 0.06, 'harp'); break;
    case 'splendorMul': impact(0.27); noise(5300, 0.65, 0.07, 0.03); [76, 83, 88, 95].forEach((n, i) => chime(n, i * 0.045, 0.08, 1)); break;
    case 'scoreSlam': impact(0.45); impact(0.13, 0.08); noise(3200, 0.85, 0.09); [48, 55, 60, 67, 76].forEach(n => tone(n, 1.5, 0.06, 0.015, 'piano')); break;
    case 'targetPass': fanfare([60, 64, 67, 72]); break;
    case 'triumph': fanfare([60, 67, 72, 76, 79], 0.12); impact(0.15, 0.48); break;
    case 'victory': fanfare([60, 64, 67, 72, 71, 74, 79], 0.2); [60, 64, 67].forEach(n => tone(n, 3, 0.045, 1.1, 'synth')); break;
    case 'targetFail': fanfare([60, 56, 53, 48], 0.2, 'piano'); break;
    case 'defeat': fanfare([55, 53, 50, 43], 0.33, 'synth'); noise(380, 1.6, 0.06); break;
    case 'mandateLoss': noise(4400, 0.13, 0.2); noise(1700, 0.23, 0.13, 0.05); impact(0.18, 0.03); [79, 78, 67].forEach((n, i) => chime(n, i * 0.09, 0.06)); break;
    case 'eraFanfare': fanfare([55, 60, 64, 67, 72], 0.18); break;
    case 'crisisReveal': [36, 43, 49].forEach(n => tone(n, 2.3, 0.1, 0, 'synth')); noise(200, 1.5, 0.13, 0, 1900); impact(0.2, 0.25); break;
    case 'endTurn': tone(60, 0.2, 0.055, 0, 'synth'); synth.fm(target, { at: at + 0.085, duration: 0.08, frequency: midi(72) * ratio, gain: 0.035 * volume }, 3.4, 0.1); noise(850, 0.08, 0.025); break;
    case 'levelUp': fanfare([72, 76, 79, 84], 0.08, 'piano'); break;
    case 'found': impact(0.17); fanfare([48, 55, 60, 64, 67], 0.1, 'piano'); break;
    case 'build': noise(900, 0.1, 0.11); synth.fm(target, { at: at + 0.1, duration: 0.11, frequency: midi(55) * ratio, gain: 0.045 * volume }, 2.4, 0.18); chime(72, 0.16, 0.05); chime(79, 0.22, 0.04); break;
    case 'research': [72, 76, 83, 88].forEach((n, i) => chime(n, i * 0.1, 0.06)); tone(60, 0.75, 0.035, 0.1, 'synth'); break;
    case 'move': [0, 0.13].forEach(delay => { noise(650, 0.075, 0.055, delay); synth.fm(target, { at: at + delay, duration: 0.07, frequency: midi(37) * ratio, gain: 0.045 * volume }, 2.9, 0.14); }); break;
    case 'hooves': [0, 0.065, 0.19, 0.25].forEach(delay => { synth.fm(target, { at: at + delay, duration: 0.055, frequency: midi(49) * ratio, gain: 0.065 * volume }, 3.2, 0.12); noise(900, 0.028, 0.045, delay); }); break;
    case 'wheels': noise(450, 0.38, 0.1, 0, 700); tone(32, 0.3, 0.045, 0, 'synth'); break;
    case 'sail': noise(1100, 0.55, 0.09, 0, 400); break;
    case 'attack': noise(4000, 0.08, 0.15); synth.fm(target, { at, duration: 0.4, frequency: 730, gain: 0.1 * volume }, 1.41, 2); impact(0.16, 0.05); break;
    case 'arrows': noise(3000, 0.18, 0.12, 0, 650); noise(700, 0.08, 0.16, 0.16); break;
    case 'cannon': impact(0.38); noise(600, 0.8, 0.27, 0, 130); noise(3200, 0.08, 0.14); break;
    case 'unitDied': impact(0.12); noise(850, 0.35, 0.12, 0, 220); tone(42, 0.4, 0.045, 0.05, 'strings'); break;
    case 'cityGrew': chime(72, 0, 0.035, 0.5); chime(79, 0.12, 0.025, 0.6); break;
    case 'borderGrew': tone(79, 0.28, 0.025, 0, 'flute'); break;
    case 'wonderBuilt': [48, 55, 60, 64, 67, 72].forEach((n, i) => synth.tone(target, 'organ', { at: at + i * 0.06, duration: 3.8, attack: 0.9, frequency: midi(n), gain: 0.07 * volume, pan: (i / 5 - 0.5) * 1.2 })); fanfare([60, 67, 72], 0.28); break;
    case 'warDeclared': [0, 0.22, 0.44, 0.75].forEach(delay => impact(0.23, delay)); tone(36, 1.5, 0.08, 0, 'brass'); break;
    case 'cityCaptured': impact(0.25); fanfare([48, 55, 60], 0.16); break;
    case 'campCleared': impact(0.15); [79, 84, 88].forEach((n, i) => chime(n, 0.1 + i * 0.08, 0.06)); break;
    case 'ruinExplored': [67, 74, 79, 86].forEach((n, i) => chime(n, i * 0.15, 0.065, 1.2)); noise(2400, 0.65, 0.025); break;
    case 'doctrineTriggered': chime(88, 0, 0.025, 0.19); break;
    case 'stormHowl': noise(190, 2.8, 0.16, 0, 65); noise(420, 2.2, 0.08, 0.12, 120); break;
    case 'stormHit': noise(520, 0.85, 0.21, 0, 90); impact(0.28, 0.04); break;
    case 'podStreak': noise(1600, 0.72, 0.13, 0, 260); tone(90, 0.65, 0.045, 0, 'synth'); break;
    case 'podImpact': impact(0.3); noise(260, 0.32, 0.15, 0.04, 75); tone(48, 0.9, 0.055, 0.08, 'synth'); break;
    case 'thaw': [60, 67, 72, 79].forEach((n, i) => tone(n, 1.1, 0.045, i * 0.12, 'piano')); break;
    case 'breakthrough': [48, 55, 60].forEach(n => tone(n, 1.3, 0.04, 0, 'synth')); fanfare([60, 67, 72, 76], 0.13, 'piano'); break;
    case 'cryo': synth.fm(target, { at, duration: 0.55, frequency: 960 * ratio, gain: 0.065 * volume }, 2.7, 0.32); tone(84, 0.5, 0.035, 0.08, 'synth'); break;
  }
}
