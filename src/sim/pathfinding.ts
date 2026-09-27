// OWNER: MapGen. STUB.
import type { GameState, TileIdx, Unit } from './types';

/** movement points to enter `to` from `from` (Infinity if impassable for this unit). Rivers, roads, hills, features, embark. */
export function moveCost(state: GameState, unit: Unit, from: TileIdx, to: TileIdx): number { void state; void unit; void from; void to; throw new Error('not implemented'); }
/** A* path from unit.tile to target (excludes start, includes target), multi-turn; null if unreachable. Respects ZOC, 1UPT, visibility (unexplored tiles assumed passable cost 1). */
export function findPath(state: GameState, unit: Unit, target: TileIdx): TileIdx[] | null { void state; void unit; void target; throw new Error('not implemented'); }
/** tiles reachable THIS turn with remaining moves (excludes current tile) */
export function reachableTiles(state: GameState, unit: Unit): { tile: TileIdx; cost: number }[] { void state; void unit; throw new Error('not implemented'); }
/** how many turns to reach target (Infinity if unreachable) */
export function turnsToReach(state: GameState, unit: Unit, target: TileIdx): number { void state; void unit; void target; throw new Error('not implemented'); }
