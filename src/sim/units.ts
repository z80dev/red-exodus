import { PROMOTIONS, TECHS, UNITS } from '../content';
import type { UnitDef } from './defs';
import { runHook } from './effects';
import { changePop } from './cities';
import { addGold, grantTech } from './economy';
import { neighbors, hexDistance, tilesInRadius } from './hex';
import { findPath, moveCost } from './pathfinding';
import { randInt, randRange, weightedIndex } from './rng';
import { ownUnitVariant } from './cities';
import { addInfluence } from './roguelite';
import type { Emit, GameState, PlayerId, PromotionId, TileIdx, Unit, UnitId, UnitTypeId } from './types';
import { BARBARIAN } from './types';
import { recomputeVisibility, revealArea } from './visibility';
import { STORM_VISION_PENALTY, stormAt } from './mars';

export function unitDef(type: UnitTypeId): UnitDef {
  const def = UNITS[type];
  if (!def) throw new Error(`Unknown unit: ${type}`);
  return def;
}
/** Nations are always at peace with each other; only the Raiders (BARBARIAN) fight, and they fight everyone. */
export function isHostile(a: PlayerId, b: PlayerId): boolean { return a !== b && (a === BARBARIAN || b === BARBARIAN); }
export function isCivilian(type: UnitTypeId): boolean { return unitDef(type).class === 'civilian'; }
export function unitsAt(state: GameState, tile: TileIdx): Unit[] {
  return Object.values(state.units).filter(u => u.tile === tile);
}
export function militaryAt(state: GameState, tile: TileIdx): Unit | null {
  return Object.values(state.units).find(u => u.tile === tile && !isCivilian(u.type)) ?? null;
}

