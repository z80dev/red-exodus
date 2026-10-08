// OWNER: SimCore. Read-only helpers for UI/renderer. Pure functions of state (never mutate).
import type {
  BuildingId, City, CityFocus, CityId, ElevationId, FeatureId, GameState, ImprovementId, NaturalWonderId, Player,
  PlayerId, ProductionItem, ResourceId, TechId, TerrainId, TileIdx, UnitId, UnitTypeId, WonderId, Yields,
} from './types';
import { BARBARIAN, HUMAN } from './types';
import type { ResourceKind } from './defs';
import {
  BUILDINGS, ELEVATIONS, FEATURES, IMPROVEMENTS, NATURAL_WONDERS, RESOURCES, TECHS, TERRAINS, UNITS, WONDERS,
} from '../content';
import { collectEffects } from './effects';
import {
  borderThreshold, buyCost, citiesOf, cityAt, computeCityYields, emptyYields, growthThreshold, isUnitObsolete,
  productionCost, productionItemName, productionReason, sameItem, tileYields, turnsToComplete,
} from './cities';
import {
  buildingMaintenance, computeHappiness, connectedResources, culturePerTurn, freeUnits, getPlayer, goldPerTurn,
  projectOutput, round1, sciencePerTurn, techCost, techUnlocks, turnsToResearch, unitCount, unitUpkeep,
} from './economy';
import { idleUnits } from './units';
import { stormAt } from './mars';

// ───────────────────────────── result types ─────────────────────────────

export interface TileInfo {
  idx: TileIdx;
  col: number;
  row: number;
  /** false → the human has never seen this tile: only idx/col/row/explored/visible are meaningful (show fog) */
  explored: boolean;
  /** currently in the human's sight (units are only listed when visible) */
  visible: boolean;
  /** "Grassland Hills · Forest" */
  name: string;
  terrain: { id: TerrainId; name: string };
  elevation: { id: ElevationId; name: string };
  feature: { id: FeatureId; name: string } | null;
  water: boolean;
  river: boolean;
  impassable: boolean;
  /** yields as its owner would get them (hooks included when owned by the human) */
  yields: Yields;
  defensePct: number;
  moveCost: number;
  owner: { id: PlayerId; name: string; civName: string; color: string } | null;
  /** city whose territory contains this tile */
  territoryOf: { id: CityId; name: string } | null;
  /** city standing on this tile */
  city: { id: CityId; name: string; owner: PlayerId; pop: number; hp: number; maxHp: number } | null;
  worked: boolean;
  resource: { id: ResourceId; name: string; kind: ResourceKind; improved: boolean; improvement: ImprovementId } | null;
  improvement: { id: ImprovementId; name: string } | null;
  naturalWonder: { id: NaturalWonderId; name: string; description: string } | null;
  units: { id: UnitId; type: UnitTypeId; name: string; owner: PlayerId; hp: number }[];
  camp: boolean;
  ruin: boolean;
  /** dust storm over this tile right now (explored tiles only) */
  storm: { id: number; power: number; great: boolean } | null;
}

export interface YieldLine {
  label: string;
  /** flat contribution (food line for consumption is negative) */
  yields: Partial<Yields>;
  /** percentage modifiers contributed by this source */
  pct?: Partial<Yields>;
  kind: 'center' | 'tiles' | 'specialists' | 'base' | 'population' | 'building' | 'wonder' | 'effect' | 'happiness' | 'consumption';
}

export interface CityBreakdown {
  city: CityId;
  lines: YieldLine[];
  /** flat totals before percentages (food gross) */
  flat: Yields;
  /** summed percentage modifiers */
  pct: Yields;
  /** final yields (food = net surplus after consumption) — equals city.yields */
  total: Yields;
  foodConsumption: number;
  growth: { stored: number; threshold: number; turns: number | null; halted: boolean; starving: boolean };
  production: { item: ProductionItem | null; name: string | null; stored: number; cost: number; turns: number | null };
  borders: { stored: number; threshold: number; turns: number | null };
  worked: TileIdx[];
  specialists: number;
  focus: CityFocus;
}

export type ProductionCategory = 'unit' | 'building' | 'wonder' | 'project';
export interface ProductionOption {
  item: ProductionItem;
  name: string;
  category: ProductionCategory;
  icon: string;
  description: string;
  /** production cost (0 for projects) */
  cost: number;
  /** turns to complete at current production; null for projects or zero production */
  turns: number | null;
  /** gold to buy now; null when not purchasable */
  buyCost: number | null;
  /** null = can be produced now */
  lockedReason: string | null;
  /** already somewhere in the city's queue */
  queued: boolean;
}

