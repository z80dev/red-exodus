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
    description: '+1 {food}. Crop trays in sealed domes grow food on bare ground. Connects Nitrate Salts and Salt Algae.',
  }),
  imp({
    id: 'mine', name: 'Ground Mine', tech: 'mining', goldCost: 30, yields: y(0, 1),
    terrains: ['grassland', 'plains', 'desert', 'tundra', 'snow'], elevations: ['hills'],
    description: '+1 {prod}. Shafts dig into hills and rock. Connects Nickel-Iron, Platinum, Opal, Toxic Salts and Thorium.',
  }),
  imp({
    id: 'pasture', name: 'Bio Tank', tech: 'animal_husbandry', goldCost: 25, yields: y(0, 1), requiresResource: true,
    description: '+1 {prod}. Sealed tanks grow lichen and collect methane. Connects Lichen Beds, Methane Seep and Methane.',
  }),
  imp({
    id: 'plantation', name: 'Crop Bay', tech: 'calendar', goldCost: 30, yields: y(0, 0, 1), requiresResource: true,
    description: '+1 {gold}. Controlled growing for fungus, seeds, silk, wine, soil, pigment, cotton and coffee.',
  }),
  imp({
    id: 'camp', name: 'Harvest Rig', tech: 'archery', goldCost: 25, yields: y(0, 0, 1), requiresResource: true,
    description: '+1 {gold}. A sealed rig that collects Crater Ice, Aerogel and Meteorite Iron.',
  }),
  imp({
    id: 'quarry', name: 'Rock Quarry', tech: 'mining', goldCost: 30, yields: y(0, 1), requiresResource: true,
    description: '+1 {prod}. Cuts Black Rock and Martian Jade for colonies and Wonders.',
  }),
  imp({
    id: 'fishing_boats', name: 'Dust Skimmer', tech: 'sailing', goldCost: 30, yields: y(1), requiresResource: true, water: true,
    description: '+1 {food}. A fan-driven boat collects silt, wreckage and other water resources.',
  }),
  imp({
    id: 'lumbermill', name: 'Block Works', tech: 'engineering', goldCost: 40, yields: y(0, 1, 0, 0, 0), features: ['forest'],
    terrains: ['grassland', 'plains', 'tundra', 'snow'], elevations: ['flat', 'hills'],
    description: '+1 {prod} on Rock Spires, which stay in place. Heat and pressure turn local dust into blocks.',
  }),
  imp({
    id: 'trading_post', name: 'Relay Station', tech: 'currency', goldCost: 40, yields: y(0, 0, 2),
    terrains: ['grassland', 'plains', 'desert', 'tundra'], elevations: ['flat', 'hills'], features: ['forest', 'jungle', 'floodplains', 'oasis'],
    description: '+2 {gold}. A radio relay links far-away tiles to the colony market.',
  }),
  imp({
    id: 'oil_well', name: 'Deep Drill', tech: 'combustion', goldCost: 70, yields: y(0, 2), requiresResource: true,
    description: '+2 {prod}. Pulls Heavy Ice out of the ground for power and fuel.',
  }),
];

export const IMPROVEMENTS: Record<string, ImprovementDef> = Object.fromEntries(LIST.map((i) => [i.id, i]));
