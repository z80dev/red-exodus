// OWNER: SimCore. Cities: founding, territory, worked tiles, yields, growth, production, improvements, capture.
import type { ActiveEffect } from './effects';
import type { CostItem } from './defs';
import type {
  City, CityFocus, CityId, Emit, GameState, ImprovementId, Player, PlayerId, ProductionItem, Tile, TileIdx, Yields,
} from './types';
import { BARBARIAN, HUMAN, YIELD_KEYS } from './types';
import {
  BUILDINGS, ELEVATIONS, FEATURES, IMPROVEMENTS, LEADERS, NATURAL_WONDERS, RESOURCES, TECHS, TERRAINS, UNITS, WONDERS,
} from '../content';
import { collectEffects, makeCtx, runHook } from './effects';
import { addGold, connectedResources, effectLabel, getPlayer, round1, updateHappiness } from './economy';
import { hexDistance, neighbors, tilesInRadius } from './hex';
import { createUnit } from './units';
import { recomputeVisibility } from './visibility';
import { addExtraStat } from './roguelite';
import { randInt } from './rng';
import { STORM_YIELD_MUL, stormAt } from './mars';

// ───────────────────────────── tunables ─────────────────────────────
/** minimum hex distance between city centers (canFoundCity hook may lower it) */
export const CITY_MIN_DISTANCE = 3;
export const CITY_BASE_HP = 200;
export const CITY_HP_REGEN = 15;
/** territory & work radius */
export const MAX_CITY_RADIUS = 3;
export const FOUNDING_RADIUS = 1;
/** border threshold: BORDER_BASE + BORDER_PER × n^BORDER_EXP (n = tiles acquired by culture) */
export const BORDER_BASE = 10;
export const BORDER_PER = 8;
export const BORDER_EXP = 1.35;
/** growth threshold: GROWTH_BASE + GROWTH_PER × (pop−1) + (pop−1)^GROWTH_EXP */
export const GROWTH_BASE = 15;
export const GROWTH_PER = 6;
export const GROWTH_EXP = 1.8;
/** RED EXODUS pacing (≈1.6× faster per turn): multipliers on the raw formulas / authored costs, before hooks */
export const GROWTH_PACE = 1 / 1.6;
export const BORDER_PACE = 1 / 1.6;
export const PRODUCTION_PACE = 1 / 1.6;
export const FOOD_PER_POP = 2;
/** city center is always worked and yields at least this */
export const CENTER_MIN_YIELDS: Readonly<Yields> = { food: 2, prod: 1, gold: 1, sci: 0, cul: 0 };
/** every city: flat base yields (the settlement itself) */
export const CITY_BASE_YIELDS: Readonly<Yields> = { food: 0, prod: 0, gold: 0, sci: 1, cul: 1 };
/** every citizen: flat yields on top of its tile */
export const POP_YIELDS: Readonly<Yields> = { food: 0, prod: 0, gold: 0, sci: 0.5, cul: 0 };
/** citizens with no workable tile become specialists */
export const SPECIALIST_YIELDS: Readonly<Yields> = { food: 0, prod: 1, gold: 0, sci: 1, cul: 0 };
export const RIVER_GOLD = 1;
/** happiness below 0 halts growth; at/below this, all city yields suffer UNHAPPY_YIELD_PCT */
export const UNHAPPY_SEVERE = -10;
export const UNHAPPY_YIELD_PCT = -25;
/** gold purchase: BUY_LINEAR × remaining + remaining^BUY_EXP */
export const BUY_LINEAR = 2;
export const BUY_EXP = 1.15;
/** improvement cost: goldCost × (1 + IMPROVEMENT_SCALING × improvements owned) */
export const IMPROVEMENT_SCALING = 0.08;
export const IMPROVEMENT_REPAIR_FRACTION = 0.5;
export const SETTLER_MIN_POP = 2;
export const MAX_QUEUE = 6;
/** production stored while a city has nothing queued is capped at this many turns of output */
export const IDLE_PROD_TURNS = 3;
export const CAPTURE_BUILDING_LOSS = 1 / 3;
export const CAPTURE_HP_FRACTION = 0.25;
/** balanced focus aims for this food surplus before optimizing other yields */
export const BALANCED_FOOD_TARGET = 2;
export const FOCUS_WEIGHTS: Record<CityFocus, Yields> = {
  balanced: { food: 1.2, prod: 1.1, gold: 0.8, sci: 0.9, cul: 0.8 },
  food: { food: 3, prod: 0.8, gold: 0.4, sci: 0.4, cul: 0.4 },
  prod: { food: 0.9, prod: 3, gold: 0.4, sci: 0.4, cul: 0.4 },
  gold: { food: 0.9, prod: 0.6, gold: 3, sci: 0.4, cul: 0.4 },
  sci: { food: 0.9, prod: 0.6, gold: 0.4, sci: 3, cul: 0.4 },
  cul: { food: 0.9, prod: 0.6, gold: 0.4, sci: 0.4, cul: 3 },
};
const BORDER_RESOURCE_SCORE = { luxury: 6, strategic: 4, bonus: 3 } as const;
const BORDER_NATURAL_WONDER_SCORE = 5;

const NOOP: Emit = () => {};

// ───────────────────────────── yield helpers ─────────────────────────────

export function emptyYields(): Yields {
  return { food: 0, prod: 0, gold: 0, sci: 0, cul: 0 };
}

function addInto(out: Yields, y: Partial<Yields> | undefined, mul = 1): void {
  if (!y) return;
  for (const k of YIELD_KEYS) out[k] += (y[k] ?? 0) * mul;
}

function diff(after: Yields, before: Yields): Partial<Yields> | null {
  let any = false;
  const d: Partial<Yields> = {};
  for (const k of YIELD_KEYS) {
    const v = round1(after[k] - before[k]);
    if (v) { d[k] = v; any = true; }
  }
  return any ? d : null;
}

function isWater(t: Tile): boolean {
  return TERRAINS[t.terrain]?.water ?? (t.terrain === 'ocean' || t.terrain === 'coast' || t.terrain === 'lake');
}

/** adjacent to sea (coast/ocean) — harbors, naval units, coastal wonders */
export function isCoastal(state: GameState, tile: TileIdx): boolean {
  return neighbors(state.map, tile).some((n) => {
    const t = state.map.tiles[n].terrain;
    return t === 'coast' || t === 'ocean';
  });
}

function resourceVisible(player: Player | undefined, res: string): boolean {
  const tech = RESOURCES[res]?.revealTech;
  return !tech || !!player?.techs.includes(tech);
}

/** one breakdown line produced by a hook while computing tile/city yields */
export interface HookLine { label: string; yields: Partial<Yields>; pct?: Partial<Yields> }

