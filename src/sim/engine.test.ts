import { describe, expect, it } from 'vitest';
import { BARBARIAN, HUMAN } from './types';
import { applyAction } from './engine';
import { citiesOf } from './cities';
import { hexDistance } from './hex';
import { attentionCount, nextAttention } from './selectors';
import { autoplay, findNonFinite, newGame, replay, startPlaying } from './testkit';
import type { SimEvent } from './types';

describe('createGame', () => {
  it('seats the human, distinct rivals and the barbarians with the starting kit; human scouts explore on their own', () => {
    const s = newGame('ENGINE-SETUP');
    expect(s.players.map((p) => p.id)).toEqual([0, 1, 2, 3, BARBARIAN]);
    const leaders = s.players.slice(0, 4).map((p) => p.leaderId);
    expect(new Set(leaders).size).toBe(4);
    expect(s.players[HUMAN].isHuman).toBe(true);
    for (const p of s.players.slice(1, 4)) expect(p.ai?.personality).toBeTruthy();
    const scout = Object.values(s.units).find((u) => u.owner === HUMAN && u.type === 'scout')!;
    expect(scout.order).toEqual({ kind: 'explore' });
    for (let pid = 0; pid < 4; pid++) {
      const capital = s.cities[s.players[pid].capitalId!];
      expect(capital.tile).toBe(s.map.starts[pid]);
      expect(capital.isCapital).toBe(true);
      const units = Object.values(s.units).filter((u) => u.owner === pid);
      expect(units.map((u) => u.type).sort()).toEqual(['scout', 'warrior']);
      for (const u of units) expect(hexDistance(s.map, u.tile, s.map.starts[pid])).toBeLessThanOrEqual(1);
    }
    expect(s.players[HUMAN].researchOffer.length).toBeGreaterThan(0);
    for (const p of s.players.slice(1, 4)) expect(p.researchOffer).toEqual([]);
    expect(s.players[HUMAN].vis.some((v) => v === 2)).toBe(true);
    expect(s.run.phase).not.toBe('playing');
  });

  it('rejects map actions until the chapter is being played', () => {
    const s = newGame('ENGINE-PHASE');
    const scout = Object.values(s.units).find((u) => u.owner === HUMAN && u.type === 'scout')!;
    const r = applyAction(s, { type: 'skipUnit', unitId: scout.id });
    expect(r.ok).toBe(false);
    startPlaying(s);
    expect(s.run.phase).toBe('playing');
    expect(applyAction(s, { type: 'skipUnit', unitId: scout.id }).ok).toBe(true);
  });
});

describe('applyPlayerAction validation', () => {
  it('refuses to command another player\'s units and cities', () => {
    const s = newGame('ENGINE-OWN');
    startPlaying(s);
    expect(s.players[HUMAN].capitalId).not.toBeNull();
    const rivalUnit = Object.values(s.units).find((u) => u.owner === 1)!;
    expect(applyAction(s, { type: 'skipUnit', unitId: rivalUnit.id }).error).toBe('Unit not found.');
    const r = applyAction(s, { type: 'endTurn' });
    expect(r.ok).toBe(true);
    const rivalCity = Object.values(s.cities).find((c) => c.owner !== HUMAN)!;
    expect(applyAction(s, { type: 'setFocus', cityId: rivalCity.id, focus: 'food' }).ok).toBe(false);
  });

  it('ends turn 1 without moving any unit; only research and empty build queues ask for attention', () => {
    const s = newGame('ENGINE-IDLE');
    startPlaying(s);
    const human = s.players[HUMAN];
    const capital = s.cities[human.capitalId!];
    human.researching = null;
    capital.queue = [];
    expect(attentionCount(s)).toBe(2);
    expect(nextAttention(s)).toEqual({ kind: 'research' });
    human.researching = human.researchOffer[0];
    expect(nextAttention(s)).toEqual({ kind: 'city', id: capital.id });
    capital.queue = [{ kind: 'project', id: 'wealth' }];
    expect(attentionCount(s)).toBe(0);
    expect(Object.values(s.units).some((u) => u.owner === HUMAN && u.moves > 0 && !u.order)).toBe(true);
    const turn = s.turn;
    expect(applyAction(s, { type: 'endTurn' }).ok).toBe(true);
    expect(s.turn).toBe(turn + 1);
  });

  it('nations never fight each other: every combat involves the Raiders', () => {
    const s = newGame('ENGINE-PEACE');
    const events: SimEvent[] = [];
    const actions = autoplay(s, 30);
    const t = newGame('ENGINE-PEACE');
    for (const a of actions) events.push(...applyAction(t, a).events);
    const fights = events.filter((e): e is Extract<SimEvent, { type: 'combat' }> => e.type === 'combat');
    for (const f of fights) expect(f.attacker.player === BARBARIAN || f.defender.player === BARBARIAN).toBe(true);
  });
});

describe('determinism & saves', () => {
  it('same seed + same actions → identical state', () => {
    const a = newGame('DET-1');
    const actions = autoplay(a, 12);
    const b = newGame('DET-1');
    replay(b, actions);
    expect(b).toEqual(a);
  });

  it('a structured-clone save resumes identically', () => {
    const a = newGame('SAVE-1');
    autoplay(a, 6);
    const saved = structuredClone(a);
    const actions = autoplay(a, 6);
    replay(saved, actions);
    expect(saved).toEqual(a);
  });
});

describe('60-turn smoke', () => {
  for (const seed of ['SMOKE-A', 'SMOKE-B', 'SMOKE-C', 'SMOKE-D', 'SMOKE-E']) {
    it(`seed ${seed} plays 60 turns without errors or non-finite numbers`, () => {
      const s = newGame(seed);
      const times: number[] = [];
      autoplay(s, 60, (ms) => times.push(ms));
      // a 54-turn run can reach victory before turn 60; autoplay stops there
      expect(s.turn >= 60 || s.gameOver || s.run.phase === 'victory').toBe(true);
      expect(findNonFinite(s)).toEqual([]);
      for (const p of s.players) {
        if (!p.alive || p.id === BARBARIAN) continue;
        for (const c of citiesOf(s, p.id)) {
          expect(c.pop).toBeGreaterThanOrEqual(1);
          expect(c.hp).toBeLessThanOrEqual(c.maxHp);
          expect(s.map.tiles[c.tile].cityId).toBe(c.id);
        }
      }
      times.sort((x, y) => x - y);
      expect(times[times.length >> 1]).toBeLessThan(150);
    }, 120_000);
  }
});
