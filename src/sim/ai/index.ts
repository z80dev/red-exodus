// OWNER: CombatAI. STUB. AI acts through engine.applyPlayerAction (same validation as the human).
import type { Action, Emit, GameState, PlayerId } from '../types';

export function runAiTurn(state: GameState, pid: PlayerId, emit: Emit): void { void state; void pid; void emit; throw new Error('not implemented'); }
export function runBarbarians(state: GameState, emit: Emit): void { void state; void emit; throw new Error('not implemented'); }
/** bot for the HUMAN seat (headless balance sims + "auto" debug): returns the next action to take, or null when the turn is done (caller then dispatches endTurn). Must also handle roguelite phases (chapterStart, chronicle ack, council buys). */
export function autoplayNextAction(state: GameState): Action | null { void state; throw new Error('not implemented'); }
