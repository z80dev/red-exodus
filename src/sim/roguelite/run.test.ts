import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DoctrineDef } from '../defs';
import type { GameState, SimEvent } from '../types';
import { BUILDINGS, CRISES, DOCTRINES, EDICTS } from '../../content';
import { CHAPTER_LENGTHS, CRISIS_CHAPTER, handleRunAction, initRun, onTurnEnd, trackEvent } from './index';
import { councilBuyError, doctrinePrice } from './council';
import { changeMandate } from './run';
import { INTEREST_CAP, START_FOCUS } from './constants';
import { testState } from './testState';

vi.mock(import('../cities'), async (orig) => ({ ...(await orig()), refreshAllCities: () => {} }));
vi.mock(import('../economy'), async (orig) => ({
  ...(await orig()),
  addGold: (s: GameState, pid: number, d: number) => { s.players.find((p) => p.id === pid)!.gold += d; },
}));

const gained: string[] = [];
function doctrine(id: string, rarity: DoctrineDef['rarity'], extra: Partial<DoctrineDef> = {}): DoctrineDef {
  return {
    id, name: id, rarity, cost: 0, description: '', tags: [], icon: 'doctrine', art: { hue: 0, motif: 'sun' },
    effects: { onGain: () => { gained.push(id); } }, ...extra,
  };
}

beforeAll(() => {
  for (let i = 0; i < 6; i++) DOCTRINES[`__r_c${i}`] = doctrine(`__r_c${i}`, 'common');
  for (let i = 0; i < 3; i++) DOCTRINES[`__r_u${i}`] = doctrine(`__r_u${i}`, 'uncommon');
  DOCTRINES.__r_rare = doctrine('__r_rare', 'rare');
  DOCTRINES.__r_leg = doctrine('__r_leg', 'legendary');
  DOCTRINES.__r_locked = doctrine('__r_locked', 'common', { unlock: { text: 'locked', rule: 'win' } });
  for (const [i, era] of [0, 0, 0, 1, 1, 2, 3, 4, 5].entries()) {
    CRISES[`__r_crisis${i}`] = {
      id: `__r_crisis${i}`, name: `Crisis ${i}`, eras: [era], description: '', flavor: '', icon: 'crisis',
      art: { hue: 0, motif: 'skull' }, reward: 2,
      effects: { onBegin: (ctx) => { ctx.counters.begun = 1; }, onEnd: (ctx) => { ctx.counters.ended = 1; } },
    };
  }
  EDICTS.__r_edict = {
    id: '__r_edict', name: 'Test Edict', rarity: 'common', cost: 3, description: '', icon: 'edict', art: { hue: 0, motif: 'sun' },
    target: 'city', use: (ctx, t) => { ctx.state.cities[t.cityId!].pop += 3; },
  };
});

function fresh(seed = 'RUN'): { state: GameState; events: SimEvent[]; emit: (e: SimEvent) => void } {
  const state = testState(seed);
  const events: SimEvent[] = [];
  const emit = (e: SimEvent) => { events.push(e); trackEvent(state, e); };
  initRun(state, emit);
  return { state, events, emit };
}

function act(state: GameState, emit: (e: SimEvent) => void, action: Parameters<typeof handleRunAction>[1]) {
  const err = handleRunAction(state, action, emit);
  expect(err).toBeNull();
}

/** play out the current chapter with enough (or too little) culture */
function playChapter(state: GameState, emit: (e: SimEvent) => void, pass: boolean) {
  act(state, emit, { type: 'chooseChapterStart', focus: 'arts' });
  state.run.stats.culture = pass ? 1e7 : 0;
  state.cities[1].pop = pass ? 3 : 0;
  for (let t = 0; t < state.run.chapterLength; t++) onTurnEnd(state, emit);
  expect(state.run.phase).toBe('chronicle');
}

