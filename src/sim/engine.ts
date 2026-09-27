// OWNER: SimCore. STUB. The only entry point the game layer uses.
import type { Action, ActionResult, Emit, GameConfig, GameState, PlayerId, SimEvent } from './types';

/** Build a brand-new game (map, players, starting units, run state). Returns events for the opening. */
export function createGame(config: GameConfig): { state: GameState; events: SimEvent[] } { void config; throw new Error('not implemented'); }
/** Human action. Mutates state in place. endTurn runs AIs, barbarians, turn processing, roguelite clock. */
export function applyAction(state: GameState, action: Action): ActionResult { void state; void action; throw new Error('not implemented'); }
/** Any player's action (AI uses this). Returns error or null. */
export function applyPlayerAction(state: GameState, pid: PlayerId, action: Action, emit: Emit): string | null { void state; void pid; void action; void emit; throw new Error('not implemented'); }
