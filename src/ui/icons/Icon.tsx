// OWNER: Art2D. The AEONS icon component. Names: docs/ARCHITECTURE.md §Icons (+ every motif name, every
// resource/improvement/building/wonder id). Unknown content ids resolve to a category glyph (see registry.ts).
import type { CSSProperties } from 'react';
import { GlyphLayers, type Keyline, type PaintMap } from './GlyphLayers';
import { resolveGlyph, type IconName } from './registry';
import './icons.css';

export type { IconName } from './registry';
export { ICON_NAMES, isIconName, resolveGlyph } from './registry';

const KEYLINE: Keyline = { color: 'rgba(18, 11, 5, 0.92)', width: 1.05 };

/** paint slots for colored game glyphs */
export function gamePaints(main: string, accent = 'var(--gold-400)'): PaintMap {
  return {
    m: [main, 1],
    a: [accent, 1],
    h: ['#ffffff', 0.42],
    k: ['#1a0e04', 0.3],
    p: ['var(--parchment)', 1],
    d: ['#1b130c', 1],
  };
}

function uiPaints(main: string): PaintMap {
  return {
    m: [main, 1],
    a: [main, 0.45],
    h: ['#ffffff', 0.35],
    k: ['#000000', 0.25],
    p: ['var(--parchment)', 1],
    d: ['#1b130c', 1],
  };
}

export interface IconProps {
  name: IconName | (string & {});
  /** px; default 1.2em (inline with text) */
  size?: number;
  className?: string;
  /** overrides the main color (ui glyphs default to currentColor, game glyphs to their own tint) */
  color?: string;
  /** accessible label; icons are decorative (aria-hidden) without it */
  title?: string;
  style?: CSSProperties;
}

export function Icon({ name, size, className, color, title, style }: IconProps) {
  const glyph = resolveGlyph(name);
  const dim = size ?? '1.2em';
  const paints = glyph.ui ? uiPaints(color ?? 'currentColor') : gamePaints(color ?? glyph.c, glyph.a);
  return (
    <svg
      className={className ? `aeons-icon ${className}` : 'aeons-icon'}
      viewBox="0 0 24 24"
      width={dim}
      height={dim}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <GlyphLayers glyph={glyph} paints={paints} keyline={KEYLINE} />
    </svg>
  );
}