function tileBase(t: Tile, player: Player | undefined): Yields {
  const y = emptyYields();
  addInto(y, TERRAINS[t.terrain]?.yields);
  if (t.feature) addInto(y, FEATURES[t.feature]?.yields);
  addInto(y, ELEVATIONS[t.elevation]?.yields);
  if (t.naturalWonder) addInto(y, NATURAL_WONDERS[t.naturalWonder]?.yields);
  if (t.resource && resourceVisible(player, t.resource)) {
    const r = RESOURCES[t.resource];
    if (r) {
      addInto(y, r.yields);
      if (t.improvement === r.improvement && !t.pillaged) addInto(y, r.improvedYields);
    }
  }
  if (t.improvement && !t.pillaged) addInto(y, IMPROVEMENTS[t.improvement]?.yields);
  if (t.riverEdges) y.gold += RIVER_GOLD;
  return y;
}

/** tile yields with per-source hook attribution (hooks only run for tiles owned by `pid`) */
export function tileYieldsDetailed(state: GameState, tile: TileIdx, pid: PlayerId, fx?: ActiveEffect[], hookLines?: HookLine[]): Yields {
  const t = state.map.tiles[tile];
  if (!t) return emptyYields();
  const player = pid === BARBARIAN ? undefined : getPlayer(state, pid);
  const y = tileBase(t, player);
  if (t.owner === pid && pid !== BARBARIAN) {
    const city = t.cityId != null ? state.cities[t.cityId] ?? null : null;
    const list = fx ?? collectEffects(state, pid);
    const args = { tile: t, city, yields: y };
    for (const f of list) {
      if (!f.hooks.tileYield) continue;
      if (hookLines) {
        const before = { ...y };
        f.hooks.tileYield(makeCtx(state, pid, f, NOOP), args);
        const d = diff(y, before);
        if (d) hookLines.push({ label: effectLabel(f), yields: d });
      } else {
        f.hooks.tileYield(makeCtx(state, pid, f, NOOP), args);
      }
    }
  }
  for (const k of YIELD_KEYS) y[k] = Math.max(0, y[k]);
  if (state.storms.length && stormAt(state, tile)) {
    const food = Math.floor(y.food * STORM_YIELD_MUL);
    const prod = Math.floor(y.prod * STORM_YIELD_MUL);
    if (hookLines && (food !== y.food || prod !== y.prod)) hookLines.push({ label: 'Dust storm', yields: { food: food - y.food, prod: prod - y.prod } });
    y.food = food;
    y.prod = prod;
  }
  return y;
}

export function tileYields(state: GameState, tile: TileIdx, pid: PlayerId, fx?: ActiveEffect[]): Yields {
  return tileYieldsDetailed(state, tile, pid, fx);
}

// ───────────────────────────── lookups ─────────────────────────────

export function cityAt(state: GameState, tile: TileIdx): City | null {
  const t = state.map.tiles[tile];
  if (t?.cityId != null) {
    const c = state.cities[t.cityId];
    if (c && c.tile === tile) return c;
  }
  return null;
}

export function citiesOf(state: GameState, pid: PlayerId): City[] {
  const out: City[] = [];
  for (const id in state.cities) if (state.cities[id].owner === pid) out.push(state.cities[id]);
  return out.sort((a, b) => a.order - b.order || a.id - b.id);
}

export function getCity(state: GameState, id: CityId): City | null {
  return state.cities[id] ?? null;
}

export function cityTerritory(state: GameState, city: City): TileIdx[] {
  return tilesInRadius(state.map, city.tile, MAX_CITY_RADIUS).filter((i) => state.map.tiles[i].cityId === city.id);
}

// ───────────────────────────── founding ─────────────────────────────

export function canFoundCity(state: GameState, pid: PlayerId, tile: TileIdx): string | null {
  const t = state.map.tiles[tile];
  if (!t) return 'Invalid tile';
  if (pid === BARBARIAN) return 'Ferals do not build colonies';
  if (isWater(t)) return 'Cannot land a colony on a dust sea';
  if (ELEVATIONS[t.elevation]?.impassable ?? t.elevation === 'mountain') return 'Cannot build on a massif';
  if (t.naturalWonder) return 'Cannot build on a landmark';
  if (cityAt(state, tile)) return 'There is already a colony here';
  if (t.owner != null && t.owner !== pid) return `Inside ${getPlayer(state, t.owner).civName} territory`;
  if (t.camp) return 'Clear the Feral Den first';
  const args: { tile: Tile; minDistance: number; allowed: boolean; reason?: string } = { tile: t, minDistance: CITY_MIN_DISTANCE, allowed: true };
  runHook(state, pid, 'canFoundCity', NOOP, null, args);
  if (!args.allowed) return args.reason ?? 'Cannot found a colony here';
  for (const id in state.cities) {
    const c = state.cities[id];
    if (hexDistance(state.map, c.tile, tile) < args.minDistance) return `Too close to ${c.name}`;
  }
  return null;
}

function nextOrder(state: GameState, pid: PlayerId): number {
  let max = -1;
  for (const id in state.cities) if (state.cities[id].owner === pid) max = Math.max(max, state.cities[id].order);
  return max + 1;
}

function cityName(state: GameState, player: Player): string {
  const names = LEADERS[player.leaderId]?.cityNames ?? [];
  const taken = new Set(Object.values(state.cities).map((c) => c.name));
  const i = player.citiesFounded;
  if (names.length) {
    if (i < names.length && !taken.has(names[i])) return names[i];
    for (const n of names) if (!taken.has(n)) return n;
    for (let k = 0; ; k++) {
      const n = `New ${names[(i + k) % names.length]}`;
      if (!taken.has(n)) return n;
      if (k > names.length) break;
    }
  }
  for (let k = i + 1; ; k++) {
    const n = `${player.civName} ${k}`;
    if (!taken.has(n)) return n;
  }
}

function claimTile(state: GameState, tile: TileIdx, city: City): void {
  const t = state.map.tiles[tile];
  t.owner = city.owner;
  t.cityId = city.id;
}

/** grant the palace & capital status */
function makeCapital(state: GameState, city: City): void {
  const p = getPlayer(state, city.owner);
  city.isCapital = true;
  if (BUILDINGS.palace && !city.buildings.includes('palace')) city.buildings.unshift('palace');
  p.capitalId = city.id;
  city.maxHp = cityMaxHp(city);
}

export function cityMaxHp(city: City): number {
  let hp = CITY_BASE_HP;
  for (const b of city.buildings) hp += BUILDINGS[b]?.cityHp ?? 0;
  return hp;
}

