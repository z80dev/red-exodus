import { BUILDINGS, PROMOTIONS, TECHS } from '../content';
import type { CombatArgs, CombatMod } from './defs';
import { captureCity } from './cities';
import { addGold } from './economy';
import { runHook } from './effects';
import { dirBetween, hexDistance, neighbors, tilesInRadius } from './hex';
import { random } from './rng';
import type { City, Emit, GameState, TileIdx, Unit } from './types';
import { BARBARIAN } from './types';
import { grantXp, isCivilian, militaryAt, onUnitEnteredTile, removeUnit, unitDef, unitsAt } from './units';

export interface CombatPreview {
  ranged: boolean;
  attackerStrength: number;
  defenderStrength: number;
  attackMods: CombatMod[];
  defenseMods: CombatMod[];
  dmgToAttacker: number;
  dmgToDefender: number;
  defenderKillLikely: boolean;
  attackerDeathLikely: boolean;
  captures: boolean;
}

function hostile(state: GameState, a: number, b: number): boolean {
  return a !== b && (a === BARBARIAN || b === BARBARIAN || state.players.find(p => p.id === a)?.relations[b] === 'war');
}
function targetAt(state: GameState, tile: TileIdx, owner: number): { unit: Unit | null; city: City | null } {
  const unit = militaryAt(state, tile) ?? unitsAt(state, tile).find(u => isCivilian(u.type)) ?? null;
  const city = Object.values(state.cities).find(c => c.tile === tile) ?? null;
  return { unit: unit && hostile(state, owner, unit.owner) ? unit : null,
    city: city && hostile(state, owner, city.owner) ? city : null };
}
function combatDamage(attacker: number, defender: number): number {
  return Math.max(1, Math.round(30 * Math.pow(attacker / Math.max(1, defender), 1.5)));
}
function strength(base: number, hp: number, mods: CombatMod[]): number {
  return Math.max(1, base * (0.5 + hp / 200) * Math.max(0.1, 1 + mods.reduce((n, mod) => n + mod.pct, 0) / 100));
}
function isWater(terrain: string): boolean { return terrain === 'coast' || terrain === 'lake' || terrain === 'ocean'; }

export function cityStrength(state: GameState, city: City): number {
  const bestEra = state.players.find(p => p.id === city.owner)?.techs.reduce((n, id) => {
    const tech = state.run.era >= 0 ? techEra(id) : 0;
    return Math.max(n, tech);
  }, 0) ?? 0;
  return 8 + 4 * bestEra + city.pop * 0.5 + city.buildings.reduce((n, id) => n + (BUILDINGS[id]?.cityStrength ?? 0), 0);
}
function techEra(id: string): number { return TECHS[id]?.era ?? 0; }

