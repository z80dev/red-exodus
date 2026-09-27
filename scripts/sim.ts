#!/usr/bin/env bun
import { LEADERS, TECHS } from '../src/content';
import { autoplayNextAction } from '../src/sim/ai';
import { applyAction, createGame } from '../src/sim/engine';
import type { Action, GameState, MapSize } from '../src/sim/types';
import { HUMAN } from '../src/sim/types';

interface Options { runs: number; size: MapSize; ascension: number; seed: string | null; verbose: boolean }
function parseArgs(args: string[]): Options {
  const result: Options = { runs: 20, size: 'standard', ascension: 0, seed: null, verbose: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--verbose') result.verbose = true;
    else if (arg === '--runs') result.runs = Number(args[++i]);
    else if (arg === '--size') result.size = args[++i] as MapSize;
    else if (arg === '--ascension') result.ascension = Number(args[++i]);
    else if (arg === '--seed') result.seed = args[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(result.runs) || result.runs < 1 || !['small', 'standard', 'large'].includes(result.size) ||
    !Number.isInteger(result.ascension) || result.ascension < 0 || result.ascension > 7) throw new Error('Invalid --runs, --size or --ascension');
  return result;
}
function seatSummary(state: GameState, id: number): string {
  const cities = Object.values(state.cities).filter(c => c.owner === id);
  const pop = cities.reduce((n, c) => n + c.pop, 0);
  const player = state.players.find(p => p.id === id);
  return `${cities.length}c/${pop}p/${player?.techs.length ?? 0}t`;
}
function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function fallback(state: GameState, action: Action): Action | null {
  if ('unitId' in action && typeof action.unitId === 'number') {
    const unit = state.units[action.unitId];
    if (unit && unit.moves > 0) return { type: 'skipUnit', unitId: unit.id };
  }
  return state.run.phase === 'playing' ? { type: 'endTurn' } : null;
}

const opts = parseArgs(Bun.argv.slice(2));
const ratios: number[][] = [[], [], [], [], [], []];
const wins: number[] = [];
const msTurn: number[] = [];
const leaders = Object.keys(LEADERS);
if (!leaders.length) throw new Error('No leader content registered');
console.log(`AEONS balance · ${opts.runs} runs · ${opts.size} · ascension ${opts.ascension}`);
for (let run = 0; run < opts.runs; run++) {
  const seed = opts.seed ? (opts.runs === 1 ? opts.seed : `${opts.seed}-${run + 1}`) : `BALANCE-${run + 1}`;
  const { state } = createGame({ seed, leaderId: leaders[0], ascension: opts.ascension, mapSize: opts.size,
    rivals: 3, tutorial: false, daily: false });
  let actions = 0;
  let stalled = false;
  let wars = 0;
  let clashes = 0;
  let last = '';
  let repeated = 0;
  const start = performance.now();
  while (!state.gameOver && state.run.phase !== 'victory' && state.run.phase !== 'defeat' && state.turn < 200 && actions < 40000) {
    let action = autoplayNextAction(state) ?? (state.run.phase === 'playing' ? { type: 'endTurn' } as const : null);
    if (!action) { stalled = true; break; }
    const key = JSON.stringify(action);
    repeated = key === last ? repeated + 1 : 0;
    last = key;
    if (repeated >= 2) { action = fallback(state, action); repeated = 0; if (!action) { stalled = true; break; } }
    const beforeTurn = state.turn;
    const result = applyAction(state, action);
    for (const event of result.events) {
      if (event.type === 'warDeclared') wars++;
      if (event.type === 'combat') clashes++;
    }
    if (!result.ok) {
      if (opts.verbose) console.log(`  rejected t${state.turn} ${JSON.stringify(action)}: ${result.error}`);
      const alternative = fallback(state, action);
      if (!alternative) { stalled = true; break; }
      const recovery = applyAction(state, alternative);
      if (!recovery.ok) { stalled = true; break; }
      for (const event of recovery.events) {
        if (event.type === 'warDeclared') wars++;
        if (event.type === 'combat') clashes++;
      }
    }
    actions++;
    if (opts.verbose && beforeTurn !== state.turn) console.log(`  t${state.turn} era ${state.run.era + 1} human ${seatSummary(state, HUMAN)} | AI ${state.players.filter(p => p.id !== HUMAN && p.id !== 99).map(p => seatSummary(state, p.id)).join(' ')}`);
  }
  const elapsed = performance.now() - start;
  const result = state.run.phase === 'victory' ? 'WIN' : state.run.phase === 'defeat' ? 'LOSS' : stalled ? 'STALLED' : 'TURN CAP';
  wins.push(result === 'WIN' ? 1 : 0);
  msTurn.push(elapsed / Math.max(1, state.turn));
  for (const entry of state.run.history) if (entry.target > 0 && entry.era < ratios.length) ratios[entry.era].push(entry.score / entry.target);
  console.log(`${String(run + 1).padStart(2)} ${seed.padEnd(17)} ${result.padEnd(8)} turn ${String(state.turn).padStart(3)} era ${Math.min(state.run.era + 1, 6)} · human ${seatSummary(state, HUMAN)} vs AI ${state.players.filter(p => p.id !== HUMAN && p.id !== 99).map(p => seatSummary(state, p.id)).join(', ')} · ${wars} wars/${clashes} clashes · ${msTurn.at(-1)!.toFixed(1)}ms/turn`);
  console.log(`   chapters ${state.run.history.map(h => `E${h.era + 1}.${h.chapter + 1} ${Math.round(h.score)}/${Math.round(h.target)}${h.passed ? '✓' : '✗'}`).join('  ') || 'none'}`);
  if (opts.verbose) console.log(`   tech era ${Math.max(0, ...state.players[0].techs.map(t => TECHS[t]?.era ?? 0)) + 1}; ${actions} actions; ${elapsed.toFixed(0)}ms`);
}
console.log(`Win rate ${(100 * wins.reduce((a, b) => a + b, 0) / opts.runs).toFixed(1)}% · median ${median(msTurn).toFixed(1)}ms/turn`);
console.log(`Median chapter score/target: ${ratios.map((r, i) => `E${i + 1} ${r.length ? median(r).toFixed(2) + '×' : '—'}`).join(' · ')}`);
