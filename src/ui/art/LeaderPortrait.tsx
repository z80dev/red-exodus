// OWNER: Art2D. Leader portrait: the painted ArtGen portrait when shipped (artFor('leaders', id)), otherwise a
// procedural heraldic portrait — hue-lit hall, the leader's motif as a luminous watermark, a swallow-tailed
// banner in the civ colors hanging from a gilded rod, the civ crest on the banner, cradled by a laurel.
import { useId, useMemo, useState, type CSSProperties } from 'react';
import type { LeaderDef } from '../../sim/defs';
import { GlyphLayers } from '../icons/GlyphLayers';
import { artFor } from './artManifest';
import { CrestArt } from './Crest';
import { motifGlyph } from './motifs';
import { chargePaints, hsl, shade } from './paint';
import './art.css';

export type PortraitShape = 'card' | 'round' | 'square';

export interface LeaderPortraitProps {
  leader: LeaderDef;
  /** px width (card height = 1.25× width); omit to fill the parent box */
  size?: number;
  shape?: PortraitShape;
  className?: string;
  style?: CSSProperties;
  /** skip the painted illustration even when shipped */
  procedural?: boolean;
}

export function LeaderPortrait({ leader, size, shape = 'card', className, style, procedural }: LeaderPortraitProps) {
  const url = procedural ? null : artFor('leaders', leader.id);
  const [broken, setBroken] = useState<string | null>(null);
  const dims: CSSProperties =
    size !== undefined ? { width: size, height: shape === 'card' ? size * 1.25 : size } : { width: '100%', height: '100%' };
  const cls = `aeons-portrait aeons-portrait--${shape}${className ? ` ${className}` : ''}`;
  return (
    <div className={cls} style={{ ...dims, ...style }} role="img" aria-label={`${leader.name}, ${leader.title}`}>
      {url && broken !== url ? (
        <img src={url} alt="" draggable={false} onError={() => setBroken(url)} style={{ objectPosition: shape === 'card' ? '50% 30%' : '50% 22%' }} />
      ) : (
        <HeraldicPortrait leader={leader} shape={shape} />
      )}
      <div className="aeons-portrait__frame" />
    </div>
  );
}

/** laurel branch: leaves along a circular arc from angle a0 to a1 (deg), mirrored for the right side */
function laurel(cx: number, cy: number, r: number, a0: number, a1: number, n: number, mirror: boolean): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    const sx = mirror ? -1 : 1;
    const x = cx + sx * r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    // leaf pointing along the tangent, alternating in/out
    const tang = a + (Math.PI / 2) * (a1 > a0 ? 1 : -1);
    const out = i % 2 ? 1 : -1;
    const len = 6.4 - t * 2;
    const lx = x + sx * (Math.cos(tang) * len * 0.8 + Math.cos(a) * out * len * 0.45);
    const ly = y + Math.sin(tang) * len * 0.8 + Math.sin(a) * out * len * 0.45;
    const mx = (x + lx) / 2;
    const my = (y + ly) / 2;
    const nx = -(ly - y) * 0.42;
    const ny = (lx - x) * 0.42;
    d += `M${x.toFixed(2)} ${y.toFixed(2)}Q${(mx + nx).toFixed(2)} ${(my + ny).toFixed(2)} ${lx.toFixed(2)} ${ly.toFixed(2)}Q${(mx - nx).toFixed(2)} ${(my - ny).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}Z`;
  }
  // the stem the leaves grow from
  const p = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + (mirror ? -1 : 1) * r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  const sweep = (a1 > a0) !== mirror ? 1 : 0;
  return `${d}M${p(a0)}A${r} ${r} 0 0 ${sweep} ${p(a1)}`;
}

