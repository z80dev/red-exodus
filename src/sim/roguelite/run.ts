// OWNER: SimMechanics. Run clock & phases: eras → chapters (Dawn, Crisis) → Chapter Report → Shop. DESIGN §3.
import { refreshAllCities } from '../cities';
import type { CrisisDef } from '../defs';
import { collectEffects, makeCtx } from '../effects';
import { weightedIndex } from '../rng';
import type { DoctrineId, Edition, Emit, GameState, PillarId, RunState } from '../types';
import { BARBARIAN, HUMAN, PILLARS } from '../types';
import { CRISES, DOCTRINES, LEADERS } from '../../content';
import {
  CHAPTER_LENGTHS, CRISIS_CHAPTER, ERA_NAMES, FINAL_ERA, START_DOCTRINE_SLOTS, START_EDICT_SLOTS, START_FOCUS,
  START_INFLUENCE, START_MANDATE,
} from './constants';
import { chronicleTarget, computeChronicle } from './chronicle';
import { doctrinePrice, doctrineSlotsUsed, generateCouncil, sellValueFor } from './council';
import { emptyStats, markSeen } from './stats';
import { changeCryo, ERA_CRYO } from '../mars';

/** weight multiplier for crises already faced this run (endless reuses the full pool) */
const SEEN_CRISIS_WEIGHT = 0.2;

function freshRun(state: GameState): RunState {
  const pillarLevels = {} as Record<PillarId, number>;
  for (const p of PILLARS) pillarLevels[p] = 1;
  return {
    phase: 'chapterStart', era: 0, chapter: 0, chapterTurn: 0, chapterLength: CHAPTER_LENGTHS[0],
    mandate: START_MANDATE, maxMandate: START_MANDATE, influence: START_INFLUENCE, focus: START_FOCUS, pillarLevels,
    doctrines: [], doctrineSlots: START_DOCTRINE_SLOTS, edicts: [], edictSlots: START_EDICT_SLOTS,
    crisis: null, crisisActive: false, darkAge: false,
    stats: emptyStats(), totals: emptyStats(), council: null, lastChronicle: null, history: [],
    ascension: state.config.ascension, nextUid: 1, seen: [], bestScore: 0, defeatReason: null,
  };
}

export function isEndless(state: GameState): boolean {
  return state.run.era > FINAL_ERA;
}

/** map/unit/city actions are only legal while a chapter is being played */
export function mapActionsAllowed(state: GameState): boolean {
  return state.run.phase === 'playing' && !state.gameOver;
}

function refreshCities(state: GameState): void {
  for (const p of state.players) if (p.alive && p.id !== BARBARIAN) refreshAllCities(state, p.id);
}

/** fill state.run for a fresh game (after players/map/start units exist); rolls era-0 crisis; phase = 'chapterStart' */
export function initRun(state: GameState, emit: Emit): void {
  state.run = freshRun(state);
  // leader & ascension onGain hooks may adjust the run (mandate, influence, slots) or grant starting assets
  for (const p of state.players) {
    if (!p.alive || p.id === BARBARIAN) continue;
    for (const fx of collectEffects(state, p.id)) {
      if ((fx.kind === 'leader' || (fx.kind === 'ascension' && p.id === HUMAN)) && fx.hooks.onGain) fx.hooks.onGain(makeCtx(state, p.id, fx, emit));
    }
  }
  const human = state.players.find((p) => p.id === HUMAN);
  const start = human ? LEADERS[human.leaderId]?.startDoctrine : undefined;
  if (start) grantDoctrine(state, start, 'base', emit);
  emit({ type: 'eraStarted', era: 0 });
  rollCrisis(state, emit);
  openChapter(state);
}

/** roll this era's crisis (weighted; avoids repeats); emits crisisRolled */
export function rollCrisis(state: GameState, emit: Emit): void {
  const run = state.run;
  const all = Object.values(CRISES);
  let pool: CrisisDef[] = isEndless(state) ? all : all.filter((c) => c.eras.includes(run.era));
  if (!pool.length) pool = all;
  const prev = run.crisis;
  if (pool.length > 1 && prev) pool = pool.filter((c) => c.id !== prev);
  run.crisis = null;
  run.crisisActive = false;
  if (!pool.length) return;
  const weights = pool.map((c) => Math.max(0, c.weight ?? 1) * (run.seen.includes(`crisis:${c.id}`) ? SEEN_CRISIS_WEIGHT : 1));
  const crisis = pool[weights.some((w) => w > 0) ? weightedIndex(state.rng, weights) : 0];
  run.crisis = crisis.id;
  markSeen(run, `crisis:${crisis.id}`);
  emit({ type: 'crisisRolled', era: run.era, crisis: crisis.id });
}

