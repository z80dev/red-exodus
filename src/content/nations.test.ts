import { describe, expect, it } from 'vitest';
import { LEADERS } from './index';
import { createGame } from '../sim/engine';
import { HUMAN } from '../sim/types';

// Nation hooks run for every player that leads that nation (AIs included). Run-level perks (pillar
// levels, Salvage, Charter) must only ever land on the human's run, whoever the rivals are.
describe('nation perks stay with their own player', () => {
  const rivalsOf = (id: string) => createGame({ seed: `iso-${id}`, leaderId: 'usa', ascension: 0, mapSize: 'small', rivals: 3, tutorial: false, daily: false }).state;

  it('AI France/Russia/Vatican never touch the human run', () => {
    for (let i = 0; i < 40; i++) {
      const state = rivalsOf(String(i));
      const rivals = state.players.filter((p) => p.id !== HUMAN).map((p) => p.leaderId);
      if (rivals.includes('france')) expect(state.run.pillarLevels.arts).toBe(1);
      if (rivals.includes('russia')) expect(state.run.edicts.map((e) => e.id)).not.toContain('tsar_charge');
      if (rivals.includes('vatican')) expect(state.run.maxMandate).toBe(createGame({ seed: 'base', leaderId: 'usa', ascension: 0, mapSize: 'small', rivals: 1, tutorial: false, daily: false }).state.run.maxMandate);
    }
  });

  it('the human nation gets its own perks', () => {
    const make = (leaderId: string) => createGame({ seed: 'own', leaderId, ascension: 0, mapSize: 'small', rivals: 1, tutorial: false, daily: false }).state;
    expect(make('france').run.pillarLevels.arts).toBe(2);
    expect(make('russia').run.edicts.map((e) => e.id)).toContain('tsar_charge');
    expect(make('vatican').run.maxMandate).toBe(make('usa').run.maxMandate + 1);
    expect(Object.keys(LEADERS)).toHaveLength(12);
  });
});
