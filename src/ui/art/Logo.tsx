// OWNER: Art2D. The AEONS wordmark: Cinzel Decorative letterforms as vector paths, forged-gold bevel, optional
// sheen sweep, the Emblem standing in for the O.
import { useId, type CSSProperties } from 'react';
import { EmblemArt, GoldGradient } from './Emblem';
import { LOGO_GLYPHS } from './logoGlyphs';
import './art.css';

export { Emblem, EmblemArt } from './Emblem';

// ───────────────────────────── wordmark ─────────────────────────────

const TRACK = 10;
/** tagline text width (forced via textLength so the flanking rules never collide) */
const TAG_W = 430;
const EMBLEM_W = 118; // the O slot
type Letter = keyof typeof LOGO_GLYPHS;
const WORD: (Letter | 'emblem')[] = ['A', 'E', 'emblem', 'N', 'S'];

interface Placed { kind: Letter | 'emblem'; x: number }
function layout(): { placed: Placed[]; x0: number; x1: number } {
  let x = 0;
  let x0 = Infinity;
  let x1 = -Infinity;
  const placed: Placed[] = [];
  for (const ch of WORD) {
    if (ch === 'emblem') {
      placed.push({ kind: ch, x });
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x + EMBLEM_W);
      x += EMBLEM_W + TRACK;
    } else {
      const g = LOGO_GLYPHS[ch];
      placed.push({ kind: ch, x });
      x0 = Math.min(x0, x + g.x0);
      x1 = Math.max(x1, x + g.x1);
      x += g.adv + TRACK;
    }
  }
  return { placed, x0, x1 };
}
const LAYOUT = layout();

export interface LogoProps {
  className?: string;
  /** rendered height in px (width follows); omit to size via CSS */
  height?: number;
  /** animated light sweep across the letters */
  sheen?: boolean;
  /** replace the O with the emblem (default true) */
  emblem?: boolean;
  /** "A ROGUELIKE CIVILIZATION" under the wordmark */
  tagline?: boolean;
  style?: CSSProperties;
}

export function Logo({ className, height, sheen = true, emblem = true, tagline = false, style }: LogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const k = (s: string) => `${uid}${s}`;
  const u = (s: string) => `url(#${k(s)})`;
  const pad = 14;
  const top = -24;
  const bottom = tagline ? 176 : 142;
  const vx = LAYOUT.x0 - pad;
  const vw = LAYOUT.x1 - LAYOUT.x0 + pad * 2;
  const vh = bottom - top;
  const letters = LAYOUT.placed.filter((p) => p.kind !== 'emblem' || !emblem);
  const lettersD = letters.map((p) => ({ d: LOGO_GLYPHS[p.kind === 'emblem' ? 'O' : p.kind].d, x: p.x }));
  const emblemAt = LAYOUT.placed.find((p) => p.kind === 'emblem');
  const cx = (LAYOUT.x0 + LAYOUT.x1) / 2;

  return (
    <div className={className ? `aeons-logo ${className}` : 'aeons-logo'} style={style}>
      <svg viewBox={`${vx} ${top} ${vw} ${vh}`} height={height} width={height ? (height * vw) / vh : undefined} role="img" aria-label="AEONS — A Roguelike Civilization">
        <defs>
          <GoldGradient id={k('gold')} y1={0.02} y2={0.98} />
          <filter id={k('bevel')} x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="blur" />
            <feSpecularLighting in="blur" surfaceScale="3.2" specularConstant="0.9" specularExponent="18" lightingColor="#fff5d6" result="spec">
              <feDistantLight azimuth="235" elevation="48" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
            <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.75" k4="0" />
          </filter>
          <filter id={k('drop')} x="-10%" y="-20%" width="120%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity="0.65" />
          </filter>
          <linearGradient id={k('sheenG')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={k('clip')}>
            {lettersD.map((l, i) => <path key={i} d={l.d} transform={`translate(${l.x} 0)`} />)}
            {emblem && emblemAt && <circle cx={emblemAt.x + EMBLEM_W / 2} cy="50" r={EMBLEM_W / 2} />}
          </clipPath>
        </defs>

        <g filter={u('drop')}>
          {/* dark forged outline */}
          <g fill="#1c1003" stroke="#1c1003" strokeWidth="7" strokeLinejoin="round">
            {lettersD.map((l, i) => <path key={i} d={l.d} transform={`translate(${l.x} 0)`} />)}
          </g>
          <g filter={u('bevel')}>
            <g fill={u('gold')}>
              {lettersD.map((l, i) => <path key={i} d={l.d} transform={`translate(${l.x} 0)`} />)}
            </g>
          </g>
          {/* fine inner rim */}
          <g fill="none" stroke="#fff1bf" strokeWidth="0.8" opacity="0.35">
            {lettersD.map((l, i) => <path key={i} d={l.d} transform={`translate(${l.x} 0)`} />)}
          </g>
          {emblem && emblemAt && (
            <g transform={`translate(${emblemAt.x + EMBLEM_W / 2 - 59} ${50 - 59}) scale(1.18)`}>
              <EmblemArt uid={k('e')} bare />
            </g>
          )}
        </g>

        {sheen && (
          <g clipPath={u('clip')} style={{ mixBlendMode: 'soft-light' }}>
            <rect className="aeons-logo__sheen" x={vx} y={top} width="90" height={vh} fill={u('sheenG')} transform="skewX(-18)" />
          </g>
        )}

        {tagline && (
          <g>
            <text
              x={cx}
              y={166}
              textAnchor="middle"
              textLength={TAG_W}
              lengthAdjust="spacing"
              fontFamily="Cinzel, 'Times New Roman', serif"
              fontWeight={700}
              fontSize="19"
              fill="#e9d4a0"
            >
              A ROGUELIKE CIVILIZATION
            </text>
            <path d={`M${cx - TAG_W / 2 - 58} 159.5h44M${cx + TAG_W / 2 + 14} 159.5h44`} stroke="#b3862a" strokeWidth="1.4" strokeLinecap="round" />
            <path d={`M${cx - TAG_W / 2 - 14} 159.5l-5-3.2-5 3.2 5 3.2ZM${cx + TAG_W / 2 + 14} 159.5l5-3.2 5 3.2-5 3.2Z`} fill="#e0b84a" />
          </g>
        )}
      </svg>
    </div>
  );
}
