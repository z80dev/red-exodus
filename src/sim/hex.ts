// Pointy-top hexes, "odd-r" offset layout (odd rows shoved right by half a hex).
// Direction order (used by riverEdges bit i): 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE. +z is south (row increases).
// World: hex circumradius HEX_SIZE = 1; center x = sqrt(3) * (col + 0.5 * (row & 1)), z = 1.5 * row.
import type { GameMap, TileIdx } from './types';

export const HEX_SIZE = 1;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;

const DIRECTIONS = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
] as const;

type NeighborTable = Int32Array[];
const neighborTables = new Map<string, NeighborTable>();

function validTile(map: GameMap, idx: number): idx is TileIdx {
  return Number.isInteger(idx) && idx >= 0 && idx < map.width * map.height && idx < map.tiles.length;
}

function tableFor(map: GameMap): NeighborTable {
  const { width, height } = map;
  const key = `${width}x${height}`;
  let table = neighborTables.get(key);
  if (table) return table;

  table = new Array<Int32Array>(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;
      const odd = row & 1;
      const adjacent = new Int32Array(6);
      adjacent.fill(-1);
      for (let dir = 0; dir < DIRECTIONS.length; dir++) {
        const [dc, dr] = DIRECTIONS[dir]!;
        const nextRow = row + dr;
        const nextCol = col + dc + (dr === 0 ? 0 : odd + (dr < 0 ? -1 : 0));
        if (nextCol >= 0 && nextCol < width && nextRow >= 0 && nextRow < height) {
          adjacent[dir] = nextRow * width + nextCol;
        }
      }
      table[idx] = adjacent;
    }
  }
  neighborTables.set(key, table);
  return table;
}

export function tileAt(map: GameMap, col: number, row: number): TileIdx {
  if (!Number.isInteger(col) || !Number.isInteger(row) ||
      col < 0 || row < 0 || col >= map.width || row >= map.height) return -1;
  const idx = row * map.width + col;
  return idx < map.tiles.length ? idx : -1;
}

export function neighbor(map: GameMap, idx: TileIdx, dir: number): TileIdx {
  if (!validTile(map, idx) || !Number.isInteger(dir) || dir < 0 || dir >= 6) return -1;
  return tableFor(map)[idx]![dir]!;
}

export function neighbors(map: GameMap, idx: TileIdx): TileIdx[] {
  if (!validTile(map, idx)) return [];
  const adjacent = tableFor(map)[idx]!;
  const result: TileIdx[] = [];
  for (const next of adjacent) if (next >= 0 && next < map.tiles.length) result.push(next);
  return result;
}

export function dirBetween(map: GameMap, a: TileIdx, b: TileIdx): number {
  if (!validTile(map, a) || !validTile(map, b)) return -1;
  return tableFor(map)[a]!.indexOf(b);
}

export function hexDistance(map: GameMap, a: TileIdx, b: TileIdx): number {
  if (!validTile(map, a) || !validTile(map, b)) return -1;
  const ar = Math.floor(a / map.width), br = Math.floor(b / map.width);
  const dq = a % map.width - (ar - (ar & 1)) / 2 - b % map.width + (br - (br & 1)) / 2;
  const dr = ar - br;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

export function tilesInRadius(map: GameMap, center: TileIdx, radius: number): TileIdx[] {
  if (!validTile(map, center) || !Number.isFinite(radius) || radius < 0) return [];
  const maxDistance = Math.floor(radius);
  const row = Math.floor(center / map.width);
  const q = center % map.width - (row - (row & 1)) / 2;
  const result: TileIdx[] = [];
  for (let r = Math.max(0, row - maxDistance); r <= Math.min(map.height - 1, row + maxDistance); r++) {
    const dr = r - row, offset = (r - (r & 1)) / 2;
    const minCol = Math.max(0, q + Math.max(-maxDistance, -dr - maxDistance) + offset);
    const maxCol = Math.min(map.width - 1, q + Math.min(maxDistance, -dr + maxDistance) + offset);
    for (let col = minCol; col <= maxCol; col++) {
      const idx = r * map.width + col;
      if (idx < map.tiles.length) result.push(idx);
    }
  }
  return result;
}

export function ring(map: GameMap, center: TileIdx, radius: number): TileIdx[] {
  if (!validTile(map, center) || !Number.isFinite(radius) || radius < 0) return [];
  const distance = Math.floor(radius);
  if (distance === 0) return [center];
  const row = Math.floor(center / map.width);
  const q = center % map.width - (row - (row & 1)) / 2;
  const result: TileIdx[] = [];
  for (let r = Math.max(0, row - distance); r <= Math.min(map.height - 1, row + distance); r++) {
    const dr = r - row, offset = (r - (r & 1)) / 2;
    const left = q + Math.max(-distance, -dr - distance) + offset;
    const right = q + Math.min(distance, -dr + distance) + offset;
    if (Math.abs(dr) === distance) {
      for (let col = Math.max(0, left); col <= Math.min(map.width - 1, right); col++) {
        const idx = r * map.width + col;
        if (idx < map.tiles.length) result.push(idx);
      }
    } else {
      if (left >= 0 && left < map.width && r * map.width + left < map.tiles.length) result.push(r * map.width + left);
      if (right !== left && right >= 0 && right < map.width && r * map.width + right < map.tiles.length) result.push(r * map.width + right);
    }
  }
  return result;
}

export function hexToWorld(col: number, row: number): { x: number; z: number } {
  return { x: HEX_WIDTH * (col + 0.5 * (row & 1)), z: 1.5 * HEX_SIZE * row };
}

export function tileWorld(map: GameMap, idx: TileIdx): { x: number; z: number } {
  if (!validTile(map, idx)) return { x: NaN, z: NaN };
  return hexToWorld(idx % map.width, Math.floor(idx / map.width));
}

export function worldToTile(map: GameMap, x: number, z: number): TileIdx {
  if (!Number.isFinite(x) || !Number.isFinite(z) || map.width <= 0 || map.height <= 0) return -1;
  const fractionalRow = z / (1.5 * HEX_SIZE);
  const fractionalCol = x / HEX_WIDTH - fractionalRow / 2;
  let cubeX = fractionalCol;
  let cubeZ = fractionalRow;
  let cubeY = -cubeX - cubeZ;
  let roundedX = Math.round(cubeX);
  let roundedY = Math.round(cubeY);
  let roundedZ = Math.round(cubeZ);
  const xError = Math.abs(roundedX - cubeX);
  const yError = Math.abs(roundedY - cubeY);
  const zError = Math.abs(roundedZ - cubeZ);
  if (xError > yError && xError > zError) roundedX = -roundedY - roundedZ;
  else if (yError > zError) roundedY = -roundedX - roundedZ;
  else roundedZ = -roundedX - roundedY;

  const row = roundedZ;
  const col = roundedX + (row - (row & 1)) / 2;
  return tileAt(map, col, row);
}