export function foundCity(state: GameState, pid: PlayerId, tile: TileIdx, emit: Emit): City {
  const player = getPlayer(state, pid);
  const t = state.map.tiles[tile];
  const city: City = {
    id: state.nextId++,
    owner: pid,
    originalOwner: pid,
    name: cityName(state, player),
    tile,
    pop: 1,
    foodStored: 0,
    prodStored: 0,
    queue: [],
    buildings: [],
    wonders: [],
    focus: 'balanced',
    worked: [],
    cultureStored: 0,
    hp: CITY_BASE_HP,
    maxHp: CITY_BASE_HP,
    isCapital: false,
    foundedTurn: state.turn,
    hasStruck: false,
    yields: emptyYields(),
    starving: false,
    order: nextOrder(state, pid),
  };
  state.cities[city.id] = city;
  player.citiesFounded++;
  if (player.capitalId == null || !state.cities[player.capitalId]) makeCapital(state, city);
  city.hp = city.maxHp;

  t.camp = false;
  t.ruin = false;
  t.road = true;
  claimTile(state, tile, city);
  for (const i of tilesInRadius(state.map, tile, FOUNDING_RADIUS)) {
    if (i !== tile && state.map.tiles[i].owner == null) claimTile(state, i, city);
  }
  emit({ type: 'cityFounded', cityId: city.id, player: pid, tile });
  const fx = collectEffects(state, pid);
  updateHappiness(state, pid, emit, fx);
  refreshCity(state, city, fx);
  recomputeVisibility(state, pid, emit);
  return city;
}

// ───────────────────────────── worked tiles & yields ─────────────────────────────

/** tiles standing under a military unit of someone at war with `pid` */
function enemyOccupied(state: GameState, pid: PlayerId): Set<TileIdx> {
  const out = new Set<TileIdx>();
  const rel = getPlayer(state, pid).relations;
  for (const id in state.units) {
    const u = state.units[id];
    if (u.owner === pid) continue;
    if (u.owner !== BARBARIAN && rel[u.owner] !== 'war') continue;
    if (UNITS[u.type]?.class === 'civilian') continue;
    out.add(u.tile);
  }
  return out;
}

/** flat yields that don't depend on worked tiles: base, population, buildings, wonders (for food planning) */
function nonTileFlats(city: City): Yields {
  const y = emptyYields();
  addInto(y, CITY_BASE_YIELDS);
  addInto(y, POP_YIELDS, city.pop);
  for (const b of city.buildings) {
    const d = BUILDINGS[b];
    if (!d) continue;
    addInto(y, d.yields);
    addInto(y, d.perPop, city.pop);
  }
  for (const w of city.wonders) addInto(y, WONDERS[w]?.yields);
  return y;
}

function centerYields(y: Yields): Yields {
  const out = { ...y };
  for (const k of YIELD_KEYS) out[k] = Math.max(out[k], CENTER_MIN_YIELDS[k]);
  return out;
}

/**
 * Choose worked tiles by focus score, then swap toward the food target (never starve when avoidable;
 * balanced focus aims for a small surplus).
 */
function chooseWorked(city: City, cands: { idx: TileIdx; y: Yields }[], baseFood: number): TileIdx[] {
  const w = FOCUS_WEIGHTS[city.focus];
  const scored = cands.map((c) => ({ ...c, s: YIELD_KEYS.reduce((s, k) => s + c.y[k] * w[k], 0) }));
  scored.sort((a, b) => b.s - a.s || b.y.food - a.y.food || a.idx - b.idx);
  const n = Math.min(city.pop, scored.length);
  const chosen = scored.slice(0, n);
  const rest = scored.slice(n);
  if (city.focus !== 'food') {
    const target = city.focus === 'balanced' ? BALANCED_FOOD_TARGET : 0;
    const consumption = city.pop * FOOD_PER_POP;
    let food = baseFood + chosen.reduce((s, c) => s + c.y.food, 0);
    while (food - consumption < target) {
      let best = -1;
      let bestJ = -1;
      let bestMetric = Infinity;
      for (let i = 0; i < chosen.length; i++) {
        for (let j = 0; j < rest.length; j++) {
          const gain = rest[j].y.food - chosen[i].y.food;
          if (gain <= 0) continue;
          const metric = (chosen[i].s - rest[j].s) / gain;
          if (metric < bestMetric) { bestMetric = metric; best = i; bestJ = j; }
        }
      }
      if (best < 0) break;
      const tmp = chosen[best];
      chosen[best] = rest[bestJ];
      rest[bestJ] = tmp;
      food = baseFood + chosen.reduce((s, c) => s + c.y.food, 0);
    }
  }
  return chosen.map((c) => c.idx).sort((a, b) => a - b);
}

export interface CityYieldResult {
  flat: Yields;
  pct: Yields;
  /** final yields, food = net surplus after consumption */
  total: Yields;
  worked: TileIdx[];
  specialists: number;
  consumption: number;
}

/**
 * Full city yield pipeline. When `lines` is passed, every contribution is recorded by source (UI breakdown).
 * Does NOT mutate the city unless `commit` is true (then worked/yields/maxHp are stored).
 */
