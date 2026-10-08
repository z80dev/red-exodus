// OWNER: SimMechanics. Mars-specific rules: dust storms, the orbiting Ark (Cryo pods → Orbital Drops /
// Thaws) and the Breakthrough research draft. Signatures are the contract
// (docs/ARCHITECTURE.md "Mars mechanics"); bodies are owned by SimMechanics.
//
// ChapterStats.extra keys maintained here (chapter + run totals, via addExtraStat; Crew/Directives read them):
//   stormHits  — human units or colonies damaged by a dust storm
//   stormKills — non-human units killed by a storm while standing inside human territory
//   drops      — Orbital Drops landed by the human
//   thaws      — Thaws performed by the human
//   rerolls    — Breakthrough draft rerolls bought by the human
import type { StormDamageArgs } from './defs';
import type { ActiveEffect } from './effects';
import type { Emit, GameState, PlayerId, StormCell, TileIdx, TechId, CityId } from './types';
import { BARBARIAN } from './types';
import { TECHS, UNITS } from '../content';
import { hexDistance, neighbor, neighbors, tileAt } from './hex';
import { chance, randInt, weightedIndex } from './rng';
import { collectEffects, runHook } from './effects';
import { canFoundCity, cityAt, changePop, foundCity } from './cities';
import { addGold, availableTechs, getPlayer } from './economy';
import { removeUnit } from './units';
import { CRISIS_CHAPTER, addExtraStat } from './roguelite';

// ── tunables ──
/** Cryo pods aboard at landfall (LeaderDef.cryo overrides) */
export const START_CRYO = 3;
/** colonists in each Capital at landfall (the main Ark lands with more people than a Pod) */
export const CAPITAL_START_POP = 3;
/** pods thawed and ready at the start of every new era */
export const ERA_CRYO = 1;
/** pop gained by a Thaw */
export const THAW_POP = 2;
/** an Orbital Drop must land within this many hexes of one of your colonies */
export const DROP_RANGE = 8;
/** techs offered per Breakthrough draft */
export const RESEARCH_OFFER_SIZE = 3;

/** HP lost per point of storm power by a unit caught in the open at round end */
export const STORM_DAMAGE = 12;
/** HP lost per point of storm power by a colony inside a storm */
export const STORM_CITY_DAMAGE = 12;
/** yield multiplier on Food and Industry of tiles inside a storm (floored) */
export const STORM_YIELD_MUL = 0.5;
/** vision lost by a unit standing inside a storm */
export const STORM_VISION_PENALTY = 1;
/** chance per round that a new storm forms while fewer than the target number are active */
export const STORM_SPAWN_CHANCE = 0.35;
/** active storm target by era (index clamps to the last entry; endless uses the last) */
export const STORM_TARGET_BY_ERA = [1, 1, 2, 2, 3, 3] as const;
/** natural storms live this many rounds (path length), inclusive */
export const STORM_LIFE_MIN = 4;
export const STORM_LIFE_MAX = 8;
/** chance a natural storm (era ≥ 2) is a great storm (radius 3) */
export const GREAT_STORM_CHANCE = 0.1;
/**
 * Set `player.counters[STORM_SHELTER_COUNTER] = state.turn` to shelter that player's units and colonies
 * from storm damage at the end of the current round (Salvage / crisis relief use this).
 */
export const STORM_SHELTER_COUNTER = 'stormShelter';
/** Breakthrough reroll: base Credits + step per reroll already bought for this offer */
export const RESEARCH_REROLL_BASE = 15;
export const RESEARCH_REROLL_STEP = 10;
/** offer weight falloff per era above the lowest available era */
export const RESEARCH_ERA_FALLOFF = 0.3;

const NOOP: Emit = () => {};

// ── storms ──
/** the storm cell covering `tile`, strongest first (null = clear sky) */
export function stormAt(state: GameState, tile: TileIdx): StormCell | null {
  let best: StormCell | null = null;
  for (const s of state.storms) {
    const eye = s.path[s.step];
    if (eye == null || hexDistance(state.map, eye, tile) > s.radius) continue;
    if (!best || s.power > best.power) best = s;
  }
  return best;
}

/** storm power on a tile: 0 = clear, 1..3 */
export function stormPowerAt(state: GameState, tile: TileIdx): number {
  return stormAt(state, tile)?.power ?? 0;
}

