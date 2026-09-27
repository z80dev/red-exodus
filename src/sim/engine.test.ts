import { describe, expect, it } from 'vitest';
import { BARBARIAN, HUMAN } from './types';
import { applyAction } from './engine';
import { citiesOf } from './cities';
import { hexDistance } from './hex';
import { autoplay, findNonFinite, foundFirstCity, newGame, replay, startPlaying } from './testkit';

describe('createGame', () => {
  it('seats the human, distinct rivals and the barbarians with correct relations and starting kit', () => {
    const s = newGame('ENGINE-SETUP');
    expect(s.players.map((p) => p.id)).toEqual([0, 1, 2, 3, BARBARIAN]);
    const leaders = s.players.slice(0, 4).map((p) => p.leaderId);
    expect(new Set(leaders).size).toBe(4);
    expect(s.players[HUMAN].isHuman).toBe(true);
    for (const p of s.players.slice(1, 4)) expect(p.ai?.personality).toBeTruthy();
    for (const p of s.players) {
      for (const o of s.players) {
        if (o.id === p.id) continue;
        expect(p.relations[o.id]).toBe(p.id === BARBARIAN || o.id === BARBARIAN ? 'war' : 'peace');
      }
    }
    for (let pid = 0; pid < 4; pid++) {
      const units = Object.values(s.units).filter((u) => u.owner === pid);
      expect(units.map((u) => u.type).sort()).toEqual(['scout', 'settler', 'warrior']);
      for (const u of units) expect(hexDistance(s.map, u.tile, s.map.starts[pid])).toBeLessThanOrEqual(1);
    }
    expect(s.players[HUMAN].vis.some((v) => v === 2)).toBe(true);
    expect(s.run.phase).not.toBe('playing');
  });

  it('rejects map actions until the chapter is being played', () => {
    const s = newGame('ENGINE-PHASE');
    const settler = Object.values(s.units).find((u) => u.owner === HUMAN && u.type === 'settler')!;
    const r = applyAction(s, { type: 'foundCity', unitId: settler.id });
    expect(r.ok).toBe(false);
    startPlaying(s);
    expect(s.run.phase).toBe('playing');
    expect(applyAction(s, { type: 'foundCity', unitId: settler.id }).ok).toBe(true);
  });
});

describe('applyPlayerAction validation', () => {
  it('refuses to command another player\'s units and cities', () => {
    const s = newGame('ENGINE-OWN');
    startPlaying(s);
    foundFirstCity(s);
    const rivalUnit = Object.values(s.units).find((u) => u.owner === 1)!;
    expect(applyAction(s, { type: 'skipUnit', unitId: rivalUnit.id }).error).toBe('No such unit');
    const r = applyAction(s, { type: 'endTurn' });
    expect(r.ok).toBe(true);
    const rivalCity = Object.values(s.cities).find((c) => c.owner !== HUMAN);
    if (rivalCity) expect(applyAction(s, { type: 'setFocus', cityId: rivalCity.id, focus: 'food' }).ok).toBe(false);
  });

  it('declaring war flips both sides and a fresh peace treaty blocks immediate redeclaration', () => {
    const s = newGame('ENGINE-WAR');
    startPlaying(s);
    expect(applyAction(s, { type: 'declareWar', target: 1 }).ok).toBe(true);
    expect(s.players[HUMAN].relations[1]).toBe('war');
    expect(s.players[1].relations[HUMAN]).toBe('war');
    expect(applyAction(s, { type: 'declareWar', target: 1 }).ok).toBe(false);
    expect(applyAction(s, { type: 'declareWar', target: HUMAN }).ok).toBe(false);
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
      expect(s.turn >= 60 || s.gameOver).toBe(true);
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