export function computeCityYields(
  state: GameState,
  city: City,
  fx: ActiveEffect[],
  opts: { lines?: { label: string; kind: string; yields: Partial<Yields>; pct?: Partial<Yields> }[]; occupied?: Set<TileIdx> } = {},
): CityYieldResult {
  const pid = city.owner;
  const player = getPlayer(state, pid);
  const lines = opts.lines;
  const occupied = opts.occupied ?? enemyOccupied(state, pid);

  // center
  const centerHook: HookLine[] | undefined = lines ? [] : undefined;
  const center = centerYields(tileYieldsDetailed(state, city.tile, pid, fx, centerHook));

  // candidate tiles
  const tileHooks: HookLine[] | undefined = lines ? [] : undefined;
  const cands: { idx: TileIdx; y: Yields }[] = [];
  for (const i of tilesInRadius(state.map, city.tile, MAX_CITY_RADIUS)) {
    if (i === city.tile) continue;
    const t = state.map.tiles[i];
    if (t.cityId !== city.id || occupied.has(i)) continue;
    cands.push({ idx: i, y: tileYieldsDetailed(state, i, pid, fx) });
  }
  const flats = nonTileFlats(city);
  const worked = chooseWorked(city, cands, center.food + flats.food);
  const specialists = Math.max(0, city.pop - worked.length);

  const flat = emptyYields();
  addInto(flat, center);
  const workedSet = new Set(worked);
  const tilesSum = emptyYields();
  for (const c of cands) if (workedSet.has(c.idx)) addInto(tilesSum, c.y);
  addInto(flat, tilesSum);
  addInto(flat, SPECIALIST_YIELDS, specialists);
  addInto(flat, CITY_BASE_YIELDS);
  addInto(flat, POP_YIELDS, city.pop);
  const pct = emptyYields();

  if (lines) {
    lines.push({ label: 'Colony core', kind: 'center', yields: { ...center } });
    // attribute tile hook deltas of worked tiles by source
    for (const i of worked) tileYieldsDetailed(state, i, pid, fx, tileHooks);
    lines.push({ label: `Worked tiles (${worked.length})`, kind: 'tiles', yields: { ...tilesSum } });
    for (const h of [...(centerHook ?? []), ...(tileHooks ?? [])]) {
      const existing = lines.find((l) => l.kind === 'effect' && l.label === h.label);
      if (existing) addInto(existing.yields as Yields, h.yields);
      else lines.push({ label: h.label, kind: 'effect', yields: { ...emptyYields(), ...h.yields } });
    }
    if (specialists) {
      const y = emptyYields();
      addInto(y, SPECIALIST_YIELDS, specialists);
      lines.push({ label: `Specialists (${specialists})`, kind: 'specialists', yields: y });
    }
    lines.push({ label: 'Settlement', kind: 'base', yields: { ...CITY_BASE_YIELDS } });
    const py = emptyYields();
    addInto(py, POP_YIELDS, city.pop);
    lines.push({ label: `Colonists (${city.pop})`, kind: 'population', yields: py });
  }

  for (const b of city.buildings) {
    const d = BUILDINGS[b];
    if (!d) continue;
    const y = emptyYields();
    addInto(y, d.yields);
    addInto(y, d.perPop, city.pop);
    addInto(flat, y);
    addInto(pct, d.pct);
    if (lines && (diff(y, emptyYields()) || d.pct)) lines.push({ label: d.name, kind: 'building', yields: y, pct: d.pct ? { ...d.pct } : undefined });
  }
  for (const wId of city.wonders) {
    const d = WONDERS[wId];
    if (!d) continue;
    addInto(flat, d.yields);
    if (lines && d.yields && Object.keys(d.yields).length) lines.push({ label: d.name, kind: 'wonder', yields: { ...d.yields } });
  }

  // cityYield hooks (flats mutate yields, percentages add to pct)
  const args = { city, yields: flat, pct };
  for (const f of fx) {
    if (!f.hooks.cityYield) continue;
    if (lines) {
      const fb = { ...flat };
      const pb = { ...pct };
      f.hooks.cityYield(makeCtx(state, pid, f, NOOP), args);
      const dy = diff(flat, fb);
      const dp = diff(pct, pb);
      if (dy || dp) lines.push({ label: effectLabel(f), kind: 'effect', yields: dy ?? {}, pct: dp ?? undefined });
    } else {
      f.hooks.cityYield(makeCtx(state, pid, f, NOOP), args);
    }
  }

  if (player.happiness <= UNHAPPY_SEVERE) {
    for (const k of YIELD_KEYS) pct[k] += UNHAPPY_YIELD_PCT;
    if (lines) {
      const p = emptyYields();
      for (const k of YIELD_KEYS) p[k] = UNHAPPY_YIELD_PCT;
      lines.push({ label: 'Widespread unrest', kind: 'happiness', yields: {}, pct: p });
    }
  }

  const consumption = city.pop * FOOD_PER_POP;
  const total = emptyYields();
  for (const k of YIELD_KEYS) {
    const v = Math.max(0, flat[k]) * Math.max(0, 1 + pct[k] / 100);
    total[k] = round1(Number.isFinite(v) ? v : 0);
  }
  total.food = round1(total.food - consumption);
  if (lines) lines.push({ label: `Colonists eat (${city.pop})`, kind: 'consumption', yields: { food: -consumption } });
  for (const k of YIELD_KEYS) { flat[k] = round1(flat[k]); pct[k] = round1(pct[k]); }
  return { flat, pct, total, worked, specialists, consumption };
}

export function refreshCity(state: GameState, city: City, fx?: ActiveEffect[]): Yields {
  return refreshCityWith(state, city, fx ?? collectEffects(state, city.owner));
}

function refreshCityWith(state: GameState, city: City, fx: ActiveEffect[], occupied?: Set<TileIdx>): Yields {
  const r = computeCityYields(state, city, fx, { occupied });
  city.worked = r.worked;
  city.yields = r.total;
  city.maxHp = cityMaxHp(city);
  if (city.hp > city.maxHp) city.hp = city.maxHp;
  city.starving = r.total.food < 0;
  return r.total;
}

export function refreshAllCities(state: GameState, pid: PlayerId): void {
  const cities = citiesOf(state, pid);
  if (!cities.length) return;
  const fx = collectEffects(state, pid);
  const occupied = enemyOccupied(state, pid);
  for (const c of cities) refreshCityWith(state, c, fx, occupied);
}

// ───────────────────────────── thresholds ─────────────────────────────

export function growthThreshold(state: GameState, city: City): number {
  const n = Math.max(0, city.pop - 1);
  const args = { city, value: (GROWTH_BASE + GROWTH_PER * n + Math.pow(n, GROWTH_EXP)) * GROWTH_PACE };
  if (city.owner !== BARBARIAN) runHook(state, city.owner, 'growthThreshold', NOOP, null, args);
  return Math.max(1, Math.round(args.value));
}

/** tiles acquired through culture so far (territory beyond the founding ring) */
export function bordersAcquired(state: GameState, city: City): number {
  return Math.max(0, cityTerritory(state, city).length - tilesInRadius(state.map, city.tile, FOUNDING_RADIUS).length);
}

export function borderThreshold(state: GameState, city: City): number {
  const n = bordersAcquired(state, city);
  const args = { city, value: (BORDER_BASE + BORDER_PER * Math.pow(n, BORDER_EXP)) * BORDER_PACE };
  if (city.owner !== BARBARIAN) runHook(state, city.owner, 'borderThreshold', NOOP, null, args);
  return Math.max(1, Math.round(args.value));
}

/** best unowned tile adjacent to this city's territory within MAX_CITY_RADIUS, or -1 */
export function nextBorderTile(state: GameState, city: City): TileIdx {
  const map = state.map;
  const player = getPlayer(state, city.owner);
  let best = -1;
  let bestScore = -Infinity;
  for (const i of tilesInRadius(map, city.tile, MAX_CITY_RADIUS)) {
    const t = map.tiles[i];
    if (t.owner != null) continue;
    if (!neighbors(map, i).some((n) => map.tiles[n].cityId === city.id)) continue;
    const y = tileBase(t, player);
    let s = y.food * 1.2 + y.prod * 1.1 + y.gold * 0.8 + y.sci + y.cul;
    if (t.resource && resourceVisible(player, t.resource)) s += BORDER_RESOURCE_SCORE[RESOURCES[t.resource]?.kind ?? 'bonus'];
    if (t.naturalWonder) s += BORDER_NATURAL_WONDER_SCORE;
    s -= 0.6 * hexDistance(map, city.tile, i);
    if (s > bestScore || (s === bestScore && i < best)) { bestScore = s; best = i; }
  }
  return best;
}

