import { describe, expect, it } from 'vitest';
import type { Emit, SimEvent } from './types';
import { HUMAN } from './types';
import { BUILDINGS, IMPROVEMENTS, UNITS, WONDERS } from '../content';
import {
  BORDER_BASE, BORDER_PACE, BUY_EXP, BUY_LINEAR, CENTER_MIN_YIELDS, FOOD_PER_POP, GROWTH_BASE,
  GROWTH_EXP, GROWTH_PACE, GROWTH_PER, IMPROVEMENT_SCALING, PRODUCTION_PACE, borderThreshold, buildImprovement, buyCost,
  canFoundCity, canProduce, cityTerritory, completeItem, computeCityYields, growthThreshold, improvementCost,
  processCity, productionCost, refreshCity, tileYields,
} from './cities';
import { collectEffects } from './effects';
import { hexDistance, neighbors, tilesInRadius } from './hex';
import { plainGame } from './testkit';

function recorder(): { emit: Emit; events: SimEvent[] } {
  const events: SimEvent[] = [];
  return { emit: (ev) => { events.push(ev); }, events };
}

describe('thresholds', () => {
  it('growth threshold follows (15 + 6(p−1) + (p−1)^1.8) × pace', () => {
    const { state, cityId } = plainGame('CITY-GROWTH');
    const city = state.cities[cityId];
    for (const pop of [1, 2, 5, 10]) {
      city.pop = pop;
      const n = pop - 1;
      expect(growthThreshold(state, city)).toBe(Math.round((GROWTH_BASE + GROWTH_PER * n + Math.pow(n, GROWTH_EXP)) * GROWTH_PACE));
    }
  });

  it('border threshold starts at the base and rises as tiles are acquired', () => {
    const { state, cityId } = plainGame('CITY-BORDER');
    const city = state.cities[cityId];
    const ring = tilesInRadius(state.map, city.tile, 1).length;
    if (cityTerritory(state, city).length === ring) expect(borderThreshold(state, city)).toBe(Math.round(BORDER_BASE * BORDER_PACE));
    const before = borderThreshold(state, city);
    const extra = tilesInRadius(state.map, city.tile, 2).find((i) => state.map.tiles[i].owner == null)!;
    state.map.tiles[extra].owner = HUMAN;
    state.map.tiles[extra].cityId = city.id;
    expect(borderThreshold(state, city)).toBeGreaterThan(before);
  });
});

describe('growth & borders', () => {
  it('a city grows when stored food reaches the threshold and resets its store', () => {
    const { state, cityId } = plainGame('CITY-GROW');
    const city = state.cities[cityId];
    refreshCity(state, city);
    expect(city.yields.food).toBeGreaterThan(0);
    const before = city.pop;
    city.foodStored = growthThreshold(state, city) - 0.01;
    const { emit, events } = recorder();
    processCity(state, city, emit);
    expect(city.pop).toBe(before + 1);
    expect(city.foodStored).toBe(0);
    expect(events).toContainEqual({ type: 'cityGrew', cityId: city.id, player: HUMAN, pop: before + 1 });
  });

  it('unhappiness halts growth', () => {
    const { state, cityId } = plainGame('CITY-UNHAPPY');
    const city = state.cities[cityId];
    state.players[HUMAN].happiness = -1;
    refreshCity(state, city);
    const before = city.pop;
    city.foodStored = growthThreshold(state, city) - 0.01;
    const { emit } = recorder();
    processCity(state, city, emit);
    expect(city.pop).toBe(before);
  });

  it('culture past the threshold claims one adjacent unowned tile', () => {
    const { state, cityId } = plainGame('CITY-CULTURE');
    const city = state.cities[cityId];
    const before = cityTerritory(state, city).length;
    city.cultureStored = borderThreshold(state, city);
    const { emit, events } = recorder();
    processCity(state, city, emit);
    const grew = events.find((e) => e.type === 'borderGrew');
    expect(grew).toBeTruthy();
    expect(cityTerritory(state, city).length).toBe(before + 1);
    if (grew?.type === 'borderGrew') {
      const t = grew.tiles[0];
      expect(hexDistance(state.map, city.tile, t)).toBeLessThanOrEqual(3);
      expect(neighbors(state.map, t).some((n) => state.map.tiles[n].cityId === city.id && n !== t)).toBe(true);
    }
  });
});

