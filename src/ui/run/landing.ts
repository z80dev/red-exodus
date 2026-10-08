// "Card flies to where it now lives" after a Shop purchase or pack pick: Crew → Crew bar slot, Boost → Boost tray.
import type { RunState, ShopItem, SimEvent } from '../../sim/types';
import type { FlySnapshot } from './fx';
import { bump, centerOf, floatText, flyClone, sparkBurst } from './fx';
import { sfx } from './runUtil';

export interface RunBefore { edicts: number[] }
export function runBefore(run: RunState): RunBefore {
  return { edicts: run.edicts.map((e) => e.uid) };
}

/** Wait for React to commit the post-dispatch render before querying destinations. */
function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

export async function landPurchase(snap: FlySnapshot | null, item: ShopItem, before: RunBefore, run: RunState, events: SimEvent[], scope: ParentNode): Promise<void> {
  await nextFrame();
  let dst: HTMLElement | null = null;
  if (item.kind === 'doctrine') {
    const gained = events.find((e): e is Extract<SimEvent, { type: 'doctrineGained' }> => e.type === 'doctrineGained');
    const uid = gained?.uid ?? run.doctrines[run.doctrines.length - 1]?.uid;
    dst = uid != null ? scope.querySelector<HTMLElement>(`[data-doctrine-uid="${uid}"]`) : null;
  } else if (item.kind === 'edict') {
    const fresh = run.edicts.find((e) => !before.edicts.includes(e.uid));
    dst = fresh ? scope.querySelector<HTMLElement>(`[data-edict-uid="${fresh.uid}"]`) : null;
  }
  if (!snap) return;
  if (!dst) {
    // nowhere specific: burst where the card was
    const c = centerOf(null);
    sparkBurst(null);
    floatText(c.x, c.y, 'Got it', { tone: 'gold' });
    return;
  }
  dst.style.visibility = 'hidden';
  await flyClone(snap, dst, { duration: 600 });
  dst.style.visibility = '';
  bump(dst, 1.18, 360);
  sparkBurst(dst, item.kind === 'edict' ? 'var(--influence)' : 'var(--gold-300)', 10);
  sfx('cardDeal', { pitch: 1.2, volume: 0.7 });
}