/** number of storm cells the planet tries to keep active right now */
export function stormTarget(state: GameState): number {
  const run = state.run;
  const era = Math.max(0, run.era);
  let n: number = STORM_TARGET_BY_ERA[Math.min(era, STORM_TARGET_BY_ERA.length - 1)];
  if (run.chapter === CRISIS_CHAPTER) n += 1;
  return n;
}

/** tile on the map border: side 0 = west, 1 = east, 2 = north, 3 = south; `t` in [0,1) along it */
function edgeTile(state: GameState, side: number, t: number): TileIdx {
  const { width, height } = state.map;
  switch (side) {
    case 0: return tileAt(state.map, 0, Math.min(height - 1, Math.floor(t * height)));
    case 1: return tileAt(state.map, width - 1, Math.min(height - 1, Math.floor(t * height)));
    case 2: return tileAt(state.map, Math.min(width - 1, Math.floor(t * width)), 0);
    default: return tileAt(state.map, Math.min(width - 1, Math.floor(t * width)), height - 1);
  }
}

/**
 * Roll a route of `length` eyes from `start` toward `goal`: 1 hex per round, mostly the closing step, sometimes a
 * sideways drift (never backwards, never revisiting). Stops early at the goal or when boxed in.
 */
function rollPath(state: GameState, start: TileIdx, goal: TileIdx, length: number): TileIdx[] {
  const map = state.map;
  const path = [start];
  const seen = new Set(path);
  let cur = start;
  while (path.length < length) {
    const d = hexDistance(map, cur, goal);
    if (d <= 0) break;
    const opts = neighbors(map, cur).filter((n) => !seen.has(n));
    const closer = opts.filter((n) => hexDistance(map, n, goal) < d);
    const level = opts.filter((n) => hexDistance(map, n, goal) === d);
    let pool = closer;
    if (level.length && (!closer.length || chance(state.rng, 0.3))) pool = level;
    if (!pool.length) break;
    cur = pool[randInt(state.rng, pool.length)];
    seen.add(cur);
    path.push(cur);
  }
  return path;
}

/** walk from `from` in hex direction `dir` (mod 6) up to `steps` times (stops at the border) */
function walk(state: GameState, from: TileIdx, dir: number, steps: number): TileIdx {
  let cur = from;
  for (let i = 0; i < steps; i++) {
    const next = neighbor(state.map, cur, ((dir % 6) + 6) % 6);
    if (next < 0) break;
    cur = next;
  }
  return cur;
}

/** spawn a storm (crises/edicts use this); returns the cell or null if no route fits */
export function spawnStorm(state: GameState, opts: { power: number; radius: number; great?: boolean; near?: TileIdx }, emit: Emit): StormCell | null {
  const map = state.map;
  if (!map.tiles.length) return null;
  const life = STORM_LIFE_MIN + randInt(state.rng, STORM_LIFE_MAX - STORM_LIFE_MIN + 1);
  let start: TileIdx;
  let goal: TileIdx;
  if (opts.near != null && map.tiles[opts.near]) {
    // approach the target from 2 hexes upwind and carry on across it
    const dir = randInt(state.rng, 6);
    start = walk(state, opts.near, dir + 3, 2);
    goal = walk(state, opts.near, dir, Math.max(map.width, map.height));
    if (goal === opts.near) goal = walk(state, opts.near, dir + 1, Math.max(map.width, map.height));
  } else {
    const side = randInt(state.rng, 4);
    start = edgeTile(state, side, randInt(state.rng, 1000) / 1000);
    goal = edgeTile(state, side ^ 1, randInt(state.rng, 1000) / 1000);
  }
  if (start < 0 || goal < 0) return null;
  const path = rollPath(state, start, goal, life);
  if (path.length < 2) return null;
  const great = !!opts.great;
  const cell: StormCell = {
    id: state.nextStormId++,
    path,
    step: 0,
    radius: Math.max(1, Math.min(3, Math.round(opts.radius))),
    power: Math.max(1, Math.min(3, Math.round(opts.power))),
  };
  if (great) cell.great = true;
  state.storms.push(cell);
  emit({ type: 'stormSpawned', storm: { ...cell, path: [...cell.path] } });
  return cell;
}

