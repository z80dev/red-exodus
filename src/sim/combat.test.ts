import { describe, expect, it } from 'vitest';
import { LEADERS } from '../content';
import { createGame } from './engine';
import { neighbors } from './hex';
import { attackTargets, cityStrength, previewAttack, resolveAttack } from './combat';
import type { City, GameState, SimEvent, Unit } from './types';
import { BARBARIAN } from './types';

function fixture(): { state: GameState; attacker: Unit; defender: Unit; events: SimEvent[] } {
  const { state } = createGame({ seed: 'COMBAT-REGRESSION', leaderId: Object.keys(LEADERS)[0], ascension: 0,
    mapSize: 'small', rivals: 1, tutorial: false, daily: false });
  const from = state.map.tiles.find(t => t.terrain === 'grassland' && t.elevation === 'flat' && !t.cityId &&
    neighbors(state.map, t.idx).some(n => state.map.tiles[n].terrain === 'grassland' && state.map.tiles[n].elevation === 'flat' && !state.map.tiles[n].cityId))!;
  const to = neighbors(state.map, from.idx).find(n => state.map.tiles[n].terrain === 'grassland' && state.map.tiles[n].elevation === 'flat' && !state.map.tiles[n].cityId)!;
  for (const unit of Object.values(state.units)) if (unit.tile === from.idx || unit.tile === to) delete state.units[unit.id];
  state.players[0].vis[to] = 2;
  state.players.find(p => p.id === BARBARIAN)!.vis[from.idx] = 2;
  const make = (id: number, owner: number, tile: number): Unit => ({ id, owner, tile, type: 'warrior',
    hp: 100, moves: 2, hasAttacked: false, xp: 0, level: 0, promotions: [], order: null, fortifyTurns: 0, age: 0 });
  const attacker = make(state.nextId++, 0, from.idx);
  const defender = make(state.nextId++, BARBARIAN, to);
  state.units[attacker.id] = attacker;
  state.units[defender.id] = defender;
  const events: SimEvent[] = [];
  return { state, attacker, defender, events };
}

