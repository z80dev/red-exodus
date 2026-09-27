// Renders a motif glyph scaled to fill a target box by its real ink bounds (measured once per glyph via getBBox),
// so every motif sits at the same optical size on cards and crests regardless of how it was authored.
import { useLayoutEffect, useRef, useState } from 'react';
import type { Glyph } from '../icons/glyph';
import { GlyphLayers, type Keyline, type PaintMap } from '../icons/GlyphLayers';

interface Box { x: number; y: number; w: number; h: number }

/** measured ink bounds per glyph object (WeakMap: fresh glyph objects after HMR re-measure) */
const BOUNDS = new WeakMap<Glyph, Box>();
const GRID: Box = { x: 0, y: 0, w: 100, h: 100 };

export function FitGlyph({ glyph, paints, keyline, box, filter }: { glyph: Glyph; paints: PaintMap; keyline?: Keyline | null; box: Box; filter?: string }) {
  const ref = useRef<SVGGElement>(null);
  const [bounds, setBounds] = useState<Box | undefined>(() => BOUNDS.get(glyph));

  useLayoutEffect(() => {
    const cached = BOUNDS.get(glyph);
    if (cached) {
      if (cached !== bounds) setBounds(cached);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const b = el.getBBox();
    if (b.width <= 0 || b.height <= 0) return;
    // keyline + strokes extend ~2 units past the geometric bounds
    const measured = { x: b.x - 2, y: b.y - 2, w: b.width + 4, h: b.height + 4 };
    BOUNDS.set(glyph, measured);
    setBounds(measured);
  }, [glyph, bounds]);

  const b = bounds ?? GRID;
  const s = Math.min(box.w / b.w, box.h / b.h);
  const tx = box.x + (box.w - b.w * s) / 2 - b.x * s;
  const ty = box.y + (box.h - b.h * s) / 2 - b.y * s;
  return (
    <g transform={`translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(4)})`} filter={filter}>
      <g ref={ref}>
        <GlyphLayers glyph={glyph} paints={paints} keyline={keyline} />
      </g>
    </g>
  );
}
