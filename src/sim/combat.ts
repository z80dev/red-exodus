// OWNER: CombatAI. STUB. Civ5-like: damage = 30 * exp(0.04 * (S_att - S_def) scaled) ± rng; HP 100.
import type { CombatMod } from './defs';
import type { City, Emit, GameState, TileIdx, Unit } from './types';

export interface CombatPreview {
  ranged: boolean;
  attackerStrength: number; // effective after mods
  defenderStrength: number;
  attackMods: CombatMod[];
  defenseMods: CombatMod[];
  /** expected damage (before rng) */
  dmgToAttacker: number;
  dmgToDefender: number;
  defenderKillLikely: boolean;
  attackerDeathLikely: boolean;
  /** after a won melee vs city at 0 hp → capture */
  captures: boolean;
}

export function attackTargets(state: GameState, unit: Unit): TileIdx[] { void state; void unit; throw new Error('not implemented'); }
export function previewAttack(state: GameState, unit: Unit, target: TileIdx): CombatPreview | null { void state; void unit; void target; throw new Error('not implemented'); }
export function resolveAttack(state: GameState, unit: Unit, target: TileIdx, emit: Emit): string | null { void state; void unit; void target; void emit; throw new Error('not implemented'); }
export function cityStrikeTargets(state: GameState, city: City): TileIdx[] { void state; void city; throw new Error('not implemented'); }
export function previewCityStrike(state: GameState, city: City, target: TileIdx): CombatPreview | null { void state; void city; void target; throw new Error('not implemented'); }
export function resolveCityStrike(state: GameState, city: City, target: TileIdx, emit: Emit): string | null { void state; void city; void target; void emit; throw new Error('not implemented'); }
/** city combat strength (for UI) */
export function cityStrength(state: GameState, city: City): number { void state; void city; throw new Error('not implemented'); }
