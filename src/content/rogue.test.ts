// OWNER: ContentRogue. Integrity + smoke tests for the roguelite content set: doctrines, edicts, scrolls,
// crises, omens, leaders (+ uniques), reforms, ascension.
import { describe, expect, it } from 'vitest';
import type { ChronicleCtx, CombatArgs, CostItem, EffectHooks, HookCtx } from '../sim/defs';
import type { City, CouncilState, DoctrineInstance, GameState, SimEvent, Unit, Yields } from '../sim/types';
import { BARBARIAN, HUMAN, PILLARS } from '../sim/types';
import { DOCTRINES } from './index';
import { EDICTS } from './edicts';
import { SCROLLS } from './scrolls';
import { CRISES } from './crises';
import { OMENS } from './omens';
import { LEADERS } from './leaders';
import { REFORMS } from './reforms';
import { ASCENSIONS } from './ascension';
import { UNIQUE_BUILDINGS, UNIQUE_UNITS } from './uniques';
import { BUILDINGS } from './buildings';
import { UNITS } from './units';
import { ICON_NAMES } from '../ui/icons/registry';
import { makeCtx } from '../sim/effects';
import type { ActiveEffect } from '../sim/effects';
import { createGame } from '../sim/engine';
import { humanCities } from '../sim/roguelite/stats';
import { autoplay, findNonFinite } from '../sim/testkit';

const MOTIFS = 'sun moon star river wave mountain tree wheat coin scroll flask lyre laurel crown sword shield tower castle anchor ship horse flame eye key hourglass skull compass gear bolt feather hand book temple pyramid mask chalice serpent owl lion eagle'.split(' ');
const ICONS = new Set<string>(ICON_NAMES);
const TOKENS = new Set(['food', 'prod', 'gold', 'sci', 'cul', 'happy', 'influence', 'renown', 'splendor', 'mandate']);
const UNLOCK_RULES = new Set([
  'reachEra2', 'reachEra3', 'reachEra4', 'reachEra5', 'win', 'winAsc2', 'winAsc4', 'winAsc8', 'capture5', 'kills40',
  'wonders4', 'wonders8', 'techs24', 'cities8', 'score100k', 'score1m', 'triumphs5', 'legendary', 'noMandateLost',
  'runs3', 'runs10', 'crises6', 'omens5', 'festival2000',
  ...Object.keys(LEADERS).map((id) => `winWith:${id}`),
]);

function badTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{([^}]*)\}/g)) {
    const t = m[1];
    if (t.startsWith('icon:')) { if (!ICONS.has(t.slice(5))) out.push(t); } else if (!TOKENS.has(t)) out.push(t);
  }
  return out;
}

const shop = Object.values(DOCTRINES).filter((d) => !d.noShop);

describe('doctrines', () => {
  it('meets the count and rarity distribution', () => {
    const by = (r: string) => shop.filter((d) => d.rarity === r).length;
    expect(shop.length).toBeGreaterThanOrEqual(120);
    expect(by('common')).toBeGreaterThanOrEqual(45);
    expect(by('uncommon')).toBeGreaterThanOrEqual(35);
    expect(by('rare')).toBeGreaterThanOrEqual(20);
    expect(by('legendary')).toBeGreaterThanOrEqual(8);
  });

  it('has valid art/icons/tokens, unique names, and tagged effects', () => {
    const names = new Set<string>();
    for (const d of Object.values(DOCTRINES)) {
      expect(DOCTRINES[d.id]).toBe(d);
      expect(MOTIFS, d.id).toContain(d.art.motif);
      expect(d.art.hue).toBeGreaterThanOrEqual(0);
      expect(d.art.hue).toBeLessThanOrEqual(360);
      expect(ICONS.has(d.icon), `${d.id} icon ${d.icon}`).toBe(true);
      expect(badTokens(d.description), d.id).toEqual([]);
      expect(d.tags.length, d.id).toBeGreaterThan(0);
      expect(names.has(d.name), d.name).toBe(false);
      names.add(d.name);
      if (d.unlock?.rule) expect(UNLOCK_RULES.has(d.unlock.rule), d.id).toBe(true);
    }
  });

  it('about thirty shop doctrines are meta-locked', () => {
    const locked = shop.filter((d) => d.unlock).length;
    expect(locked).toBeGreaterThanOrEqual(25);
    expect(locked).toBeLessThanOrEqual(40);
  });
});

