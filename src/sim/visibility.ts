// OWNER: MapGen. STUB.
import type { Emit, GameState, PlayerId, TileIdx } from './types';

/** recompute vis for player: downgrade 2→1, then mark 2 around own units (vision, hills/mountains/forests LOS) & cities & territory. Emits tilesRevealed for newly explored tiles and naturalWonderFound. */
export function recomputeVisibility(state: GameState, pid: PlayerId, emit: Emit): void { void state; void pid; void emit; throw new Error('not implemented'); }
export function revealArea(state: GameState, pid: PlayerId, center: TileIdx, radius: number, emit: Emit): void { void state; void pid; void center; void radius; void emit; throw new Error('not implemented'); }