function crisisHook(state: GameState, hook: 'onBegin' | 'onEnd', emit: Emit): void {
  const fx = collectEffects(state, HUMAN).find((f) => f.kind === 'crisis');
  const fn = fx?.hooks[hook];
  if (fx && fn) fn(makeCtx(state, HUMAN, fx, emit));
}

function beginCrisis(state: GameState, emit: Emit): void {
  const run = state.run;
  if (!run.crisis || run.crisisActive || !CRISES[run.crisis]) return;
  run.crisisActive = true;
  crisisHook(state, 'onBegin', emit);
  emit({ type: 'crisisBegan', crisis: run.crisis });
  refreshCities(state);
}

function endCrisis(state: GameState, emit: Emit): void {
  const run = state.run;
  if (!run.crisis || !run.crisisActive) return;
  crisisHook(state, 'onEnd', emit);
  run.crisisActive = false;
  emit({ type: 'crisisEnded', crisis: run.crisis });
}

/** enter the chapter-start screen for run.chapter */
function openChapter(state: GameState): void {
  const run = state.run;
  run.phase = 'chapterStart';
  run.chapterTurn = 0;
  run.chapterLength = CHAPTER_LENGTHS[Math.min(run.chapter, CHAPTER_LENGTHS.length - 1)];
}

export function chooseChapterStart(state: GameState, focus: PillarId, emit: Emit): string | null {
  const run = state.run;
  if (run.phase !== 'chapterStart') return 'Not at a chapter start';
  if (!PILLARS.includes(focus)) return 'Unknown Focus';
  run.focus = focus;
  run.chapterTurn = 0;
  run.phase = 'playing';
  emit({ type: 'chapterStarted', era: run.era, chapter: run.chapter, target: chronicleTarget(state, run.era, run.chapter) });
  if (run.chapter === CRISIS_CHAPTER) beginCrisis(state, emit);
  return null;
}

/** after every full round of turns: advance the chapter clock; ends the chapter when the clock runs out */
export function onTurnEnd(state: GameState, emit: Emit): void {
  const run = state.run;
  if (run.phase !== 'playing' || state.gameOver) return;
  run.chapterTurn++;
  if (run.chapterTurn >= run.chapterLength) endChapter(state, emit);
}

/** score the chapter and apply its outcome; phase → 'chronicle' */
export function endChapter(state: GameState, emit: Emit): void {
  const run = state.run;
  const result = computeChronicle(state, emit);
  run.history.push({ era: result.era, chapter: result.chapter, score: result.score, target: result.target, passed: result.passed });
  run.bestScore = Math.max(run.bestScore, result.score);
  const extra = run.totals.extra;
  if (result.triumph) extra.triumphs = (extra.triumphs ?? 0) + 1;
  if (result.chapter === CRISIS_CHAPTER && result.passed && run.crisis) extra.crisesSurvived = (extra.crisesSurvived ?? 0) + 1;
  endCrisis(state, emit);
  run.darkAge = !result.passed;
  run.lastChronicle = result;
  run.phase = 'chronicle';
  emit({ type: 'chronicle', result });
  const up = result.focusLevelUp;
  if (up) {
    run.pillarLevels[up.pillar] = up.level;
    emit({ type: 'pillarLevelUp', pillar: up.pillar, level: up.level });
  }
  if (result.mandateLost) changeMandate(state, -result.mandateLost, 'You missed the target', emit);
  const income = result.influenceEarned.reduce((s, l) => s + l.amount, 0);
  addInfluence(state, income, emit);
  refreshCities(state);
}

