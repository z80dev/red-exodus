#!/usr/bin/env bun
import { BUILDINGS, DOCTRINES, LEADERS, TECHS, UNITS } from '../src/content';
import { autoplayNextAction } from '../src/sim/ai';
import { availableTechs } from '../src/sim/economy';
import { applyAction, createGame } from '../src/sim/engine';
import { hexDistance } from '../src/sim/hex';
import { canOrbitalDrop, dropPrice } from '../src/sim/mars';
import { councilBuyError, doctrinePrice, doctrineSlotsUsed, packPickError } from '../src/sim/roguelite/council';
import { CHAPTERS_PER_ERA, CRISIS_CHAPTER } from '../src/sim/roguelite/constants';
import { nextAttention, productionOptions } from '../src/sim/selectors';
import type { ProductionOption } from '../src/sim/selectors';
import type { Action, ChapterStats, ChronicleResult, GameState, MapSize, PillarId, SimEvent } from '../src/sim/types';
import { BARBARIAN, HUMAN, PILLARS } from '../src/sim/types';

type Policy = 'bot' | 'guided' | 'passive';
interface Options {
  runs: number; size: MapSize; ascension: number; seed: string | null; verbose: boolean;
  noDoctrines: boolean; jsonPath: string | null; policy: Policy; focus: PillarId | null;
  /** leader id, 'random' (a different nation each run) or null (the first nation, USA) */
  nation: string | null;
}
interface DoctrineContribution {
  id: string; name: string; renown: number; splendor: number; legacyContribution: number; scoreShare: number;
}
interface ChapterRecord {
  era: number; chapter: number; crisis: string | null; turn: number; score: number; target: number; ratio: number; passed: boolean;
  renown: number; splendor: number; influenceEarned: { label: string; amount: number }[];
  topDoctrine: DoctrineContribution | null; doctrineContributions: DoctrineContribution[];
  /** Focus pillar and Points / Multiplier added per source (pillar lines by label; other steps by source kind) */
  focus: string; points: Record<string, number>; multiplier: Record<string, number>; stats: ChapterStats;
}
interface RunRecord {
  seed: string; result: string; turn: number; era: number; chapter: number; score: number; target: number;
  ratio: number; renown: number; splendor: number; topDoctrine: ChapterRecord['topDoctrine'];
  doctrineContributions: DoctrineContribution[];
  influence: { earned: number; spent: number }; shop: {
    councils: number; purchases: number; doctrinePurchases: number; packs: number; rerolls: number; edictsUsed: number;
  };
  cities: number; population: number; techs: number;
  /** era (1-based) in which the first Modern (era-index 5) tech landed; null = never */
  modernEra: number | null;
  /** highest era (1-based) among researched techs */
  techEra: number;
  /** colony-turns per finished build (building, Wonder or unit): the "something done every N turns" pace check */
  turnsPerBuild: number;
  rivals: { id: number; name: string; cities: number; population: number; techs: number }[];
  /** combats between two nations (must stay 0: only Raiders fight) */
  nationClashes: number; clashes: number; drops: number; thaws: number; stormHits: number;
  defeatCause: string | null; wallTimeMs: number; chapters: ChapterRecord[];
}
function parseArgs(args: string[]): Options {
  const result: Options = {
    runs: 20, size: 'standard', ascension: 0, seed: null, verbose: false, noDoctrines: false, jsonPath: null, policy: 'bot', focus: null, nation: null,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: bun scripts/sim.ts [--runs N] [--size small|standard|large] [--ascension 0..8] [--seed S] [--policy bot|guided|passive] [--focus <pillar>] [--nation <id>|random] [--verbose] [--no-doctrines] [--json PATH]');
      process.exit(0);
    } else if (arg === '--verbose') result.verbose = true;
    else if (arg === '--no-doctrines') result.noDoctrines = true;
    else if (arg === '--runs') result.runs = Number(args[++i]);
    else if (arg === '--size') result.size = args[++i] as MapSize;
    else if (arg === '--ascension') result.ascension = Number(args[++i]);
    else if (arg === '--seed') result.seed = args[++i];
    else if (arg === '--json') result.jsonPath = args[++i] ?? null;
    else if (arg === '--policy') result.policy = args[++i] as Policy;
    else if (arg === '--focus') result.focus = args[++i] as PillarId;
    else if (arg === '--nation') result.nation = args[++i] ?? '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(result.runs) || result.runs < 1 || !['small', 'standard', 'large'].includes(result.size) ||
    !Number.isInteger(result.ascension) || result.ascension < 0 || result.ascension > 8 || !['bot', 'guided', 'passive'].includes(result.policy) ||
    (result.focus !== null && !PILLARS.includes(result.focus)) ||
    (result.nation !== null && result.nation !== 'random' && !LEADERS[result.nation]) ||
    (result.seed !== null && !result.seed) || (args.includes('--json') && !result.jsonPath))
    throw new Error('Invalid --runs, --size, --ascension, --policy, --focus, --nation, --seed or --json');
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
        !(item.kind === 'pack' && item.pack === 'doctrine') && councilBuyError(state, i) === null);
      return slot >= 0 ? { type: 'councilBuy', slot } : { type: 'leaveCouncil' };
    }
  }
  return action;
}
/** CitySheet's "Suggested" order: builds that feed the Focus, then buildings, Wonders, units; quickest first */
const SUGGEST_RANK: Record<ProductionOption['category'], number> = { building: 0, wonder: 1, unit: 2, project: 3 };
function suggestedBuild(state: GameState, cityId: number): ProductionOption | undefined {
  const focus = state.run.focus;
  const rank = (o: ProductionOption) => SUGGEST_RANK[o.category] + (
    (o.category === 'building' ? BUILDINGS[o.item.id]?.pillar === focus
      : o.category === 'wonder' ? focus === 'glory'
      : o.category === 'unit' && focus === 'conquest' && (UNITS[o.item.id]?.strength ?? 0) > 0) ? 0 : 10);
  const options = productionOptions(state, state.cities[cityId]).filter(o => !o.lockedReason);
  return options.filter(o => o.category !== 'project')
    .sort((a, b) => rank(a) - rank(b) || (a.turns ?? 999) - (b.turns ?? 999))[0] ?? options[0];
}
/** End Turn's prompts: first offered research, first Suggested build for an empty queue */
function attentionAction(state: GameState): Action | null {
  const attention = nextAttention(state);
  if (attention?.kind === 'research') {
    const tech = state.players[HUMAN].researchOffer[0] ?? availableTechs(state, HUMAN)[0];
    if (tech) return { type: 'setResearch', tech };
  }
  if (attention?.kind === 'city') {
    const pick = suggestedBuild(state, attention.id);
    if (pick) return { type: 'setProduction', cityId: attention.id, item: pick.item };
  }
  return null;
}
/**
 * `--policy passive`: a new player who only answers End Turn's prompts. Picks the first offered research and the
 * first Suggested build whenever a colony's queue is empty; keeps the Focus; never shops, drops, wakes or moves units.
 */
