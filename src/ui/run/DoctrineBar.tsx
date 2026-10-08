// Crew bar (internal: doctrines): owned Crew left→right (report order) + empty Slots. Tap → detail, drag → reorder
// (FLIP), drag onto the sell zone → sell (Shop). Pulses + floating text on `doctrineTriggered`.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react';
import { T } from '../terms';
import { DOCTRINES, LEADERS } from '../../content';
import { bus } from '../../game/bus';
import { useGame, useSim } from '../../game/store';
import { doctrineSlotsUsed } from '../../sim/roguelite';
import type { DoctrineInstance, Uid } from '../../sim/types';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { Card, CardZoom } from './Card';
import { doctrineCard } from './cards';
import { bump, centerOf, flipPlay, flipSnapshot, floatAt, floatText } from './fx';
import { act, haptic, sfx } from './runUtil';
import './bars.css';

export interface DoctrineBarProps {
  /** HUD strip (art-only mini cards) vs roomy Shop/report bar */
  compact?: boolean;
  /** card width (px or CSS length); defaults per mode */
  cardWidth?: number | string;
  /** show a sell zone while dragging + Sell in the detail view (Shop) */
  sellable?: boolean;
  /** "used/slots" badge next to the roomy bar (default true when not compact) */
  slotsBadge?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface DragState {
  uid: Uid;
  pointerId: number;
  startX: number;
  startY: number;
  origin: number;
  index: number;
  el: HTMLElement;
  centers: number[];
  slotLefts: number[];
  active: boolean;
  overSell: boolean;
}

const DRAG_START_PX = 8;

export function DoctrineBar({ compact = true, cardWidth, sellable = false, slotsBadge = !compact, className = '', style }: DoctrineBarProps) {
  const run = useSim((s) => s.run);
  const phase = run?.phase;
  const doctrines = run?.doctrines ?? [];
  const slots = run?.doctrineSlots ?? 0;
  const used = run ? doctrineSlotsUsed(run) : 0;
  const empty = Math.max(0, slots - used);

  const rowRef = useRef<HTMLDivElement>(null);
  const sellRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<Uid[] | null>(null);
  const [dragging, setDragging] = useState<Uid | null>(null);
  const [overSell, setOverSell] = useState(false);
  const [detail, setDetail] = useState<Uid | null>(null);

  const byUid = new Map(doctrines.map((d) => [d.uid, d]));
  const order: DoctrineInstance[] = (preview ?? doctrines.map((d) => d.uid)).map((u) => byUid.get(u)).filter((d): d is DoctrineInstance => !!d);
  const orderKey = order.map((d) => d.uid).join(',');

  // auto-FLIP whenever the rendered order changes (reorder, gain, sell)
  const rects = useRef<Map<string, DOMRect>>(new Map());
  useLayoutEffect(() => {
    const now = flipSnapshot(rowRef.current);
    flipPlay(rowRef.current, rects.current, dragging != null ? String(dragging) : undefined);
    rects.current = now;
  }, [orderKey, empty, dragging]);

  // juice: pulse the card that just triggered
  useEffect(() => bus.on((ev) => {
    if (ev.type !== 'doctrineTriggered') return;
    const el = rowRef.current?.querySelector<HTMLElement>(`[data-doctrine-uid="${ev.uid}"]`);
    if (!el) return;
    el.classList.remove('is-triggered');
    void el.offsetWidth;
    el.classList.add('is-triggered');
    bump(el, 1.18, 380);
    floatAt(el, escapeHtml(ev.text), { tone: 'gold', size: compact ? 13 : 16, rise: 34, duration: 1300, dy: compact ? 0 : 8 });
  }), [compact]);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>, d: DoctrineInstance, index: number) => {
    if (e.button !== 0 || !rowRef.current) return;
    const els = [...rowRef.current.querySelectorAll<HTMLElement>('[data-doctrine-uid]')];
    const rectList = els.map((el) => el.getBoundingClientRect());
    drag.current = {
      uid: d.uid, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin: index, index,
      el: e.currentTarget, centers: rectList.map((r) => r.left + r.width / 2), slotLefts: rectList.map((r) => r.left),
      active: false, overSell: false,
    };
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = drag.current;
      if (!g || e.pointerId !== g.pointerId) return;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (!g.active) {
        if (Math.hypot(dx, dy) < DRAG_START_PX) return;
        g.active = true;
        setDragging(g.uid);
        setPreview(useGame.getState().state?.run.doctrines.map((x) => x.uid) ?? null);
        sfx('select');
        haptic(8);
      }
      // nearest slot centre
      let best = 0;
      let bestD = Infinity;
      g.centers.forEach((c, i) => {
        const dist = Math.abs(e.clientX - c);
        if (dist < bestD) { bestD = dist; best = i; }
      });
      if (best !== g.index) {
        g.index = best;
        setPreview((prev) => {
          if (!prev) return prev;
          const next = prev.filter((u) => u !== g.uid);
          next.splice(best, 0, g.uid);
          return next;
        });
        sfx('tap', { pitch: 0.9 + best * 0.06 });
      }
      const slotShift = (g.slotLefts[g.index] ?? 0) - (g.slotLefts[g.origin] ?? 0);
      g.el.style.transform = `translate(${dx - slotShift}px, ${dy}px) scale(1.12) rotate(${Math.max(-8, Math.min(8, dx * 0.03))}deg)`;
      if (sellable && sellRef.current) {
        const r = sellRef.current.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12;
        if (inside !== g.overSell) {
          g.overSell = inside;
          setOverSell(inside);
          if (inside) haptic(10);
        }
      }
    };
    const up = (e: PointerEvent) => {
      const g = drag.current;
      if (!g || e.pointerId !== g.pointerId) return;
      drag.current = null;
      if (!g.active) {
        // plain tap → detail
        sfx('open');
        setDetail(g.uid);
        return;
      }
      const el = g.el;
      const from = el.style.transform;
      el.style.transform = '';
      if (g.overSell) {
        const inst = useGame.getState().state?.run.doctrines.find((x) => x.uid === g.uid);
        const at = centerOf(sellRef.current);
        const res = act({ type: 'sellDoctrine', uid: g.uid });
        if (res.ok) {
          sfx('sell');
          haptic([10, 30, 10]);
          floatText(at.x, at.y, `+${inst?.sellValue ?? ''} ◈`, { tone: 'influence', size: 22 });
        }
      } else {
        if (g.index !== g.origin) {
          act({ type: 'moveDoctrine', uid: g.uid, toIndex: g.index });
          sfx('cardDeal', { volume: 0.6 });
        }
        el.animate([{ transform: from }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
      }
      setPreview(null);
      setDragging(null);
      setOverSell(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [sellable]);

  if (!run) return null;
  const width = cardWidth ?? (compact ? 'var(--rdb-mini-w)' : 'var(--rdb-card-w)');
  const state = useGame.getState().state;
  const detailInst = detail != null ? doctrines.find((d) => d.uid === detail) : undefined;
  const canSell = sellable || phase === 'council';

  const move = (inst: DoctrineInstance, delta: number) => {
    const idx = doctrines.findIndex((d) => d.uid === inst.uid);
    const to = Math.max(0, Math.min(doctrines.length - 1, idx + delta));
    if (to === idx) return;
    act({ type: 'moveDoctrine', uid: inst.uid, toIndex: to });
    sfx('cardDeal', { volume: 0.6 });
  };

  return (
    <div className={`rdb ${compact ? 'rdb--compact' : 'rdb--full'} ${dragging != null ? 'is-dragging' : ''} ${className}`} style={style}>
      <div className="rdb-row" ref={rowRef}>
        {order.map((d, i) => (
          <div
            key={d.uid}
            className={`rdb-slot ${dragging === d.uid ? 'is-dragged' : ''} ${d.disabled ? 'is-disabled' : ''}`}
            data-flip={d.uid}
            data-doctrine-uid={d.uid}
            onPointerDown={(e) => onPointerDown(e, d, i)}
          >
            <Card card={doctrineCard(d.id, d.edition, d, state)} width={width} tilt={!compact && dragging == null} zoomable={false} disabled={d.disabled} />
            {(() => {
              const nationId = DOCTRINES[d.id]?.nation;
              const nation = nationId ? LEADERS[nationId] : undefined;
              return nation ? (
                <span
                  className="rdb-nation"
                  title={nation.country}
                  aria-label={`${nation.country} ${T.doctrine}`}
                  style={{ '--flag': `linear-gradient(90deg, ${nation.flagColors.join(', ')})` } as CSSProperties}
                >{nation.code}</span>
              ) : null;
            })()}
            {d.disabled && <div className="rdb-chain" title="Disabled"><Icon name="lock" size={compact ? 14 : 18} /></div>}
            {!compact && <div className="rdb-index num">{i + 1}</div>}
          </div>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div key={`empty-${i}`} className="rdb-socket" data-flip={`empty-${i}`} style={{ width: typeof width === 'number' ? `${width}px` : width }}>
            <Icon name="doctrine" size={compact ? 14 : 20} />
          </div>
        ))}
      </div>
      {slotsBadge && (
        <div className="rdb-meta num" aria-label={`${T.doctrine} ${T.doctrineSlot}s`}>
          <Icon name="doctrine" size={13} /> {used}/{slots}
        </div>
      )}
      {sellable && (
        <div ref={sellRef} className={`rdb-sell ${dragging != null ? 'is-visible' : ''} ${overSell ? 'is-over' : ''}`}>
          <Icon name="influence" size={18} />
          <span className="display">Sell for {T.influence}</span>
          {dragging != null && <span className="num">+{doctrines.find((d) => d.uid === dragging)?.sellValue ?? 0}</span>}
        </div>
      )}
      {detailInst && (
        <CardZoom
          card={doctrineCard(detailInst.id, detailInst.edition, detailInst, state)}
          onClose={() => setDetail(null)}
          actions={
            <>
              <Button small onClick={() => move(detailInst, -1)} disabled={doctrines[0]?.uid === detailInst.uid} aria-label="Move left">
                <Icon name="chevronLeft" size={16} />
              </Button>
              {canSell && (
                <Button
                  small
                  variant="danger"
                  onClick={() => {
                    const res = act({ type: 'sellDoctrine', uid: detailInst.uid });
                    if (res.ok) {
                      sfx('sell');
                      const c = { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
                      floatText(c.x, c.y, `+${detailInst.sellValue} ◈`, { tone: 'influence', size: 26 });
                      setDetail(null);
                    }
                  }}
                >
                  Sell · +{detailInst.sellValue} <Icon name="influence" size={14} />
                </Button>
              )}
              <Button small onClick={() => move(detailInst, 1)} disabled={doctrines[doctrines.length - 1]?.uid === detailInst.uid} aria-label="Move right">
                <Icon name="chevronRight" size={16} />
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
