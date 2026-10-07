import { useId, type CSSProperties } from 'react';
import { LOGO_LETTER_STYLE, LOGO_WORDMARK } from './logoGlyphs';
import './art.css';
export { Emblem, EmblemArt } from './Emblem';

export interface LogoProps {
  className?: string;
  height?: number;
  sheen?: boolean;
  emblem?: boolean;
  tagline?: boolean;
  style?: CSSProperties;
}

export function Logo({ className, height, tagline = false, style }: LogoProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradient = `mars-${id}`;
  return <div className={`aeons-logo ae-red-exodus-logo${className ? ` ${className}` : ''}`} style={style}>
    <svg viewBox={tagline ? '0 0 720 190' : '0 0 720 150'} height={height} width={height ? height * (720 / (tagline ? 190 : 150)) : undefined} role="img" aria-label="RED EXODUS — Fifty-one Arks. One red world.">
      <defs><linearGradient id={gradient} x1="0" y1="1" x2="0.9" y2="0"><stop offset="0" stopColor="#9b3d22"/><stop offset="0.58" stopColor="#d36a32"/><stop offset="1" stopColor="#f0b45e"/></linearGradient></defs>
      <path d="M110 76C220 -4 500 -4 610 76" fill="none" stroke="#e7a75d" strokeWidth="1.4" opacity=".86" />
      <text x="360" y="99" textAnchor="middle" fill={`url(#${gradient})`} stroke="#351a13" strokeWidth="2" paintOrder="stroke" fontFamily={LOGO_LETTER_STYLE.family} fontWeight={LOGO_LETTER_STYLE.weight} fontSize="74" letterSpacing={LOGO_LETTER_STYLE.tracking}>{LOGO_WORDMARK}</text>
      <path d="M112 117H608" stroke="#d88143" strokeWidth="1" opacity=".65" />
      {tagline && <text x="360" y="158" textAnchor="middle" fill="#e5c49b" fontFamily="Rajdhani, sans-serif" fontSize="17" letterSpacing="4">TWELVE ARKS · ONE RED WORLD</text>}
    </svg>
  </div>;
}
