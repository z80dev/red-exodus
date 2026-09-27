import { describe, expect, it } from 'vitest';
import { LEADERS, PROMOTIONS } from '../content';
import { createGame } from './engine';
import { hexDistance, neighbors } from './hex';
import { applyPromotion, grantXp, moveUnitTo, unitsTurnStart } from './units';
import type { GameState, SimEvent, Unit } from './types';

function fixture(): { state: GameState; unit: Unit; target: number; events: SimEvent[] } {
  const { state } = createGame({ seed: 'UNIT-REGRESSION', leaderId: Object.keys(LEADERS)[0], ascension: 0,
    mapSize: 'small', rivals: 1, tutorial: false, daily: false });
  const from = state.map.tiles.find(t => t.terrain === 'grassland' && t.elevation !== 'mountain' && t.cityId === null &&
    neighbors(state.map, t.idx).some(n => state.map.tiles[n].terrain === 'grassland' && state.map.tiles[n].elevation !== 'mountain' && state.map.tiles[n].cityId === null))!;
  const target = neighbors(state.map, from.idx).find(n => state.map.tiles[n].terrain === 'grassland' && state.map.tiles[n].elevation !== 'mountain' && state.map.tiles[n].cityId === null)!;
  for (const occupant of Object.values(state.units)) if (occupant.tile === from.idx || occupant.tile === target ||
    neighbors(state.map, target).includes(occupant.tile)) delete state.units[occupant.id];
  const unit: Unit = { id: state.nextId++, owner: 0, type: 'warrior', tile: from.idx,
    hp: 100, moves: 2, hasAttacked: false, xp: 0, level: 0, promotions: [], promotionChoices: null, order: null, fortifyTurns: 0, age: 1 };
  state.units[unit.id] = unit;
  state.map.tiles[target].owner = null;
  state.map.tiles[target].cityId = null;
  state.players[0].vis[target] = 2;
  const events: SimEvent[] = [];
  return { state, unit, target, events };
}

