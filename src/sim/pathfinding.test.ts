import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ELEVATIONS, FEATURES, NATURAL_WONDERS, TERRAINS, UNITS } from '../content';
import { findPath, moveCost, reachableTiles, turnsToReach } from './pathfinding';
import { recomputeVisibility } from './visibility';
import { neighbors } from './hex';
import { BARBARIAN, type GameState, type Tile, type Unit } from './types';

const originalTerrains = { ...TERRAINS };
const originalFeatures = { ...FEATURES };
const originalElevations = { ...ELEVATIONS };
const originalWonders = { ...NATURAL_WONDERS };
const originalUnits = { ...UNITS };

function tile(idx: number, width: number, row: number): Tile {
  return {
    idx, col: idx % width, row, terrain: 'grassland', elevation: 'flat', feature: null,
    riverEdges: 0, resource: null, improvement: null, road: false,
    naturalWonder: null, owner: null, cityId: null, height: 0, camp: false, ruin: false,
  };
}

function makeState(width = 7, height = 5): GameState {
  const tiles = Array.from({ length: width * height }, (_, idx) => tile(idx, width, Math.floor(idx / width)));
  return {
    schema: 1,
    config: { seed: 'test', leaderId: 'test', ascension: 0, mapSize: 'small', rivals: 0, tutorial: false, daily: false },
    rng: { a: 1, b: 2, c: 3, d: 4 }, turn: 1,
    map: { width, height, tiles, starts: [] },
    players: [{ id: BARBARIAN, name: '', civName: '', leaderId: '', colors: { primary: '', secondary: '' }, isHuman: false, alive: true,
      gold: 0, techs: [], researching: null, researchProgress: {}, vis: Array(tiles.length).fill(1), happiness: 0, ai: null,
      capitalId: null, citiesFounded: 0, counters: {}, effectCounters: {}, cryo: 0, researchOffer: [], researchRerolls: 0 }],
    cities: {}, units: {}, nextId: 1,
    run: { era: 0, ascension: 0, doctrines: [], crisisActive: false, crisis: null },
    wonderOwners: {}, naturalWondersSeen: {}, log: [], gameOver: false, storms: [], nextStormId: 1,
  } as unknown as GameState;
}

function makeUnit(tileIdx: number, moves = 2): Unit {
  return {
    id: 1, owner: BARBARIAN, type: 'test_unit', tile: tileIdx, hp: 100, moves, hasAttacked: false,
    xp: 0, level: 0, promotions: [], order: null, fortifyTurns: 0, age: 0,
  };
}

beforeAll(() => {
  for (const id of ['ocean', 'coast', 'lake', 'grassland', 'plains', 'desert', 'tundra', 'snow'] as const) {
    TERRAINS[id] = { id, name: id, yields: { food: 0, prod: 0, gold: 0, sci: 0, cul: 0 }, moveCost: id === 'plains' ? 2 : 1,
      defensePct: 0, water: ['ocean', 'coast', 'lake'].includes(id), color: '', description: '' };
  }
  ELEVATIONS.flat = { id: 'flat', name: 'Flat', yields: { food: 0, prod: 0, gold: 0, sci: 0, cul: 0 }, moveCost: 1, defensePct: 0, impassable: false, blocksVision: false };
  ELEVATIONS.hills = { ...ELEVATIONS.flat, id: 'hills', name: 'Hills', moveCost: 2, blocksVision: true };
  ELEVATIONS.mountain = { ...ELEVATIONS.flat, id: 'mountain', name: 'Mountain', moveCost: 3, impassable: true, blocksVision: true };
  UNITS.test_unit = { id: 'test_unit', name: 'Test unit', era: 0, class: 'melee', cost: 1, strength: 1, moves: 2, vision: 2, tech: null, description: '', model: '', icon: '' };
});

afterAll(() => {
  for (const key of Object.keys(TERRAINS)) delete TERRAINS[key as keyof typeof TERRAINS];
  Object.assign(TERRAINS, originalTerrains);
  for (const key of Object.keys(FEATURES)) delete FEATURES[key as keyof typeof FEATURES];
  Object.assign(FEATURES, originalFeatures);
  for (const key of Object.keys(ELEVATIONS)) delete ELEVATIONS[key as keyof typeof ELEVATIONS];
  Object.assign(ELEVATIONS, originalElevations);
  for (const key of Object.keys(UNITS)) delete UNITS[key];
  Object.assign(UNITS, originalUnits);
  for (const key of Object.keys(NATURAL_WONDERS)) delete NATURAL_WONDERS[key];
  Object.assign(NATURAL_WONDERS, originalWonders);
});

