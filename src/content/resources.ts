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
  res({ id: 'rice', name: 'Salt Algae', kind: 'bonus', yields: y(1), improvement: 'farm', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['marsh', 'floodplains'], weight: 7 }),
  res({ id: 'cattle', name: 'Lichen Beds', kind: 'bonus', yields: y(1), improvement: 'pasture', improvedYields: y(1), terrains: ['grassland'], weight: 9 }),
  res({ id: 'sheep', name: 'Methane Seep', kind: 'bonus', yields: y(1), improvement: 'pasture', improvedYields: y(0, 0, 1), terrains: ['grassland', 'plains', 'tundra'], elevations: ['hills'], weight: 8 }),
  res({ id: 'deer', name: 'Crater Ice', kind: 'bonus', yields: y(1), improvement: 'camp', improvedYields: y(1), terrains: ['tundra', 'plains', 'grassland'], features: ['forest'], weight: 8 }),
  res({ id: 'fish', name: 'Dust Silt', kind: 'bonus', yields: y(2), improvement: 'fishing_boats', improvedYields: y(1), terrains: ['coast', 'lake'], weight: 10 }),
  res({ id: 'stone', name: 'Black Rock', kind: 'bonus', yields: y(0, 1), improvement: 'quarry', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'desert', 'tundra'], weight: 6 }),
  res({ id: 'bananas', name: 'Glowcap Fungus', kind: 'bonus', yields: y(1), improvement: 'plantation', improvedYields: y(1), terrains: ['grassland', 'plains'], features: ['jungle'], weight: 6 }),

  // ───────── luxury ─────────
  res({ id: 'gold', name: 'Platinum Nuggets', kind: 'luxury', yields: y(0, 0, 2), improvement: 'mine', improvedYields: y(0, 0, 2), terrains: ['desert', 'plains', 'grassland', 'tundra'], elevations: ['hills'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'gems', name: 'Martian Opal', kind: 'luxury', yields: y(0, 0, 2, 1), improvement: 'mine', improvedYields: y(0, 0, 1, 1), terrains: ['grassland', 'plains', 'desert', 'tundra'], elevations: ['hills'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'silk', name: 'Spider Silk', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['grassland', 'plains'], features: ['forest'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'spices', name: 'Saffron Seeds', kind: 'luxury', yields: y(1, 0, 1), improvement: 'plantation', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['jungle'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'wine', name: 'Last Wine', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['plains', 'grassland'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'incense', name: 'Earth Soil', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 0, 0, 2), terrains: ['desert', 'plains'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'furs', name: 'Aerogel', kind: 'luxury', yields: y(0, 0, 2), improvement: 'camp', improvedYields: y(0, 0, 1, 0, 1), terrains: ['tundra', 'snow'], features: ['forest'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'pearls', name: 'Iron Blueberries', kind: 'luxury', yields: y(0, 0, 2), improvement: 'fishing_boats', improvedYields: y(0, 0, 1, 1), terrains: ['coast'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'marble', name: 'Martian Jade', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'quarry', improvedYields: y(0, 1, 0, 0, 1), terrains: ['grassland', 'plains', 'desert', 'tundra'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'ivory', name: 'Meteorite Iron', kind: 'luxury', yields: y(0, 0, 2), improvement: 'camp', improvedYields: y(0, 1, 1), terrains: ['plains', 'grassland'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'dyes', name: 'Yellow Pigment', kind: 'luxury', yields: y(0, 0, 1, 0, 1), improvement: 'plantation', improvedYields: y(0, 0, 1, 0, 1), terrains: ['grassland', 'plains'], features: ['jungle', 'forest'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'cotton', name: 'Bio-Cotton', kind: 'luxury', yields: y(0, 0, 2), improvement: 'plantation', improvedYields: y(0, 1, 1), terrains: ['grassland', 'plains', 'desert'], weight: 4, happiness: LUX_HAPPY }),
  res({ id: 'sugar', name: 'Coffee Clones', kind: 'luxury', yields: y(1, 0, 1), improvement: 'plantation', improvedYields: y(1, 0, 1), terrains: ['grassland', 'plains'], features: ['marsh', 'floodplains'], weight: 3, happiness: LUX_HAPPY }),
  res({ id: 'whales', name: 'Orbital Debris', kind: 'luxury', yields: y(1, 1, 1), improvement: 'fishing_boats', improvedYields: y(0, 1, 1), terrains: ['coast', 'ocean'], weight: 3, happiness: LUX_HAPPY }),

  // ───────── strategic ─────────
  res({ id: 'horses', name: 'Methane', kind: 'strategic', yields: y(0, 1), improvement: 'pasture', improvedYields: y(0, 1), terrains: ['grassland', 'plains', 'tundra'], weight: 5, revealTech: 'animal_husbandry' }),
  res({ id: 'iron', name: 'Nickel-Iron', kind: 'strategic', yields: y(0, 1), improvement: 'mine', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'desert', 'tundra', 'snow'], weight: 5, revealTech: 'bronze_working' }),
  res({ id: 'niter', name: 'Toxic Salts', kind: 'strategic', yields: y(0, 1), improvement: 'mine', improvedYields: y(0, 1), terrains: ['desert', 'plains', 'grassland', 'tundra'], weight: 4, revealTech: 'machinery' }),
  res({ id: 'coal', name: 'Thorium', kind: 'strategic', yields: y(0, 2), improvement: 'mine', improvedYields: y(0, 1), terrains: ['plains', 'grassland', 'tundra'], weight: 4, revealTech: 'industrialization' }),
  res({ id: 'oil', name: 'Heavy Ice', kind: 'strategic', yields: y(0, 1), improvement: 'oil_well', improvedYields: y(0, 2), terrains: ['desert', 'tundra', 'snow', 'plains'], weight: 4, revealTech: 'combustion' }),
];

export const RESOURCES: Record<string, ResourceDef> = Object.fromEntries(LIST.map((r) => [r.id, r]));

/** Flavor lines for tile-info / codex. */
export const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  wheat: 'White nitrogen salts. They feed the greenhouses.',
  rice: 'Green algae mats grown in salty water.',
  cattle: 'Lichen beds grow on rock and turn light into food.',
  sheep: 'Methane leaks from the ground here. Good fuel, bad air.',
  deer: 'Blue ice hidden in small craters.',
  fish: 'Fine silt drifts through the Shallows. Nobody has caught a fish yet.',
  stone: 'Dark rock columns. The bones of every colony.',
  bananas: 'Glowing mushrooms from the lava tube farms.',
  gold: 'Bright platinum nuggets. Old money survived the trip.',
  gems: 'Shiny opal. People stop arguing when they see it.',
  silk: 'Spider silk grown in sealed tanks.',
  spices: 'Saffron seeds in sealed cans, counted one by one.',
  wine: 'Sealed bottles from Earth. Nobody may open them on duty.',
  incense: 'Sacks of dark soil from Earth. A little homesickness, shared out carefully.',
  furs: 'Clear aerogel blocks. Warmer than fur and easier to care for.',
  pearls: 'Small dark iron balls that look like blueberries.',
  marble: 'Green rock polished into Martian jade.',
  ivory: 'A pitted iron meteorite found on the ground.',
  dyes: 'Yellow pigment for flags, signs and bad paintings.',
  cotton: 'White cotton grown in sealed trays.',
  sugar: 'Coffee plants under a small dome. The colony has its priorities.',
  whales: 'A broken satellite half-buried in the Dust Sea. No whales exist here.',
  horses: 'Frozen methane fuel. Revealed by **Bioengineering**.',
  iron: 'Nickel-iron ore for frames and armor. Revealed by **Strong Metals**.',
  niter: 'Toxic salts for powerful chemistry. Revealed by **Fine Machines**.',
  coal: 'Thorium ore with a faint green glow. Revealed by **Factories**.',
  oil: 'Heavy ice used for power and fuel. Revealed by **Fuel Chemistry**.',
};
