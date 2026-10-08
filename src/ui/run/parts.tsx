// Shared run-overlay pieces: Lives hearts, Coins counter, divider and orientation hook.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { PILLARS } from '../../sim/types';
import type { PillarId } from '../../sim/types';
import { T } from '../terms';
import { Icon } from '../icons/Icon';
import { useTweened } from './fx';
import { fmt, pillarInfo } from './runUtil';
import './run.css';

export function Ornament({ className = '', draw = false }: { className?: string; draw?: boolean }) {
  return (
    <svg className={`ro-ornament ${draw ? 'is-draw' : ''} ${className}`} viewBox="0 0 320 24" aria-hidden>
      <defs>
        <linearGradient id="roOrnGold" x1="0" x2="1">
          <stop offset="0" stopColor="#d9ab3f" stopOpacity="0" />
          <stop offset="0.3" stopColor="#eac766" />
          <stop offset="0.5" stopColor="#fff0b8" />
          <stop offset="0.7" stopColor="#eac766" />
          <stop offset="1" stopColor="#d9ab3f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="ro-orn-line" d="M4 12 H128 M192 12 H316" stroke="url(#roOrnGold)" strokeWidth="1.4" fill="none" />
      <path className="ro-orn-line" d="M128 12 C136 3 146 3 148 10 C150 15 144 17 142 13 M192 12 C184 21 174 21 172 14 C170 9 176 7 178 11"
        stroke="#eac766" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path className="ro-orn-line" d="M128 12 C136 21 146 21 148 14 C150 9 144 7 142 11 M192 12 C184 3 174 3 172 10 C170 15 176 17 178 13"
        stroke="#eac766" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M160 3 L167 12 L160 21 L153 12 Z" fill="#eac766" className="ro-orn-gem" />
      <path d="M160 7 L163.5 12 L160 17 L156.5 12 Z" fill="#0c111b" className="ro-orn-gem" />
      <circle cx="100" cy="12" r="1.8" fill="#eac766" />
      <circle cx="220" cy="12" r="1.8" fill="#eac766" />
    </svg>
  );
}

/** Lives hearts (internal: mandate). `shatter` = how many of the rightmost filled hearts break (animated). */
export function Hearts({ total, filled, shatter = 0, size = 20 }: { total: number; filled: number; shatter?: number; size?: number }) {
  return (
    <div className="ro-hearts" aria-label={`${T.mandate} ${Math.max(0, filled - shatter)} of ${total}`}>
      {Array.from({ length: Math.max(total, filled) }, (_, i) => {
        const on = i < filled;
        const breaking = on && i >= filled - shatter;
        return (
          <span key={i} className={`ro-heart ${on ? 'is-on' : ''} ${breaking ? 'is-breaking' : ''}`} style={{ width: size, height: size }}>
            <span className="ro-heart-l"><Icon name="mandate" size={size} /></span>
            <span className="ro-heart-r"><Icon name="mandate" size={size} /></span>
          </span>
        );
      })}
    </div>
  );
}

export function InfluencePill({ value, big = false, className = '' }: { value: number; big?: boolean; className?: string }) {
  const shown = useTweened(value, 520);
  return (
    <div className={`ro-influence ${big ? 'ro-influence--big' : ''} ${className}`} aria-label={`${value} ${T.influence}`}>
      <Icon name="influence" size={big ? 22 : 16} />
      <span className="num">{fmt(shown)}</span>
    </div>
  );
}

export function usePortrait(): boolean {
  const [p, setP] = useState(() => window.innerHeight >= window.innerWidth);
  useEffect(() => {
    const on = () => setP(window.innerHeight >= window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return p;
}

/** Six Focus pillar level chips (`[data-pillar=<id>]`). */
export function PillarStrip({ levels, focus, className = '' }: { levels: Record<PillarId, number>; focus?: PillarId; className?: string }) {
  return (
    <div className={`ro-pillars ${className}`} aria-label={`${T.focus} levels`}>
      {PILLARS.map((p) => {
        const info = pillarInfo(p);
        return (
          <div key={p} className={`ro-pillar ${focus === p ? 'is-focus' : ''}`} data-pillar={p} style={{ '--pc': info.color } as CSSProperties} title={`${info.name} · Level ${levels[p] ?? 1}`}>
            <Icon name={info.icon} size={16} />
            <span className="num">{levels[p] ?? 1}</span>
          </div>
        );
      })}
    </div>
  );
}
