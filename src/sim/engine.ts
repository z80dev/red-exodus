// OWNER: SimMechanics. The only entry point the game layer uses: createGame / applyAction (+ applyPlayerAction for AIs).
import type {
  Action, ActionResult, Emit, GameConfig, GameState, LogEntry, Player, PlayerId, RunState, SimEvent,
} from './types';
import { BARBARIAN, HUMAN, PILLARS } from './types';
import { BUILDINGS, LEADERS, NATURAL_WONDERS, TECHS, UNITS, WONDERS } from '../content';
import { broadcastEvent, collectEffects, invalidateEffectCache, runHook } from './effects';
import { chance, deriveRng, seedRng, shuffle } from './rng';
import { generateMap } from './mapgen';
import { recomputeVisibility } from './visibility';
import { continueExploring, createUnit, exploreStep, moveUnitTo, removeUnit, unitsTurnStart } from './units';
import { resolveAttack, resolveCityStrike } from './combat';
import {
  MAX_QUEUE, PRODUCTION_PACE, buildImprovement, buyCost, canFoundCity, canProduce, citiesOf, completeItem, foundCity, processCity,
  productionItemName, refreshAllCities, refreshCity, sameItem,
} from './cities';
import {
  addGold, availableTechs, culturePerTurn, getPlayer, goldPerTurn, processResearch, sciencePerTurn, updateHappiness,
} from './economy';
import { runAiTurn, runBarbarians } from './ai';
import {
  addExtraStat, addStat, emptyStats, handleRunAction, initRun, isRunAction, mapActionsAllowed, onTurnEnd, trackEvent,
} from './roguelite';
import {
  advanceStorms, CAPITAL_START_POP, ensureResearchOffer, orbitalDrop, rerollResearch, START_CRYO, thawColonists,
} from './mars';

// ───────────────────────────── tunables ─────────────────────────────
export const STARTING_GOLD = 15;
/** Landfall kit next to every major's pre-founded Ark Hab (Hab Crawlers are built, not issued) */
export const STARTING_UNITS = ['warrior', 'scout'] as const;
/** safety valve: max events processed per dispatch */
export const MAX_EVENTS_PER_DISPATCH = 2000;
/** journal length */
export const MAX_LOG = 200;
export const BARBARIAN_COLORS = { primary: '#7a1414', secondary: '#141414' };
const FALLBACK_COLORS = [
  { primary: '#2f6fb3', secondary: '#e8d9a8' },
  { primary: '#b33a2f', secondary: '#f1e2b8' },
  { primary: '#3d8c4a', secondary: '#f0e6c8' },
  { primary: '#8a4fb3', secondary: '#f3e3c0' },
];

// ───────────────────────────── event pipeline ─────────────────────────────

interface Pipeline { emit: Emit; events: SimEvent[] }

/**
 * One pipeline per dispatch: emit → queue; drain: record → trackEvent (roguelite) → broadcastEvent (onEvent hooks).
 * Events emitted while draining are appended to the queue (never recursive). Hard cap per dispatch.
 */
function createPipeline(state: GameState): Pipeline {
  invalidateEffectCache(state);
  const events: SimEvent[] = [];
  const queue: SimEvent[] = [];
  let draining = false;
  let processed = 0;
  const emit: Emit = (ev) => {
    if (processed + queue.length >= MAX_EVENTS_PER_DISPATCH) return;
    queue.push(ev);
    if (draining) return;
    draining = true;
    try {
      let ev2: SimEvent | undefined;
      while ((ev2 = queue.shift())) {
        processed++;
        events.push(ev2);
        logEvent(state, ev2);
        trackEvent(state, ev2);
        broadcastEvent(state, ev2, emit);
      }
    } finally {
      draining = false;
    }
  };
  return { emit, events };
}

function civ(state: GameState, pid: PlayerId): string {
  return getPlayer(state, pid)?.civName ?? 'Unknown';
}

