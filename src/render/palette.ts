// Art direction (docs/RESKIN.md palette anchors): Mars terrain palette, the terraforming era arc
// (lighting, sky, dust seas, brine, lichen, storms), team colors. The renderer owns these looks; content
// `color` fields are not used for the map (they predate the Mars reskin).
import { Color } from 'three';
import type { FeatureId, TerrainId } from '../sim/types';

const TERRAIN_MARS: Record<TerrainId, string> = {
  grassland: '#93604a', // Clay Basin — hydrated clays, cooler and darker than the regolith
  plains: '#c0673a', // Regolith Plain
  desert: '#d49a60', // Dune Sea — butterscotch
  tundra: '#b49488', // Frost Flats — pink-grey permafrost
  snow: '#eef3f6', // Polar Ice
  coast: '#a4552c', // Dust Shallows (bed under the dust surface)
  ocean: '#6e3219', // Dust Sea
  lake: '#3f8f8a', // Brine Lake
};
const FEATURE_MARS: Record<FeatureId, string> = {
  forest: '#a95d3a', // Hoodoo Field
  jungle: '#4e3830', // Lava Tubes — basalt roof
  marsh: '#c9aa5e', // Perchlorate Bog — toxic yellow crust
  oasis: '#b9a790', // Geyser Vent — pale mineral apron
  floodplains: '#a96c45', // Ancient Delta — sediment fans
  reef: '#7fc9bf', // Mineral Shoal
  ice: '#e8eef2', // Dry-Ice Sheet
};

/** pale windblown fines along dust shores */
export const DUST_FINES = new Color('#d9a066');
export const DUST_WET = new Color('#b8703f');
export const BASALT = new Color('#57463d');
export const BASALT_DARK = new Color('#3b2f2a');
export const DUST_BED = new Color('#a4552c');
export const DUST_DEEP = new Color('#6e3219');
export const FROST_GRAVEL = new Color('#9a8078');
export const ICE_SHADE = new Color('#c6d2dc');

export function terrainColor(id: TerrainId): Color {
  return new Color(TERRAIN_MARS[id] ?? '#b5552b');
}
export function featureColor(id: FeatureId): Color {
  return new Color(FEATURE_MARS[id] ?? '#9b4424');
}

export interface EraLight {
  sun: string;
  sunIntensity: number;
  /** sun elevation / azimuth in degrees */
  elevation: number;
  azimuth: number;
  /** hemisphere sky + ground bounce */
  sky: string;
  ground: string;
  hemiIntensity: number;
  /** horizon haze (fog + background) */
  haze: string;
  exposure: number;
  /** sky dome zenith and the blue halo around a Martian sun */
  skyTop: string;
  sunset: string;
  /** dust sea: shallows / crests and deep troughs */
  dustHi: string;
  dustLo: string;
  /** brine lakes */
  brine: string;
  /** fog-of-war dust haze lit / shadow color */
  cloud: string;
  cloudShadow: string;
  /** dust storm puffs lit / shadow color */
  stormLit: string;
  stormDark: string;
  /** terraforming progress 0 (Landfall) … 1 (New Earth): lichen, wider lakes, meltwater in channels */
  terraform: number;
}

// Landfall is harsh, dim and dusty; each era the sky clears a little, the sun whitens, lakes brighten and the
// clay basins green over, until New Earth's sky tints blue.
export const ERA_LIGHTS: EraLight[] = [
  // Landfall — low bruised sun through suspended dust
  { sun: '#ffbe86', sunIntensity: 2.55, elevation: 31, azimuth: 222, sky: '#d49a72', ground: '#4a2618', hemiIntensity: 1.05, haze: '#c48457', exposure: 0.93, skyTop: '#c07e56', sunset: '#86a9cf', dustHi: '#b0602f', dustLo: '#5e2912', brine: '#3a8580', cloud: '#cf9a70', cloudShadow: '#6b3a26', stormLit: '#c4804e', stormDark: '#44190c', terraform: 0 },
  // Foothold
  { sun: '#ffc893', sunIntensity: 2.75, elevation: 36, azimuth: 218, sky: '#d9a47e', ground: '#4c2a1c', hemiIntensity: 1.1, haze: '#ca8f63', exposure: 0.95, skyTop: '#c68a62', sunset: '#8aaed3', dustHi: '#b36433', dustLo: '#602913', brine: '#3c8b85', cloud: '#d4a27a', cloudShadow: '#70402b', stormLit: '#c88654', stormDark: '#471b0e', terraform: 0.12 },
  // Frontier
  { sun: '#ffd3a4', sunIntensity: 2.9, elevation: 41, azimuth: 214, sky: '#d8ab8c', ground: '#4b2e21', hemiIntensity: 1.15, haze: '#cc9a74', exposure: 0.97, skyTop: '#c6927a', sunset: '#8cb2d6', dustHi: '#b66735', dustLo: '#632b15', brine: '#3e928b', cloud: '#d8ab86', cloudShadow: '#744631', stormLit: '#cb8c5a', stormDark: '#4a1f12', terraform: 0.28 },
  // Industry — smoggy, busy, still rust
  { sun: '#ffdcb6', sunIntensity: 3.0, elevation: 46, azimuth: 208, sky: '#d0ae98', ground: '#48302a', hemiIntensity: 1.2, haze: '#c7a086', exposure: 0.98, skyTop: '#bb9c92', sunset: '#8fb5d8', dustHi: '#b86a38', dustLo: '#662e18', brine: '#40998f', cloud: '#d6b096', cloudShadow: '#76503e', stormLit: '#cc9262', stormDark: '#4d2517', terraform: 0.46 },
  // Terraform — the haze thins, the zenith cools
  { sun: '#fff0dc', sunIntensity: 3.2, elevation: 52, azimuth: 202, sky: '#bfc0c2', ground: '#46352e', hemiIntensity: 1.28, haze: '#c6b2a2', exposure: 1.0, skyTop: '#9fb3c6', sunset: '#86b2dc', dustHi: '#bb6e3c', dustLo: '#6a321b', brine: '#42a89c', cloud: '#dcc2b0', cloudShadow: '#7c6254', stormLit: '#d09a6c', stormDark: '#522b1d', terraform: 0.72 },
  // New Earth — blue-tinted sky, green basins, bright lakes
  { sun: '#ffffff', sunIntensity: 3.35, elevation: 57, azimuth: 196, sky: '#aac4dc', ground: '#44382f', hemiIntensity: 1.34, haze: '#bfc6cc', exposure: 1.02, skyTop: '#8fb6d6', sunset: '#7fb4e6', dustHi: '#be7240', dustLo: '#6e361e', brine: '#47bcae', cloud: '#e2d2c6', cloudShadow: '#7e6c64', stormLit: '#d4a276', stormDark: '#573325', terraform: 1 },
];

export function eraLight(era: number): EraLight {
  return ERA_LIGHTS[Math.max(0, Math.min(ERA_LIGHTS.length - 1, era))];
}

export const BARBARIAN_COLORS = { primary: '#8e2b24', secondary: '#2b1a17' };