function passiveAction(state: GameState): Action | null {
  const phase = state.run.phase;
  if (phase === 'chapterStart') return { type: 'chooseChapterStart', focus: state.run.focus };
  if (phase === 'chronicle') return { type: 'ackChronicle' };
  if (phase === 'council') return state.run.council?.pack ? { type: 'packPick', index: null } : { type: 'leaveCouncil' };
  if (phase !== 'playing') return null;
  return attentionAction(state) ?? { type: 'endTurn' };
}
/** nearest explored Land Colony site to the Capital (ties: lowest tile index) */
function guidedDropSite(state: GameState): number | null {
  const player = state.players[HUMAN];
  const price = dropPrice(state, HUMAN);
  if (player.cryo < price.cryo || player.gold < price.gold) return null;
  const capital = Object.values(state.cities).find(c => c.owner === HUMAN && c.isCapital) ??
    Object.values(state.cities).find(c => c.owner === HUMAN);
  if (!capital) return null;
  let best: { tile: number; distance: number } | null = null;
  for (const tile of state.map.tiles) {
    if (player.vis[tile.idx] === 0 || canOrbitalDrop(state, HUMAN, tile.idx) !== null) continue;
    const distance = hexDistance(state.map, capital.tile, tile.idx);
    if (!best || distance < best.distance) best = { tile: tile.idx, distance };
  }
  return best?.tile ?? null;
}
/**
 * `--policy guided`: what the in-game guide teaches. Answers End Turn's prompts like `passive`, lands a colony
 * whenever it has Pods and a valid site, buys the first affordable Crew in the Shop, and when the Slots are full sells
 * its weakest Crew member (lowest Shop price, leftmost) for a pricier Crew card it can then afford; keeps the Focus;
 * no unit micro.
 */
