// The Sol Report: chapter scoring (Viability = Output × Hope; ids renown/splendor/legacy) and targets. DESIGN §5.
import type { ChronicleCtx } from '../defs';
import type { ActiveEffect } from '../effects';
import { collectEffects, makeCtx, runHook } from '../effects';
import type { ChronicleResult, ChronicleStep, ChronicleStepSource, Emit, GameState, PillarId } from '../types';
import { HUMAN, PILLARS } from '../types';
import {
  ASCENSIONS, BUILDINGS, CRISES, DOCTRINES, LEADERS, NATURAL_WONDERS, PILLAR_DEFS, REFORMS, WONDERS,
} from '../../content';
import {
  CHAPTER_NAMES, CHAPTER_TARGET_MUL, CITY_RENOWN_PER_POP, CITY_RENOWN_PER_WONDER, CRISIS_CHAPTER, ENDLESS_ERA_MUL,
  ERA_TARGETS, FINAL_CRISIS_TARGET_MUL, FINAL_ERA, FOCUS_RENOWN_MUL, GILDED_RENOWN_BASE, GILDED_RENOWN_PER_ERA, INCOME_BASE,
  INCOME_CHAPTER_BONUS, INTEREST_CAP, INTEREST_PER, MANDATE_LOSS_CRISIS_FAIL, MANDATE_LOSS_FAIL, PRISMATIC_SPLENDOR_MUL,
  RADIANT_SPLENDOR, TRIUMPH_INFLUENCE, TRIUMPH_RATIO,
} from './constants';
import { DARK_AGE_LABEL } from './darkAge';
import { humanCities } from './stats';

const noop: Emit = () => {};

/** base target of an era (before chapter multiplier / hooks); endless eras keep multiplying */
export function eraBaseTarget(era: number): number {
  if (era <= FINAL_ERA) return ERA_TARGETS[Math.max(0, era)];
  return ERA_TARGETS[FINAL_ERA] * ENDLESS_ERA_MUL ** (era - FINAL_ERA);
}

/**
 * Target for (era, chapter): era base × chapter multiplier × crisis targetMul (crisis chapter of the current era)
 * × `target` hooks (ascension, reforms, doctrines, crisis). Does not mutate state.
 */
export function chronicleTarget(state: GameState, era: number, chapter: number): number {
  const run = state.run;
  let value = eraBaseTarget(era) * (era === FINAL_ERA && chapter === CRISIS_CHAPTER
    ? FINAL_CRISIS_TARGET_MUL : CHAPTER_TARGET_MUL[Math.min(chapter, CHAPTER_TARGET_MUL.length - 1)]);
  const crisisChapter = chapter === CRISIS_CHAPTER && era === run.era && run.crisis != null;
  const crisis = crisisChapter ? CRISES[run.crisis!] : undefined;
  if (crisis) value *= crisis.targetMul ?? 1;

  const effects = collectEffects(state, HUMAN).filter((fx) => fx.kind !== 'crisis' || crisisChapter);
  if (crisis && !run.crisisActive) {
    const human = state.players.find((p) => p.id === HUMAN);
    const counters = human?.effectCounters[`crisis:${crisis.id}`] ?? {};
    effects.push({ kind: 'crisis', id: crisis.id, hooks: crisis.effects, counters });
  }
  // hooks read run.era/run.chapter: present the queried chapter to them, then restore
  const saved = { era: run.era, chapter: run.chapter };
  run.era = era;
  run.chapter = chapter;
  // era/chapter ride along so hooks can scale only specific chapters (e.g. crisis-chapter targets)
  const scalar = { value, era, chapter };
  try {
    runHook(state, HUMAN, 'target', noop, effects, scalar);
  } finally {
    run.era = saved.era;
    run.chapter = saved.chapter;
  }
  return Math.max(1, Math.round(scalar.value));
}

function effectLabel(fx: ActiveEffect): string {
  switch (fx.kind) {
    case 'doctrine': return DOCTRINES[fx.id]?.name ?? fx.id;
    case 'crisis': return CRISES[fx.id]?.name ?? fx.id;
    case 'reform': return REFORMS[fx.id]?.name ?? fx.id;
    case 'leader': return LEADERS[fx.id]?.name ?? fx.id;
    case 'ascension': return ASCENSIONS.find((a) => String(a.level) === fx.id)?.name ?? `Hazard ${fx.id}`;
    case 'building': return BUILDINGS[fx.id]?.name ?? fx.id;
    case 'wonder': return WONDERS[fx.id]?.name ?? fx.id;
    case 'naturalWonder': return NATURAL_WONDERS[fx.id]?.name ?? fx.id;
    case 'darkAge': return DARK_AGE_LABEL;
    case 'edict': return fx.id;
  }
}

