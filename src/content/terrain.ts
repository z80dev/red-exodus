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
    id: 'ocean', name: 'Ocean', yields: y(1, 0, 1), moveCost: 1, defensePct: 0, water: true, color: '#1d5f94',
    description: 'Deep open water. Only ships built after **Cartography** may brave it.',
  },
  coast: {
    id: 'coast', name: 'Coast', yields: y(1, 0, 1), moveCost: 1, defensePct: 0, water: true, color: '#3fb8c4',
    description: 'Shallow shelf waters rich in fish. Embarked units may cross after **Sailing**.',
  },
  lake: {
    id: 'lake', name: 'Lake', yields: y(2, 0, 1), moveCost: 1, defensePct: 0, water: true, color: '#45a9c9',
    description: 'Fresh water. Cities beside a lake count as having fresh water for farms and wonders.',
  },
  grassland: {
    id: 'grassland', name: 'Grassland', yields: y(2), moveCost: 1, defensePct: 0, water: false, color: '#7cae48',
    description: 'Lush green meadows. The best land for growing cities: 2 {food}.',
  },
  plains: {
    id: 'plains', name: 'Plains', yields: y(1, 1), moveCost: 1, defensePct: 0, water: false, color: '#b8b058',
    description: 'Golden steppe balancing {food} and {prod}. Ideal for horses and wheat.',
  },
  desert: {
    id: 'desert', name: 'Desert', yields: y(), moveCost: 1, defensePct: 0, water: false, color: '#e0c486',
    description: 'Barren sands. Worthless on their own, but floodplains, oases and buried riches bloom here.',
  },
  tundra: {
    id: 'tundra', name: 'Tundra', yields: y(1), moveCost: 1, defensePct: 0, water: false, color: '#9c9d7e',
    description: 'Cold, windswept lowland. Home to deer and furs.',
  },
  snow: {
    id: 'snow', name: 'Snow', yields: y(), moveCost: 1, defensePct: 0, water: false, color: '#eef2f5',
    description: 'Frozen wastes that yield nothing but silence — and sometimes oil.',
  },
};

export const FEATURES: Record<FeatureId, FeatureDef> = {
  forest: {
    id: 'forest', name: 'Forest', yields: y(0, 1), moveCost: 2, defensePct: 25, color: '#4d7c33', blocksVision: true,
    description: '+1 {prod}. Costs 2 moves to enter and grants +25% defense. A **Lumber Mill** harvests it.',
  },
  jungle: {
    id: 'jungle', name: 'Jungle', yields: y(1), moveCost: 2, defensePct: 25, color: '#3a7436', blocksVision: true,
    description: '+1 {food}. Dense canopy: 2 moves to enter, +25% defense. Hides bananas and spices.',
  },
  marsh: {
    id: 'marsh', name: 'Marsh', yields: y(1), moveCost: 2, defensePct: -15, color: '#6d8858',
    description: '+1 {food}. Boggy ground: 2 moves to enter and −15% defense for units caught in it.',
  },
  oasis: {
    id: 'oasis', name: 'Oasis', yields: y(3, 0, 1), moveCost: 1, defensePct: 0, color: '#86c05a',
    description: '+3 {food} +1 {gold}. A palm-ringed spring in the desert; counts as fresh water.',
  },
  floodplains: {
    id: 'floodplains', name: 'Floodplains', yields: y(2), moveCost: 1, defensePct: -10, color: '#9bc45a',
    description: '+2 {food}. Silt-rich river flats that feed empires. −10% defense.',
  },
  reef: {
    id: 'reef', name: 'Reef', yields: y(1, 1, 0, 1), moveCost: 1, defensePct: 0, color: '#56d0c8',
    description: '+1 {food} +1 {prod} +1 {sci}. Living coral gardens teeming with life.',
  },
  ice: {
    id: 'ice', name: 'Ice', yields: y(), moveCost: 99, defensePct: 0, color: '#e6f1f7',
    description: 'Pack ice. Impassable to every unit.',
  },
};

export const ELEVATIONS: Record<ElevationId, ElevationDef> = {
  flat: { id: 'flat', name: 'Flat', yields: y(), moveCost: 1, defensePct: 0, impassable: false, blocksVision: false },
  hills: { id: 'hills', name: 'Hills', yields: y(0, 1), moveCost: 2, defensePct: 25, impassable: false, blocksVision: true },
  mountain: { id: 'mountain', name: 'Mountains', yields: y(), moveCost: 99, defensePct: 0, impassable: true, blocksVision: true },
};

/** Short tile-info blurbs for elevations (ElevationDef has no description field). */
export const ELEVATION_DESCRIPTIONS: Record<ElevationId, string> = {
  flat: 'Open ground. No movement or defense modifiers.',
  hills: '+1 {prod}. Costs 2 moves to climb, +25% defense and a commanding view. **Mines** dig in here.',
  mountain: 'Impassable peaks that block sight. Observatories and some wonders love them.',
};
