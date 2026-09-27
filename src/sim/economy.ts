// OWNER: SimCore. Empire-level economy: happiness, gold, science, culture, research, resources.
import type { ActiveEffect } from './effects';
import type { Emit, GameState, Player, PlayerId, ResourceId, TechId } from './types';
import { BARBARIAN } from './types';
import {
  ASCENSIONS, BUILDINGS, CRISES, DOCTRINES, LEADERS, NATURAL_WONDERS, REFORMS, RESOURCES, TECHS, UNITS, WONDERS,
} from '../content';
import { collectEffects, makeCtx, runHook } from './effects';
import { citiesOf } from './cities';

// ───────────────────────────── tunables ─────────────────────────────
export const HAPPINESS_BASE = 5;
export const HAPPINESS_PER_CITY = -1;
/** −1 happiness per this many citizens empire-wide */
export const POP_PER_UNHAPPY = 2;
/** default happiness from each distinct connected luxury (ResourceDef.happiness overrides) */
export const LUXURY_HAPPINESS = 4;
/** unit upkeep: this many units are free, +1 per city */
export const FREE_UNITS_BASE = 3;
export const FREE_UNITS_PER_CITY = 1;
export const UNIT_UPKEEP = 1;
/** base research cost per tech era; scaled by (1 + TECH_COST_PER_KNOWN × techs known) */
export const ERA_TECH_COST = [30, 75, 150, 280, 460, 700] as const;
export const TECH_COST_PER_KNOWN = 0.06;

const NOOP: Emit = () => {};

/** round to one decimal — keeps yields/gold readable and free of float dust */
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function getPlayer(state: GameState, pid: PlayerId): Player {
  if (pid === BARBARIAN) return state.players[state.players.length - 1];
  return state.players[pid];
}

/** display name for an effect source (used by breakdown lines) */
export function effectLabel(fx: ActiveEffect): string {
  switch (fx.kind) {
    case 'leader': return LEADERS[fx.id]?.name ?? 'Leader';
    case 'doctrine': return DOCTRINES[fx.id]?.name ?? 'Doctrine';
    case 'crisis': return CRISES[fx.id]?.name ?? 'Crisis';
    case 'reform': return REFORMS[fx.id]?.name ?? 'Reform';
    case 'wonder': return WONDERS[fx.id]?.name ?? 'Wonder';
    case 'building': return BUILDINGS[fx.id]?.name ?? 'Building';
    case 'naturalWonder': return NATURAL_WONDERS[fx.id]?.name ?? 'Natural Wonder';
    case 'ascension': return ASCENSIONS.find((a) => String(a.level) === fx.id)?.name ?? `Ascension ${fx.id}`;
    case 'darkAge': return 'Dark Age';
    default: return fx.id;
  }
}

// ───────────────────────────── resources ─────────────────────────────

/** resources the player has connected: improved (unpillaged) source or on a city center, inside own territory */
export function connectedResources(state: GameState, pid: PlayerId): Set<ResourceId> {
  const out = new Set<ResourceId>();
  for (const t of state.map.tiles) {
    if (t.owner !== pid || !t.resource) continue;
    const def = RESOURCES[t.resource];
    if (!def) continue;
    const onCenter = t.cityId != null && state.cities[t.cityId]?.tile === t.idx;
    if (onCenter || (t.improvement === def.improvement && !t.pillaged)) out.add(t.resource);
  }
  return out;
}

export function hasResource(state: GameState, pid: PlayerId, res: ResourceId): boolean {
  const def = RESOURCES[res];
  if (!def) return false;
  for (const t of state.map.tiles) {
    if (t.owner !== pid || t.resource !== res) continue;
    if (t.improvement === def.improvement && !t.pillaged) return true;
    if (t.cityId != null && state.cities[t.cityId]?.tile === t.idx) return true;
  }
  return false;
}

// ───────────────────────────── happiness ─────────────────────────────

