// OWNER: ContentRogue. Doctrines — the Balatro joker set — plus the shared roguelite content kit
// (small pure helpers used by doctrines, edicts, crises, omens, leaders, reforms and ascension).
import type { BuildingDef,ChronicleCtx,CombatArgs,DoctrineDef,EffectHooks,HookCtx,UnitClass } from '../sim/defs';
import type {
ChapterStats,City,CouncilState,DoctrineInstance,Emit,GameState,LeaderId,PillarId,PlayerId,Rarity,ShopItem,SimEvent,
Tile,TileIdx,Unit,UnitTypeId,
} from '../sim/types';
import { BARBARIAN,PILLARS } from '../sim/types';
import { BUILDINGS } from './buildings';
import { UNITS } from './units';
import { RESOURCES } from './resources';
import { PILLAR_DEFS } from './pillars';
import { EDICTS } from './edicts';
import { neighbors } from '../sim/hex';
import { citiesOf } from '../sim/cities';
import { connectedResources } from '../sim/economy';
import { weightedIndex } from '../sim/rng';
import { EDICT_PRICE_BY_RARITY,PACKS,SCROLL_PRICE } from '../sim/roguelite/constants';
import { doctrinePrice,rollEdition } from '../sim/roguelite/council';
import { addExtraStat,markSeen } from '../sim/roguelite/stats';
import { SCROLLS } from './scrolls';
import { REFORMS } from './reforms';
import { DOCTRINES } from './doctrineRegistry';

export { DOCTRINES };

// ───────────────────────────── content kit ─────────────────────────────

export function isRiverTile(t: Tile): boolean {
  return t.riverEdges !== 0;
}
export function isWaterTile(t: Tile): boolean {
  return t.terrain === 'ocean' || t.terrain === 'coast' || t.terrain === 'lake';
}
export function adjacentTiles(state: GameState, idx: TileIdx): Tile[] {
  return neighbors(state.map, idx).map((i) => state.map.tiles[i]);
}
/** land tile touching coast or ocean */
export function isCoastalTile(state: GameState, t: Tile): boolean {
  if (isWaterTile(t)) return false;
  return adjacentTiles(state, t.idx).some((n) => n.terrain === 'coast' || n.terrain === 'ocean');
}
export function isNextToMountain(state: GameState, idx: TileIdx): boolean {
  return adjacentTiles(state, idx).some((n) => n.elevation === 'mountain');
}
export function isWoodland(t: Tile): boolean {
  return t.feature === 'forest' || t.feature === 'jungle';
}
export function cityTileOf(state: GameState, city: City): Tile {
  return state.map.tiles[city.tile];
}
export function isRiverCity(state: GameState, city: City): boolean {
  return isRiverTile(cityTileOf(state, city));
}
export function isCoastalCity(state: GameState, city: City): boolean {
  return isCoastalTile(state, cityTileOf(state, city));
}
export function ownedTiles(state: GameState, pid: PlayerId): Tile[] {
  return state.map.tiles.filter((t) => t.owner === pid);
}
export function countOwnedTiles(state: GameState, pid: PlayerId, pred: (t: Tile) => boolean): number {
  let n = 0;
  for (const t of state.map.tiles) if (t.owner === pid && pred(t)) n++;
  return n;
}
export function totalPop(state: GameState, pid: PlayerId): number {
  let n = 0;
  for (const c of citiesOf(state, pid)) n += c.pop;
  return n;
}
/** buildings owned across the empire (palace excluded), optionally filtered */
export function countBuildings(state: GameState, pid: PlayerId, pred?: (b: BuildingDef) => boolean): number {
  let n = 0;
  for (const c of citiesOf(state, pid)) {
    for (const id of c.buildings) {
      if (id === 'palace') continue;
      const def = BUILDINGS[id];
      if (!pred || (def && pred(def))) n++;
    }
  }
  return n;
}
/** city has the building or a leader-unique building that replaces it */
export function cityHas(city: City, id: string): boolean {
  return city.buildings.some((b) => b === id || BUILDINGS[b]?.replaces === id);
}
export function cityHasPillarBuilding(city: City, pillar: PillarId): boolean {
  return city.buildings.some((id) => BUILDINGS[id]?.pillar === pillar);
}
export function countWonders(state: GameState, pid: PlayerId): number {
  let n = 0;
  for (const c of citiesOf(state, pid)) n += c.wonders.length;
  return n;
}
/** distinct connected luxury resources (same connection rule as the economy) */
export function luxuriesOwned(state: GameState, pid: PlayerId): number {
  let n = 0;
  for (const id of connectedResources(state, pid)) if (RESOURCES[id]?.kind === 'luxury') n++;
  return n;
}
export function unitClassOf(type: UnitTypeId): UnitClass {
  return UNITS[type]?.class ?? 'civilian';
}
/** at war with any living major civ (barbarians excluded) */
export function isAtWar(state: GameState, pid: PlayerId): boolean {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p) return false;
  return state.players.some((o) => o.id !== pid && o.id !== BARBARIAN && o.alive && p.relations[o.id] === 'war');
}
/** 1-based era number (Ancient = 1) */
export function eraNumber(state: GameState): number {
  return state.run.era + 1;
}

