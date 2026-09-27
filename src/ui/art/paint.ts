// Shared helpers for the procedural art components (CardArt, Crest, LeaderPortrait, Logo).
import type { PaintMap } from '../icons/GlyphLayers';

/** 32-bit FNV-1a string hash */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG → floats in [0,1) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hsl(h: number, s: number, l: number, a = 1): string {
  const hh = ((h % 360) + 360) % 360;
  return a === 1 ? `hsl(${hh} ${s}% ${l}%)` : `hsl(${hh} ${s}% ${l}% / ${a})`;
}

/** Motif paints for art on a hue-tinted ground: gilded ivory body, jewel accent in the card hue. */
export function motifPaints(hue: number, ivoryUrl: string): PaintMap {
  return {
    m: [ivoryUrl, 1],
    a: [hsl(hue + 8, 72, 58), 1],
    h: ['#ffffff', 0.55],
    k: [hsl(hue, 60, 14), 0.34],
    p: ['#f4e9cc', 1],
    d: [hsl(hue, 55, 11), 1],
  };
}

/** Motif paints for a heraldic charge in a single metal/tincture. */
export function chargePaints(metal: string, accent: string, ink: string): PaintMap {
  return {
    m: [metal, 1],
    a: [accent, 1],
    h: ['#ffffff', 0.45],
    k: [ink, 0.3],
    p: ['#f4e9cc', 1],
    d: [ink, 1],
  };
}

/** parse "#rrggbb" → [r,g,b] (0..255); anything else → mid grey */
export function rgbOf(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** relative luminance 0..1 of a hex color */
export function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** mix a hex color toward black (amt<0) or white (amt>0), amt in -1..1 */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = rgbOf(hex);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const mix = (c: number) => Math.round(c + (t - c) * k).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}
