import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaderDef } from '../defs';
import type { GameState } from '../types';
import { DOCTRINES, LEADERS } from '../../content';
import {
  defaultProfile, isDoctrineUnlocked, isLeaderUnlocked, loadProfile, lockedContent, maxAscension, recordRunEnd,
  resetProgress, saveProfile, starterLeaders, unlockHint,
} from '../../meta/profile';
import { initRun } from './run';
import { testState } from './testState';

vi.mock(import('../cities'), async (orig) => ({ ...(await orig()), refreshAllCities: () => {} }));

function leader(id: string, unlock?: LeaderDef['unlock']): LeaderDef {
  return {
    id, name: id, title: '', civName: id, adjective: id, colors: { primary: '#fff', secondary: '#000' }, country: id, code: 'TST',
    flagColors: ['#fff', '#000'], description: '', bonus: '', aiPersonality: 'builder', cityNames: [],
    portrait: { hue: 0, motif: 'sun', crest: 'crown' }, gender: 'f', alt: { name: `${id} alt`, title: '', gender: 'm', description: '' }, unlock, effects: {},
  };
}

beforeAll(() => {
  LEADERS.__p_era = leader('__p_era', { text: 'Reach the Frontier era', rule: 'reachEra3' });
  LEADERS.__p_win = leader('__p_win', { text: 'Win with the tester', rule: 'winWith:__test_leader' });
  DOCTRINES.__p_doc = {
    id: '__p_doc', name: 'Locked Doc', rarity: 'rare', cost: 8, description: '', tags: [], icon: 'doctrine',
    art: { hue: 0, motif: 'sun' }, unlock: { text: 'Seize 5 colonies in one run', rule: 'capture5' }, effects: {},
  };
});

beforeEach(() => {
  saveProfile(defaultProfile());
});

function endedRun(era: number, won: boolean): GameState {
  const s = testState(`PROFILE-${era}-${won}`);
  initRun(s, () => {});
  s.run.era = era;
  s.turn = 40;
  s.run.bestScore = 5000;
  s.run.seen.push('doctrine:__p_doc', 'crisis:whatever');
  if (won) s.run.history.push({ era: 5, chapter: 2, score: 1, target: 1, passed: true });
  return s;
}

describe('profile', () => {
  it('defaults: starter leaders unlocked, locked content reported', () => {
    const p = loadProfile();
    expect(starterLeaders().length).toBeGreaterThanOrEqual(2);
    expect(isLeaderUnlocked(p, '__p_era')).toBe(false);
    expect(isDoctrineUnlocked(p, '__p_doc')).toBe(false);
    expect(lockedContent(p)).toContain('__p_doc');
    expect(unlockHint('doctrine', '__p_doc')).toBe('Seize 5 colonies in one run');
    expect(maxAscension(p, '__test_leader')).toBe(0);
  });

  it('recordRunEnd applies stats & unlock rules once per run', () => {
    const s = endedRun(2, false);
    const { unlocks } = recordRunEnd(s);
    expect(unlocks.map((u) => u.id)).toContain('__p_era');
    expect(unlocks.map((u) => u.id)).not.toContain('__p_win');
    const again = recordRunEnd(s);
    expect(again.unlocks).toEqual(unlocks);
    const p = loadProfile();
    expect(p.stats).toMatchObject({ runs: 1, wins: 0, bestScore: 5000, bestEra: 2, totalTurns: 40 });
    expect(isLeaderUnlocked(p, '__p_era')).toBe(true);
    expect(p.discovered.doctrines).toContain('__p_doc');
  });

  it('winning unlocks win-with rules and the next ascension (max 8)', () => {
    const s = endedRun(5, true);
    s.run.totals.citiesCaptured = 5;
    const ids = recordRunEnd(s).unlocks.map((u) => `${u.kind}:${u.id}`);
    expect(ids).toEqual(expect.arrayContaining(['leader:__p_win', 'doctrine:__p_doc', 'ascension:__test_leader']));
    let p = loadProfile();
    expect(p.stats.wins).toBe(1);
    expect(maxAscension(p, '__test_leader')).toBe(1);
    expect(isDoctrineUnlocked(p, '__p_doc')).toBe(true);
    const top = endedRun(5, true);
    top.config.ascension = 8;
    top.turn = 99;
    recordRunEnd(top);
    p = loadProfile();
    expect(maxAscension(p, '__test_leader')).toBe(8);
  });

  it('daily best & attempts; resetProgress keeps settings', () => {
    const s = endedRun(1, false);
    s.config.daily = true;
    s.config.seed = 'DAILY-2026-09-27';
    recordRunEnd(s);
    let p = loadProfile();
    expect(p.dailies['2026-09-27']).toBe(5000);
    expect(p.dailyAttempts).toContain('2026-09-27');
    p.settings.music = 0.1;
    saveProfile(p);
    p = resetProgress(loadProfile());
    expect(p.settings.music).toBe(0.1);
    expect(p.stats.runs).toBe(0);
    expect(loadProfile().dailies).toEqual({});
  });
});
