// Floating numbers over map tiles ('+1 pop', '−24'), tracked to the camera via renderer.screenPos every frame.
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { create } from 'zustand';
import { getRenderer } from '../../game/bridge';
import type { TileIdx } from '../../sim/types';
import { Icon } from '../icons/Icon';

export interface Floater {
  id: number;
  tile: TileIdx;
  text: string;
  color: string;
  icon?: string;
  big?: boolean;
  /** ms before appearing (lets the renderer's hit/move animation land first) */
  delay: number;
  born: number;
}

const LIFE_MS = 1700;
let nextId = 1;

interface FloaterStore { items: Floater[] }
const useFloaters = create<FloaterStore>(() => ({ items: [] }));

/** Pop a floating label over a tile. Several on the same tile stack upward. */
export function floatAt(tile: TileIdx, text: string, color: string, opts: { icon?: string; big?: boolean; delay?: number } = {}): void {
  const now = performance.now();
  const stackDelay = useFloaters.getState().items.filter((f) => f.tile === tile && now - f.born < 400).length * 220;
  const f: Floater = { id: nextId++, tile, text, color, icon: opts.icon, big: opts.big, delay: (opts.delay ?? 0) + stackDelay, born: now };
  useFloaters.setState((s) => ({ items: [...s.items, f] }));
  setTimeout(() => useFloaters.setState((s) => ({ items: s.items.filter((x) => x.id !== f.id) })), f.delay + LIFE_MS + 50);
}

export function Floaters() {
  const items = useFloaters((s) => s.items);
  const refs = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    if (!items.length) return;
    let raf = 0;
    const tick = () => {
      const r = getRenderer();
      const now = performance.now();
      for (const f of items) {
        const el = refs.current.get(f.id);
        if (!el) continue;
        const pos = r?.screenPos(f.tile) ?? null;
        const t = (now - f.born - f.delay) / LIFE_MS;
        if (!pos || t < 0 || t > 1) { el.style.opacity = '0'; continue; }
        const rise = 1 - Math.pow(1 - Math.min(1, t * 1.6), 3);
        const scale = t < 0.12 ? 0.6 + (t / 0.12) * 0.55 : t < 0.22 ? 1.15 - ((t - 0.12) / 0.1) * 0.15 : 1;
        el.style.opacity = String(t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1);
        el.style.transform = `translate3d(${pos.x}px, ${pos.y - 26 - rise * 46}px, 0) translate(-50%, -50%) scale(${scale})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [items]);

  return (
    <div className="fl" aria-hidden>
      {items.map((f) => (
        <div key={f.id} className={`fl__item ${f.big ? 'is-big' : ''}`} style={{ '--fc': f.color, opacity: 0 } as CSSProperties}
          ref={(el) => { if (el) refs.current.set(f.id, el); else refs.current.delete(f.id); }}>
          {f.icon && <Icon name={f.icon} size={f.big ? 22 : 17} />}
          <span className="num">{f.text}</span>
        </div>
      ))}
    </div>
  );
}
