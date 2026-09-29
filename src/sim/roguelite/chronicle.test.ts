import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoctrineDef, EffectHooks } from '../defs';
import type { GameState } from '../types';
import { CRISES, DOCTRINES } from '../../content';
import { chronicleTarget, computeChronicle, previewChronicle } from './chronicle';
import { initRun } from './run';
import { testCity, testState } from './testState';

vi.mock(import('../cities'), async (orig) => ({ ...(await orig()), refreshAllCities: () => {} }));

function doctrine(id: string, effects: EffectHooks, extra: Partial<DoctrineDef> = {}): DoctrineDef {
  return {
    id, name: id, rarity: 'common', cost: 4, description: '', tags: [], icon: 'doctrine', art: { hue: 0, motif: 'sun' },
    noShop: true, effects, ...extra,
  };
}

beforeAll(() => {
  DOCTRINES.__t_mul2 = doctrine('__t_mul2', { chronicle: (_c, c) => c.mulSplendor(2) });
  DOCTRINES.__t_add5 = doctrine('__t_add5', { chronicle: (_c, c) => c.addSplendor(5) });
  DOCTRINES.__t_counter = doctrine('__t_counter', {
    chronicle(ctx, c) {
      ctx.counters.fired = (ctx.counters.fired ?? 0) + 1;
      ctx.state.run.stats.extra.touched = 1;
      c.addRenown(10 * ctx.counters.fired);
      ctx.flash('grow');
    },
  });
  CRISES.__t_crisis = {
    id: '__t_crisis', name: 'Test Crisis', eras: [99], description: '', flavor: '', icon: 'crisis', art: { hue: 0, motif: 'skull' },
    targetMul: 1.5, reward: 4, effects: { chronicle: (_c, c) => c.mulSplendor(0.5, 'Test Crisis') },
  };
});

let state: GameState;
beforeEach(() => {
  state = testState();
  initRun(state, () => {});
  state.run.doctrines = [];
  state.run.crisis = null;
  state.run.focus = 'arts';
  state.run.stats.culture = 100;
  state.cities[1].wonders = ['__w'];
});

function own(ids: string[], edition: 'base' | 'gilded' | 'radiant' | 'prismatic' = 'base') {
  state.run.doctrines = ids.map((id, i) => ({ uid: 1000 + i, id, edition, counters: {}, disabled: false, sellValue: 2 }));
}

