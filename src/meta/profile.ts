// OWNER: Roguelite. STUB. Persistent player profile (meta progression) in localStorage.
import type { GameState } from '../sim/types';

export interface Profile {
  version: 1;
  unlocked: { leaders: string[]; doctrines: string[]; edicts: string[] };
  discovered: { doctrines: string[]; edicts: string[]; crises: string[]; wonders: string[] };
  /** highest ascension beaten per leader */
  ascension: Record<string, number>;
  stats: { runs: number; wins: number; bestScore: number; bestEra: number; totalTurns: number; doctrineWins: Record<string, number> };
  settings: { master: number; music: number; sfx: number; quality: 'low' | 'high'; haptics: boolean; fastAnimations: boolean; tutorialDone: boolean };
  dailies: Record<string, number>; // date -> best score
}

export function loadProfile(): Profile { throw new Error('not implemented'); }
export function saveProfile(p: Profile): void { void p; throw new Error('not implemented'); }
/** apply end-of-run progression; returns newly unlocked things for the summary screen */
export function recordRunEnd(state: GameState): { unlocks: { kind: string; id: string; name: string }[] } { void state; throw new Error('not implemented'); }
