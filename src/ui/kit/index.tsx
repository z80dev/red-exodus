// Shared UI primitives. OWNER: UI-HUD (may extend; other UI agents import, don't fork).
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './kit.css';

type BtnVariant = 'default' | 'gold' | 'danger' | 'ghost';
export function Button({ variant = 'default', small, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; small?: boolean }) {
  const cls = ['k-btn', variant !== 'default' ? `k-btn--${variant}` : '', small ? 'k-btn--sm' : '', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest} />;
}

export function Panel({ className = '', children, style }: { className?: string; children: ReactNode; style?: React.CSSProperties }) {
  return <div className={`k-panel ${className}`} style={style}>{children}</div>;
}

export function Modal({ onClose, children, className = '' }: { onClose?: () => void; children: ReactNode; className?: string }) {
  return (
    <div className="k-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`k-panel k-modal ${className}`}>{children}</div>
    </div>
  );
}

/** bottom sheet on portrait/mobile, right-side drawer on wide landscape */
export function Sheet({ onClose, children, className = '' }: { onClose?: () => void; children: ReactNode; className?: string }) {
  return (
    <>
      <div className="k-backdrop" style={{ background: 'transparent', backdropFilter: 'none' }} onPointerDown={() => onClose?.()} />
      <div className={`k-panel k-sheet ${className}`}>{children}</div>
    </>
  );
}
