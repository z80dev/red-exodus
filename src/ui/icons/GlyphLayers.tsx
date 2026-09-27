// Renders a Glyph's layer stack. Shared by <Icon> (24-grid glyphs) and the art components (100-grid motifs).
import type { CSSProperties } from 'react';
import type { Glyph, Layer, Paint } from './glyph';

type PaintKey = 'm' | 'a' | 'h' | 'k' | 'p' | 'd';
/** paint slot → [css color, opacity] */
export type PaintMap = Record<PaintKey, readonly [string, number]>;

export interface Keyline {
  color: string;
  /** visible keyline thickness outside the silhouette, in grid units */
  width: number;
}

function resolve(p: Paint, paints: PaintMap): readonly [string, number] {
  return p in paints ? paints[p as PaintKey] : [p, 1];
}

function layerProps(l: Layer, paints: PaintMap): { style: CSSProperties; fillRule?: 'evenodd'; transform?: string } {
  const style: CSSProperties = {};
  let alpha = l.o ?? 1;
  if (l.f) {
    const [c, o] = resolve(l.f, paints);
    style.fill = c;
    if (o !== 1) style.fillOpacity = o;
  } else style.fill = 'none';
  if (l.s) {
    const [c, o] = resolve(l.s, paints);
    style.stroke = c;
    style.strokeWidth = l.w ?? 2;
    style.strokeLinecap = 'round';
    style.strokeLinejoin = 'round';
    if (o !== 1) style.strokeOpacity = o;
  }
  if (!l.f && !l.s) alpha = 0;
  if (alpha !== 1) style.opacity = alpha;
  return { style, fillRule: l.eo ? 'evenodd' : undefined, transform: l.t };
}

/** Draws the keyline pass (silhouette grown by `keyline.width`) then every layer. */
export function GlyphLayers({ glyph, paints, keyline }: { glyph: Glyph; paints: PaintMap; keyline?: Keyline | null }) {
  const kl = keyline && !glyph.ui ? keyline : null;
  return (
    <>
      {kl && (
        <g style={{ fill: kl.color, stroke: kl.color, strokeLinejoin: 'round', strokeLinecap: 'round' }}>
          {glyph.l.map((l, i) =>
            l.inner || (!l.f && !l.s) ? null : (
              <path
                key={i}
                d={l.d}
                transform={l.t}
                fillRule={l.eo ? 'evenodd' : undefined}
                style={l.f ? { strokeWidth: kl.width * 2 + (l.s ? (l.w ?? 2) : 0) } : { fill: 'none', strokeWidth: (l.w ?? 2) + kl.width * 2 }}
              />
            ),
          )}
        </g>
      )}
      {glyph.l.map((l, i) => (
        <path key={i} d={l.d} {...layerProps(l, paints)} />
      ))}
    </>
  );
}
