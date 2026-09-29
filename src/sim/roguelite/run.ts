// Run clock & phases: eras → chapters → chronicle → council. DESIGN §3.
import { refreshAllCities } from '../cities';
import type { CrisisDef } from '../defs';
import { collectEffects, makeCtx } from '../effects';
import { weightedIndex } from '../rng';
import type { DoctrineId, Edition, Emit, GameState, OmenId, PillarId, RunState } from '../types';
import { BARBARIAN, HUMAN, PILLARS } from '../types';
import { CRISES, DOCTRINES, LEADERS, OMENS } from '../../content';
import {
  CHAPTER_LENGTHS, CRISIS_CHAPTER, ERA_NAMES, FINAL_ERA, START_DOCTRINE_SLOTS, START_EDICT_SLOTS, START_FOCUS,
  START_INFLUENCE, START_MANDATE,
} from './constants';
import { chronicleTarget, computeChronicle } from './chronicle';
import { doctrinePrice, doctrineSlotsUsed, generateCouncil, sellValueFor } from './council';
import { omenGoal, rollOmenOffers } from './omens';
import { emptyStats, markSeen } from './stats';

/** weight multiplier for crises already faced this run (endless reuses the full pool) */
const SEEN_CRISIS_WEIGHT = 0.2;

function freshRun(state: GameState): RunState {
  const pillarLevels = {} as Record<PillarId, number>;
  for (const p of PILLARS) pillarLevels[p] = 1;
  return {
    phase: 'crisisReveal', era: 0, chapter: 0, chapterTurn: 0, chapterLength: CHAPTER_LENGTHS[0],
    mandate: START_MANDATE, maxMandate: START_MANDATE, influence: START_INFLUENCE, focus: START_FOCUS, pillarLevels,
    doctrines: [], doctrineSlots: START_DOCTRINE_SLOTS, edicts: [], edictSlots: START_EDICT_SLOTS, reforms: [],
    crisis: null, crisisActive: false, darkAge: false, omenOffer: [], omen: null,
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

/** fill state.run for a fresh game (after players/map/start units exist); rolls era-0 crisis; phase = 'crisisReveal' */
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
}

/** roll this era's crisis (weighted; avoids repeats); emits crisisRevealed */
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
  emit({ type: 'crisisRevealed', era: run.era, crisis: crisis.id });
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
  rollOmenOffers(state);
}

export function ackCrisis(state: GameState): string | null {
  if (state.run.phase !== 'crisisReveal') return 'Nothing to acknowledge';
  openChapter(state);
  return null;
}

export function chooseChapterStart(state: GameState, focus: PillarId, omen: OmenId | null, emit: Emit): string | null {
  const run = state.run;
  if (run.phase !== 'chapterStart') return 'Not at a chapter start';
  if (!PILLARS.includes(focus)) return 'Unknown pillar';
  if (omen != null && (!run.omenOffer.includes(omen) || !OMENS[omen])) return 'That omen is not on offer';
  run.focus = focus;
  run.omen = omen != null ? { id: omen, progress: 0, done: false, goal: omenGoal(state, OMENS[omen]) } : null;
  run.omenOffer = [];
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
  if (result.mandateLost) changeMandate(state, -result.mandateLost, 'The Chronicle fell short', emit);
  const income = result.influenceEarned.reduce((s, l) => s + l.amount, 0);
  addInfluence(state, income, emit);
  refreshCities(state);
}

export function ackChronicle(state: GameState, emit: Emit): string | null {
  const run = state.run;
  if (run.phase !== 'chronicle' || !run.lastChronicle) return 'No chronicle to acknowledge';
  const r = run.lastChronicle;
  run.stats = emptyStats();
  run.omen = null;
  if (run.mandate <= 0) {
    defeatRun(state, 'Your Mandate is spent. The people have turned away from your rule.', emit);
  } else if (r.era === FINAL_ERA && r.chapter === CRISIS_CHAPTER) {
    if (r.passed) {
      run.phase = 'victory';
      emit({ type: 'runWon' });
    } else {
      defeatRun(state, 'The final Chronicle fell short. Your empire leaves no lasting Legacy.', emit);
    }
  } else {
    run.phase = 'council';
    generateCouncil(state, emit);
  }
  return null;
}

export function leaveCouncil(state: GameState, emit: Emit): string | null {
  const run = state.run;
  if (run.phase !== 'council') return 'The Council is not in session';
  if (run.council?.pack) return 'Choose from the open pack first';
  run.council = null;
  if (run.chapter < CRISIS_CHAPTER) {
    run.chapter++;
    openChapter(state);
    return null;
  }
  run.era++;
  run.chapter = 0;
  run.phase = 'crisisReveal';
  run.chapterTurn = 0;
  run.chapterLength = CHAPTER_LENGTHS[0];
  emit({ type: 'eraStarted', era: run.era });
  emit({ type: 'notify', text: run.era <= FINAL_ERA ? `The ${ERA_NAMES[run.era]} Era begins` : `Endless Era ${run.era - FINAL_ERA} begins`, icon: 'calendar', tone: 'info' });
  rollCrisis(state, emit);
  return null;
}

export function continueEndless(state: GameState, emit: Emit): string | null {
  const run = state.run;
  if (run.phase !== 'victory') return 'Endless mode opens after victory';
  run.phase = 'council';
  generateCouncil(state, emit);
  return null;
}

export function grantDoctrine(state: GameState, id: DoctrineId, edition: Edition, emit: Emit): string | null {
  const run = state.run;
  const def = DOCTRINES[id];
  if (!def) return 'Unknown doctrine';
  if (run.doctrines.some((d) => d.id === id)) return 'Doctrine already adopted';
  if (edition !== 'ethereal' && doctrineSlotsUsed(run) >= run.doctrineSlots) return 'Doctrine slots full';
  const uid = run.nextUid++;
  run.doctrines.push({ uid, id, edition, counters: {}, disabled: false, sellValue: sellValueFor(doctrinePrice(def.rarity, edition)) });
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

/** the civilization collapses (mandate exhausted, capital lost, …) */
export function defeatRun(state: GameState, reason: string, emit: Emit): void {
  const run = state.run;
  if (run.phase === 'defeat') return;
  run.phase = 'defeat';
  run.defeatReason = reason;
  run.council = null;
  state.gameOver = true;
  emit({ type: 'runLost', reason });
}
