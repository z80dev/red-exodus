import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DoctrineDef } from '../defs';
import type { GameState, SimEvent } from '../types';
import { BUILDINGS, CRISES, DOCTRINES, EDICTS, OMENS, REFORMS, SCROLLS } from '../../content';
import { handleRunAction, initRun, onTurnEnd, trackEvent } from './index';
import { councilBuyError, doctrinePrice } from './council';
import { changeMandate } from './run';
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
  for (let i = 0; i < 4; i++) {
    OMENS[`__r_omen${i}`] = {
      id: `__r_omen${i}`, name: `Omen ${i}`, description: '', icon: 'omen', eras: [0], goal: 2,
      progress: (ev, _s, pid) => (ev.type === 'cityFounded' && ev.player === pid ? 1 : 0),
      reward: { kind: 'influence', amount: 5 }, rewardText: '+5 influence',
    };
  }
  EDICTS.__r_edict = {
    id: '__r_edict', name: 'Test Edict', rarity: 'common', cost: 3, description: '', icon: 'edict', art: { hue: 0, motif: 'sun' },
    target: 'city', use: (ctx, t) => { ctx.state.cities[t.cityId!].pop += 3; },
  };
  SCROLLS.__r_scroll = { id: '__r_scroll', name: 'Test Scroll', pillar: 'glory', cost: 3, description: '', icon: 'scroll' };
  REFORMS.__r_reform = {
    id: '__r_reform', name: 'Test Reform', description: '', cost: 10, tier: 1, icon: 'reform',
    effects: { onGain: (ctx) => { ctx.state.run.doctrineSlots++; } },
  };
});

function fresh(seed = 'RUN'): { state: GameState; events: SimEvent[]; emit: (e: SimEvent) => void } {
  const state = testState(seed);
  const events: SimEvent[] = [];
  const emit = (e: SimEvent) => { events.push(e); trackEvent(state, e, emit); };
  initRun(state, emit);
  return { state, events, emit };
}

function act(state: GameState, emit: (e: SimEvent) => void, action: Parameters<typeof handleRunAction>[1]) {
  const err = handleRunAction(state, action, emit);
  expect(err).toBeNull();
}

/** play out the current chapter with enough (or too little) culture */
function playChapter(state: GameState, emit: (e: SimEvent) => void, pass: boolean) {
  act(state, emit, { type: 'chooseChapterStart', focus: 'arts', omen: null });
  state.run.stats.culture = pass ? 1e7 : 0;
  state.cities[1].pop = pass ? 3 : 0;
  for (let t = 0; t < state.run.chapterLength; t++) onTurnEnd(state, emit);
  expect(state.run.phase).toBe('chronicle');
}