function vacant(state: GameState, owner: PlayerId, type: UnitTypeId, tile: TileIdx): boolean {
  const t = state.map.tiles[tile];
  if (!t || t.elevation === 'mountain' || (['coast', 'ocean', 'lake'].includes(t.terrain) && unitDef(type).class !== 'naval') || (t.camp && isCivilian(type))) return false;
  const occupants = unitsAt(state, tile);
  return occupants.every(u => u.owner === owner && isCivilian(u.type) !== isCivilian(type));
}
export function createUnit(state: GameState, owner: PlayerId, type: UnitTypeId, tile: TileIdx, emit: Emit): Unit | null {
  unitDef(type);
  if (!state.map.tiles[tile]) return null;
  let where = tile;
  if (!vacant(state, owner, type, where)) {
    where = -1;
    const seen = new Set([tile]);
    let fringe = [tile];
    while (fringe.length && where < 0) {
      const next: number[] = [];
      for (const from of fringe) for (const n of neighbors(state.map, from)) {
        if (seen.has(n)) continue;
        seen.add(n);
        if (vacant(state, owner, type, n)) { where = n; break; }
        next.push(n);
      }
      fringe = next;
    }
  }
  if (where < 0) return null;
  const unit: Unit = { id: state.nextId++, owner, type, tile: where, hp: 100, moves: 0, hasAttacked: false,
    xp: 0, level: 0, promotions: [], order: null, fortifyTurns: 0, age: 0 };
  // Recon units of human players explore on their own until they run out of map.
  if (unitDef(type).class === 'recon' && state.players.find(p => p.id === owner)?.isHuman) unit.order = { kind: 'explore' };
  state.units[unit.id] = unit;
  emit({ type: 'unitCreated', unitId: unit.id, player: owner, tile: where });
  if (owner !== BARBARIAN) recomputeVisibility(state, owner, emit);
  return unit;
}
export function removeUnit(state: GameState, unitId: UnitId, emit: Emit, killer?: PlayerId): void {
  const unit = state.units[unitId];
  if (!unit) return;
  delete state.units[unitId];
  emit({ type: 'unitDied', unitId, player: unit.owner, tile: unit.tile, unitType: unit.type, killer });
  if (unit.owner !== BARBARIAN) recomputeVisibility(state, unit.owner, emit);
}
export function maxMoves(state: GameState, unit: Unit): number {
  const value = { unit, value: unitDef(unit.type).moves + unit.promotions.reduce((n, id) => n + (PROMOTIONS[id]?.moves ?? 0), 0) };
  if (unit.owner !== BARBARIAN) runHook(state, unit.owner, 'unitMoves', () => {}, null, value);
  return Math.max(1, value.value);
}
export function visionOf(state: GameState, unit: Unit): number {
  const value = { unit, value: unitDef(unit.type).vision + unit.promotions.reduce((n, id) => n + (PROMOTIONS[id]?.vision ?? 0), 0) };
  if (unit.owner !== BARBARIAN) runHook(state, unit.owner, 'unitVision', () => {}, null, value);
  if (state.storms.length && stormAt(state, unit.tile)) value.value -= STORM_VISION_PENALTY;
  return Math.max(1, value.value);
}
function clearCamp(state: GameState, unit: Unit, emit: Emit): void {
  const tile = state.map.tiles[unit.tile];
  if (!tile.camp || unit.owner === BARBARIAN || isCivilian(unit.type) || militaryAt(state, unit.tile)?.id !== unit.id) return;
  tile.camp = false;
  const gold = 25 + 15 * Math.min(5, state.run.era);
  addGold(state, unit.owner, gold, 'Raider Camp', emit);
  emit({ type: 'campCleared', player: unit.owner, tile: unit.tile, gold });
}
function exploreRuin(state: GameState, unit: Unit, emit: Emit, entered = unit.tile): void {
  const tile = state.map.tiles[entered];
  if (!tile.ruin || unit.owner === BARBARIAN) return;
  tile.ruin = false;
  const owner = state.players.find(p => p.id === unit.owner);
  if (!owner) return;
  const cities = Object.values(state.cities).filter(c => c.owner === unit.owner);
  const eraTechs = Object.values(TECHS).filter(t => t.era === state.run.era &&
    !owner.techs.includes(t.id) && t.prereqs.every(p => owner.techs.includes(p)));
  const kinds = ['gold', 'tech', 'population', 'reveal', 'unit', 'influence'] as const;
  const weights = [35, eraTechs.length ? 15 : 0, cities.length ? 15 : 0, 15, 10, 10];
  const reward = kinds[weightedIndex(state.rng, weights)];
  let text: string;
  switch (reward) {
    case 'gold': { const n = randRange(state.rng, 30, 60); addGold(state, unit.owner, n, 'Crash Site', emit); text = `${n} Credits`; break; }
    case 'tech': { const tech = eraTechs[randInt(state.rng, eraTechs.length)]; grantTech(state, unit.owner, tech.id, emit); text = `New Research: ${tech.name}`; break; }
    case 'population': { const nearest = cities.reduce((a, b) => hexDistance(state.map, b.tile, entered) < hexDistance(state.map, a.tile, entered) ? b : a);
      changePop(state, nearest, 1, emit); text = `Survivors join ${nearest.name}`; break; }
    case 'reveal': revealArea(state, unit.owner, entered, 4, emit); text = 'Map of the area'; break;
    case 'unit': { const type = randInt(state.rng, 2) ? 'scout' : 'warrior';
      const recruit = createUnit(state, unit.owner, type, entered, emit); text = recruit ? `A ${UNITS[type]?.name ?? type} joins you` : 'Map of the area';
      if (!recruit) revealArea(state, unit.owner, entered, 4, emit); break; }
    case 'influence': addInfluence(state, 3, emit); text = '3 Coins'; break;
  }
  emit({ type: 'ruinExplored', player: unit.owner, tile: entered, reward: text });
}
/** Apply on-entry map encounters from either walking or a victorious melee advance. */
export function onUnitEnteredTile(state: GameState, unit: Unit, emit: Emit): void {
  clearCamp(state, unit, emit);
  exploreRuin(state, unit, emit);
  if (unit.owner !== BARBARIAN) recomputeVisibility(state, unit.owner, emit);
}
export function moveUnitTo(state: GameState, unit: Unit, target: TileIdx, emit: Emit): string | null {
  if (!state.units[unit.id] || !state.map.tiles[target]) return 'Invalid destination.';
  if (target === unit.tile) { unit.order = null; return null; }
  const path = findPath(state, unit, target);
  if (!path?.length) return 'No path to that tile.';
  if (unit.moves <= 0) { unit.order = { kind: 'goto', target }; return null; }
  const traveled = [unit.tile];
  for (let i = 0; i < path.length; i++) {
    let from = unit.tile;
    let remaining = unit.moves;
    let landing = i;
    let blocked = false;
    // Friendly same-layer units may be crossed, but no state/event ever exposes a stacked tile.
    // Preview the whole crossing first: an occupied tile cannot consume the final movement point.
    for (; landing < path.length; landing++) {
      const next = path[landing];
      const tile = state.map.tiles[next];
      const enemyMilitary = militaryAt(state, next);
      const enemyCivilian = unitsAt(state, next).find(u => isCivilian(u.type) && u.owner !== unit.owner);
      if (enemyMilitary && enemyMilitary.owner !== unit.owner ||
        tile.camp && isCivilian(unit.type) ||
        Object.values(state.cities).some(c => c.tile === next && c.owner !== unit.owner) ||
        enemyCivilian && (isCivilian(unit.type) || !isHostile(unit.owner, enemyCivilian.owner))) {
        blocked = true; break;
      }
      const originalMoves = unit.moves;
      unit.moves = remaining;
      const cost = moveCost(state, unit, from, next);
      unit.moves = originalMoves;
      const occupied = unitsAt(state, next).some(u => u.id !== unit.id && u.owner === unit.owner &&
        isCivilian(u.type) === isCivilian(unit.type));
      if (!Number.isFinite(cost) || remaining <= 0 || occupied && remaining <= cost) {
        blocked = true; break;
      }
      remaining = Math.max(0, remaining - cost);
      if (remaining <= 1e-9) remaining = 0;
      if (!occupied) break;
      from = next;
    }
    if (blocked || landing === path.length) break;
    const next = path[landing];
    const enemyCivilian = unitsAt(state, next).find(u => isCivilian(u.type) && u.owner !== unit.owner);
    // only Raiders reach this: they destroy the civilian (nations never capture each other's units)
    if (enemyCivilian) removeUnit(state, enemyCivilian.id, emit, unit.owner);
    unit.tile = next;
    unit.moves = remaining;
    unit.order = null;
    unit.fortifyTurns = 0;
    for (let j = i; j <= landing; j++) {
      traveled.push(path[j]);
      if (j < landing) exploreRuin(state, unit, emit, path[j]);
    }
    onUnitEnteredTile(state, unit, emit);
    i = landing;
    // New contact interrupts a route so the player can react rather than walking past an ambush.
    if (neighbors(state.map, next).some(n => unitsAt(state, n).some(u => u.owner !== unit.owner &&
      state.players.find(p => p.id === unit.owner)?.vis[n] === 2))) break;
  }
  if (traveled.length > 1) emit({ type: 'unitMoved', unitId: unit.id, player: unit.owner, path: traveled });
  if (unit.tile !== target && traveled.length > 1 && unit.moves <= 0) unit.order = { kind: 'goto', target };
  return traveled.length > 1 ? null : 'The tile is blocked, or the unit has too few moves.';
}
export function unitsTurnStart(state: GameState, pid: PlayerId, emit: Emit): void {
  for (const unit of Object.values(state.units)) {
    if (unit.owner !== pid) continue;
    const rested = unit.moves === maxMoves(state, unit) && !unit.hasAttacked;
    if (pid !== BARBARIAN) autoUpgrade(state, unit, emit);
    const oldOrder = unit.order;
    if (rested) {
      const city = Object.values(state.cities).find(c => c.tile === unit.tile && c.owner === pid);
      const base = city ? 25 : state.map.tiles[unit.tile].owner === pid ? 15 : 10;
      const value = { unit, value: base + (oldOrder?.kind === 'fortify' ? 5 : 0) + unit.promotions.reduce((n, id) => n + (PROMOTIONS[id]?.heal ?? 0), 0) };
      if (pid !== BARBARIAN) runHook(state, pid, 'unitHeal', emit, null, value);
      unit.hp = Math.min(100, unit.hp + Math.max(0, value.value));
    }
    unit.moves = maxMoves(state, unit);
    unit.hasAttacked = false;
    unit.age++;
    unit.fortifyTurns = oldOrder?.kind === 'fortify' && rested ? Math.min(2, unit.fortifyTurns + 1) : 0;
    if (oldOrder?.kind === 'goto' && moveUnitTo(state, unit, oldOrder.target, emit)) unit.order = null;
    // units hold still during run ceremonies; continueExploring resumes them once play starts
    if (oldOrder?.kind === 'explore' && state.run.phase === 'playing') exploreStep(state, unit, emit);
  }
}
/** Move every exploring unit of `pid` that still has moves (used when a chapter ceremony hands control back). */
export function continueExploring(state: GameState, pid: PlayerId, emit: Emit): void {
  for (const unit of Object.values(state.units)) {
    if (unit.owner === pid && unit.order?.kind === 'explore' && unit.moves > 0 && state.units[unit.id]) exploreStep(state, unit, emit);
  }
}
const EXPLORE_RADIUS = 8;
/** Best frontier tile for an exploring unit: unseen tiles nearby, Crash Sites first, close beats far. */
function exploreTargets(state: GameState, unit: Unit): TileIdx[] {
  const vis = state.players.find(p => p.id === unit.owner)?.vis;
  if (!vis) return [];
  const scored: { tile: TileIdx; score: number }[] = [];
  for (const idx of tilesInRadius(state.map, unit.tile, EXPLORE_RADIUS)) {
    const tile = state.map.tiles[idx];
    if (idx === unit.tile || vis[idx] === 0 || tile.elevation === 'mountain' || tile.camp || unitsAt(state, idx).length ||
      ['ocean', 'coast', 'lake'].includes(tile.terrain)) continue;
    let hidden = 0;
    for (const n of tilesInRadius(state.map, idx, 2)) if (vis[n] === 0) hidden++;
    if (!hidden && !tile.ruin) continue;
    scored.push({ tile: idx, score: (tile.ruin ? 40 : 0) + hidden * 2 - hexDistance(state.map, unit.tile, idx) * 3 });
  }
  return scored.sort((a, b) => b.score - a.score || a.tile - b.tile).map(s => s.tile);
}
/** One turn of auto-explore. Keeps the explore order while there is map left to see; clears it when done. */
export function exploreStep(state: GameState, unit: Unit, emit: Emit): void {
  unit.order = { kind: 'explore' };
  if (unit.moves <= 0) return;
  const targets = exploreTargets(state, unit);
  for (const target of targets.slice(0, 4)) {
    const error = moveUnitTo(state, unit, target, emit);
    if (!state.units[unit.id]) return;
    if (!error) { unit.order = { kind: 'explore' }; return; }
  }
  if (!targets.length) unit.order = null;
}
export const XP_LEVELS: readonly number[] = [10, 30, 60, 100, 150];
/** XP still missing for the unit's next level (0 at max level) */
export function xpToNextLevel(unit: Unit): number {
  return unit.level < XP_LEVELS.length ? Math.max(0, XP_LEVELS[unit.level] - unit.xp) : 0;
}
/** Promotions this unit qualifies for right now (class, prerequisites, tier unlocked by its level). */
function eligiblePromotions(unit: Unit): PromotionId[] {
  const cls = unitDef(unit.type).class;
  const maxTier = Math.min(3, Math.ceil(unit.level / 2));
  return Object.values(PROMOTIONS).filter(p => p.classes.includes(cls) && !unit.promotions.includes(p.id) &&
    (!p.requires || p.requires.every(req => unit.promotions.includes(req))) && p.tier <= maxTier).map(p => p.id);
}
/** The promotion every unit takes automatically: highest tier first, then the authored order (class lines first). */
export function bestPromotion(unit: Unit): PromotionId | null {
  let best: PromotionId | null = null;
  for (const id of eligiblePromotions(unit)) if (best === null || PROMOTIONS[id].tier > PROMOTIONS[best].tier) best = id;
  return best;
}
/** Add XP; each level reached applies the best promotion at once (+50 HP), with a `unitPromoted` event. */
export function grantXp(unit: Unit, xp: number, emit: Emit): void {
  unit.xp += xp;
  while (unit.level < XP_LEVELS.length && unit.xp >= XP_LEVELS[unit.level]) {
    unit.level++;
    const promotion = bestPromotion(unit);
    if (!promotion) continue;
    unit.promotions.push(promotion);
    unit.hp = Math.min(100, unit.hp + 50);
    emit({ type: 'unitPromoted', unitId: unit.id, promotion });
  }
}
/** Next unit type in this unit's upgrade line that its owner can field (tech known; nation uniques respected). */
export function upgradeTarget(state: GameState, unit: Unit): UnitTypeId | null {
  const next = unitDef(unit.type).upgradesTo;
  const player = state.players.find(p => p.id === unit.owner);
  if (!next || !player) return null;
  const to = ownUnitVariant(player.leaderId, next);
  const def = UNITS[to];
  return def && (!def.tech || player.techs.includes(def.tech)) ? to : null;
}
/** Free automatic upgrade at turn start: climb the line as far as known techs allow. Keeps XP, promotions, HP. */
export function autoUpgrade(state: GameState, unit: Unit, emit: Emit): void {
  const from = unit.type;
  for (let step = 0, to = upgradeTarget(state, unit); to && step < 8; step++, to = upgradeTarget(state, unit)) unit.type = to;
  if (unit.type !== from) emit({ type: 'unitUpgraded', unitId: unit.id, from, to: unit.type });
}
/** units with moves left and no standing order (informational only: idle units never block the turn) */
export function idleUnits(state: GameState, pid: PlayerId): Unit[] {
  return Object.values(state.units).filter(u => u.owner === pid && u.moves > 0 && !u.hasAttacked && !u.order);
}