/**
 * Strongest unit of the given classes the player can currently field (tech known; leader uniques replace
 * their base unit). Strategic resources are ignored — this is for gifts (edicts, leaders, crises).
 */
export function bestUnitFor(state: GameState, pid: PlayerId, classes: UnitClass[]): UnitTypeId | null {
  const p = state.players.find((pl) => pl.id === pid);
  if (!p) return null;
  const replaced = new Set<string>();
  for (const u of Object.values(UNITS)) if (u.uniqueTo === p.leaderId && u.replaces) replaced.add(u.replaces);
  let best: UnitTypeId | null = null;
  let bestScore = -1;
  for (const u of Object.values(UNITS)) {
    if (!classes.includes(u.class)) continue;
    if (u.uniqueTo && u.uniqueTo !== p.leaderId) continue;
    if (replaced.has(u.id)) continue;
    if (u.tech && !p.techs.includes(u.tech)) continue;
    const score = Math.max(u.strength, u.rangedStrength ?? 0) * 10 + u.era;
    if (score > bestScore) { best = u.id; bestScore = score; }
  }
  return best;
}
/** barbarian unit appropriate for the current era (melee by default) */
export function barbarianUnitForEra(era: number, ranged = false): UnitTypeId {
  const melee = ['warrior', 'swordsman', 'man_at_arms', 'musketman', 'rifleman', 'infantry'];
  const rng = ['archer', 'archer', 'crossbowman', 'crossbowman', 'field_gun', 'machine_gun'];
  const i = Math.max(0, Math.min(5, era));
  return (ranged ? rng : melee)[i];
}

// ── combat helpers (side-aware: the hook owner's side) ──
export function ownMod(a: CombatArgs, label: string, pct: number): void {
  (a.side === 'attack' ? a.attackMods : a.defenseMods).push({ label, pct });
}
export function ownUnit(a: CombatArgs): Unit | null {
  return a.side === 'attack' ? a.attacker : a.defender;
}
export function ownCity(a: CombatArgs): City | null {
  return a.side === 'attack' ? a.attackerCity : a.defenderCity;
}
export function enemyOwnerOf(a: CombatArgs): PlayerId {
  return a.side === 'attack' ? a.defenderOwner : a.attackerOwner;
}
/** tile the hook owner's unit stands on */
export function ownTile(a: CombatArgs): Tile {
  return a.side === 'attack' ? a.fromTile : a.tile;
}

/**
 * If `ev` is a lethal unit-vs-unit combat won by one of `pid`'s units, returns that surviving unit's id and the
 * tile where the enemy fell; city strikes and city captures don't count.
 */
export function unitKillBy(ev: SimEvent, pid: PlayerId): { unitId: number; tile: TileIdx } | null {
  if (ev.type !== 'combat') return null;
  const { attacker: at, defender: df } = ev;
  if (ev.defenderKilled && at.player === pid && at.unitId != null && df.unitId != null && df.player !== pid) return { unitId: at.unitId, tile: df.tile };
  if (ev.attackerKilled && df.player === pid && df.unitId != null && at.unitId != null && at.player !== pid) return { unitId: df.unitId, tile: at.tile };
  return null;
}