describe('combat', () => {
  it('shows terrain, river, fortification and flanking modifiers without consuming RNG', () => {
    const { state, attacker, defender } = fixture();
    const tile = state.map.tiles[defender.tile];
    tile.elevation = 'hills'; tile.feature = 'forest';
    const direction = neighbors(state.map, attacker.tile).indexOf(defender.tile);
    tile.riverEdges = 0;
    state.map.tiles[attacker.tile].riverEdges |= 1 << direction;
    defender.fortifyTurns = 2;
    const flankTile = neighbors(state.map, defender.tile).find(n => n !== attacker.tile && !Object.values(state.units).some(u => u.tile === n))!;
    state.units[state.nextId] = { ...attacker, id: state.nextId++, tile: flankTile };
    const rng = { ...state.rng };
    const result = previewAttack(state, attacker, defender.tile)!;
    expect(result.attackMods).toEqual(expect.arrayContaining([expect.objectContaining({ pct: -20 }), expect.objectContaining({ pct: 10 })]));
    expect(result.defenseMods).toEqual(expect.arrayContaining([expect.objectContaining({ pct: 25 }), expect.objectContaining({ pct: 50 })]));
    expect(result.dmgToAttacker).toBeGreaterThan(result.dmgToDefender);
    expect(state.rng).toEqual(rng);
    expect(previewAttack(state, attacker, defender.tile)).toEqual(result);
  });

  it('does not retaliate against ranged fire and ranged fire cannot take a city below 1 HP', () => {
    const { state, attacker, defender, events } = fixture();
    attacker.type = 'archer';
    const result = previewAttack(state, attacker, defender.tile)!;
    expect(result.ranged).toBe(true);
    expect(result.dmgToAttacker).toBe(0);
    expect(attackTargets(state, attacker)).toContain(defender.tile);
    expect(resolveAttack(state, attacker, defender.tile, ev => events.push(ev))).toBeNull();
    expect(attacker.hp).toBe(100);
    expect(events.some(ev => ev.type === 'combat' && ev.ranged)).toBe(true);
    delete state.units[defender.id];
    const city: City = { id: state.nextId++, owner: BARBARIAN, name: 'Test City', tile: defender.tile,
      pop: 3, foodStored: 0, prodStored: 0, queue: [], buildings: [], wonders: [], focus: 'balanced', worked: [],
      cultureStored: 0, hp: 1, maxHp: 100, isCapital: false, foundedTurn: 0, hasStruck: false,
      yields: { food: 1, prod: 1, gold: 1, sci: 1, cul: 1 }, starving: false, order: 1 };
    state.cities[city.id] = city;
    attacker.hasAttacked = false; attacker.moves = 2;
    expect(cityStrength(state, city)).toBeGreaterThan(8);
    expect(resolveAttack(state, attacker, city.tile, ev => events.push(ev))).toBeNull();
    expect(city.hp).toBe(1);
    expect(city.owner).toBe(BARBARIAN);
  });

  it('does not reveal concealed enemy positions through attack previews', () => {
    const { state, attacker, defender } = fixture();
    state.players[0].vis[defender.tile] = 1;
    expect(previewAttack(state, attacker, defender.tile)).toBeNull();
    expect(attackTargets(state, attacker)).not.toContain(defender.tile);
  });

  it('never lets two nations fight: rival units are not targets', () => {
    const { state, attacker, defender } = fixture();
    defender.owner = 1;
    expect(previewAttack(state, attacker, defender.tile)).toBeNull();
    expect(attackTargets(state, attacker)).not.toContain(defender.tile);
    const events: SimEvent[] = [];
    expect(resolveAttack(state, attacker, defender.tile, ev => events.push(ev))).not.toBeNull();
    expect(events).toHaveLength(0);
  });

  it('Raiders that break a colony loot Credits and leave it standing', () => {
    const { state, attacker, defender, events } = fixture();
    delete state.units[defender.id];
    attacker.owner = BARBARIAN;
    const raider = attacker;
    const city: City = { id: state.nextId++, owner: 0, name: 'Outpost', tile: defender.tile,
      pop: 2, foodStored: 0, prodStored: 0, queue: [], buildings: [], wonders: [], focus: 'balanced', worked: [],
      cultureStored: 0, hp: 1, maxHp: 100, isCapital: false, foundedTurn: 0, hasStruck: false,
      yields: { food: 2, prod: 2, gold: 1, sci: 0, cul: 0 }, starving: false, order: 1 };
    state.cities[city.id] = city;
    state.map.tiles[city.tile].owner = 0;
    state.map.tiles[city.tile].cityId = city.id;
    state.players.find(p => p.id === BARBARIAN)!.vis[city.tile] = 2;
    state.players[0].gold = 200;
    const from = raider.tile;
    expect(resolveAttack(state, raider, city.tile, ev => events.push(ev))).toBeNull();
    expect(state.cities[city.id].owner).toBe(0);
    expect(city.hp).toBe(25);
    expect(state.players[0].gold).toBe(200 - Math.min(50, 25 + 10 * state.run.era));
    expect(raider.tile).toBe(from);
    expect(events.some(ev => ev.type === 'notify' && ev.tone === 'bad')).toBe(true);
  });

  it('clears a defended barbarian camp only after winning melee and entering it', () => {
    const { state, attacker, defender, events } = fixture();
    defender.owner = 99;
    defender.hp = 1;
    state.map.tiles[defender.tile].camp = true;
    const gold = state.players[0].gold;
    expect(resolveAttack(state, attacker, defender.tile, ev => events.push(ev))).toBeNull();
    expect(attacker.tile).toBe(defender.tile);
    expect(state.map.tiles[defender.tile].camp).toBe(false);
    expect(state.players[0].gold).toBe(gold + 25 + 15 * state.run.era);
    expect(events.some(ev => ev.type === 'campCleared' && ev.tile === defender.tile)).toBe(true);
  });

  it('awards promoted kill spoils, battlefield healing and bonus XP once', () => {
    const { state, attacker, defender, events } = fixture();
    attacker.promotions = ['plunderer', 'warlord', 'phantom'];
    attacker.hp = 80;
    defender.hp = 1;
    const gold = state.players[0].gold;
    expect(resolveAttack(state, attacker, defender.tile, ev => events.push(ev))).toBeNull();
    const hit = events.find(ev => ev.type === 'combat');
    expect(hit?.type).toBe('combat');
    if (hit?.type !== 'combat') throw new Error('Expected a combat result');
    expect(state.players[0].gold).toBe(gold + 20);
    // the kill XP reaches level 1: the automatic promotion heals +50 before the Command Frame kill heal (+25)
    expect(attacker.hp).toBe(Math.min(100, Math.min(100, 80 - hit.dmgToAttacker + 50) + 25));
    expect(attacker.xp).toBe(15);
    expect(attacker.level).toBe(1);
    expect(attacker.promotions).toHaveLength(4);
    expect(events.filter(ev => ev.type === 'unitDied' && ev.unitId === defender.id)).toHaveLength(1);
  });

});
