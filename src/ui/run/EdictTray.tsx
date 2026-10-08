// Boost tray (internal: edicts): one-use Boost cards + empty sockets. Tap → Use / Choose target / Remove.
// Targeted Boosts enter the HUD's edictTarget map mode before dispatching useEdict.
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { EDICTS } from '../../content';
import { useGame, useSim } from '../../game/store';
import type { Uid } from '../../sim/types';
import { T } from '../terms';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { Card, CardZoom } from './Card';
import { edictCard } from './cards';
import { flipPlay, flipSnapshot, sparkBurst } from './fx';
import { act, haptic, sfx } from './runUtil';
import './bars.css';

export interface EdictTrayProps {
  compact?: boolean;
  cardWidth?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function EdictTray({ compact = true, cardWidth, className = '', style }: EdictTrayProps) {
  const run = useSim((s) => s.run);
  const mode = useGame((g) => g.mode);
  const [detail, setDetail] = useState<Uid | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const rects = useRef<Map<string, DOMRect>>(new Map());
  const edicts = run?.edicts ?? [];
  const empty = Math.max(0, (run?.edictSlots ?? 0) - edicts.length);
  const key = edicts.map((e) => e.uid).join(',');
  useLayoutEffect(() => {
    const now = flipSnapshot(rowRef.current);
    flipPlay(rowRef.current, rects.current);
    rects.current = now;
  }, [key, empty]);

  if (!run) return null;
  const width = cardWidth ?? (compact ? 'var(--rdb-mini-w)' : 'var(--rdb-card-w)');
  const targeting = mode.kind === 'edictTarget' ? mode.uid : null;
  const playing = run.phase === 'playing';
  const inst = detail != null ? edicts.find((e) => e.uid === detail) : undefined;
  const def = inst ? EDICTS[inst.id] : undefined;

  const onTap = (uid: Uid) => {
    if (targeting === uid) {
      sfx('close');
      useGame.getState().setMode({ kind: 'normal' });
      return;
    }
    sfx('open');
    setDetail(uid);
  };

  const use = () => {
    if (!inst) return;
    const target = def?.target ?? 'none';
    if (target === 'none') {
      const el = rowRef.current?.querySelector(`[data-edict-uid="${inst.uid}"]`) ?? null;
      const res = act({ type: 'useEdict', uid: inst.uid });
      if (res.ok) {
        sfx('levelUp');
        haptic([12, 40, 18]);
        sparkBurst(el, 'var(--gold-300)');
        setDetail(null);
      }
      return;
    }
    sfx('select');
    useGame.getState().select(null);
    useGame.getState().setMode({ kind: 'edictTarget', uid: inst.uid });
    setDetail(null);
  };

  return (
    <div className={`rdb ret ${compact ? 'rdb--compact' : 'rdb--full'} ${className}`} style={style}>
      <div className="rdb-row" ref={rowRef}>
        {edicts.map((e) => (
          <div key={e.uid} className={`rdb-slot ${targeting === e.uid ? 'is-targeting' : ''}`} data-flip={e.uid} data-edict-uid={e.uid}>
            <Card card={edictCard(e.id)} width={width} tilt={!compact} zoomable={false} onTap={() => onTap(e.uid)} selected={targeting === e.uid} />
            {targeting === e.uid && <div className="ret-aim"><Icon name="close" size={12} /></div>}
          </div>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div key={`empty-${i}`} className="rdb-socket rdb-socket--edict" data-flip={`e-empty-${i}`} style={{ width: typeof width === 'number' ? `${width}px` : width }}>
            <Icon name="edict" size={compact ? 14 : 20} />
          </div>
        ))}
      </div>
      {inst && (
        <CardZoom
          card={edictCard(inst.id)}
          onClose={() => setDetail(null)}
          actions={
            <>
              <Button small variant="gold" disabled={!playing} onClick={use}>
                {(def?.target ?? 'none') === 'none' ? 'Use' : 'Choose target'}
              </Button>
              <Button
                small
                variant="ghost"
                onClick={() => {
                  const res = act({ type: 'discardEdict', uid: inst.uid });
                  if (res.ok) {
                    sfx('sell');
                    setDetail(null);
                  }
                }}
              >
                Remove
              </Button>
              {!playing && <div className="ret-note">You can use {T.edicts} on the map during your turn.</div>}
            </>
          }
        />
      )}
    </div>
  );
}