function HeraldicPortrait({ leader, shape }: { leader: LeaderDef; shape: PortraitShape }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const k = (s: string) => `${uid}${s}`;
  const u = (s: string) => `url(#${k(s)})`;
  const { hue, motif, crest } = leader.portrait;
  const { primary, secondary } = leader.colors;
  const card = shape === 'card';
  const vb = card ? '0 0 80 100' : '4 6 72 72';
  const leaves = useMemo(
    () => ({ l: laurel(40, 40, 22.5, 196, 98, 10, false), r: laurel(40, 40, 22.5, 196, 98, 10, true) }),
    [],
  );
  const watermark = motifGlyph(motif);
  const dark = shade(primary, -0.45);

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <radialGradient id={k('bg')} cx="0.5" cy="0.28" r="0.85">
          <stop offset="0" stopColor={hsl(hue + 18, 50, 42)} />
          <stop offset="0.45" stopColor={hsl(hue, 52, 20)} />
          <stop offset="1" stopColor={hsl(hue - 10, 60, 6)} />
        </radialGradient>
        <linearGradient id={k('cloth')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(primary, -0.35)} />
          <stop offset="0.18" stopColor={primary} />
          <stop offset="0.34" stopColor={shade(primary, 0.12)} />
          <stop offset="0.5" stopColor={shade(primary, -0.18)} />
          <stop offset="0.68" stopColor={primary} />
          <stop offset="0.84" stopColor={shade(primary, 0.08)} />
          <stop offset="1" stopColor={shade(primary, -0.4)} />
        </linearGradient>
        <linearGradient id={k('clothShade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.2" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={k('gold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2c0" />
          <stop offset="0.5" stopColor="#e0b84a" />
          <stop offset="1" stopColor="#8e6118" />
        </linearGradient>
        <radialGradient id={k('vig')} cx="0.5" cy="0.42" r="0.72">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
        <radialGradient id={k('halo')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={hsl(hue + 25, 95, 80)} stopOpacity="0.6" />
          <stop offset="0.6" stopColor={hsl(hue + 15, 90, 65)} stopOpacity="0.15" />
          <stop offset="1" stopColor={hsl(hue, 90, 60)} stopOpacity="0" />
        </radialGradient>
        <pattern id={k('damask')} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M3 0.6L5.4 3L3 5.4L0.6 3Z" fill="none" stroke={shade(primary, 0.35)} strokeWidth="0.35" />
          <circle cx="3" cy="3" r="0.5" fill={shade(primary, 0.35)} />
        </pattern>
        <filter id={k('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.8" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>

      <rect x="0" y="0" width="80" height="100" fill={u('bg')} />
      {/* light shafts */}
      <g opacity="0.1" fill={hsl(hue + 30, 90, 85)}>
        <path d="M30 -4L38 -4L22 100L6 100Z" />
        <path d="M44 -4L50 -4L66 100L54 100Z" />
        <path d="M39 -4L42 -4L42 100L34 100Z" />
      </g>
      {/* motif watermark */}
      <g transform="translate(-10 20) scale(1)" opacity="0.14">
        <GlyphLayers glyph={watermark} paints={chargePaints('#ffffff', '#ffffff', '#ffffff')} />
      </g>
      {/* floor */}
      <ellipse cx="40" cy="92" rx="34" ry="6" fill="#000" opacity="0.4" />

      {/* banner */}
      <g filter={u('soft')}>
        <path d="M17 8H63V76L40 67.5L17 76Z" fill={u('cloth')} />
        <path d="M17 8H63V76L40 67.5L17 76Z" fill={u('damask')} opacity="0.35" />
        <path d="M17 8H63V76L40 67.5L17 76Z" fill={u('clothShade')} />
        <path d="M20.2 8V71.2L40 64L59.8 71.2V8" fill="none" stroke={secondary} strokeWidth="1.8" />
        <path d="M17 76L40 67.5L63 76" fill="none" stroke={u('gold')} strokeWidth="1.1" />
        <path d="M18.5 77.5L40 69.6L61.5 77.5" fill="none" stroke="#e0b84a" strokeWidth="1.4" strokeDasharray="0.5 1.1" opacity="0.8" />
        <path d="M24 12V62M56 12V62" stroke={dark} strokeWidth="0.4" opacity="0.5" />
        {/* rod */}
        <rect x="11" y="6.2" width="58" height="2.8" rx="1.4" fill={u('gold')} stroke="#2a1a06" strokeWidth="0.5" />
        <circle cx="10.6" cy="7.6" r="2.4" fill={u('gold')} stroke="#2a1a06" strokeWidth="0.5" />
        <circle cx="69.4" cy="7.6" r="2.4" fill={u('gold')} stroke="#2a1a06" strokeWidth="0.5" />
        <path d="M40 6.2V1.5" stroke="#2a1a06" strokeWidth="0.7" />
      </g>

      {/* halo */}
      <circle cx="40" cy="39" r="24" fill={u('halo')} />
      {/* gilded laurel */}
      <g fill={u('gold')} stroke="#2a1a06" strokeWidth="0.5" strokeLinejoin="round" strokeLinecap="round" filter={u('soft')}>
        <path d={leaves.l} />
        <path d={leaves.r} />
      </g>
      <path d="M36.4 62.6q3.6 2.4 7.2 0M37 61.2l-3 4.2M43 61.2l3 4.2" fill="none" stroke={secondary} strokeWidth="1.3" strokeLinecap="round" />

      {/* crest */}
      <g transform="translate(22.5 18.5) scale(0.35)" filter={u('soft')}>
        <CrestArt uid={k('c')} motif={crest} colors={{ primary: secondary, secondary: primary }} />
      </g>
      {card && <rect x="0" y="0" width="80" height="100" fill={u('vig')} />}
      {!card && <rect x="4" y="6" width="72" height="72" fill={u('vig')} />}
    </svg>
  );
}
