// OWNER: SimMechanics. Persistent player profile (meta progression) in localStorage.
import type { GameState } from '../sim/types';
import { HUMAN } from '../sim/types';
import { CRISES, DOCTRINES, EDICTS, LEADERS, WONDERS } from '../content';
import { CRISIS_CHAPTER, ERA_NAMES, FINAL_ERA } from '../sim/roguelite/constants';

export interface RunUnlock { kind: string; id: string; name: string }

export interface Profile {
  version: 1;
  unlocked: { leaders: string[]; doctrines: string[]; edicts: string[] };
  discovered: { doctrines: string[]; edicts: string[]; crises: string[]; wonders: string[] };
  /** highest ascension beaten per leader */
  ascension: Record<string, number>;
  stats: { runs: number; wins: number; bestScore: number; bestEra: number; totalTurns: number; doctrineWins: Record<string, number> };
  settings: { master: number; music: number; sfx: number; quality: 'low' | 'high'; haptics: boolean; fastAnimations: boolean; tutorialDone: boolean };
  dailies: Record<string, number>; // date -> best score
  /** tutorial coach-mark steps already shown */
  tutorialProgress: string[];
  /** daily keys (YYYY-MM-DD) already attempted — one attempt per day */
  dailyAttempts: string[];
  /** idempotency guard for recordRunEnd */
  lastRun?: { key: string; unlocks: RunUnlock[] };
}

export const PROFILE_KEY = 'aeons.profile.v1';
export const MAX_ASCENSION = 8;
const STARTER_LEADER_COUNT = 2;

// ───────────────────────────── storage ─────────────────────────────
const memoryStore: Record<string, string> = {};
function storage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    // Node ≥25 exposes a stub `localStorage` without methods unless --localstorage-file is set
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') return localStorage;
  } catch {
    // access denied (private mode / sandboxed iframe) → in-memory
  }
  return {
    getItem: (k) => memoryStore[k] ?? null,
    setItem: (k, v) => { memoryStore[k] = v; },
  };
}

export function defaultSettings(): Profile['settings'] {
  return { master: 0.8, music: 0.6, sfx: 0.8, quality: 'high', haptics: true, fastAnimations: false, tutorialDone: false };
}

/** leaders available without meta progress: every leader without `unlock`, else the first two */
export function starterLeaders(): string[] {
  const all = Object.values(LEADERS);
  const free = all.filter((l) => !l.unlock).map((l) => l.id);
  return free.length >= STARTER_LEADER_COUNT ? free : all.slice(0, STARTER_LEADER_COUNT).map((l) => l.id);
}