/** a naturally forming storm: power leans higher in later eras, radius 1–2, occasional great storm */
function spawnNaturalStorm(state: GameState, emit: Emit): StormCell | null {
  const era = Math.max(0, state.run.era);
  const power = 1 + weightedIndex(state.rng, [4, 2 + era, Math.max(0, era - 1) + 0.5]);
  const great = era >= 2 && chance(state.rng, GREAT_STORM_CHANCE);
  const radius = great ? 3 : 1 + randInt(state.rng, 2);
  return spawnStorm(state, { power, radius, great }, emit);
}

function effectsOf(cache: Map<PlayerId, ActiveEffect[]>, state: GameState, pid: PlayerId): ActiveEffect[] {
  let fx = cache.get(pid);
  if (!fx) cache.set(pid, (fx = collectEffects(state, pid)));
  return fx;
}

/** damage after the victim's and the territory owner's `storm` hooks (0 when sheltered) */
function stormDamage(state: GameState, cache: Map<PlayerId, ActiveEffect[]>, args: StormDamageArgs, emit: Emit): number {
  const victim = state.players.find((p) => p.id === args.victim);
  if (victim && victim.counters[STORM_SHELTER_COUNTER] === state.turn) return 0;
  if (args.victim !== BARBARIAN) runHook(state, args.victim, 'storm', emit, effectsOf(cache, state, args.victim), args);
  const owner = args.territoryOwner;
  if (owner != null && owner !== args.victim && owner !== BARBARIAN) runHook(state, owner, 'storm', emit, effectsOf(cache, state, owner), args);
  const d = Math.round(args.damage);
  return Number.isFinite(d) ? Math.max(0, d) : 0;
}

/** once per full round (after barbarians, before onTurnEnd): damage at current eyes, then move, dissipate, spawn */
export function advanceStorms(state: GameState, emit: Emit): void {
  const map = state.map;
  const fxCache = new Map<PlayerId, ActiveEffect[]>();
  const human = state.players.find((p) => p.isHuman)?.id ?? 0;

  if (state.storms.length) {
    // 1. units caught inside (stable id order)
    const ids = Object.keys(state.units).map(Number).sort((a, b) => a - b);
    for (const id of ids) {
      const u = state.units[id];
      if (!u) continue;
      const storm = stormAt(state, u.tile);
      if (!storm) continue;
      const tile = map.tiles[u.tile];
      const city = cityAt(state, u.tile);
      const sheltered = (city != null && city.owner === u.owner) || u.order?.kind === 'fortify';
      const base = STORM_DAMAGE * storm.power;
      const args: StormDamageArgs = {
        tile, unit: u, city: city && city.owner === u.owner ? city : null, victim: u.owner, territoryOwner: tile.owner,
        power: storm.power, damage: sheltered ? Math.floor(base / 2) : base,
      };
      const dmg = stormDamage(state, fxCache, args, emit);
      if (dmg <= 0 || !state.units[id]) continue;
      u.hp -= dmg;
      const killed = u.hp <= 0;
      emit({ type: 'stormDamage', tile: u.tile, amount: dmg, unitId: u.id, player: u.owner, killed });
      if (u.owner === human) addExtraStat(state, 'stormHits', 1);
      if (killed) {
        if (u.owner !== human && tile.owner === human) addExtraStat(state, 'stormKills', 1);
        if (u.owner === human) {
          emit({ type: 'notify', text: `Your ${UNITS[u.type]?.name ?? 'unit'} was lost in the Dust Storm.`, icon: 'storm', tile: u.tile, tone: 'bad' });
        }
        removeUnit(state, u.id, emit);
      }
    }
    // 2. colonies inside (city HP never below 1)
    const cityIds = Object.keys(state.cities).map(Number).sort((a, b) => a - b);
    for (const cid of cityIds) {
      const c = state.cities[cid];
      if (!c) continue;
      const storm = stormAt(state, c.tile);
      if (!storm) continue;
      const args: StormDamageArgs = {
        tile: map.tiles[c.tile], unit: null, city: c, victim: c.owner, territoryOwner: map.tiles[c.tile].owner,
        power: storm.power, damage: STORM_CITY_DAMAGE * storm.power,
      };
      const dmg = Math.min(stormDamage(state, fxCache, args, emit), c.hp - 1);
      if (dmg <= 0) continue;
      c.hp -= dmg;
      emit({ type: 'stormDamage', tile: c.tile, amount: dmg, cityId: c.id, player: c.owner });
      if (c.owner === human) addExtraStat(state, 'stormHits', 1);
    }
  }

  // 3. move / dissipate
  const kept: StormCell[] = [];
  for (const s of state.storms) {
    const from = s.path[s.step];
    if (s.step + 1 < s.path.length) {
      s.step++;
      kept.push(s);
      emit({ type: 'stormMoved', id: s.id, from, to: s.path[s.step] });
    } else {
      emit({ type: 'stormEnded', id: s.id, tile: from });
    }
  }
  state.storms = kept;

  // 4. a new front rolls in from the edge
  if (state.storms.length < stormTarget(state) && chance(state.rng, STORM_SPAWN_CHANCE)) spawnNaturalStorm(state, emit);
}

