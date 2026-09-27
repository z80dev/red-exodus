// OWNER: CombatAI. STUB. 1UPT: at most one military + one civilian unit per tile.
import type { UnitDef } from './defs';
import type { Emit, GameState, PlayerId, TileIdx, Unit, UnitId, UnitTypeId } from './types';

export function unitDef(type: UnitTypeId): UnitDef { void type; throw new Error('not implemented'); }
export function isCivilian(type: UnitTypeId): boolean { void type; throw new Error('not implemented'); }
/** place at tile, or nearest free valid tile; emits unitCreated */
export function createUnit(state: GameState, owner: PlayerId, type: UnitTypeId, tile: TileIdx, emit: Emit): Unit | null { void state; void owner; void type; void tile; void emit; throw new Error('not implemented'); }
export function removeUnit(state: GameState, unitId: UnitId, emit: Emit, killer?: PlayerId): void { void state; void unitId; void emit; void killer; throw new Error('not implemented'); }
export function unitsAt(state: GameState, tile: TileIdx): Unit[] { void state; void tile; throw new Error('not implemented'); }
export function militaryAt(state: GameState, tile: TileIdx): Unit | null { void state; void tile; throw new Error('not implemented'); }
export function maxMoves(state: GameState, unit: Unit): number { void state; void unit; throw new Error('not implemented'); }
export function visionOf(state: GameState, unit: Unit): number { void state; void unit; throw new Error('not implemented'); }
/** move along path toward target this turn; handles ruins, camps (civilians can't), captures of civilians, reveal. Sets goto order if target not reached. */
export function moveUnitTo(state: GameState, unit: Unit, target: TileIdx, emit: Emit): string | null { void state; void unit; void target; void emit; throw new Error('not implemented'); }
/** start-of-turn for player's units: reset moves/attacks, heal, fortify turns, continue goto/explore orders */
export function unitsTurnStart(state: GameState, pid: PlayerId, emit: Emit): void { void state; void pid; void emit; throw new Error('not implemented'); }
export function grantXp(state: GameState, unit: Unit, xp: number, emit: Emit): void { void state; void unit; void xp; void emit; throw new Error('not implemented'); }
export function applyPromotion(state: GameState, unit: Unit, promotion: string, emit: Emit): string | null { void state; void unit; void promotion; void emit; throw new Error('not implemented'); }
export function upgradeInfo(state: GameState, unit: Unit): { to: UnitTypeId; cost: number; error: string | null } | null { void state; void unit; throw new Error('not implemented'); }
export function upgradeUnit(state: GameState, unit: Unit, emit: Emit): string | null { void state; void unit; void emit; throw new Error('not implemented'); }
export function pillage(state: GameState, unit: Unit, emit: Emit): string | null { void state; void unit; void emit; throw new Error('not implemented'); }
/** units of player needing orders this turn (moves left, no order, not fortified/sleeping, or pending promotion) */
export function idleUnits(state: GameState, pid: PlayerId): Unit[] { void state; void pid; throw new Error('not implemented'); }
