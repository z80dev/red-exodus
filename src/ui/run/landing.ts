// "Card flies to where it now lives" after a Council purchase or pack pick: doctrine → doctrine bar slot,
// edict → edict tray, scroll → pillar chip (+ level-up pop), reform → reform counter.
import type { RunState, ShopItem, SimEvent } from '../../sim/types';
import { SCROLLS } from '../../content';
import type { FlySnapshot } from './fx';
import { bump, centerOf, floatAt, floatText, flyClone, sparkBurst } from './fx';
import { haptic, pillarInfo, sfx } from './runUtil';

export interface RunBefore { edicts: number[]; pillarLevels: Record<string, number>; reforms: number }
export function runBefore(run: RunState): RunBefore {
  return { edicts: run.edicts.map((e) => e.uid), pillarLevels: { ...run.pillarLevels }, reforms: run.reforms.length };
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
  } else if (item.kind === 'scroll') {
    const pillar = SCROLLS[item.id]?.pillar ?? Object.keys(run.pillarLevels).find((p) => run.pillarLevels[p as keyof typeof run.pillarLevels] !== before.pillarLevels[p]);
    dst = pillar ? scope.querySelector<HTMLElement>(`[data-pillar="${pillar}"]`) : null;
    if (dst && pillar) {
      const target = dst;
      const name = pillarInfo(pillar as keyof typeof run.pillarLevels).name;
      const lvl = run.pillarLevels[pillar as keyof typeof run.pillarLevels];
      if (snap) await flyClone(snap, target, { duration: 560 });
      sfx('levelUp');
      haptic([10, 30, 20]);
      bump(target, 1.4, 480);
      sparkBurst(target, 'var(--gold-300)');
      floatAt(target, `${name} Lv ${lvl}`, { tone: 'gold', size: 16, rise: -40 });
      return;
    }
  } else if (item.kind === 'reform') {
    dst = scope.querySelector<HTMLElement>('[data-reforms]');
  }
  if (!snap) return;
  if (!dst) {
    // nowhere specific: burst where the card was
    const c = centerOf(null);
    sparkBurst(null);
    floatText(c.x, c.y, 'Acquired', { tone: 'gold' });
    return;
  }
  dst.style.visibility = 'hidden';
  await flyClone(snap, dst, { duration: 600 });
  dst.style.visibility = '';
  bump(dst, 1.18, 360);
  sparkBurst(dst, item.kind === 'edict' ? 'var(--influence)' : 'var(--gold-300)', 10);
  sfx('cardDeal', { pitch: 1.2, volume: 0.7 });
}
