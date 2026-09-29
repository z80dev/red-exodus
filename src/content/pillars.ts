// OWNER: Roguelite. The six Chronicle pillars (Balatro hand types). DESIGN §4.
import type { PillarDef } from '../sim/defs';
import type { ChapterStats, PillarId } from '../sim/types';

interface RenownRate { label: string; perUnit: number; stat: (s: ChapterStats) => number }

/** renown-per-unit multiplier from pillar level (L1 ×1, L2 ×1.5, L3 ×2 …) */
export function pillarLevelFactor(level: number): number {
  return 1 + 0.5 * (Math.max(1, level) - 1);
}

/** splendor when the pillar is the chapter focus (L1 = 2, +1 per level) */
export function pillarSplendor(level: number): number {
  return 1 + Math.max(1, level);
}

function makePillar(id: PillarId, name: string, description: string, rates: RenownRate[]): PillarDef {
  return {
    id,
    name,
    color: `var(--p-${id})`,
    icon: id,
    description,
    renown(stats, level) {
      const f = pillarLevelFactor(level);
      return rates.map((r) => ({ label: r.label, amount: Math.round(r.stat(stats) * r.perUnit * f) }));
    },
    splendor: pillarSplendor,
  };
}

/** base per-unit renown at level 1; exported for tooltips/codex */
export const PILLAR_RATES: Record<PillarId, RenownRate[]> = {
  arts: [
    { label: 'Morale archives', perUnit: 1, stat: (s) => s.culture },
    { label: 'Shared celebrations', perUnit: 1, stat: (s) => s.extra.festival ?? 0 },
  ],
  discovery: [
    { label: 'Research data', perUnit: 0.6, stat: (s) => s.science },
    { label: 'Breakthroughs', perUnit: 30, stat: (s) => s.techs },
  ],
  commerce: [
    { label: 'Credits earned', perUnit: 0.6, stat: (s) => s.gold },
    { label: 'Cargo routes', perUnit: 40, stat: (s) => s.extra.tradeRoutes ?? 0 },
  ],
  conquest: [
    { label: 'Hostiles neutralized', perUnit: 25, stat: (s) => s.kills },
    { label: 'Colonies captured', perUnit: 150, stat: (s) => s.citiesCaptured },
    { label: 'Feral dens cleared', perUnit: 60, stat: (s) => s.campsCleared },
  ],
  prosperity: [
    { label: 'Colonists thawed', perUnit: 15, stat: (s) => s.popGrown },
    { label: 'Orbital Drops', perUnit: 80, stat: (s) => s.citiesFounded },
    { label: 'Installations built', perUnit: 10, stat: (s) => s.improvements },
  ],
  glory: [
    { label: 'Habitat modules built', perUnit: 20, stat: (s) => s.buildings },
    { label: 'Megaprojects completed', perUnit: 200, stat: (s) => s.wonders },
    { label: 'Landmarks surveyed', perUnit: 50, stat: (s) => s.naturalWonders },
  ],
};

export const PILLAR_DEFS: Record<PillarId, PillarDef> = {
  arts: makePillar('arts', 'Heritage', '{renown} from {cul} morale preserved and celebrations held.', PILLAR_RATES.arts),
  discovery: makePillar('discovery', 'Science', '{renown} from {sci} research data and Breakthroughs.', PILLAR_RATES.discovery),
  commerce: makePillar('commerce', 'Trade', '{renown} from {gold} Credits earned and cargo routes.', PILLAR_RATES.commerce),
  conquest: makePillar('conquest', 'Warfare', '{renown} from hostiles neutralized, colonies captured and Feral Dens cleared.', PILLAR_RATES.conquest),
  prosperity: makePillar('prosperity', 'Growth', '{renown} from {food} colonists, Orbital Drops and installations.', PILLAR_RATES.prosperity),
  glory: makePillar('glory', 'Monuments', '{renown} from habitat modules, Megaprojects and surveyed Landmarks.', PILLAR_RATES.glory),
};