describe('run phases', () => {
  it('initRun sets defaults, rolls an era-0 crisis and opens the first chapter', () => {
    const { state, events } = fresh();
    const r = state.run;
    expect(r).toMatchObject({ phase: 'chapterStart', era: 0, chapter: 0, influence: 4, focus: START_FOCUS, doctrineSlots: 5, edictSlots: 2 });
    expect(r.focus).toBe('discovery');
    expect(r.mandate).toBe(r.maxMandate);
    expect(Object.values(r.pillarLevels).every((l) => l === 1)).toBe(true);
    expect(CRISES[r.crisis!].eras).toContain(0);
    expect(events).toContainEqual({ type: 'crisisRolled', era: 0, crisis: r.crisis });
  });

  it('runs a full era: chapters, crisis begin/end, councils, next era', () => {
    const { state, events, emit } = fresh();
    expect(state.run.phase).toBe('chapterStart');
    for (let ch = 0; ch < CHAPTER_LENGTHS.length; ch++) {
      expect(state.run.chapter).toBe(ch);
      expect(state.run.chapterLength).toBe(CHAPTER_LENGTHS[ch]);
      if (ch === CRISIS_CHAPTER) {
        act(state, emit, { type: 'chooseChapterStart', focus: 'arts' });
        expect(state.run.crisisActive).toBe(true);
        expect(events.some((e) => e.type === 'crisisBegan')).toBe(true);
        state.run.stats.culture = 1e7;
        for (let t = 0; t < CHAPTER_LENGTHS[CRISIS_CHAPTER] - 1; t++) onTurnEnd(state, emit);
        expect(state.run.phase).toBe('playing');
        onTurnEnd(state, emit);
        expect(state.run.crisisActive).toBe(false);
        expect(events.some((e) => e.type === 'crisisEnded')).toBe(true);
        expect(state.run.lastChronicle!.influenceEarned).toContainEqual({ label: `${CRISES[state.run.crisis!].name} survived`, amount: 2 });
      } else {
        playChapter(state, emit, true);
      }
      expect(state.run.lastChronicle!.passed).toBe(true);
      act(state, emit, { type: 'ackChronicle' });
      expect(state.run.phase).toBe('council');
      expect(state.run.stats.culture).toBe(0);
      act(state, emit, { type: 'leaveCouncil' });
    }
    expect(state.run).toMatchObject({ era: 1, chapter: 0, phase: 'chapterStart' });
    expect(state.run.mandate).toBe(state.run.maxMandate);
    expect(events).toContainEqual({ type: 'eraStarted', era: 1 });
    expect(CRISES[state.run.crisis!].eras).toContain(1);
    expect(state.run.history).toHaveLength(CHAPTER_LENGTHS.length);
  });

  it('failing costs mandate (2 in the crisis chapter), inflicts a dark age, and ends the run at 0', () => {
    const { state, events, emit } = fresh();
    playChapter(state, emit, false);
    expect(state.run.mandate).toBe(state.run.maxMandate - 1);
    expect(state.run.darkAge).toBe(true);
    expect(state.run.phase).toBe('chronicle'); // defeat is deferred to ack
    act(state, emit, { type: 'ackChronicle' });
    act(state, emit, { type: 'leaveCouncil' });
    playChapter(state, emit, true); // Crisis chapter of era 0
    expect(state.run.darkAge).toBe(false);
    act(state, emit, { type: 'ackChronicle' });
    act(state, emit, { type: 'leaveCouncil' });
    playChapter(state, emit, true); // Dawn of era 1
    act(state, emit, { type: 'ackChronicle' });
    act(state, emit, { type: 'leaveCouncil' });
    expect(state.run.chapter).toBe(CRISIS_CHAPTER);
    state.run.mandate = 2; // start the Crisis with prior damage to exercise depletion at the Chronicle.
    playChapter(state, emit, false);
    expect(state.run.lastChronicle!.mandateLost).toBe(2);
    expect(state.run.mandate).toBe(0);
    expect(state.gameOver).toBe(false);
    act(state, emit, { type: 'ackChronicle' });
    expect(state.run.phase).toBe('defeat');
    expect(state.gameOver).toBe(true);
    expect(events.some((e) => e.type === 'runLost')).toBe(true);
    expect(handleRunAction(state, { type: 'leaveCouncil' }, emit)).not.toBeNull();
  });

  it('mandate hitting 0 during play is an immediate defeat', () => {
    const { state, emit } = fresh();
    act(state, emit, { type: 'chooseChapterStart', focus: 'glory' });
    changeMandate(state, -state.run.mandate, 'Capital razed', emit);
    expect(state.run).toMatchObject({ phase: 'defeat', defeatReason: 'Capital razed' });
  });

  it('victory after the era 6 Crisis chapter, then endless continues', () => {
    const { state, events, emit } = fresh();
    state.run.era = 5;
    state.run.chapter = CRISIS_CHAPTER;
    state.run.phase = 'chapterStart';
    state.run.chapterLength = CHAPTER_LENGTHS[CRISIS_CHAPTER];
    playChapter(state, emit, true);
    act(state, emit, { type: 'ackChronicle' });
    expect(state.run.phase).toBe('victory');
    expect(state.gameOver).toBe(false);
    expect(events).toContainEqual({ type: 'runWon' });
    act(state, emit, { type: 'continueEndless' });
    expect(state.run.phase).toBe('council');
    act(state, emit, { type: 'leaveCouncil' });
    expect(state.run).toMatchObject({ era: 6, chapter: 0, phase: 'chapterStart' });
    expect(state.run.crisis).not.toBeNull();
  });

  it('ends a failed final Chronicle instead of entering an unwinnable endless era', () => {
    const { state, events, emit } = fresh();
    state.run.era = 5;
    state.run.chapter = CRISIS_CHAPTER;
    state.run.phase = 'chapterStart';
    state.run.chapterLength = 5;
    playChapter(state, emit, false);
    expect(state.run.mandate).toBeGreaterThan(0);
    act(state, emit, { type: 'ackChronicle' });
    expect(state.run.phase).toBe('defeat');
    expect(state.run.defeatReason).toBeTruthy();
    expect(state.gameOver).toBe(true);
    expect(events).toContainEqual({ type: 'runLost', reason: state.run.defeatReason! });
  });

  it('rejects run actions out of phase', () => {
    const { state, emit } = fresh();
    expect(handleRunAction(state, { type: 'ackChronicle' }, emit)).not.toBeNull();
    expect(handleRunAction(state, { type: 'leaveCouncil' }, emit)).not.toBeNull();
    expect(handleRunAction(state, { type: 'chooseChapterStart', focus: 'nope' as never }, emit)).not.toBeNull();
    act(state, emit, { type: 'chooseChapterStart', focus: 'arts' });
    expect(handleRunAction(state, { type: 'chooseChapterStart', focus: 'arts' }, emit)).not.toBeNull();
  });

  it('passing a chapter levels the focus pillar; failing leaves levels unchanged', () => {
    const { state, events, emit } = fresh('LEVEL');
    const before = state.run.pillarLevels.arts;
    playChapter(state, emit, true);
    const up = state.run.lastChronicle!.focusLevelUp;
    expect(up).toEqual({ pillar: 'arts', level: before + 1 });
    expect(state.run.pillarLevels.arts).toBe(before + 1);
    expect(events).toContainEqual({ type: 'pillarLevelUp', pillar: 'arts', level: before + 1 });
    act(state, emit, { type: 'ackChronicle' });
    act(state, emit, { type: 'leaveCouncil' });

    const levels = { ...state.run.pillarLevels };
    const count = events.filter((e) => e.type === 'pillarLevelUp').length;
    playChapter(state, emit, false);
    expect(state.run.lastChronicle!.focusLevelUp).toBeNull();
    expect(state.run.pillarLevels).toEqual(levels);
    expect(events.filter((e) => e.type === 'pillarLevelUp')).toHaveLength(count);
  });
});

