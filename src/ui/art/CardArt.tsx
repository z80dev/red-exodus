// OWNER: Art2D. Card illustration: the painted ArtGen image when one ships for (kind,id), else a procedural
// layered SVG — hue-tinted sky, sunburst/rings/lattice pattern, starfield, rolling hills, a gilded motif
// emblem with glow and shadow, filigree border, grain and vignette. Fills its box (width/height 100%).
import { useId, useMemo, useState, type CSSProperties } from 'react';
import { artFor, type ArtKind } from './artManifest';
import { FitGlyph } from './FitGlyph';
import { motifGlyph } from './motifs';
import { hash, hsl, motifPaints, rng } from './paint';
import type { Rarity } from '../../sim/types';
import './art.css';

export interface CardArtProps {
  hue: number;
  motif: string;
  /** with `id`: looks up the painted illustration via artFor(kind, id) */
  kind?: ArtKind;
  id?: string;
  /** explicit illustration url (overrides the manifest lookup) */
  image?: string | null;
  rarity?: Rarity;
  /** composition: 'card' 5:7 (default) or 'square' 1:1 */
  aspect?: 'card' | 'square';
  /** extra variation key (defaults to motif+hue+id) */
  seed?: string;
  /** slow ray rotation / legendary sheen (respects prefers-reduced-motion) */
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
}

const RARITY_COLOR: Record<Rarity, string> = {
  common: 'var(--r-common)',
  uncommon: 'var(--r-uncommon)',
  rare: 'var(--r-rare)',
  legendary: 'var(--r-legendary)',
};

export function CardArt(props: CardArtProps) {
  const { kind, id, image, className, style } = props;
  const url = image ?? (kind && id ? artFor(kind, id) : null);
  const [broken, setBroken] = useState<string | null>(null);
  const cls = className ? `aeons-cardart ${className}` : 'aeons-cardart';
  if (url && broken !== url) {
    return (
      <div className={cls} style={style}>
        <img className="aeons-cardart__img" src={url} alt="" draggable={false} onError={() => setBroken(url)} />
        {props.rarity && props.rarity !== 'common' && (
          <div className="aeons-cardart__rim" style={{ '--rim': RARITY_COLOR[props.rarity] } as CSSProperties} />
        )}
      </div>
    );
  }
  return (
    <div className={cls} style={style}>
      <ProceduralArt {...props} />
    </div>
  );
}

interface Scene {
  W: number;
  H: number;
  cx: number;
  cy: number;
  size: number;
  pattern: 'rays' | 'rings' | 'lattice';
  rays: string;
  stars: { x: number; y: number; r: number; o: number; sparkle: boolean }[];
  hillBack: string;
  hillFront: string;
  hillRim: string;
  hueShift: number;
}

function buildScene(hue: number, motif: string, seedKey: string, square: boolean): Scene {
  const r = rng(hash(`${seedKey}|${motif}|${hue}`));
  const W = 100;
  const H = square ? 100 : 140;
  const cx = 50;
  const cy = square ? 48 : 64;
  const size = square ? 60 : 68;
  const pattern = (['rays', 'rings', 'lattice'] as const)[Math.floor(r() * 3)];
  const n = 12 + 2 * Math.floor(r() * 5);
  const rot = r() * 360;
  let rays = '';
  for (let i = 0; i < n; i++) {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180;
    const w = (Math.PI / n) * 0.5;
    const R = 160;
    rays += `M${cx} ${cy}L${(cx + R * Math.cos(a - w)).toFixed(1)} ${(cy + R * Math.sin(a - w)).toFixed(1)}L${(cx + R * Math.cos(a + w)).toFixed(1)} ${(cy + R * Math.sin(a + w)).toFixed(1)}Z`;
  }
  const stars: Scene['stars'] = [];
  for (let i = 0; i < 22; i++) {
    const x = 4 + r() * 92;
    const y = 4 + r() * (H * 0.62);
    if (Math.hypot(x - cx, y - cy) < size * 0.42) continue;
    stars.push({ x, y, r: 0.25 + r() * 0.7, o: 0.25 + r() * 0.6, sparkle: r() < 0.18 });
  }
  const hill = (base: number, amp: number) => {
    const y0 = base + (r() - 0.5) * amp;
    const y1 = base - amp * (0.4 + r() * 0.6);
    const y2 = base + (r() - 0.5) * amp;
    const y3 = base - amp * (0.2 + r() * 0.6);
    const y4 = base + (r() - 0.5) * amp;
    return { top: `M0 ${y0.toFixed(1)}C18 ${y1.toFixed(1)} 30 ${y2.toFixed(1)} 50 ${y2.toFixed(1)}S82 ${y3.toFixed(1)} 100 ${y4.toFixed(1)}`, close: `V${H}H0Z` };
  };
  const back = hill(H * (square ? 0.84 : 0.8), H * 0.06);
  const front = hill(H * (square ? 0.92 : 0.9), H * 0.045);
  return {
    W, H, cx, cy, size, pattern, rays, stars,
    hillBack: back.top + back.close,
    hillFront: front.top + front.close,
    hillRim: front.top,
    hueShift: Math.round((r() - 0.5) * 30),
  };
}