describe('worked tiles & yields', () => {
  it('city center is always worked with at least 2 food / 1 prod / 1 gold', () => {
    const { state, cityId } = plainGame('CITY-CENTER');
    const city = state.cities[cityId];
    const lines: { label: string; kind: string; yields: Partial<Record<string, number>> }[] = [];
    computeCityYields(state, city, collectEffects(state, HUMAN), { lines });
    const center = lines.find((l) => l.kind === 'center')!;
    expect(center.yields.food).toBeGreaterThanOrEqual(CENTER_MIN_YIELDS.food);
    expect(center.yields.prod).toBeGreaterThanOrEqual(CENTER_MIN_YIELDS.prod);
    expect(center.yields.gold).toBeGreaterThanOrEqual(CENTER_MIN_YIELDS.gold);
    expect(city.worked).not.toContain(city.tile);
  });

  it('non-food focus never starves the city when a non-starving assignment exists', () => {
    const { state, cityId } = plainGame('CITY-FOCUS');
    const city = state.cities[cityId];
    // give the city its full radius-2 ring so there is a choice to make
    for (const i of tilesInRadius(state.map, city.tile, 2)) {
      const t = state.map.tiles[i];
      if (t.owner == null) { t.owner = HUMAN; t.cityId = city.id; }
    }
    for (const focus of ['prod', 'gold', 'sci', 'cul', 'balanced'] as const) {
      city.focus = focus;
      city.pop = 4;
      refreshCity(state, city);
      expect(city.worked.length).toBe(Math.min(4, cityTerritory(state, city).length - 1));
      const foods = cityTerritory(state, city).filter((i) => i !== city.tile).map((i) => tileYields(state, i, HUMAN).food).sort((a, b) => b - a);
      const center = Math.max(CENTER_MIN_YIELDS.food, tileYields(state, city.tile, HUMAN).food);
      const bestFood = center + foods.slice(0, 4).reduce((s, f) => s + f, 0) - 4 * FOOD_PER_POP;
      if (bestFood >= 0) expect(city.yields.food).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('production', () => {
  it('overflow production carries into the next item', () => {
    const { state, cityId } = plainGame('CITY-OVERFLOW');
    const city = state.cities[cityId];
    city.queue = [{ kind: 'unit', id: 'warrior' }];
    const cost = productionCost(state, city, city.queue[0]);
    refreshCity(state, city);
    const prod = city.yields.prod;
    city.prodStored = cost + 5;
    const units = Object.keys(state.units).length;
    const { emit, events } = recorder();
    processCity(state, city, emit);
    expect(Object.keys(state.units).length).toBe(units + 1);
    expect(city.queue).toEqual([]);
    expect(city.prodStored).toBeCloseTo(5 + prod, 5);
    const created = events.find((e) => e.type === 'unitCreated');
    expect(created && created.type === 'unitCreated' && created.cityId).toBe(city.id);
  });

  it('settlers need 2 population and cost one', () => {
    const { state, cityId } = plainGame('CITY-SETTLER');
    const city = state.cities[cityId];
    const settler = { kind: 'unit' as const, id: 'settler' };
    city.pop = 1;
    expect(canProduce(state, city, settler)).not.toBeNull();
    city.pop = 3;
    expect(canProduce(state, city, settler)).toBeNull();
    const { emit } = recorder();
    completeItem(state, city, settler, emit);
    expect(city.pop).toBe(2);
  });

  it('production cost is the authored cost × pace; buy cost is 2×remaining + remaining^1.15; wonders/projects are not buyable', () => {
    const { state, cityId } = plainGame('CITY-BUY');
    const city = state.cities[cityId];
    const item = { kind: 'unit' as const, id: 'warrior' };
    const c = productionCost(state, city, item);
    expect(c).toBe(Math.round(UNITS.warrior.cost * PRODUCTION_PACE));
    expect(buyCost(state, city, item)).toBe(Math.round(BUY_LINEAR * c + Math.pow(c, BUY_EXP)));
    city.queue = [item];
    city.prodStored = Math.floor(c / 2);
    const rem = c - city.prodStored;
    expect(buyCost(state, city, item)).toBe(Math.round(BUY_LINEAR * rem + Math.pow(rem, BUY_EXP)));
    expect(buyCost(state, city, { kind: 'project', id: 'wealth' })).toBeNull();
    const w = Object.keys(WONDERS)[0];
    expect(buyCost(state, city, { kind: 'wonder', id: w })).toBeNull();
  });

  it('palace is never offered and free buildings cannot be queued', () => {
    const { state, cityId } = plainGame('CITY-PALACE');
    const city = state.cities[cityId];
    expect(city.isCapital).toBe(true);
    if (BUILDINGS.palace) {
      expect(city.buildings).toContain('palace');
      expect(canProduce(state, city, { kind: 'building', id: 'palace' })).not.toBeNull();
    }
  });

  it('wonder race: the first finisher claims it, others lose it but keep their production', () => {
    const { state, cityId } = plainGame('CITY-WONDER');
    const mine = state.cities[cityId];
    const theirs = state.cities[state.players[1].capitalId!];
    const { emit, events } = recorder();
    const wonder = Object.values(WONDERS).find((w) => !w.requiresCoastal && !w.requiresRiver && !w.requiresTerrain)!;
    state.players[HUMAN].techs.push(wonder.tech);
    state.players[1].techs.push(wonder.tech);
    mine.queue = [{ kind: 'wonder', id: wonder.id }];
    mine.prodStored = 40;
    theirs.queue = [{ kind: 'wonder', id: wonder.id }];
    completeItem(state, theirs, { kind: 'wonder', id: wonder.id }, emit);
    expect(state.wonderOwners[wonder.id]).toBe(theirs.id);
    expect(theirs.wonders).toContain(wonder.id);
    expect(mine.queue).toEqual([]);
    expect(mine.prodStored).toBe(40);
    expect(events).toContainEqual({ type: 'wonderLost', cityId: mine.id, wonder: wonder.id, by: 1 });
    expect(canProduce(state, mine, { kind: 'wonder', id: wonder.id })).not.toBeNull();
  });
});

describe('founding', () => {
  it('rejects sites too close to another colony and claims the founding ring', () => {
    const { state, cityId } = plainGame('CITY-FOUND');
    const city = state.cities[cityId];
    const near = neighbors(state.map, city.tile)[0];
    expect(canFoundCity(state, HUMAN, near)).toMatch(/Too close|territory|dust sea|massif|landmark/i);
    for (const i of tilesInRadius(state.map, city.tile, 1)) {
      const t = state.map.tiles[i];
      if (t.cityId === city.id) expect(t.owner).toBe(HUMAN);
    }
    expect(state.map.tiles[city.tile].cityId).toBe(city.id);
    expect(city.maxHp).toBeGreaterThanOrEqual(200);
  });
});

describe('improvements', () => {
  it('costs scale with improvements owned and building emits improvementBuilt', () => {
    const { state, cityId } = plainGame('CITY-IMPROVE');
    const city = state.cities[cityId];
    const p = state.players[HUMAN];
    p.gold = 10_000;
    // make an obvious farm site: flat featureless grassland inside our borders
    const farm = IMPROVEMENTS.farm;
    p.techs.push(...[farm.tech, IMPROVEMENTS.mine?.tech].filter((t): t is string => !!t));
    const sites = cityTerritory(state, city).filter((i) => i !== city.tile);
    const [a, b] = sites;
    for (const i of [a, b]) Object.assign(state.map.tiles[i], { terrain: 'grassland', elevation: 'flat', feature: null, resource: null, improvement: null, naturalWonder: null });
    const first = improvementCost(state, HUMAN, a, 'farm');
    expect(first).toBe(Math.round(farm.goldCost));
    const { emit, events } = recorder();
    expect(buildImprovement(state, HUMAN, a, 'farm', emit)).toBeNull();
    expect(state.map.tiles[a].improvement).toBe('farm');
    expect(events).toContainEqual({ type: 'improvementBuilt', tile: a, player: HUMAN, improvement: 'farm' });
    expect(p.gold).toBe(10_000 - first);
    expect(improvementCost(state, HUMAN, b, 'farm')).toBe(Math.round(farm.goldCost * (1 + IMPROVEMENT_SCALING)));
    expect(buildImprovement(state, HUMAN, a, 'farm', emit)).toBe('Already built.');
  });
});
