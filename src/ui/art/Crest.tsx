// OWNER: Art2D. Civilization crests: a heraldic shield (or roundel) in the civ's colors — field division chosen
// per civ, the motif as the gilded charge, forged-gold rim and enamel gloss. Used in city banners, rival
// lists, leader portraits.
import { useId, type CSSProperties } from 'react';
import { FitGlyph } from './FitGlyph';
import { motifGlyph } from './motifs';
import { chargePaints, hash, luminance, shade } from './paint';

export interface CrestColors {
  primary: string;
  secondary: string;
}
export type CrestShape = 'shield' | 'round';

export interface CrestProps {
  motif: string;
  colors: CrestColors;
  /** px (height for shields; width follows 100:116) — omit to size via CSS */
  size?: number;
  shape?: CrestShape;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const SHIELD = 'M9 9Q50 1 91 9V54C91 83 71 101 50 111C29 101 9 83 9 54Z';
const ROUND = 'M50 4A46 46 0 1 1 49.99 4Z';

type Division = 'plain' | 'pale' | 'bend' | 'chief' | 'bordure' | 'chevron';
const DIVISIONS: Division[] = ['plain', 'pale', 'bend', 'chief', 'bordure', 'chevron'];

function divisionPath(div: Division, round: boolean): string | null {
  const H = round ? 100 : 116;
  switch (div) {
    case 'pale':
      return `M50 0H100V${H}H50Z`;
    case 'bend':
      return `M0 ${H * 0.18}L0 0H22L100 ${H * 0.78}V${H}H78Z`;
    case 'chief':
      return round ? 'M0 0H100V30H0Z' : 'M0 0H100V34H0Z';
    case 'chevron':
      return `M0 ${H}V${H * 0.72}L50 ${H * 0.44}L100 ${H * 0.72}V${H}Z`;
    default:
      return null;
  }
}

/**
 * Crest artwork in its own coordinate space (shield 100×116, round 100×100). `detail=false` drops hairline
 * ornaments for tiny renders.
 */
export function CrestArt({ uid, motif, colors, shape = 'shield', detail = true }: { uid: string; motif: string; colors: CrestColors; shape?: CrestShape; detail?: boolean }) {
  const round = shape === 'round';
  const outline = round ? ROUND : SHIELD;
  const k = (s: string) => `${uid}${s}`;
  const u = (s: string) => `url(#${k(s)})`;
  const div = DIVISIONS[hash(`${motif}|${colors.primary}|${colors.secondary}`) % DIVISIONS.length];
  const divD = divisionPath(div, round);
  const lightField = luminance(colors.primary) > 0.45;
  const metal = lightField ? shade(colors.primary, -0.78) : u('metal');
  const ink = shade(colors.primary, -0.85);
  const paints = chargePaints(metal, colors.secondary, ink);
  const chief = div === 'chief';
  const cy = round ? 52 : chief ? 64 : 54;
  const size = round ? (chief ? 52 : 60) : chief ? 50 : 58;
  const glyph = motifGlyph(motif);
  const H = round ? 100 : 116;

  return (
    <g>
      <defs>
        <linearGradient id={k('metal')} x1="0.1" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#fff6d2" />
          <stop offset="0.45" stopColor="#f0cf72" />
          <stop offset="1" stopColor="#a8751f" />
        </linearGradient>
        <linearGradient id={k('rim')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fff0b8" />
          <stop offset="0.4" stopColor="#e0b84a" />
          <stop offset="0.55" stopColor="#9c6f1e" />
          <stop offset="1" stopColor="#e7c25c" />
        </linearGradient>
        <linearGradient id={k('gloss')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="0.46" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <clipPath id={k('clip')}>
          <path d={outline} />
        </clipPath>
      </defs>
      {/* forged outline + field */}
      <path d={outline} fill="#1a1005" stroke="#1a1005" strokeWidth={detail ? 11 : 14} strokeLinejoin="round" />
      <g clipPath={u('clip')}>
        <rect width="100" height={H} fill={colors.primary} />
        {divD && <path d={divD} fill={colors.secondary} />}
        {div === 'bordure' && <path d={outline} fill="none" stroke={colors.secondary} strokeWidth="18" />}
        {detail && divD && <path d={divD} fill="none" stroke="#1a1005" strokeWidth="1.4" opacity="0.55" />}
        {detail && (
          <g opacity="0.07" stroke="#fff" strokeWidth="0.6">
            {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${-20 + i * 10} 0l${H} ${H}`} />)}
          </g>
        )}
        <FitGlyph
          glyph={glyph}
          paints={paints}
          keyline={{ color: ink, width: detail ? 3 : 5 }}
          box={{ x: 50 - size / 2, y: cy - size / 2, w: size, h: size }}
        />
        <rect width="100" height={H} fill={u('gloss')} />
      </g>
      {/* gold rim */}
      <path d={outline} fill="none" stroke={u('rim')} strokeWidth={detail ? 5.5 : 8} strokeLinejoin="round" />
      {detail && <path d={outline} fill="none" stroke="#fff3c6" strokeWidth="0.8" opacity="0.55" transform="translate(50 50) scale(0.935) translate(-50 -50)" />}
    </g>
  );
}

export function Crest({ motif, colors, size, shape = 'shield', className, style, title }: CrestProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const round = shape === 'round';
  const pad = 7;
  const vbH = round ? 100 : 116;
  const w = size !== undefined ? (round ? size : (size * (100 + pad * 2)) / (vbH + pad * 2)) : undefined;
  return (
    <svg
      className={className}
      style={{ overflow: 'visible', flexShrink: 0, ...style }}
      viewBox={`${-pad} ${-pad} ${100 + pad * 2} ${vbH + pad * 2}`}
      width={w}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <CrestArt uid={uid} motif={motif} colors={colors} shape={shape} detail={size === undefined || size >= 36} />
    </svg>
  );
}
