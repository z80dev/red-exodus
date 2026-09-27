import { describe, expect, it } from 'vitest';
import type { Emit, SimEvent } from './types';
import { HUMAN } from './types';
import { BUILDINGS, RESOURCES, TECHS } from '../content';
import {
  ERA_TECH_COST, FREE_UNITS_BASE, FREE_UNITS_PER_CITY, HAPPINESS_BASE, HAPPINESS_PER_CITY, LUXURY_HAPPINESS,
  POP_PER_UNHAPPY, TECH_COST_PER_KNOWN, availableTechs, computeHappiness, goldPerTurn, hasResource, processResearch,
  techCost, unitUpkeep, updateHappiness,
} from './economy';
import { cityTerritory } from './cities';
import { plainGame } from './testkit';

function recorder(): { emit: Emit; events: SimEvent[] } {
  const events: SimEvent[] = [];
  return { emit: (ev) => { events.push(ev); }, events };
}

const rootTech = () => Object.values(TECHS).filter((t) => t.prereqs.length === 0).sort((a, b) => a.id.localeCompare(b.id))[0];

describe('happiness', () => {
  it('base − cities − pop/2 + one bonus per distinct connected luxury', () => {
    const { state, cityId } = plainGame('ECO-HAPPY');
    const city = state.cities[cityId];
    city.pop = 5;
    // strip luxuries so the baseline is exact, then connect two copies of one luxury
    for (const t of state.map.tiles) if (t.owner === HUMAN) t.resource = null;
    const base = HAPPINESS_BASE + HAPPINESS_PER_CITY - Math.floor(5 / POP_PER_UNHAPPY)
      + city.buildings.reduce((s, b) => s + (BUILDINGS[b]?.happiness ?? 0), 0);
    expect(computeHappiness(state, HUMAN).value).toBe(base);

    const lux = Object.values(RESOURCES).find((r) => r.kind === 'luxury' && !r.revealTech)!;
    const [a, b] = cityTerritory(state, city).filter((i) => i !== city.tile);
    for (const i of [a, b]) Object.assign(state.map.tiles[i], { resource: lux.id, improvement: lux.improvement, pillaged: false });
    expect(computeHappiness(state, HUMAN).value).toBe(base + (lux.happiness ?? LUXURY_HAPPINESS));
    state.map.tiles[a].pillaged = true;
    state.map.tiles[b].improvement = null;
    expect(computeHappiness(state, HUMAN).value).toBe(base);
  });

  it('updateHappiness emits only when the value changes', () => {
    const { state, cityId } = plainGame('ECO-HAPPY-EV');
    const { emit, events } = recorder();
    updateHappiness(state, HUMAN, emit);
    const n = events.length;
    updateHappiness(state, HUMAN, emit);
    expect(events.length).toBe(n);
    state.cities[cityId].pop += 4;
    updateHappiness(state, HUMAN, emit);
    expect(events.at(-1)).toEqual({ type: 'happinessChanged', player: HUMAN, value: state.players[HUMAN].happiness });
  });
});

describe('gold', () => {
  it('units beyond the free allowance cost 1 gold each', () => {
    const { state } = plainGame('ECO-UPKEEP');
    const owned = Object.values(state.units).filter((u) => u.owner === HUMAN).length;
    const free = FREE_UNITS_BASE + FREE_UNITS_PER_CITY * 1;
    expect(unitUpkeep(state, HUMAN)).toBe(Math.max(0, owned - free));
    const template = Object.values(state.units).find((u) => u.owner === HUMAN)!;
    for (let i = 0; i < free + 2; i++) state.units[9000 + i] = { ...template, id: 9000 + i };
    expect(unitUpkeep(state, HUMAN)).toBe(owned + free + 2 - free);
    const g = goldPerTurn(state, HUMAN);
    expect(g.net).toBeCloseTo(g.income - g.maintenance, 5);
  });
});

describe('research', () => {
  it('tech cost = era base × (1 + 6% per known tech)', () => {
    const { state } = plainGame('ECO-TECH');
    const t = rootTech();
    expect(techCost(state, HUMAN, t.id)).toBe(Math.round(ERA_TECH_COST[t.era]));
    state.players[HUMAN].techs = Object.keys(TECHS).filter((id) => id !== t.id).slice(0, 5);
    expect(techCost(state, HUMAN, t.id)).toBe(Math.round(ERA_TECH_COST[t.era] * (1 + TECH_COST_PER_KNOWN * 5)));
  });

  it('only techs with all prerequisites known are available', () => {
    const { state } = plainGame('ECO-PREREQ');
    const avail = availableTechs(state, HUMAN);
    expect(avail.length).toBeGreaterThan(0);
    for (const id of avail) expect(TECHS[id].prereqs).toEqual([]);
  });

  it('science overflows into the next tech; at most one tech per turn; idle science is banked', () => {
    const { state } = plainGame('ECO-OVERFLOW');
    const p = state.players[HUMAN];
    const t = rootTech();
    const { emit, events } = recorder();
    // no research chosen: science is banked, nothing is granted
    processResearch(state, HUMAN, 12, emit);
    expect(p.techs).toEqual([]);
    expect(p.counters.sciOverflow).toBe(12);
    p.researching = t.id;
    const cost = techCost(state, HUMAN, t.id);
    processResearch(state, HUMAN, cost * 3, emit);
    expect(p.techs).toEqual([t.id]);
    expect(p.researching).toBeNull();
    expect(p.counters.sciOverflow).toBeCloseTo(cost * 3 + 12 - cost, 5);
    expect(events).toContainEqual({ type: 'techResearched', player: HUMAN, tech: t.id });
  });
});

describe('resources', () => {
  it('a resource is connected only by its (unpillaged) improvement or a city center', () => {
    const { state, cityId } = plainGame('ECO-RES');
    const city = state.cities[cityId];
    for (const t of state.map.tiles) if (t.owner === HUMAN) t.resource = null;
    const res = Object.values(RESOURCES).find((r) => r.kind === 'strategic')!;
    const tile = cityTerritory(state, city).find((i) => i !== city.tile)!;
    const t = state.map.tiles[tile];
    Object.assign(t, { resource: res.id, improvement: null, pillaged: false });
    expect(hasResource(state, HUMAN, res.id)).toBe(false);
    t.improvement = res.improvement;
    expect(hasResource(state, HUMAN, res.id)).toBe(true);
    t.pillaged = true;
    expect(hasResource(state, HUMAN, res.id)).toBe(false);
    state.map.tiles[city.tile].resource = res.id;
    expect(hasResource(state, HUMAN, res.id)).toBe(true);
  });
});