export type TechStatus = 'researched' | 'current' | 'available' | 'locked';
export interface TechNode {
  id: TechId;
  name: string;
  era: number;
  pos: { col: number; row: number };
  prereqs: TechId[];
  status: TechStatus;
  cost: number;
  progress: number;
  /** null when researched or no science */
  turns: number | null;
  unlocks: { units: UnitTypeId[]; buildings: BuildingId[]; wonders: WonderId[]; improvements: ImprovementId[]; resources: ResourceId[] };
  description: string;
  /** in the human's current Breakthrough draft */
  offered: boolean;
  icon: string;
}

export interface BreakdownLine { label: string; amount: number }

export interface GoldBreakdown {
  income: BreakdownLine[];
  expenses: BreakdownLine[];
  incomeTotal: number;
  maintenanceTotal: number;
  net: number;
  treasury: number;
  freeUnits: number;
  units: number;
}

export interface EmpireYields {
  food: number;
  prod: number;
  gold: number; // net per turn
  sci: number;
  cul: number;
  treasury: number;
  happiness: number;
  cities: number;
  pop: number;
  research: { tech: TechId; name: string; progress: number; cost: number; turns: number | null } | null;
}

/** the only things End Turn asks about: research not chosen, a colony with nothing to build */
export type Attention = { kind: 'research' } | { kind: 'city'; id: CityId } | null;

export interface RivalSummary {
  id: PlayerId;
  name: string;
  civName: string;
  leaderId: string;
  colors: { primary: string; secondary: string };
  alive: boolean;
  met: boolean;
  personality: string | null;
  cities: number;
  pop: number;
  techs: number;
  military: number;
  wonders: number;
  capital: { id: CityId; name: string; tile: TileIdx } | null;
}

// ───────────────────────────── players & cities ─────────────────────────────

export function humanPlayer(state: GameState): Player {
  return state.players[HUMAN];
}

export function playerById(state: GameState, pid: PlayerId): Player {
  return getPlayer(state, pid);
}

/** the human's cities in founding order */
export function humanCities(state: GameState): City[] {
  return citiesOf(state, HUMAN);
}

// ───────────────────────────── tiles ─────────────────────────────

export function tileInfo(state: GameState, idx: TileIdx): TileInfo {
  const t = state.map.tiles[idx];
  const human = state.players[HUMAN];
  const vis = human.vis[idx] ?? 0;
  const terrain = TERRAINS[t.terrain];
  const elevation = ELEVATIONS[t.elevation];
  const feature = t.feature ? FEATURES[t.feature] : undefined;
  const base: TileInfo = {
    idx, col: t.col, row: t.row, explored: vis > 0, visible: vis === 2, name: 'Unexplored',
    terrain: { id: t.terrain, name: terrain?.name ?? t.terrain },
    elevation: { id: t.elevation, name: elevation?.name ?? t.elevation },
    feature: null, water: false, river: false, impassable: false, yields: emptyYields(), defensePct: 0, moveCost: 0,
    owner: null, territoryOf: null, city: null, worked: false, resource: null, improvement: null, naturalWonder: null,
    units: [], camp: false, ruin: false, storm: null,
  };
  if (vis === 0) return base;

  const parts = [terrain?.name ?? t.terrain];
  if (t.elevation !== 'flat') parts[0] += ` ${elevation?.name ?? t.elevation}`;
  if (feature) parts.push(feature.name);
  base.name = parts.join(' · ');
  base.feature = t.feature && feature ? { id: t.feature, name: feature.name } : null;
  base.water = terrain?.water ?? false;
  base.river = t.riverEdges !== 0;
  base.impassable = !!elevation?.impassable || !!(t.naturalWonder && NATURAL_WONDERS[t.naturalWonder]?.impassable);
  base.yields = tileYields(state, idx, t.owner ?? HUMAN, t.owner === HUMAN ? collectEffects(state, HUMAN) : []);
  base.defensePct = (terrain?.defensePct ?? 0) + (feature?.defensePct ?? 0) + (elevation?.defensePct ?? 0);
  base.moveCost = base.impassable ? Infinity : Math.max(terrain?.moveCost ?? 1, feature?.moveCost ?? 0, elevation?.moveCost ?? 0);

  if (t.owner != null) {
    const o = getPlayer(state, t.owner);
    base.owner = { id: o.id, name: o.name, civName: o.civName, color: o.colors.primary };
  }
  const owningCity = t.cityId != null ? state.cities[t.cityId] : undefined;
  if (owningCity) {
    base.territoryOf = { id: owningCity.id, name: owningCity.name };
    base.worked = owningCity.tile === idx || owningCity.worked.includes(idx);
  }
  const c = cityAt(state, idx);
  if (c) base.city = { id: c.id, name: c.name, owner: c.owner, pop: c.pop, hp: c.hp, maxHp: c.maxHp };

  if (t.resource) {
    const r = RESOURCES[t.resource];
    const revealed = r && (!r.revealTech || human.techs.includes(r.revealTech));
    if (r && revealed) {
      base.resource = {
        id: r.id, name: r.name, kind: r.kind, improvement: r.improvement,
        improved: t.improvement === r.improvement || !!c,
      };
    }
  }
  if (t.improvement) base.improvement = { id: t.improvement, name: IMPROVEMENTS[t.improvement]?.name ?? t.improvement };
  if (t.naturalWonder) {
    const nw = NATURAL_WONDERS[t.naturalWonder];
    base.naturalWonder = { id: t.naturalWonder, name: nw?.name ?? t.naturalWonder, description: nw?.description ?? '' };
  }
  base.camp = t.camp;
  base.ruin = t.ruin;
  const storm = stormAt(state, idx);
  if (storm) base.storm = { id: storm.id, power: storm.power, great: !!storm.great };
  if (vis === 2) {
    for (const id in state.units) {
      const u = state.units[id];
      if (u.tile !== idx) continue;
      base.units.push({ id: u.id, type: u.type, name: UNITS[u.type]?.name ?? u.type, owner: u.owner, hp: u.hp });
    }
    base.units.sort((a, b) => a.id - b.id);
  }
  return base;
}

