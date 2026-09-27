// Art direction: terrain palette, era lighting presets, team colors.
import { Color } from 'three';
import { FEATURES, TERRAINS } from '../content';
import type { FeatureId, TerrainId } from '../sim/types';

/** renderer defaults; content `color` fields override when present */
const TERRAIN_FALLBACK: Record<TerrainId, string> = {
  grassland: '#7cae48',
  plains: '#b8b058',
  desert: '#e0c486',
  tundra: '#9c9d7e',
  snow: '#eef2f5',
  coast: '#3fb8c4',
  ocean: '#1d5f94',
  lake: '#45a9c9',
};
const FEATURE_FALLBACK: Record<FeatureId, string> = {
  forest: '#4d7c33',
  jungle: '#3a7436',
  marsh: '#6d8858',
  oasis: '#86c05a',
  floodplains: '#9bc45a',
  reef: '#56d0c8',
  ice: '#e6f1f7',
};

export const SAND = new Color('#e3cf9a');
export const WET_SAND = new Color('#c9b07a');
export const ROCK = new Color('#8a8177');
export const ROCK_DARK = new Color('#6e665e');
export const SEABED = new Color('#b9a878');
export const GRAVEL = new Color('#a39a86');
export const SNOW_SHADE = new Color('#b9cad8');

export function terrainColor(id: TerrainId): Color {
  return new Color(TERRAINS[id]?.color ?? TERRAIN_FALLBACK[id] ?? '#888888');
}
export function featureColor(id: FeatureId): Color {
  return new Color(FEATURES[id]?.color ?? FEATURE_FALLBACK[id] ?? '#888888');
}

export interface EraLight {
  sun: string;
  sunIntensity: number;
  /** sun elevation / azimuth in degrees */
  elevation: number;
  azimuth: number;
  sky: string;
  ground: string;
  hemiIntensity: number;
  haze: string;
  exposure: number;
  /** water shallow / deep tint */
  shallow: string;
  deep: string;
  /** cloud lit / shadow color */
  cloud: string;
  cloudShadow: string;
}

export const ERA_LIGHTS: EraLight[] = [
  // Ancient — golden dawn
  { sun: '#ffd49a', sunIntensity: 3.1, elevation: 38, azimuth: 215, sky: '#ffe3bd', ground: '#5d4a33', hemiIntensity: 1.25, haze: '#e8c89c', exposure: 1.0, shallow: '#4fd0c4', deep: '#1f5f8c', cloud: '#fff1dc', cloudShadow: '#b89c86' },
  // Classical — warm clear morning
  { sun: '#ffdfae', sunIntensity: 3.2, elevation: 44, azimuth: 210, sky: '#f6e6c9', ground: '#584a38', hemiIntensity: 1.25, haze: '#e5d2b2', exposure: 1.0, shallow: '#4fd3c8', deep: '#1c5f90', cloud: '#fff4e4', cloudShadow: '#b3a291' },
  // Medieval — soft late morning, slightly green
  { sun: '#ffe8c6', sunIntensity: 3.1, elevation: 50, azimuth: 205, sky: '#e4e8de', ground: '#4c4a3a', hemiIntensity: 1.3, haze: '#d4d8c8', exposure: 1.0, shallow: '#4acbc6', deep: '#1b5a88', cloud: '#f8f6ee', cloudShadow: '#a4a6a0' },
  // Renaissance — bright noon
  { sun: '#fff0da', sunIntensity: 3.3, elevation: 56, azimuth: 200, sky: '#dfeaf2', ground: '#4b4a40', hemiIntensity: 1.3, haze: '#d2e0ea', exposure: 1.0, shallow: '#47cfd0', deep: '#1a5b92', cloud: '#fbfbf8', cloudShadow: '#a3acb4' },
  // Industrial — hazy sepia afternoon
  { sun: '#f7e4c8', sunIntensity: 3.0, elevation: 48, azimuth: 225, sky: '#d8d6d0', ground: '#4a443c', hemiIntensity: 1.35, haze: '#cbc3b6', exposure: 0.98, shallow: '#4cbfbc', deep: '#1e5680', cloud: '#eeebe4', cloudShadow: '#9d9990' },
  // Modern — crisp daylight
  { sun: '#ffffff', sunIntensity: 3.4, elevation: 58, azimuth: 195, sky: '#d4e8ff', ground: '#46484a', hemiIntensity: 1.35, haze: '#c3dcf2', exposure: 1.02, shallow: '#42d4dc', deep: '#155a9c', cloud: '#ffffff', cloudShadow: '#a2b2c4' },
];

export function eraLight(era: number): EraLight {
  return ERA_LIGHTS[Math.max(0, Math.min(ERA_LIGHTS.length - 1, era))];
}

export const BARBARIAN_COLORS = { primary: '#8e2b24', secondary: '#2b1a17' };