describe('run phases', () => {
  it('initRun sets defaults and reveals an era-0 crisis', () => {
    const { state, events } = fresh();
    const r = state.run;
    expect(r).toMatchObject({ phase: 'crisisReveal', era: 0, chapter: 0, mandate: 3, influence: 4, focus: 'prosperity', doctrineSlots: 5, edictSlots: 2 });
    expect(Object.values(r.pillarLevels).every((l) => l === 1)).toBe(true);
    expect(CRISES[r.crisis!].eras).toContain(0);
    expect(events).toContainEqual({ type: 'crisisRevealed', era: 0, crisis: r.crisis });
  });

  it('runs a full era: chapters, crisis begin/end, councils, next era', () => {
    const { state, events, emit } = fresh();
    act(state, emit, { type: 'ackCrisis' });
    expect(state.run.phase).toBe('chapterStart');
    expect(state.run.omenOffer).toHaveLength(2);
    for (let ch = 0; ch < 3; ch++) {
      expect(state.run.chapter).toBe(ch);
      expect(state.run.chapterLength).toBe([6, 6, 8][ch]);
      if (ch === 2) {
        act(state, emit, { type: 'chooseChapterStart', focus: 'arts', omen: null });
        expect(state.run.crisisActive).toBe(true);
        expect(events.some((e) => e.type === 'crisisBegan')).toBe(true);
        state.run.stats.culture = 1e7;
        for (let t = 0; t < 7; t++) onTurnEnd(state, emit);
        expect(state.run.phase).toBe('playing');
        onTurnEnd(state, emit);
        expect(state.run.crisisActive).toBe(false);
        expect(events.some((e) => e.type === 'crisisEnded')).toBe(true);
        expect(state.run.lastChronicle!.influenceEarned).toContainEqual({ label: `${CRISES[state.run.crisis!].name} overcome`, amount: 2 });
      } else {
        playChapter(state, emit, true);
      }
      expect(state.run.lastChronicle!.passed).toBe(true);
      act(state, emit, { type: 'ackChronicle' });
      expect(state.run.phase).toBe('council');
      expect(state.run.stats.culture).toBe(0);
      const hasReform = state.run.council!.items.some((i) => i?.kind === 'reform');
      expect(hasReform).toBe(ch === 0);
      act(state, emit, { type: 'leaveCouncil' });
    }
    expect(state.run).toMatchObject({ era: 1, chapter: 0, phase: 'crisisReveal', mandate: 3 });
    expect(events).toContainEqual({ type: 'eraStarted', era: 1 });
    expect(CRISES[state.run.crisis!].eras).toContain(1);
    expect(state.run.history).toHaveLength(3);
  });

  it('failing costs mandate (2 in the crisis chapter), inflicts a dark age, and ends the run at 0', () => {
    const { state, events, emit } = fresh();
    act(state, emit, { type: 'ackCrisis' });
    playChapter(state, emit, false);
    expect(state.run.mandate).toBe(2);
    expect(state.run.darkAge).toBe(true);
    expect(state.run.phase).toBe('chronicle'); // defeat is deferred to ack
    act(state, emit, { type: 'ackChronicle' });
    act(state, emit, { type: 'leaveCouncil' });
    playChapter(state, emit, true);
    expect(state.run.darkAge).toBe(false);
    act(state, emit, { type: 'ackChronicle' });
    act(state, emit, { type: 'leaveCouncil' });
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
    act(state, emit, { type: 'ackCrisis' });
    act(state, emit, { type: 'chooseChapterStart', focus: 'glory', omen: null });
    changeMandate(state, -3, 'Capital razed', emit);
    expect(state.run).toMatchObject({ phase: 'defeat', defeatReason: 'Capital razed' });
  });

  it('victory after era 6 chapter III, then endless continues', () => {
    const { state, events, emit } = fresh();
    state.run.era = 5;
    state.run.chapter = 2;
    state.run.phase = 'chapterStart';
    state.run.chapterLength = 8;
    playChapter(state, emit, true);
    act(state, emit, { type: 'ackChronicle' });
    expect(state.run.phase).toBe('victory');
    expect(state.gameOver).toBe(false);
    expect(events).toContainEqual({ type: 'runWon' });
    act(state, emit, { type: 'continueEndless' });
    expect(state.run.phase).toBe('council');
    act(state, emit, { type: 'leaveCouncil' });
    expect(state.run).toMatchObject({ era: 6, chapter: 0, phase: 'crisisReveal' });
    expect(state.run.crisis).not.toBeNull();
  });

  it('rejects map-phase run actions out of phase', () => {
    const { state, emit } = fresh();
    expect(handleRunAction(state, { type: 'chooseChapterStart', focus: 'arts', omen: null }, emit)).not.toBeNull();
    expect(handleRunAction(state, { type: 'ackChronicle' }, emit)).not.toBeNull();
    act(state, emit, { type: 'ackCrisis' });
    expect(handleRunAction(state, { type: 'chooseChapterStart', focus: 'arts', omen: 'nope' }, emit)).not.toBeNull();
  });
});

