// Omens: optional chapter objectives (Against the Storm orders). Offered at chapter start, rewarded on completion.
import type { OmenDef } from '../defs';
import { addGold } from '../economy';
import { randInt } from '../rng';
import type { Emit, GameState, OmenId, SimEvent } from '../types';
import { HUMAN } from '../types';
import { OMENS } from '../../content';
import { DOCTRINE_PRICE, FINAL_ERA, OMEN_OFFERS, OMEN_RECENT_WINDOW } from './constants';
import { addEdict, applyScroll, rollDoctrine, rollEdict, rollScroll } from './council';
import { addInfluence, changeMandate, grantDoctrine } from './run';
import { markSeen } from './stats';

/** fallback influence when an item reward can't be held (slots full / pool empty) */
const OMEN_FALLBACK_INFLUENCE = 3;

export function omenGoal(state: GameState, def: OmenDef): number {
  return Math.max(1, Math.round(typeof def.goal === 'function' ? def.goal(state) : def.goal));
}

/** roll the chapter-start offers: valid for the era, avoiding recently offered omens */
export function rollOmenOffers(state: GameState): OmenId[] {
  const run = state.run;
  const era = Math.min(run.era, FINAL_ERA);
  const pool = Object.values(OMENS).filter((o) => !o.eras || o.eras.includes(era)).map((o) => o.id);
  const recent = run.seen.filter((k) => k.startsWith('omen:')).slice(-OMEN_RECENT_WINDOW).map((k) => k.slice(5));
  const fresh = pool.filter((id) => !recent.includes(id));
  const stale = pool.filter((id) => recent.includes(id));
  const offers: OmenId[] = [];
  for (const bucket of [fresh, stale]) {
    while (offers.length < OMEN_OFFERS && bucket.length) offers.push(bucket.splice(randInt(state.rng, bucket.length), 1)[0]);
  }
  for (const id of offers) markSeen(run, `omen:${id}`);
  run.omenOffer = offers;
  return offers;
}

export function progressOmen(state: GameState, ev: SimEvent, emit: Emit): void {
  const run = state.run;
  const omen = run.omen;
  if (run.phase !== 'playing' || !omen || omen.done) return;
  const def = OMENS[omen.id];
  if (!def) return;
  const inc = def.progress(ev, state, HUMAN);
  if (!(inc > 0)) return;
  const goal = omen.goal ?? omenGoal(state, def);
  omen.progress = Math.min(goal, omen.progress + inc);
  emit({ type: 'omenProgress', id: omen.id, progress: omen.progress, goal });
  if (omen.progress >= goal) {
    omen.done = true;
    run.totals.extra.omensCompleted = (run.totals.extra.omensCompleted ?? 0) + 1;
    emit({ type: 'omenCompleted', id: omen.id });
    grantOmenReward(state, def, emit);
  }
}

export function grantOmenReward(state: GameState, def: OmenDef, emit: Emit): void {
  const r = def.reward;
  const fallback = (amount: number) => addInfluence(state, amount, emit);
  switch (r.kind) {
    case 'influence':
      addInfluence(state, r.amount, emit);
      break;
    case 'gold':
      addGold(state, HUMAN, r.amount, `Directive: ${def.name}`, emit);
      break;
    case 'mandate':
      changeMandate(state, 1, `Directive: ${def.name}`, emit);
      break;
    case 'doctrine': {
      const d = rollDoctrine(state, new Set(), true, r.rarity);
      if (!d || grantDoctrine(state, d.id, 'base', emit)) fallback(DOCTRINE_PRICE[r.rarity]);
      break;
    }
    case 'scroll': {
      const id = rollScroll(state, new Set());
      if (id) applyScroll(state, id, emit);
      else fallback(OMEN_FALLBACK_INFLUENCE);
      break;
    }
    case 'edict': {
      const e = rollEdict(state, new Set(), true);
      if (!e || addEdict(state, e.id) == null) fallback(OMEN_FALLBACK_INFLUENCE);
      break;
    }
  }
  emit({ type: 'notify', text: `Directive complete: ${def.name} — ${def.rewardText}`, icon: 'omen', tone: 'good' });
}