const SOURCE_BY_KIND: Record<ActiveEffect['kind'], ChronicleStepSource> = {
  leader: 'leader', doctrine: 'doctrine', crisis: 'crisis', reform: 'reform', wonder: 'city', building: 'city',
  ascension: 'ascension', darkAge: 'darkAge', naturalWonder: 'city', edict: 'bonus',
};

/** tail hooks after the doctrine bar, in this order */
const TAIL_KINDS: ActiveEffect['kind'][] = ['crisis', 'darkAge', 'reform', 'leader', 'ascension'];

/**
 * Score the current chapter on `state` (hooks may update their counters: scaling doctrines grow here).
 * Does not change run phase / mandate / influence — see run.ts endChapter.
 */
export function computeChronicle(state: GameState, emit: Emit): ChronicleResult {
  const run = state.run;
  const { era, chapter, focus } = run;
  const steps: ChronicleStep[] = [];
  let renown = 0;
  let splendor = 0;
  const push = (s: Omit<ChronicleStep, 'renown' | 'splendor'>) => steps.push({ ...s, renown, splendor });

  // 1. pillars
  let focusRenown = 0;
  for (const p of PILLARS) {
    const def = PILLAR_DEFS[p];
    for (const line of def.renown(run.stats, run.pillarLevels[p])) {
      if (!line.amount) continue;
      renown += line.amount;
      if (p === focus) focusRenown += line.amount;
      push({ source: 'pillar', label: `${def.name} · ${line.label}`, ref: p, renownAdd: line.amount });
    }
  }
  // 2. focus pillar ×2, then its base splendor
  const focusDef = PILLAR_DEFS[focus];
  if (focusRenown) {
    const add = focusRenown * (FOCUS_RENOWN_MUL - 1);
    renown += add;
    push({ source: 'focus', label: `Priority: ${focusDef.name} ×${FOCUS_RENOWN_MUL}`, ref: focus, renownAdd: add });
  }
  const baseSplendor = focusDef.splendor(run.pillarLevels[focus]);
  splendor += baseSplendor;
  push({ source: 'focus', label: `${focusDef.name} Hope`, ref: focus, splendorAdd: baseSplendor });

  // 3. cities, capital first then founding order
  const cities = humanCities(state);
  for (const c of cities) {
    const add = CITY_RENOWN_PER_POP * c.pop + CITY_RENOWN_PER_WONDER * c.wonders.length;
    if (!add) continue;
    renown += add;
    push({ source: 'city', label: c.name, ref: String(c.id), renownAdd: add });
  }

  // hook plumbing: every add/mul records a step attributed to the current effect
  let cur: { source: ChronicleStepSource; label: string; ref?: string } = { source: 'city', label: '' };
  const cctx: ChronicleCtx = {
    stats: run.stats, focus, era, chapter, cities,
    renown: () => renown,
    splendor: () => splendor,
    addRenown(n, label) {
      if (!n || !Number.isFinite(n)) return;
      renown += n;
      push({ source: cur.source, label: label ?? cur.label, ref: cur.ref, renownAdd: n });
    },
    addSplendor(n, label) {
      if (!n || !Number.isFinite(n)) return;
      splendor += n;
      push({ source: cur.source, label: label ?? cur.label, ref: cur.ref, splendorAdd: n });
    },
    mulSplendor(x, label) {
      if (x === 1 || !Number.isFinite(x)) return;
      splendor *= x;
      push({ source: cur.source, label: label ?? cur.label, ref: cur.ref, splendorMul: x });
    },
  };
  const fire = (fx: ActiveEffect) => {
    if (!fx.hooks.chronicle) return;
    const ref = fx.kind === 'doctrine' ? String(fx.uid) : fx.cityId != null ? String(fx.cityId) : fx.id;
    cur = { source: SOURCE_BY_KIND[fx.kind], label: effectLabel(fx), ref };
    fx.hooks.chronicle(makeCtx(state, HUMAN, fx, emit), cctx);
  };

  const effects = collectEffects(state, HUMAN);
  // city-hosted effects (buildings, wonders, natural wonders) join the city beats
  for (const fx of effects) if (fx.kind === 'wonder' || fx.kind === 'building' || fx.kind === 'naturalWonder') fire(fx);

  // festivals & edicts: live renown banked during the chapter
  const bonus = run.stats.extra.bonusRenown ?? 0;
  if (bonus) {
    renown += bonus;
    push({ source: 'bonus', label: 'Festivals & Salvage', renownAdd: bonus });
  }

  // 4. doctrine bar left → right, each followed by its edition
  for (const fx of effects) {
    if (fx.kind !== 'doctrine') continue;
    fire(fx);
    const inst = run.doctrines.find((d) => d.uid === fx.uid);
    if (!inst) continue;
    const ref = String(inst.uid);
    const name = effectLabel(fx);
    if (inst.edition === 'gilded') {
      const add = GILDED_RENOWN_BASE + GILDED_RENOWN_PER_ERA * era;
      renown += add;
      push({ source: 'edition', label: `Decorated ${name}`, ref, renownAdd: add });
    } else if (inst.edition === 'radiant') {
      splendor += RADIANT_SPLENDOR;
      push({ source: 'edition', label: `Inspired ${name}`, ref, splendorAdd: RADIANT_SPLENDOR });
    } else if (inst.edition === 'prismatic') {
      splendor *= PRISMATIC_SPLENDOR_MUL;
      push({ source: 'edition', label: `Legendary Tale: ${name}`, ref, splendorMul: PRISMATIC_SPLENDOR_MUL });
    }
  }

  // 5. crisis / dark age / reforms / leader / ascension
  for (const kind of TAIL_KINDS) for (const fx of effects) if (fx.kind === kind) fire(fx);

  // final
  renown = Math.max(0, renown);
  splendor = Math.max(0, splendor);
  const score = Math.floor(renown * splendor);
  push({ source: 'final', label: 'Viability' });

  const target = chronicleTarget(state, era, chapter);
  const passed = score >= target;
  const triumph = score >= target * TRIUMPH_RATIO;
  const crisisChapter = chapter === CRISIS_CHAPTER;
  const result: ChronicleResult = {
    era, chapter, target, steps, renown, splendor, score, passed, triumph,
    mandateLost: passed ? 0 : crisisChapter ? MANDATE_LOSS_CRISIS_FAIL : MANDATE_LOSS_FAIL,
    influenceEarned: [],
  };
  result.influenceEarned = influenceIncome(state, result, effects, emit);
  return result;
}

