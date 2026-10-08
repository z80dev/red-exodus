// Test fixture: a tiny self-contained GameState for roguelite unit tests (no mapgen / SimCore needed).
import { seedRng } from '../rng';
import type { City, GameState, Player, Tile } from '../types';
import { HUMAN } from '../types';

function tile(idx: number): Tile {
  return {
    idx, col: idx, row: 0, terrain: 'grassland', elevation: 'flat', feature: null, riverEdges: 0, resource: null,
    improvement: null, road: false, naturalWonder: null, owner: HUMAN, cityId: 1, height: 0.5,
    camp: false, ruin: false,
  };
}

export function testCity(id: number, name: string, pop: number, order: number, extra: Partial<City> = {}): City {
  return {
    id, owner: HUMAN, name, tile: 0, pop, foodStored: 0, prodStored: 0, queue: [], buildings: [],
    wonders: [], focus: 'balanced', worked: [], cultureStored: 0, hp: 200, maxHp: 200, isCapital: order === 0,
    foundedTurn: 1, hasStruck: false, yields: { food: 0, prod: 0, gold: 0, sci: 0, cul: 0 }, starving: false, order,
    ...extra,
  };
}

export function testState(seed = 'TEST'): GameState {
  const human: Player = {
    id: HUMAN, name: 'Tester', civName: 'Testia', leaderId: '__test_leader', colors: { primary: '#ffffff', secondary: '#000000' },
    isHuman: true, alive: true, gold: 0, techs: [], researching: null, researchProgress: {}, vis: [2, 2, 2, 2],
    happiness: 0, ai: null, capitalId: 1, citiesFounded: 1, counters: {}, effectCounters: {},
    cryo: 3, researchOffer: [], researchRerolls: 0,
  };
  return {
    schema: 1,
    config: { seed, leaderId: '__test_leader', ascension: 0, mapSize: 'small', rivals: 1, tutorial: false, daily: false },
    rng: seedRng(seed),
    turn: 1,
    map: { width: 4, height: 1, tiles: [tile(0), tile(1), tile(2), tile(3)], starts: [0] },
    players: [human],
    cities: { 1: testCity(1, 'Capitol', 3, 0) },
    units: {},
    nextId: 100,
    run: undefined as unknown as GameState['run'],
    wonderOwners: {},
    naturalWondersSeen: {},
    log: [],
    gameOver: false,
    storms: [],
    nextStormId: 1,
  };
}
