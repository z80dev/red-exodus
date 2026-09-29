#!/usr/bin/env bun
import { DOCTRINES, LEADERS, TECHS } from '../src/content';
import { autoplayNextAction } from '../src/sim/ai';
import { applyAction, createGame } from '../src/sim/engine';
import { councilBuyError, packPickError } from '../src/sim/roguelite/council';
import type { Action, ChronicleResult, GameState, MapSize, SimEvent } from '../src/sim/types';
import { HUMAN } from '../src/sim/types';

interface Options {
  runs: number; size: MapSize; ascension: number; seed: string | null; verbose: boolean;
  noDoctrines: boolean; jsonPath: string | null;
}
interface DoctrineContribution {
  id: string; name: string; renown: number; splendor: number; legacyContribution: number; scoreShare: number;
}
interface ChapterRecord {
  era: number; chapter: number; crisis: string | null; turn: number; score: number; target: number; ratio: number; passed: boolean;
  renown: number; splendor: number; influenceEarned: { label: string; amount: number }[];
  topDoctrine: DoctrineContribution | null; doctrineContributions: DoctrineContribution[];
}
interface RunRecord {
  seed: string; result: string; turn: number; era: number; chapter: number; score: number; target: number;
  ratio: number; renown: number; splendor: number; topDoctrine: ChapterRecord['topDoctrine'];
  doctrineContributions: DoctrineContribution[];
  influence: { earned: number; spent: number }; shop: {
    councils: number; purchases: number; doctrinePurchases: number; packs: number; rerolls: number; edictsUsed: number;
  };
  cities: number; population: number; techs: number;
  rivals: { id: number; name: string; cities: number; population: number; techs: number }[];
  wars: number; clashes: number; capitalLost: boolean; defeatCause: string | null;
  wallTimeMs: number; chapters: ChapterRecord[];
}
function parseArgs(args: string[]): Options {
  const result: Options = {
    runs: 20, size: 'standard', ascension: 0, seed: null, verbose: false, noDoctrines: false, jsonPath: null,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: bun scripts/sim.ts [--runs N] [--size small|standard|large] [--ascension 0..8] [--seed S] [--verbose] [--no-doctrines] [--json PATH]');
      process.exit(0);
    } else if (arg === '--verbose') result.verbose = true;
    else if (arg === '--no-doctrines') result.noDoctrines = true;
    else if (arg === '--runs') result.runs = Number(args[++i]);
    else if (arg === '--size') result.size = args[++i] as MapSize;
    else if (arg === '--ascension') result.ascension = Number(args[++i]);
    else if (arg === '--seed') result.seed = args[++i];
    else if (arg === '--json') result.jsonPath = args[++i] ?? null;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(result.runs) || result.runs < 1 || !['small', 'standard', 'large'].includes(result.size) ||
    !Number.isInteger(result.ascension) || result.ascension < 0 || result.ascension > 8 ||
    (result.seed !== null && !result.seed) || (args.includes('--json') && !result.jsonPath))
    throw new Error('Invalid --runs, --size, --ascension, --seed or --json');
  return result;
}
function seatSummary(state: GameState, id: number): string {
  const cities = Object.values(state.cities).filter(c => c.owner === id);
  const pop = cities.reduce((n, c) => n + c.pop, 0);
  const player = state.players.find(p => p.id === id);
  return `${cities.length}c/${pop}p/${player?.techs.length ?? 0}t`;
}
function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}
function fallback(state: GameState, action: Action): Action | null {
  if ('unitId' in action && typeof action.unitId === 'number') {
    const unit = state.units[action.unitId];
    if (unit && unit.moves > 0) return { type: 'skipUnit', unitId: unit.id };
  }
  return state.run.phase === 'playing' ? { type: 'endTurn' } : null;
}
function noDoctrineAction(state: GameState, action: Action): Action {
  const council = state.run.council;
  if (action.type === 'packPick' && council?.pack && action.index !== null) {
    const picked = council.pack.options[action.index];
    if (picked?.kind === 'doctrine') {
      const index = council.pack.options.findIndex((item, i) => item.kind !== 'doctrine' && packPickError(state, i) === null);
      return { type: 'packPick', index: index < 0 ? null : index };
    }
  }
  if (action.type === 'councilBuy' && council) {
    const selected = council.items[action.slot];
    if (selected?.kind === 'doctrine' || selected?.kind === 'pack' && selected.pack === 'doctrine') {
      const slot = council.items.findIndex((item, i) => item && item.kind !== 'doctrine' &&
        !(item.kind === 'pack' && item.pack === 'doctrine') && councilBuyError(state, i) === null &&
        (item.kind === 'scroll' || item.kind === 'reform' || item.kind === 'edict' ||
          item.kind === 'pack' && item.pack !== 'doctrine'));
      return slot >= 0 ? { type: 'councilBuy', slot } : { type: 'leaveCouncil' };
    }
  }
  return action;
}
function chapterRecord(result: ChronicleResult, doctrineIds: Map<string, string>, turn: number, crisis: string | null): ChapterRecord {
  const contribution = new Map<string, { id: string; renown: number; splendor: number; legacy: number }>();
  let renown = 0;
  let splendor = 0;
  for (const step of result.steps) {
    const before = renown * splendor;
    renown = step.renown;
    splendor = step.splendor;
    if (!step.ref || !['doctrine', 'edition'].includes(step.source)) continue;
    const id = doctrineIds.get(step.ref);
    if (!id) continue;
    const current = contribution.get(id) ?? { id, renown: 0, splendor: 0, legacy: 0 };
    current.renown += step.renownAdd ?? 0;
    current.splendor += step.splendorAdd ?? 0;
    current.legacy += renown * splendor - before;
    contribution.set(id, current);
  }
  const doctrineContributions = [...contribution.values()]
    .sort((a, b) => b.legacy - a.legacy || a.id.localeCompare(b.id))
    .map(item => ({
      id: item.id, name: DOCTRINES[item.id]?.name ?? item.id, renown: item.renown, splendor: item.splendor,
      legacyContribution: item.legacy, scoreShare: result.score ? item.legacy / result.score : 0,
    }));
  return {
    era: result.era + 1, chapter: result.chapter + 1, crisis: result.chapter === 2 ? crisis : null,
    turn, score: result.score, target: result.target,
    ratio: result.target > 0 ? result.score / result.target : 0, passed: result.passed,
    renown: result.renown, splendor: result.splendor, influenceEarned: result.influenceEarned,
    topDoctrine: doctrineContributions[0] ?? null, doctrineContributions,
  };
}