// ── the Ark ──
export function changeCryo(state: GameState, pid: PlayerId, delta: number, emit: Emit): void {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p || !Number.isFinite(delta)) return;
  const value = Math.max(0, Math.round(p.cryo + delta));
  const actual = value - p.cryo;
  if (!actual) return;
  p.cryo = value;
  emit({ type: 'cryoChanged', player: pid, value, delta: actual });
}

/** price of the next Orbital Drop after dropPrice hooks */
export function dropPrice(state: GameState, pid: PlayerId): { cryo: number; gold: number } {
  const p = getPlayer(state, pid);
  const args = { cryo: 1, gold: 0, cryoLeft: p.cryo };
  if (pid !== BARBARIAN) runHook(state, pid, 'dropPrice', NOOP, null, args);
  const cryo = Math.round(args.cryo);
  const gold = Math.round(args.gold);
  return { cryo: Number.isFinite(cryo) ? Math.max(0, cryo) : 1, gold: Number.isFinite(gold) ? Math.max(0, gold) : 0 };
}

export function canOrbitalDrop(state: GameState, pid: PlayerId, tile: TileIdx): string | null {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p || !p.alive || pid === BARBARIAN) return 'No Capital found.';
  const t = state.map.tiles[tile];
  if (!t) return 'Invalid tile.';
  if (!p.vis[tile]) return 'You can only land a colony on a tile you have explored.';
  const err = canFoundCity(state, pid, tile);
  if (err) return err;
  if (stormAt(state, tile)) return 'A Dust Storm blocks this tile.';
  for (const id in state.units) {
    const u = state.units[id];
    if (u.tile === tile && u.owner !== pid) return 'Another unit is on this tile.';
  }
  let inRange = false;
  for (const id in state.cities) {
    const c = state.cities[id];
    if (c.owner === pid && hexDistance(state.map, c.tile, tile) <= DROP_RANGE) { inRange = true; break; }
  }
  if (!inRange) return `The tile must be within ${DROP_RANGE} hexes of one of your colonies.`;
  const price = dropPrice(state, pid);
  if (p.cryo < price.cryo) return price.cryo === 1 ? 'You have no Pods left.' : `You need ${price.cryo} Pods.`;
  if (p.gold < price.gold) return `You need ${price.gold} Credits.`;
  return null;
}

export function orbitalDrop(state: GameState, pid: PlayerId, tile: TileIdx, emit: Emit): string | null {
  const err = canOrbitalDrop(state, pid, tile);
  if (err) return err;
  const price = dropPrice(state, pid);
  if (price.cryo) changeCryo(state, pid, -price.cryo, emit);
  if (price.gold) addGold(state, pid, -price.gold, 'Land Colony', emit);
  emit({ type: 'podLanded', player: pid, tile });
  foundCity(state, pid, tile, emit);
  if (getPlayer(state, pid).isHuman) addExtraStat(state, 'drops', 1);
  return null;
}

export function canThaw(state: GameState, pid: PlayerId, cityId: CityId): string | null {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p || !p.alive) return 'No Capital found.';
  const c = state.cities[cityId];
  if (!c || c.owner !== pid) return 'Colony not found.';
  if (p.cryo < 1) return 'You have no Pods left.';
  return null;
}

/** spends 1 pod for +THAW_POP pop; colonistsThawed.pop = colonists added */
export function thawColonists(state: GameState, pid: PlayerId, cityId: CityId, emit: Emit): string | null {
  const err = canThaw(state, pid, cityId);
  if (err) return err;
  const c = state.cities[cityId];
  changeCryo(state, pid, -1, emit);
  const before = c.pop;
  changePop(state, c, THAW_POP, emit);
  emit({ type: 'colonistsThawed', player: pid, cityId, pop: c.pop - before });
  if (getPlayer(state, pid).isHuman) addExtraStat(state, 'thaws', 1);
  return null;
}

