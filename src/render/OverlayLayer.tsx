// World-anchored DOM layer: Civ-style city banners, unit flags, damage numbers / glyph pops.
// Positions are written by the renderer each frame (transform on the `.ae-anchor` wrappers).
import { type CSSProperties, memo, useSyncExternalStore } from 'react';
import { Icon } from '../ui/icons/Icon';
import type { BannerData, FlagData, OverlayStore, PopData } from './overlayStore';
import './overlay.css';

function Ring({ progress }: { progress: number }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ae-ring" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r={r} className="ae-ring__track" />
      <circle cx="16" cy="16" r={r} className="ae-ring__fill" strokeDasharray={`${c * Math.max(0, Math.min(1, progress))} ${c}`} />
    </svg>
  );
}

const Banner = memo(function Banner({ b, store }: { b: BannerData; store: OverlayStore }) {
  const hurt = b.hp < b.maxHp;
  return (
    <div className="ae-anchor ae-anchor--banner" ref={(el) => store.register(`c${b.id}`, el)}>
      <button
        type="button"
        className={`ae-banner${b.human ? ' ae-banner--human' : ''}${b.ghost ? ' ae-banner--ghost' : ''}`}
        style={{ '--pc': b.primary, '--sc': b.secondary } as CSSProperties}
        onClick={() => store.onTap?.(b.tile)}
      >
        <span className="ae-banner__pop">{b.pop}</span>
        <span className="ae-banner__name">
          {b.capital && <Icon name="star" size={12} className="ae-banner__star" />}
          {b.name}
        </span>
        {b.human && (
          <span className="ae-banner__prod">
            <Ring progress={b.progress} />
            {b.prodIcon ? <Icon name={b.prodIcon} size={15} /> : <Icon name="hourglass" size={13} />}
            {b.turns !== null && <span className="ae-banner__turns">{b.turns}</span>}
          </span>
        )}
        {hurt && (
          <span className="ae-banner__hp">
            <i style={{ width: `${Math.max(0, (b.hp / b.maxHp) * 100)}%` }} />
          </span>
        )}
      </button>
    </div>
  );
});

const Flag = memo(function Flag({ f, store }: { f: FlagData; store: OverlayStore }) {
  const hpCls = f.hp > 60 ? 'ok' : f.hp > 30 ? 'mid' : 'low';
  return (
    <div className="ae-anchor ae-anchor--flag" ref={(el) => store.register(`u${f.id}`, el)}>
      <button
        type="button"
        className={`ae-flag${f.human ? ' ae-flag--human' : ''}`}
        style={{ '--pc': f.primary, '--sc': f.secondary } as CSSProperties}
        onClick={() => store.onTap?.(f.tile)}
      >
        <span className="ae-flag__shield">
          <Icon name={f.icon} size={14} color={f.secondary} />
          {f.fortified && <span className="ae-flag__fort"><Icon name="shield" size={8} /></span>}
        </span>
        {f.hp < 100 && (
          <span className="ae-flag__hp">
            <i className={`ae-flag__hp--${hpCls}`} style={{ width: `${Math.max(4, f.hp)}%` }} />
          </span>
        )}
        {f.promo && <span className="ae-flag__promo" />}
      </button>
    </div>
  );
});

function Pop({ p, store }: { p: PopData; store: OverlayStore }) {
  return (
    <div className="ae-anchor ae-anchor--pop" ref={(el) => store.register(`p${p.id}`, el)}>
      <div className={`ae-pop ae-pop--${p.kind}`} style={{ '--c': p.color, animationDuration: `${p.life}s` } as CSSProperties}>
        {p.icon && <Icon name={p.icon} size={p.kind === 'glyph' ? 30 : 16} />}
        {p.text && <span>{p.text}</span>}
      </div>
    </div>
  );
}

export function Overlay({ store }: { store: OverlayStore }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <div className="ae-overlay">
      {snap.flags.map((f) => (
        <Flag key={`u${f.id}`} f={f} store={store} />
      ))}
      {snap.banners.map((b) => (
        <Banner key={`c${b.id}`} b={b} store={store} />
      ))}
      {snap.markers.map((m) => (
        <div key={`m${m.id}`} className="ae-anchor ae-anchor--marker" ref={(el) => store.register(`m${m.id}`, el)}>
          <span className="ae-marker">{m.text}</span>
        </div>
      ))}
      {snap.pops.map((p) => (
        <Pop key={`p${p.id}`} p={p} store={store} />
      ))}
    </div>
  );
}