// ── roguelite helpers ──
/** live renown banked for this chapter's Chronicle ("Festivals & Edicts" step) + a map pop */
export function liveRenown(state: GameState, amount: number, label: string, emit: Emit, tile?: TileIdx): void {
  const n = Math.round(amount);
  if (n <= 0) return;
  addExtraStat(state, 'bonusRenown', n);
  emit({ type: 'renownGained', amount: n, label, tile });
}
export function doctrineIndex(state: GameState, uid: number | undefined): number {
  if (uid == null) return -1;
  return state.run.doctrines.findIndex((d) => d.uid === uid);
}
export function selfDoctrine(ctx: HookCtx): DoctrineInstance | undefined {
  return ctx.state.run.doctrines.find((d) => d.uid === ctx.uid);
}
/** remove a doctrine instance from the run (self-destructing doctrines) */
export function destroyDoctrine(state: GameState, uid: number, emit: Emit): void {
  const i = state.run.doctrines.findIndex((d) => d.uid === uid);
  if (i < 0) return;
  const [inst] = state.run.doctrines.splice(i, 1);
  emit({ type: 'doctrineLost', uid: inst.uid, id: inst.id });
}
/** summed pillar renown for the given stats at the player's current pillar level */
export function pillarRenown(state: GameState, stats: ChapterStats, pillar: PillarId): number {
  const def = PILLAR_DEFS[pillar];
  if (!def) return 0;
  let n = 0;
  for (const l of def.renown(stats, state.run.pillarLevels[pillar] ?? 1)) n += l.amount;
  return n;
}
/** sum of pillar levels above 1 across all pillars (= Scroll levels gained) */
export function scrollLevels(state: GameState): number {
  let n = 0;
  for (const p of PILLARS) n += Math.max(0, (state.run.pillarLevels[p] ?? 1) - 1);
  return n;
}

/**
 * Council price modifiers by source (`kind:id`); `all` applies to every item kind. Every price-affecting hook calls
 * `repriceCouncil`, which recomputes prices from base, so the result is independent of hook order and of rerolls.
 */
const COUNCIL_PRICE_MODS: Record<string, Partial<Record<ShopItem['kind'] | 'all', number>>> = {
  'doctrine:patrons_seal': { doctrine: -1 },
  'doctrine:silver_tongue': { all: -1 },
  'doctrine:pack_rat': { pack: -2 },
  'reform:grand_bazaar': { pack: -1 },
  'ascension:3': { all: 1 },
};
export function councilPriceDelta(state: GameState, kind: ShopItem['kind']): number {
  const run = state.run;
  let d = 0;
  const add = (key: string) => {
    const m = COUNCIL_PRICE_MODS[key];
    if (m) d += (m[kind] ?? 0) + (m.all ?? 0);
  };
  for (const inst of run.doctrines) if (!inst.disabled) add(`doctrine:${inst.id}`);
  for (const r of run.reforms) add(`reform:${r}`);
  for (let lvl = 1; lvl <= run.ascension; lvl++) add(`ascension:${lvl}`);
  return d;
}
/** undiscounted Council price (mirrors the Council's own pricing) */
export function baseCouncilPrice(item: ShopItem): number {
  switch (item.kind) {
    case 'doctrine': { const d = DOCTRINES[item.id]; return d ? doctrinePrice(d.rarity, item.edition) : item.price; }
    case 'edict': { const e = EDICTS[item.id]; return e ? (e.cost > 0 ? e.cost : EDICT_PRICE_BY_RARITY[e.rarity]) : item.price; }
    case 'scroll': { const sc = SCROLLS[item.id]; return sc ? (sc.cost > 0 ? sc.cost : SCROLL_PRICE) : item.price; }
    case 'pack': return PACKS[item.pack][item.size].price;
    case 'reform': return REFORMS[item.id]?.cost ?? item.price;
  }
}
/** set every Council item's price to base + all active modifiers (min 1); idempotent */
export function repriceCouncil(state: GameState, council: CouncilState): void {
  for (const it of council.items) if (it) it.price = Math.max(1, baseCouncilPrice(it) + councilPriceDelta(state, it.kind));
}
const ROLL_WEIGHTS: Record<Rarity, number> = { common: 70, uncommon: 25, rare: 5, legendary: 0 };
/** roll an eligible shop doctrine (not owned, not offered, not locked, not noShop) using state.rng */
export function rollDoctrineId(state: GameState, council?: CouncilState | null, weights: Record<Rarity, number> = ROLL_WEIGHTS): string | null {
  const owned = new Set(state.run.doctrines.map((d) => d.id));
  if (council) for (const it of council.items) if (it && it.kind === 'doctrine') owned.add(it.id);
  const locked = new Set(state.config.locked ?? []);
  const pool = Object.values(DOCTRINES).filter((d) => !d.noShop && !owned.has(d.id) && !locked.has(d.id) && weights[d.rarity] > 0).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!pool.length) return null;
  return pool[weightedIndex(state.rng, pool.map((d) => weights[d.rarity]))].id;
}

