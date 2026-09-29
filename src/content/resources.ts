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
  res({ id: 'wheat', name: 'Nitrate Salts', kind: 'bonus', yields: y(1), improvement: 'farm', improvedYields: y(1), terrains: ['plains', 'grassland'], weight: 10 }),
  res({ id: 'rice', name: 'Brine Algae', kind: 'bonus', yields: y(1), improvement: 'farm', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['marsh', 'floodplains'], weight: 7 }),
  res({ id: 'cattle', name: 'Lichen Beds', kind: 'bonus', yields: y(1), improvement: 'pasture', improvedYields: y(1), terrains: ['grassland'], weight: 9 }),
  res({ id: 'sheep', name: 'Methane Seep', kind: 'bonus', yields: y(1), improvement: 'pasture', improvedYields: y(0, 0, 1), terrains: ['grassland', 'plains', 'tundra'], elevations: ['hills'], weight: 8 }),
  res({ id: 'deer', name: 'Crater Ice', kind: 'bonus', yields: y(1), improvement: 'camp', improvedYields: y(1), terrains: ['tundra', 'plains', 'grassland'], features: ['forest'], weight: 8 }),
  res({ id: 'fish', name: 'Regolith Silt', kind: 'bonus', yields: y(2), improvement: 'fishing_boats', improvedYields: y(1), terrains: ['coast', 'lake'], weight: 10 }),
  res({ id: 'stone', name: 'Basalt', kind: 'bonus', yields: y(0, 1), improvement: 'quarry', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'desert', 'tundra'], weight: 6 }),
  res({ id: 'bananas', name: 'Glowcap Fungus', kind: 'bonus', yields: y(1), improvement: 'plantation', improvedYields: y(1), terrains: ['grassland', 'plains'], features: ['jungle'], weight: 6 }),

  // ───────── luxury ─────────
  res({ id: 'gold', name: 'Platinum Nuggets', kind: 'luxury', yields: y(0, 0, 2), improvement: 'mine', improvedYields: y(0, 0, 2), terrains: ['desert', 'plains', 'grassland', 'tundra'], elevations: ['hills'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'gems', name: 'Martian Opal', kind: 'luxury', yields: y(0, 0, 2, 1), improvement: 'mine', improvedYields: y(0, 0, 1, 1), terrains: ['grassland', 'plains', 'desert', 'tundra'], elevations: ['hills'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'silk', name: 'Spider-Silk Culture', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['grassland', 'plains'], features: ['forest'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'spices', name: 'Saffron Seedstock', kind: 'luxury', yields: y(1, 0, 1), improvement: 'plantation', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['jungle'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'wine', name: 'Last Vintage', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['plains', 'grassland'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'incense', name: 'Earth Soil', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 0, 0, 2), terrains: ['desert', 'plains'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'furs', name: 'Aerogel', kind: 'luxury', yields: y(0, 0, 2), improvement: 'camp', improvedYields: y(0, 0, 1, 0, 1), terrains: ['tundra', 'snow'], features: ['forest'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'pearls', name: 'Hematite Blueberries', kind: 'luxury', yields: y(0, 0, 2), improvement: 'fishing_boats', improvedYields: y(0, 0, 1, 1), terrains: ['coast'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'marble', name: 'Martian Jade', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'quarry', improvedYields: y(0, 1, 0, 0, 1), terrains: ['grassland', 'plains', 'desert', 'tundra'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'ivory', name: 'Meteorite Iron', kind: 'luxury', yields: y(0, 0, 2), improvement: 'camp', improvedYields: y(0, 1, 1), terrains: ['plains', 'grassland'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'dyes', name: 'Jarosite Pigment', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['grassland', 'plains'], features: ['jungle', 'forest'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'cotton', name: 'Bio-Cotton', kind: 'luxury', yields: y(0, 0, 2), improvement: 'plantation', improvedYields: y(0, 1, 1), terrains: ['grassland', 'plains', 'desert'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'sugar', name: 'Coffee Clones', kind: 'luxury', yields: y(1, 0, 1), improvement: 'plantation', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['marsh', 'floodplains'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'whales', name: 'Orbital Debris', kind: 'luxury', yields: y(1, 1, 1), improvement: 'fishing_boats', improvedYields: y(0, 1, 1), terrains: ['coast', 'ocean'], weight: 3, happiness: LUX_HAPPY }),

  // ───────── strategic ─────────
  res({ id: 'horses', name: 'Methane', kind: 'strategic', yields: y(0, 1), improvement: 'pasture', improvedYields: y(0, 1), terrains: ['grassland', 'plains', 'tundra'], weight: 5, revealTech: 'animal_husbandry' }),
  res({ id: 'iron', name: 'Nickel-Iron', kind: 'strategic', yields: y(0, 1), improvement: 'mine', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'desert', 'tundra', 'snow'], weight: 5, revealTech: 'bronze_working' }),
  res({ id: 'niter', name: 'Perchlorates', kind: 'strategic', yields: y(0, 1), improvement: 'mine', improvedYields: y(0, 1), terrains: ['desert', 'plains', 'grassland', 'tundra'], weight: 4, revealTech: 'machinery' }),
  res({ id: 'coal', name: 'Thorium', kind: 'strategic', yields: y(0, 2), improvement: 'mine', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'tundra'], weight: 4, revealTech: 'industrialization' }),
  res({ id: 'oil', name: 'Deuterium', kind: 'strategic', yields: y(0, 1), improvement: 'oil_well', improvedYields: y(0, 2), terrains: ['desert', 'tundra', 'snow', 'plains'], weight: 4, revealTech: 'combustion' }),
];

export const RESOURCES: Record<string, ResourceDef> = Object.fromEntries(LIST.map((r) => [r.id, r]));

/** Flavor lines for tile-info / codex. */
export const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  wheat: 'Crystalline nitrogen salts: fertilizer for the greenhouse, assuming the filters hold.',
  rice: 'Teal-green algae mats cultivated in shallow brine.',
  cattle: 'Engineered lichen beds cling to rock and turn sunlight into something edible.',
  sheep: 'Methane seeps vent through frost rings; useful fuel, spectacularly bad air.',
  deer: 'Blue-white ice lenses hidden in small craters.',
  fish: 'Fine mineral silt swirls through the Dust Shallows. Nobody has caught a fish yet.',
  stone: 'Dark basalt columns: the load-bearing bones of a colony.',
  bananas: 'Bioluminescent Glowcap Fungus from lava-tube farms.',
  gold: 'Bright platinum nuggets. The old currency survived the planet.',
  gems: 'Iridescent Martian opal, mostly useful for making people stop arguing.',
  silk: 'Spider-silk cultures grown in glossy sealed tanks.',
  spices: 'Saffron seedstock in sealed canisters; luxury measured by the gram.',
  wine: 'The Last Vintage: sealed bottles nobody is allowed to open on duty.',
  incense: 'Sacks of dark Earth soil. A little homesickness, carefully rationed.',
  furs: 'Translucent aerogel blocks, warmer than any animal and much less demanding.',
  pearls: 'Dark hematite spherules, clustered like blueberries from a very hostile garden.',
  marble: 'Green serpentine boulders polished into Martian jade.',
  ivory: 'Pitted iron-nickel meteorite, scavenged from a sky that no longer calls.',
  dyes: 'Yellow-ochre jarosite pigment for flags, warnings and less successful art.',
  cotton: 'White bio-cotton fiber pods cultivated in sealed trays.',
  sugar: 'Coffee clones under a mini-dome. The colony has priorities.',
  whales: 'A half-buried satellite wreck in the Dust Sea; no whales were harmed, because none exist.',
  horses: 'Cryogenic methane fuel. Revealed by **Animal Husbandry**.',
  iron: 'Nickel-iron ore for frames and armor. Revealed by **Bronze Working**.',
  niter: 'Perchlorate salts for energetic chemistry. Revealed by **Machinery**.',
  coal: 'Thorium ore with a faint green glow. Revealed by **Industrialization**.',
  oil: 'Deuterium-rich heavy ice for power systems. Revealed by **Combustion**.',
};
