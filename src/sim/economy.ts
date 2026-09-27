// OWNER: SimCore. STUB.
import type { Emit, GameState, PlayerId, ResourceId, TechId } from './types';

export function computeHappiness(state: GameState, pid: PlayerId): { value: number; lines: { label: string; amount: number }[] } { void state; void pid; throw new Error('not implemented'); }
export function goldPerTurn(state: GameState, pid: PlayerId): { income: number; maintenance: number; net: number } { void state; void pid; throw new Error('not implemented'); }
export function sciencePerTurn(state: GameState, pid: PlayerId): number { void state; void pid; throw new Error('not implemented'); }
export function culturePerTurn(state: GameState, pid: PlayerId): number { void state; void pid; throw new Error('not implemented'); }
export function techCost(state: GameState, pid: PlayerId, tech: TechId): number { void state; void pid; void tech; throw new Error('not implemented'); }
export function availableTechs(state: GameState, pid: PlayerId): TechId[] { void state; void pid; throw new Error('not implemented'); }
export function turnsToResearch(state: GameState, pid: PlayerId, tech: TechId): number { void state; void pid; void tech; throw new Error('not implemented'); }
export function grantTech(state: GameState, pid: PlayerId, tech: TechId, emit: Emit): void { void state; void pid; void tech; void emit; throw new Error('not implemented'); }
/** player has at least one improved source of this resource in territory */
export function hasResource(state: GameState, pid: PlayerId, res: ResourceId): boolean { void state; void pid; void res; throw new Error('not implemented'); }
export function addGold(state: GameState, pid: PlayerId, delta: number, reason: string, emit: Emit): void { void state; void pid; void delta; void reason; void emit; throw new Error('not implemented'); }
