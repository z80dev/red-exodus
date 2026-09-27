// OWNER: MapGen. STUB — replace bodies. Pointy-top hexes, "odd-r" offset layout (odd rows shoved right by half a hex).
// Direction order (used by riverEdges bit i): 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE. +z is south (row increases).
// World: hex circumradius HEX_SIZE = 1; center x = sqrt(3) * (col + 0.5 * (row & 1)), z = 1.5 * row.
import type { GameMap, TileIdx } from './types';

export const HEX_SIZE = 1;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;

export function tileAt(map: GameMap, col: number, row: number): TileIdx { void map; void col; void row; throw new Error('not implemented'); }
export function neighbor(map: GameMap, idx: TileIdx, dir: number): TileIdx { void map; void idx; void dir; throw new Error('not implemented'); } // -1 if off-map
export function neighbors(map: GameMap, idx: TileIdx): TileIdx[] { void map; void idx; throw new Error('not implemented'); }
export function dirBetween(map: GameMap, a: TileIdx, b: TileIdx): number { void map; void a; void b; throw new Error('not implemented'); } // -1 if not adjacent
export function hexDistance(map: GameMap, a: TileIdx, b: TileIdx): number { void map; void a; void b; throw new Error('not implemented'); }
export function tilesInRadius(map: GameMap, center: TileIdx, radius: number): TileIdx[] { void map; void center; void radius; throw new Error('not implemented'); } // includes center
export function ring(map: GameMap, center: TileIdx, radius: number): TileIdx[] { void map; void center; void radius; throw new Error('not implemented'); }
export function hexToWorld(col: number, row: number): { x: number; z: number } { void col; void row; throw new Error('not implemented'); }
export function tileWorld(map: GameMap, idx: TileIdx): { x: number; z: number } { void map; void idx; throw new Error('not implemented'); }
export function worldToTile(map: GameMap, x: number, z: number): TileIdx { void map; void x; void z; throw new Error('not implemented'); } // -1 if off-map