/** append notable events to the journal (human-relevant) */
function logEvent(state: GameState, ev: SimEvent): void {
  let entry: Omit<LogEntry, 'turn'> | null = null;
  switch (ev.type) {
    case 'cityFounded':
      if (ev.player === HUMAN) entry = { text: `${state.cities[ev.cityId]?.name ?? 'A colony'} is ready`, icon: 'found', tile: ev.tile, player: ev.player };
      break;
    case 'wonderBuilt':
      entry = { text: `${civ(state, ev.player)} finished ${WONDERS[ev.wonder]?.name ?? ev.wonder}`, icon: ev.wonder, tile: state.cities[ev.cityId]?.tile, player: ev.player };
      break;
    case 'techResearched':
      if (ev.player === HUMAN) entry = { text: `Research done: ${TECHS[ev.tech]?.name ?? ev.tech}`, icon: ev.tech, player: ev.player };
      break;
    case 'naturalWonderFound':
      if (ev.player === HUMAN) entry = { text: `You found ${NATURAL_WONDERS[ev.id]?.name ?? 'a landmark'}`, icon: 'star', tile: ev.tile, player: ev.player };
      break;
    case 'campCleared':
      if (ev.player === HUMAN) entry = { text: `Raider Camp cleared (+${ev.gold} Credits)`, icon: 'skull', tile: ev.tile, player: ev.player };
      break;
    case 'ruinExplored':
      if (ev.player === HUMAN) entry = { text: `Crash Site: ${ev.reward}`, icon: 'scroll', tile: ev.tile, player: ev.player };
      break;
    case 'buildingBuilt':
      if (ev.player === HUMAN && ev.building !== 'palace') {
        entry = { text: `${state.cities[ev.cityId]?.name ?? 'Colony'} built ${BUILDINGS[ev.building]?.name ?? ev.building}`, icon: ev.building, tile: state.cities[ev.cityId]?.tile, player: ev.player };
      }
      break;
    case 'podLanded':
      if (ev.player !== HUMAN) entry = { text: `${civ(state, ev.player)} landed a new colony`, icon: 'drop', tile: ev.tile, player: ev.player };
      break;
    case 'colonistsThawed':
      if (ev.player === HUMAN) entry = { text: `${ev.pop} colonists woke up in ${state.cities[ev.cityId]?.name ?? 'a colony'}`, icon: 'thaw', tile: state.cities[ev.cityId]?.tile, player: ev.player };
      break;
    case 'notify':
      entry = { text: ev.text, icon: ev.icon, tile: ev.tile };
      break;
    default:
      break;
  }
  if (!entry) return;
  state.log.push({ turn: state.turn, ...entry });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

// ───────────────────────────── creation ─────────────────────────────

/** placeholder until roguelite initRun fills it (needed because effects read state.run) */
function blankRun(config: GameConfig): RunState {
  const pillarLevels = {} as RunState['pillarLevels'];
  for (const p of PILLARS) pillarLevels[p] = 1;
  return {
    phase: 'chapterStart', era: 0, chapter: 0, chapterTurn: 0, chapterLength: 6, mandate: 3, maxMandate: 3,
    influence: 0, focus: 'prosperity', pillarLevels, doctrines: [], doctrineSlots: 5, edicts: [], edictSlots: 2,
    crisis: null, crisisActive: false, darkAge: false, stats: emptyStats(),
    totals: emptyStats(), council: null, lastChronicle: null, history: [], ascension: config.ascension, nextUid: 1,
    seen: [], bestScore: 0, defeatReason: null,
  };
}

function makePlayer(id: PlayerId, leaderId: string, isHuman: boolean, tiles: number, idx: number, altCommander = false): Player {
  const leader = LEADERS[leaderId];
  return {
    id,
    name: leader ? (altCommander ? leader.alt.name : leader.name) : `Commander ${id + 1}`,
    civName: leader?.civName ?? `Ark ${id + 1}`,
    leaderId,
    colors: leader ? { ...leader.colors } : { ...FALLBACK_COLORS[idx % FALLBACK_COLORS.length] },
    isHuman,
    alive: true,
    gold: STARTING_GOLD,
    techs: [],
    researching: null,
    researchProgress: {},
    vis: new Array<number>(tiles).fill(0),
    happiness: 0,
    ai: isHuman ? null : { personality: leader?.aiPersonality ?? 'builder', memory: {} },
    capitalId: null,
    citiesFounded: 0,
    counters: {},
    effectCounters: {},
    cryo: leader?.cryo ?? START_CRYO,
    researchOffer: [],
    researchRerolls: 0,
    altCommander,
  };
}

export function createGame(config: GameConfig): { state: GameState; events: SimEvent[] } {
  const rng = seedRng(config.seed);
  const rivals = Math.max(1, Math.min(3, Math.floor(config.rivals)));
  const map = generateMap(config.seed, config.mapSize, 1 + rivals);
  const rivalLeaders = shuffle(rng, Object.keys(LEADERS).filter((id) => id !== config.leaderId).sort());

  const n = map.tiles.length;
  // rivals' commanders come from their own stream so the main rng (and every seed's game) is unchanged
  const commanders = deriveRng(config.seed, 'commanders');
  const players: Player[] = [makePlayer(HUMAN, config.leaderId, true, n, 0, config.altCommander === true)];
  for (let i = 1; i <= rivals; i++) players.push(makePlayer(i, rivalLeaders[i - 1] ?? `rival${i}`, false, n, i, chance(commanders, 0.5)));
  const barb = makePlayer(BARBARIAN, 'barbarian', false, n, 0);
  barb.name = 'Raiders';
  barb.civName = 'Raiders';
  barb.colors = { ...BARBARIAN_COLORS };
  barb.ai = { personality: 'warmonger', memory: {} };
  barb.gold = 0;
  players.push(barb);

  const state: GameState = {
    schema: 1,
    config: { ...config, rivals },
    rng,
    turn: 1,
    map,
    players,
    cities: {},
    units: {},
    nextId: 1,
    run: blankRun(config),
    wonderOwners: {},
    naturalWondersSeen: {},
    log: [],
    gameOver: false,
    storms: [],
    nextStormId: 1,
  };
  for (const p of players) state.naturalWondersSeen[p.id] = [];

  const pipe = createPipeline(state);
  // Landfall: every Ark Hab is already down on its start tile; the kit deploys around it
  for (let i = 0; i <= rivals; i++) {
    const start = map.starts[i];
    if (start == null || start < 0) continue;
    const capital = foundCity(state, i, start, pipe.emit);
    capital.pop = CAPITAL_START_POP;
    refreshCity(state, capital);
    for (const type of STARTING_UNITS) if (UNITS[type]) createUnit(state, i, type, start, pipe.emit);
  }
  initRun(state, pipe.emit);
  ensureResearchOffer(state, HUMAN, pipe.emit);
  for (const p of players) if (p.id !== BARBARIAN) updateHappiness(state, p.id, pipe.emit);
  for (const p of players) recomputeVisibility(state, p.id, pipe.emit);
  pipe.emit({ type: 'turnStart', turn: state.turn, player: HUMAN });
  unitsTurnStart(state, HUMAN, pipe.emit);
  runHook(state, HUMAN, 'turnStart', pipe.emit, null);
  return { state, events: pipe.events };
}

// ───────────────────────────── dispatch ─────────────────────────────

export function applyAction(state: GameState, action: Action): ActionResult {
  const pipe = createPipeline(state);
  let error: string | null;
  if (isRunAction(action)) {
    const wasPlaying = state.run.phase === 'playing';
    error = handleRunAction(state, action, pipe.emit);
    if (!error && !wasPlaying && state.run.phase === 'playing') continueExploring(state, HUMAN, pipe.emit);
  } else if (!mapActionsAllowed(state)) {
    error = state.gameOver ? 'The run is over.' : 'Finish the current step first.';
  } else if (action.type === 'endTurn') {
    endTurn(state, pipe.emit);
    error = null;
  } else {
    error = applyPlayerAction(state, HUMAN, action, pipe.emit);
  }
  return error ? { ok: false, error, events: pipe.events } : { ok: true, events: pipe.events };
}

function unitOf(state: GameState, pid: PlayerId, id: number) {
  const u = state.units[id];
  return u && u.owner === pid ? u : null;
}

function cityOf(state: GameState, pid: PlayerId, id: number) {
  const c = state.cities[id];
  return c && c.owner === pid ? c : null;
}

export function applyPlayerAction(state: GameState, pid: PlayerId, action: Action, emit: Emit): string | null {
  const player = getPlayer(state, pid);
  if (!player || !player.alive) return 'Player is not in the game.';
  if (state.gameOver) return 'The run is over.';
  switch (action.type) {
    case 'moveUnit': {
      const u = unitOf(state, pid, action.unitId);
      if (!u) return 'Unit not found.';
      if (!state.map.tiles[action.to]) return 'Invalid tile.';
      if (action.to === u.tile) return 'The unit is already there.';
      if (u.order?.kind === 'fortify' || u.order?.kind === 'heal') u.fortifyTurns = 0;
      return moveUnitTo(state, u, action.to, emit);
    }
    case 'attack': {
      const u = unitOf(state, pid, action.unitId);
      if (!u) return 'Unit not found.';
      if (!state.map.tiles[action.target]) return 'Invalid tile.';
      return resolveAttack(state, u, action.target, emit);
    }
    case 'foundCity': {
      const u = unitOf(state, pid, action.unitId);
      if (!u) return 'Unit not found.';
      if (!UNITS[u.type]?.abilities?.includes('foundCity')) return 'This unit cannot build colonies.';
      if (u.moves <= 0) return 'The unit has no moves left.';
      const err = canFoundCity(state, pid, u.tile);
      if (err) return err;
      const tile = u.tile;
      delete state.units[u.id]; // the Hab Crawler unfolds into the colony
      foundCity(state, pid, tile, emit);
      return null;
    }
    case 'orbitalDrop':
      if (!state.map.tiles[action.tile]) return 'Invalid tile.';
      return orbitalDrop(state, pid, action.tile, emit);
    case 'thawColonists':
      return thawColonists(state, pid, action.cityId, emit);
    case 'rerollResearch':
      return rerollResearch(state, pid, emit);
    case 'unitOrder': {
      const u = unitOf(state, pid, action.unitId);
      if (!u) return 'Unit not found.';
      const order = action.order;
      if (!order) { u.order = null; u.fortifyTurns = 0; return null; }
      const civilian = UNITS[u.type]?.class === 'civilian';
      if (order.kind === 'fortify' && civilian) return 'Civilians cannot fortify.';
      if (order.kind === 'heal' && u.hp >= 100) return 'The unit is already at full health.';
      if (order.kind === 'goto') {
        if (!state.map.tiles[order.target]) return 'Invalid tile.';
        if (order.target === u.tile) return 'The unit is already there.';
        return moveUnitTo(state, u, order.target, emit);
      }
      if (u.order?.kind !== order.kind) u.fortifyTurns = 0;
      if (order.kind === 'explore') { exploreStep(state, u, emit); return null; }
      u.order = { ...order };
      return null;
    }
    case 'skipUnit': {
      const u = unitOf(state, pid, action.unitId);
      if (!u) return 'Unit not found.';
      u.moves = 0;
      return null;
    }
    case 'disband': {
      const u = unitOf(state, pid, action.unitId);
      if (!u) return 'Unit not found.';
      removeUnit(state, u.id, emit);
      return null;
    }
    case 'setProduction': {
      const c = cityOf(state, pid, action.cityId);
      if (!c) return 'Colony not found.';
      const err = canProduce(state, c, action.item);
      if (err) return err;
      if (sameItem(c.queue[0], action.item)) return null;
      if (action.item.kind !== 'unit' && action.item.kind !== 'project') {
        const at = c.queue.findIndex((q) => sameItem(q, action.item));
        if (at > 0) c.queue.splice(at, 1);
      }
      if (c.queue.length) c.queue[0] = { ...action.item };
      else c.queue.push({ ...action.item });
      return null;
    }
    case 'enqueue': {
      const c = cityOf(state, pid, action.cityId);
      if (!c) return 'Colony not found.';
      const err = canProduce(state, c, action.item);
      if (err) return err;
      if (c.queue.length >= MAX_QUEUE) return 'The list is full.';
      if (action.item.kind !== 'unit' && c.queue.some((q) => sameItem(q, action.item))) return 'Already in the list.';
      c.queue.push({ ...action.item });
      return null;
    }
    case 'dequeue': {
      const c = cityOf(state, pid, action.cityId);
      if (!c) return 'Colony not found.';
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= c.queue.length) return 'Invalid list slot.';
      c.queue.splice(action.index, 1);
      return null;
    }
    case 'buyItem': {
      const c = cityOf(state, pid, action.cityId);
      if (!c) return 'Colony not found.';
      const err = canProduce(state, c, action.item);
      if (err) return err;
      const cost = buyCost(state, c, action.item);
      if (cost == null) return `${productionItemName(action.item)} cannot be bought`;
      if (player.gold < cost) return `You need ${cost} Credits.`;
      addGold(state, pid, -cost, `Bought ${productionItemName(action.item)}`, emit);
      if (sameItem(c.queue[0], action.item)) {
        c.queue.shift();
        c.prodStored = 0;
      } else if (action.item.kind === 'building') {
        const at = c.queue.findIndex((q) => sameItem(q, action.item));
        if (at >= 0) c.queue.splice(at, 1);
      }
      completeItem(state, c, action.item, emit);
      return null;
    }
    case 'buildImprovement':
      return buildImprovement(state, pid, action.tile, action.improvement, emit);
    case 'setFocus': {
      const c = cityOf(state, pid, action.cityId);
      if (!c) return 'Colony not found.';
      c.focus = action.focus;
      refreshCity(state, c);
      return null;
    }
    case 'cityStrike': {
      const c = cityOf(state, pid, action.cityId);
      if (!c) return 'Colony not found.';
      return resolveCityStrike(state, c, action.target, emit);
    }
    case 'setResearch': {
      if (!TECHS[action.tech]) return 'Unknown research.';
      if (player.techs.includes(action.tech)) return 'You already know this.';
      if (!availableTechs(state, pid).includes(action.tech)) return 'You need other Research first.';
      if (player.isHuman && player.researchOffer.length && !player.researchOffer.includes(action.tech) && player.researching !== action.tech) {
        return 'Pick one of the three Research choices, or get new choices.';
      }
      player.researching = action.tech;
      return null;
    }
    case 'endTurn':
      return 'Use End Turn to end the turn.';
    default:
      return 'This is not a map action.';
  }
}

