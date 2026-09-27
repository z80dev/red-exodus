// OWNER: MapGen. STUB.
import type { GameMap, MapSize } from './types';

export const MAP_DIMS: Record<MapSize, { width: number; height: number }> = {
  small: { width: 22, height: 16 },
  standard: { width: 28, height: 20 },
  large: { width: 34, height: 24 },
};

/** Deterministic from seed. `players` = number of civs (human + rivals); fills map.starts[0..players-1]. */
export function generateMap(seed: string, size: MapSize, players: number): GameMap { void seed; void size; void players; throw new Error('not implemented'); }
