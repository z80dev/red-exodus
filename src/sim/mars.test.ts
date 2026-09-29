import { afterEach, describe, expect, it } from 'vitest';
import type { LeaderDef } from './defs';
import type { Emit, GameState, SimEvent, StormCell, Unit } from './types';
import { HUMAN } from './types';
import { LEADERS, TECHS } from '../content';
import { applyAction } from './engine';
import { canFoundCity, tileYieldsDetailed } from './cities';
import { hexDistance } from './hex';
import {
  DROP_RANGE, STORM_DAMAGE, THAW_POP, advanceStorms, canDeclareWar, canOrbitalDrop, rerollResearch, researchRerollCost,
  rollResearchOffer, spawnStorm, stormAt, stormTarget,
} from './mars';
import { availableTechs } from './economy';
import { leaveCouncil } from './roguelite/run';
import { autoplay, newGame, plainGame, startPlaying } from './testkit';

function recorder(): { emit: Emit; events: SimEvent[] } {
  const events: SimEvent[] = [];
  return { emit: (ev) => { events.push(ev); }, events };
}

/** a still storm parked on `tile` for `rounds` rounds */
function parkStorm(state: GameState, tile: number, power: number, rounds = 3): StormCell {
  const cell: StormCell = { id: state.nextStormId++, path: Array(rounds).fill(tile), step: 0, radius: 1, power };
  state.storms.push(cell);
  return cell;
}

function humanUnit(state: GameState, type = 'warrior'): Unit {
  return Object.values(state.units).find((u) => u.owner === HUMAN && u.type === type)!;
}

/** explored, foundable tiles at hex distance [lo, hi] from the human capital */
function sites(state: GameState, lo: number, hi: number): number[] {
  const cap = state.cities[state.players[HUMAN].capitalId!];
  return state.map.tiles
    .filter((t) => {
      const d = hexDistance(state.map, cap.tile, t.idx);
      return d >= lo && d <= hi && canFoundCity(state, HUMAN, t.idx) == null
        && !Object.values(state.units).some((u) => u.tile === t.idx);
    })
    .map((t) => t.idx);
}

