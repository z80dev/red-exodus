import { ELEVATIONS, FEATURES, NATURAL_WONDERS, TERRAINS } from '../content';
import { dirBetween, hexDistance, neighbors } from './hex';
import { isCivilian, maxMoves, unitDef } from './units';
import { BARBARIAN } from './types';
import type { GameState, TileIdx, Unit } from './types';
const MOVEMENT_EPSILON = 1e-9;

interface MovementContext {
  planning: boolean;
  visible: number[] | undefined;
  canSail: boolean;
  canCrossOcean: boolean;
  naval: boolean;
  civilian: boolean;
  ignoreTerrain: boolean;
  noZoc: boolean;
  friendlyLayer: Uint8Array;
  enemyBlocked: Uint8Array;
  enemyCity: Uint8Array;
  enemyZoc: Uint8Array;
}

function atWar(state: GameState, owner: number, other: number): boolean {
  if (owner === BARBARIAN || other === BARBARIAN) return true;
  return state.players.find((player) => player.id === owner)?.relations[other] === 'war';
}

function createMovementContext(state: GameState, unit: Unit, planning: boolean): MovementContext {
  const count = state.map.tiles.length;
  const player = state.players.find((candidate) => candidate.id === unit.owner);
  const visible = player?.vis;
  const def = unitDef(unit.type);
  const abilities = def.abilities ?? [];
  const context: MovementContext = {
    planning, visible,
    canSail: player?.techs.includes('sailing') ?? false,
    canCrossOcean: player?.techs.includes('cartography') ?? false,
    naval: def.class === 'naval',
    civilian: def.class === 'civilian',
    ignoreTerrain: abilities.includes('ignoreTerrain'),
    noZoc: abilities.includes('noZoc'),
    friendlyLayer: new Uint8Array(count), enemyBlocked: new Uint8Array(count),
    enemyCity: new Uint8Array(count), enemyZoc: new Uint8Array(count),
  };
  for (const city of Object.values(state.cities)) {
    if (city.owner === unit.owner || !state.map.tiles[city.tile]) continue;
    context.enemyCity[city.tile] = 1;
    if (atWar(state, unit.owner, city.owner) && (!planning || (visible?.[city.tile] ?? 0) > 0)) {
      for (const neighbor of neighbors(state.map, city.tile)) context.enemyZoc[neighbor] = 1;
    }
  }
  for (const other of Object.values(state.units)) {
    if (other.id === unit.id || other.tile < 0 || other.tile >= count) continue;
    if (other.owner === unit.owner) {
      if (isCivilian(other.type) === context.civilian) context.friendlyLayer[other.tile] = 1;
      continue;
    }
    if (visible?.[other.tile] !== 2) continue;
    const enemyCivilian = isCivilian(other.type);
    const canCapture = !context.civilian && enemyCivilian && atWar(state, unit.owner, other.owner);
    if (!canCapture) context.enemyBlocked[other.tile] = 1;
    if (!enemyCivilian && atWar(state, unit.owner, other.owner)) {
      for (const neighbor of neighbors(state.map, other.tile)) context.enemyZoc[neighbor] = 1;
    }
  }
  return context;
}

function movementCost(state: GameState, context: MovementContext, from: TileIdx, to: TileIdx, remaining: number): number {
  const map = state.map;
  const tile = map.tiles[to];
  const source = map.tiles[from];
  if (!tile || !source || dirBetween(map, from, to) < 0) return Infinity;
  if (context.planning && (context.visible?.[to] ?? 0) === 0) return 1;

  const terrain = TERRAINS[tile.terrain];
  const elevation = ELEVATIONS[tile.elevation];
  const feature = tile.feature ? FEATURES[tile.feature] : undefined;
  if (!terrain || !elevation || elevation.impassable || tile.elevation === 'mountain') return Infinity;
  if (tile.feature === 'ice' || (tile.naturalWonder != null && NATURAL_WONDERS[tile.naturalWonder]?.impassable)) return Infinity;
  if (context.enemyCity[to]) return Infinity;
  if (context.civilian && tile.camp) return Infinity;

  const sourceWater = TERRAINS[source.terrain]?.water ?? false;
  const destinationWater = terrain.water;
  if (context.naval && !destinationWater) return Infinity;
  if (!context.naval && (sourceWater || destinationWater) && !context.canSail) return Infinity;
  if (tile.terrain === 'ocean' && !context.canCrossOcean) return Infinity;

  const road = source.road && tile.road;
  let cost: number;
  if (destinationWater) cost = 2;
  else if (road) cost = 1 / 3;
  else if (context.ignoreTerrain) cost = 1;
  else {
    cost = terrain.moveCost;
    if (feature) cost = Math.max(cost, feature.moveCost);
    cost = Math.max(cost, elevation.moveCost);
  }
  if (!destinationWater && !road && !context.ignoreTerrain && (source.riverEdges & (1 << dirBetween(map, from, to))) !== 0) cost += 1;
  if (!context.noZoc && remaining > 0 && context.enemyZoc[from] && context.enemyZoc[to]) return remaining;
  return cost;
}