export function defaultProfile(): Profile {
  return {
    version: 1,
    unlocked: { leaders: starterLeaders(), doctrines: [], edicts: [] },
    discovered: { doctrines: [], edicts: [], crises: [], wonders: [] },
    ascension: {},
    stats: { runs: 0, wins: 0, bestScore: 0, bestEra: 0, totalTurns: 0, doctrineWins: {} },
    settings: defaultSettings(),
    dailies: {},
    tutorialProgress: [],
    dailyAttempts: [],
  };
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

export function loadProfile(): Profile {
  const d = defaultProfile();
  let raw: Partial<Profile> | null = null;
  try {
    const text = storage().getItem(PROFILE_KEY);
    raw = text ? (JSON.parse(text) as Partial<Profile>) : null;
  } catch {
    raw = null;
  }
  if (!raw || raw.version !== 1) return d;
  return {
    version: 1,
    unlocked: {
      leaders: union(d.unlocked.leaders, strings(raw.unlocked?.leaders)),
      doctrines: strings(raw.unlocked?.doctrines),
      edicts: strings(raw.unlocked?.edicts),
    },
    discovered: {
      doctrines: strings(raw.discovered?.doctrines),
      edicts: strings(raw.discovered?.edicts),
      crises: strings(raw.discovered?.crises),
      wonders: strings(raw.discovered?.wonders),
    },
    ascension: { ...(raw.ascension ?? {}) },
    stats: { ...d.stats, ...(raw.stats ?? {}), doctrineWins: { ...(raw.stats?.doctrineWins ?? {}) } },
    settings: { ...d.settings, ...(raw.settings ?? {}) },
    dailies: { ...(raw.dailies ?? {}) },
    tutorialProgress: strings(raw.tutorialProgress),
    dailyAttempts: strings(raw.dailyAttempts),
    lastRun: raw.lastRun,
  };
}

export function saveProfile(p: Profile): void {
  try {
    storage().setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // quota exceeded / storage unavailable: progress stays in memory for this session
  }
}

/** wipe progression (unlocks, discoveries, stats, ascension, dailies, tutorial) but keep settings; saves */
export function resetProgress(p: Profile): Profile {
  const fresh = defaultProfile();
  fresh.settings = { ...p.settings, tutorialDone: false };
  saveProfile(fresh);
  return fresh;
}

export function updateSettings(p: Profile, patch: Partial<Profile['settings']>): Profile {
  const next = { ...p, settings: { ...p.settings, ...patch } };
  saveProfile(next);
  return next;
}

export function markTutorial(p: Profile, step: string): Profile {
  if (p.tutorialProgress.includes(step)) return p;
  const next = { ...p, tutorialProgress: [...p.tutorialProgress, step] };
  saveProfile(next);
  return next;
}

// ───────────────────────────── dailies ─────────────────────────────
/** local calendar date key YYYY-MM-DD */
export function todayKey(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function hasAttemptedDaily(p: Profile, key: string = todayKey()): boolean {
  return p.dailyAttempts.includes(key);
}

export function markDailyAttempt(p: Profile, key: string = todayKey()): Profile {
  if (p.dailyAttempts.includes(key)) return p;
  const next = { ...p, dailyAttempts: [...p.dailyAttempts, key] };
  saveProfile(next);
  return next;
}

// ───────────────────────────── unlock queries ─────────────────────────────
export function isLeaderUnlocked(p: Profile, id: string): boolean {
  return starterLeaders().includes(id) || p.unlocked.leaders.includes(id);
}

export function isDoctrineUnlocked(p: Profile, id: string): boolean {
  const def = DOCTRINES[id];
  return !!def && (!def.unlock || p.unlocked.doctrines.includes(id));
}

export function isEdictUnlocked(p: Profile, id: string): boolean {
  const def = EDICTS[id];
  return !!def && (!def.unlock || p.unlocked.edicts.includes(id));
}

/** highest ascension level selectable for a leader (0 = base game) */
export function maxAscension(p: Profile, leaderId: string): number {
  const beaten = p.ascension[leaderId];
  return beaten == null ? 0 : Math.min(MAX_ASCENSION, beaten + 1);
}

/** content ids still locked for this profile — pass as GameConfig.locked when starting a run */
export function lockedContent(p: Profile): string[] {
  const out: string[] = [];
  for (const d of Object.values(DOCTRINES)) if (d.unlock && !p.unlocked.doctrines.includes(d.id)) out.push(d.id);
  for (const e of Object.values(EDICTS)) if (e.unlock && !p.unlocked.edicts.includes(e.id)) out.push(e.id);
  return out;
}

// ───────────────────────────── unlock rules ─────────────────────────────
export interface RunEndCtx {
  state: GameState;
  /** profile after this run's stats were applied */
  profile: Profile;
  won: boolean;
}

export interface UnlockRule { text: string; test(c: RunEndCtx): boolean }

const humanCityCount = (s: GameState) => Object.values(s.cities).filter((c) => c.owner === HUMAN).length;
const reachEra = (era: number): UnlockRule => ({ text: `Reach the ${ERA_NAMES[era]} era`, test: (c) => c.state.run.era >= era });

/** keys referenced by content `unlock.rule`; `winWith:<leaderId>` is resolved dynamically */
export const UNLOCK_RULES: Record<string, UnlockRule> = {
  reachEra2: reachEra(1),
  reachEra3: reachEra(2),
  reachEra4: reachEra(3),
  reachEra5: reachEra(4),
  win: { text: 'Survive to New Earth (win a run)', test: (c) => c.won },
  winAsc2: { text: 'Win a run at Hazard 2+', test: (c) => c.won && c.state.config.ascension >= 2 },
  winAsc4: { text: 'Win a run at Hazard 4+', test: (c) => c.won && c.state.config.ascension >= 4 },
  winAsc8: { text: 'Win a run at Hazard 8', test: (c) => c.won && c.state.config.ascension >= 8 },
  capture5: { text: 'Seize 5 colonies in one run', test: (c) => c.state.run.totals.citiesCaptured >= 5 },
  kills40: { text: 'Neutralize 40 hostile units in one run', test: (c) => c.state.run.totals.kills >= 40 },
  wonders4: { text: 'Complete 4 Megaprojects in one run', test: (c) => c.state.run.totals.wonders >= 4 },
  wonders8: { text: 'Complete 8 Megaprojects in one run', test: (c) => c.state.run.totals.wonders >= 8 },
  techs24: { text: 'Make 24 Breakthroughs in one run', test: (c) => c.state.run.totals.techs >= 24 },
  cities8: { text: 'Run 8 colonies at once', test: (c) => humanCityCount(c.state) >= 8 },
  score100k: { text: 'Score 100,000 Viability in one Sol Report', test: (c) => c.state.run.bestScore >= 100_000 },
  score1m: { text: 'Score 1,000,000 Viability in one Sol Report', test: (c) => c.state.run.bestScore >= 1_000_000 },
  triumphs5: { text: 'Earn 5 Triumphs in one run', test: (c) => (c.state.run.totals.extra.triumphs ?? 0) >= 5 },
  legendary: {
    text: 'Bunk a Legendary Crew member',
    test: (c) => c.state.run.doctrines.some((d) => DOCTRINES[d.id]?.rarity === 'legendary'),
  },
  noMandateLost: { text: 'Win without losing any Charter', test: (c) => c.won && !(c.state.run.totals.extra.mandateLost ?? 0) },
  runs3: { text: 'Complete 3 runs', test: (c) => c.profile.stats.runs >= 3 },
  runs10: { text: 'Complete 10 runs', test: (c) => c.profile.stats.runs >= 10 },
  crises6: { text: 'Survive 6 Crises in one run', test: (c) => (c.state.run.totals.extra.crisesSurvived ?? 0) >= 6 },
  omens5: { text: 'Complete 5 Directives in one run', test: (c) => (c.state.run.totals.extra.omensCompleted ?? 0) >= 5 },
  festival2000: {
    text: 'Generate 2,000 Morale in one run',
    test: (c) => c.state.run.totals.culture + (c.state.run.totals.extra.festival ?? 0) >= 2000,
  },
};

export function resolveRule(key: string | undefined): UnlockRule {
  if (key?.startsWith('winWith:')) {
    const leaderId = key.slice('winWith:'.length);
    const name = LEADERS[leaderId]?.country ?? leaderId;
    return { text: `Win a run as ${name}`, test: (c) => c.won && c.state.config.leaderId === leaderId };
  }
  return (key && UNLOCK_RULES[key]) || UNLOCK_RULES.win;
}

/** human-readable unlock condition, or null when the content is available from the start */
export function unlockHint(kind: 'leader' | 'doctrine' | 'edict', id: string): string | null {
  const def = kind === 'leader' ? LEADERS[id] : kind === 'doctrine' ? DOCTRINES[id] : EDICTS[id];
  if (!def?.unlock) return null;
  if (kind === 'leader' && starterLeaders().includes(id)) return null;
  return def.unlock.text || resolveRule(def.unlock.rule).text;
}

// ───────────────────────────── run end ─────────────────────────────
export function runWasWon(state: GameState): boolean {
  return state.run.history.some((h) => h.era === FINAL_ERA && h.chapter === CRISIS_CHAPTER && h.passed);
}

function runKey(state: GameState): string {
  const c = state.config;
  return [c.seed, c.leaderId, c.ascension, c.daily ? 'd' : 'n', state.turn, state.run.era, state.run.chapter, state.run.history.length].join('|');
}

function dailyKeyOf(state: GameState): string {
  return /\d{4}-\d{2}-\d{2}/.exec(state.config.seed)?.[0] ?? todayKey();
}

/** apply end-of-run progression; returns newly unlocked things for the summary screen (idempotent per run) */
export function recordRunEnd(state: GameState): { unlocks: RunUnlock[] } {
  const p = loadProfile();
  const key = runKey(state);
  if (p.lastRun?.key === key) return { unlocks: p.lastRun.unlocks };

  const run = state.run;
  const won = runWasWon(state);
  const leaderId = state.config.leaderId;

  // stats
  p.stats.runs++;
  if (won) p.stats.wins++;
  p.stats.bestScore = Math.max(p.stats.bestScore, run.bestScore);
  p.stats.bestEra = Math.max(p.stats.bestEra, run.era);
  p.stats.totalTurns += state.turn;
  if (won) for (const d of run.doctrines) p.stats.doctrineWins[d.id] = (p.stats.doctrineWins[d.id] ?? 0) + 1;

  // codex discoveries
  const seen = (prefix: string) => run.seen.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  const humanWonders = Object.entries(state.wonderOwners).filter(([, cid]) => state.cities[cid]?.owner === HUMAN).map(([w]) => w);
  p.discovered.doctrines = union(p.discovered.doctrines, [...seen('doctrine:'), ...run.doctrines.map((d) => d.id)].filter((id) => DOCTRINES[id]));
  p.discovered.edicts = union(p.discovered.edicts, [...seen('edict:'), ...run.edicts.map((e) => e.id)].filter((id) => EDICTS[id]));
  p.discovered.crises = union(p.discovered.crises, seen('crisis:').filter((id) => CRISES[id]));
  p.discovered.wonders = union(p.discovered.wonders, [...seen('wonder:'), ...humanWonders].filter((id) => WONDERS[id]));

  // daily
  if (state.config.daily) {
    const dk = dailyKeyOf(state);
    p.dailies[dk] = Math.max(p.dailies[dk] ?? 0, run.bestScore);
    if (!p.dailyAttempts.includes(dk)) p.dailyAttempts.push(dk);
  }

  const unlocks: RunUnlock[] = [];
  // ascension ladder
  if (won) {
    const before = maxAscension(p, leaderId);
    p.ascension[leaderId] = Math.max(p.ascension[leaderId] ?? -1, state.config.ascension);
    const after = maxAscension(p, leaderId);
    if (after > before) unlocks.push({ kind: 'ascension', id: leaderId, name: `Ascension ${after} — ${LEADERS[leaderId]?.name ?? leaderId}` });
  }

  // content unlocks
  const ctx: RunEndCtx = { state, profile: p, won };
  for (const l of Object.values(LEADERS)) {
    if (!l.unlock || isLeaderUnlocked(p, l.id) || !resolveRule(l.unlock.rule).test(ctx)) continue;
    p.unlocked.leaders.push(l.id);
    unlocks.push({ kind: 'leader', id: l.id, name: l.name });
  }
  for (const d of Object.values(DOCTRINES)) {
    if (!d.unlock || p.unlocked.doctrines.includes(d.id) || !resolveRule(d.unlock.rule).test(ctx)) continue;
    p.unlocked.doctrines.push(d.id);
    unlocks.push({ kind: 'doctrine', id: d.id, name: d.name });
  }
  for (const e of Object.values(EDICTS)) {
    if (!e.unlock || p.unlocked.edicts.includes(e.id) || !resolveRule(e.unlock.rule).test(ctx)) continue;
    p.unlocked.edicts.push(e.id);
    unlocks.push({ kind: 'edict', id: e.id, name: e.name });
  }

  p.lastRun = { key, unlocks };
  saveProfile(p);
  return { unlocks };
}
