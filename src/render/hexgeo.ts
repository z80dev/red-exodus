// Renderer hex geometry (pointy-top, odd-r offset — the layout of sim/hex.ts, whose adjacency/distance/picking
// helpers the renderer uses directly). Here: allocation-free world coordinates, corner/edge vectors, hashes.
// Direction order (riverEdges bit i): 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE. +z is south.
// Edge i of a hex joins corner (i+5)%6 and corner i; corner k sits at angle 60k+30° (atan2(z, x)).
import type { GameMap } from '../sim/types';

const SQRT3 = Math.sqrt(3);
export const APOTHEM = SQRT3 / 2;

export const WATER_TERRAIN: Record<string, true> = { ocean: true, coast: true, lake: true };

/** unit vectors from hex center toward each neighbor direction */
export const DIR_VEC: readonly { x: number; z: number }[] = Array.from({ length: 6 }, (_, i) => ({
  x: Math.cos((i * Math.PI) / 3),
  z: Math.sin((i * Math.PI) / 3),
}));
/** corner offsets from hex center (circumradius 1) */
export const CORNER_VEC: readonly { x: number; z: number }[] = Array.from({ length: 6 }, (_, k) => ({
  x: Math.cos(((60 * k + 30) * Math.PI) / 180),
  z: Math.sin(((60 * k + 30) * Math.PI) / 180),
}));

export function colX(col: number, row: number): number {
  return SQRT3 * (col + 0.5 * (row & 1));
}
export function rowZ(row: number): number {
  return 1.5 * row;
}

/** world-space bounds of all hex centers, padded by one hex */
export function mapBounds(map: GameMap): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return {
    minX: -APOTHEM - 0.2,
    maxX: colX(map.width - 1, 1) + APOTHEM + 0.2,
    minZ: -1.2,
    maxZ: rowZ(map.height - 1) + 1.2,
  };
}

/** small deterministic hash → [0,1) */
export function hash01(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