describe('dust storms', () => {
  it('the forecast is the truth: after each round the eye sits where the forecast said', () => {
    const { state } = plainGame('STORM-FORECAST');
    const { emit, events } = recorder();
    const cell = spawnStorm(state, { power: 2, radius: 1 }, emit)!;
    expect(cell).not.toBeNull();
    expect(events[0]).toMatchObject({ type: 'stormSpawned', storm: { id: cell.id } });
    const { width, height } = state.map;
    const start = state.map.tiles[cell.path[0]];
    expect(start.col === 0 || start.col === width - 1 || start.row === 0 || start.row === height - 1).toBe(true);
    for (let i = 1; i < cell.path.length; i++) expect(hexDistance(state.map, cell.path[i - 1], cell.path[i])).toBe(1);
    const route = [...cell.path];
    for (let step = 1; step < route.length; step++) {
      state.storms = state.storms.filter((s) => s.id === cell.id);
      advanceStorms(state, emit);
      const live = state.storms.find((s) => s.id === cell.id)!;
      expect(live.path[live.step]).toBe(route[step]);
    }
    advanceStorms(state, emit);
    expect(state.storms.some((s) => s.id === cell.id)).toBe(false);
    expect(events.some((e) => e.type === 'stormEnded' && e.id === cell.id && e.tile === route.at(-1))).toBe(true);
  });

  it('storm routes and spawns are deterministic for a seed', () => {
    const run = () => {
      const { state } = plainGame('STORM-DET');
      for (let i = 0; i < 12; i++) advanceStorms(state, () => {});
      return JSON.stringify({ storms: state.storms, rng: state.rng, next: state.nextStormId });
    };
    expect(run()).toBe(run());
  });

  it('keeps more cells active later and in the Crisis chapter', () => {
    const { state } = plainGame('STORM-TARGET');
    state.run.era = 0;
    state.run.chapter = 0;
    expect(stormTarget(state)).toBe(1);
    state.run.chapter = 2;
    expect(stormTarget(state)).toBe(2);
    state.run.era = 4;
    state.run.chapter = 0;
    expect(stormTarget(state)).toBe(3);
  });

  it('halves Food and Industry inside the storm with a readable breakdown line', () => {
    const { state, cityId } = plainGame('STORM-YIELD');
    const city = state.cities[cityId];
    const tile = state.map.tiles.find((t) => t.cityId === city.id && t.idx !== city.tile
      && tileYieldsDetailed(state, t.idx, HUMAN).food + tileYieldsDetailed(state, t.idx, HUMAN).prod >= 2)!;
    const clear = tileYieldsDetailed(state, tile.idx, HUMAN);
    parkStorm(state, tile.idx, 1);
    const lines: { label: string; yields: Partial<Record<string, number>> }[] = [];
    const stormy = tileYieldsDetailed(state, tile.idx, HUMAN, undefined, lines);
    expect(stormy.food).toBe(Math.floor(clear.food / 2));
    expect(stormy.prod).toBe(Math.floor(clear.prod / 2));
    expect(stormy.gold).toBe(clear.gold);
    expect(lines.find((l) => l.label === 'Dust storm')?.yields.food).toBe(stormy.food - clear.food);
  });

  it('batters units in the open (half when fortified), damages colonies but never below 1 HP', () => {
    const { state, cityId } = plainGame('STORM-DMG');
    const city = state.cities[cityId];
    const scout = humanUnit(state, 'scout');
    const warrior = humanUnit(state);
    const open = state.map.tiles.find((t) => hexDistance(state.map, city.tile, t.idx) >= 3 && !state.map.tiles[t.idx].cityId
      && !Object.values(state.units).some((u) => u.tile === t.idx))!.idx;
    // a scout in the open and a fortified warrior share one storm; the Ark Hab sits under another
    scout.tile = open;
    warrior.tile = open;
    warrior.order = { kind: 'fortify' };
    parkStorm(state, open, 2);
    parkStorm(state, city.tile, 3);
    city.hp = 20;
    const { emit, events } = recorder();
    advanceStorms(state, emit);
    expect(scout.hp).toBe(100 - STORM_DAMAGE * 2);
    expect(warrior.hp).toBe(100 - STORM_DAMAGE);
    expect(city.hp).toBe(1);
    expect(events).toContainEqual({ type: 'stormDamage', tile: open, amount: STORM_DAMAGE * 2, unitId: scout.id, player: HUMAN, killed: false });
    expect(state.run.stats.extra.stormHits).toBe(3);
  });

  it('can kill: lost units emit unitDied with no killer and count as unitsLost', () => {
    const { state } = plainGame('STORM-KILL');
    const scout = humanUnit(state, 'scout');
    scout.hp = 5;
    parkStorm(state, scout.tile, 1);
    const lost = state.run.stats.unitsLost;
    const r = applyAction(state, { type: 'endTurn' });
    expect(state.units[scout.id]).toBeUndefined();
    const died = r.events.find((e) => e.type === 'unitDied' && e.unitId === scout.id);
    expect(died).toMatchObject({ killer: undefined });
    expect(r.events.findIndex((e) => e.type === 'stormDamage' && e.unitId === scout.id && e.killed)).toBeLessThan(r.events.indexOf(died!));
    expect(state.run.stats.unitsLost).toBe(lost + 1);
  });

  it('shelter counter spares a player for the round', () => {
    const { state } = plainGame('STORM-SHELTER');
    const scout = humanUnit(state, 'scout');
    parkStorm(state, scout.tile, 3);
    state.players[HUMAN].counters.stormShelter = state.turn;
    advanceStorms(state, () => {});
    expect(scout.hp).toBe(100);
  });
});