// ── Breakthrough draft ──
function offerSize(state: GameState, pid: PlayerId): number {
  const args = { value: RESEARCH_OFFER_SIZE };
  runHook(state, pid, 'researchOffers', NOOP, null, args);
  return Math.max(1, Math.round(Number.isFinite(args.value) ? args.value : RESEARCH_OFFER_SIZE));
}

/**
 * Draw without replacement. The first card is always a tech from the newest era you can research (so the climb is
 * always on offer); the rest are weighted toward the lowest available era. `avoid` techs only fill leftover slots.
 */
function drawOffer(state: GameState, pid: PlayerId, avoid: readonly TechId[]): TechId[] {
  const avail = availableTechs(state, pid);
  const n = Math.min(offerSize(state, pid), avail.length);
  if (!n) return [];
  const fresh = avail.filter((t) => !avoid.includes(t));
  const out: TechId[] = [];
  const topEra = Math.max(...avail.map((t) => TECHS[t].era));
  const newest = fresh.filter((t) => TECHS[t].era === topEra);
  const newestPool = newest.length ? newest : avail.filter((t) => TECHS[t].era === topEra);
  out.push(newestPool[randInt(state.rng, newestPool.length)]);
  const drawFrom = (pool: TechId[]) => {
    const list = pool.filter((t) => !out.includes(t));
    while (out.length < n && list.length) {
      const minEra = Math.min(...list.map((t) => TECHS[t].era));
      const i = weightedIndex(state.rng, list.map((t) => Math.pow(RESEARCH_ERA_FALLOFF, TECHS[t].era - minEra)));
      out.push(list[i]);
      list.splice(i, 1);
    }
  };
  drawFrom(fresh);
  drawFrom(avail);
  return avail.filter((t) => out.includes(t)); // canonical tech order for stable UI
}

/** redraw the human's offer (no-op for AIs); emits researchOffered */
export function rollResearchOffer(state: GameState, pid: PlayerId, emit: Emit): TechId[] {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p || !p.isHuman) return [];
  p.researchOffer = drawOffer(state, pid, []);
  p.researchRerolls = 0;
  emit({ type: 'researchOffered', player: pid, techs: [...p.researchOffer] });
  return p.researchOffer;
}

/** keep the human's offer valid: drop known techs; redraw when nothing is left but research remains */
export function ensureResearchOffer(state: GameState, pid: PlayerId, emit: Emit): void {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p || !p.isHuman || !p.alive) return;
  if (p.researchOffer.some((t) => p.techs.includes(t))) p.researchOffer = p.researchOffer.filter((t) => !p.techs.includes(t));
  if (!p.researchOffer.length && availableTechs(state, pid).length) rollResearchOffer(state, pid, emit);
}

export function researchRerollCost(state: GameState, pid: PlayerId): number {
  const p = getPlayer(state, pid);
  const args = { value: RESEARCH_REROLL_BASE + RESEARCH_REROLL_STEP * p.researchRerolls };
  runHook(state, pid, 'researchReroll', NOOP, null, args);
  const v = Math.round(args.value);
  return Number.isFinite(v) ? Math.max(0, v) : RESEARCH_REROLL_BASE;
}

export function rerollResearch(state: GameState, pid: PlayerId, emit: Emit): string | null {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p || !p.alive) return 'Player is not in the game.';
  if (!p.isHuman) return 'Only you can get new Research choices.';
  const avail = availableTechs(state, pid);
  if (!avail.length) return 'There is nothing left to research.';
  if (p.researchOffer.length && avail.every((t) => p.researchOffer.includes(t))) return 'There are no other Research choices.';
  const cost = researchRerollCost(state, pid);
  if (p.gold < cost) return `You need ${cost} Credits.`;
  if (cost) addGold(state, pid, -cost, 'New Research choices', emit);
  const rerolls = p.researchRerolls + 1;
  p.researchOffer = drawOffer(state, pid, p.researchOffer);
  p.researchRerolls = rerolls;
  emit({ type: 'researchOffered', player: pid, techs: [...p.researchOffer], reroll: true });
  addExtraStat(state, 'rerolls', 1);
  return null;
}