/** hooks for doctrines listed in COUNCIL_PRICE_MODS: reprice on every Council, and immediately when gained/sold mid-Council */
export const COUNCIL_REPRICER: EffectHooks = {
  council(ctx, a) { repriceCouncil(ctx.state, a.council); },
  onGain(ctx) {
    const run = ctx.state.run;
    if (run.phase === 'council' && run.council) repriceCouncil(ctx.state, run.council);
  },
  onLose(ctx) {
    const run = ctx.state.run;
    const self = selfDoctrine(ctx);
    if (self) self.disabled = true; // leaving the court: stop counting its modifier before repricing
    if (run.phase === 'council' && run.council) repriceCouncil(ctx.state, run.council);
  },
};

/** stock one extra rolled Doctrine card (edition rolled like the Council's own) and reprice; call on fresh and reroll */
export function pushDoctrineCard(state: GameState, council: CouncilState): void {
  const id = rollDoctrineId(state, council);
  if (!id) return;
  const edition = rollEdition(state);
  markSeen(state.run, `doctrine:${id}`);
  council.items.push({ kind: 'doctrine', id, edition, price: doctrinePrice(DOCTRINES[id].rarity, edition) });
  repriceCouncil(state, council);
}

/** multiplicative splendor helper that skips no-op ×1 steps */
export function mul(c: ChronicleCtx, x: number, label?: string): void {
  if (x > 1.0001 || x < 0.9999) c.mulSplendor(Math.round(x * 100) / 100, label);
}

// ─── copy mechanics (Echo / Mirror Court / Apotheosis) ───
const copyStack = new Set<number>();
/** run another doctrine's chronicle effect as if it were in this slot (guards against copy loops) */
export function copyChronicle(ctx: HookCtx, target: DoctrineInstance | undefined, c: ChronicleCtx): boolean {
  if (!target || target.disabled || copyStack.has(target.uid)) return false;
  const def = DOCTRINES[target.id];
  const fn = def?.effects.chronicle;
  if (!fn) return false;
  const self = ctx.uid != null && !copyStack.has(ctx.uid) ? ctx.uid : null;
  copyStack.add(target.uid);
  if (self != null) copyStack.add(self);
  try {
    fn({ ...ctx, id: target.id, uid: target.uid, counters: target.counters }, c);
  } finally {
    copyStack.delete(target.uid);
    if (self != null) copyStack.delete(self);
  }
  return true;
}

// ───────────────────────────── doctrines ─────────────────────────────

export function shrineCount(city: City): number {
  let n = 0;
  for (const b of city.buildings) if (b === 'temple' || b === 'shrine' || BUILDINGS[b]?.replaces === 'temple' || BUILDINGS[b]?.replaces === 'shrine') n++;
  return n;
}

// ── helpers local to the doctrine list ──
export function onRiver(state: GameState, c: ChronicleCtx): number {
  return c.cities.filter((city) => isRiverCity(state, city)).length;
}
export function coastalCount(state: GameState, c: ChronicleCtx): number {
  return c.cities.filter((city) => isCoastalCity(state, city)).length;
}
export function focusBonus(id: string, name: string, pillar: PillarId, label: string, motif: string, hue: number, flavor: string, nation: LeaderId): DoctrineDef {
  return {
    id, name, rarity: 'common', cost: 4, nation,
    description: `**+4** {splendor} if your Priority is ${label}.`,
    flavor, tags: ['focus', pillar, 'splendor'], icon: pillar, art: { hue, motif },
    effects: {
      chronicle(_ctx, c) {
        if (c.focus === pillar) c.addSplendor(4);
      },
    },
  };
}
/** stable per-turn pseudo-random roll (chronicle hooks must not consume state.rng) */
export function divination(turn: number, uid: number, sides: number): number {
  const h = Math.imul(turn + 1, 2654435761) ^ Math.imul(uid + 7, 40503);
  return ((h >>> 0) % 2147483647) % sides;
}

