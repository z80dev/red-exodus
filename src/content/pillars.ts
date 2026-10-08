// OWNER: Roguelite. The six Focus pillars (Balatro hand types). DESIGN §4.
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

/**
 * base per-unit renown at level 1; exported for tooltips/codex. Every pillar has a line that grows with the colony
 * (a yield, Food for growth, Production spent or the army you keep) so each Focus keeps pace across the eras, plus
 * count lines for the big moments. Tuned with `bun scripts/sim.ts --focus <pillar>` (each forced Focus within ~±15%).
 */
export const PILLAR_RATES: Record<PillarId, RenownRate[]> = {
  arts: [
    { label: 'Culture made', perUnit: 1, stat: (s) => s.culture },
    { label: 'Festivals', perUnit: 1, stat: (s) => s.extra.festival ?? 0 },
  ],
  discovery: [
    { label: 'Science made', perUnit: 0.6, stat: (s) => s.science },
    { label: 'Research done', perUnit: 15, stat: (s) => s.techs },
  ],
  commerce: [
    { label: 'Credits earned', perUnit: 0.7, stat: (s) => s.gold },
  ],
  conquest: [
    { label: 'Production on units', perUnit: 1.5, stat: (s) => s.extra.unitProd ?? 0 },
    { label: 'Army each turn', perUnit: 0.06, stat: (s) => s.extra.army ?? 0 },
    { label: 'Enemies defeated', perUnit: 40, stat: (s) => s.kills },
    { label: 'Raider Camps cleared', perUnit: 100, stat: (s) => s.campsCleared },
  ],
  prosperity: [
    { label: 'Food for growth', perUnit: 0.8, stat: (s) => s.extra.food ?? 0 },
    { label: 'Colonists grown', perUnit: 10, stat: (s) => s.popGrown },
    { label: 'Colonies founded', perUnit: 10, stat: (s) => s.citiesFounded },
    { label: 'Improvements built', perUnit: 10, stat: (s) => s.improvements },
  ],
  glory: [
    { label: 'Production on buildings', perUnit: 0.8, stat: (s) => s.extra.buildProd ?? 0 },
    { label: 'Wonders built', perUnit: 150, stat: (s) => s.wonders },
    { label: 'Landmarks found', perUnit: 40, stat: (s) => s.naturalWonders },
  ],
};

export const PILLAR_DEFS: Record<PillarId, PillarDef> = {
  arts: makePillar('arts', 'Culture', '{renown} from {cul} and Festivals made this chapter.', PILLAR_RATES.arts),
  discovery: makePillar('discovery', 'Science', '{renown} from {sci} made and Research finished this chapter.', PILLAR_RATES.discovery),
  commerce: makePillar('commerce', 'Trade', '{renown} from {gold} earned this chapter.', PILLAR_RATES.commerce),
  conquest: makePillar('conquest', 'Military', '{renown} from {prod} spent on units, the units you keep each turn, enemies defeated and Raider Camps cleared this chapter.', PILLAR_RATES.conquest),
  prosperity: makePillar('prosperity', 'Growth', '{renown} from {food} for growth, new colonists, new Colonies and Improvements this chapter.', PILLAR_RATES.prosperity),
  glory: makePillar('glory', 'Wonders', '{renown} from {prod} spent on buildings and Wonders, and from Landmarks found this chapter.', PILLAR_RATES.glory),
};
