// OWNER: SimMechanics. Second Chance (internal: Dark Age): granted for the chapter after a failed Chapter Report (DESIGN §3).
// A miss already costs Lives; the Second Chance is the comeback lever that stops one bad chapter from snowballing.
import type { EffectHooks } from '../defs';

export const DARK_AGE_LABEL = 'Second Chance';
/** Score target multiplier for the chapter after a miss */
export const DARK_AGE_TARGET_MUL = 0.75;

export const DARK_AGE_EFFECTS: EffectHooks = {
  target(_ctx, a) {
    a.value *= DARK_AGE_TARGET_MUL;
  },
};