// ───────────────────────────── turn processing ─────────────────────────────

/** end-of-turn for one civ: cities (growth/production/borders), gold, research, happiness, bankruptcy */
function endPhase(state: GameState, pid: PlayerId, emit: Emit): void {
  const player = getPlayer(state, pid);
  if (!player.alive || pid === BARBARIAN) return;
  const fx = collectEffects(state, pid);
  updateHappiness(state, pid, emit, fx);
  const cities = citiesOf(state, pid);
  // yields snapshot before production changes anything this turn
  refreshAllCities(state, pid);
  const science = sciencePerTurn(state, pid);
  const culture = culturePerTurn(state, pid);
  const gold = goldPerTurn(state, pid);
  for (const c of cities) if (state.cities[c.id]?.owner === pid) processCity(state, c, emit, fx);
  addGold(state, pid, gold.net, 'Income', emit);
  processResearch(state, pid, science, emit);
  if (pid === HUMAN) {
    if (culture > 0) addStat(state, 'culture', culture);
    if (science > 0) addStat(state, 'science', science);
    if (gold.income > 0) addStat(state, 'gold', gold.income);
    // Military: the Production value of every combat unit you keep, counted each turn
    let army = 0;
    for (const u of Object.values(state.units)) {
      const def = UNITS[u.type];
      if (u.owner === pid && def && def.class !== 'civilian' && def.class !== 'recon') army += def.cost * PRODUCTION_PACE;
    }
    if (army > 0) addExtraStat(state, 'army', Math.round(army));
  }
  if (player.gold < 0) bankrupt(state, pid, emit);
  updateHappiness(state, pid, emit);
  refreshAllCities(state, pid);
}

