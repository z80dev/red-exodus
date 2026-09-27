// OWNER: ContentCiv. Map resources.
// Placement (mapgen): `terrains` must match; `features` listed → tile feature must be one of them, undefined →
// clean ground (no feature, or floodplains); `elevations` undefined → flat or hills (never mountains).
// Strategic resources stay hidden (no yields, no model) until the owner knows `revealTech`.
// Luxuries grant `happiness` once per type when connected (improved), regardless of copies.
import type { ResourceDef } from '../sim/defs';
import type { Yields } from '../sim/types';

const y = (food = 0, prod = 0, gold = 0, sci = 0, cul = 0): Yields => ({ food, prod, gold, sci, cul });

const LUX_HAPPY = 4;

type ResSpec = Omit<ResourceDef, 'icon' | 'model'>;

function res(spec: ResSpec): ResourceDef {
  return { ...spec, icon: spec.id, model: `res_${spec.id}` };
}

const LIST: ResourceDef[] = [
  // ───────── bonus ─────────
  res({ id: 'wheat', name: 'Wheat', kind: 'bonus', yields: y(1), improvement: 'farm', improvedYields: y(1), terrains: ['plains', 'grassland'], weight: 10 }),
  res({ id: 'rice', name: 'Rice', kind: 'bonus', yields: y(1), improvement: 'farm', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['marsh', 'floodplains'], weight: 7 }),
  res({ id: 'cattle', name: 'Cattle', kind: 'bonus', yields: y(1), improvement: 'pasture', improvedYields: y(1), terrains: ['grassland'], weight: 9 }),
  res({ id: 'sheep', name: 'Sheep', kind: 'bonus', yields: y(1), improvement: 'pasture', improvedYields: y(0, 0, 1), terrains: ['grassland', 'plains', 'tundra'], elevations: ['hills'], weight: 8 }),
  res({ id: 'deer', name: 'Deer', kind: 'bonus', yields: y(1), improvement: 'camp', improvedYields: y(1), terrains: ['tundra', 'plains', 'grassland'], features: ['forest'], weight: 8 }),
  res({ id: 'fish', name: 'Fish', kind: 'bonus', yields: y(2), improvement: 'fishing_boats', improvedYields: y(1), terrains: ['coast', 'lake'], weight: 10 }),
  res({ id: 'stone', name: 'Stone', kind: 'bonus', yields: y(0, 1), improvement: 'quarry', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'desert', 'tundra'], weight: 6 }),
  res({ id: 'bananas', name: 'Bananas', kind: 'bonus', yields: y(1), improvement: 'plantation', improvedYields: y(1), terrains: ['grassland', 'plains'], features: ['jungle'], weight: 6 }),

  // ───────── luxury ─────────
  res({ id: 'gold', name: 'Gold Ore', kind: 'luxury', yields: y(0, 0, 2), improvement: 'mine', improvedYields: y(0, 0, 2), terrains: ['desert', 'plains', 'grassland', 'tundra'], elevations: ['hills'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'gems', name: 'Gems', kind: 'luxury', yields: y(0, 0, 2, 1), improvement: 'mine', improvedYields: y(0, 0, 1, 1), terrains: ['grassland', 'plains', 'desert', 'tundra'], elevations: ['hills'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'silk', name: 'Silk', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['grassland', 'plains'], features: ['forest'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'spices', name: 'Spices', kind: 'luxury', yields: y(1, 0, 1), improvement: 'plantation', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['jungle'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'wine', name: 'Wine', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['plains', 'grassland'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'incense', name: 'Incense', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 0, 0, 2), terrains: ['desert', 'plains'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'furs', name: 'Furs', kind: 'luxury', yields: y(0, 0, 2), improvement: 'camp', improvedYields: y(0, 0, 1, 0, 1), terrains: ['tundra', 'snow'], features: ['forest'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'pearls', name: 'Pearls', kind: 'luxury', yields: y(0, 0, 2), improvement: 'fishing_boats', improvedYields: y(0, 0, 1, 1), terrains: ['coast'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'marble', name: 'Marble', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'quarry', improvedYields: y(0, 1, 0, 0, 1), terrains: ['grassland', 'plains', 'desert', 'tundra'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'ivory', name: 'Ivory', kind: 'luxury', yields: y(0, 0, 2), improvement: 'camp', improvedYields: y(0, 1, 1), terrains: ['plains', 'grassland'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'dyes', name: 'Dyes', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['grassland', 'plains'], features: ['jungle', 'forest'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'cotton', name: 'Cotton', kind: 'luxury', yields: y(0, 0, 2), improvement: 'plantation', improvedYields: y(0, 1, 1), terrains: ['grassland', 'plains', 'desert'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'sugar', name: 'Sugar', kind: 'luxury', yields: y(1, 0, 1), improvement: 'plantation', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['marsh', 'floodplains'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'whales', name: 'Whales', kind: 'luxury', yields: y(1, 1, 1), improvement: 'fishing_boats', improvedYields: y(0, 1, 1), terrains: ['coast', 'ocean'], weight: 3, happiness: LUX_HAPPY }),

  // ───────── strategic ─────────
  res({ id: 'horses', name: 'Horses', kind: 'strategic', yields: y(0, 1), improvement: 'pasture', improvedYields: y(0, 1), terrains: ['grassland', 'plains', 'tundra'], weight: 5, revealTech: 'animal_husbandry' }),
  res({ id: 'iron', name: 'Iron', kind: 'strategic', yields: y(0, 1), improvement: 'mine', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'desert', 'tundra', 'snow'], weight: 5, revealTech: 'bronze_working' }),
  res({ id: 'niter', name: 'Niter', kind: 'strategic', yields: y(0, 1), improvement: 'mine', improvedYields: y(0, 1), terrains: ['desert', 'plains', 'grassland', 'tundra'], weight: 4, revealTech: 'machinery' }),
  res({ id: 'coal', name: 'Coal', kind: 'strategic', yields: y(0, 2), improvement: 'mine', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'tundra'], weight: 4, revealTech: 'industrialization' }),
  res({ id: 'oil', name: 'Oil', kind: 'strategic', yields: y(0, 1), improvement: 'oil_well', improvedYields: y(0, 2), terrains: ['desert', 'tundra', 'snow', 'plains'], weight: 4, revealTech: 'combustion' }),
];

export const RESOURCES: Record<string, ResourceDef> = Object.fromEntries(LIST.map((r) => [r.id, r]));

/** Flavor lines for tile-info / codex. */
export const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  wheat: 'Golden grain, the first gift of settled life.',
  rice: 'Paddy fields that feed multitudes.',
  cattle: 'Herds that plough fields and fill larders.',
  sheep: 'Hardy hill flocks: wool for trade, milk for the table.',
  deer: 'Forest game for hunters and their hungry towns.',
  fish: 'Shoals that turn a fishing hamlet into a port city.',
  stone: 'Good building stone — the bones of monuments.',
  bananas: 'Wild jungle fruit, abundant and sweet.',
  gold: 'Glittering veins that fund kings and wars alike.',
  gems: 'Rare stones prized by jewelers and astronomers.',
  silk: 'Shimmering cloth spun in the shade of mulberry groves.',
  spices: 'Pepper and cinnamon worth their weight in coin.',
  wine: 'Sun-warmed vineyards that make every feast a festival.',
  incense: 'Fragrant resins burned in every temple.',
  furs: 'Pelts of the far north, coveted by courts in the south.',
  pearls: 'Treasures of the shallows, diver by diver.',
  marble: 'Luminous stone for statues and grand facades.',
  ivory: 'Carved into thrones, combs and chess pieces.',
  dyes: 'Purples and crimsons fit for emperors.',
  cotton: 'Soft fiber that clothes nations and fuels mills.',
  sugar: 'Sweetness that reshaped the world economy.',
  whales: 'Leviathans of the deep: oil, bone and legend.',
  horses: 'Swift steeds. Required for mounted units. Revealed by **Animal Husbandry**.',
  iron: 'Hard metal for blades and armor. Revealed by **Bronze Working**.',
  niter: 'Saltpeter for black powder. Revealed by **Machinery**.',
  coal: 'Black fuel of the industrial age. Revealed by **Industrialization**.',
  oil: 'Liquid power for engines of war. Revealed by **Combustion**.',
};
