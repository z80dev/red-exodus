// Universal 5:7 card: doctrine / edict / scroll / crisis / omen / pack / reform / pillar / leader.
// Ornate rarity frame with gold filigree corners, illustrated or procedural art, edition shaders
// (gilded sheen, radiant pulse, prismatic foil tracking the pointer, ethereal shimmer), 3D tilt,
// flip, press lift, long-press → zoom modal. Content scales with card width (container units).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as RPointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CardArt } from '../art/CardArt';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import type { CardModel } from './cards';
import { EDITION_LABEL, EDITION_TEXT } from './cards';
import { haptic, sfx } from './runUtil';
import { T, TITLE } from '../terms';
import './card.css';

export type { CardModel } from './cards';

export interface CardProps {
  card: CardModel;
  /** px number or any CSS length (e.g. 'var(--shop-card-w)'); height follows 5:7 */
  width?: number | string;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** codex silhouette: art blacked out, title "???" */
  locked?: boolean;
  /** pointer-driven 3D tilt + foil tracking (default true) */
  tilt?: boolean;
  /** long-press opens the zoom modal (default true) */
  zoomable?: boolean;
  /** actions shown under the card in the zoom modal */
  zoomActions?: ReactNode;
  onTap?: () => void;
  /** overrides the default zoom on long-press */
  onLongPress?: () => void;
  className?: string;
  style?: CSSProperties;
  /** overlays rendered on top of the card face (badges, sold stamp) */
  children?: ReactNode;
}

const LONG_PRESS_MS = 430;
const MOVE_CANCEL_PX = 10;