export function ackChronicle(state: GameState, emit: Emit): string | null {
  const run = state.run;
  if (run.phase !== 'chronicle' || !run.lastChronicle) return 'No Chapter Report to close';
  const r = run.lastChronicle;
  run.stats = emptyStats();
  if (run.mandate <= 0) {
    defeatRun(state, 'You have no Lives left. Earth has stopped sending help.', emit);
  } else if (r.era === FINAL_ERA && r.chapter === CRISIS_CHAPTER) {
    if (r.passed) {
      run.phase = 'victory';
      emit({ type: 'runWon' });
    } else {
      defeatRun(state, 'You missed the target in the final Chapter Report.', emit);
    }
  } else {
    run.phase = 'council';
    generateCouncil(state, emit);
  }
  return null;
}

export function leaveCouncil(state: GameState, emit: Emit): string | null {
  const run = state.run;
  if (run.phase !== 'council') return 'The Shop is closed';
  if (run.council?.pack) return 'Open the Pack first';
  run.council = null;
  if (run.chapter < CRISIS_CHAPTER) {
    run.chapter++;
    openChapter(state);
    return null;
  }
  run.era++;
  run.chapter = 0;
  emit({ type: 'eraStarted', era: run.era });
  emit({ type: 'notify', text: run.era <= FINAL_ERA ? `The ${ERA_NAMES[run.era]} era begins` : `Beyond ${run.era - FINAL_ERA} begins`, icon: 'calendar', tone: 'info' });
  // the Ark thaws a fresh batch of pods for every surviving nation
  for (const p of state.players) if (p.alive && p.id !== BARBARIAN) changeCryo(state, p.id, ERA_CRYO, emit);
  rollCrisis(state, emit);
  openChapter(state);
  return null;
}

export function continueEndless(state: GameState, emit: Emit): string | null {
  const run = state.run;
  if (run.phase !== 'victory') return 'Beyond opens after victory';
  run.phase = 'council';
  generateCouncil(state, emit);
  return null;
}

export function grantDoctrine(state: GameState, id: DoctrineId, edition: Edition, emit: Emit): string | null {
  const run = state.run;
  const def = DOCTRINES[id];
  if (!def) return 'Unknown Crew member';
  if (run.doctrines.some((d) => d.id === id)) return 'You already have this Crew member';
  if (edition !== 'ethereal' && doctrineSlotsUsed(run) >= run.doctrineSlots) return 'All Slots are full';
  const uid = run.nextUid++;
  run.doctrines.push({ uid, id, edition, counters: {}, disabled: false, sellValue: sellValueFor(state, id, doctrinePrice(def.rarity, edition)) });
  markSeen(run, `doctrine:${id}`);
  emit({ type: 'doctrineGained', uid, id });
  const fx = collectEffects(state, HUMAN).find((f) => f.kind === 'doctrine' && f.uid === uid);
  if (fx?.hooks.onGain) fx.hooks.onGain(makeCtx(state, HUMAN, fx, emit));
  return null;
}

export function addInfluence(state: GameState, delta: number, emit: Emit): void {
  const run = state.run;
  const value = Math.max(0, Math.round(run.influence + delta));
  const actual = value - run.influence;
  if (!actual) return;
  run.influence = value;
  emit({ type: 'influenceChanged', value, delta: actual });
}

/** mandate ≤ 0 ends the run immediately, except while the Chronicle plays (resolved on ackChronicle) */
export function changeMandate(state: GameState, delta: number, reason: string, emit: Emit): void {
  const run = state.run;
  if (!delta || run.phase === 'defeat') return;
  run.mandate += delta;
  if (run.mandate > run.maxMandate) run.maxMandate = run.mandate;
  if (delta < 0) run.totals.extra.mandateLost = (run.totals.extra.mandateLost ?? 0) - delta;
  emit({ type: 'mandateChanged', value: run.mandate, delta });
  if (run.mandate <= 0 && run.phase !== 'chronicle') defeatRun(state, reason, emit);
}

/** the run is lost (no Lives left, Capital lost, …) */
export function defeatRun(state: GameState, reason: string, emit: Emit): void {
  const run = state.run;
  if (run.phase === 'defeat') return;
  run.phase = 'defeat';
  run.defeatReason = reason;
  run.council = null;
  state.gameOver = true;
  emit({ type: 'runLost', reason });
}
