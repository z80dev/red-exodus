// Renderer-local hex math (pointy-top, odd-r offset; mirrors the layout documented in sim/hex.ts).
// Kept here so the renderer is self-contained and allocation-free in hot loops.
// Direction order (riverEdges bit i): 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE. +z is south.
// Edge i of a hex joins corner (i+5)%6 and corner i; corner k sits at angle 60k+30° (atan2(z, x)).
import type { GameMap, TileIdx } from '../sim/types';

export const SQRT3 = Math.sqrt(3);
export const HEX_R = 1;
export const APOTHEM = SQRT3 / 2;

export const WATER_TERRAIN: Record<string, true> = { ocean: true, coast: true, lake: true };

const EVEN_OFFSETS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]] as const;
const ODD_OFFSETS = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]] as const;

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

export function tileX(map: GameMap, idx: TileIdx): number {
  const row = Math.floor(idx / map.width);
  return colX(idx - row * map.width, row);
}
export function tileZ(map: GameMap, idx: TileIdx): number {
  return rowZ(Math.floor(idx / map.width));
}

export function neighborOf(map: GameMap, idx: TileIdx, dir: number): TileIdx {
  const row = Math.floor(idx / map.width);
  const col = idx - row * map.width;
  const o = (row & 1 ? ODD_OFFSETS : EVEN_OFFSETS)[dir];
  const c = col + o[0];
  const r = row + o[1];
  if (c < 0 || r < 0 || c >= map.width || r >= map.height) return -1;
  return r * map.width + c;
}

export function neighborsOf(map: GameMap, idx: TileIdx): TileIdx[] {
  const out: TileIdx[] = [];
  for (let d = 0; d < 6; d++) {
    const n = neighborOf(map, idx, d);
    if (n >= 0) out.push(n);
  }
  return out;
}

/** -1 if not adjacent */
export function dirTo(map: GameMap, a: TileIdx, b: TileIdx): number {
  for (let d = 0; d < 6; d++) if (neighborOf(map, a, d) === b) return d;
  return -1;
}

function toCube(map: GameMap, idx: TileIdx): [number, number] {
  const row = Math.floor(idx / map.width);
  const col = idx - row * map.width;
  return [col - (row - (row & 1)) / 2, row];
}

export function hexDist(map: GameMap, a: TileIdx, b: TileIdx): number {
  const [q1, r1] = toCube(map, a);
  const [q2, r2] = toCube(map, b);
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function tilesWithin(map: GameMap, center: TileIdx, radius: number): TileIdx[] {
  const out: TileIdx[] = [];
  const row = Math.floor(center / map.width);
  for (let r = Math.max(0, row - radius); r <= Math.min(map.height - 1, row + radius); r++) {
    for (let c = 0; c < map.width; c++) {
      const i = r * map.width + c;
      if (hexDist(map, center, i) <= radius) out.push(i);
    }
  }
  return out;
}

/** nearest tile to a world point, -1 outside the map */
export function worldTile(map: GameMap, x: number, z: number): TileIdx {
  const qf = (SQRT3 / 3) * x - z / 3;
  const rf = (2 / 3) * z;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  const col = q + (r - (r & 1)) / 2;
  if (col < 0 || r < 0 || col >= map.width || r >= map.height) return -1;
  return r * map.width + col;
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

/** stable string hash (for model variant picks) */
export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