/** Movement points to enter `to` from `from` (Infinity if impassable for this unit). */
export function moveCost(state: GameState, unit: Unit, from: TileIdx, to: TileIdx): number {
  const context = createMovementContext(state, unit, false);
  return movementCost(state, context, from, to, unit.moves);
}

function canEnter(context: MovementContext, tile: TileIdx, target: TileIdx): boolean {
  if (context.friendlyLayer[tile] && tile === target) return false;
  if (context.planning && (context.visible?.[tile] ?? 0) === 0) return true;
  return !context.enemyCity[tile] && !context.enemyBlocked[tile];
}

interface SearchNode { tile: TileIdx; remaining: number; turns: number; score: number; parent: SearchNode | null; active: boolean }

function searchBefore(a: SearchNode, b: SearchNode): boolean {
  return a.score < b.score || (a.score === b.score && (a.turns < b.turns || (a.turns === b.turns && a.remaining > b.remaining)));
}

function pushSearch(heap: SearchNode[], node: SearchNode): void {
  let index = heap.length;
  heap.push(node);
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (!searchBefore(node, heap[parent])) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = node;
}

function popSearch(heap: SearchNode[]): SearchNode | undefined {
  const first = heap[0];
  const last = heap.pop();
  if (!first || !last || heap.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    if (left >= heap.length) break;
    const right = left + 1;
    const child = right < heap.length && searchBefore(heap[right], heap[left]) ? right : left;
    if (!searchBefore(heap[child], last)) break;
    heap[index] = heap[child];
    index = child;
  }
  heap[index] = last;
  return first;
}


function search(state: GameState, unit: Unit, target: TileIdx): SearchNode | null {
  if (!state.map.tiles[unit.tile] || !state.map.tiles[target]) return null;
  if (target === unit.tile) return { tile: target, remaining: unit.moves, turns: 0, score: 0, parent: null, active: true };
  const movement = maxMoves(state, unit);
  if (!(movement > 0)) return null;
  const context = createMovementContext(state, unit, true);
  const futureSteps = Math.floor(movement * 3 + 1e-9) + 1;
  const estimate = (tile: TileIdx, remaining: number, turns: number): number => {
    const distance = hexDistance(state.map, tile, target);
    const stepsThisTurn = remaining > 0 ? Math.floor(remaining * 3 + 1e-9) + 1 : 0;
    const rest = Math.max(0, distance - stepsThisTurn);
    return turns + (remaining > 0 ? Math.ceil(rest / futureSteps) : Math.ceil(distance / futureSteps));
  };
  const startTurns = unit.moves > 0 ? 0 : -1;
  const start: SearchNode = { tile: unit.tile, remaining: unit.moves, turns: startTurns, score: estimate(unit.tile, unit.moves, startTurns), parent: null, active: true };
  const heap: SearchNode[] = [];
  pushSearch(heap, start);
  const states = new Map<TileIdx, SearchNode[]>([[unit.tile, [start]]]);
  while (heap.length) {
    const current = popSearch(heap)!;
    if (!current.active) continue;
    if (current.tile === target) return current;
    if (current.remaining > MOVEMENT_EPSILON && current.remaining < movement && !context.friendlyLayer[current.tile]) {
      const previous = states.get(current.tile)!;
      const turns = current.turns + 1;
      if (!previous.some((node) => node.active && node.turns <= turns && node.remaining >= movement)) {
        for (const node of previous) if (node.turns >= turns && node.remaining <= movement) node.active = false;
        const waited: SearchNode = {
          tile: current.tile, remaining: movement, turns, score: estimate(current.tile, movement, turns),
          parent: current, active: true,
        };
        previous.push(waited);
        pushSearch(heap, waited);
      }
    }
    for (const next of neighbors(state.map, current.tile)) {
      if (!canEnter(context, next, target)) continue;
      let turns = current.turns;
      let remaining = current.remaining;
      if (remaining <= MOVEMENT_EPSILON) {
        turns++;
        remaining = movement;
      }
      if (remaining <= MOVEMENT_EPSILON) continue;
      const cost = movementCost(state, context, current.tile, next, remaining);
      if (!Number.isFinite(cost)) continue;
      remaining = Math.max(0, remaining - Math.min(cost, remaining));
      if (remaining <= MOVEMENT_EPSILON) remaining = 0;
      if (context.friendlyLayer[next] && remaining <= 0) continue;
      const previous = states.get(next) ?? [];
      if (previous.some((node) => node.active && node.turns <= turns && node.remaining >= remaining)) continue;
      for (const node of previous) if (node.turns >= turns && node.remaining <= remaining) node.active = false;
      const node: SearchNode = {
        tile: next, remaining, turns,
        score: estimate(next, remaining, turns),
        parent: current, active: true,
      };
      previous.push(node);
      states.set(next, previous);
      pushSearch(heap, node);
    }
  }
  return null;
}

