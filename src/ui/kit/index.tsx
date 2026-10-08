// Shared UI primitives. OWNER: UI-HUD (may extend; other UI agents import, don't fork).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons/Icon';
import { T } from '../terms';
import './kit.css';

type BtnVariant = 'default' | 'gold' | 'danger' | 'ghost';
export function Button({ variant = 'default', small, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; small?: boolean }) {
  const cls = ['k-btn', variant !== 'default' ? `k-btn--${variant}` : '', small ? 'k-btn--sm' : '', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest} />;
}

export function Panel({ className = '', children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return <div className={`k-panel ${className}`} style={style}>{children}</div>;
}

/** Centered dialog over a dimmed backdrop. Portaled to <body> so ancestors' transforms/filters can't trap it. */
export function Modal({ onClose, children, className = '' }: { onClose?: () => void; children: ReactNode; className?: string }) {
  useEscape(onClose);
  return createPortal(
    <div className="k-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`k-panel k-modal ${className}`} role="dialog" aria-modal="true">{children}</div>
    </div>,
    document.body,
  );
}

/** bottom sheet on portrait/mobile, right-side drawer on landscape / desktop */
export function Sheet({ onClose, children, className = '', side = 'right' }: { onClose?: () => void; children: ReactNode; className?: string; side?: 'right' | 'left' }) {
  useEscape(onClose);
  return (
    <>
      <div className="k-sheet-scrim" onPointerDown={() => onClose?.()} />
      <div className={`k-panel k-sheet k-sheet--${side} ${className}`} role="dialog">
        <div className="k-sheet-grip" aria-hidden />
        {children}
      </div>
    </>
  );
}

/** Title row for sheets and modals: optional icon, title, subtitle, trailing actions and a close button. */
export function SheetHeader({ title, subtitle, icon, onClose, children }: { title: ReactNode; subtitle?: ReactNode; icon?: string; onClose?: () => void; children?: ReactNode }) {
  return (
    <header className="k-sheet-header">
      {icon && <span className="k-sheet-header__icon"><Icon name={icon} size={26} /></span>}
      <div className="k-sheet-header__text">
        <h2 className="k-title">{title}</h2>
        {subtitle && <div className="k-sheet-header__sub">{subtitle}</div>}
      </div>
      {children}
      {onClose && <IconButton icon="close" label="Close" onClick={onClose} size="sm" />}
    </header>
  );
}

/** Round glass icon button (≥44px hit area). */
export function IconButton({ icon, label, onClick, badge, active, variant = 'default', size = 'md', disabled, className = '', iconColor, tutorial }: {
  icon: string; label: string; onClick?: () => void; badge?: ReactNode; active?: boolean; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg';
  disabled?: boolean; className?: string; iconColor?: string; tutorial?: string;
}) {
  const cls = ['k-ibtn', `k-ibtn--${size}`, variant !== 'default' ? `k-ibtn--${variant}` : '', active ? 'is-active' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} aria-label={label} data-tip={label} onClick={onClick} disabled={disabled} data-tutorial={tutorial}>
      <Icon name={icon} size={size === 'lg' ? 28 : size === 'sm' ? 18 : 22} color={iconColor} />
      {badge != null && badge !== false && <span className="k-badge">{badge}</span>}
    </button>
  );
}

/** Selectable pill. */
export function Chip({ active, onClick, children, color, disabled, title }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className={`k-chip ${active ? 'is-active' : ''}`} onClick={onClick} disabled={disabled} data-tip={title}
      style={color ? ({ '--chip-color': color } as CSSProperties) : undefined}>
      {children}
    </button>
  );
}