function ProceduralArt({ hue, motif, id, seed, rarity, aspect = 'card', animate }: CardArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const square = aspect === 'square';
  const sc = useMemo(() => buildScene(hue, motif, seed ?? id ?? '', square), [hue, motif, seed, id, square]);
  const glyph = motifGlyph(motif);
  // dark yellows turn olive; lean them toward amber/bronze so gold-themed cards stay rich
  const base = hue >= 40 && hue <= 80 ? hue - (hue - 36) * 0.55 : hue;
  const h = base + sc.hueShift * 0.3;
  const k = (s: string) => `${uid}${s}`;
  const u = (s: string) => `url(#${k(s)})`;
  const paints = motifPaints(h, u('ivory'));
  const rimColor = rarity ? RARITY_COLOR[rarity] : 'var(--gold-500)';
  const { W, H, cx, cy } = sc;

  return (
    <svg className="aeons-cardart__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id={k('sky')} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor={hsl(h + 12, 46, 38)} />
          <stop offset="0.5" stopColor={hsl(h, 50, 21)} />
          <stop offset="1" stopColor={hsl(h - 10, 58, 9)} />
        </linearGradient>
        <radialGradient id={k('glow')} cx={cx / W} cy={cy / H} r={0.5} gradientTransform={`translate(${cx / W} ${cy / H}) scale(1 ${W / H}) translate(${-cx / W} ${-cy / H})`}>
          <stop offset="0" stopColor={hsl(h + 25, 95, 78)} stopOpacity="0.75" />
          <stop offset="0.35" stopColor={hsl(h + 15, 85, 60)} stopOpacity="0.28" />
          <stop offset="1" stopColor={hsl(h, 80, 50)} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={k('ivory')} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.45" stopColor="#f6e2a8" />
          <stop offset="1" stopColor="#c9953a" />
        </linearGradient>
        <radialGradient id={k('vig')} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.62" />
        </radialGradient>
        <linearGradient id={k('sheen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#ffe9a8" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#b9f3ff" stopOpacity="0.4" />
          <stop offset="0.55" stopColor="#ffb3f0" stopOpacity="0.3" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={k('shadow')} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.8" stdDeviation="1.8" floodColor={hsl(h, 60, 4)} floodOpacity="0.7" />
        </filter>
        <filter id={k('grain')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed={hash(motif) % 97} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 1.6 -0.55" />
        </filter>
        <clipPath id={k('clip')}>
          <rect width={W} height={H} />
        </clipPath>
      </defs>

      <g clipPath={u('clip')}>
        <rect width={W} height={H} fill={u('sky')} />
        {/* pattern */}
        <g className={animate ? 'aeons-cardart__spin' : undefined} style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path d={sc.rays} fill={hsl(h + 30, 90, 82)} opacity={sc.pattern === 'rays' ? 0.1 : 0.045} />
        </g>
        {sc.pattern === 'rings' && (
          <g fill="none" stroke={hsl(h + 30, 70, 78)}>
            {[22, 31, 41, 53, 67, 83].map((rr, i) => (
              <circle key={rr} cx={cx} cy={cy} r={rr} strokeWidth={i % 2 ? 0.35 : 0.6} opacity={0.16 - i * 0.015} strokeDasharray={i === 2 ? '1.2 1.8' : undefined} />
            ))}
          </g>
        )}
        {sc.pattern === 'lattice' && (
          <g stroke={hsl(h + 30, 70, 78)} strokeWidth="0.35" opacity="0.1">
            {Array.from({ length: 26 }, (_, i) => (
              <path key={i} d={`M${-H + i * 10} 0l${H} ${H}M${i * 10} 0l${-H} ${H}`} />
            ))}
          </g>
        )}
        <rect width={W} height={H} fill={u('glow')} />
        {/* starfield */}
        {sc.stars.map((st, i) =>
          st.sparkle ? (
            <path
              key={i}
              d={`M${st.x} ${st.y - st.r * 3}Q${st.x + st.r * 0.4} ${st.y - st.r * 0.4} ${st.x + st.r * 3} ${st.y}Q${st.x + st.r * 0.4} ${st.y + st.r * 0.4} ${st.x} ${st.y + st.r * 3}Q${st.x - st.r * 0.4} ${st.y + st.r * 0.4} ${st.x - st.r * 3} ${st.y}Q${st.x - st.r * 0.4} ${st.y - st.r * 0.4} ${st.x} ${st.y - st.r * 3}Z`}
              fill="#fff6d8"
              opacity={st.o}
            />
          ) : (
            <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff6d8" opacity={st.o * 0.8} />
          ),
        )}
        {/* ground */}
        <path d={sc.hillBack} fill={hsl(h - 6, 40, 15)} />
        <path d={sc.hillFront} fill={hsl(h - 12, 46, 7)} />
        <path d={sc.hillRim} fill="none" stroke="var(--gold-400)" strokeWidth="0.45" opacity="0.35" />
        <ellipse cx={cx} cy={cy + sc.size * 0.5} rx={sc.size * 0.36} ry={sc.size * 0.045} fill="#000" opacity="0.35" />
        {/* motif */}
        <FitGlyph
          glyph={glyph}
          paints={paints}
          keyline={{ color: hsl(h, 60, 6), width: 1.5 }}
          box={{ x: cx - sc.size / 2, y: cy - sc.size / 2, w: sc.size, h: sc.size }}
          filter={u('shadow')}
        />
        {/* finish */}
        <rect width={W} height={H} filter={u('grain')} opacity="0.2" style={{ mixBlendMode: 'overlay' }} />
        <rect width={W} height={H} fill={u('vig')} />
        {rarity === 'legendary' && animate && <rect className="aeons-cardart__sheen" width={W} height={H} fill={u('sheen')} style={{ mixBlendMode: 'screen' }} />}
        {/* filigree border */}
        <g fill="none" stroke={rimColor}>
          <rect x="3.2" y="3.2" width={W - 6.4} height={H - 6.4} rx="2.4" strokeWidth="0.55" opacity="0.7" />
          <rect x="5" y="5" width={W - 10} height={H - 10} rx="1.4" strokeWidth="0.25" opacity="0.45" />
        </g>
        <Corners W={W} H={H} color={rimColor} />
      </g>
    </svg>
  );
}

/** four filigree corner flourishes */
function Corners({ W, H, color }: { W: number; H: number; color: string }) {
  const d = 'M3.2 11.5V6.6A3.4 3.4 0 0 1 6.6 3.2h4.9M5 9.2c1.8-.2 3.2-1.4 3.6-3.4M7.1 7.1l2.2 2.2';
  return (
    <g fill="none" stroke={color} strokeWidth="0.7" strokeLinecap="round" opacity="0.95">
      <path d={d} />
      <path d={d} transform={`translate(${W} 0) scale(-1 1)`} />
      <path d={d} transform={`translate(0 ${H}) scale(1 -1)`} />
      <path d={d} transform={`translate(${W} ${H}) scale(-1 -1)`} />
      <g fill={color} stroke="none">
        <circle cx="9.6" cy="9.6" r="0.75" />
        <circle cx={W - 9.6} cy="9.6" r="0.75" />
        <circle cx="9.6" cy={H - 9.6} r="0.75" />
        <circle cx={W - 9.6} cy={H - 9.6} r="0.75" />
      </g>
    </g>
  );
}
