// OWNER: ContentCiv. Tile improvements, bought instantly with gold (Polytopia-style, no workers).
// Placement rule (SimCore `improvementOptions`): a tile whose resource's `improvement` equals this id is ALWAYS a
// valid site (resource connection), regardless of the terrain/feature/elevation lists. Otherwise, when
// `requiresResource` is false, the tile must match every listed constraint: `terrains`, `elevations`, and
// `features` (tile.feature must be null or one of the listed features; undefined = featureless only).
// `water` improvements go on water tiles only; everything else on land.
import type { ImprovementDef } from '../sim/defs';
import type { Yields } from '../sim/types';

const y = (food = 0, prod = 0, gold = 0, sci = 0, cul = 0): Yields => ({ food, prod, gold, sci, cul });

type ImpSpec = Omit<ImprovementDef, 'icon' | 'model'>;
function imp(spec: ImpSpec): ImprovementDef {
  return { ...spec, icon: spec.id, model: `imp_${spec.id}` };
}

const LIST: ImprovementDef[] = [
  imp({
    id: 'farm', name: 'Greenhouse Dome', tech: 'agriculture', goldCost: 25, yields: y(1),
    terrains: ['grassland', 'plains', 'desert', 'tundra'], elevations: ['flat', 'hills'], features: ['floodplains', 'marsh'],
    description: '+1 {food}. Pressurized crop trays coax food from open regolith. Connects Nitrate Salts and Brine Algae.',
  }),
  imp({
    id: 'mine', name: 'Regolith Mine', tech: 'mining', goldCost: 30, yields: y(0, 1),
    terrains: ['grassland', 'plains', 'desert', 'tundra', 'snow'], elevations: ['hills'],
    description: '+1 {prod}. Shafts bite into ridges and bedrock. Connects nickel-iron, platinum, opal, perchlorates and thorium.',
  }),
  imp({
    id: 'pasture', name: 'Bioreactor', tech: 'animal_husbandry', goldCost: 25, yields: y(0, 1), requiresResource: true,
    description: '+1 {prod}. Sealed vats cultivate lichen and harvest methane seep or fuel.',
  }),
  imp({
    id: 'plantation', name: 'Hydroponics Bay', tech: 'calendar', goldCost: 30, yields: y(0, 0, 1), requiresResource: true,
    description: '+1 {gold}. Controlled growth for fungus, seedstock, silk, wine, soil, pigment, cotton and coffee.',
  }),
  imp({
    id: 'camp', name: 'Extraction Rig', tech: 'archery', goldCost: 25, yields: y(0, 0, 1), requiresResource: true,
    description: '+1 {gold}. A sealed harvest rig for crater ice, aerogel and meteorite iron. Nothing gets hunted.',
  }),
  imp({
    id: 'quarry', name: 'Basalt Quarry', tech: 'mining', goldCost: 30, yields: y(0, 1), requiresResource: true,
    description: '+1 {prod}. Cuts basalt and Martian jade for habs and megaprojects.',
  }),
  imp({
    id: 'fishing_boats', name: 'Dust Skimmer', tech: 'sailing', goldCost: 30, yields: y(1), requiresResource: true, water: true,
    description: '+1 {food}. A fan-driven skimmer gathers silt, brine resources and satellite wreckage.',
  }),
  imp({
    id: 'lumbermill', name: 'Sinter Works', tech: 'engineering', goldCost: 40, yields: y(0, 1, 0, 0, 0), features: ['forest'],
    terrains: ['grassland', 'plains', 'tundra', 'snow'], elevations: ['flat', 'hills'],
    description: '+1 {prod} on a Hoodoo Field, which remains standing. Dust, heat and pressure fuse local regolith into blocks.',
  }),
  imp({
    id: 'trading_post', name: 'Relay Station', tech: 'currency', goldCost: 40, yields: y(0, 0, 2),
    terrains: ['grassland', 'plains', 'desert', 'tundra'], elevations: ['flat', 'hills'], features: ['forest', 'jungle', 'floodplains', 'oasis'],
    description: '+2 {gold}. A comms relay links remote installations to the colony exchange.',
  }),
  imp({
    id: 'oil_well', name: 'Deep Drill', tech: 'combustion', goldCost: 70, yields: y(0, 2), requiresResource: true,
    description: '+2 {prod}. Extracts deuterium-rich heavy ice for power and propulsion systems.',
  }),
];

export const IMPROVEMENTS: Record<string, ImprovementDef> = Object.fromEntries(LIST.map((i) => [i.id, i]));