function guidedAction(state: GameState): Action | null {
  const phase = state.run.phase;
  if (phase === 'chapterStart') return { type: 'chooseChapterStart', focus: state.run.focus };
  if (phase === 'chronicle') return { type: 'ackChronicle' };
  if (phase === 'council') {
    const council = state.run.council;
    if (!council || council.pack) return council?.pack ? { type: 'packPick', index: null } : { type: 'leaveCouncil' };
    const slot = council.items.findIndex((item, i) => item?.kind === 'doctrine' && councilBuyError(state, i) === null);
    if (slot >= 0) return { type: 'councilBuy', slot };
    if (doctrineSlotsUsed(state.run) < state.run.doctrineSlots) return { type: 'leaveCouncil' };
    const price = (d: GameState['run']['doctrines'][number]) => doctrinePrice(DOCTRINES[d.id]?.rarity ?? 'common', d.edition);
    const weakest = state.run.doctrines.filter(d => d.edition !== 'ethereal' && !DOCTRINES[d.id]?.noSell)
      .reduce<GameState['run']['doctrines'][number] | null>((low, d) => !low || price(d) < price(low) ? d : low, null);
    const better = weakest && council.items.some(item => item?.kind === 'doctrine' && item.price > price(weakest) &&
      item.price <= state.run.influence + weakest.sellValue);
    return weakest && better ? { type: 'sellDoctrine', uid: weakest.uid } : { type: 'leaveCouncil' };
  }
  if (phase !== 'playing') return null;
  const prompt = attentionAction(state);
  if (prompt) return prompt;
  const site = guidedDropSite(state);
  return site !== null ? { type: 'orbitalDrop', tile: site } : { type: 'endTurn' };
}
function policyAction(state: GameState): Action | null {
  const action = opts.policy === 'passive' ? passiveAction(state) : opts.policy === 'guided' ? guidedAction(state)
    : autoplayNextAction(state) ?? (state.run.phase === 'playing' ? { type: 'endTurn' } as const : null);
  return opts.focus && action?.type === 'chooseChapterStart' ? { ...action, focus: opts.focus } : action;
}
function chapterRecord(result: ChronicleResult, doctrineIds: Map<string, string>, turn: number, crisis: string | null, focus: string, stats: ChapterStats): ChapterRecord {
  const contribution = new Map<string, { id: string; renown: number; splendor: number; legacy: number }>();
  const points: Record<string, number> = {};
  const multiplier: Record<string, number> = {};
  let renown = 0;
  let splendor = 0;
  for (const step of result.steps) {
    const key = step.source === 'pillar' ? step.label : step.source;
    if (step.renownAdd) points[key] = (points[key] ?? 0) + step.renownAdd;
    if (step.splendorAdd) multiplier[key] = (multiplier[key] ?? 0) + step.splendorAdd;
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
    era: result.era + 1, chapter: result.chapter + 1, crisis: result.chapter === CRISIS_CHAPTER ? crisis : null,
    turn, score: result.score, target: result.target,
    ratio: result.target > 0 ? result.score / result.target : 0, passed: result.passed,
    renown: result.renown, splendor: result.splendor, influenceEarned: result.influenceEarned,
    topDoctrine: doctrineContributions[0] ?? null, doctrineContributions, focus, points, multiplier, stats: structuredClone(stats),
  };
}