function influenceIncome(state: GameState, r: ChronicleResult, effects: ActiveEffect[], emit: Emit): { label: string; amount: number }[] {
  const run = state.run;
  const lines: { label: string; amount: number }[] = [{ label: 'Ark stipend', amount: INCOME_BASE }];
  if (r.passed) lines.push({ label: `${CHAPTER_NAMES[Math.min(r.chapter, CHAPTER_NAMES.length - 1)]} bonus`, amount: INCOME_CHAPTER_BONUS[Math.min(r.chapter, INCOME_CHAPTER_BONUS.length - 1)] });
  const cap = { value: INTEREST_CAP };
  runHook(state, HUMAN, 'interestCap', emit, effects, cap);
  const interest = Math.min(Math.max(0, Math.floor(cap.value)), Math.floor(Math.max(0, run.influence) / INTEREST_PER));
  if (interest > 0) lines.push({ label: 'Interest', amount: interest });
  if (r.triumph) lines.push({ label: 'Triumph', amount: TRIUMPH_INFLUENCE });
  const crisis = r.chapter === CRISIS_CHAPTER && run.crisis ? CRISES[run.crisis] : undefined;
  if (r.passed && crisis && crisis.reward > 0) lines.push({ label: `${crisis.name} overcome`, amount: crisis.reward });
  // buildings with `influence` pay out every chapter (one line per building type)
  const byBuilding: Record<string, { count: number; amount: number }> = {};
  for (const c of humanCities(state)) {
    for (const b of c.buildings) {
      const amount = BUILDINGS[b]?.influence ?? 0;
      if (!amount) continue;
      const e = (byBuilding[b] ??= { count: 0, amount: 0 });
      e.count++;
      e.amount += amount;
    }
  }
  for (const [b, e] of Object.entries(byBuilding)) {
    lines.push({ label: e.count > 1 ? `${BUILDINGS[b].name} ×${e.count}` : BUILDINGS[b].name, amount: e.amount });
  }
  runHook(state, HUMAN, 'influenceIncome', emit, effects, { lines });
  return lines.filter((l) => l.amount !== 0 && Number.isFinite(l.amount)).map((l) => ({ label: l.label, amount: Math.round(l.amount) }));
}

/** pure: the chronicle as if the chapter ended now (HUD "projected Legacy" meter) */
export function previewChronicle(state: GameState): ChronicleResult {
  return computeChronicle(structuredClone(state), noop);
}

/** per-pillar projection at current levels from the average completed chapter (ChapterStart UI) */
export function projectPillars(state: GameState): Record<PillarId, { renown: number; splendor: number }> {
  const run = state.run;
  const chapters = run.history.length;
  const base = chapters > 0 ? run.totals : run.stats;
  const div = Math.max(1, chapters);
  const avg = structuredClone(base);
  for (const k of Object.keys(avg) as (keyof typeof avg)[]) {
    if (k === 'extra') for (const e of Object.keys(avg.extra)) avg.extra[e] /= div;
    else avg[k] /= div;
  }
  const out = {} as Record<PillarId, { renown: number; splendor: number }>;
  for (const p of PILLARS) {
    const def = PILLAR_DEFS[p];
    const lvl = run.pillarLevels[p];
    out[p] = { renown: def.renown(avg, lvl).reduce((s, l) => s + l.amount, 0), splendor: def.splendor(lvl) };
  }
  return out;
}