export function computeHappiness(state: GameState, pid: PlayerId, fx?: ActiveEffect[]): { value: number; lines: { label: string; amount: number }[] } {
  const lines: { label: string; amount: number }[] = [];
  if (pid === BARBARIAN) return { value: 0, lines };
  const cities = citiesOf(state, pid);
  lines.push({ label: 'Base contentment', amount: HAPPINESS_BASE });
  if (cities.length) lines.push({ label: `Cities (${cities.length})`, amount: HAPPINESS_PER_CITY * cities.length });
  const pop = cities.reduce((s, c) => s + c.pop, 0);
  const popUnhappy = Math.floor(pop / POP_PER_UNHAPPY);
  if (popUnhappy) lines.push({ label: `Population (${pop})`, amount: -popUnhappy });

  for (const res of connectedResources(state, pid)) {
    const def = RESOURCES[res];
    if (def?.kind !== 'luxury') continue;
    lines.push({ label: def.name, amount: def.happiness ?? LUXURY_HAPPINESS });
  }
  for (const c of cities) {
    for (const b of c.buildings) {
      const h = BUILDINGS[b]?.happiness ?? 0;
      if (h) lines.push({ label: `${BUILDINGS[b].name} (${c.name})`, amount: h });
    }
    for (const w of c.wonders) {
      const h = WONDERS[w]?.happiness ?? 0;
      if (h) lines.push({ label: WONDERS[w].name, amount: h });
    }
  }
  for (const nw of state.naturalWondersSeen[pid] ?? []) {
    const h = NATURAL_WONDERS[nw]?.happiness ?? 0;
    if (h) lines.push({ label: NATURAL_WONDERS[nw].name, amount: h });
  }
  let value = lines.reduce((s, l) => s + l.amount, 0);
  // hooks, one effect at a time so each source gets its own labelled line
  const list = fx ?? collectEffects(state, pid);
  for (const f of list) {
    if (!f.hooks.happiness) continue;
    const s = { value };
    f.hooks.happiness(makeCtx(state, pid, f, NOOP), s);
    const delta = round1(s.value - value);
    if (delta) lines.push({ label: effectLabel(f), amount: delta });
    value = s.value;
  }
  return { value: Math.round(value), lines };
}

/** recompute & cache player.happiness; emits happinessChanged when it changes */
export function updateHappiness(state: GameState, pid: PlayerId, emit: Emit, fx?: ActiveEffect[]): number {
  const p = getPlayer(state, pid);
  if (!p || pid === BARBARIAN) return 0;
  const { value } = computeHappiness(state, pid, fx);
  if (value !== p.happiness) {
    p.happiness = value;
    emit({ type: 'happinessChanged', player: pid, value });
  }
  return value;
}

// ───────────────────────────── gold / science / culture ─────────────────────────────

export function unitCount(state: GameState, pid: PlayerId): number {
  let n = 0;
  for (const id in state.units) if (state.units[id].owner === pid) n++;
  return n;
}

export function freeUnits(state: GameState, pid: PlayerId): number {
  return FREE_UNITS_BASE + FREE_UNITS_PER_CITY * citiesOf(state, pid).length;
}

export function unitUpkeep(state: GameState, pid: PlayerId): number {
  if (pid === BARBARIAN) return 0;
  return Math.max(0, unitCount(state, pid) - freeUnits(state, pid)) * UNIT_UPKEEP;
}

export function buildingMaintenance(state: GameState, pid: PlayerId): number {
  let m = 0;
  for (const c of citiesOf(state, pid)) for (const b of c.buildings) m += BUILDINGS[b]?.maintenance ?? 0;
  return m;
}

/** production converted by the wealth / research projects this turn */
export function projectOutput(state: GameState, pid: PlayerId, project: 'wealth' | 'research'): number {
  let n = 0;
  for (const c of citiesOf(state, pid)) {
    const it = c.queue[0];
    if (it?.kind === 'project' && it.id === project) n += Math.max(0, c.yields.prod);
  }
  return n;
}

export function goldPerTurn(state: GameState, pid: PlayerId): { income: number; maintenance: number; net: number } {
  if (pid === BARBARIAN) return { income: 0, maintenance: 0, net: 0 };
  let income = projectOutput(state, pid, 'wealth');
  for (const c of citiesOf(state, pid)) income += c.yields.gold;
  const maintenance = buildingMaintenance(state, pid) + unitUpkeep(state, pid);
  income = round1(income);
  return { income, maintenance: round1(maintenance), net: round1(income - maintenance) };
}

export function sciencePerTurn(state: GameState, pid: PlayerId): number {
  if (pid === BARBARIAN) return 0;
  let s = projectOutput(state, pid, 'research');
  for (const c of citiesOf(state, pid)) s += c.yields.sci;
  return round1(Math.max(0, s));
}

export function culturePerTurn(state: GameState, pid: PlayerId): number {
  if (pid === BARBARIAN) return 0;
  let s = 0;
  for (const c of citiesOf(state, pid)) s += c.yields.cul;
  return round1(Math.max(0, s));
}

