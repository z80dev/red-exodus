// OWNER: ContentCiv. Base terrain, features and elevations.
// Tile yield = terrain + feature + elevation (+ resource, improvement, river, hooks — see sim/cities.ts).
// Feature/elevation yields are ADDITIVE on top of the terrain (Civ VI style), so a forested grassland hill is
// 2 food + 1 prod (forest) + 1 prod (hills). `moveCost` of a feature/elevation replaces the terrain cost if higher.
// Colors are the renderer's base vertex tint (stylized diorama palette, agreed with Renderer).
import type { ElevationDef, FeatureDef, TerrainDef } from '../sim/defs';
import type { ElevationId, FeatureId, TerrainId, Yields } from '../sim/types';

const y = (food = 0, prod = 0, gold = 0, sci = 0, cul = 0): Yields => ({ food, prod, gold, sci, cul });

export const TERRAINS: Record<TerrainId, TerrainDef> = {
  ocean: {
    id: 'ocean', name: 'Dust Sea', yields: y(1, 0, 1), moveCost: 1, defensePct: 0, water: true, color: '#a4552c',
    description: 'A deep basin of fine dust. Units can cross it after **Hover Hulls**.',
  },
  coast: {
    id: 'coast', name: 'Shallows', yields: y(1, 0, 1), moveCost: 1, defensePct: 0, water: true, color: '#d9a066',
    description: 'Shallow dust near land. Units can cross it after **Dust Skiffs**.',
  },
  lake: {
    id: 'lake', name: 'Salt Lake', yields: y(2, 0, 1), moveCost: 1, defensePct: 0, water: true, color: '#3f8f8a',
    description: 'Rare liquid water full of salt. Colonies next to it have fresh water.',
  },
  grassland: {
    id: 'grassland', name: 'Clay Basin', yields: y(2), moveCost: 1, defensePct: 0, water: false, color: '#8a9a3b',
    description: 'Rich clay soil is the best ground for crops: 2 {food}.',
  },
  plains: {
    id: 'plains', name: 'Plains', yields: y(1, 1), moveCost: 1, defensePct: 0, water: false, color: '#c8693a',
    description: 'Flat, open ground with a little {food} and {prod}.',
  },
  desert: {
    id: 'desert', name: 'Dunes', yields: y(), moveCost: 1, defensePct: 0, water: false, color: '#d9a066',
    description: 'Bare dunes give nothing by themselves. Resources and Ice Channels can change that.',
  },
  tundra: {
    id: 'tundra', name: 'Frost Plains', yields: y(1), moveCost: 1, defensePct: 0, water: false, color: '#9b7d69',
    description: 'Cold, frozen low ground with a little {food}.',
  },
  snow: {
    id: 'snow', name: 'Ice Cap', yields: y(), moveCost: 1, defensePct: 0, water: false, color: '#eef3f6',
    description: 'A thick cap of ice. It gives no yields.',
  },
};

export const FEATURES: Record<FeatureId, FeatureDef> = {
  forest: {
    id: 'forest', name: 'Rock Spires', yields: y(0, 1), moveCost: 2, defensePct: 25, color: '#57463d', blocksVision: true,
    description: '+1 {prod}. Tall rock spires give cover: 2 moves to cross and +25% defense. A **Block Works** can use this tile.',
  },
  jungle: {
    id: 'jungle', name: 'Lava Tubes', yields: y(1), moveCost: 2, defensePct: 25, color: '#3b2f2a', blocksVision: true,
    description: '+1 {food}. Underground shelter gives +25% defense. Costs 2 moves to cross. Glowcap Fungus grows here.',
  },
  marsh: {
    id: 'marsh', name: 'Toxic Bog', yields: y(1), moveCost: 2, defensePct: -15, color: '#9b4424',
    description: '+1 {food}. Toxic mud costs 2 moves to cross and gives −15% defense.',
  },
  oasis: {
    id: 'oasis', name: 'Geyser', yields: y(3, 0, 1), moveCost: 1, defensePct: 0, color: '#c77b2c',
    description: '+3 {food} +1 {gold}. A hot water vent. It counts as fresh water.',
  },
  floodplains: {
    id: 'floodplains', name: 'Old Delta', yields: y(2), moveCost: 1, defensePct: -10, color: '#8a9a3b',
    description: '+2 {food}. Rich soil from an old river. −10% defense.',
  },
  reef: {
    id: 'reef', name: 'Mineral Shallows', yields: y(1, 1, 0, 1), moveCost: 1, defensePct: 0, color: '#6fa8c9',
    description: '+1 {food} +1 {prod} +1 {sci}. Shiny crystals grow in the shallow dust.',
  },
  ice: {
    id: 'ice', name: 'Dry Ice', yields: y(), moveCost: 99, defensePct: 0, color: '#eef3f6',
    description: 'A slab of frozen gas. No unit can cross it.',
  },
};

export const ELEVATIONS: Record<ElevationId, ElevationDef> = {
  flat: { id: 'flat', name: 'Flat', yields: y(), moveCost: 1, defensePct: 0, impassable: false, blocksVision: false },

  hills: { id: 'hills', name: 'Hills', yields: y(0, 1), moveCost: 2, defensePct: 25, impassable: false, blocksVision: true },
  mountain: { id: 'mountain', name: 'Mountains', yields: y(), moveCost: 99, defensePct: 0, impassable: true, blocksVision: true },
};

/** Short tile-info blurbs for elevations (ElevationDef has no description field). */
export const ELEVATION_DESCRIPTIONS: Record<ElevationId, string> = {
  flat: 'Open ground. No change to movement or defense.',
  hills: '+1 {prod}. Costs 2 moves to climb, gives +25% defense and a wide view. **Ground Mines** work here.',
  mountain: 'No unit can cross Mountains. They block sight.',
};