describe('movement and visibility', () => {
  it('uses the highest terrain/feature/elevation cost, road cost, river penalty, and impassable mountains', () => {
    const state = makeState();
    const unit = makeUnit(17);
    state.map.tiles[18].terrain = 'plains';
    state.map.tiles[18].feature = 'forest';
    expect(moveCost(state, unit, 17, 18)).toBe(2);
    state.map.tiles[17].road = true;
    state.map.tiles[18].road = true;
    expect(moveCost(state, unit, 17, 18)).toBeCloseTo(1 / 3);
    state.map.tiles[17].road = false;
    state.map.tiles[18].road = false;
    state.map.tiles[17].riverEdges = 1;
    expect(moveCost(state, unit, 17, 18)).toBe(3);
    state.map.tiles[17].riverEdges = 0;
    state.map.tiles[18].elevation = 'hills';
    state.map.tiles[18].terrain = 'grassland';
    state.map.tiles[18].feature = null;
    expect(moveCost(state, unit, 17, 18)).toBe(2);
    state.map.tiles[18].elevation = 'mountain';
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
  });

  it('requires Sailing to embark and Cartography for ocean at the fixed two-point cost', () => {
    const state = makeState();
    const unit = makeUnit(17);
    state.map.tiles[18].terrain = 'coast';
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    expect(moveCost(state, unit, 18, 17)).toBe(Infinity);
    UNITS.test_unit.class = 'civilian';
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    state.players[0].techs = ['sailing'];
    expect(moveCost(state, unit, 17, 18)).toBe(2);
    UNITS.test_unit.class = 'melee';
    state.map.tiles[18].terrain = 'ocean';
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    state.players[0].techs.push('cartography');
    expect(moveCost(state, unit, 17, 18)).toBe(2);
  });

  it('finds multi-turn routes and allows a positive partial move to enter and exhaust a tile', () => {
    const state = makeState(5, 1);
    const unit = makeUnit(0);
    state.map.tiles[0].elevation = 'flat';
    expect(moveCost(state, unit, 0, 1)).toBe(1);
    expect(turnsToReach(state, unit, 4)).toBe(2);
    unit.moves = 0.5;
    expect(reachableTiles(state, unit)).toContainEqual({ tile: 1, cost: 0.5 });
    expect(turnsToReach(state, unit, 1)).toBe(1);
  });
  it('waits for a fresh turn before transiting a friendly unit when current movement is insufficient', () => {
    const state = makeState(5, 1);
    const unit = makeUnit(0, 0.5);
    state.units[unit.id] = unit;
    state.units[2] = { ...makeUnit(1), id: 2 };
    expect(findPath(state, unit, 2)).toEqual([1, 2]);
    expect(turnsToReach(state, unit, 2)).toBe(2);
    expect(reachableTiles(state, unit)).toEqual([]);
  });

  it('prefers a longer road route over a shorter rough route when it arrives sooner', () => {
    const state = makeState(9, 7);
    const unit = makeUnit(28);
    const target = 34;
    for (let col = 2; col <= 7; col++) state.map.tiles[27 + col].terrain = 'plains';
    for (let col = 2; col <= 6; col++) state.map.tiles[36 + col].road = true;
    const path = findPath(state, unit, target)!;
    expect(path).toContain(38);
    expect(turnsToReach(state, unit, target)).toBe(2);
  });
  it('does not leak a road-cost rounding remainder into a seventh tile', () => {
    const state = makeState(8, 1);
    const unit = makeUnit(0);
    for (const tile of state.map.tiles) tile.road = true;
    const reachable = reachableTiles(state, unit);
    expect(reachable).toContainEqual({ tile: 6, cost: 2 });
    expect(reachable.some(({ tile }) => tile === 7)).toBe(false);
    expect(turnsToReach(state, unit, 7)).toBe(2);
  });
  it('applies Civ5 zone of control unless the unit ignores it', () => {
    const state = makeState();
    const unit = makeUnit(17);
    const enemyTile = neighbors(state.map, unit.tile)[0];
    const enemy = { ...makeUnit(enemyTile), id: 2, owner: 0 };
    state.units[enemy.id] = enemy;
    const zocTile = neighbors(state.map, unit.tile).find((candidate) => neighbors(state.map, enemyTile).includes(candidate))!;
    expect(reachableTiles(state, unit)).toContainEqual({ tile: zocTile, cost: 1 });
    state.players[0].vis[enemyTile] = 2;
    expect(moveCost(state, unit, unit.tile, zocTile)).toBe(2);
    expect(reachableTiles(state, unit)).toContainEqual({ tile: zocTile, cost: 2 });
    UNITS.test_unit.abilities = ['noZoc'];
    expect(reachableTiles(state, unit)).toContainEqual({ tile: zocTile, cost: 1 });
    UNITS.test_unit.abilities = undefined;
  });

  it('treats unexplored terrain as passable and blocks enemy city centers', () => {
    const state = makeState();
    const unit = makeUnit(17);
    state.map.tiles[18].elevation = 'mountain';
    state.players[0].vis[18] = 0;
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    expect(findPath(state, unit, 18)).toEqual([18]);
    state.players[0].vis[18] = 1;
    state.map.tiles[18].elevation = 'flat';
    state.cities[1] = { tile: 18, owner: 0 } as GameState['cities'][number];
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    expect(findPath(state, unit, 18)).toBeNull();
  });

  it('does not let same-layer friendly units occupy the destination', () => {
    const state = makeState();
    const unit = makeUnit(17);
    const blocked = neighbors(state.map, unit.tile)[0];
    state.units[unit.id] = unit;
    state.units[2] = { ...makeUnit(blocked), id: 2 };
    expect(findPath(state, unit, blocked)).toBeNull();
  });
  it('blocks ice and impassable wonders; terrain-ignore cannot bypass mountains or sea technology', () => {
    const state = makeState();
    const unit = makeUnit(17);
    state.map.tiles[18].feature = 'ice';
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    state.map.tiles[18].feature = null;
    state.map.tiles[18].naturalWonder = 'ember_peak';
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    state.map.tiles[18].naturalWonder = null;
    UNITS.test_unit.abilities = ['ignoreTerrain'];
    state.map.tiles[18].feature = 'forest';
    expect(moveCost(state, unit, 17, 18)).toBe(1);
    state.map.tiles[18].elevation = 'mountain';
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    state.map.tiles[18].elevation = 'flat';
    state.map.tiles[18].terrain = 'coast';
    expect(moveCost(state, unit, 17, 18)).toBe(Infinity);
    UNITS.test_unit.abilities = undefined;
  });

  it('passes through friendly same-layer units without ending a turn stacked with one', () => {
    const state = makeState(5, 1);
    const unit = makeUnit(0);
    const friend = { ...makeUnit(1), id: 2 };
    state.units[unit.id] = unit;
    state.units[friend.id] = friend;
    expect(findPath(state, unit, 2)).toEqual([1, 2]);
    expect(reachableTiles(state, unit)).toContainEqual({ tile: 2, cost: 2 });
    expect(reachableTiles(state, unit).some(({ tile }) => tile === 1)).toBe(false);
    state.map.tiles[1].terrain = 'plains';
    expect(findPath(state, unit, 2)).toBeNull();
  });

  it('blocks enemy military and allows a wartime military capture of enemy civilians', () => {
    const state = makeState();
    const unit = makeUnit(17);
    const target = neighbors(state.map, unit.tile)[0];
    const enemy = { ...makeUnit(target), id: 2, owner: 0 };
    state.units[unit.id] = unit;
    state.units[enemy.id] = enemy;
    expect(findPath(state, unit, target)).toEqual([target]);
    state.players[0].vis[target] = 2;
    expect(findPath(state, unit, target)).toBeNull();
    state.units[enemy.id] = { ...enemy, type: 'settler' };
    expect(findPath(state, unit, target)).toEqual([target]);
  });

  it('uses unit vision directly and expands city vision by era and elevation', () => {
    const state = makeState();
    state.units[1] = makeUnit(17);
    UNITS.test_unit.vision = 1;
    state.players[0].vis = [];
    recomputeVisibility(state, BARBARIAN, () => {});
    expect(state.players[0].vis[18]).toBe(2);
    expect(state.players[0].vis[19]).toBe(0);
    state.units = {};
    state.cities[1] = { tile: 0, owner: BARBARIAN } as GameState['cities'][number];
    state.run.era = 4;
    state.players[0].vis.fill(0);
    recomputeVisibility(state, BARBARIAN, () => {});
    expect(state.players[0].vis[17]).toBe(2);
    expect(state.players[0].vis[6]).toBe(0);
    UNITS.test_unit.vision = 2;
  });
  it('adds elevated vision range and lets elevated observers see over blockers', () => {
    const state = makeState();
    const unit = makeUnit(17);
    state.units[unit.id] = unit;
    state.map.tiles[18].feature = 'forest';
    state.players[0].vis.fill(0);
    recomputeVisibility(state, BARBARIAN, () => {});
    expect(state.players[0].vis[19]).toBe(0);
    state.map.tiles[17].elevation = 'hills';
    state.players[0].vis.fill(0);
    recomputeVisibility(state, BARBARIAN, () => {});
    expect(state.players[0].vis[19]).toBe(2);
    expect(state.players[0].vis[21]).toBe(2);
  });

  it('reveals owned tiles and LOS-visible terrain, batches new exploration, and reports a natural wonder once', () => {
    const state = makeState();
    state.players[0].vis.fill(0);
    const source = 17;
    const unit = makeUnit(source);
    state.units[unit.id] = unit;
    state.map.tiles[18].feature = 'forest';
    state.map.tiles[18].naturalWonder = 'test_wonder';
    state.map.tiles[20].owner = BARBARIAN;
    const events: { type: string; tiles?: number[] }[] = [];
    const emit = (event: { type: string; tiles?: number[] }) => events.push(event);
    recomputeVisibility(state, BARBARIAN, emit);
    expect(state.players[0].vis[18]).toBe(2);
    expect(state.players[0].vis[19]).toBe(0);
    expect(state.players[0].vis[20]).toBe(2);
    expect(events.filter((event) => event.type === 'tilesRevealed')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'naturalWonderFound')).toHaveLength(1);
    recomputeVisibility(state, BARBARIAN, emit);
    expect(events.filter((event) => event.type === 'naturalWonderFound')).toHaveLength(1);
  });
});
