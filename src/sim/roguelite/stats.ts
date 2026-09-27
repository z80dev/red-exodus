// Chapter/run statistics and small run-state helpers shared by the roguelite modules.
import type { ChapterStats, City, Emit, GameState, Player, RunState, SimEvent } from '../types';
import { BARBARIAN, HUMAN } from '../types';
import { progressOmen } from './omens';

export function emptyStats(): ChapterStats {
  return {
    culture: 0, science: 0, gold: 0, techs: 0, kills: 0, unitsLost: 0, citiesCaptured: 0, campsCleared: 0,
    popGrown: 0, citiesFounded: 0, improvements: 0, buildings: 0, wonders: 0, naturalWonders: 0, tilesExplored: 0,
    extra: {},
  };
}

export function humanPlayer(state: GameState): Player {
  return state.players.find((p) => p.id === HUMAN)!;
}

/** human cities in Chronicle order: capital first, then founding order */
export function humanCities(state: GameState): City[] {
  return Object.values(state.cities)
    .filter((c) => c.owner === HUMAN)
    .sort((a, b) => (a.isCapital === b.isCapital ? a.order - b.order : a.isCapital ? -1 : 1));
}

/** move `key` to the end of run.seen (recency order) */
export function markSeen(run: RunState, key: string): void {
  const i = run.seen.indexOf(key);
  if (i >= 0) run.seen.splice(i, 1);
  run.seen.push(key);
}

type NumericStat = Exclude<keyof ChapterStats, 'extra'>;

function bump(run: RunState, key: NumericStat, amount: number): void {
  run.stats[key] += amount;
  run.totals[key] += amount;
}

/** engine per-turn aggregates for the human (culture/science/gold generated) */
export function addStat(state: GameState, key: NumericStat, amount: number): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  bump(state.run, key, amount);
}

/** free-form counters (festival, bonusRenown, tradeRoutes, content-specific) into chapter + run totals */
export function addExtraStat(state: GameState, key: string, amount: number): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  const { stats, totals } = state.run;
  stats.extra[key] = (stats.extra[key] ?? 0) + amount;
  totals.extra[key] = (totals.extra[key] ?? 0) + amount;
}

/** called by the engine for every emitted event: stat tallies + omen progress (human only) */
export function trackEvent(state: GameState, ev: SimEvent, emit: Emit): void {
  const run = state.run;
  if (!run || state.gameOver) return;
  switch (ev.type) {
    case 'unitDied':
      if (ev.player === HUMAN) bump(run, 'unitsLost', 1);
      else if (ev.killer === HUMAN) {
        bump(run, 'kills', 1);
        if (ev.player === BARBARIAN) addExtraStat(state, 'barbarianKills', 1);
      }
      break;
    case 'cityCaptured':
      if (ev.to === HUMAN) bump(run, 'citiesCaptured', 1);
      break;
    case 'campCleared':
      if (ev.player === HUMAN) bump(run, 'campsCleared', 1);
      break;
    case 'cityGrew':
      if (ev.player === HUMAN) bump(run, 'popGrown', 1);
      break;
    case 'cityFounded':
      if (ev.player === HUMAN) bump(run, 'citiesFounded', 1);
      break;
    case 'improvementBuilt':
      if (ev.player === HUMAN) bump(run, 'improvements', 1);
      break;
    case 'buildingBuilt':
      if (ev.player === HUMAN && ev.building !== 'palace') bump(run, 'buildings', 1);
      break;
    case 'wonderBuilt':
      if (ev.player === HUMAN) {
        bump(run, 'wonders', 1);
        markSeen(run, `wonder:${ev.wonder}`);
      }
      break;
    case 'naturalWonderFound':
      if (ev.player === HUMAN) bump(run, 'naturalWonders', 1);
      break;
    case 'tilesRevealed':
      if (ev.player === HUMAN) bump(run, 'tilesExplored', ev.tiles.length);
      break;
    case 'techResearched':
      if (ev.player === HUMAN) bump(run, 'techs', 1);
      break;
    default:
      break;
  }
  progressOmen(state, ev, emit);
}
