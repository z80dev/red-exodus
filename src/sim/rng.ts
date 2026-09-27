// Deterministic seeded RNG (sfc32). All sim randomness MUST go through these helpers with state.rng
// so runs are reproducible from seed and saves resume identically.
import type { RngState } from './types';

export function seedRng(seed: string): RngState {
  // xmur3 string hash → 4 seeds
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  const s: RngState = { a: next(), b: next(), c: next(), d: next() };
  for (let i = 0; i < 12; i++) random(s);
  return s;
}

/** float in [0, 1) */
export function random(s: RngState): number {
  s.a >>>= 0; s.b >>>= 0; s.c >>>= 0; s.d >>>= 0;
  let t = (s.a + s.b) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.d = (s.d + 1) | 0;
  t = (t + s.d) | 0;
  s.c = (s.c + t) | 0;
  return (t >>> 0) / 4294967296;
}

/** integer in [0, n) */
export function randInt(s: RngState, n: number): number {
  return Math.floor(random(s) * n);
}

/** integer in [lo, hi] inclusive */
export function randRange(s: RngState, lo: number, hi: number): number {
  return lo + randInt(s, hi - lo + 1);
}

export function chance(s: RngState, p: number): boolean {
  return random(s) < p;
}

export function pick<T>(s: RngState, arr: readonly T[]): T {
  return arr[randInt(s, arr.length)];
}

export function shuffle<T>(s: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** weighted pick; returns index. weights must be >= 0 with positive sum */
export function weightedIndex(s: RngState, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let r = random(s) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** independent rng stream derived from a seed + salt (e.g. mapgen) without consuming state.rng */
export function deriveRng(seed: string, salt: string): RngState {
  return seedRng(`${seed}::${salt}`);
}

export function randomSeed(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