/** negative treasury: disband the least valuable military unit (one per turn) */
function bankrupt(state: GameState, pid: PlayerId, emit: Emit): void {
  let pick: { id: number; cost: number } | null = null;
  for (const id in state.units) {
    const u = state.units[id];
    if (u.owner !== pid) continue;
    const d = UNITS[u.type];
    if (!d || d.class === 'civilian') continue;
    if (!pick || d.cost < pick.cost || (d.cost === pick.cost && u.id < pick.id)) pick = { id: u.id, cost: d.cost };
  }
  if (!pick) return;
  const u = state.units[pick.id];
  if (pid === HUMAN) emit({ type: 'notify', text: `You ran out of Credits. Your ${UNITS[u.type]?.name ?? 'unit'} left.`, icon: 'gold', tile: u.tile, tone: 'bad' });
  removeUnit(state, pick.id, emit);
}

function endTurn(state: GameState, emit: Emit): void {
  const turn = state.turn;
  emit({ type: 'turnEnd', turn, player: HUMAN });
  endPhase(state, HUMAN, emit);

  for (const p of state.players) {
    if (p.id === HUMAN || p.id === BARBARIAN || !p.alive) continue;
    if (state.gameOver) return;
    emit({ type: 'turnStart', turn, player: p.id });
    unitsTurnStart(state, p.id, emit);
    runHook(state, p.id, 'turnStart', emit, null);
    runAiTurn(state, p.id, emit);
    endPhase(state, p.id, emit);
    emit({ type: 'turnEnd', turn, player: p.id });
  }
  if (state.gameOver) return;

  emit({ type: 'turnStart', turn, player: BARBARIAN });
  unitsTurnStart(state, BARBARIAN, emit);
  runBarbarians(state, emit);
  emit({ type: 'turnEnd', turn, player: BARBARIAN });
  if (state.gameOver) return;

  // Mars takes its turn: storms hit where they stand, then drift so the forecast shows next round's strike
  advanceStorms(state, emit);
  if (state.gameOver) return;

  state.turn++;
  onTurnEnd(state, emit);
  if (state.gameOver) return;

  emit({ type: 'turnStart', turn: state.turn, player: HUMAN });
  unitsTurnStart(state, HUMAN, emit);
  runHook(state, HUMAN, 'turnStart', emit, null);
  ensureResearchOffer(state, HUMAN, emit);
  for (const p of state.players) if (p.alive) recomputeVisibility(state, p.id, emit);
  for (const p of state.players) if (p.alive && p.id !== BARBARIAN) refreshAllCities(state, p.id);
}
