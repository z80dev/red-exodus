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
  [0, '#fff0d8'],
  [0.28, '#f28c46'],
  [0.5, '#c95e37'],
  [0.52, '#8f3929'],
  [0.74, '#e99a52'],
  [1, '#582a26'],
];

export function GoldGradient({ id, x1 = 0, y1 = 0, x2 = 0, y2 = 1 }: { id: string; x1?: number; y1?: number; x2?: number; y2?: number }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {GOLD_STOPS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
    </linearGradient>
  );
}

/** RED EXODUS mark: a rising Mars horizon, orbital ring and landing rocket. */
export function EmblemArt({ uid, bare = false }: { uid: string; bare?: boolean }) {
  const k = (s: string) => `${uid}${s}`;
  const u = (s: string) => `url(#${k(s)})`;
  return (
    <g>
      <defs>
        <GoldGradient id={k('g')} x1={0.2} y1={0} x2={0.8} y2={1} />
        <radialGradient id={k('field')} cx="0.5" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#994b34" />
          <stop offset="1" stopColor="#271f20" />
        </radialGradient>
        <radialGradient id={k('halo')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb365" stopOpacity="0.7" />
          <stop offset="0.45" stopColor="#f07842" stopOpacity="0.24" />
          <stop offset="1" stopColor="#f07842" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#201816" strokeWidth="10.5" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke={u('g')} strokeWidth="7.4" />
      <path d={ringTicks(50, 50, 41.6, 47.4, 24)} stroke="#5a2d1d" strokeWidth="1" opacity="0.8" />
      <circle cx="50" cy="50" r="47.6" fill="none" stroke="#fff0d6" strokeWidth="0.6" opacity="0.6" />
      {!bare && (
        <>
          <path d={hexPath(50, 50, 36.5)} fill={u('field')} stroke="#201816" strokeWidth="3.4" strokeLinejoin="round" />
          <path d={hexPath(50, 50, 36.5)} fill="none" stroke={u('g')} strokeWidth="1.6" strokeLinejoin="round" />
          <path d={hexPath(50, 50, 32.5)} fill="none" stroke="#e77d46" strokeWidth="0.5" opacity="0.45" />
        </>
      )}
      <circle cx="50" cy="50" r="24" fill={u('halo')} />
      <path d="M25 60Q50 51 75 60M29 64Q50 57 71 64" fill="none" stroke="#f2b16f" strokeWidth="1.1" opacity="0.9" />
      <path d={radiantStar(50, 50, bare ? 34 : 28)} fill="#201816" stroke="#201816" strokeWidth="3.2" strokeLinejoin="round" />
      <path d={radiantStar(50, 50, bare ? 34 : 28)} fill={u('g')} />
      <path d="M42 58 50 34 58 58 53 55 50 62 47 55Z" fill="#283b43" stroke="#fff1d7" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M47 55 50 47 53 55 50 59Z" fill="#5fd4e8" />
      <path d="M46 60l-4 5M54 60l4 5" stroke="#ed7544" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.1" fill="#fff0d4" />
    </g>
  );
}

/** Standalone RED EXODUS emblem (square). */
export function Emblem({ size, className, style, title }: { size?: number; className?: string; style?: CSSProperties; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 100 100" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <EmblemArt uid={uid} />
    </svg>
  );
}