/** A* path from unit.tile to target (excludes start, includes target), multi-turn; null if unreachable. */
export function findPath(state: GameState, unit: Unit, target: TileIdx): TileIdx[] | null {
  const goal = search(state, unit, target);
  if (!goal) return null;
  const path: TileIdx[] = [];
  for (let node: SearchNode | null = goal; node?.parent; node = node.parent) {
    if (node.tile !== node.parent.tile) path.push(node.tile);
  }
  path.reverse();
  return path;
}

interface ReachNode { tile: TileIdx; cost: number }
function pushReach(heap: ReachNode[], node: ReachNode): void {
  let index = heap.length;
  heap.push(node);
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (heap[parent].cost <= node.cost) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = node;
}
function popReach(heap: ReachNode[]): ReachNode | undefined {
  const first = heap[0];
  const last = heap.pop();
  if (!first || !last || heap.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    if (left >= heap.length) break;
    const right = left + 1;
    const child = right < heap.length && heap[right].cost < heap[left].cost ? right : left;
    if (heap[child].cost >= last.cost) break;
    heap[index] = heap[child];
    index = child;
  }
  heap[index] = last;
  return first;
}

/** Tiles reachable THIS turn with remaining moves (excludes current tile). */
export function reachableTiles(state: GameState, unit: Unit): { tile: TileIdx; cost: number }[] {
  const budget = unit.moves;
  if (!(budget > 0)) return [];
  const context = createMovementContext(state, unit, true);
  const best = new Map<TileIdx, number>([[unit.tile, 0]]);
  const heap: ReachNode[] = [];
  pushReach(heap, { tile: unit.tile, cost: 0 });
  while (heap.length) {
    const current = popReach(heap)!;
    if (current.cost !== best.get(current.tile)) continue;
    for (const next of neighbors(state.map, current.tile)) {
      if (!canEnter(context, next, -1)) continue;
      const edge = movementCost(state, context, current.tile, next, budget - current.cost);
      if (!Number.isFinite(edge)) continue;
      let cost = current.cost + Math.min(edge, budget - current.cost);
      if (budget - cost <= MOVEMENT_EPSILON) cost = budget;
      if (!(cost > current.cost) || cost > budget) continue;
      if (context.friendlyLayer[next] && cost >= budget) continue;
      if (cost < (best.get(next) ?? Infinity)) {
        best.set(next, cost);
        pushReach(heap, { tile: next, cost });
      }
    }
  }
  return [...best].filter(([tile]) => tile !== unit.tile && !context.friendlyLayer[tile])
    .map(([tile, cost]) => ({ tile, cost })).sort((a, b) => a.cost - b.cost || a.tile - b.tile);
}

/** Turns needed to reach target: 0 for the current tile, 1 when reachable this turn. */
export function turnsToReach(state: GameState, unit: Unit, target: TileIdx): number {
  if (target === unit.tile) return 0;
  const result = search(state, unit, target);
  return result ? result.turns + 1 : Infinity;
}