// ───────────────────────────── production ─────────────────────────────

export function productionItemName(item: ProductionItem): string {
  switch (item.kind) {
    case 'unit': return UNITS[item.id]?.name ?? item.id;
    case 'building': return BUILDINGS[item.id]?.name ?? item.id;
    case 'wonder': return WONDERS[item.id]?.name ?? item.id;
    case 'project': return item.id === 'wealth' ? 'Credit Drive' : item.id === 'research' ? 'Data Sprint' : 'Festival';
  }
}

export function sameItem(a: ProductionItem | undefined, b: ProductionItem): boolean {
  return !!a && a.kind === b.kind && a.id === b.id;
}

export function productionCost(state: GameState, city: City, item: ProductionItem): number {
  let base: number;
  switch (item.kind) {
    case 'unit': base = UNITS[item.id]?.cost ?? Infinity; break;
    case 'building': base = BUILDINGS[item.id]?.cost ?? Infinity; break;
    case 'wonder': base = WONDERS[item.id]?.cost ?? Infinity; break;
    case 'project': return 0;
  }
  if (!Number.isFinite(base)) return Infinity;
  const args = { city, item: item as CostItem, currency: 'prod' as const, cost: base * PRODUCTION_PACE };
  if (city.owner !== BARBARIAN) runHook(state, city.owner, 'cost', NOOP, null, args);
  return Math.max(1, Math.round(args.cost));
}

export function buyCost(state: GameState, city: City, item: ProductionItem): number | null {
  if (item.kind === 'wonder' || item.kind === 'project') return null;
  if (canProduce(state, city, item)) return null;
  const cost = productionCost(state, city, item);
  if (!Number.isFinite(cost)) return null;
  const remaining = Math.max(1, cost - (sameItem(city.queue[0], item) ? city.prodStored : 0));
  const args = { city, item: item as CostItem, currency: 'gold' as const, cost: BUY_LINEAR * remaining + Math.pow(remaining, BUY_EXP) };
  runHook(state, city.owner, 'cost', NOOP, null, args);
  return Math.max(1, Math.round(args.cost));
}

/** the unit type this player actually builds for a base id (leader uniques replace base units) */
function ownUnitVariant(leaderId: string, id: string): string {
  for (const uid in UNITS) {
    const u = UNITS[uid];
    if (u.uniqueTo === leaderId && u.replaces === id) return uid;
  }
  return id;
}

function unitReason(state: GameState, city: City, player: Player, id: string, conn: Set<string>): string | null {
  const d = UNITS[id];
  if (!d) return 'Unknown unit';
  if (d.uniqueTo && d.uniqueTo !== player.leaderId) return 'Unique to another nation';
  if (!d.uniqueTo && ownUnitVariant(player.leaderId, id) !== id) return `Replaced by ${UNITS[ownUnitVariant(player.leaderId, id)].name}`;
  if (d.tech && !player.techs.includes(d.tech)) return `Requires ${TECHS[d.tech]?.name ?? d.tech}`;
  if (d.resource && !conn.has(d.resource)) return `Requires ${RESOURCES[d.resource]?.name ?? d.resource}`;
  if (d.class === 'naval' && !isCoastal(state, city.tile)) return 'Requires a colony on the dust shore';
  if (d.abilities?.includes('foundCity') && city.pop < SETTLER_MIN_POP) return `Requires ${SETTLER_MIN_POP} population`;
  return null;
}

/** military unit whose upgrade target is already buildable here */
function unitObsolete(state: GameState, city: City, player: Player, id: string, conn: Set<string>): boolean {
  const d = UNITS[id];
  if (!d?.upgradesTo) return false;
  const to = ownUnitVariant(player.leaderId, d.upgradesTo);
  return !!UNITS[to] && unitReason(state, city, player, to, conn) == null;
}

function buildingReason(state: GameState, city: City, player: Player, id: string): string | null {
  const d = BUILDINGS[id];
  if (!d) return 'Unknown building';
  if (id === 'palace') return 'Only the Ark Hab has Ark Hab Command';
  if (d.cost <= 0) return 'Cannot be built';
  if (city.buildings.includes(id)) return 'Already built';
  if (d.uniqueTo && d.uniqueTo !== player.leaderId) return 'Unique to another nation';
  if (!d.uniqueTo) {
    for (const bid in BUILDINGS) {
      const u = BUILDINGS[bid];
      if (u.uniqueTo === player.leaderId && u.replaces === id) return `Replaced by ${u.name}`;
    }
  }
  if (d.replaces && city.buildings.includes(d.replaces)) return 'Already built';
  if (d.tech && !player.techs.includes(d.tech)) return `Requires ${TECHS[d.tech]?.name ?? d.tech}`;
  if (d.requires && !city.buildings.includes(d.requires) && !city.buildings.some((b) => BUILDINGS[b]?.replaces === d.requires)) {
    return `Requires ${BUILDINGS[d.requires]?.name ?? d.requires}`;
  }
  if (d.coastal && !isCoastal(state, city.tile)) return 'Requires a colony on the dust shore';
  if (d.river && !state.map.tiles[city.tile].riverEdges) return 'Requires an ancient channel';
  return null;
}

function wonderReason(state: GameState, city: City, player: Player, id: string): string | null {
  const d = WONDERS[id];
  if (!d) return 'Unknown wonder';
  const ownerCity = state.wonderOwners[id];
  if (ownerCity != null) {
    const c = state.cities[ownerCity];
    return c ? `Built in ${c.name}` : 'Already built';
  }
  if (d.tech && !player.techs.includes(d.tech)) return `Requires ${TECHS[d.tech]?.name ?? d.tech}`;
  if (d.requiresCoastal && !isCoastal(state, city.tile)) return 'Requires a colony on the dust shore';
  if (d.requiresRiver && !state.map.tiles[city.tile].riverEdges) return 'Requires an ancient channel';
  if (d.requiresTerrain?.length) {
    const near = [city.tile, ...neighbors(state.map, city.tile)];
    if (!near.some((i) => d.requiresTerrain!.includes(state.map.tiles[i].terrain))) {
      return `Requires ${d.requiresTerrain.map((t) => TERRAINS[t]?.name ?? t).join(' or ')} nearby`;
    }
  }
  return null;
}