describe('the Ark: Orbital Drops and Thaws', () => {
  it('validates range, storms and pods, then lands a colony through the normal founding path', () => {
    const { state } = plainGame('ARK-DROP');
    const p = state.players[HUMAN];
    const near = sites(state, 4, DROP_RANGE)[0];
    const far = sites(state, DROP_RANGE + 1, 99)[0];
    expect(near).toBeDefined();
    p.vis[near] = 0;
    expect(canOrbitalDrop(state, HUMAN, near)).toMatch(/survey/);
    p.vis[near] = 1;
    if (far != null) {
      p.vis[far] = 1;
      expect(canOrbitalDrop(state, HUMAN, far)).toMatch(new RegExp(`within ${DROP_RANGE}`));
    }
    const storm = parkStorm(state, near, 1);
    expect(canOrbitalDrop(state, HUMAN, near)).toMatch(/storm/);
    state.storms = state.storms.filter((s) => s !== storm);
    const pods = p.cryo;
    p.cryo = 0;
    expect(applyAction(state, { type: 'orbitalDrop', tile: near }).error).toMatch(/Cryo/);
    p.cryo = pods;
    const r = applyAction(state, { type: 'orbitalDrop', tile: near });
    expect(r.ok).toBe(true);
    expect(p.cryo).toBe(pods - 1);
    const landed = r.events.findIndex((e) => e.type === 'podLanded' && e.tile === near);
    const founded = r.events.findIndex((e) => e.type === 'cityFounded' && e.tile === near);
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(founded).toBeGreaterThan(landed);
    expect(r.events).toContainEqual({ type: 'cryoChanged', player: HUMAN, value: pods - 1, delta: -1 });
    expect(state.map.tiles[near].cityId).not.toBeNull();
    expect(state.run.stats.extra.drops).toBe(1);
    expect(state.run.stats.citiesFounded).toBe(1);
  });

  it('thaws 1 pod into +THAW_POP colonists and refuses with no pods', () => {
    const { state, cityId } = plainGame('ARK-THAW');
    const p = state.players[HUMAN];
    const city = state.cities[cityId];
    const pop = city.pop;
    const pods = p.cryo;
    const r = applyAction(state, { type: 'thawColonists', cityId });
    expect(r.ok).toBe(true);
    expect(city.pop).toBe(pop + THAW_POP);
    expect(p.cryo).toBe(pods - 1);
    expect(r.events).toContainEqual({ type: 'colonistsThawed', player: HUMAN, cityId, pop: THAW_POP });
    p.cryo = 0;
    expect(applyAction(state, { type: 'thawColonists', cityId }).error).toMatch(/Cryo/);
    const rival = state.players[1].capitalId!;
    p.cryo = 2;
    expect(applyAction(state, { type: 'thawColonists', cityId: rival }).ok).toBe(false);
  });

  it('every surviving nation gets a pod at each new era', () => {
    const { state } = plainGame('ARK-ERA');
    const before = state.players.map((p) => p.cryo);
    state.run.phase = 'council';
    state.run.chapter = 2;
    state.run.council = null;
    expect(leaveCouncil(state, () => {})).toBeNull();
    expect(state.run.era).toBe(1);
    state.players.forEach((p, i) => {
      if (p.alive && p.id !== 99) expect(p.cryo).toBe(before[i] + 1);
    });
  });
});