describe('units', () => {
  it('enters and clears an undefended camp, rewarding gold exactly once', () => {
    const { state, unit, target, events } = fixture();
    state.map.tiles[target].camp = true;
    const before = state.players[0].gold;
    expect(moveUnitTo(state, unit, target, ev => events.push(ev))).toBeNull();
    expect(unit.tile).toBe(target);
    expect(state.map.tiles[target].camp).toBe(false);
    expect(state.players[0].gold).toBe(before + 25 + 15 * state.run.era);
    expect(events.filter(e => e.type === 'campCleared')).toHaveLength(1);
  });

  it('does not let barbarian raiders clear their own camp', () => {
    const { state, unit, target, events } = fixture();
    unit.owner = 99;
    state.map.tiles[target].camp = true;
    expect(moveUnitTo(state, unit, target, ev => events.push(ev))).toBeNull();
    expect(state.map.tiles[target].camp).toBe(true);
    expect(events.some(e => e.type === 'campCleared')).toBe(false);
  });

  it('explores a ruin on entry and consumes it before any revisit', () => {
    const { state, unit, target, events } = fixture();
    state.map.tiles[target].ruin = true;
    expect(moveUnitTo(state, unit, target, ev => events.push(ev))).toBeNull();
    expect(state.map.tiles[target].ruin).toBe(false);
    expect(events.filter(e => e.type === 'ruinExplored')).toHaveLength(1);
  });

  it('captures an undefended wartime settler and converts it to the victor', () => {
    const { state, unit, target, events } = fixture();
    state.players[0].relations[1] = 'war';
    state.players[1].relations[0] = 'war';
    const enemy: Unit = { ...unit, id: state.nextId++, owner: 1, type: 'settler', tile: target };
    state.units[enemy.id] = enemy;
    expect(moveUnitTo(state, unit, target, ev => events.push(ev))).toBeNull();
    expect(unit.tile).toBe(target);
    expect(state.units[enemy.id]).toBeUndefined();
    expect(Object.values(state.units).some(u => u.owner === 0 && u.type === 'settler' && u.tile === target)).toBe(true);
    expect(events.some(e => e.type === 'unitDied' && e.unitId === enemy.id && e.killer === 0)).toBe(true);
  });

  it('transits a friendly military tile without ever ending stacked', () => {
    const { state, unit, target, events } = fixture();
    const destination = neighbors(state.map, target).find(n => hexDistance(state.map, n, unit.tile) === 2 &&
      state.map.tiles[n].cityId === null && state.map.tiles[n].elevation !== 'mountain')!;
    state.map.tiles[destination].terrain = 'grassland';
    state.map.tiles[destination].elevation = 'flat';
    state.map.tiles[destination].feature = null;
    state.players[0].vis[destination] = 2;
    for (const occupied of Object.values(state.units)) if (occupied.tile === destination) delete state.units[occupied.id];
    for (const neighbor of neighbors(state.map, unit.tile)) if (neighbor !== target && neighbor !== destination) {
      state.map.tiles[neighbor].terrain = 'ocean';
      state.players[0].vis[neighbor] = 2;
    }
    unit.moves = 4;
    const ally: Unit = { ...unit, id: state.nextId++, tile: target };
    state.units[ally.id] = ally;
    expect(moveUnitTo(state, unit, destination, ev => events.push(ev))).toBeNull();
    expect(unit.tile).toBe(destination);
    expect(ally.tile).toBe(target);
    expect(events.some(e => e.type === 'unitMoved' && e.unitId === unit.id && e.path.includes(target))).toBe(true);
  });

  it('exhausts movement when crossing adjacent hostile zone of control', () => {
    const { state, unit, target, events } = fixture();
    const hostileTile = neighbors(state.map, target).find(n => n !== unit.tile && neighbors(state.map, unit.tile).includes(n) &&
      state.map.tiles[n].elevation !== 'mountain' && state.map.tiles[n].cityId === null)!;
    state.map.tiles[hostileTile].terrain = 'grassland';
    state.players[0].vis[hostileTile] = 2;
    state.players[0].vis[unit.tile] = 2;
    const enemy: Unit = { ...unit, id: state.nextId++, owner: 1, tile: hostileTile };
    state.units[enemy.id] = enemy;
    expect(moveUnitTo(state, unit, target, ev => events.push(ev))).toBeNull();
    expect(unit.tile).toBe(target);
    expect(unit.moves).toBe(0);
    expect(state.units[enemy.id]).toBe(enemy);
  });

  it('releases a queued move when its route becomes impassable', () => {
    const { state, unit, target, events } = fixture();
    unit.order = { kind: 'goto', target };
    state.map.tiles[target].elevation = 'mountain';
    unitsTurnStart(state, 0, ev => events.push(ev));
    expect(unit.tile).not.toBe(target);
    expect(unit.order).toBeNull();
  });

  it('offers legal promotions at XP thresholds, applies one and heals half the health bar', () => {
    const { state, unit, events } = fixture();
    unit.hp = 20;
    grantXp(state, unit, 10, ev => events.push(ev));
    expect(unit.level).toBe(1);
    expect(unit.promotionChoices?.length).toBe(2);
    expect(unit.promotionChoices!.every(id => PROMOTIONS[id].classes.includes('melee') && PROMOTIONS[id].tier === 1)).toBe(true);
    expect(events.some(e => e.type === 'unitLevelUp' && e.unitId === unit.id)).toBe(true);
    expect(applyPromotion(state, unit, 'nonexistent', ev => events.push(ev))).not.toBeNull();
    const chosen = unit.promotionChoices![0];
    expect(applyPromotion(state, unit, chosen, ev => events.push(ev))).toBeNull();
    expect(unit.hp).toBe(70);
    expect(unit.promotions).toContain(chosen);
    expect(unit.promotionChoices).toBeNull();
  });

  it('heals only rested units and fortifies in stages', () => {
    const { state, unit, events } = fixture();
    unit.hp = 10;
    unit.moves = 0;
    unit.order = { kind: 'fortify' };
    unitsTurnStart(state, 0, ev => events.push(ev));
    expect(unit.hp).toBe(10);
    expect(unit.fortifyTurns).toBe(0);
    unitsTurnStart(state, 0, ev => events.push(ev));
    expect(unit.hp).toBeGreaterThan(10);
    expect(unit.fortifyTurns).toBe(1);
    unitsTurnStart(state, 0, ev => events.push(ev));
    expect(unit.fortifyTurns).toBe(2);
  });
});
