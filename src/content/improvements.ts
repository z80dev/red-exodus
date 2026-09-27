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
    id: 'farm', name: 'Farm', tech: 'agriculture', goldCost: 25, yields: y(1),
    terrains: ['grassland', 'plains', 'desert', 'tundra'], elevations: ['flat', 'hills'], features: ['floodplains', 'marsh'],
    description: '+1 {food}. Tilled fields on open land; the backbone of every growing city. Connects wheat and rice.',
  }),
  imp({
    id: 'mine', name: 'Mine', tech: 'mining', goldCost: 30, yields: y(0, 1),
    terrains: ['grassland', 'plains', 'desert', 'tundra', 'snow'], elevations: ['hills'],
    description: '+1 {prod}. Shafts sunk into hills. Connects iron, gold, gems, niter and coal anywhere.',
  }),
  imp({
    id: 'pasture', name: 'Pasture', tech: 'animal_husbandry', goldCost: 25, yields: y(0, 1), requiresResource: true,
    description: '+1 {prod}. Fenced grazing for cattle, sheep and horses.',
  }),
  imp({
    id: 'plantation', name: 'Plantation', tech: 'calendar', goldCost: 30, yields: y(0, 0, 1), requiresResource: true,
    description: '+1 {gold}. Cultivates bananas, spices, silk, wine, incense, dyes, cotton and sugar.',
  }),
  imp({
    id: 'camp', name: 'Camp', tech: 'archery', goldCost: 25, yields: y(0, 0, 1), requiresResource: true,
    description: '+1 {gold}. Hunters\u2019 lodge for deer, furs and ivory. Keeps the forest standing.',
  }),
  imp({
    id: 'quarry', name: 'Quarry', tech: 'mining', goldCost: 30, yields: y(0, 1), requiresResource: true,
    description: '+1 {prod}. Cuts stone and marble for monuments and wonders.',
  }),
  imp({
    id: 'fishing_boats', name: 'Fishing Boats', tech: 'sailing', goldCost: 30, yields: y(1), requiresResource: true, water: true,
    description: '+1 {food}. A fleet of little boats working fish, pearls and whales.',
  }),
  imp({
    id: 'lumbermill', name: 'Lumber Mill', tech: 'engineering', goldCost: 40, yields: y(0, 1, 0, 0, 0), features: ['forest'],
    terrains: ['grassland', 'plains', 'tundra', 'snow'], elevations: ['flat', 'hills'],
    description: '+1 {prod} on a forest, which is kept standing. Sustainable timber for a growing realm.',
  }),
  imp({
    id: 'trading_post', name: 'Trading Post', tech: 'currency', goldCost: 40, yields: y(0, 0, 2),
    terrains: ['grassland', 'plains', 'desert', 'tundra'], elevations: ['flat', 'hills'], features: ['forest', 'jungle', 'floodplains', 'oasis'],
    description: '+2 {gold}. A bustling market stall on any open land, forest or jungle.',
  }),
  imp({
    id: 'oil_well', name: 'Oil Well', tech: 'combustion', goldCost: 70, yields: y(0, 2), requiresResource: true,
    description: '+2 {prod}. Pumps crude from deep reservoirs. Required to field tanks.',
  }),
];

export const IMPROVEMENTS: Record<string, ImprovementDef> = Object.fromEntries(LIST.map((i) => [i.id, i]));
