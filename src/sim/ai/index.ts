import { BUILDINGS, ELEVATIONS, FEATURES, IMPROVEMENTS, RESOURCES, TECHS, TERRAINS, UNITS, WONDERS } from '../../content';
import { availableProduction, buyCost, canFoundCity, improvementOptions } from '../cities';
import { attackTargets, cityStrikeTargets, previewAttack, previewCityStrike } from '../combat';
import { availableTechs } from '../economy';
import { hexDistance, neighbors, tilesInRadius } from '../hex';
import { findPath, reachableTiles } from '../pathfinding';
import { randInt } from '../rng';
import { councilBuyError, packPickError } from '../roguelite/council';
import type { Action, AiPersonality, City, Emit, GameState, PlayerId, ProductionItem, TileIdx, Unit } from '../types';
import { BARBARIAN, HUMAN, PILLARS } from '../types';
import { isCivilian, militaryAt, createUnit, unitDef } from '../units';
import { applyPlayerAction } from '../engine';
// Planning is a read operation for the human: cache only outside serialized GameState.
const humanSitePlans = new WeakMap<GameState, Record<string, number>>();

function ownCities(state: GameState, pid: PlayerId): City[] { return Object.values(state.cities).filter(c => c.owner === pid); }
function ownUnits(state: GameState, pid: PlayerId): Unit[] { return Object.values(state.units).filter(u => u.owner === pid); }
function enemies(state: GameState, pid: PlayerId): Unit[] {
  return Object.values(state.units).filter(u => u.owner !== pid && (u.owner === BARBARIAN || state.players.find(p => p.id === pid)?.relations[u.owner] === 'war'));
}
function targetCount(state: GameState, persona: AiPersonality): number {
  const base = { small: 4, standard: 6, large: 8 }[state.config.mapSize];
  return base + (persona === 'expansionist' ? 1 : persona === 'warmonger' ? -1 : 0);
}
function siteValue(state: GameState, pid: PlayerId, tile: TileIdx): number {
  const t = state.map.tiles[tile];
  if (!t || t.elevation === 'mountain' || ['ocean', 'coast', 'lake'].includes(t.terrain)) return -Infinity;
  const distances = Object.values(state.cities).map(c => hexDistance(state.map, c.tile, tile));
  if (distances.some(d => d < 3) || canFoundCity(state, pid, tile)) return -Infinity;
  let score = t.riverEdges ? 9 : 0;
  if (neighbors(state.map, tile).some(n => ['coast', 'lake'].includes(state.map.tiles[n].terrain))) score += 6;
  for (const n of tilesInRadius(state.map, tile, 2)) {
    const around = state.map.tiles[n];
    if (around.elevation === 'mountain' || around.terrain === 'ocean') continue;
    const base = TERRAINS[around.terrain]?.yields;
    const elevated = ELEVATIONS[around.elevation]?.yields;
    const feature = around.feature ? FEATURES[around.feature]?.yields : null;
    const resource = around.resource ? RESOURCES[around.resource] : null;
    const distance = hexDistance(state.map, n, tile);
    const food = (base?.food ?? 0) + (elevated?.food ?? 0) + (feature ? feature.food : 0) + (resource ? resource.yields.food : 0);
    const prod = (base?.prod ?? 0) + (elevated?.prod ?? 0) + (feature ? feature.prod : 0) + (resource ? resource.yields.prod : 0);
    const gold = (base?.gold ?? 0) + (resource ? resource.yields.gold : 0);
    score += (food * 1.8 + prod * 1.5 + gold + (resource?.kind === 'luxury' ? 9 : around.resource ? 3 : 0)) / (distance + 1);
  }
  if (distances.length) score += Math.max(-12, 8 - Math.abs(Math.min(...distances) - 4) * 3);
  return score;
}
function bestSite(state: GameState, pid: PlayerId, settler: Unit): TileIdx | null {
  const player = state.players.find(p => p.id === pid)!;
  const visibility = player.vis;
  // Rival plans are written during endTurn dispatch; human autoplay must not mutate GameState.
  let memory = player.ai?.memory;
  if (!memory) {
    memory = humanSitePlans.get(state);
    if (!memory) {
      memory = {};
      humanSitePlans.set(state, memory);
    }
  }
  const key = `site:${settler.id}`;
  const prior = memory[key];
  if (memory[`${key}:turn`] === state.turn && prior !== undefined && !canFoundCity(state, pid, prior))
    return prior;
  const candidates: { tile: TileIdx; score: number }[] = [];
  for (const tile of state.map.tiles) {
    if (visibility?.[tile.idx] === 0) continue;
    const score = siteValue(state, pid, tile.idx) - hexDistance(state.map, settler.tile, tile.idx) * 2;
    if (Number.isFinite(score)) candidates.push({ tile: tile.idx, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.tile - b.tile);
  for (const candidate of candidates) if (candidate.tile === settler.tile || findPath(state, settler, candidate.tile)) {
    memory[key] = candidate.tile;
    memory[`${key}:turn`] = state.turn;
    return candidate.tile;
  }
  return null;
}
/** Follow A* around coastlines and hostile borders, even when the first step increases hex distance. */
function routeStep(state: GameState, unit: Unit, destination: TileIdx): TileIdx | null {
  const path = findPath(state, unit, destination);
  if (!path) return null;
  const reachable = reachableTiles(state, unit);
  let stop: TileIdx | null = null;
  for (const tile of path) {
    if (reachable.some(r => r.tile === tile) && state.map.tiles[tile].elevation !== 'mountain' &&
      !['ocean', 'coast', 'lake'].includes(state.map.tiles[tile].terrain)) stop = tile;
    else if (!Object.values(state.units).some(u => u.tile === tile && u.id !== unit.id && u.owner === unit.owner &&
      isCivilian(u.type) === isCivilian(unit.type))) break;
  }
  return stop;
}
function researchChoice(state: GameState, pid: PlayerId, persona: AiPersonality): string | null {
  const techs = availableTechs(state, pid);
  let best: string | null = null;
  let score = -Infinity;
  for (const id of techs) {
    const tech = TECHS[id];
    if (!tech) continue;
    let value = 12 - tech.cost * 0.035 + Math.max(0, state.run.era - tech.era) * 6;
    for (const u of Object.values(UNITS)) if (u.tech === id) value += persona === 'warmonger' ? 6 : 2;
    for (const b of Object.values(BUILDINGS)) if (b.tech === id) value += persona === 'builder' ? 4 : 1.5;
    for (const w of Object.values(WONDERS)) if (w.tech === id) value += persona === 'builder' ? 5 : 1;
    if (id === 'sailing' && state.turn < 25) value += 8;
    if (persona === 'scientist' && ['writing', 'education', 'scientific_method', 'electricity'].includes(id)) value += 12;
    if (value > score) { score = value; best = id; }
  }
  return best;
}
function threats(state: GameState, pid: PlayerId, city: City): number {
  return enemies(state, pid).filter(u => hexDistance(state.map, u.tile, city.tile) <= 4).length;
}
function productionChoice(state: GameState, pid: PlayerId, city: City, persona: AiPersonality): ProductionItem | null {
  const options = availableProduction(state, city);
  const available = (kind: ProductionItem['kind'], id: string) => options.find(item => item.kind === kind && item.id === id);
  const cities = ownCities(state, pid);
  const units = ownUnits(state, pid);
  const military = units.filter(u => !isCivilian(u.type));
  const defenders = military.filter(u => hexDistance(state.map, city.tile, u.tile) <= 3).length;
  const danger = threats(state, pid, city);
  if (danger && !city.buildings.includes('walls') && available('building', 'walls')) return available('building', 'walls')!;
  if (danger > defenders && available('unit', 'warrior')) {
    const combat = options.filter(o => o.kind === 'unit' && !isCivilian(o.id) && !['scout'].includes(o.id));
    return combat.sort((a, b) => UNITS[b.id].strength - UNITS[a.id].strength)[0] ?? available('unit', 'warrior')!;
  }
  const settlers = units.filter(u => u.type === 'settler').length + cities.filter(c => c.queue[0]?.kind === 'unit' && c.queue[0].id === 'settler').length;
  if (cities.length + settlers < targetCount(state, persona) && cities.length < 2 + state.turn / 12 && city.pop >= 2 && available('unit', 'settler'))
    return available('unit', 'settler')!;
  if (military.length < Math.max(2, Math.ceil(cities.length * (persona === 'warmonger' ? 2.1 : 1.2)))) {
    const types = options.filter(o => o.kind === 'unit' && !isCivilian(o.id) && o.id !== 'scout');
    types.sort((a, b) => (UNITS[b.id].strength + (UNITS[b.id].rangedStrength ?? 0) - UNITS[b.id].cost / 15) -
      (UNITS[a.id].strength + (UNITS[a.id].rangedStrength ?? 0) - UNITS[a.id].cost / 15));
    if (types[0]) return types[0];
  }
  if (state.turn < 35 && !units.some(u => unitDef(u.type).class === 'recon') && available('unit', 'scout')) return available('unit', 'scout')!;
  if (persona === 'builder') {
    const wonder = options.find(o => o.kind === 'wonder' && !Object.values(state.cities).some(c => c.queue[0]?.id === o.id));
    if (wonder && !danger) return wonder;
  }
  const desired = persona === 'scientist' ? ['library', 'university', 'granary', 'market', 'workshop'] :
    ['granary', 'workshop', 'market', 'library', 'temple', 'aqueduct'];
  for (const id of desired) if (available('building', id)) return available('building', id)!;
  return options.find(o => o.kind === 'building') ?? options.find(o => o.kind === 'unit') ?? { kind: 'project', id: persona === 'scientist' ? 'research' : 'wealth' };
}
function bestAttack(state: GameState, unit: Unit): TileIdx | null {
  let best: TileIdx | null = null;
  let score = -Infinity;
  for (const tile of attackTargets(state, unit)) {
    const p = previewAttack(state, unit, tile);
    if (!p) continue;
    const enemy = militaryAt(state, tile);
    const value = p.dmgToDefender - p.dmgToAttacker * (unit.hp < 50 ? 2.5 : 1.1) +
      (p.defenderKillLikely ? 50 : 0) + (p.captures ? 120 : 0) + (enemy?.type === 'settler' ? 40 : 0) +
      (unitDef(unit.type).rangedStrength ? 6 : 0);
    if (value > score) { score = value; best = tile; }
  }
  return score >= (unit.hp < 35 ? 35 : 3) ? best : null;
}
function unitAction(state: GameState, pid: PlayerId, unit: Unit, persona: AiPersonality): Action | null {
  if (unit.promotionChoices?.length) return { type: 'promote', unitId: unit.id, promotion: unit.promotionChoices[0] };
  if (unit.moves <= 0 || unit.hasAttacked && !unitDef(unit.type).abilities?.includes('moveAfterAttack')) return null;
  if (unit.type === 'settler') {
    if (!canFoundCity(state, pid, unit.tile) && ownCities(state, pid).length < targetCount(state, persona)) return { type: 'foundCity', unitId: unit.id };
    const site = bestSite(state, pid, unit);
    if (site != null && site !== unit.tile) {
      const step = routeStep(state, unit, site);
      if (step != null) return { type: 'moveUnit', unitId: unit.id, to: step };
    }
    return { type: 'skipUnit', unitId: unit.id };
  }
  const def = unitDef(unit.type);
  const city = ownCities(state, pid).sort((a, b) => hexDistance(state.map, a.tile, unit.tile) - hexDistance(state.map, b.tile, unit.tile))[0];
  const danger = city && threats(state, pid, city);
  if (unit.hp < 40 && !enemies(state, pid).some(e => hexDistance(state.map, e.tile, unit.tile) <= 1))
    return unit.order?.kind === 'heal' ? null : { type: 'unitOrder', unitId: unit.id, order: { kind: 'heal' } };
  if (!unit.hasAttacked) { const attack = bestAttack(state, unit); if (attack !== null) return { type: 'attack', unitId: unit.id, target: attack }; }
  if (unit.hp < 45) {
    const retreat = reachableTiles(state, unit).filter(t => state.map.tiles[t.tile].owner === pid)
      .sort((a, b) => (city ? hexDistance(state.map, a.tile, city.tile) - hexDistance(state.map, b.tile, city.tile) : 0))[0];
    if (retreat) return { type: 'moveUnit', unitId: unit.id, to: retreat.tile };
    return unit.order?.kind === 'heal' ? null : { type: 'unitOrder', unitId: unit.id, order: { kind: 'heal' } };
  }
  let target: number | null = null;
  const active = enemies(state, pid);
  if (danger && city) target = city.tile;
  else if (def.class === 'recon') {
    let best = -Infinity;
    for (const step of reachableTiles(state, unit)) {
      const tile = state.map.tiles[step.tile];
      if (tile.elevation === 'mountain' || ['ocean', 'coast', 'lake'].includes(tile.terrain)) continue;
      const hidden = tilesInRadius(state.map, step.tile, 2).filter(n => state.players.find(p => p.id === pid)?.vis[n] === 0).length;
      if (hidden === 0 && !tile.ruin) continue;
      const score = (tile.ruin ? 60 : 0) + hidden * 3 - step.cost;
      if (score > best) { best = score; target = step.tile; }
    }
  } else {
    const settler = ownUnits(state, pid).find(u => u.type === 'settler' && !militaryAt(state, u.tile));
    if (settler && hexDistance(state.map, unit.tile, settler.tile) < 9) target = settler.tile;
    else {
      const targetEnemy = active.filter(u => u.owner !== BARBARIAN || u.hp < 90).sort((a, b) => hexDistance(state.map, unit.tile, a.tile) - hexDistance(state.map, unit.tile, b.tile))[0];
      const rivalCity = Object.values(state.cities).filter(c => c.owner !== pid &&
        state.players.find(p => p.id === pid)?.relations[c.owner] === 'war')
        .sort((a, b) => hexDistance(state.map, unit.tile, a.tile) - hexDistance(state.map, unit.tile, b.tile))[0];
      if (targetEnemy && hexDistance(state.map, unit.tile, targetEnemy.tile) <= (persona === 'warmonger' ? 12 : 7)) target = targetEnemy.tile;
      else if (rivalCity && hexDistance(state.map, unit.tile, rivalCity.tile) <= (persona === 'warmonger' ? 16 : 9)) target = rivalCity.tile;
      else {
        const camp = state.map.tiles.filter(t => t.camp).sort((a, b) => hexDistance(state.map, unit.tile, a.idx) - hexDistance(state.map, unit.tile, b.idx))[0];
        if (camp && hexDistance(state.map, unit.tile, camp.idx) < 12) target = camp.idx;
        else if (city) target = city.tile;
      }
    }
  }
  if (target != null && target !== unit.tile) {
    const reachable = reachableTiles(state, unit);
    const choices = reachable.filter(t => hexDistance(state.map, t.tile, target!) < hexDistance(state.map, unit.tile, target!));
    choices.sort((a, b) => hexDistance(state.map, a.tile, target!) - hexDistance(state.map, b.tile, target!) || a.cost - b.cost);
    if (choices[0]) return { type: 'moveUnit', unitId: unit.id, to: choices[0].tile };
    const detour = routeStep(state, unit, target);
    if (detour != null) return { type: 'moveUnit', unitId: unit.id, to: detour };
  }
  return unit.order?.kind === 'fortify' ? null : { type: 'unitOrder', unitId: unit.id, order: { kind: 'fortify' } };
}
function cityAction(state: GameState, pid: PlayerId, city: City, persona: AiPersonality): Action | null {
  if (!city.hasStruck) {
    const target = cityStrikeTargets(state, city).sort((a, b) =>
      (previewCityStrike(state, city, b)?.defenderKillLikely ? 100 : 0) - (previewCityStrike(state, city, a)?.defenderKillLikely ? 100 : 0))[0];
    if (target !== undefined) return { type: 'cityStrike', cityId: city.id, target };
  }
  if (!city.queue.length || (city.queue[0].kind === 'project' && city.queue[0].id !== 'festival')) {
    const item = productionChoice(state, pid, city, persona);
    if (item && (city.queue[0]?.kind !== item.kind || city.queue[0]?.id !== item.id)) return { type: 'setProduction', cityId: city.id, item };
  }
  return null;
}
function improveAction(state: GameState, pid: PlayerId): Action | null {
  const player = state.players.find(p => p.id === pid)!;
  let best: { tile: TileIdx; improvement: string; score: number } | null = null;
  for (const tile of state.map.tiles) {
    if (tile.owner !== pid || tile.improvement && !tile.pillaged) continue;
    const city = tile.cityId != null && state.cities[tile.cityId];
    if (!city || hexDistance(state.map, city.tile, tile.idx) > 2) continue;
    for (const option of improvementOptions(state, pid, tile.idx)) {
      if (option.error || option.cost > player.gold - 25) continue;
      const gains = IMPROVEMENTS[option.id]?.yields;
      const value = (gains?.food ?? 0) * 3 + (gains?.prod ?? 0) * 3 + (gains?.gold ?? 0) * 2 +
        (gains?.sci ?? 0) * 3 + (tile.resource ? 9 : 0) + (city.worked.includes(tile.idx) ? 6 : 0) - option.cost / 12;
      if (!best || value > best.score) best = { tile: tile.idx, improvement: option.id, score: value };
    }
  }
  return best && best.score > 0 ? { type: 'buildImprovement', tile: best.tile, improvement: best.improvement } : null;
}
function decision(state: GameState, pid: PlayerId, persona: AiPersonality): Action | null {
  const player = state.players.find(p => p.id === pid);
  if (!player?.alive) return null;
  if (!player.researching) { const tech = researchChoice(state, pid, persona); if (tech) return { type: 'setResearch', tech }; }
  for (const city of ownCities(state, pid)) {
    const action = cityAction(state, pid, city, persona);
    if (action) return action;
  }
  for (const unit of ownUnits(state, pid).sort((a, b) => (unitDef(b.type).rangedStrength ? 1 : 0) - (unitDef(a.type).rangedStrength ? 1 : 0))) {
    if (unit.order?.kind === 'goto' || unit.order?.kind === 'explore' || unit.order?.kind === 'sleep' ||
      unit.order?.kind === 'fortify' && !enemies(state, pid).some(e => hexDistance(state.map, e.tile, unit.tile) <= 3)) continue;
    const action = unitAction(state, pid, unit, persona);
    if (action) return action;
  }
  if (player.gold > 55) {
    const city = ownCities(state, pid).find(c => threats(state, pid, c) > 1);
    if (city) {
      const item = productionChoice(state, pid, city, persona);
      if (item?.kind === 'unit' && buyCost(state, city, item) !== null && buyCost(state, city, item)! <= player.gold) return { type: 'buyItem', cityId: city.id, item };
    }
    return improveAction(state, pid);
  }
  return null;
}
function power(state: GameState, pid: PlayerId): number {
  return ownUnits(state, pid).reduce((n, u) => n + (isCivilian(u.type) ? 0 : unitDef(u.type).strength * u.hp / 100), 0) + ownCities(state, pid).length * 8;
}
export function aiAcceptsPeace(state: GameState, aiPid: PlayerId, fromPid: PlayerId): boolean {
  const ai = state.players.find(p => p.id === aiPid);
  if (!ai?.alive || ai.relations[fromPid] !== 'war') return false;
  return power(state, aiPid) < power(state, fromPid) * 0.8 ||
    state.turn - (ai.counters[`war:${fromPid}`] ?? state.turn) >= 15 ||
    (fromPid === HUMAN && power(state, HUMAN) >= power(state, aiPid) * 1.3);
}
function diplomacy(state: GameState, pid: PlayerId, emit: Emit): void {
  const player = state.players.find(p => p.id === pid)!;
  const myCities = ownCities(state, pid);
  for (const rival of state.players) {
    if (rival.id === pid || rival.id === BARBARIAN || !rival.alive) continue;
    if (player.relations[rival.id] === 'war') {
      if (aiAcceptsPeace(state, pid, rival.id)) applyPlayerAction(state, pid, { type: 'offerPeace', target: rival.id }, emit);
      continue;
    }
    const rivalCities = ownCities(state, rival.id);
    const border = myCities.some(a => rivalCities.some(b => hexDistance(state.map, a.tile, b.tile) < 7));
    const pressure = myCities.some(a => rivalCities.some(b => hexDistance(state.map, a.tile, b.tile) < 5));
    const relativePower = power(state, pid) / Math.max(1, power(state, rival.id));
    if (border && (player.ai?.personality === 'warmonger' && relativePower > 1.2 ||
      pressure && relativePower > 1.4 ||
      (player.counters[`provoked:${rival.id}`] ?? 0) > 0 && relativePower > 0.85)) {
      applyPlayerAction(state, pid, { type: 'declareWar', target: rival.id }, emit);
    }
  }
}
export function runAiTurn(state: GameState, pid: PlayerId, emit: Emit): void {
  if (!state.players.find(p => p.id === pid)?.alive) return;
  diplomacy(state, pid, emit);
  const persona = state.players.find(p => p.id === pid)?.ai?.personality ?? 'builder';
  // Each unit can move once or twice, each city once; invalid commands never stall a whole turn.
  const attempts = new Set<string>();
  for (let i = 0; i < ownUnits(state, pid).length * 4 + ownCities(state, pid).length * 4 + 16; i++) {
    const action = decision(state, pid, persona);
    if (!action) break;
    const key = JSON.stringify(action);
    if (attempts.has(key)) {
      if ('unitId' in action && typeof action.unitId === 'number') { applyPlayerAction(state, pid, { type: 'skipUnit', unitId: action.unitId }, emit); continue; }
      break;
    }
    attempts.add(key);
    const error = applyPlayerAction(state, pid, action, emit);
    if (error && 'unitId' in action && typeof action.unitId === 'number') applyPlayerAction(state, pid, { type: 'skipUnit', unitId: action.unitId }, emit);
    else if (error) break;
  }
}
const BARB_TYPES = ['warrior', 'spearman', 'horseman', 'swordsman', 'man_at_arms', 'musketman', 'rifleman', 'infantry'];
export function runBarbarians(state: GameState, emit: Emit): void {
  const era = Math.min(5, state.run.era);
  const camps = state.map.tiles.filter(t => t.camp);
  const interval = Math.max(4, 8 - Math.floor(era / 2));
  if (state.turn > 0 && state.turn % interval === 0 && camps.length < 2 + era) {
    const sites = state.map.tiles.filter(t => !t.camp && !t.ruin && !t.owner &&
      !['ocean', 'coast', 'lake'].includes(t.terrain) && t.elevation !== 'mountain' &&
      state.players.every(p => p.id === BARBARIAN || p.vis[t.idx] !== 2) &&
      Object.values(state.cities).every(c => hexDistance(state.map, c.tile, t.idx) >= 5) &&
      !militaryAt(state, t.idx));
    if (sites.length) {
      const tile = sites[randInt(state.rng, sites.length)];
      tile.camp = true;
      emit({ type: 'campSpawned', tile: tile.idx });
      camps.push(tile);
    }
  }
  for (const camp of camps) {
    const defenders = ownUnits(state, BARBARIAN).filter(u => hexDistance(state.map, u.tile, camp.idx) <= 5);
    if ((state.turn + camp.idx) % (7 - Math.min(2, era)) === 0 && defenders.length < 3) {
      const type = BARB_TYPES[Math.min(BARB_TYPES.length - 1, era + (randInt(state.rng, 2) ? 0 : 1))];
      createUnit(state, BARBARIAN, UNITS[type] ? type : 'warrior', camp.idx, emit);
    }
  }
  for (const unit of ownUnits(state, BARBARIAN)) {
    if (unit.moves <= 0) continue;
    const foes = Object.values(state.units).filter(u => u.owner !== BARBARIAN);
    const immediate = foes.filter(u => hexDistance(state.map, u.tile, unit.tile) <= (unitDef(unit.type).range ?? 1));
    if (immediate.length) {
      const target = immediate.sort((a, b) => a.hp - b.hp)[0];
      if (applyPlayerAction(state, BARBARIAN, { type: 'attack', unitId: unit.id, target: target.tile }, emit) === null) continue;
    }
    const city = Object.values(state.cities).filter(c => hexDistance(state.map, c.tile, unit.tile) <=
      (unitDef(unit.type).range ?? 1)).sort((a, b) => a.hp - b.hp)[0];
    if (city && applyPlayerAction(state, BARBARIAN, { type: 'attack', unitId: unit.id, target: city.tile }, emit) === null) continue;
    const tile = state.map.tiles[unit.tile];
    if (tile.improvement && !tile.pillaged) { applyPlayerAction(state, BARBARIAN, { type: 'pillage', unitId: unit.id }, emit); continue; }
    const nearest = [...foes.map(u => u.tile), ...Object.values(state.cities).map(c => c.tile),
      ...state.map.tiles.filter(t => t.improvement && !t.pillaged).map(t => t.idx)]
      .sort((a, b) => hexDistance(state.map, a, unit.tile) - hexDistance(state.map, b, unit.tile))[0];
    if (nearest !== undefined && nearest !== unit.tile) {
      const move = reachableTiles(state, unit).filter(t => hexDistance(state.map, t.tile, nearest) < hexDistance(state.map, unit.tile, nearest))
        .sort((a, b) => hexDistance(state.map, a.tile, nearest) - hexDistance(state.map, b.tile, nearest))[0];
      if (move) applyPlayerAction(state, BARBARIAN, { type: 'moveUnit', unitId: unit.id, to: move.tile }, emit);
    }
  }
}
export function autoplayNextAction(state: GameState): Action | null {
  const phase = state.run.phase;
  if (phase === 'crisisReveal') return { type: 'ackCrisis' };
  if (phase === 'chapterStart') {
    const stats = state.run.stats;
    const cities = ownCities(state, HUMAN);
    const turns = state.run.chapterLength || 6;
    const flow = cities.reduce((total, c) => ({
      culture: total.culture + c.yields.cul, science: total.science + c.yields.sci,
      gold: total.gold + c.yields.gold, food: total.food + Math.max(0, c.yields.food - c.pop * 2),
      production: total.production + c.yields.prod,
    }), { culture: 0, science: 0, gold: 0, food: 0, production: 0 });
    const scores = [
      stats.culture + flow.culture * turns,
      (stats.science + flow.science * turns) * 0.6 + (stats.techs + (flow.science * turns > 20 ? 1 : 0)) * 30,
      (stats.gold + Math.max(0, flow.gold + 2) * turns) * 0.6,
      stats.kills * 25 + stats.citiesCaptured * 150 + stats.campsCleared * 60 +
        (state.map.tiles.some(t => t.camp && ownUnits(state, HUMAN).some(u => !isCivilian(u.type) && hexDistance(state.map, t.idx, u.tile) < 5)) ? 60 : 0),
      stats.popGrown * 15 + stats.citiesFounded * 80 + stats.improvements * 10 +
        Math.floor(flow.food * turns / 12) * 15 + ownUnits(state, HUMAN).filter(u => u.type === 'settler').length * 75,
      stats.buildings * 20 + stats.wonders * 200 + Math.floor(flow.production * turns / 45) * 20,
    ];
    const focus = PILLARS.reduce((best, p, i) => scores[i] * state.run.pillarLevels[p] > scores[PILLARS.indexOf(best)] * state.run.pillarLevels[best] ? p : best, PILLARS[0]);
    return { type: 'chooseChapterStart', focus, omen: state.run.omenOffer[0] ?? null };
  }
  if (phase === 'chronicle') return { type: 'ackChronicle' };
  if (phase === 'council') {
    const council = state.run.council;
    if (council?.pack) {
      const pick = council.pack.options.findIndex((_, i) => packPickError(state, i) === null);
      return { type: 'packPick', index: pick < 0 ? null : pick };
    }
    const slot = council?.items.findIndex((item, i) => item && councilBuyError(state, i) === null &&
      (item.kind === 'scroll' || item.kind === 'doctrine' && state.run.doctrines.length < state.run.doctrineSlots ||
        item.kind === 'reform' || item.kind === 'pack' && state.run.doctrines.length < state.run.doctrineSlots)) ?? -1;
    return slot >= 0 ? { type: 'councilBuy', slot } : { type: 'leaveCouncil' };
  }
  if (phase !== 'playing') return null;
  return decision(state, HUMAN, 'expansionist');
}
