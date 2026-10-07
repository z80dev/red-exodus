import { describe, expect, it } from 'vitest';
import { LEADERS } from './index';
import { createGame } from '../sim/engine';
import { HUMAN } from '../sim/types';

// Nation hooks run for every player that leads that nation (AIs included). Run-level perks (pillar
// levels, Salvage, Charter) must only ever land on the human's run, whoever the rivals are.
describe('nation perks stay with their own player', () => {
  it('no rival nation changes the human run or the human player at landfall', () => {
    const signature = (seed: string) => {
      const state = createGame({ seed, leaderId: 'usa', ascension: 0, mapSize: 'small', rivals: 3, tutorial: false, daily: false }).state;
      const r = state.run;
      const h = state.players[HUMAN];
      const sig = JSON.stringify({
        pillarLevels: r.pillarLevels, edicts: r.edicts.map((e) => e.id), doctrines: r.doctrines.map((d) => d.id),
        mandate: r.mandate, maxMandate: r.maxMandate, influence: r.influence, doctrineSlots: r.doctrineSlots,
        edictSlots: r.edictSlots, gold: h.gold, cryo: h.cryo, techs: h.techs,
      });
      return { sig, rivals: state.players.filter((p) => p.id !== HUMAN && p.leaderId !== undefined).map((p) => p.leaderId) };
    };
    const baseline = signature('iso-all-0').sig;
    const unseen = new Set(Object.keys(LEADERS).filter((id) => id !== 'usa'));
    for (let i = 0; i < 600 && unseen.size; i++) {
      const { sig, rivals } = signature(`iso-all-${i}`);
      expect(sig, `rivals ${rivals.join(', ')}`).toBe(baseline);
      for (const id of rivals) unseen.delete(id);
    }
    expect([...unseen]).toEqual([]);
  }, 120_000);

  it('the human nation gets its own perks', () => {
    const make = (leaderId: string) => createGame({ seed: 'own', leaderId, ascension: 0, mapSize: 'small', rivals: 1, tutorial: false, daily: false }).state;
    expect(make('france').run.pillarLevels.arts).toBe(2);
    expect(make('russia').run.edicts.map((e) => e.id)).toContain('tsar_charge');
    expect(make('vatican').run.maxMandate).toBe(make('usa').run.maxMandate + 1);
    expect(Object.keys(LEADERS)).toHaveLength(50);
  });

  it('leading the alternate commander changes who leads, not the game', () => {
    const make = (altCommander: boolean) => createGame({ seed: 'commander', leaderId: 'colombia', ascension: 0, mapSize: 'small', rivals: 3, tutorial: false, daily: false, altCommander }).state;
    const def = make(false);
    const alt = make(true);
    expect(def.players[HUMAN].name).toBe(LEADERS.colombia.name);
    expect(alt.players[HUMAN].name).toBe(LEADERS.colombia.alt.name);
    expect(alt.players[HUMAN].altCommander).toBe(true);
    expect(alt.players.map((p) => [p.leaderId, p.name])).toEqual(def.players.map((p, i) => [p.leaderId, i === HUMAN ? LEADERS.colombia.alt.name : p.name]));
    expect(alt.map).toEqual(def.map);
    expect(alt.rng).toEqual(def.rng);
    expect(alt.run).toEqual(def.run);
  });
});
