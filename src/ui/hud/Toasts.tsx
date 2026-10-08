// Toast stack (z 80). Tap to dismiss. Hidden while a run ceremony (report, shop, chapter start) is open: turn news
// would cover the report and spoil its result; it is still in the Log.
import { useSim } from '../../game/store';
import { Icon } from '../icons/Icon';
import { useToasts } from './toast';
import type { ToastTone } from './toast';

const DEFAULT_ICON: Record<ToastTone, string> = { good: 'check', bad: 'crisis', info: 'info', gold: 'star' };

export function Toasts() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  const playing = useSim((s) => s.run.phase === 'playing');
  if (!playing) return null;
  return (
    <div className="ts" aria-live="polite">
      {items.map((t) => (
        <button key={t.id} type="button" className={`ts__item is-${t.tone} ${t.leaving ? 'is-leaving' : ''}`} onClick={() => dismiss(t.id)}>
          <span className="ts__icon"><Icon name={t.icon ?? DEFAULT_ICON[t.tone]} size={20} /></span>
          <span className="ts__text">{t.text}</span>
          {t.count > 1 && <span className="ts__count num">×{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