const opts = parseArgs(Bun.argv.slice(2));
if (opts.jsonPath && await Bun.file(opts.jsonPath).exists()) throw new Error(`Refusing to overwrite existing JSON file: ${opts.jsonPath}`);
const records: RunRecord[] = [];
const wins: number[] = [];
const msTurn: number[] = [];
const leaders = Object.keys(LEADERS);
if (!leaders.length) throw new Error('No leader content registered');
console.log(`RED EXODUS balance · ${opts.runs} runs · ${opts.size} · ascension ${opts.ascension} · policy ${opts.policy} · nation ${opts.nation ?? leaders[0]}${opts.focus ? ` · focus ${opts.focus}` : ''}${opts.noDoctrines ? ' · no doctrines' : ''}`);
for (let run = 0; run < opts.runs; run++) {
  const seed = opts.seed ? (opts.runs === 1 ? opts.seed : `${opts.seed}-${run + 1}`) : `BALANCE-${run + 1}`;
  // `--nation random` walks the roster with a step coprime to its size: every run a different nation
  const leaderId = opts.nation === 'random' ? leaders[(run * 7) % leaders.length] : opts.nation ?? leaders[0];
  const { state } = createGame({ seed, leaderId, ascension: opts.ascension, mapSize: opts.size,
    rivals: 3, tutorial: false, daily: false });
  let actions = 0;
  let stalled = false;
  let nationClashes = 0;
  let clashes = 0;
  let drops = 0;
  let thaws = 0;
  let stormHits = 0;
  let builds = 0;
  let colonyTurns = 0;
  let modernEra: number | null = null;
  const shop = { councils: 0, purchases: 0, doctrinePurchases: 0, packs: 0, rerolls: 0, edictsUsed: 0 };
  let influenceEarned = 0;
  let influenceSpent = 0;
  const player = state.players.find(p => p.id === HUMAN)!;
  let last = '';
  let repeated = 0;
  const doctrineIds = new Map<string, string>(state.run.doctrines.map(d => [String(d.uid), d.id]));
  const chronicleRecords: ChapterRecord[] = [];
  const recordEvents = (events: SimEvent[]) => {
    const gained: number[] = [];
    for (const event of events) {
      if (event.type === 'podLanded' && event.player === HUMAN) drops++;
      if (event.type === 'techResearched' && event.player === HUMAN && modernEra === null && TECHS[event.tech]?.era === 5)
        modernEra = state.run.era + 1;
      if (event.type === 'colonistsThawed' && event.player === HUMAN) thaws++;
      if (event.type === 'stormDamage' && event.player === HUMAN) stormHits++;
      if ((event.type === 'buildingBuilt' || event.type === 'wonderBuilt' || event.type === 'unitCreated' && event.cityId != null) &&
        event.player === HUMAN) builds++;
      if (event.type === 'combat') {
        clashes++;
        if (event.attacker.player !== BARBARIAN && event.defender.player !== BARBARIAN) nationClashes++;
      }
      if (event.type === 'influenceChanged') {
        if (event.delta > 0) influenceEarned += event.delta;
        else influenceSpent -= event.delta;
      }
      if (event.type === 'doctrineGained') {
        doctrineIds.set(String(event.uid), event.id);
        gained.push(event.uid);
      }
      if (event.type === 'chronicle') chronicleRecords.push(chapterRecord(event.result, doctrineIds, state.turn, state.run.crisis, state.run.focus, state.run.stats));
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
    return result;
  };
  if (opts.noDoctrines) {
    for (const doctrine of [...state.run.doctrines]) {
      const influence = state.run.influence;
      const removed = applyAction(state, { type: 'sellDoctrine', uid: doctrine.uid });
      if (!removed.ok) throw new Error(`Unable to remove starter doctrine ${doctrine.id}: ${removed.error}`);
      state.run.influence = influence;
    }
  }
  const start = performance.now();
  while (!state.gameOver && state.run.phase !== 'victory' && state.run.phase !== 'defeat' && state.turn < 200 && actions < 40000) {
    let action = policyAction(state);
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
    if (beforeTurn !== state.turn) colonyTurns += Object.values(state.cities).filter(c => c.owner === HUMAN).length;
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
    techs: player.techs.length, modernEra, techEra: Math.max(0, ...player.techs.map(t => TECHS[t]?.era ?? 0)) + 1,
    turnsPerBuild: builds ? colonyTurns / builds : Infinity,
    rivals: state.players.filter(p => p.id !== HUMAN && p.id !== 99).map(p => {
      const cities = Object.values(state.cities).filter(c => c.owner === p.id);
      return { id: p.id, name: p.name, cities: cities.length, population: cities.reduce((sum, city) => sum + city.pop, 0), techs: p.techs.length };
    }),
    nationClashes, clashes, drops, thaws, stormHits, defeatCause: state.run.defeatReason, wallTimeMs: elapsed, chapters,
  };
  records.push(record);
  wins.push(result === 'WIN' ? 1 : 0);
  msTurn.push(elapsed / Math.max(1, state.turn));
  console.log(`${String(run + 1).padStart(2)} ${seed.padEnd(17)} ${result.padEnd(8)} turn ${String(state.turn).padStart(3)} era ${Math.min(state.run.era + 1, 6)} · drops ${drops} / thaws ${thaws} / storm hits ${stormHits} · human ${seatSummary(state, HUMAN)} vs AI ${state.players.filter(p => p.id !== HUMAN && p.id !== 99).map(p => seatSummary(state, p.id)).join(', ')} · ${clashes} clashes (${nationClashes} between nations) · ${(elapsed / Math.max(1, state.turn)).toFixed(1)}ms/turn`);
  console.log(`   chapters ${chapters.map(h => `E${h.era}.${h.chapter} ${Math.round(h.score)}/${Math.round(h.target)}${h.passed ? '✓' : '✗'}`).join('  ') || 'none'}`);
  if (opts.verbose) console.log(`   tech era ${record.techEra}; ${actions} actions; ${elapsed.toFixed(0)}ms`);
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
console.log(`Win rate ${(100 * mean(wins)).toFixed(1)}% · median ${quantile(msTurn, 0.5).toFixed(1)}ms/turn`);
const fullRuns = records.filter(r => r.chapters.length === 6 * CHAPTERS_PER_ERA);
console.log(`Avg chapters passed ${mean(records.map(r => r.chapters.filter(c => c.passed).length)).toFixed(1)} · ` +
  `avg techs ${mean(records.map(r => r.techs)).toFixed(1)} (${mean(fullRuns.map(r => r.techs)).toFixed(1)} in ${fullRuns.length} full runs, ` +
  `top tech era ${[...new Set(fullRuns.map(r => r.techEra))].sort().map(era => `E${era}×${fullRuns.filter(r => r.techEra === era).length}`).join(' ')}) · ` +
  `first chapter passed ${(100 * mean(records.map(r => r.chapters[0]?.passed ? 1 : 0))).toFixed(0)}% · ` +
  `turns per build ${quantile(records.map(r => r.turnsPerBuild), 0.5).toFixed(1)} (median, per colony)`);
console.log(`Landfall Dawn median ${quantile(records.map(r => r.chapters[0]?.ratio ?? 0), 0.5).toFixed(2)}× · ` +
  `top tech era (all runs) ${[...new Set(records.map(r => r.techEra))].sort().map(era => `E${era}×${records.filter(r => r.techEra === era).length}`).join(' ')} · ` +
  `Modern tech in ${(100 * mean(fullRuns.map(r => r.modernEra !== null ? 1 : 0))).toFixed(0)}% of full runs ` +
  `(by Terraform ${(100 * mean(fullRuns.map(r => r.modernEra !== null && r.modernEra <= 5 ? 1 : 0))).toFixed(0)}%) · ` +
  `Coins earned ${mean(records.map(r => r.influence.earned)).toFixed(0)} / spent ${mean(records.map(r => r.influence.spent)).toFixed(0)} per run · ` +
  `drops ${mean(records.map(r => r.drops)).toFixed(1)}`);
const logRatios = (eras: number[]) => records.flatMap(r => r.chapters.filter(c => eras.includes(c.era)).map(c => Math.log(Math.max(1e-3, c.ratio))));
const [early, late] = [logRatios([1, 2, 3]), logRatios([4, 5, 6])];
console.log(`Geo-mean score/target: eras 1–3 ${Math.exp(mean(early)).toFixed(2)}× (${early.length} chapters) · ` +
  `eras 4–6 ${late.length ? Math.exp(mean(late)).toFixed(2) + '×' : '—'} (${late.length} chapters)`);
console.log(`Median chapter score/target: ${[0, 1, 2, 3, 4, 5].map(era => {
  const values = records.flatMap(r => r.chapters.filter(c => c.era === era + 1).map(c => c.ratio));
  return `E${era + 1} ${values.length ? quantile(values, 0.5).toFixed(2) + '×' : '—'}`;
}).join(' · ')}`);
const aggregate = Array.from({ length: 6 }, (_, era) => Array.from({ length: CHAPTERS_PER_ERA }, (_, chapter) => {
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
    settings: { runs: opts.runs, size: opts.size, ascension: opts.ascension, policy: opts.policy, noDoctrines: opts.noDoctrines, seed: opts.seed },
    runs: records, eraChapter: aggregate,
  }, null, 2)}\n`);
  console.log(`JSON written to ${opts.jsonPath}`);
}
