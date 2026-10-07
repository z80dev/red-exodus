// OWNER: SimMechanics. Shared helpers for sim tests (not imported by game code).
import type { Action, GameState } from './types';
import { HUMAN } from './types';
import { applyAction, createGame } from './engine';
import { autoplayNextAction } from './ai';
import { refreshAllCities } from './cities';

export function newGame(seed: string, rivals = 3): GameState {
  const leaderId = 'brazil';
  return createGame({ seed, leaderId, ascension: 0, mapSize: 'standard', rivals, tutorial: false, daily: false }).state;
}

/** acknowledge the opening crisis reveal & chapter start so map actions are legal */
export function startPlaying(state: GameState): void {
  if (state.run.phase === 'crisisReveal') applyAction(state, { type: 'ackCrisis' });
  if (state.run.phase === 'chapterStart') applyAction(state, { type: 'chooseChapterStart', focus: 'prosperity', omen: null });
}

/**
 * A playing game whose human has no rule-bending effects (no leader hooks, doctrines, crisis, ascension),
 * so formulas can be checked against their raw tunables. Returns the state and the human's Ark Hab (capital) id.
 */
export function plainGame(seed: string): { state: GameState; cityId: number } {
  const state = newGame(seed);
  startPlaying(state);
  state.players[HUMAN].leaderId = '__plain__';
  state.run.doctrines = [];
  state.run.reforms = [];
  state.run.crisis = null;
  state.run.crisisActive = false;
  state.run.darkAge = false;
  state.run.ascension = -1;
  state.storms = [];
  refreshAllCities(state, HUMAN);
  const cityId = state.players[HUMAN].capitalId;
  if (cityId == null) throw new Error('no Ark Hab at landfall');
  return { state, cityId };
}

/**
 * Drive the human seat with the autoplay bot until `turns` turns have passed (or the run ends).
 * A rejected or no-progress bot action skips the unit (or ends the turn) so a bot quirk can't stall the run.
 * Returns every dispatched action so a run can be replayed exactly.
 */
export function autoplay(state: GameState, turns: number, onEndTurn?: (ms: number) => void): Action[] {
  const log: Action[] = [];
  const until = state.turn + turns;
  let lastKey = '';
  let repeats = 0;
  let guard = 0;
  const dispatch = (a: Action) => {
    log.push(a);
    const t0 = performance.now();
    const r = applyAction(state, a);
    if (a.type === 'endTurn' && r.ok) onEndTurn?.(performance.now() - t0);
    return r;
  };
  while (state.turn < until && !state.gameOver && guard++ < 50_000) {
    const a = autoplayNextAction(state) ?? { type: 'endTurn' as const };
    const key = JSON.stringify(a);
    repeats = key === lastKey ? repeats + 1 : 0;
    lastKey = key;
    const r = repeats > 2 ? { ok: false } : dispatch(a);
    if (r.ok) continue;
    if ('unitId' in a && a.unitId != null) dispatch({ type: 'skipUnit', unitId: a.unitId });
    else if (state.run.phase === 'playing') dispatch({ type: 'endTurn' });
    else break;
  }
  return log;
}

/** replay a recorded action list verbatim */
export function replay(state: GameState, actions: Action[]): void {
  for (const a of actions) applyAction(state, a);
}

/** paths of every non-finite number in a JSON-like value */
export function findNonFinite(v: unknown, path = '$', out: string[] = []): string[] {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(path);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => findNonFinite(x, `${path}[${i}]`, out));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) findNonFinite(x, `${path}.${k}`, out);
  }
  return out;
}