/** null when producible. `conn` = precomputed connected resources */
export function productionReason(state: GameState, city: City, item: ProductionItem, conn?: Set<string>): string | null {
  const player = getPlayer(state, city.owner);
  if (city.owner === BARBARIAN) return 'Barbarians do not build';
  switch (item.kind) {
    case 'unit': return unitReason(state, city, player, item.id, conn ?? connectedResources(state, city.owner));
    case 'building': return buildingReason(state, city, player, item.id);
    case 'wonder': return wonderReason(state, city, player, item.id);
    case 'project':
      if (item.id === 'festival' && !player.isHuman) return 'Festivals are for the chronicle';
      return item.id === 'wealth' || item.id === 'research' || item.id === 'festival' ? null : 'Unknown project';
  }
}

export function canProduce(state: GameState, city: City, item: ProductionItem): string | null {
  return productionReason(state, city, item);
}

export function availableProduction(state: GameState, city: City): ProductionItem[] {
  const player = getPlayer(state, city.owner);
  const conn = connectedResources(state, city.owner);
  const out: ProductionItem[] = [];
  for (const id in UNITS) {
    if (unitReason(state, city, player, id, conn) == null && !unitObsolete(state, city, player, id, conn)) out.push({ kind: 'unit', id });
  }
  for (const id in BUILDINGS) if (buildingReason(state, city, player, id) == null) out.push({ kind: 'building', id });
  for (const id in WONDERS) if (wonderReason(state, city, player, id) == null) out.push({ kind: 'wonder', id });
  out.push({ kind: 'project', id: 'wealth' }, { kind: 'project', id: 'research' });
  if (player.isHuman) out.push({ kind: 'project', id: 'festival' });
  return out;
}

/** exported for selectors: obsolete units are hidden from menus */
export function isUnitObsolete(state: GameState, city: City, id: string): boolean {
  return unitObsolete(state, city, getPlayer(state, city.owner), id, connectedResources(state, city.owner));
}

export function turnsToComplete(state: GameState, city: City, item: ProductionItem): number {
  if (item.kind === 'project') return Infinity;
  const cost = productionCost(state, city, item);
  const stored = sameItem(city.queue[0], item) ? city.prodStored : 0;
  const remaining = cost - stored;
  if (remaining <= 0) return 1;
  const prod = city.yields.prod;
  return prod > 0 ? Math.ceil(remaining / prod) : Infinity;
}

function onGainFor(state: GameState, city: City, kind: 'building' | 'wonder', id: string, emit: Emit): void {
  const f = collectEffects(state, city.owner).find((e) => e.kind === kind && e.id === id && e.cityId === city.id);
  if (f?.hooks.onGain) f.hooks.onGain(makeCtx(state, city.owner, f, emit));
}

/** wonder race: everyone else building it loses it (production stays for their next item) */
function resolveWonderRace(state: GameState, winner: City, id: string, emit: Emit): void {
  for (const cid in state.cities) {
    const c = state.cities[cid];
    if (c.id === winner.id) continue;
    const had = c.queue.some((q) => q.kind === 'wonder' && q.id === id);
    if (!had) continue;
    c.queue = c.queue.filter((q) => !(q.kind === 'wonder' && q.id === id));
    emit({ type: 'wonderLost', cityId: c.id, wonder: id, by: winner.owner });
    if (c.owner === HUMAN) {
      emit({ type: 'notify', text: `${getPlayer(state, winner.owner).civName} finished ${WONDERS[id]?.name ?? id} first — ${c.name}'s Industry carries over.`, icon: 'wonder', tile: c.tile, tone: 'bad' });
    }
  }
}

/** returns false when the item could not be completed (e.g. no room for a unit) */
function completeItemInner(state: GameState, city: City, item: ProductionItem, emit: Emit): boolean {
  switch (item.kind) {
    case 'unit': {
      const d = UNITS[item.id];
      if (!d) return false;
      // tag the spawn with its city (barracks-style XP hooks listen for unitCreated.cityId)
      const u = createUnit(state, city.owner, item.id, city.tile, (ev) => emit(ev.type === 'unitCreated' ? { ...ev, cityId: city.id } : ev));
      if (!u) {
        if (city.owner === HUMAN) emit({ type: 'notify', text: `${city.name} has no room for a new ${d.name}.`, icon: 'city', tile: city.tile, tone: 'bad' });
        return false;
      }
      if (d.abilities?.includes('foundCity') && city.pop > 1) city.pop -= 1;
      break;
    }
    case 'building': {
      const d = BUILDINGS[item.id];
      if (!d || city.buildings.includes(item.id)) return false;
      city.buildings.push(item.id);
      city.maxHp = cityMaxHp(city);
      city.hp = Math.min(city.maxHp, city.hp + (d.cityHp ?? 0));
      emit({ type: 'buildingBuilt', cityId: city.id, player: city.owner, building: item.id });
      onGainFor(state, city, 'building', item.id, emit);
      break;
    }
    case 'wonder': {
      if (!WONDERS[item.id] || state.wonderOwners[item.id] != null) return false;
      city.wonders.push(item.id);
      state.wonderOwners[item.id] = city.id;
      emit({ type: 'wonderBuilt', cityId: city.id, player: city.owner, wonder: item.id });
      resolveWonderRace(state, city, item.id, emit);
      onGainFor(state, city, 'wonder', item.id, emit);
      break;
    }
    case 'project':
      return true;
  }
  if (item.kind !== 'unit') updateHappiness(state, city.owner, emit);
  refreshCity(state, city);
  return true;
}

export function completeItem(state: GameState, city: City, item: ProductionItem, emit: Emit): void {
  completeItemInner(state, city, item, emit);
}

/** cheapest useful building, else wealth — safety net for AI cities left with an empty queue */
function fallbackProduction(state: GameState, city: City): ProductionItem {
  let best: ProductionItem = { kind: 'project', id: 'wealth' };
  let bestCost = Infinity;
  for (const it of availableProduction(state, city)) {
    if (it.kind !== 'building') continue;
    const c = productionCost(state, city, it);
    if (c < bestCost) { bestCost = c; best = it; }
  }
  return best;
}

