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
    { label: 'Culture', perUnit: 1, stat: (s) => s.culture },
    { label: 'Festivals', perUnit: 1, stat: (s) => s.extra.festival ?? 0 },
  ],
  discovery: [
    { label: 'Science', perUnit: 0.6, stat: (s) => s.science },
    { label: 'Techs discovered', perUnit: 30, stat: (s) => s.techs },
  ],
  commerce: [
    { label: 'Gold earned', perUnit: 0.6, stat: (s) => s.gold },
    { label: 'Trade routes', perUnit: 40, stat: (s) => s.extra.tradeRoutes ?? 0 },
  ],
  conquest: [
    { label: 'Enemies slain', perUnit: 25, stat: (s) => s.kills },
    { label: 'Cities captured', perUnit: 150, stat: (s) => s.citiesCaptured },
    { label: 'Camps cleared', perUnit: 60, stat: (s) => s.campsCleared },
  ],
  prosperity: [
    { label: 'Population grown', perUnit: 15, stat: (s) => s.popGrown },
    { label: 'Cities founded', perUnit: 80, stat: (s) => s.citiesFounded },
    { label: 'Improvements built', perUnit: 10, stat: (s) => s.improvements },
  ],
  glory: [
    { label: 'Buildings raised', perUnit: 20, stat: (s) => s.buildings },
    { label: 'Wonders built', perUnit: 200, stat: (s) => s.wonders },
    { label: 'Natural wonders found', perUnit: 50, stat: (s) => s.naturalWonders },
  ],
};

export const PILLAR_DEFS: Record<PillarId, PillarDef> = {
  arts: makePillar('arts', 'Arts', '{renown} from {cul} culture generated and festivals held.', PILLAR_RATES.arts),
  discovery: makePillar('discovery', 'Discovery', '{renown} from {sci} science generated and techs discovered.', PILLAR_RATES.discovery),
  commerce: makePillar('commerce', 'Commerce', '{renown} from {gold} gold earned and trade routes.', PILLAR_RATES.commerce),
  conquest: makePillar('conquest', 'Conquest', '{renown} from enemies slain, cities captured and barbarian camps cleared.', PILLAR_RATES.conquest),
  prosperity: makePillar('prosperity', 'Prosperity', '{renown} from {food} population growth, new cities and improvements.', PILLAR_RATES.prosperity),
  glory: makePillar('glory', 'Glory', '{renown} from buildings, wonders and natural wonders discovered.', PILLAR_RATES.glory),
};