/** Progress bar. `preview` draws a lighter ghost segment up to that value (e.g. next turn's progress). */
export function Bar({ value, max, color = 'var(--gold-400)', preview, height = 8, className = '', glow }: {
  value: number; max: number; color?: string; preview?: number; height?: number; className?: string; glow?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const ghost = preview != null && max > 0 ? Math.max(pct, Math.min(1, preview / max)) : pct;
  return (
    <div className={`k-bar ${glow ? 'k-bar--glow' : ''} ${className}`} style={{ height, '--bar-color': color } as CSSProperties}>
      {ghost > pct && <div className="k-bar__ghost" style={{ transform: `scaleX(${ghost})` }} />}
      <div className="k-bar__fill" style={{ transform: `scaleX(${pct})` }} />
    </div>
  );
}

export interface TabDef<T extends string> { id: T; label: string; icon?: string; badge?: ReactNode }
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: TabDef<T>[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="k-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`k-tab ${value === t.id ? 'is-active' : ''}`} onClick={() => onChange(t.id)}>
          {t.icon && <Icon name={t.icon} size={16} />}
          <span>{t.label}</span>
          {t.badge != null && <span className="k-tab__badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/** Confirmation dialog for destructive or costly actions. */
export function ConfirmDialog({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel, icon }: {
  title: string; body?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void; icon?: string;
}) {
  return (
    <Modal onClose={onCancel} className="k-confirm">
      {icon && <div className="k-confirm__icon"><Icon name={icon} size={36} /></div>}
      <h2 className="k-title k-confirm__title">{title}</h2>
      <Ornament />
      {body && <div className="k-confirm__body">{body}</div>}
      <div className="k-confirm__actions">
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'gold'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

/** Gold filigree divider. */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <svg className={`k-ornament ${className}`} viewBox="0 0 240 12" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="k-orn-g" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 6 H104 M136 6 H240" stroke="url(#k-orn-g)" strokeWidth="1" />
      <path d="M120 1 L126 6 L120 11 L114 6 Z" fill="currentColor" />
      <path d="M106 6 L112 3.5 L112 8.5 Z M134 6 L128 3.5 L128 8.5 Z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/** Lives hearts. */
export function Hearts({ value, max, size = 16, flashLost }: { value: number; max: number; size?: number; flashLost?: boolean }) {
  return (
    <span className="k-hearts" aria-label={`${T.mandate}: ${value} of ${max}`}>
      {Array.from({ length: Math.max(max, value) }, (_, i) => (
        <svg key={i} viewBox="0 0 24 22" width={size} height={size * 0.92} className={`k-heart ${i < value ? 'is-full' : 'is-empty'} ${flashLost && i === value ? 'is-lost' : ''}`}>
          <path d="M12 21 C5 15.5 1 12 1 7.2 C1 3.8 3.6 1.2 6.9 1.2 C9.1 1.2 10.9 2.4 12 4.2 C13.1 2.4 14.9 1.2 17.1 1.2 C20.4 1.2 23 3.8 23 7.2 C23 12 19 15.5 12 21 Z" />
          {i < value && <path d="M6.5 4.5 C4.6 4.8 3.6 6.4 3.8 8.2" className="k-heart__shine" />}
        </svg>
      ))}
    </span>
  );
}

/** Animated count toward `value` (ease-out). */
export function useAnimatedNumber(value: number, ms = 600): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const shownRef = useRef(value);
  useEffect(() => {
    from.current = shownRef.current;
    if (from.current === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const v = from.current + (value - from.current) * e;
      shownRef.current = t >= 1 ? value : v;
      setShown(shownRef.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Number with thin formatting (1,234 · 12.3k · 1.2M). */
export function fmt(n: number, compact = false): string {
  const r = Math.round(n);
  if (compact && Math.abs(r) >= 10000) {
    const units: [number, string][] = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
    for (const [u, s] of units) if (Math.abs(r) >= u) return `${(r / u).toFixed(Math.abs(r) >= u * 100 ? 0 : 1).replace(/\.0$/, '')}${s}`;
  }
  return r.toLocaleString('en-US');
}

/** Signed number: +3 / −2 (true minus sign). */
export function signed(n: number, digits = 0): string {
  const v = digits ? Number(n.toFixed(digits)) : Math.round(n);
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return '0';
}

/**
 * Floating panel anchored to an element (breakdown popovers). Positions below the anchor (or above when there is
 * no room), clamped to the viewport; closes on outside pointerdown / Escape.
 */
export function Popover({ anchor, onClose, children, className = '', width = 300 }: { anchor: HTMLElement | null; onClose: () => void; children: ReactNode; className?: string; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrow: number; above: boolean } | null>(null);
  useEscape(onClose);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const el = ref.current!;
      const w = Math.min(width, window.innerWidth - 16);
      const h = el.offsetHeight;
      const cx = a.left + a.width / 2;
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, cx - w / 2));
      const below = a.bottom + 10;
      const above = below + h > window.innerHeight - 8 && a.top - 10 - h > 8;
      setPos({ left, top: above ? a.top - 10 - h : below, arrow: Math.max(14, Math.min(w - 14, cx - left)), above });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, width]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  }, [anchor, onClose]);
  return createPortal(
    <div ref={ref} className={`k-panel k-popover ${pos?.above ? 'is-above' : ''} ${className}`}
      style={{ width: Math.min(width, window.innerWidth - 16), left: pos?.left ?? -9999, top: pos?.top ?? -9999, '--arrow-x': `${pos?.arrow ?? 0}px` } as CSSProperties}>
      {children}
    </div>,
    document.body,
  );
}

/** Label/value row used in breakdown lists. */
export function Line({ label, value, icon, tone, strong }: { label: ReactNode; value: ReactNode; icon?: string; tone?: 'good' | 'bad' | 'dim'; strong?: boolean }) {
  return (
    <div className={`k-line ${tone ? `k-line--${tone}` : ''} ${strong ? 'k-line--strong' : ''}`}>
      {icon && <Icon name={icon} size={16} />}
      <span className="k-line__label">{label}</span>
      <span className="k-line__value num">{value}</span>
    </div>
  );
}

// Escape closes only the top-most open layer (nested popover inside a sheet, confirm inside a modal…).
const escStack: { current: (() => void) | undefined }[] = [];
let escBound = false;
function onEscKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  for (let i = escStack.length - 1; i >= 0; i--) {
    const fn = escStack[i].current;
    if (fn) { e.preventDefault(); fn(); return; }
  }
}

/** true while any Escape-closable layer (modal, sheet, popover) is mounted */
export function hasEscapeLayer(): boolean {
  return escStack.some((e) => e.current);
}

/** Register `fn` as the Escape handler while mounted (top-most registration wins). */
export function useEscape(fn: (() => void) | undefined) {
  const cb = useRef(fn);
  useLayoutEffect(() => { cb.current = fn; });
  useEffect(() => {
    if (!escBound) { window.addEventListener('keydown', onEscKey); escBound = true; }
    const entry = cb;
    escStack.push(entry);
    return () => { const i = escStack.indexOf(entry); if (i >= 0) escStack.splice(i, 1); };
  }, []);
}