function processProduction(state: GameState, city: City, emit: Emit): void {
  const prod = Math.max(0, city.yields.prod);
  const player = getPlayer(state, city.owner);
  if (!city.queue.length && !player.isHuman) city.queue.push(fallbackProduction(state, city));
  // drop items that became impossible (wonder taken, building replaced, ...)
  while (city.queue.length) {
    const reason = canProduce(state, city, city.queue[0]);
    if (!reason) break;
    const dropped = city.queue.shift()!;
    if (city.owner === HUMAN) emit({ type: 'notify', text: `${city.name} can no longer build ${productionItemName(dropped)}: ${reason}.`, icon: 'city', tile: city.tile, tone: 'info' });
  }
  const item = city.queue[0];
  if (!item) {
    city.prodStored = round1(Math.min(city.prodStored + prod, Math.max(city.prodStored, prod * IDLE_PROD_TURNS)));
    return;
  }
  if (item.kind === 'project') {
    // wealth & research are converted empire-wide (goldPerTurn / sciencePerTurn); festival feeds the Chronicle
    if (item.id === 'festival' && city.owner === HUMAN && prod > 0) {
      addExtraStat(state, 'festival', prod);
      emit({ type: 'renownGained', amount: prod, label: `Festival in ${city.name}`, tile: city.tile });
    }
    return;
  }
  city.prodStored = round1(city.prodStored + prod);
  const cost = productionCost(state, city, item);
  if (city.prodStored < cost) return;
  if (completeItemInner(state, city, item, emit)) {
    city.prodStored = round1(city.prodStored - cost);
    city.queue.shift();
  } else {
    city.prodStored = cost;
  }
}

// ───────────────────────────── per-turn processing ─────────────────────────────

function processGrowth(state: GameState, city: City, emit: Emit): void {
  const player = getPlayer(state, city.owner);
  const surplus = city.yields.food;
  if (surplus > 0 && player.happiness < 0) return; // unrest: no growth
  city.foodStored = round1(city.foodStored + surplus);
  const threshold = growthThreshold(state, city);
  if (city.foodStored >= threshold) {
    city.pop += 1;
    city.foodStored = 0;
    emit({ type: 'cityGrew', cityId: city.id, player: city.owner, pop: city.pop });
  } else if (city.foodStored < 0) {
    city.foodStored = 0;
    if (city.pop > 1) {
      city.pop -= 1;
      emit({ type: 'cityStarved', cityId: city.id, player: city.owner, pop: city.pop });
    }
  }
}

function processBorders(state: GameState, city: City, emit: Emit): void {
  city.cultureStored = round1(city.cultureStored + Math.max(0, city.yields.cul));
  const threshold = borderThreshold(state, city);
  if (city.cultureStored < threshold) return;
  const tile = nextBorderTile(state, city);
  if (tile < 0) {
    city.cultureStored = threshold;
    return;
  }
  city.cultureStored = round1(city.cultureStored - threshold);
  claimTile(state, tile, city);
  emit({ type: 'borderGrew', cityId: city.id, player: city.owner, tiles: [tile] });
}

export function processCity(state: GameState, city: City, emit: Emit, fx?: ActiveEffect[]): void {
  refreshCity(state, city, fx);
  processGrowth(state, city, emit);
  processProduction(state, city, emit);
  if (!state.cities[city.id]) return;
  processBorders(state, city, emit);
  city.hp = Math.min(city.maxHp, city.hp + CITY_HP_REGEN);
  city.hasStruck = false;
  refreshCity(state, city);
}

export function changePop(state: GameState, city: City, delta: number, emit: Emit): void {
  const before = city.pop;
  city.pop = Math.max(1, Math.round(city.pop + delta));
  if (city.pop > before) {
    for (let p = before + 1; p <= city.pop; p++) emit({ type: 'cityGrew', cityId: city.id, player: city.owner, pop: p });
  } else if (city.pop < before) {
    emit({ type: 'cityStarved', cityId: city.id, player: city.owner, pop: city.pop });
  }
  if (city.pop !== before) {
    updateHappiness(state, city.owner, emit);
    refreshCity(state, city);
  }
}

// ───────────────────────────── improvements ─────────────────────────────

function improvementsOwned(state: GameState, pid: PlayerId): number {
  let n = 0;
  for (const t of state.map.tiles) if (t.owner === pid && t.improvement) n++;
  return n;
}

function improvementReason(state: GameState, pid: PlayerId, t: Tile, id: ImprovementId): string | null {
  const d = IMPROVEMENTS[id];
  if (!d) return 'Unknown improvement';
  const player = getPlayer(state, pid);
  if (t.owner !== pid) return 'Must be inside your borders';
  if (cityAt(state, t.idx)) return 'Cannot improve a city center';
  if (t.naturalWonder) return 'Natural wonders cannot be improved';
  if (t.improvement === id && !t.pillaged) return 'Already built';
  if (d.tech && !player.techs.includes(d.tech)) return `Requires ${TECHS[d.tech]?.name ?? d.tech}`;
  const water = isWater(t);
  const r = t.resource && resourceVisible(player, t.resource) ? RESOURCES[t.resource] : undefined;
  // a tile whose (revealed) resource is connected by this improvement always accepts it
  if (r?.improvement === id) return null;
  if (d.requiresResource) return 'Requires a matching resource';
  if (!!d.water !== water) return d.water ? 'Must be on water' : 'Cannot be built on water';
  if (d.terrains && !d.terrains.includes(t.terrain)) return `Requires ${d.terrains.map((x) => TERRAINS[x]?.name ?? x).join(' or ')}`;
  if (d.elevations && !d.elevations.includes(t.elevation)) return `Requires ${d.elevations.map((x) => ELEVATIONS[x]?.name ?? x).join(' or ')}`;
  if (!d.elevations && ELEVATIONS[t.elevation]?.impassable) return 'Cannot build on mountains';
  if (t.feature && !d.features?.includes(t.feature)) return `Cannot be built on ${FEATURES[t.feature]?.name ?? t.feature}`;
  if (d.requiresRiverOrLake && !t.riverEdges && !neighbors(state.map, t.idx).some((n) => state.map.tiles[n].terrain === 'lake')) {
    return 'Requires a river or lake';
  }
  if (d.coastal && !isCoastal(state, t.idx)) return 'Must be on the coast';
  return null;
}

/** `owned` = precomputed improvement count for pid (hot loops) */
export function improvementCost(state: GameState, pid: PlayerId, tile: TileIdx, id: ImprovementId, owned?: number): number {
  const d = IMPROVEMENTS[id];
  if (!d) return Infinity;
  const t = state.map.tiles[tile];
  let cost = d.goldCost * (1 + IMPROVEMENT_SCALING * (owned ?? improvementsOwned(state, pid)));
  if (t?.improvement === id && t.pillaged) cost = d.goldCost * IMPROVEMENT_REPAIR_FRACTION;
  const city = t?.cityId != null ? state.cities[t.cityId] ?? null : null;
  const args = { city, item: { kind: 'improvement' as const, id }, currency: 'gold' as const, cost };
  if (pid !== BARBARIAN) runHook(state, pid, 'cost', NOOP, null, args);
  return Math.max(0, Math.round(args.cost));
}