describe('computeChronicle', () => {
  it('scores pillars, focus ×2, base splendor and cities with running totals', () => {
    const r = computeChronicle(state, () => {});
    // arts culture 100 → +100, focus ×2 → +100, capital 3 pop ×4 + 1 wonder ×10 = 22 → 222 renown; splendor 2
    expect(r.renown).toBe(222);
    expect(r.splendor).toBe(2);
    expect(r.score).toBe(444);
    expect(r.steps.map((s) => s.source)).toEqual(['pillar', 'focus', 'focus', 'city', 'final']);
    expect(r.steps[1]).toMatchObject({ source: 'focus', renownAdd: 100, renown: 200, splendor: 0 });
    expect(r.steps[3]).toMatchObject({ source: 'city', ref: '1', renownAdd: 22, renown: 222, splendor: 2 });
    expect(r.steps.at(-1)).toMatchObject({ source: 'final', renown: 222, splendor: 2 });
  });

  it('pillar levels scale renown and splendor', () => {
    state.run.pillarLevels.arts = 3;
    const r = computeChronicle(state, () => {});
    // factor ×2: 200, focus +200, city 22 → 422; splendor 1 + 3 = 4
    expect(r.renown).toBe(422);
    expect(r.splendor).toBe(4);
  });

  it('doctrine order matters: ×Splendor before +Splendor scores lower than after', () => {
    own(['__t_mul2', '__t_add5']);
    const mulFirst = computeChronicle(structuredClone(state), () => {});
    own(['__t_add5', '__t_mul2']);
    const addFirst = computeChronicle(structuredClone(state), () => {});
    expect(mulFirst.splendor).toBe(2 * 2 + 5);
    expect(addFirst.splendor).toBe((2 + 5) * 2);
    expect(addFirst.score).toBeGreaterThan(mulFirst.score);
    expect(mulFirst.steps.filter((s) => s.source === 'doctrine').map((s) => s.ref)).toEqual(['1000', '1001']);
  });

  it('editions fire right after their doctrine; disabled doctrines are skipped', () => {
    own(['__t_add5'], 'prismatic');
    const r = computeChronicle(state, () => {});
    const srcs = r.steps.map((s) => s.source);
    expect(srcs.indexOf('edition')).toBe(srcs.indexOf('doctrine') + 1);
    expect(r.splendor).toBeCloseTo((2 + 5) * 1.5);
    state.run.doctrines[0].disabled = true;
    expect(computeChronicle(state, () => {}).splendor).toBe(2);
  });

  it('crisis hooks run after doctrines; crisis targetMul and failure costs 2 mandate in chapter III', () => {
    own(['__t_add5']);
    state.run.crisis = '__t_crisis';
    state.run.crisisActive = true;
    state.run.chapter = 2;
    const r = computeChronicle(state, () => {});
    const srcs = r.steps.map((s) => s.source);
    expect(srcs.indexOf('crisis')).toBeGreaterThan(srcs.indexOf('doctrine'));
    expect(r.splendor).toBeCloseTo((2 + 5) * 0.5);
    expect(r.passed).toBe(false);
    expect(r.mandateLost).toBe(2);
    expect(r.influenceEarned.find((l) => l.label === 'Test Crisis overcome')).toBeUndefined();
  });

  it('influence: stipend, chapter bonus, capped interest, triumph', () => {
    state.run.influence = 40;
    state.run.stats.culture = 1000; // 2000 + 22 = 2022 × 2 = 4044, comfortably above Triumph.
    const r = computeChronicle(state, () => {});
    expect(r.triumph).toBe(true);
    expect(r.influenceEarned).toEqual([
      { label: 'Chapter stipend', amount: 3 },
      { label: 'Rise bonus', amount: 1 },
      { label: 'Interest', amount: 5 },
      { label: 'Triumph', amount: 3 },
    ]);
  });

  it('cities score capital first, then by founding order', () => {
    state.cities[1].isCapital = false;
    state.cities[1].order = 0;
    state.cities[2] = testCity(2, 'Second', 1, 1, { isCapital: true });
    state.cities[3] = testCity(3, 'Third', 2, 2);
    const refs = computeChronicle(state, () => {}).steps.filter((s) => s.source === 'city').map((s) => s.ref);
    expect(refs).toEqual(['2', '1', '3']);
  });
});

describe('previewChronicle', () => {
  it('does not mutate state (hook counters, stats, rng) and matches the real chronicle', () => {
    own(['__t_counter']);
    const before = structuredClone(state);
    const preview = previewChronicle(state);
    expect(state).toEqual(before);
    const events: unknown[] = [];
    const real = computeChronicle(state, (e) => events.push(e));
    expect(real.score).toBe(preview.score);
    expect(state.run.doctrines[0].counters.fired).toBe(1);
    expect(events).toContainEqual({ type: 'doctrineTriggered', uid: 1000, text: 'grow', tile: undefined });
  });
});

describe('chronicleTarget', () => {
  it('grows through the six eras and continues compounding only after victory', () => {
    expect(chronicleTarget(state, 1, 0)).toBeGreaterThan(chronicleTarget(state, 0, 0));
    expect(chronicleTarget(state, 5, 0)).toBeGreaterThan(chronicleTarget(state, 4, 0));
    expect(chronicleTarget(state, 6, 0) / chronicleTarget(state, 5, 0)).toBe(3);
    expect(chronicleTarget(state, 7, 0) / chronicleTarget(state, 6, 0)).toBe(3);
    expect(chronicleTarget(state, 5, 2)).toBeGreaterThan(chronicleTarget(state, 5, 1));
  });

  it('applies the revealed crisis only to the current era chapter III, before it begins', () => {
    const regular = chronicleTarget(state, 0, 2);
    const nextEra = chronicleTarget(state, 1, 2);
    const trial = chronicleTarget(state, 0, 1);
    state.run.crisis = '__t_crisis';
    expect(chronicleTarget(state, 0, 2)).toBeCloseTo(regular * 1.5);
    expect(chronicleTarget(state, 0, 1)).toBe(trial);
    expect(chronicleTarget(state, 1, 2)).toBe(nextEra);
  });
});