describe('leaders & uniques', () => {
  const leaders = Object.values(LEADERS);
  it('has 50 nations; the original six plus every expansion Ark open at launch, locked ones have valid unlock rules', () => {
    expect(leaders.length).toBe(50);
    leaders.forEach((l, i) => {
      if (i < 6) expect(l.unlock, l.id).toBeUndefined();
      if (l.unlock) expect(UNLOCK_RULES.has(l.unlock.rule ?? ''), l.id).toBe(true);
    });
    expect(leaders.filter((l) => !l.unlock).length).toBe(44);
  });


  it('has distinct colors, 12+ unique city names, valid portrait, start doctrine and unique', () => {
    const colors = new Set(leaders.map((l) => l.colors.primary.toLowerCase()));
    expect(colors.size).toBe(leaders.length);
    for (const l of leaders) {
      expect(l.colors.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(l.colors.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(new Set(l.cityNames).size, l.id).toBeGreaterThanOrEqual(12);
      expect(MOTIFS).toContain(l.portrait.motif);
      expect(MOTIFS).toContain(l.portrait.crest);
      expect(badTokens(l.bonus), l.id).toEqual([]);
      const sd = DOCTRINES[l.startDoctrine ?? ''];
      expect(sd, l.id).toBeDefined();
      expect(sd.noShop).toBe(true);
      expect(Boolean(l.uniqueUnit) || Boolean(l.uniqueBuilding), l.id).toBe(true);
      if (l.uniqueUnit) {
        const u = UNIQUE_UNITS[l.uniqueUnit];
        expect(u?.uniqueTo).toBe(l.id);
        const base = UNITS[u.replaces ?? ''];
        expect(base, l.id).toBeDefined();
        expect(u.model).toBe(base.model);
        expect(u.class).toBe(base.class);
        expect(u.era).toBe(base.era);
        expect(u.tech).toBe(base.tech);
        expect(u.upgradesTo).toBe(base.upgradesTo);
        expect(UNITS[u.id]).toBe(u);
      }
      if (l.uniqueBuilding) {
        const b = UNIQUE_BUILDINGS[l.uniqueBuilding];
        expect(b?.uniqueTo).toBe(l.id);
        const base = BUILDINGS[b.replaces ?? ''];
        expect(base, l.id).toBeDefined();
        expect(b.model).toBe(base.model);
        expect(b.tech).toBe(base.tech);
        expect(BUILDINGS[b.id]).toBe(b);
      }
    }
    // every leader's start doctrine is unique to it
    expect(new Set(leaders.map((l) => l.startDoctrine)).size).toBe(leaders.length);
  });
});

describe('edicts, scrolls, crises, omens, reforms, ascension', () => {
  it('edicts: ~30, valid art/icons/tokens/unlocks', () => {
    const list = Object.values(EDICTS);
    expect(list.length).toBeGreaterThanOrEqual(26);
    for (const e of list) {
      expect(EDICTS[e.id]).toBe(e);
      expect(MOTIFS, e.id).toContain(e.art.motif);
      expect(ICONS.has(e.icon), `${e.id} icon ${e.icon}`).toBe(true);
      expect(badTokens(e.description), e.id).toEqual([]);
      if (e.unlock?.rule) expect(UNLOCK_RULES.has(e.unlock.rule), e.id).toBe(true);
    }
  });

  it('scrolls: one per pillar plus variants, all with a valid pillar', () => {
    const list = Object.values(SCROLLS);
    for (const p of PILLARS) expect(list.some((s) => s.pillar === p), p).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(PILLARS.length + 2);
    for (const s of list) {
      expect(PILLARS).toContain(s.pillar);
      expect(ICONS.has(s.icon), `${s.id} icon ${s.icon}`).toBe(true);
      expect(badTokens(s.description), s.id).toEqual([]);
    }
  });

  it('crises: 18+, at least 3 per era, valid fields', () => {
    const list = Object.values(CRISES);
    expect(list.length).toBeGreaterThanOrEqual(18);
    for (let era = 0; era <= 5; era++) expect(list.filter((c) => c.eras.includes(era)).length, `era ${era}`).toBeGreaterThanOrEqual(3);
    for (const c of list) {
      expect(MOTIFS, c.id).toContain(c.art.motif);
      expect(ICONS.has(c.icon), `${c.id} icon ${c.icon}`).toBe(true);
      expect(badTokens(c.description), c.id).toEqual([]);
      expect(c.reward).toBeGreaterThan(0);
      expect(c.targetMul ?? 1).toBeGreaterThan(0);
      expect(c.flavor.length).toBeGreaterThan(0);
    }
  });

  it('omens: 24+, goals positive, rewards valid', () => {
    const list = Object.values(OMENS);
    expect(list.length).toBeGreaterThanOrEqual(24);
    const { state } = fixture();
    for (const o of list) {
      const g = typeof o.goal === 'number' ? o.goal : o.goal(state);
      expect(g, o.id).toBeGreaterThan(0);
      expect(Number.isFinite(g)).toBe(true);
      expect(ICONS.has(o.icon), `${o.id} icon ${o.icon}`).toBe(true);
      expect(badTokens(o.description + o.rewardText), o.id).toEqual([]);
      if (o.reward.kind === 'doctrine') expect(['common', 'uncommon', 'rare', 'legendary']).toContain(o.reward.rarity);
    }
  });

  it('Mars Salvage, Crisis, and Directive behavior', () => {
    const { state } = fixture();
    const crisisCtx = makeCtx(state, HUMAN, { kind: 'crisis', id: 'steppe_horde', hooks: {}, counters: {} }, () => {});
    const feralsBefore = Object.values(state.units).filter((unit) => unit.owner === BARBARIAN).length;
    const spawnFerals = CRISES.steppe_horde.effects.onBegin;
    if (!spawnFerals) throw new Error('Feral Uprising has no start effect');
    spawnFerals(crisisCtx);
    expect(Object.values(state.units).filter((unit) => unit.owner === BARBARIAN).length).toBe(feralsBefore + 1);
    expect(Object.values(state.units).some((unit) => unit.owner === BARBARIAN && unit.type === 'warrior')).toBe(true);
    const stormsBefore = state.storms.length;
    const spawnStorms = CRISES.industrial_smog.effects.onBegin;
    if (!spawnStorms) throw new Error('Global Dust Storm has no start effect');
    spawnStorms(crisisCtx);
    expect(state.storms.length).toBe(stormsBefore + 3);
    const drop = OMENS.drop_two_colonies;
    expect(drop.progress({ type: 'podLanded', player: HUMAN, tile: 0 }, state, HUMAN)).toBe(1);
    expect(drop.progress({ type: 'cityFounded', cityId: 1, player: HUMAN, tile: 0 }, state, HUMAN)).toBe(0);
    expect(OMENS.weather_three_hits.progress({ type: 'stormDamage', tile: 0, amount: 5, player: HUMAN }, state, HUMAN)).toBe(1);
    expect(OMENS.weather_three_hits.progress({ type: 'stormDamage', tile: 0, amount: 5, player: HUMAN, killed: true }, state, HUMAN)).toBe(0);
    expect(OMENS.thaw_four_colonists.progress({ type: 'colonistsThawed', player: HUMAN, cityId: 1, pop: 2 }, state, HUMAN)).toBe(2);
    expect(OMENS.reroll_research_twice.progress({ type: 'researchOffered', player: HUMAN, techs: [], reroll: true }, state, HUMAN)).toBe(1);
    expect(OMENS.reroll_research_twice.progress({ type: 'researchOffered', player: HUMAN, techs: [] }, state, HUMAN)).toBe(0);
  });

  it('reforms: tier pairs with valid requirements', () => {
    const list = Object.values(REFORMS);
    expect(list.length).toBeGreaterThanOrEqual(10);
    for (const r of list) {
      expect(badTokens(r.description), r.id).toEqual([]);
      if (r.tier === 2) {
        expect(REFORMS[r.requires ?? '']?.tier, r.id).toBe(1);
      } else expect(r.requires).toBeUndefined();
    }
  });

  it('ascension: levels 1..8 in order', () => {
    expect(ASCENSIONS.map((a) => a.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const a of ASCENSIONS) expect(badTokens(a.description), a.name).toEqual([]);
  });
});

// ───────────────────────────── hook smoke tests on a real game ─────────────────────────────

function fixture(leaderId = Object.keys(LEADERS)[0]): { state: GameState; city: City; unit: Unit; enemy: Unit } {
  const { state } = createGame({ seed: 'ROGUE-SMOKE', leaderId, ascension: 8, mapSize: 'small', rivals: 3, tutorial: false, daily: false });
  const city = Object.values(state.cities).find((c) => c.owner === HUMAN && c.isCapital)!;
  city.pop = 12;
  city.buildings.push('shrine', 'monument', 'granary', 'market', 'harbor');
  const unit = Object.values(state.units).find((u) => u.owner === HUMAN && u.type === 'warrior')!;
  const enemy: Unit = { ...unit, id: 999_999, owner: BARBARIAN };
  state.run.phase = 'playing';
  state.run.chapter = 2;
  state.run.crisisActive = true;
  state.run.influence = 23;
  return { state, city, unit, enemy };
}

const zero = (): Yields => ({ food: 0, prod: 0, gold: 0, sci: 0, cul: 0 });

function chronicleCtx(state: GameState): ChronicleCtx & { r: number; s: number } {
  const c = {
    r: 100, s: 4,
    stats: { ...state.run.stats, kills: 3, techs: 2, culture: 50, gold: 80, popGrown: 3, citiesCaptured: 1, campsCleared: 1, wonders: 1, extra: {} },
    focus: 'arts' as const, era: 2, chapter: 2, cities: humanCities(state),
    renown() { return c.r; },
    splendor() { return c.s; },
    addRenown(n: number) { c.r += n; },
    addSplendor(n: number) { c.s += n; },
    mulSplendor(x: number) { c.s *= x; },
  };
  return c;
}

function sampleEvents(state: GameState, city: City, unit: Unit): SimEvent[] {
  const result = {
    era: 0, chapter: 2, target: 100, steps: [], renown: 100, splendor: 3, score: 300, passed: true, triumph: true, mandateLost: 0, influenceEarned: [],
  };
  return [
    { type: 'turnStart', turn: state.turn, player: HUMAN },
    { type: 'unitDied', unitId: 1, player: BARBARIAN, tile: unit.tile, unitType: 'warrior', killer: HUMAN },
    { type: 'unitDied', unitId: 2, player: 1, tile: unit.tile, unitType: 'warrior', killer: HUMAN },
    { type: 'combat', attacker: { player: HUMAN, unitId: unit.id, tile: unit.tile }, defender: { player: BARBARIAN, tile: unit.tile }, ranged: false, dmgToAttacker: 10, dmgToDefender: 100, attackerKilled: false, defenderKilled: true },
    { type: 'cityFounded', cityId: city.id, player: HUMAN, tile: city.tile },
    { type: 'cityGrew', cityId: city.id, player: HUMAN, pop: city.pop },
    { type: 'cityCaptured', cityId: city.id, from: 1, to: HUMAN, tile: city.tile },
    { type: 'buildingBuilt', cityId: city.id, player: HUMAN, building: 'monument' },
    { type: 'wonderBuilt', cityId: city.id, player: HUMAN, wonder: 'pyramids' },
    { type: 'improvementBuilt', tile: city.tile, player: HUMAN, improvement: 'farm' },
    { type: 'techResearched', player: HUMAN, tech: 'agriculture' },
    { type: 'goldChanged', player: HUMAN, delta: 50, reason: 'income' },
    { type: 'tilesRevealed', player: HUMAN, tiles: [0, 1, 2] },
    { type: 'naturalWonderFound', player: HUMAN, tile: 0, id: 'sky_arch' },
    { type: 'ruinExplored', player: HUMAN, tile: 0, reward: 'gold' },
    { type: 'campCleared', player: HUMAN, tile: 0, gold: 25 },
    { type: 'unitPromoted', unitId: unit.id, promotion: 'drill_1' },
    { type: 'warDeclared', by: 1, target: HUMAN },
    { type: 'peaceMade', a: HUMAN, b: 1 },
    { type: 'edictUsed', uid: 1, id: Object.keys(EDICTS)[0] ?? 'x' },
    { type: 'doctrineLost', uid: 424_242, id: 'riverfolk' },
    { type: 'omenCompleted', id: Object.keys(OMENS)[0] ?? 'x' },
    { type: 'chapterStarted', era: 0, chapter: 1, target: 450 },
    { type: 'eraStarted', era: 1 },
    { type: 'chronicle', result },
    { type: 'chronicle', result: { ...result, passed: false, triumph: false } },
  ];
}

function councilFixture(): CouncilState {
  return {
    items: [
      { kind: 'doctrine', id: 'riverfolk', edition: 'base', price: 4 },
      { kind: 'doctrine', id: 'ferrymen', edition: 'gilded', price: 6 },
      { kind: 'scroll', id: Object.keys(SCROLLS)[0] ?? 'x', price: 3 },
      { kind: 'pack', pack: 'doctrine', size: 'normal', price: 4 },
      { kind: 'pack', pack: 'archive', size: 'jumbo', price: 6 },
      { kind: 'reform', id: Object.keys(REFORMS)[0] ?? 'x', price: 10 },
    ],
    rerollCost: 2, rerolls: 0, pack: null,
  };
}

/** invoke every hook of `hooks` with plausible arguments; asserts outputs stay finite */
function exercise(state: GameState, city: City, unit: Unit, enemy: Unit, kind: ActiveEffect['kind'], id: string, hooks: EffectHooks, uid?: number, counters: Record<string, number> = {}): void {
  const events: SimEvent[] = [];
  const fx: ActiveEffect = { kind, id, uid, hooks, counters };
  const ctx = (): HookCtx => makeCtx(state, HUMAN, fx, (e) => events.push(e));
  const tiles = state.map.tiles.filter((t) => t.owner === HUMAN).slice(0, 12);
  for (const t of tiles) {
    const y = zero();
    hooks.tileYield?.(ctx(), { tile: t, city, yields: y });
    expect(findNonFinite(y), id).toEqual([]);
  }
  const cy = { city, yields: { food: 5, prod: 5, gold: 5, sci: 5, cul: 5 }, pct: zero() };
  hooks.cityYield?.(ctx(), cy);
  expect(findNonFinite(cy.yields), id).toEqual([]);
  for (const side of ['attack', 'defense'] as const) {
    for (const vsCity of [false, true]) {
      const a: CombatArgs = {
        side,
        attacker: side === 'attack' ? unit : enemy, attackerCity: null, attackerOwner: side === 'attack' ? HUMAN : BARBARIAN,
        defender: vsCity && side === 'defense' ? null : side === 'attack' ? enemy : unit,
        defenderCity: vsCity && side === 'defense' ? city : null, defenderOwner: side === 'attack' ? BARBARIAN : HUMAN,
        tile: state.map.tiles[unit.tile], fromTile: state.map.tiles[unit.tile], ranged: false, attackMods: [], defenseMods: [],
      };
      hooks.combat?.(ctx(), a);
      for (const m of [...a.attackMods, ...a.defenseMods]) expect(Number.isFinite(m.pct), id).toBe(true);
    }
  }
  const items: CostItem[] = [
    { kind: 'unit', id: 'settler' }, { kind: 'unit', id: 'warrior' }, { kind: 'building', id: 'monument' },
    { kind: 'wonder', id: 'pyramids' }, { kind: 'project', id: 'festival' }, { kind: 'improvement', id: 'farm' },
    { kind: 'tech', id: 'agriculture' }, { kind: 'upgrade', id: 'swordsman' },
  ];
  for (const item of items) for (const currency of ['prod', 'gold', 'sci', 'influence'] as const) {
    const a = { city, item, currency, cost: 100 };
    hooks.cost?.(ctx(), a);
    expect(Number.isFinite(a.cost) && a.cost >= 0, `${id} cost`).toBe(true);
  }
  const sc = { value: 5 };
  hooks.happiness?.(ctx(), sc);
  const mv = { unit, value: 2 };
  hooks.unitMoves?.(ctx(), mv);
  hooks.unitVision?.(ctx(), mv);
  hooks.unitHeal?.(ctx(), mv);
  const th = { city, value: 30 };
  hooks.growthThreshold?.(ctx(), th);
  hooks.borderThreshold?.(ctx(), th);
  expect(findNonFinite([sc, mv.value, th.value]), id).toEqual([]);
  hooks.canFoundCity?.(ctx(), { tile: state.map.tiles[city.tile], minDistance: 3, allowed: true });
  const lines = { lines: [] as { label: string; amount: number }[] };
  hooks.influenceIncome?.(ctx(), lines);
  for (const l of lines.lines) expect(Number.isInteger(l.amount), `${id} income`).toBe(true);
  for (const reroll of [false, true]) {
    const council = councilFixture();
    hooks.council?.(ctx(), { council, reroll });
    for (const it of council.items) if (it) expect(it.price >= 0 && Number.isFinite(it.price), `${id} price`).toBe(true);
    expect(council.rerollCost).toBeGreaterThanOrEqual(0);
  }
  const target = { value: 1000 };
  hooks.target?.(ctx(), target);
  expect(target.value, id).toBeGreaterThan(0);
  const c = chronicleCtx(state);
  hooks.chronicle?.(ctx(), c);
  expect(Number.isFinite(c.r) && Number.isFinite(c.s), `${id} chronicle`).toBe(true);
  expect(c.s, id).toBeGreaterThan(0);
  hooks.turnStart?.(ctx());
  hooks.onGain?.(ctx());
  hooks.onBegin?.(ctx());
  for (const ev of sampleEvents(state, city, unit)) hooks.onEvent?.(ctx(), ev);
  hooks.onEnd?.(ctx());
  hooks.onLose?.(ctx());
  expect(findNonFinite(counters), id).toEqual([]);
}

describe('hook smoke tests', () => {
  it('every doctrine hook runs on a real game state', () => {
    for (const d of Object.values(DOCTRINES)) {
      const { state, city, unit, enemy } = fixture();
      const ids = ['riverfolk', d.id, 'vanguard'];
      state.run.doctrines = ids.map((id, i): DoctrineInstance => ({ uid: 1000 + i, id, edition: i === 0 ? 'radiant' : 'base', counters: {}, disabled: false, sellValue: 2 }));
      const inst = state.run.doctrines[1];
      exercise(state, city, unit, enemy, 'doctrine', d.id, d.effects, inst.uid, inst.counters);
      expect(d.status?.(inst.counters, state) ?? '', d.id).not.toMatch(/NaN|undefined/);
    }
  });

  it('every leader, crisis, reform and ascension hook runs', () => {
    for (const l of Object.values(LEADERS)) {
      const f = fixture(l.id);
      exercise(f.state, f.city, f.unit, f.enemy, 'leader', l.id, l.effects);
    }
    for (const c of Object.values(CRISES)) {
      const f = fixture();
      f.state.run.crisis = c.id;
      f.state.run.doctrines = [{ uid: 7, id: 'riverfolk', edition: 'base', counters: {}, disabled: false, sellValue: 2 }];
      exercise(f.state, f.city, f.unit, f.enemy, 'crisis', c.id, c.effects);
    }
    for (const r of Object.values(REFORMS)) {
      const f = fixture();
      exercise(f.state, f.city, f.unit, f.enemy, 'reform', r.id, r.effects);
    }
    for (const a of ASCENSIONS) {
      const f = fixture();
      exercise(f.state, f.city, f.unit, f.enemy, 'ascension', String(a.level), a.effects);
    }
  });

  it('every edict validates targets and applies without throwing', () => {
    for (const e of Object.values(EDICTS)) {
      const { state, city, unit } = fixture();
      state.run.doctrines = [
        { uid: 1, id: 'riverfolk', edition: 'gilded', counters: {}, disabled: false, sellValue: 2 },
        { uid: 2, id: 'ferrymen', edition: 'base', counters: {}, disabled: false, sellValue: 2 },
      ];
      state.run.mandate = 1;
      const events: SimEvent[] = [];
      const ctx = makeCtx(state, HUMAN, { kind: 'edict', id: e.id, hooks: {}, counters: {} }, (ev) => events.push(ev));
      const targets = [
        {}, { cityId: city.id }, { tile: city.tile }, { unitId: unit.id },
        { tile: state.map.tiles.find((t) => t.owner !== HUMAN)!.idx }, { cityId: -5 }, { unitId: -5 }, { tile: -1 },
      ];
      let used = 0;
      for (const t of targets) {
        const err = e.canUse?.(ctx, t) ?? null;
        if (err !== null) { expect(typeof err).toBe('string'); continue; }
        if (used++ > 0) continue;
        e.use(ctx, t);
      }
      expect(findNonFinite(state.players[HUMAN]), e.id).toEqual([]);
      expect(findNonFinite(state.run), e.id).toEqual([]);
    }
  });

  it('omen progress functions return finite non-negative increments', () => {
    const { state, city, unit } = fixture();
    for (const o of Object.values(OMENS)) {
      for (const ev of sampleEvents(state, city, unit)) {
        const n = o.progress(ev, state, HUMAN);
        expect(Number.isFinite(n) && n >= 0, `${o.id} ${ev.type}`).toBe(true);
      }
    }
  });
});

describe('full pipeline', () => {
  it('a run with each leader and a rotating doctrine loadout stays finite', () => {
    const all = shop.map((d) => d.id);
    const leaders = Object.keys(LEADERS);
    leaders.forEach((leaderId, li) => {
      const { state } = createGame({ seed: `ROGUE-RUN-${li}`, leaderId, ascension: li % 9, mapSize: 'small', rivals: 3, tutorial: false, daily: false });
      const loadout = all.slice((li * 5) % all.length, (li * 5) % all.length + 5);
      state.run.doctrines.push(...loadout.map((id, i): DoctrineInstance => ({ uid: 50_000 + i, id, edition: 'base', counters: {}, disabled: false, sellValue: 2 })));
      const startTurn = state.turn;
      autoplay(state, 14);
      expect(state.turn, leaderId).toBeGreaterThan(startTurn + 10);
      expect(findNonFinite(state), leaderId).toEqual([]);
    });
  }, 120_000);
});
