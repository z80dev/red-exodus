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
    description: 'A deep basin of ultrafine dust. Hover hulls can cross it after **Cartography**.',
  },
  coast: {
    id: 'coast', name: 'Dust Shallows', yields: y(1, 0, 1), moveCost: 1, defensePct: 0, water: true, color: '#d9a066',
    description: 'A shallow shelf of shifting fines. Dust Skiffs unlock crossing after **Sailing**.',
  },
  lake: {
    id: 'lake', name: 'Brine Lake', yields: y(2, 0, 1), moveCost: 1, defensePct: 0, water: true, color: '#3f8f8a',
    description: 'Rare liquid brine, precious enough to start arguments. Colonies beside it count as having fresh water.',
  },
  grassland: {
    id: 'grassland', name: 'Clay Basin', yields: y(2), moveCost: 1, defensePct: 0, water: false, color: '#8a9a3b',
    description: 'Hydrated clays offer the best ground for greenhouse crops: 2 {food}.',
  },
  plains: {
    id: 'plains', name: 'Regolith Plain', yields: y(1, 1), moveCost: 1, defensePct: 0, water: false, color: '#c8693a',
    description: 'A broad mantle of workable dust: modest {food} and {prod}, until the next storm.',
  },
  desert: {
    id: 'desert', name: 'Dune Sea', yields: y(), moveCost: 1, defensePct: 0, water: false, color: '#d9a066',
    description: 'Bare dunes offer little by themselves. Buried deposits and ancient channels disagree.',
  },
  tundra: {
    id: 'tundra', name: 'Frost Flats', yields: y(1), moveCost: 1, defensePct: 0, water: false, color: '#9b7d69',
    description: 'Cold permafrost lowlands, hostile to fingers and useful to methane prospectors.',
  },
  snow: {
    id: 'snow', name: 'Polar Ice', yields: y(), moveCost: 1, defensePct: 0, water: false, color: '#eef3f6',
    description: 'A blinding cap of polar ice. The silence is free; everything else costs extra.',
  },
};

export const FEATURES: Record<FeatureId, FeatureDef> = {
  forest: {
    id: 'forest', name: 'Hoodoo Field', yields: y(0, 1), moveCost: 2, defensePct: 25, color: '#57463d', blocksVision: true,
    description: '+1 {prod}. Wind-carved spires provide cover; it costs 2 moves to cross and grants +25% defense. A **Sinter Works** can use the feature.',
  },
  jungle: {
    id: 'jungle', name: 'Lava Tubes', yields: y(1), moveCost: 2, defensePct: 25, color: '#3b2f2a', blocksVision: true,
    description: '+1 {food}. Subsurface shelter gives +25% defense; tube farms produce Glowcap Fungus.',
  },
  marsh: {
    id: 'marsh', name: 'Perchlorate Bog', yields: y(1), moveCost: 2, defensePct: -15, color: '#9b4424',
    description: '+1 {food}. Toxic salts and treacherous crust cost 2 moves and impose −15% defense.',
  },
  oasis: {
    id: 'oasis', name: 'Geyser Vent', yields: y(3, 0, 1), moveCost: 1, defensePct: 0, color: '#c77b2c',
    description: '+3 {food} +1 {gold}. A steaming mineral vent; this rare patch counts as fresh water.',
  },
  floodplains: {
    id: 'floodplains', name: 'Ancient Delta', yields: y(2), moveCost: 1, defensePct: -10, color: '#8a9a3b',
    description: '+2 {food}. Subsurface ice once fed these silt-rich channels; −10% defense.',
  },
  reef: {
    id: 'reef', name: 'Mineral Shoal', yields: y(1, 1, 0, 1), moveCost: 1, defensePct: 0, color: '#6fa8c9',
    description: '+1 {food} +1 {prod} +1 {sci}. Crystalline minerals catch the light in drifting dust.',
  },
  ice: {
    id: 'ice', name: 'Dry-Ice Sheet', yields: y(), moveCost: 99, defensePct: 0, color: '#eef3f6',
    description: 'A slab of frozen carbon dioxide. Impassable to every unit; remarkably poor picnic ground.',
  },
};

export const ELEVATIONS: Record<ElevationId, ElevationDef> = {
  flat: { id: 'flat', name: 'Flat', yields: y(), moveCost: 1, defensePct: 0, impassable: false, blocksVision: false },

  hills: { id: 'hills', name: 'Ridges', yields: y(0, 1), moveCost: 2, defensePct: 25, impassable: false, blocksVision: true },
  mountain: { id: 'mountain', name: 'Massif', yields: y(), moveCost: 99, defensePct: 0, impassable: true, blocksVision: true },
};

/** Short tile-info blurbs for elevations (ElevationDef has no description field). */
export const ELEVATION_DESCRIPTIONS: Record<ElevationId, string> = {
  flat: 'Open regolith. No movement or defense modifiers.',
  hills: '+1 {prod}. Ridges cost 2 moves to climb, grant +25% defense and command a view. **Regolith Mines** dig here.',
  mountain: 'Impassable massifs block sight. Deep-space arrays and some megaprojects love them.',
};