// ───────────────────────────── city ─────────────────────────────

export function cityBreakdown(state: GameState, city: City): CityBreakdown {
  const lines: YieldLine[] = [];
  const fx = collectEffects(state, city.owner);
  const r = computeCityYields(state, city, fx, { lines: lines as { label: string; kind: string; yields: Partial<Yields>; pct?: Partial<Yields> }[] });
  const player = getPlayer(state, city.owner);
  const threshold = growthThreshold(state, city);
  const halted = r.total.food > 0 && player.happiness < 0;
  const growthTurns = r.total.food > 0 && !halted ? Math.max(1, Math.ceil((threshold - city.foodStored) / r.total.food)) : null;
  const item = city.queue[0] ?? null;
  const cost = item ? productionCost(state, city, item) : 0;
  const prodTurns = item && item.kind !== 'project' && r.total.prod > 0
    ? Math.max(1, Math.ceil((cost - city.prodStored) / r.total.prod)) : null;
  const bThreshold = borderThreshold(state, city);
  const borderTurns = r.total.cul > 0 ? Math.max(1, Math.ceil((bThreshold - city.cultureStored) / r.total.cul)) : null;
  return {
    city: city.id,
    lines,
    flat: r.flat,
    pct: r.pct,
    total: r.total,
    foodConsumption: r.consumption,
    growth: { stored: city.foodStored, threshold, turns: growthTurns, halted, starving: r.total.food < 0 },
    production: { item, name: item ? productionItemName(item) : null, stored: city.prodStored, cost, turns: prodTurns },
    borders: { stored: city.cultureStored, threshold: bThreshold, turns: borderTurns },
    worked: r.worked,
    specialists: r.specialists,
    focus: city.focus,
  };
}

const CATEGORY_ORDER: Record<ProductionCategory, number> = { unit: 0, building: 1, wonder: 2, project: 3 };