describe('stats', () => {
  it('tallies human events into chapter stats and run totals', () => {
    const { state, emit } = fresh();
    emit({ type: 'unitDied', unitId: 1, player: 99, tile: 0, unitType: 'warrior', killer: 0 });
    emit({ type: 'unitDied', unitId: 2, player: 1, tile: 0, unitType: 'warrior', killer: 0 });
    emit({ type: 'unitDied', unitId: 3, player: 0, tile: 0, unitType: 'warrior', killer: 1 });
    emit({ type: 'tilesRevealed', player: 0, tiles: [1, 2, 3] });
    emit({ type: 'tilesRevealed', player: 1, tiles: [1, 2, 3] });
    emit({ type: 'buildingBuilt', cityId: 1, player: 0, building: 'palace' });
    emit({ type: 'buildingBuilt', cityId: 1, player: 0, building: 'granary' });
    emit({ type: 'cityGrew', cityId: 1, player: 0, pop: 4 });
    expect(state.run.stats).toMatchObject({ kills: 2, unitsLost: 1, tilesExplored: 3, buildings: 1, popGrown: 1 });
    expect(state.run.stats.extra.barbarianKills).toBe(1);
    expect(state.run.totals.kills).toBe(2);
  });
});

describe('council', () => {
  function toCouncil(seed: string) {
    const f = fresh(seed);
    playChapter(f.state, f.emit, true);
    act(f.state, f.emit, { type: 'ackChronicle' });
    return f;
  }

  it('is deterministic for a seed', () => {
    const a = toCouncil('SEED-A').state.run.council;
    const b = toCouncil('SEED-A').state.run.council;
    expect(a).toEqual(b);
    expect(a!.items.slice(0, 5).every((i) => i != null)).toBe(true);
  });

  it('prices, exclusions, layout', () => {
    for (let s = 0; s < 25; s++) {
      const { state } = toCouncil(`P${s}`);
      state.config.locked = ['__r_locked'];
      const items = state.run.council!.items;
      expect(items[0]!.kind).toBe('doctrine');
      expect(items[1]!.kind).toBe('doctrine');
      expect(items[2] === null || items[2].kind === 'edict').toBe(true);
      expect(items[3]!.kind).toBe('pack');
      expect(items[4]!.kind).toBe('pack');
      for (const it of items) {
        if (it?.kind !== 'doctrine') continue;
        const def = DOCTRINES[it.id];
        expect(def.noShop).toBeFalsy();
        expect(def.rarity).not.toBe('legendary');
        expect(it.price).toBe(doctrinePrice(def.rarity, it.edition));
      }
      if (items[0]?.kind === 'doctrine' && items[1]?.kind === 'doctrine') expect(items[0].id).not.toBe(items[1].id);
    }
    expect(doctrinePrice('common', 'base')).toBe(4);
    expect(doctrinePrice('rare', 'gilded')).toBe(10);
    expect(doctrinePrice('legendary', 'prismatic')).toBe(17);
  });

  it('excludes profile-locked and owned doctrines', () => {
    const { state, emit } = fresh('LOCK');
    state.config.locked = ['__r_locked'];
    state.run.doctrines = [{ uid: 900, id: '__r_c0', edition: 'base', counters: {}, disabled: false, sellValue: 2 }];
    for (let i = 0; i < 40; i++) {
      state.run.phase = 'chronicle';
      state.run.lastChronicle = { era: 0, chapter: 0, target: 1, steps: [], renown: 0, splendor: 0, score: 1, passed: true, triumph: false, mandateLost: 0, influenceEarned: [], focusLevelUp: null };
      act(state, emit, { type: 'ackChronicle' });
      for (const it of state.run.council!.items) {
        if (it?.kind === 'doctrine') expect(['__r_locked', '__r_c0']).not.toContain(it.id);
      }
    }
  });

  it('buy, reroll cost growth, sell, slots, packs', () => {
    const { state, emit } = toCouncil('BUY');
    const c = state.run.council!;
    state.run.influence = 100;
    c.items[0] = { kind: 'doctrine', id: '__r_u1', edition: 'gilded', price: doctrinePrice('uncommon', 'gilded') };
    const doc = c.items[0];
    act(state, emit, { type: 'councilBuy', slot: 0 });
    expect(state.run.influence).toBe(100 - doc.price);
    expect(state.run.doctrines.at(-1)!.sellValue).toBe(Math.max(1, Math.floor(doc.price / 2)));
    expect(gained).toContain(state.run.doctrines.at(-1)!.id);
    expect(councilBuyError(state, 0)).toBe('Sold out');

    act(state, emit, { type: 'councilReroll' });
    expect(state.run.influence).toBe(100 - doc.price - 2);
    expect(c.rerollCost).toBe(3);
    act(state, emit, { type: 'councilReroll' });
    expect(c.rerollCost).toBe(4);
    expect(c.items[0]).not.toBeNull();

    // sell returns sellValue
    const inst = state.run.doctrines.at(-1)!;
    const before = state.run.influence;
    act(state, emit, { type: 'sellDoctrine', uid: inst.uid });
    expect(state.run.influence).toBe(before + inst.sellValue);

    // full slots block non-ethereal doctrines
    state.run.doctrineSlots = 0;
    c.items[1] = { kind: 'doctrine', id: '__r_c5', edition: 'base', price: 4 };
    expect(councilBuyError(state, 1)).toMatch(/Slots are full/);
    c.items[1] = { kind: 'doctrine', id: '__r_c5', edition: 'ethereal', price: 9 };
    expect(councilBuyError(state, 1)).toBeNull();
    state.run.doctrineSlots = 5;

    // packs
    c.items[3] = { kind: 'pack', pack: 'doctrine', size: 'jumbo', price: 6 };
    act(state, emit, { type: 'councilBuy', slot: 3 });
    expect(c.pack!.options.length).toBeGreaterThan(0);
    expect(c.pack!.options.every((o) => o.kind === 'doctrine' && o.price === 0)).toBe(true);
    expect(handleRunAction(state, { type: 'leaveCouncil' }, emit)).toMatch(/Open the Pack/);
    const n = state.run.doctrines.length;
    act(state, emit, { type: 'packPick', index: 0 });
    expect(state.run.doctrines.length).toBe(n + 1);
    expect(c.pack).toBeNull();

    c.items[4] = { kind: 'pack', pack: 'edict', size: 'normal', price: 4 };
    act(state, emit, { type: 'councilBuy', slot: 4 });
    expect(c.pack!.options.every((o) => o.kind === 'edict' && o.price === 0)).toBe(true);
    const edicts = state.run.edicts.length;
    act(state, emit, { type: 'packPick', index: 0 });
    expect(state.run.edicts.length).toBe(edicts + 1);

    // reorder
    const uids = state.run.doctrines.map((d) => d.uid);
    act(state, emit, { type: 'moveDoctrine', uid: uids[0], toIndex: 99 });
    expect(state.run.doctrines.map((d) => d.uid)).toEqual([...uids.slice(1), uids[0]]);
  });

  it('selling a disabled doctrine still runs onLose; buildings pay influence each chapter', () => {
    const { state, emit } = toCouncil('LOSE');
    const lost: string[] = [];
    DOCTRINES.__r_lose = doctrine('__r_lose', 'common', { effects: { onLose: (ctx) => { lost.push(`${ctx.uid}:${ctx.counters.n}`); } } });
    state.run.doctrines.push({ uid: 555, id: '__r_lose', edition: 'base', counters: { n: 7 }, disabled: true, sellValue: 2 });
    act(state, emit, { type: 'sellDoctrine', uid: 555 });
    expect(lost).toEqual(['555:7']);

    BUILDINGS.__r_bank = { ...(Object.values(BUILDINGS)[0] ?? {}), id: '__r_bank', name: 'Test Bank', influence: 2 } as (typeof BUILDINGS)[string];
    state.cities[1].buildings.push('__r_bank', '__r_bank');
    act(state, emit, { type: 'leaveCouncil' });
    playChapter(state, emit, true);
    expect(state.run.lastChronicle!.influenceEarned).toContainEqual({ label: 'Test Bank ×2', amount: 4 });
  });

  it('council hooks can lock rerolls; noSell Crew stay; sellValue and interestCap hooks apply', () => {
    const { state, emit } = toCouncil('RULES');
    const c = state.run.council!;
    state.run.influence = 40;
    c.rerollLocked = true;
    expect(handleRunAction(state, { type: 'councilReroll' }, emit)).toMatch(/cannot reroll/);
    c.rerollLocked = false;
    act(state, emit, { type: 'councilReroll' });

    DOCTRINES.__r_stuck = doctrine('__r_stuck', 'common', { noSell: true });
    state.run.doctrines.push({ uid: 556, id: '__r_stuck', edition: 'base', counters: {}, disabled: false, sellValue: 2 });
    expect(handleRunAction(state, { type: 'sellDoctrine', uid: 556 }, emit)).toBe('You cannot sell this Crew member');
    expect(state.run.doctrines.some((d) => d.uid === 556)).toBe(true);

    DOCTRINES.__r_refund = doctrine('__r_refund', 'common', {
      effects: { sellValue: (_ctx, a) => { a.value = a.price; }, interestCap: (_ctx, a) => { a.value *= 2; } },
    });
    state.run.doctrines.push({ uid: 557, id: '__r_refund', edition: 'base', counters: {}, disabled: false, sellValue: 0 });
    c.items[0] = { kind: 'doctrine', id: '__r_u2', edition: 'base', price: 6 };
    act(state, emit, { type: 'councilBuy', slot: 0 });
    expect(state.run.doctrines.at(-1)!.sellValue).toBe(6);

    act(state, emit, { type: 'leaveCouncil' });
    state.run.influence = 100;
    playChapter(state, emit, true);
    expect(state.run.lastChronicle!.influenceEarned).toContainEqual({ label: 'Savings bonus', amount: INTEREST_CAP * 2 });
  });

  it('edicts: target validation, use in play only', () => {
    const { state, events, emit } = toCouncil('EDICT');
    state.run.edicts = [{ uid: 777, id: '__r_edict' }];
    expect(handleRunAction(state, { type: 'useEdict', uid: 777, cityId: 1 }, emit)).toMatch(/during a turn/);
    act(state, emit, { type: 'leaveCouncil' });
    act(state, emit, { type: 'chooseChapterStart', focus: 'arts' });
    expect(handleRunAction(state, { type: 'useEdict', uid: 777 }, emit)).toMatch(/colony/);
    const pop = state.cities[1].pop;
    act(state, emit, { type: 'useEdict', uid: 777, cityId: 1 });
    expect(state.cities[1].pop).toBe(pop + 3);
    expect(state.run.edicts).toHaveLength(0);
    expect(events).toContainEqual({ type: 'edictUsed', uid: 777, id: '__r_edict' });
  });
});
