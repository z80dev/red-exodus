// OWNER: Art2D. The AEONS emblem — ring of ages, hex field, radiant star. Pure SVG with literal colors (no CSS),
// so scripts/art2d_icons.tsx can render it to the PWA icons with resvg.
import { useId, type CSSProperties } from 'react';

/** Radiant compass-star path centered at (cx,cy): 4 long + 4 short points joined by concave curves. */
function radiantStar(cx: number, cy: number, r: number): string {
  const tip = (i: number) => {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const R = i % 2 ? r * 0.52 : r;
    return `${(cx + R * Math.cos(a)).toFixed(2)} ${(cy + R * Math.sin(a)).toFixed(2)}`;
  };
  let d = `M${tip(0)}`;
  for (let i = 0; i < 8; i++) {
    const b = (i * Math.PI) / 4 - Math.PI / 2 + Math.PI / 8;
    d += `Q${(cx + r * 0.13 * Math.cos(b)).toFixed(2)} ${(cy + r * 0.13 * Math.sin(b)).toFixed(2)} ${tip((i + 1) % 8)}`;
  }
  return `${d}Z`;
}

function ringTicks(cx: number, cy: number, r1: number, r2: number, n: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n - Math.PI / 2;
    d += `M${(cx + r1 * Math.cos(a)).toFixed(2)} ${(cy + r1 * Math.sin(a)).toFixed(2)}L${(cx + r2 * Math.cos(a)).toFixed(2)} ${(cy + r2 * Math.sin(a)).toFixed(2)}`;
  }
  return d;
}

function hexPath(cx: number, cy: number, r: number): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

const GOLD_STOPS: [number, string][] = [
  [0, '#fff6cf'],
  [0.28, '#f6d77c'],
  [0.5, '#d9a441'],
  [0.52, '#b98529'],
  [0.74, '#f0cd6c'],
  [1, '#8e5f17'],
];

export function GoldGradient({ id, x1 = 0, y1 = 0, x2 = 0, y2 = 1 }: { id: string; x1?: number; y1?: number; x2?: number; y2?: number }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {GOLD_STOPS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
    </linearGradient>
  );
}

/** Emblem artwork on a 100×100 grid, centered at (50,50), radius ~48. `bare` omits the hex field (for the wordmark O). */
export function EmblemArt({ uid, bare = false }: { uid: string; bare?: boolean }) {
  const k = (s: string) => `${uid}${s}`;
  const u = (s: string) => `url(#${k(s)})`;
  return (
    <g>
      <defs>
        <GoldGradient id={k('g')} x1={0.2} y1={0} x2={0.8} y2={1} />
        <radialGradient id={k('field')} cx="0.5" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#24324f" />
          <stop offset="1" stopColor="#0a0f1a" />
        </radialGradient>
        <radialGradient id={k('halo')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe9a6" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#f2c14e" stopOpacity="0.25" />
          <stop offset="1" stopColor="#f2c14e" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* ring of ages */}
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#1d1204" strokeWidth="10.5" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke={u('g')} strokeWidth="7.4" />
      <path d={ringTicks(50, 50, 41.6, 47.4, 24)} stroke="#5a3a0c" strokeWidth="1" opacity="0.8" />
      <circle cx="50" cy="50" r="47.6" fill="none" stroke="#fff3c4" strokeWidth="0.6" opacity="0.6" />
      {!bare && (
        <>
          <path d={hexPath(50, 50, 36.5)} fill={u('field')} stroke="#1d1204" strokeWidth="3.4" strokeLinejoin="round" />
          <path d={hexPath(50, 50, 36.5)} fill="none" stroke={u('g')} strokeWidth="1.6" strokeLinejoin="round" />
          <path d={hexPath(50, 50, 32.5)} fill="none" stroke="#f2c14e" strokeWidth="0.5" opacity="0.45" />
        </>
      )}
      <circle cx="50" cy="50" r="24" fill={u('halo')} />
      {/* radiant star */}
      <path d={radiantStar(50, 50, bare ? 34 : 28)} fill="#1d1204" stroke="#1d1204" strokeWidth="3.2" strokeLinejoin="round" />
      <path d={radiantStar(50, 50, bare ? 34 : 28)} fill={u('g')} />
      <path d={`M50 ${bare ? 16 : 22}L50 50L${bare ? 84 : 78} 50`} fill="none" stroke="#fffbe6" strokeWidth="0.7" opacity="0.7" />
      <path d={`M50 50L50 ${bare ? 84 : 78}M50 50L${bare ? 16 : 22} 50`} fill="none" stroke="#6b4510" strokeWidth="0.7" opacity="0.55" />
      <circle cx="50" cy="50" r={bare ? 4.4 : 3.8} fill="#1d1204" />
      <circle cx="50" cy="50" r={bare ? 3 : 2.6} fill="#fff4cc" />
    </g>
  );
}

/** Standalone AEONS emblem (square). */
export function Emblem({ size, className, style, title }: { size?: number; className?: string; style?: CSSProperties; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <EmblemArt uid={uid} />
    </svg>
  );
}