describe('omens', () => {
  it('progress via trackEvent, complete, and reward immediately', () => {
    const { state, events, emit } = fresh();
    act(state, emit, { type: 'ackCrisis' });
    const omen = '__r_omen0';
    state.run.omenOffer = [omen, state.run.omenOffer[0]];
    act(state, emit, { type: 'chooseChapterStart', focus: 'prosperity', omen });
    expect(state.run.omen).toMatchObject({ id: omen, progress: 0, done: false, goal: 2 });
    emit({ type: 'cityFounded', cityId: 5, player: 0, tile: 1 });
    expect(events).toContainEqual({ type: 'omenProgress', id: omen, progress: 1, goal: 2 });
    expect(state.run.stats.citiesFounded).toBe(1);
    emit({ type: 'cityFounded', cityId: 6, player: 0, tile: 2 });
    expect(state.run.omen!.done).toBe(true);
    expect(events).toContainEqual({ type: 'omenCompleted', id: omen });
    expect(state.run.influence).toBe(4 + 5);
    emit({ type: 'cityFounded', cityId: 7, player: 0, tile: 3 });
    expect(events.filter((e) => e.type === 'omenCompleted')).toHaveLength(1);
  });

  it('avoids recently offered omens when possible', () => {
    const { state, emit } = fresh();
    act(state, emit, { type: 'ackCrisis' });
    const first = [...state.run.omenOffer];
    playChapter(state, emit, true);
    act(state, emit, { type: 'ackChronicle' });
    act(state, emit, { type: 'leaveCouncil' });
    const eraOmens = Object.values(OMENS).filter((o) => !o.eras || o.eras.includes(0)).length;
    if (eraOmens >= 4) expect(state.run.omenOffer.some((id) => first.includes(id))).toBe(false);
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
    act(f.state, f.emit, { type: 'ackCrisis' });
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
      expect(['edict', 'scroll']).toContain(items[2]!.kind);
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
    act(state, emit, { type: 'ackCrisis' });
    for (let i = 0; i < 40; i++) {
      state.run.phase = 'chronicle';
      state.run.lastChronicle = { era: 0, chapter: 0, target: 1, steps: [], renown: 0, splendor: 0, score: 1, passed: true, triumph: false, mandateLost: 0, influenceEarned: [] };
      act(state, emit, { type: 'ackChronicle' });
      for (const it of state.run.council!.items) {
        if (it?.kind === 'doctrine') expect(['__r_locked', '__r_c0']).not.toContain(it.id);
      }
    }
  });

  it('buy, reroll cost growth, sell, slots, packs, reform', () => {
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
    expect(councilBuyError(state, 1)).toMatch(/slots full/);
    c.items[1] = { kind: 'doctrine', id: '__r_c5', edition: 'ethereal', price: 9 };
    expect(councilBuyError(state, 1)).toBeNull();
    state.run.doctrineSlots = 5;

    // packs
    c.items[3] = { kind: 'pack', pack: 'doctrine', size: 'jumbo', price: 6 };
    act(state, emit, { type: 'councilBuy', slot: 3 });
    expect(c.pack!.options.length).toBeGreaterThan(0);
    expect(c.pack!.options.every((o) => o.kind === 'doctrine' && o.price === 0)).toBe(true);
    expect(handleRunAction(state, { type: 'leaveCouncil' }, emit)).toMatch(/pack/);
    const n = state.run.doctrines.length;
    act(state, emit, { type: 'packPick', index: 0 });
    expect(state.run.doctrines.length).toBe(n + 1);
    expect(c.pack).toBeNull();

    c.items[4] = { kind: 'pack', pack: 'archive', size: 'normal', price: 4 };
    act(state, emit, { type: 'councilBuy', slot: 4 });
    const scroll = c.pack!.options[0];
    expect(scroll.kind).toBe('scroll');
    const pillar = SCROLLS[(scroll as { id: string }).id].pillar;
    const lvl = state.run.pillarLevels[pillar];
    act(state, emit, { type: 'packPick', index: 0 });
    expect(state.run.pillarLevels[pillar]).toBe(lvl + 1);

    // reform
    c.items[5] = { kind: 'reform', id: '__r_reform', price: 10 };
    act(state, emit, { type: 'councilBuy', slot: 5 });
    expect(state.run.reforms).toContain('__r_reform');
    expect(state.run.doctrineSlots).toBe(6);

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

  it('edicts: target validation, use in play only', () => {
    const { state, events, emit } = toCouncil('EDICT');
    state.run.edicts = [{ uid: 777, id: '__r_edict' }];
    expect(handleRunAction(state, { type: 'useEdict', uid: 777, cityId: 1 }, emit)).toMatch(/during play/);
    act(state, emit, { type: 'leaveCouncil' });
    act(state, emit, { type: 'chooseChapterStart', focus: 'arts', omen: null });
    expect(handleRunAction(state, { type: 'useEdict', uid: 777 }, emit)).toMatch(/city/);
    const pop = state.cities[1].pop;
    act(state, emit, { type: 'useEdict', uid: 777, cityId: 1 });
    expect(state.cities[1].pop).toBe(pop + 3);
    expect(state.run.edicts).toHaveLength(0);
    expect(events).toContainEqual({ type: 'edictUsed', uid: 777, id: '__r_edict' });
  });
});