function preview(state: GameState, attacker: Unit | null, attackerCity: City | null, target: TileIdx): CombatPreview | null {
  const owner = attacker?.owner ?? attackerCity?.owner;
  if (owner === undefined || !state.map.tiles[target]) return null;
  if (owner !== BARBARIAN && state.players.find(p => p.id === owner)?.vis[target] !== 2) return null;
  const { unit, city } = targetAt(state, target, owner);
  // A garrison is the immediate target; a city can only be damaged when its defender is gone.
  const defender = unit ?? null;
  const defenderCity = defender ? null : city;
  if (!defender && !defenderCity) return null;
  if (defender && isCivilian(defender.type) && attacker && isCivilian(attacker.type)) return null;
  const def = attacker && unitDef(attacker.type);
  const ranged = !!attackerCity || !!def?.rangedStrength;
  const from = attacker?.tile ?? attackerCity!.tile;
  const dist = hexDistance(state.map, from, target);
  const range = attackerCity ? 2 : (ranged ? (def?.range ?? 1) + (attacker?.promotions.reduce((n, id) => n + (PROMOTIONS[id]?.range ?? 0), 0) ?? 0) : 1);
  if (dist < 1 || dist > range || (attacker && (isCivilian(attacker.type) || (def?.abilities?.includes('noMelee') && !ranged)))) return null;
  const tile = state.map.tiles[target];
  const origin = state.map.tiles[from];
  const attackMods: CombatMod[] = [];
  const defenseMods: CombatMod[] = [];
  if (tile.elevation === 'hills') defenseMods.push({ label: 'Hills', pct: 25 });
  if (tile.feature === 'forest' || tile.feature === 'jungle') defenseMods.push({ label: tile.feature, pct: 25 });
  if (tile.feature === 'marsh') defenseMods.push({ label: 'Marsh', pct: -15 });
  if (attacker && !ranged && (origin.riverEdges & (1 << dirBetween(state.map, from, target))) !== 0 && !def?.abilities?.includes('amphibious'))
    attackMods.push({ label: 'River crossing', pct: -20 });
  if (defender?.fortifyTurns) defenseMods.push({ label: 'Fortified', pct: defender.fortifyTurns >= 2 ? 50 : 25 });
  if (attacker) {
    const flank = neighbors(state.map, target).filter(t => t !== from && militaryAt(state, t)?.owner === owner).length;
    if (flank) attackMods.push({ label: 'Flanking', pct: flank * 10 });
    const bonus = def?.bonusVs?.[defender ? unitDef(defender.type).class : 'city'];
    if (bonus) attackMods.push({ label: 'Class advantage', pct: bonus });
    for (const id of attacker.promotions) PROMOTIONS[id]?.combat?.({ side: 'attack', attacker, attackerCity: null,
      attackerOwner: owner, defender, defenderCity, defenderOwner: defender?.owner ?? defenderCity!.owner,
      tile, fromTile: origin, ranged, attackMods, defenseMods }, attacker);
  }
  if (defender) {
    const defenderBonus = unitDef(defender.type).bonusVs?.[attacker ? unitDef(attacker.type).class : 'city'];
    if (defenderBonus) defenseMods.push({ label: 'Class advantage', pct: defenderBonus });
    for (const id of defender.promotions) PROMOTIONS[id]?.combat?.({ side: 'defense', attacker, attackerCity,
      attackerOwner: owner, defender, defenderCity: null, defenderOwner: defender.owner, tile, fromTile: origin,
      ranged, attackMods, defenseMods }, defender);
  }
  const args: CombatArgs = { side: 'attack', attacker, attackerCity, attackerOwner: owner, defender, defenderCity,
    defenderOwner: defender?.owner ?? defenderCity!.owner, tile, fromTile: origin, ranged, attackMods, defenseMods };
  if (owner !== BARBARIAN) runHook(state, owner, 'combat', () => {}, null, args);
  args.side = 'defense';
  if (args.defenderOwner !== BARBARIAN) runHook(state, args.defenderOwner, 'combat', () => {}, null, args);
  const attackerStrength = strength(attackerCity ? cityStrength(state, attackerCity) : ranged ? def!.rangedStrength! : def!.strength,
    attacker?.hp ?? attackerCity!.hp, attackMods);
  const defendingBase = defender ? (isWater(tile.terrain) && unitDef(defender.type).class !== 'naval'
    ? unitDef(defender.type).strength * 0.4 : unitDef(defender.type).strength) : cityStrength(state, defenderCity!);
  const defenderStrength = strength(defendingBase, defender?.hp ?? defenderCity!.hp, defenseMods);
  const dmgToDefender = combatDamage(attackerStrength, defenderStrength);
  const dmgToAttacker = ranged || !attacker ? 0 : combatDamage(defenderStrength, attackerStrength);
  const remaining = defender?.hp ?? defenderCity!.hp;
  return { ranged, attackerStrength, defenderStrength, attackMods, defenseMods,
    dmgToDefender: defenderCity && ranged ? Math.min(dmgToDefender, Math.max(0, remaining - 1)) : dmgToDefender,
    dmgToAttacker, defenderKillLikely: remaining <= dmgToDefender && (!defenderCity || !ranged),
    attackerDeathLikely: !!attacker && attacker.hp <= dmgToAttacker, captures: !!defenderCity && !ranged && owner !== BARBARIAN &&
      remaining <= dmgToDefender && !!attacker && attacker.hp > dmgToAttacker };
}
export function attackTargets(state: GameState, unit: Unit): TileIdx[] {
  if (isCivilian(unit.type)) return [];
  const range = unitDef(unit.type).range ?? 1;
  const targets: TileIdx[] = [];
  for (const tile of tilesInRadius(state.map, unit.tile, range)) if (tile !== unit.tile && previewAttack(state, unit, tile)) targets.push(tile);
  return targets;
}
export function previewAttack(state: GameState, unit: Unit, target: TileIdx): CombatPreview | null {
  return preview(state, unit, null, target);
}
export function resolveAttack(state: GameState, unit: Unit, target: TileIdx, emit: Emit): string | null {
  if (!state.units[unit.id] || unit.hasAttacked || unit.moves <= 0) return 'Unit cannot attack this turn';
  const result = previewAttack(state, unit, target);
  if (!result) return 'Invalid attack target';
  const { unit: defendingUnit, city } = targetAt(state, target, unit.owner);
  const defenderCity = defendingUnit ? null : city;
  const dmgToDefender = Math.max(1, Math.round(result.dmgToDefender * (0.8 + random(state.rng) * 0.4)));
  const dmgToAttacker = result.ranged ? 0 : Math.max(1, Math.round(result.dmgToAttacker * (0.8 + random(state.rng) * 0.4)));
  const actualDefenderDamage = defenderCity && result.ranged ? Math.min(dmgToDefender, Math.max(0, defenderCity.hp - 1)) : dmgToDefender;
  if (defendingUnit) defendingUnit.hp = Math.max(0, defendingUnit.hp - actualDefenderDamage);
  if (defenderCity) defenderCity.hp = Math.max(0, defenderCity.hp - actualDefenderDamage);
  unit.hp = Math.max(0, unit.hp - dmgToAttacker);
  unit.hasAttacked = true;
  unit.moves = unitDef(unit.type).abilities?.includes('moveAfterAttack') ? Math.max(0, unit.moves - 1) : 0;
  unit.order = null;
  unit.fortifyTurns = 0;
  const killed = !!defendingUnit && defendingUnit.hp === 0;
  const died = unit.hp === 0;
  emit({ type: 'combat', attacker: { player: unit.owner, unitId: unit.id, tile: unit.tile },
    defender: { player: defendingUnit?.owner ?? defenderCity!.owner, unitId: defendingUnit?.id, cityId: defenderCity?.id, tile: target },
    ranged: result.ranged, dmgToAttacker, dmgToDefender: actualDefenderDamage, attackerKilled: died,
    defenderKilled: killed || (!!defenderCity && defenderCity.hp === 0) });
  if (defendingUnit && !killed) grantXp(state, defendingUnit, 3, emit);
  if (!died) grantXp(state, unit, 5 + (killed || defenderCity?.hp === 0 ? 5 : 0), emit);
  if (killed) removeUnit(state, defendingUnit.id, emit, unit.owner);
  if (died) removeUnit(state, unit.id, emit, defendingUnit?.owner ?? defenderCity?.owner);
  if (killed && !died) for (const id of unit.promotions) {
    const reward = PROMOTIONS[id]?.onKill;
    if (reward?.gold) addGold(state, unit.owner, reward.gold, 'Promotion: spoils of battle', emit);
    if (reward?.heal) unit.hp = Math.min(100, unit.hp + reward.heal);
    if (reward?.xp) grantXp(state, unit, reward.xp, emit);
  }
  if (!died && defenderCity?.hp === 0) {
    if (unit.owner !== BARBARIAN) captureCity(state, defenderCity, unit.owner, emit);
    else { defenderCity.hp = Math.max(1, defenderCity.maxHp / 4); for (const tile of state.map.tiles) if (tile.cityId === defenderCity.id && tile.improvement && !tile.pillaged) {
      tile.pillaged = true; emit({ type: 'improvementPillaged', tile: tile.idx, by: BARBARIAN }); break;
    } }
  }
  if (!died && !result.ranged && (killed || defenderCity?.owner === unit.owner) && !militaryAt(state, target) &&
    !unitsAt(state, target).some(u => u.owner !== unit.owner)) {
    // Attack is already paid; melee advance should not charge movement again.
    const from = unit.tile;
    unit.tile = target;
    emit({ type: 'unitMoved', unitId: unit.id, player: unit.owner, path: [from, target] });
    onUnitEnteredTile(state, unit, emit);
  }
  return null;
}
export function cityStrikeTargets(state: GameState, city: City): TileIdx[] {
  return tilesInRadius(state.map, city.tile, 2).filter(tile => tile !== city.tile && !!previewCityStrike(state, city, tile));
}
export function previewCityStrike(state: GameState, city: City, target: TileIdx): CombatPreview | null {
  const result = preview(state, null, city, target);
  return result && militaryAt(state, target) ? result : null;
}
export function resolveCityStrike(state: GameState, city: City, target: TileIdx, emit: Emit): string | null {
  if (city.hasStruck) return 'Colony already fired this turn';
  const result = previewCityStrike(state, city, target);
  const defender = militaryAt(state, target);
  if (!result || !defender) return 'Invalid colony strike';
  const dmg = Math.max(1, Math.round(result.dmgToDefender * (0.8 + random(state.rng) * 0.4)));
  defender.hp = Math.max(0, defender.hp - dmg);
  city.hasStruck = true;
  emit({ type: 'combat', attacker: { player: city.owner, cityId: city.id, tile: city.tile },
    defender: { player: defender.owner, unitId: defender.id, tile: target }, ranged: true,
    dmgToAttacker: 0, dmgToDefender: dmg, attackerKilled: false, defenderKilled: defender.hp === 0 });
  if (defender.hp === 0) removeUnit(state, defender.id, emit, city.owner);
  else grantXp(state, defender, 3, emit);
  return null;
}
