import { describe, expect, it } from 'vitest';
import { LEADERS } from '../../content';
import { applyAction, createGame } from '../engine';
import { autoplayNextAction, aiAcceptsPeace } from './index';
import type { Action } from '../types';

describe('rival AI and autoplay', () => {
  it('plays a generated map turn, founding cities and choosing research through the actual engine', () => {
    const { state } = createGame({ seed: 'AI-SMOKE', leaderId: Object.keys(LEADERS)[0], ascension: 0,
      mapSize: 'small', rivals: 2, tutorial: false, daily: false });
    let actions = 0;
    while (state.turn < 2 && state.run.phase !== 'defeat' && actions++ < 80) {
      const action: Action = autoplayNextAction(state) ?? { type: 'endTurn' };
      const result = applyAction(state, action);
      expect(result.ok, `${JSON.stringify(action)}: ${result.error ?? ''}`).toBe(true);
    }
    expect(state.players.filter(p => p.id > 0 && p.id !== 99).every(p => p.researching !== null)).toBe(true);
    expect(Object.values(state.cities).some(c => c.owner !== 0)).toBe(true);
    expect(state.turn).toBeGreaterThan(0);
  });

  it('accepts peace when overwhelmed, but not outside an active war', () => {
    const { state } = createGame({ seed: 'PEACE-REGRESSION', leaderId: Object.keys(LEADERS)[0], ascension: 0,
      mapSize: 'small', rivals: 1, tutorial: false, daily: false });
    expect(aiAcceptsPeace(state, 1, 0)).toBe(false);
    state.players[1].relations[0] = 'war';
    state.players[0].relations[1] = 'war';
    state.turn = 20;
    state.players[1].counters['war:0'] = 3;
    expect(aiAcceptsPeace(state, 1, 0)).toBe(true);
  });
  it('never reissues a blocked move or a fortified no-op across multi-turn autoplay', () => {
    const { state } = createGame({ seed: 'SMOKE-1', leaderId: Object.keys(LEADERS)[0], ascension: 0,
      mapSize: 'standard', rivals: 3, tutorial: false, daily: false });
    let prior = '';
    let priorTurn = -1;
    let repeats = 0;
    let actions = 0;
    while (state.turn < 20 && state.run.phase !== 'defeat' && actions++ < 250) {
      const action: Action = autoplayNextAction(state) ?? { type: 'endTurn' };
      const key = JSON.stringify(action);
      repeats = key === prior && state.turn === priorTurn ? repeats + 1 : 0;
      expect(repeats, `Repeated ${key} on turn ${state.turn}`).toBeLessThan(2);
      prior = key;
      priorTurn = state.turn;
      const result = applyAction(state, action);
      expect(result.ok, `${key}: ${result.error ?? ''}`).toBe(true);
    }
    expect(state.turn).toBe(20);
  });

});