export function productionOptions(state: GameState, city: City): ProductionOption[] {
  const player = getPlayer(state, city.owner);
  const conn = connectedResources(state, city.owner);
  const out: ProductionOption[] = [];
  const push = (item: ProductionItem, category: ProductionCategory, icon: string, description: string) => {
    const lockedReason = productionReason(state, city, item, conn);
    const cost = item.kind === 'project' ? 0 : productionCost(state, city, item);
    const t = turnsToComplete(state, city, item);
    out.push({
      item, name: productionItemName(item), category, icon, description, cost,
      turns: Number.isFinite(t) ? t : null,
      buyCost: lockedReason ? null : buyCost(state, city, item),
      lockedReason,
      queued: city.queue.some((q) => sameItem(q, item)),
    });
  };
  for (const id in UNITS) {
    const d = UNITS[id];
    if (d.uniqueTo && d.uniqueTo !== player.leaderId) continue;
    const reason = productionReason(state, city, { kind: 'unit', id }, conn);
    if (reason?.startsWith('Replaced by')) continue;
    if (!reason && isUnitObsolete(state, city, id)) continue;
    push({ kind: 'unit', id }, 'unit', d.icon, d.description);
  }
  for (const id in BUILDINGS) {
    const d = BUILDINGS[id];
    if (id === 'palace' || d.cost <= 0 || city.buildings.includes(id)) continue;
    if (d.uniqueTo && d.uniqueTo !== player.leaderId) continue;
    const reason = productionReason(state, city, { kind: 'building', id }, conn);
    if (reason === 'Already built' || reason?.startsWith('Replaced by')) continue;
    push({ kind: 'building', id }, 'building', d.icon, d.description);
  }
  for (const id in WONDERS) push({ kind: 'wonder', id }, 'wonder', WONDERS[id].icon, WONDERS[id].description);
  push({ kind: 'project', id: 'wealth' }, 'project', 'gold', 'Turn {prod} into {gold} (1 for 1).');
  push({ kind: 'project', id: 'research' }, 'project', 'sci', 'Turn {prod} into {sci} (1 for 1).');
  if (player.isHuman) push({ kind: 'project', id: 'festival' }, 'project', 'renown', 'Turn {prod} into {renown} for the Chapter Report.');
  return out.sort((a, b) =>
    (a.lockedReason ? 1 : 0) - (b.lockedReason ? 1 : 0)
    || CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
    || a.cost - b.cost
    || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// ───────────────────────────── tech ─────────────────────────────

export function techTree(state: GameState, pid: PlayerId = HUMAN): TechNode[] {
  const p = getPlayer(state, pid);
  const known = new Set(p.techs);
  const improvementsByTech: Record<string, ImprovementId[]> = {};
  for (const id in IMPROVEMENTS) {
    const tech = IMPROVEMENTS[id].tech;
    if (tech) (improvementsByTech[tech] ??= []).push(id);
  }
  const resourcesByTech: Record<string, ResourceId[]> = {};
  for (const id in RESOURCES) {
    const tech = RESOURCES[id].revealTech;
    if (tech) (resourcesByTech[tech] ??= []).push(id);
  }
  const sci = sciencePerTurn(state, pid);
  const out: TechNode[] = [];
  for (const id in TECHS) {
    const d = TECHS[id];
    const status: TechStatus = known.has(id) ? 'researched'
      : p.researching === id ? 'current'
      : d.prereqs.every((r) => known.has(r)) ? 'available' : 'locked';
    const cost = techCost(state, pid, id);
    const turns = status === 'researched' || sci <= 0 ? null : turnsToResearch(state, pid, id);
    out.push({
      id, name: d.name, era: d.era, pos: { ...d.pos }, prereqs: [...d.prereqs], status, cost,
      progress: status === 'researched' ? cost : p.researchProgress[id] ?? 0,
      turns: turns != null && Number.isFinite(turns) ? turns : null,
      unlocks: { ...techUnlocks(id, p.leaderId), improvements: improvementsByTech[id] ?? [], resources: resourcesByTech[id] ?? [] },
      description: d.description, icon: d.icon, offered: p.researchOffer.includes(id),
    });
  }
  return out.sort((a, b) => a.era - b.era || a.pos.col - b.pos.col || a.pos.row - b.pos.row);
}

// ───────────────────────────── empire ─────────────────────────────

export function happinessBreakdown(state: GameState, pid: PlayerId = HUMAN): { value: number; lines: BreakdownLine[] } {
  return computeHappiness(state, pid);
}

export function goldBreakdown(state: GameState, pid: PlayerId = HUMAN): GoldBreakdown {
  const p = getPlayer(state, pid);
  const income: BreakdownLine[] = [];
  const expenses: BreakdownLine[] = [];
  for (const c of citiesOf(state, pid)) if (c.yields.gold) income.push({ label: c.name, amount: c.yields.gold });
  const wealth = projectOutput(state, pid, 'wealth');
  if (wealth) income.push({ label: 'Credits projects', amount: round1(wealth) });
  const maint = buildingMaintenance(state, pid);
  if (maint) expenses.push({ label: 'Building upkeep', amount: round1(maint) });
  const units = unitCount(state, pid);
  const free = freeUnits(state, pid);
  const upkeep = unitUpkeep(state, pid);
  if (upkeep) expenses.push({ label: `Unit upkeep (${units - free} over ${free} free)`, amount: upkeep });
  const g = goldPerTurn(state, pid);
  return {
    income, expenses, incomeTotal: g.income, maintenanceTotal: g.maintenance, net: g.net, treasury: p.gold,
    freeUnits: free, units,
  };
}

export function empireYields(state: GameState, pid: PlayerId = HUMAN): EmpireYields {
  const p = getPlayer(state, pid);
  const cities = citiesOf(state, pid);
  const y = emptyYields();
  let pop = 0;
  for (const c of cities) {
    y.food += c.yields.food;
    y.prod += c.yields.prod;
    pop += c.pop;
  }
  let research: EmpireYields['research'] = null;
  if (p.researching && TECHS[p.researching]) {
    const turns = turnsToResearch(state, pid, p.researching);
    research = {
      tech: p.researching,
      name: TECHS[p.researching].name,
      progress: round1((p.researchProgress[p.researching] ?? 0) + (p.counters.sciOverflow ?? 0)),
      cost: techCost(state, pid, p.researching),
      turns: Number.isFinite(turns) ? turns : null,
    };
  }
  return {
    food: round1(y.food),
    prod: round1(y.prod),
    gold: goldPerTurn(state, pid).net,
    sci: sciencePerTurn(state, pid),
    cul: culturePerTurn(state, pid),
    treasury: p.gold,
    happiness: p.happiness,
    cities: cities.length,
    pop,
    research,
  };
}

function needsResearch(state: GameState): boolean {
  const p = state.players[HUMAN];
  return !p.researching && Object.keys(TECHS).some((id) => !p.techs.includes(id) && TECHS[id].prereqs.every((r) => p.techs.includes(r)));
}

/** next thing needing the human's attention: research first, then a colony with an empty build queue */
export function nextAttention(state: GameState): Attention {
  if (needsResearch(state)) return { kind: 'research' };
  const city = citiesOf(state, HUMAN).find((c) => c.queue.length === 0);
  return city ? { kind: 'city', id: city.id } : null;
}

/** how many things End Turn asks about (idle units never count) */
export function attentionCount(state: GameState): number {
  return citiesOf(state, HUMAN).filter((c) => c.queue.length === 0).length + (needsResearch(state) ? 1 : 0);
}

/** optional "next unit" cycling: the next human unit with moves and no order, after `afterUnitId` */
export function nextIdleUnit(state: GameState, afterUnitId?: UnitId): UnitId | null {
  const idle = idleUnits(state, HUMAN).map((u) => u.id).sort((a, b) => a - b);
  if (!idle.length) return null;
  return afterUnitId != null ? idle.find((id) => id > afterUnitId) ?? idle[0] : idle[0];
}

/** summed combat strength of a player's military units (same scale for everyone) */
export function militaryStrength(state: GameState, pid: PlayerId): number {
  let total = 0;
  for (const id in state.units) {
    const u = state.units[id];
    if (u.owner !== pid) continue;
    const d = UNITS[u.type];
    if (d && d.class !== 'civilian') total += Math.max(d.strength, d.rangedStrength ?? 0) * (u.hp / 100);
  }
  return Math.round(total);
}

export function rivalsSummary(state: GameState): RivalSummary[] {
  const human = state.players[HUMAN];
  const out: RivalSummary[] = [];
  for (const p of state.players) {
    if (p.id === HUMAN || p.id === BARBARIAN) continue;
    const cities = citiesOf(state, p.id);
    const military = militaryStrength(state, p.id);
    let met = cities.some((c) => human.vis[c.tile] > 0);
    if (!met) {
      for (const id in state.units) {
        const u = state.units[id];
        if (u.owner === p.id && human.vis[u.tile] === 2) { met = true; break; }
      }
    }
    const cap = p.capitalId != null ? state.cities[p.capitalId] : undefined;
    out.push({
      id: p.id, name: p.name, civName: p.civName, leaderId: p.leaderId, colors: { ...p.colors }, alive: p.alive, met,
      personality: p.ai?.personality ?? null,
      cities: cities.length, pop: cities.reduce((s, c) => s + c.pop, 0), techs: p.techs.length, military,
      wonders: cities.reduce((s, c) => s + c.wonders.length, 0),
      capital: cap && human.vis[cap.tile] > 0 ? { id: cap.id, name: cap.name, tile: cap.tile } : null,
    });
  }
  return out;
}