export function addGold(state: GameState, pid: PlayerId, delta: number, reason: string, emit: Emit): void {
  const p = getPlayer(state, pid);
  if (!p || !Number.isFinite(delta) || delta === 0) return;
  p.gold = round1(p.gold + delta);
  emit({ type: 'goldChanged', player: pid, delta: round1(delta), reason });
}

// ───────────────────────────── research ─────────────────────────────

export function techCost(state: GameState, pid: PlayerId, tech: TechId): number {
  const def = TECHS[tech];
  if (!def) return Infinity;
  const p = getPlayer(state, pid);
  const era = Math.max(0, Math.min(ERA_TECH_COST.length - 1, def.era));
  const args = {
    city: null,
    item: { kind: 'tech' as const, id: tech },
    currency: 'sci' as const,
    cost: ERA_TECH_COST[era] * (1 + TECH_COST_PER_KNOWN * p.techs.length),
  };
  runHook(state, pid, 'cost', NOOP, null, args);
  return Math.max(1, Math.round(args.cost));
}

function techOrder(a: TechId, b: TechId): number {
  const da = TECHS[a];
  const db = TECHS[b];
  return da.era - db.era || da.pos.col - db.pos.col || da.pos.row - db.pos.row || (a < b ? -1 : a > b ? 1 : 0);
}

export function availableTechs(state: GameState, pid: PlayerId): TechId[] {
  const p = getPlayer(state, pid);
  const known = new Set(p.techs);
  const out: TechId[] = [];
  for (const id in TECHS) {
    if (known.has(id)) continue;
    if (TECHS[id].prereqs.every((r) => known.has(r))) out.push(id);
  }
  return out.sort(techOrder);
}

export function turnsToResearch(state: GameState, pid: PlayerId, tech: TechId): number {
  const p = getPlayer(state, pid);
  const remaining = techCost(state, pid, tech) - (p.researchProgress[tech] ?? 0) - (p.counters.sciOverflow ?? 0);
  if (remaining <= 0) return 1;
  const sci = sciencePerTurn(state, pid);
  return sci > 0 ? Math.ceil(remaining / sci) : Infinity;
}

export function grantTech(state: GameState, pid: PlayerId, tech: TechId, emit: Emit): void {
  const p = getPlayer(state, pid);
  if (!TECHS[tech] || p.techs.includes(tech)) return;
  p.techs.push(tech);
  delete p.researchProgress[tech];
  if (p.researching === tech) p.researching = null;
  emit({ type: 'techResearched', player: pid, tech });
}

/** apply one turn of science: progress (+ stored overflow) toward the current tech; at most one tech per turn */
export function processResearch(state: GameState, pid: PlayerId, science: number, emit: Emit): void {
  const p = getPlayer(state, pid);
  if (!p.researching && !p.isHuman) p.researching = availableTechs(state, pid)[0] ?? null;
  const pool = science + (p.counters.sciOverflow ?? 0);
  const tech = p.researching;
  if (!tech) {
    p.counters.sciOverflow = round1(pool);
    return;
  }
  const progress = round1((p.researchProgress[tech] ?? 0) + pool);
  const cost = techCost(state, pid, tech);
  p.counters.sciOverflow = 0;
  if (progress >= cost) {
    p.counters.sciOverflow = round1(progress - cost);
    grantTech(state, pid, tech, emit);
    if (!p.isHuman) p.researching = availableTechs(state, pid)[0] ?? null;
  } else {
    p.researchProgress[tech] = progress;
  }
}

/** content unlocked by a tech (uniques of other leaders excluded) */
export function techUnlocks(tech: TechId, leaderId?: string): { units: string[]; buildings: string[]; wonders: string[] } {
  const units: string[] = [];
  const buildings: string[] = [];
  const wonders: string[] = [];
  for (const id in UNITS) {
    const u = UNITS[id];
    if (u.tech !== tech) continue;
    if (u.uniqueTo && u.uniqueTo !== leaderId) continue;
    units.push(id);
  }
  for (const id in BUILDINGS) {
    const b = BUILDINGS[id];
    if (b.tech !== tech) continue;
    if (b.uniqueTo && b.uniqueTo !== leaderId) continue;
    buildings.push(id);
  }
  for (const id in WONDERS) if (WONDERS[id].tech === tech) wonders.push(id);
  return { units, buildings, wonders };
}

