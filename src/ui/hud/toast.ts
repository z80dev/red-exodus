// Toast notifications (z 80). Any UI module may call `toast(text, tone, icon?)`; GameScreen renders them.
import { create } from 'zustand';

export type ToastTone = 'good' | 'bad' | 'info' | 'gold';

export interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
  icon?: string;
  /** identical consecutive toasts collapse into one with a ×N counter */
  count: number;
  /** toasts sharing a key replace each other (e.g. one growth toast per city) */
  key?: string;
  /** ms timestamp when the toast should start leaving */
  expires: number;
  leaving: boolean;
}

interface ToastStore {
  items: ToastItem[];
  push(text: string, tone: ToastTone, icon?: string, key?: string): void;
  dismiss(id: number): void;
}

const MAX_VISIBLE = 3;
const LEAVE_MS = 260;
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function lifetime(text: string, tone: ToastTone): number {
  // longer messages and bad news linger a little longer
  return Math.min(6500, 2600 + text.length * 28 + (tone === 'bad' ? 900 : 0));
}

export const useToasts = create<ToastStore>((set, get) => ({
  items: [],
  push(text, tone, icon, key) {
    const now = Date.now();
    const items = get().items;
    const keyed = key != null ? items.find((t) => !t.leaving && t.key === key) : undefined;
    if (keyed) {
      const expires = now + lifetime(text, tone);
      schedule(keyed.id, expires - now);
      set({ items: items.map((t) => (t === keyed ? { ...t, text, tone, icon, expires } : t)) });
      return;
    }
    const same = items.find((t) => !t.leaving && t.text === text && t.tone === tone);
    if (same) {
      const expires = now + lifetime(text, tone);
      schedule(same.id, expires - now);
      set({ items: items.map((t) => (t === same ? { ...t, count: t.count + 1, expires } : t)) });
      return;
    }
    const id = nextId++;
    const expires = now + lifetime(text, tone);
    const live = items.filter((t) => !t.leaving);
    // retire the oldest when over capacity
    const overflow = live.length + 1 - MAX_VISIBLE;
    const retire = new Set(live.slice(0, Math.max(0, overflow)).map((t) => t.id));
    for (const rid of retire) schedule(rid, 0);
    set({ items: [...items, { id, text, tone, icon, key, count: 1, expires, leaving: false }] });
    schedule(id, expires - now);
  },
  dismiss(id) {
    const t = get().items.find((x) => x.id === id);
    if (!t || t.leaving) return;
    set({ items: get().items.map((x) => (x.id === id ? { ...x, leaving: true } : x)) });
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        set({ items: get().items.filter((x) => x.id !== id) });
      }, LEAVE_MS),
    );
  },
}));

function schedule(id: number, ms: number) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => useToasts.getState().dismiss(id), Math.max(0, ms)));
}

/**
 * Show a toast. `icon` is an Icon name (docs/ARCHITECTURE.md §Icons). Toasts with the same `key` replace each other
 * instead of stacking (identical texts always collapse into a ×N counter).
 */
export function toast(text: string, tone: ToastTone = 'info', icon?: string, key?: string): void {
  useToasts.getState().push(text, tone, icon, key);
}