describe('Breakthrough draft', () => {
  it('the human may only research offered techs; completing research redraws', () => {
    const { state } = plainGame('DRAFT-OFFER');
    const p = state.players[HUMAN];
    expect(p.researchOffer.length).toBeGreaterThan(0);
    const avail = availableTechs(state, HUMAN);
    const outside = avail.find((t) => !p.researchOffer.includes(t));
    if (outside) expect(applyAction(state, { type: 'setResearch', tech: outside }).ok).toBe(false);
    const pick = p.researchOffer[0];
    expect(applyAction(state, { type: 'setResearch', tech: pick }).ok).toBe(true);
    p.researchProgress[pick] = 1e6;
    const r = applyAction(state, { type: 'endTurn' });
    expect(p.techs).toContain(pick);
    const offered = r.events.filter((e) => e.type === 'researchOffered');
    expect(offered.length).toBeGreaterThan(0);
    expect(p.researchOffer).not.toContain(pick);
    for (const t of p.researchOffer) expect(TECHS[t].prereqs.every((q) => p.techs.includes(q))).toBe(true);
  });

  it('rerolls cost 15 Credits, then +10 per reroll of the same offer', () => {
    const { state } = plainGame('DRAFT-REROLL');
    const p = state.players[HUMAN];
    // with only the offered techs available there is nothing else to draw
    p.gold = 100;
    if (availableTechs(state, HUMAN).length === p.researchOffer.length) {
      expect(applyAction(state, { type: 'rerollResearch' }).error).toMatch(/No other research/);
    }
    // open up the era-1 tree so rerolls have a pool to draw from
    p.techs = Object.values(TECHS).filter((t) => t.era === 0).map((t) => t.id);
    rollResearchOffer(state, HUMAN, () => {});
    expect(p.gold).toBe(100);
    expect(researchRerollCost(state, HUMAN)).toBe(15);
    const first = [...p.researchOffer];
    const r = applyAction(state, { type: 'rerollResearch' });
    expect(r.ok).toBe(true);
    expect(p.gold).toBe(85);
    expect(r.events).toContainEqual({ type: 'researchOffered', player: HUMAN, techs: p.researchOffer, reroll: true });
    if (availableTechs(state, HUMAN).length >= first.length * 2) expect(p.researchOffer.some((t) => first.includes(t))).toBe(false);
    expect(researchRerollCost(state, HUMAN)).toBe(25);
    applyAction(state, { type: 'rerollResearch' });
    expect(p.gold).toBe(60);
    p.gold = 10;
    expect(applyAction(state, { type: 'rerollResearch' }).error).toMatch(/35 Credits/);
    expect(state.run.stats.extra.rerolls).toBe(2);
  });

  it('AIs research freely and cannot reroll', () => {
    const s = newGame('DRAFT-AI');
    startPlaying(s);
    expect(s.players[1].researchOffer).toEqual([]);
    expect(rerollResearch(s, 1, () => {})).toMatch(/Breakthrough/);
  });
});

describe('war declaration vetoes', () => {
  afterEach(() => { delete LEADERS.__veto; });

  it('runs warDeclaration hooks for both the declarer and the target', () => {
    const { state } = plainGame('WAR-VETO');
    LEADERS.__veto = {
      ...Object.values(LEADERS)[0], id: '__veto', startDoctrine: undefined,
      effects: { warDeclaration: (_ctx, a) => { a.allowed = false; a.reason = 'Armed neutrality'; } },
    } as LeaderDef;
    state.players[1].leaderId = '__plain__';
    expect(canDeclareWar(state, HUMAN, 1)).toBeNull();
    state.players[1].leaderId = '__veto';
    expect(canDeclareWar(state, HUMAN, 1)).toBe('Armed neutrality');
    expect(applyAction(state, { type: 'declareWar', target: 1 }).error).toBe('Armed neutrality');
    expect(state.players[HUMAN].relations[1]).toBe('peace');
    state.players[1].leaderId = '__plain__';
    state.players[HUMAN].leaderId = '__veto';
    expect(canDeclareWar(state, HUMAN, 1)).toBe('Armed neutrality');
  });
});

describe('storms in play', () => {
  it('a 30-turn autoplay sees storms spawn and move', () => {
    const s = newGame('STORM-AUTOPLAY');
    const seen = new Set<number>();
    let moved = 0;
    const orig = s.storms;
    expect(orig).toEqual([]);
    for (let t = 0; t < 30 && !s.gameOver; t++) {
      autoplay(s, 1);
      for (const c of s.storms) {
        if (seen.has(c.id) && c.step > 0) moved++;
        seen.add(c.id);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    expect(moved).toBeGreaterThan(0);
    for (const c of s.storms) expect(stormAt(s, c.path[c.step])).not.toBeNull();
  }, 60_000);
});