export function Card(props: CardProps) {
  const {
    card, width = 160, faceDown = false, selected = false, disabled = false, locked = false,
    tilt = true, zoomable = true, zoomActions, onTap, onLongPress, className = '', style, children,
  } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; timer: number; long: boolean; moved: boolean } | null>(null);
  const [pressed, setPressed] = useState(false);
  const [zoom, setZoom] = useState(false);

  const setTilt = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    el.style.setProperty('--rx', `${(0.5 - py) * 18}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 22}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    el.style.setProperty('--glare', '1');
    el.classList.add('is-tilting');
  }, []);
  const resetTilt = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    el.classList.remove('is-tilting');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--glare', '0');
  }, []);

  useEffect(() => () => {
    if (press.current) clearTimeout(press.current.timer);
  }, []);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const timer = window.setTimeout(() => {
      if (!press.current || press.current.moved) return;
      press.current.long = true;
      setPressed(false);
      haptic(12);
      if (onLongPress) onLongPress();
      else if (zoomable && !faceDown) {
        sfx('open');
        setZoom(true);
      }
    }, LONG_PRESS_MS);
    press.current = { x: e.clientX, y: e.clientY, timer, long: false, moved: false };
    setPressed(true);
    if (tilt && !faceDown) setTilt(e.clientX, e.clientY);
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_CANCEL_PX) {
      p.moved = true;
      clearTimeout(p.timer);
      setPressed(false);
    }
    if (tilt && !faceDown && (e.pointerType === 'mouse' || p)) setTilt(e.clientX, e.clientY);
  };
  const endPress = (fire: boolean) => {
    const p = press.current;
    press.current = null;
    setPressed(false);
    if (!p) return;
    clearTimeout(p.timer);
    if (fire && !p.long && !p.moved && onTap) onTap();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap?.();
    }
  };

  const edition = card.edition ?? 'base';
  const cls = [
    'rc',
    `rc--${card.kind}`,
    `rc--r-${card.rarity ?? 'common'}`,
    edition !== 'base' ? `rc--e-${edition}` : '',
    faceDown ? 'is-down' : '',
    selected ? 'is-selected' : '',
    disabled ? 'is-disabled' : '',
    locked ? 'is-locked' : '',
    pressed ? 'is-pressed' : '',
    onTap ? 'is-tappable' : '',
    className,
  ].filter(Boolean).join(' ');
  const rootStyle: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    ...(card.accent ? ({ '--rc-accent': card.accent } as CSSProperties) : null),
    ...style,
  };

  return (
    <>
      <div
        ref={rootRef}
        className={cls}
        style={rootStyle}
        role={onTap ? 'button' : undefined}
        tabIndex={onTap ? 0 : undefined}
        aria-label={locked ? 'Unknown card' : `${card.title}. ${card.typeLabel}`}
        aria-pressed={onTap ? selected : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endPress(true)}
        onPointerCancel={() => endPress(false)}
        onPointerLeave={() => {
          resetTilt();
          if (press.current) endPress(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      >
        <div className="rc-tilt">
          <div className="rc-flip">
            <CardFace card={card} locked={locked} />
            <CardBack />
          </div>
        </div>
        {card.price != null && !faceDown && (
          <div className="rc-price" aria-label={`Costs ${card.price} ${T.influence}`}>
            <Icon name="influence" size={12} />
            <span className="num">{card.price}</span>
          </div>
        )}
        {children}
      </div>
      {zoom && <CardZoom card={card} onClose={() => setZoom(false)} actions={zoomActions} />}
    </>
  );
}

function CardFace({ card, locked }: { card: CardModel; locked: boolean }) {
  return (
    <div className="rc-face rc-front">
      <div className="rc-inner">
        <div className="rc-art">
          {card.art && (
            <CardArt
              hue={card.art.hue}
              motif={card.art.motif}
              kind={card.artKind}
              id={card.artKind ? card.id : undefined}
              rarity={card.rarity}
              aspect="card"
              seed={card.id}
            />
          )}
          {card.kind === 'pillar' && card.icon && (
            <div className="rc-emblem"><Icon name={card.icon} size={64} /></div>
          )}
          {card.kind === 'pack' && <PackWrap />}
          <div className="rc-art-fade" />
        </div>
        <div className="rc-title display">{locked ? '???' : card.title}</div>
        <div className="rc-body">
          {!locked && card.description && <RichText className="rc-desc" text={card.description} />}
          {!locked && card.footer && <RichText className="rc-foot" text={card.footer} />}
          {!locked && card.status && <RichText className="rc-status" text={card.status} />}
        </div>
        <div className="rc-type">{locked ? 'Undiscovered' : card.typeLabel}</div>
      </div>
      <Filigree className="rc-corner rc-corner--tl" />
      <Filigree className="rc-corner rc-corner--tr" />
      <Filigree className="rc-corner rc-corner--bl" />
      <Filigree className="rc-corner rc-corner--br" />
      <Gem />
      <div className="rc-foil" />
      <div className="rc-glare" />
    </div>
  );
}

function CardBack() {
  return (
    <div className="rc-face rc-back" aria-hidden>
      <div className="rc-back-lattice" />
      <svg className="rc-back-sigil" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="rcBackGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff0b8" />
            <stop offset="0.5" stopColor="#d9ab3f" />
            <stop offset="1" stopColor="#7d5c1b" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="44" fill="none" stroke="url(#rcBackGold)" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="url(#rcBackGold)" strokeWidth="0.6" strokeDasharray="2 2.4" />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const r1 = i % 2 ? 20 : 16;
          const r2 = i % 2 ? 33 : 36;
          return (
            <line key={i} x1={50 + Math.cos(a) * r1} y1={50 + Math.sin(a) * r1} x2={50 + Math.cos(a) * r2} y2={50 + Math.sin(a) * r2}
              stroke="url(#rcBackGold)" strokeWidth={i % 2 ? 0.8 : 1.6} strokeLinecap="round" />
          );
        })}
        <path d="M50 30 L57 50 L50 70 L43 50 Z" fill="url(#rcBackGold)" />
        <path d="M30 50 L50 44 L70 50 L50 56 Z" fill="url(#rcBackGold)" opacity="0.75" />
        <circle cx="50" cy="50" r="4" fill="#0c111b" stroke="url(#rcBackGold)" strokeWidth="1" />
      </svg>
      <div className="rc-back-word display">{TITLE}</div>
    </div>
  );
}

/** gold filigree corner ornament (drawn for top-left; CSS mirrors the other three) */
function Filigree({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path d="M3 45 V14 Q3 3 14 3 H45" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 38 V16 Q8 8 16 8 H38" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.8" />
      <path d="M14 8 C20 9 22 15 17 17 C13.5 18.4 11.5 15 14 13.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 14 C9 20 15 22 17 17" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M22 8 C27 5 31 9 29 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M8 22 C5 27 9 31 12 29" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M8.5 8.5 L12 5 L15.5 8.5 L12 12 Z" fill="currentColor" transform="translate(-4.5 -4.5)" />
      <circle cx="30.5" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="30.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

function Gem() {
  return (
    <svg className="rc-gem" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 1.5 L22 9 L12 22.5 L2 9 Z" fill="var(--rc-gem)" stroke="var(--rc-metal-hi)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 9 H22 M12 1.5 L8 9 L12 22.5 L16 9 Z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <path d="M12 1.5 L8 9 H2 Z" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}

/** wax seal + ribbon wrap drawn over pack art */
function PackWrap() {
  return (
    <svg className="rc-packwrap" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <path d="M0 58 L100 38 L100 50 L0 70 Z" fill="rgba(122,24,32,0.9)" />
      <path d="M0 58 L100 38" stroke="rgba(255,210,150,0.55)" strokeWidth="0.8" />
      <path d="M0 70 L100 50" stroke="rgba(255,210,150,0.55)" strokeWidth="0.8" />
      <g transform="translate(50 54)">
        <circle r="11" fill="#8f1d26" />
        <circle r="8.2" fill="none" stroke="#e8736f" strokeWidth="0.8" opacity="0.8" />
        <path d="M0 -5 L4.5 0 L0 5 L-4.5 0 Z" fill="#e8736f" opacity="0.9" />
      </g>
    </svg>
  );
}

// ───────────────────────────── zoom modal ─────────────────────────────
export function CardZoom({ card, onClose, actions, locked = false }: { card: CardModel; onClose: () => void; actions?: ReactNode; locked?: boolean }) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const edition = card.edition ?? 'base';
  return createPortal(
    <div
      className="rc-zoom"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          sfx('close');
          onClose();
        }
      }}
    >
      <div className="rc-zoom-stage">
        <Card card={card} width="var(--rc-zoom-w)" zoomable={false} locked={locked} className="rc-zoom-card" />
        <div className="rc-zoom-info">
          {edition !== 'base' && (
            <div className={`rc-zoom-edition rc-zoom-edition--${edition}`}>
              <span className="display">{EDITION_LABEL[edition]}</span>
              <RichText text={EDITION_TEXT[edition]} />
            </div>
          )}
          {!locked && card.flavor && <p className="rc-zoom-flavor">“{card.flavor}”</p>}
          {actions && <div className="rc-zoom-actions">{actions}</div>}
          <button type="button" className="rc-zoom-close" aria-label="Close" onClick={() => { sfx('close'); onClose(); }}>
            <Icon name="close" size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
