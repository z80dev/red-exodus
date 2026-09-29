// OWNER: SimMechanics. Blackout (internal: Dark Age): inflicted for the chapter after a failed Sol Report (DESIGN §3).
import type { EffectHooks } from '../defs';
import { YIELD_KEYS } from '../types';

export const DARK_AGE_LABEL = 'Blackout';
/** percentage applied to every yield of every human city while the Dark Age lasts */
export const DARK_AGE_YIELD_PCT = -15;

export const DARK_AGE_EFFECTS: EffectHooks = {
  cityYield(_ctx, a) {
    for (const k of YIELD_KEYS) a.pct[k] += DARK_AGE_YIELD_PCT;
  },
};
