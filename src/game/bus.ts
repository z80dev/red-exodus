// Tiny typed pub/sub. Sim events are published here after every successful dispatch (in causal order),
// so renderer (animations), audio, and UI (toasts, floaters) react without coupling to each other.
import type { SimEvent } from '../sim/types';

type Handler = (ev: SimEvent) => void;
const handlers = new Set<Handler>();
const batchHandlers = new Set<(evs: SimEvent[]) => void>();

export const bus = {
  /** called per event */
  on(fn: Handler): () => void {
    handlers.add(fn);
    return () => handlers.delete(fn);
  },
  /** called once per dispatch with the whole event batch (renderer uses this to sequence animations) */
  onBatch(fn: (evs: SimEvent[]) => void): () => void {
    batchHandlers.add(fn);
    return () => batchHandlers.delete(fn);
  },
  publish(evs: SimEvent[]): void {
    if (evs.length === 0) return;
    for (const fn of batchHandlers) fn(evs);
    for (const ev of evs) for (const fn of handlers) fn(ev);
  },
};