const opts = parseArgs(Bun.argv.slice(2));
if (opts.jsonPath && await Bun.file(opts.jsonPath).exists()) throw new Error(`Refusing to overwrite existing JSON file: ${opts.jsonPath}`);
const records: RunRecord[] = [];
const wins: number[] = [];
const msTurn: number[] = [];
const leaders = Object.keys(LEADERS);
if (!leaders.length) throw new Error('No leader content registered');
console.log(`AEONS balance · ${opts.runs} runs · ${opts.size} · ascension ${opts.ascension}${opts.noDoctrines ? ' · no doctrines' : ''}`);
for (let run = 0; run < opts.runs; run++) {
  const seed = opts.seed ? (opts.runs === 1 ? opts.seed : `${opts.seed}-${run + 1}`) : `BALANCE-${run + 1}`;
  const { state } = createGame({ seed, leaderId: leaders[0], ascension: opts.ascension, mapSize: opts.size,
    rivals: 3, tutorial: false, daily: false });
  let actions = 0;
  let stalled = false;
  let wars = 0;
  let clashes = 0;
  const shop = { councils: 0, purchases: 0, doctrinePurchases: 0, packs: 0, rerolls: 0, edictsUsed: 0 };
  let influenceEarned = 0;
  let influenceSpent = 0;
  let capitalLost = false;
  const player = state.players.find(p => p.id === HUMAN)!;
  const capitalId = player.capitalId;
  let last = '';
  let repeated = 0;
  const doctrineIds = new Map<string, string>(state.run.doctrines.map(d => [String(d.uid), d.id]));
  const chronicleRecords: ChapterRecord[] = [];
  const recordEvents = (events: SimEvent[]) => {
    const gained: number[] = [];
    for (const event of events) {
      if (event.type === 'warDeclared') wars++;
      if (event.type === 'combat') clashes++;
      if (event.type === 'influenceChanged') {
        if (event.delta > 0) influenceEarned += event.delta;
        else influenceSpent -= event.delta;
      }
      if (event.type === 'doctrineGained') {
        doctrineIds.set(String(event.uid), event.id);
        gained.push(event.uid);
      }
      if (event.type === 'chronicle') chronicleRecords.push(chapterRecord(event.result, doctrineIds, state.turn, state.run.crisis));
      if (event.type === 'edictUsed') shop.edictsUsed++;
    }
    return gained;
  };
  const removeGrantedDoctrines = (gained: number[]) => {
    if (!opts.noDoctrines) return;
    for (const uid of gained) {
      if (!state.run.doctrines.some(d => d.uid === uid)) continue;
      const influence = state.run.influence;
      const removed = applyAction(state, { type: 'sellDoctrine', uid });
      if (removed.ok) state.run.influence = influence;
    }
  };
  const apply = (action: Action) => {
    const councilItem = action.type === 'councilBuy' ? state.run.council?.items[action.slot] : null;
    const packChoice = action.type === 'packPick' && action.index !== null
      ? state.run.council?.pack?.options[action.index] : null;
    const result = applyAction(state, action);
    const gained = recordEvents(result.events);
    removeGrantedDoctrines(gained);
    if (result.ok) {
      if (action.type === 'ackChronicle' && state.run.phase === 'council') shop.councils++;
      if (action.type === 'councilBuy' && councilItem) {
        shop.purchases++;
        if (councilItem.kind === 'doctrine') shop.doctrinePurchases++;
        if (councilItem.kind === 'pack') shop.packs++;
      }
      if (action.type === 'packPick' && packChoice?.kind === 'doctrine') shop.doctrinePurchases++;
      if (action.type === 'councilReroll') shop.rerolls++;
    }
    if (capitalId !== null && (!state.cities[capitalId] || state.cities[capitalId].owner !== HUMAN)) capitalLost = true;
    return result;
  };
  if (opts.noDoctrines) {
    if (state.run.phase === 'crisisReveal') {
      const acknowledged = apply({ type: 'ackCrisis' });
      if (!acknowledged.ok) throw new Error(`Unable to start no-doctrine run: ${acknowledged.error}`);
    }
    for (const doctrine of [...state.run.doctrines]) {
      const influence = state.run.influence;
      const removed = applyAction(state, { type: 'sellDoctrine', uid: doctrine.uid });
      if (!removed.ok) throw new Error(`Unable to remove starter doctrine ${doctrine.id}: ${removed.error}`);
      state.run.influence = influence;
    }
  }
  const start = performance.now();
  while (!state.gameOver && state.run.phase !== 'victory' && state.run.phase !== 'defeat' && state.turn < 200 && actions < 40000) {
    let action = autoplayNextAction(state) ?? (state.run.phase === 'playing' ? { type: 'endTurn' } as const : null);
    if (!action) { stalled = true; break; }
    if (opts.noDoctrines) action = noDoctrineAction(state, action);
    const key = JSON.stringify(action);
    repeated = key === last ? repeated + 1 : 0;
    last = key;
    if (repeated >= 2) { action = fallback(state, action); repeated = 0; if (!action) { stalled = true; break; } }
    const beforeTurn = state.turn;
    const result = apply(action);
    if (!result.ok) {
      if (opts.verbose) console.log(`  rejected t${state.turn} ${JSON.stringify(action)}: ${result.error}`);
      const alternative = fallback(state, action);
      if (!alternative) { stalled = true; break; }
      const recovery = apply(alternative);
      if (!recovery.ok) { stalled = true; break; }
    }
    actions++;
    if (opts.verbose && beforeTurn !== state.turn) console.log(`  t${state.turn} era ${state.run.era + 1} human ${seatSummary(state, HUMAN)} | AI ${state.players.filter(p => p.id !== HUMAN && p.id !== 99).map(p => seatSummary(state, p.id)).join(' ')}`);
  }
  const elapsed = performance.now() - start;
  const result = state.run.phase === 'victory' ? 'WIN' : state.run.phase === 'defeat' ? 'LOSS' : stalled ? 'STALLED' : 'TURN CAP';
  const chapters = chronicleRecords;
  const lastChapter = chapters.at(-1);
  const humanCities = Object.values(state.cities).filter(c => c.owner === HUMAN);
  const contributionTotals = new Map<string, { id: string; name: string; renown: number; splendor: number; legacyContribution: number }>();
  for (const chapter of chapters) for (const contribution of chapter.doctrineContributions) {
    const total = contributionTotals.get(contribution.id) ?? {
      id: contribution.id, name: contribution.name, renown: 0, splendor: 0, legacyContribution: 0,
    };
    total.renown += contribution.renown;
    total.splendor += contribution.splendor;
    total.legacyContribution += contribution.legacyContribution;
    contributionTotals.set(contribution.id, total);
  }
  const totalScore = chapters.reduce((sum, chapter) => sum + chapter.score, 0);
  const doctrineContributions = [...contributionTotals.values()]
    .map(item => ({ ...item, scoreShare: totalScore ? item.legacyContribution / totalScore : 0 }))
    .sort((a, b) => b.legacyContribution - a.legacyContribution || a.id.localeCompare(b.id));
  const record: RunRecord = {
    seed, result, turn: state.turn, era: state.run.era + 1, chapter: state.run.chapter + 1,
    score: lastChapter?.score ?? 0, target: lastChapter?.target ?? 0, ratio: lastChapter?.ratio ?? 0,
    renown: lastChapter?.renown ?? 0, splendor: lastChapter?.splendor ?? 0,
    topDoctrine: lastChapter?.topDoctrine ?? null, doctrineContributions,
    influence: { earned: influenceEarned, spent: influenceSpent }, shop,
    cities: humanCities.length, population: humanCities.reduce((sum, city) => sum + city.pop, 0),
    techs: player.techs.length,
    rivals: state.players.filter(p => p.id !== HUMAN && p.id !== 99).map(p => {
      const cities = Object.values(state.cities).filter(c => c.owner === p.id);
      return { id: p.id, name: p.name, cities: cities.length, population: cities.reduce((sum, city) => sum + city.pop, 0), techs: p.techs.length };
    }),
    wars, clashes, capitalLost, defeatCause: state.run.defeatReason, wallTimeMs: elapsed, chapters,
  };
  records.push(record);
  wins.push(result === 'WIN' ? 1 : 0);
  msTurn.push(elapsed / Math.max(1, state.turn));
  console.log(`${String(run + 1).padStart(2)} ${seed.padEnd(17)} ${result.padEnd(8)} turn ${String(state.turn).padStart(3)} era ${Math.min(state.run.era + 1, 6)} · human ${seatSummary(state, HUMAN)} vs AI ${state.players.filter(p => p.id !== HUMAN && p.id !== 99).map(p => seatSummary(state, p.id)).join(', ')} · ${wars} wars/${clashes} clashes · ${(elapsed / Math.max(1, state.turn)).toFixed(1)}ms/turn`);
  console.log(`   chapters ${chapters.map(h => `E${h.era}.${h.chapter} ${Math.round(h.score)}/${Math.round(h.target)}${h.passed ? '✓' : '✗'}`).join('  ') || 'none'}`);
  if (opts.verbose) console.log(`   tech era ${Math.max(0, ...player.techs.map(t => TECHS[t]?.era ?? 0)) + 1}; ${actions} actions; ${elapsed.toFixed(0)}ms`);
}
console.log(`Win rate ${(100 * wins.reduce((a, b) => a + b, 0) / opts.runs).toFixed(1)}% · median ${quantile(msTurn, 0.5).toFixed(1)}ms/turn`);
console.log(`Median chapter score/target: ${[0, 1, 2, 3, 4, 5].map(era => {
  const values = records.flatMap(r => r.chapters.filter(c => c.era === era + 1).map(c => c.ratio));
  return `E${era + 1} ${values.length ? quantile(values, 0.5).toFixed(2) + '×' : '—'}`;
}).join(' · ')}`);
const aggregate = Array.from({ length: 6 }, (_, era) => Array.from({ length: 3 }, (_, chapter) => {
  const entries = records.flatMap(r => r.chapters.filter(c => c.era === era + 1 && c.chapter === chapter + 1));
  const values = entries.map(c => c.ratio);
  return {
    era: era + 1, chapter: chapter + 1, count: entries.length,
    medianRatio: quantile(values, 0.5), p25Ratio: quantile(values, 0.25), p75Ratio: quantile(values, 0.75),
    passRate: entries.length ? entries.filter(c => c.passed).length / entries.length : 0,
  };
})).flat();
console.log('Era×chapter ratios (median [p25, p75], pass):');
for (const row of aggregate.filter(row => row.count))
  console.log(`  E${row.era}.${row.chapter} ${row.medianRatio.toFixed(2)}× [${row.p25Ratio.toFixed(2)}, ${row.p75Ratio.toFixed(2)}] · ${(row.passRate * 100).toFixed(1)}% (${row.count})`);
if (opts.jsonPath) {
  await Bun.write(opts.jsonPath, `${JSON.stringify({
    settings: { runs: opts.runs, size: opts.size, ascension: opts.ascension, noDoctrines: opts.noDoctrines, seed: opts.seed },
    runs: records, eraChapter: aggregate,
  }, null, 2)}\n`);
  console.log(`JSON written to ${opts.jsonPath}`);
}
