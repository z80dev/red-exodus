import { PROMOTIONS, TECHS, UNITS } from '../content';
import type { UnitDef } from './defs';
import { runHook } from './effects';
import { changePop } from './cities';
import { addGold, grantTech, hasResource } from './economy';
import { neighbors, hexDistance, tilesInRadius } from './hex';
import { findPath, moveCost } from './pathfinding';
import { randInt, randRange, weightedIndex } from './rng';
import { addInfluence } from './roguelite';
import type { Emit, GameState, PlayerId, TileIdx, Unit, UnitId, UnitTypeId } from './types';
import { BARBARIAN } from './types';
import { recomputeVisibility, revealArea } from './visibility';

export function unitDef(type: UnitTypeId): UnitDef {
  const def = UNITS[type];
  if (!def) throw new Error(`Unknown unit: ${type}`);
  return def;
}
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
    xp: 0, level: 0, promotions: [], promotionChoices: null, order: null, fortifyTurns: 0, age: 0 };
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
  return Math.max(1, value.value);
}
function clearCamp(state: GameState, unit: Unit, emit: Emit): void {
  const tile = state.map.tiles[unit.tile];
  if (!tile.camp || unit.owner === BARBARIAN || isCivilian(unit.type) || militaryAt(state, unit.tile)?.id !== unit.id) return;
  tile.camp = false;
  const gold = 25 + 15 * Math.min(5, state.run.era);
  addGold(state, unit.owner, gold, 'Barbarian camp', emit);
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
    case 'gold': { const n = randRange(state.rng, 30, 60); addGold(state, unit.owner, n, 'Ancient ruin', emit); text = `${n} gold`; break; }
    case 'tech': { const tech = eraTechs[randInt(state.rng, eraTechs.length)]; grantTech(state, unit.owner, tech.id, emit); text = `Free technology: ${tech.name}`; break; }
    case 'population': { const nearest = cities.reduce((a, b) => hexDistance(state.map, b.tile, entered) < hexDistance(state.map, a.tile, entered) ? b : a);
      changePop(state, nearest, 1, emit); text = `Population in ${nearest.name}`; break; }
    case 'reveal': revealArea(state, unit.owner, entered, 4, emit); text = 'Ancient maps'; break;
    case 'unit': { const type = randInt(state.rng, 2) ? 'scout' : 'warrior';
      const recruit = createUnit(state, unit.owner, type, entered, emit); text = recruit ? `Free ${type}` : 'Ancient maps';
      if (!recruit) revealArea(state, unit.owner, entered, 4, emit); break; }
    case 'influence': addInfluence(state, 3, emit); text = '3 Influence'; break;
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
  if (!state.units[unit.id] || !state.map.tiles[target]) return 'Invalid destination';
  if (target === unit.tile) { unit.order = null; return null; }
  const path = findPath(state, unit, target);
  if (!path?.length) return 'No path to destination';
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
        enemyCivilian && (isCivilian(unit.type) || enemyCivilian.owner !== BARBARIAN &&
          state.players.find(p => p.id === unit.owner)?.relations[enemyCivilian.owner] !== 'war')) {
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
      if (!occupied) break;
      from = next;
    }
    if (blocked || landing === path.length) break;
    const next = path[landing];
    const enemyCivilian = unitsAt(state, next).find(u => isCivilian(u.type) && u.owner !== unit.owner);
    if (enemyCivilian) {
      removeUnit(state, enemyCivilian.id, emit, unit.owner);
      if (enemyCivilian.type === 'settler') createUnit(state, unit.owner, 'settler', next, emit);
    }
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
  return traveled.length > 1 ? null : 'Destination blocked or insufficient movement';
}
export function unitsTurnStart(state: GameState, pid: PlayerId, emit: Emit): void {
  for (const unit of Object.values(state.units)) {
    if (unit.owner !== pid) continue;
    const rested = unit.moves === maxMoves(state, unit) && !unit.hasAttacked;
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
    if (oldOrder?.kind === 'explore') {
      const unseen = tilesInRadius(state.map, unit.tile, 3).filter(t => state.players.find(p => p.id === pid)?.vis[t] === 0);
      if (!unseen.length || moveUnitTo(state, unit, unseen[0], emit)) unit.order = null;
    }
  }
}
export const XP_LEVELS: readonly number[] = [10, 30, 60, 100, 150];
export function grantXp(state: GameState, unit: Unit, xp: number, emit: Emit): void {
  unit.xp += xp;
  if (unit.promotionChoices || unit.level >= XP_LEVELS.length || unit.xp < XP_LEVELS[unit.level]) return;
  unit.level++;
  const eligible = Object.values(PROMOTIONS).filter(p => p.classes.includes(unitDef(unit.type).class) && !unit.promotions.includes(p.id) &&
    (!p.requires || p.requires.every(req => unit.promotions.includes(req))) && p.tier <= Math.min(3, Math.ceil(unit.level / 2)));
  const choices: string[] = [];
  while (eligible.length && choices.length < 2) choices.push(eligible.splice(randInt(state.rng, eligible.length), 1)[0].id);
  unit.promotionChoices = choices.length ? choices : null;
  if (choices.length) emit({ type: 'unitLevelUp', unitId: unit.id, player: unit.owner });
}
export function applyPromotion(state: GameState, unit: Unit, promotion: string, emit: Emit): string | null {
  if (!state.units[unit.id] || !unit.promotionChoices?.includes(promotion)) return 'Promotion unavailable';
  unit.promotions.push(promotion);
  unit.promotionChoices = null;
  unit.hp = Math.min(100, unit.hp + 50);
  emit({ type: 'unitPromoted', unitId: unit.id, promotion });
  grantXp(state, unit, 0, emit);
  return null;
}
export function upgradeInfo(state: GameState, unit: Unit): { to: UnitTypeId; cost: number; error: string | null } | null {
  const from = unitDef(unit.type);
  if (!from.upgradesTo) return null;
  const to = unitDef(from.upgradesTo);
  const cost = Math.max(10, 2 * (to.cost - from.cost) + 10);
  const player = state.players.find(p => p.id === unit.owner);
  let error: string | null = null;
  if (!player || state.map.tiles[unit.tile].owner !== unit.owner) error = 'Upgrade in your territory';
  else if (to.tech && !player.techs.includes(to.tech)) error = 'Technology required';
  else if (to.resource && !hasResource(state, unit.owner, to.resource)) error = `Requires ${to.resource}`;
  else if (player.gold < cost) error = 'Not enough gold';
  return { to: to.id, cost, error };
}
export function upgradeUnit(state: GameState, unit: Unit, emit: Emit): string | null {
  const info = upgradeInfo(state, unit);
  if (!info) return 'No upgrade available';
  if (info.error) return info.error;
  const from = unit.type;
  addGold(state, unit.owner, -info.cost, 'Unit upgrade', emit);
  unit.type = info.to;
  unit.moves = 0;
  emit({ type: 'unitUpgraded', unitId: unit.id, from, to: info.to });
  return null;
}
export function pillage(state: GameState, unit: Unit, emit: Emit): string | null {
  const tile = state.map.tiles[unit.tile];
  if (isCivilian(unit.type) || !tile.improvement || tile.pillaged || tile.owner === unit.owner) return 'No enemy improvement to pillage';
  if (tile.owner != null && tile.owner !== BARBARIAN && state.players.find(p => p.id === unit.owner)?.relations[tile.owner] !== 'war') return 'Not at war';
  if (unit.moves < 1) return 'No movement left';
  tile.pillaged = true;
  unit.moves -= 1;
  unit.hp = Math.min(100, unit.hp + 25);
  if (unit.owner !== BARBARIAN) addGold(state, unit.owner, 15, 'Pillage', emit);
  emit({ type: 'improvementPillaged', tile: unit.tile, by: unit.owner });
  return null;
}
export function idleUnits(state: GameState, pid: PlayerId): Unit[] {
  return Object.values(state.units).filter(u => u.owner === pid && (u.promotionChoices?.length || (u.moves > 0 && !u.hasAttacked && !u.order)));
}