/** `placeable` = valid tile & tech known (ignores gold); `error` also reports unaffordable */
export function improvementOptions(state: GameState, pid: PlayerId, tile: TileIdx): { id: ImprovementId; cost: number; error: string | null; placeable: boolean }[] {
  const t = state.map.tiles[tile];
  if (!t) return [];
  const player = getPlayer(state, pid);
  const out: { id: ImprovementId; cost: number; error: string | null; placeable: boolean }[] = [];
  const owned = improvementsOwned(state, pid);
  for (const id in IMPROVEMENTS) {
    // hide options that can never apply to this tile's kind (water vs land)
    if (!!IMPROVEMENTS[id].water !== isWater(t)) continue;
    const cost = improvementCost(state, pid, tile, id, owned);
    const reason = improvementReason(state, pid, t, id);
    out.push({ id, cost, placeable: reason == null, error: reason ?? (player.gold < cost ? `Need ${cost} gold` : null) });
  }
  return out.sort((a, b) => Number(b.placeable) - Number(a.placeable) || (a.error ? 1 : 0) - (b.error ? 1 : 0) || a.cost - b.cost || (a.id < b.id ? -1 : 1));
}

export function buildImprovement(state: GameState, pid: PlayerId, tile: TileIdx, id: ImprovementId, emit: Emit): string | null {
  const t = state.map.tiles[tile];
  if (!t) return 'Invalid tile';
  const err = improvementReason(state, pid, t, id);
  if (err) return err;
  const cost = improvementCost(state, pid, tile, id);
  const player = getPlayer(state, pid);
  if (player.gold < cost) return `Need ${cost} gold`;
  addGold(state, pid, -cost, `${IMPROVEMENTS[id].name}`, emit);
  t.improvement = id;
  t.pillaged = false;
  if (IMPROVEMENTS[id].removesFeature && t.feature && !IMPROVEMENTS[id].features?.includes(t.feature)) t.feature = null;
  emit({ type: 'improvementBuilt', tile, player: pid, improvement: id });
  updateHappiness(state, pid, emit);
  if (t.cityId != null && state.cities[t.cityId]) refreshCity(state, state.cities[t.cityId]);
  return null;
}

// ───────────────────────────── capture ─────────────────────────────

function relocatePalace(state: GameState, pid: PlayerId): void {
  const p = getPlayer(state, pid);
  const rest = citiesOf(state, pid);
  p.capitalId = null;
  if (!rest.length) return;
  const next = rest.reduce((a, b) => (b.pop > a.pop ? b : a));
  makeCapital(state, next);
}

export function captureCity(state: GameState, city: City, newOwner: PlayerId, emit: Emit): void {
  const from = city.owner;
  if (from === newOwner) return;
  const oldPlayer = getPlayer(state, from);
  const wasCapital = city.isCapital;

  if (newOwner === BARBARIAN) {
    // barbarians sack: small cities are razed, larger ones plundered
    if (city.pop <= 1 && !wasCapital) {
      razeCity(state, city, emit);
      if (from === HUMAN) emit({ type: 'notify', text: `Ferals razed ${city.name} and dragged off the oxygen tanks!`, icon: 'skull', tile: city.tile, tone: 'bad' });
      oldPlayer.counters.lastCapturedBy = BARBARIAN;
      updateHappiness(state, from, emit);
      return;
    }
    city.pop = Math.max(1, Math.floor(city.pop / 2));
    destroyBuildings(state, city);
    city.hp = Math.round(city.maxHp * CAPTURE_HP_FRACTION);
    const stolen = Math.min(Math.max(0, Math.floor(oldPlayer.gold / 3)), 100);
    if (stolen > 0) addGold(state, from, -stolen, 'Feral raid', emit);
    if (from === HUMAN) emit({ type: 'notify', text: `Ferals sacked ${city.name}!`, icon: 'skull', tile: city.tile, tone: 'bad' });
    updateHappiness(state, from, emit);
    refreshCity(state, city);
    return;
  }

  const newPlayer = getPlayer(state, newOwner);
  city.owner = newOwner;
  city.pop = Math.max(1, Math.floor(city.pop / 2));
  city.buildings = city.buildings.filter((b) => b !== 'palace');
  city.isCapital = false;
  destroyBuildings(state, city);
  // leader-unique buildings revert to their generic counterpart
  city.buildings = city.buildings.map((b) => {
    const d = BUILDINGS[b];
    return d?.uniqueTo && d.uniqueTo !== newPlayer.leaderId && d.replaces ? d.replaces : b;
  }).filter((b, i, arr) => arr.indexOf(b) === i);
  city.queue = [];
  city.prodStored = 0;
  city.foodStored = 0;
  city.cultureStored = 0;
  city.focus = 'balanced';
  city.order = nextOrder(state, newOwner);
  city.hasStruck = true;
  for (const t of state.map.tiles) if (t.cityId === city.id) t.owner = newOwner;
  city.maxHp = cityMaxHp(city);
  city.hp = Math.max(1, Math.round(city.maxHp * CAPTURE_HP_FRACTION));

  oldPlayer.counters.lastCapturedBy = newOwner;
  if (wasCapital) {
    oldPlayer.counters.capitalLost = 1;
    relocatePalace(state, from);
  }
  if (newPlayer.capitalId == null || !state.cities[newPlayer.capitalId]) makeCapital(state, city);

  emit({ type: 'cityCaptured', cityId: city.id, from, to: newOwner, tile: city.tile });
  updateHappiness(state, from, emit);
  updateHappiness(state, newOwner, emit);
  refreshAllCities(state, from);
  refreshAllCities(state, newOwner);
  recomputeVisibility(state, newOwner, emit);
  recomputeVisibility(state, from, emit);
}

function destroyBuildings(state: GameState, city: City): void {
  const destroyable = city.buildings.filter((b) => b !== 'palace');
  let n = Math.floor(destroyable.length * CAPTURE_BUILDING_LOSS);
  while (n-- > 0 && destroyable.length) {
    const [gone] = destroyable.splice(randInt(state.rng, destroyable.length), 1);
    city.buildings = city.buildings.filter((b) => b !== gone);
  }
  city.maxHp = cityMaxHp(city);
}

/** remove a city from the map entirely (territory released; built wonders stay claimed) */
export function razeCity(state: GameState, city: City, emit: Emit): void {
  const owner = city.owner;
  for (const t of state.map.tiles) {
    if (t.cityId !== city.id) continue;
    t.cityId = null;
    t.owner = null;
  }
  delete state.cities[city.id];
  emit({ type: 'cityRazed', cityId: city.id, tile: city.tile });
  if (city.isCapital) relocatePalace(state, owner);
  refreshAllCities(state, owner);
}

