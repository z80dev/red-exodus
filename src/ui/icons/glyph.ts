// Glyph format for the AEONS icon set. Every icon is authored on a 24×24 grid as a stack of layers.
//
// Two styles:
//  • "game" glyphs (yields, resources, buildings, motifs…): colored body + white highlight + ink shading,
//    wrapped in a dark keyline so they read on both ink-glass and parchment at 14px.
//  • "ui" glyphs (close, chevrons, settings…): crisp duotone in currentColor (accent layers at 45%).
//
// Paints: 'm' main color (the `color` prop or the glyph default) · 'a' accent (glyph accent, gold by default)
//         'h' highlight (white glaze) · 'k' ink shade · 'p' parchment · 'd' deep ink (solid) · any CSS color.

export type Paint = 'm' | 'a' | 'h' | 'k' | 'p' | 'd' | (string & {});

export interface Layer {
  d: string;
  /** fill paint (omit for stroke-only layers) */
  f?: Paint;
  /** stroke paint */
  s?: Paint;
  /** stroke width in grid units */
  w?: number;
  /** opacity */
  o?: number;
  /** even-odd fill rule (for cut-outs) */
  eo?: boolean;
  /** exclude from the keyline pass (details drawn inside the silhouette) */
  inner?: boolean;
  /** SVG transform (e.g. 'rotate(45 12 12)') */
  t?: string;
}

export interface Glyph {
  /** default main color */
  c: string;
  /** accent color */
  a?: string;
  /** ui style: currentColor duotone, no keyline */
  ui?: boolean;
  l: Layer[];
}

/** apply an SVG transform to a layer */
export function tf(t: string, l: Layer): Layer {
  return { ...l, t };
}

/** filled layer */
export function f(d: string, p: Paint = 'm', o?: number): Layer {
  const inner = p === 'h' || p === 'k';
  return o === undefined ? { d, f: p, inner } : { d, f: p, o, inner };
}
/** even-odd filled layer (holes) */
export function fe(d: string, p: Paint = 'm'): Layer {
  return { d, f: p, eo: true, inner: p === 'h' || p === 'k' };
}
/** stroked layer (round caps/joins) */
export function s(d: string, p: Paint = 'm', w = 2, o?: number): Layer {
  const inner = p === 'h' || p === 'k';
  return o === undefined ? { d, s: p, w, inner } : { d, s: p, w, o, inner };
}
/** mark a layer as interior detail (no keyline) */
export function inner(l: Layer): Layer {
  return { ...l, inner: true };
}

/** colored game glyph */
export function g(c: string, a: string | undefined, ...l: Layer[]): Glyph {
  return a ? { c, a, l } : { c, l };
}
/** currentColor duotone ui glyph; use paint 'a' for the 45% secondary tone */
export function u(...l: Layer[]): Glyph {
  return { c: 'currentColor', ui: true, l };
}

// ── shape helpers (return path data) ──
export function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}
export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
}
export function rect(x: number, y: number, w: number, h: number, r = 0): string {
  if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  const q = Math.min(r, w / 2, h / 2);
  return `M${x + q} ${y}h${w - 2 * q}a${q} ${q} 0 0 1 ${q} ${q}v${h - 2 * q}a${q} ${q} 0 0 1 ${-q} ${q}h${-(w - 2 * q)}a${q} ${q} 0 0 1 ${-q} ${-q}v${-(h - 2 * q)}a${q} ${q} 0 0 1 ${q} ${-q}Z`;
}
/** regular polygon / star points */
export function poly(pts: [number, number][]): string {
  return `M${pts.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`;
}
export function star(cx: number, cy: number, ro: number, ri: number, n = 5, rot = -90): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts);
}
export function ngon(cx: number, cy: number, r: number, n: number, rot = -90): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts);
}
/** radial spokes (for suns, gears): n short segments from r1 to r2 */
export function spokes(cx: number, cy: number, r1: number, r2: number, n: number, rot = -90): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180;
    d += `M${round(cx + r1 * Math.cos(a))} ${round(cy + r1 * Math.sin(a))}L${round(cx + r2 * Math.cos(a))} ${round(cy + r2 * Math.sin(a))}`;
  }
  return d;
}
/** gear outline with n flat-topped teeth (outer radius ro, root radius ri) */
export function gear(cx: number, cy: number, ro: number, ri: number, n: number, rot = -90): string {
  const pts: [number, number][] = [];
  const step = 360 / n;
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * step;
    for (const [da, r] of [[-step * 0.3, ri], [-step * 0.17, ro], [step * 0.17, ro], [step * 0.3, ri]] as const) {
      const a = ((a0 + da) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return poly(pts);
}
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
