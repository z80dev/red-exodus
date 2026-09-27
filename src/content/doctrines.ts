// OWNER: ContentRogue. Doctrines — the Balatro joker set — plus the shared roguelite content kit
// (small pure helpers used by doctrines, edicts, crises, omens, leaders, reforms and ascension).
import type { BuildingDef, ChronicleCtx, CombatArgs, DoctrineDef, EffectHooks, HookCtx, UnitClass } from '../sim/defs';
import type {
  ChapterStats, City, CouncilState, DoctrineInstance, Emit, GameState, PillarId, PlayerId, Rarity, ShopItem, SimEvent,
  Tile, TileIdx, Unit, UnitTypeId,
} from '../sim/types';
import { BARBARIAN, PILLARS } from '../sim/types';
import { BUILDINGS } from './buildings';
import { UNITS } from './units';
import { RESOURCES } from './resources';
import { PILLAR_DEFS } from './pillars';
import { EDICTS } from './edicts';
import { CRISES } from './crises';
import { neighbors } from '../sim/hex';
import { changePop, citiesOf } from '../sim/cities';
import { addGold, availableTechs, connectedResources, grantTech } from '../sim/economy';
import { randInt, weightedIndex } from '../sim/rng';
import { addInfluence, changeMandate } from '../sim/roguelite';
import { EDICT_PRICE_BY_RARITY, PACKS, SCROLL_PRICE } from '../sim/roguelite/constants';
import { doctrinePrice, rollEdition } from '../sim/roguelite/council';
import { addExtraStat, markSeen } from '../sim/roguelite/stats';
import { SCROLLS } from './scrolls';
import { REFORMS } from './reforms';

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
  const pool = Object.values(DOCTRINES).filter((d) => !d.noShop && !owned.has(d.id) && !locked.has(d.id) && weights[d.rarity] > 0);
  if (!pool.length) return null;
  return pool[weightedIndex(state.rng, pool.map((d) => weights[d.rarity]))].id;
}

/** hooks for doctrines listed in COUNCIL_PRICE_MODS: reprice on every Council, and immediately when gained/sold mid-Council */
const COUNCIL_REPRICER: EffectHooks = {
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
function mul(c: ChronicleCtx, x: number, label?: string): void {
  if (x > 1.0001 || x < 0.9999) c.mulSplendor(Math.round(x * 100) / 100, label);
}

// ─── copy mechanics (Echo / Mirror Court / Apotheosis) ───
const copyStack = new Set<number>();
/** run another doctrine's chronicle effect as if it were in this slot (guards against copy loops) */
function copyChronicle(ctx: HookCtx, target: DoctrineInstance | undefined, c: ChronicleCtx): boolean {
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

function shrineCount(city: City): number {
  let n = 0;
  for (const b of city.buildings) if (b === 'temple' || b === 'shrine' || BUILDINGS[b]?.replaces === 'temple' || BUILDINGS[b]?.replaces === 'shrine') n++;
  return n;
}

// ── helpers local to the doctrine list ──
function onRiver(state: GameState, c: ChronicleCtx): number {
  return c.cities.filter((city) => isRiverCity(state, city)).length;
}
function coastalCount(state: GameState, c: ChronicleCtx): number {
  return c.cities.filter((city) => isCoastalCity(state, city)).length;
}
function focusBonus(id: string, name: string, pillar: PillarId, label: string, motif: string, hue: number, flavor: string): DoctrineDef {
  return {
    id, name, rarity: 'common', cost: 4,
    description: `**+4** {splendor} if your Focus is ${label}.`,
    flavor, tags: ['focus', pillar, 'splendor'], icon: pillar, art: { hue, motif },
    effects: {
      chronicle(_ctx, c) {
        if (c.focus === pillar) c.addSplendor(4);
      },
    },
  };
}
/** stable per-turn pseudo-random roll (chronicle hooks must not consume state.rng) */
function divination(turn: number, uid: number, sides: number): number {
  const h = Math.imul(turn + 1, 2654435761) ^ Math.imul(uid + 7, 40503);
  return ((h >>> 0) % 2147483647) % sides;
}

const COMMON: DoctrineDef[] = [
  {
    id: 'riverfolk', name: 'Riverfolk', rarity: 'common', cost: 4,
    description: 'River tiles +1 {food}. **+1** {splendor} per city on a river.',
    flavor: 'Where water runs, bread follows.',
    tags: ['river', 'growth', 'splendor'], icon: 'river', art: { hue: 200, motif: 'river' },
    effects: {
      tileYield(_ctx, a) { if (isRiverTile(a.tile)) a.yields.food += 1; },
      chronicle(ctx, c) { const n = onRiver(ctx.state, c); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'ferrymen', name: 'Ferrymen', rarity: 'common', cost: 4,
    description: 'River tiles +1 {gold}. **+4** {renown} per river tile you own.',
    flavor: 'Two coins to cross. Three to come back.',
    tags: ['river', 'gold', 'renown'], icon: 'river', art: { hue: 205, motif: 'ship' },
    effects: {
      tileYield(_ctx, a) { if (isRiverTile(a.tile)) a.yields.gold += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, isRiverTile); if (n) c.addRenown(4 * n); },
    },
  },
  {
    id: 'tidecallers', name: 'Tidecallers', rarity: 'common', cost: 4,
    description: 'Coast and lake tiles +1 {food}. **+1** {splendor} per coastal city.',
    flavor: 'The sea keeps no granary, yet never starves.',
    tags: ['coastal', 'growth', 'splendor'], icon: 'wave', art: { hue: 190, motif: 'wave' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'coast' || a.tile.terrain === 'lake') a.yields.food += 1; },
      chronicle(ctx, c) { const n = coastalCount(ctx.state, c); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'salt_traders', name: 'Salt Traders', rarity: 'common', cost: 4,
    description: 'Coastal cities +3 {gold}. **+10** {renown} per coastal city.',
    flavor: 'White gold, sold by the barrel.',
    tags: ['coastal', 'gold', 'renown'], icon: 'anchor', art: { hue: 185, motif: 'anchor' },
    effects: {
      cityYield(ctx, a) { if (isCoastalCity(ctx.state, a.city)) a.yields.gold += 3; },
      chronicle(ctx, c) { const n = coastalCount(ctx.state, c); if (n) c.addRenown(10 * n); },
    },
  },
  {
    id: 'highlanders', name: 'Highlanders', rarity: 'common', cost: 4,
    description: 'Hills tiles +1 {prod}. Your units on hills +15% defense.',
    flavor: 'Every ridge a rampart.',
    tags: ['mountain', 'production', 'conquest'], icon: 'mountain', art: { hue: 28, motif: 'mountain' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.elevation === 'hills') a.yields.prod += 1; },
      combat(_ctx, a) { if (a.side === 'defense' && ownUnit(a) && ownTile(a).elevation === 'hills') ownMod(a, 'Highlanders', 15); },
    },
  },
  {
    id: 'peak_shrines', name: 'Peak Shrines', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per 2 mountain tiles in your territory (max +6).',
    flavor: 'The gods live higher than kings — and charge less.',
    tags: ['mountain', 'splendor'], icon: 'temple', art: { hue: 220, motif: 'mountain' },
    effects: {
      chronicle(ctx, c) {
        const n = Math.min(6, Math.floor(countOwnedTiles(ctx.state, ctx.player.id, (t) => t.elevation === 'mountain') / 2));
        if (n) c.addSplendor(n);
      },
    },
  },
  {
    id: 'sand_walkers', name: 'Sand Walkers', rarity: 'common', cost: 4,
    description: 'Desert tiles +1 {prod}. Oases and floodplains +1 {food} and +1 {gold}.',
    flavor: 'They read the dunes like scripture.',
    tags: ['desert', 'production', 'growth'], icon: 'sun', art: { hue: 40, motif: 'sun' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'desert') a.yields.prod += 1;
        if (a.tile.feature === 'oasis' || a.tile.feature === 'floodplains') { a.yields.food += 1; a.yields.gold += 1; }
      },
    },
  },
  {
    id: 'mirage_poets', name: 'Mirage Poets', rarity: 'common', cost: 4,
    description: 'Desert tiles +1 {cul}. **+3** {renown} per desert tile you own.',
    flavor: 'Every shimmering lake is a verse unfinished.',
    tags: ['desert', 'culture', 'renown'], icon: 'feather', art: { hue: 36, motif: 'feather' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'desert') a.yields.cul += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, (t) => t.terrain === 'desert'); if (n) c.addRenown(3 * n); },
    },
  },
  {
    id: 'woodwardens', name: 'Woodwardens', rarity: 'common', cost: 4,
    description: 'Forest tiles +1 {prod}. Your units in forest +15% defense.',
    flavor: 'Take only deadwood. Give only arrows.',
    tags: ['forest', 'production', 'conquest'], icon: 'tree', art: { hue: 118, motif: 'tree' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.feature === 'forest') a.yields.prod += 1; },
      combat(_ctx, a) { if (a.side === 'defense' && ownUnit(a) && ownTile(a).feature === 'forest') ownMod(a, 'Woodwardens', 15); },
    },
  },
  {
    id: 'jungle_sages', name: 'Jungle Sages', rarity: 'common', cost: 4,
    description: 'Jungle tiles +1 {sci} and +1 {cul}.',
    flavor: 'A thousand remedies grow in the green dark.',
    tags: ['forest', 'science', 'culture'], icon: 'serpent', art: { hue: 135, motif: 'serpent' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.feature === 'jungle') { a.yields.sci += 1; a.yields.cul += 1; } },
    },
  },
  {
    id: 'frontier_charter', name: 'Frontier Charter', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per city you own.',
    flavor: 'Every new wall is a new line in the chronicle.',
    tags: ['wide', 'splendor'], icon: 'city', art: { hue: 60, motif: 'compass' },
    effects: {
      chronicle(_ctx, c) { if (c.cities.length) c.addSplendor(c.cities.length); },
    },
  },
  {
    id: 'tax_farmers', name: 'Tax Farmers', rarity: 'common', cost: 4,
    description: '**+1** {influence} per chapter for every 3 cities you own.',
    flavor: 'Efficient, if not beloved.',
    tags: ['wide', 'influence', 'economy'], icon: 'influence', art: { hue: 52, motif: 'coin' },
    effects: {
      influenceIncome(ctx, a) {
        const n = Math.floor(citiesOf(ctx.state, ctx.player.id).length / 3);
        if (n > 0) a.lines.push({ label: 'Tax Farmers', amount: n });
      },
    },
  },
  {
    id: 'homesteaders', name: 'Homesteaders', rarity: 'common', cost: 4,
    description: 'Settlers cost 25% less {prod}. New cities you found start with +1 pop.',
    flavor: 'Bring seed, bring children, bring hope.',
    tags: ['wide', 'growth'], icon: 'found', art: { hue: 80, motif: 'wheat' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'unit' && a.item.id === 'settler') a.cost *= 0.75; },
      onEvent(ctx, ev) {
        if (ev.type !== 'cityFounded' || ev.player !== ctx.player.id) return;
        const city = ctx.state.cities[ev.cityId];
        if (!city) return;
        changePop(ctx.state, city, 1, ctx.emit);
        ctx.flash('+1 pop', city.tile);
      },
    },
  },
  {
    id: 'walled_garden', name: 'Walled Garden', rarity: 'common', cost: 4,
    description: '**+6** {splendor} if you own 3 or fewer cities.',
    flavor: 'Small realms, tended well, bloom brightest.',
    tags: ['tall', 'splendor'], icon: 'walls', art: { hue: 100, motif: 'castle' },
    effects: {
      chronicle(_ctx, c) { if (c.cities.length <= 3) c.addSplendor(6); },
    },
  },
  {
    id: 'great_hall', name: 'Great Hall', rarity: 'common', cost: 4,
    description: 'Your capital +15% {prod}. **+5** {renown} per pop in your capital.',
    flavor: 'All roads lead to the long table.',
    tags: ['tall', 'production', 'renown'], icon: 'palace', art: { hue: 30, motif: 'crown' },
    effects: {
      cityYield(_ctx, a) { if (a.city.isCapital) a.pct.prod += 15; },
      chronicle(_ctx, c) { const cap = c.cities.find((x) => x.isCapital); if (cap) c.addRenown(5 * cap.pop); },
    },
  },
  {
    id: 'drill_sergeants', name: 'Drill Sergeants', rarity: 'common', cost: 4,
    description: 'Your units +10% strength when attacking.',
    flavor: 'Again. Faster. Again.',
    tags: ['conquest'], icon: 'strength', art: { hue: 5, motif: 'sword' },
    effects: {
      combat(_ctx, a) { if (a.side === 'attack' && ownUnit(a)) ownMod(a, 'Drill Sergeants', 10); },
    },
  },
  {
    id: 'bloodied_banners', name: 'Bloodied Banners', rarity: 'common', cost: 4,
    description: '**+15** {renown} per enemy unit killed this chapter.',
    flavor: 'Each stain a story, each tear a triumph.',
    tags: ['conquest', 'renown'], icon: 'conquest', art: { hue: 355, motif: 'skull' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.kills) c.addRenown(15 * c.stats.kills); },
    },
  },
  {
    id: 'shieldwall', name: 'Shieldwall', rarity: 'common', cost: 4,
    description: 'Melee and anti-cavalry units +15% defense.',
    flavor: 'Lock shields. Hold the line. Live.',
    tags: ['conquest'], icon: 'shield', art: { hue: 15, motif: 'shield' },
    effects: {
      combat(_ctx, a) {
        const u = ownUnit(a);
        if (a.side !== 'defense' || !u) return;
        const k = unitClassOf(u.type);
        if (k === 'melee' || k === 'antiCavalry') ownMod(a, 'Shieldwall', 15);
      },
    },
  },
  {
    id: 'war_drums', name: 'War Drums', rarity: 'common', cost: 4,
    description: 'Mounted units +1 movement.',
    flavor: 'The hooves learn the rhythm first.',
    tags: ['conquest'], icon: 'mounted', art: { hue: 10, motif: 'horse' },
    effects: {
      unitMoves(_ctx, a) { if (unitClassOf(a.unit.type) === 'mounted') a.value += 1; },
    },
  },
  {
    id: 'headhunters', name: 'Headhunters', rarity: 'common', cost: 4,
    description: 'Killing a barbarian unit grants **+10** {gold}. **+30** {renown} per camp cleared this chapter.',
    flavor: 'Bounties paid in silver, no questions asked.',
    tags: ['barbarian', 'conquest', 'gold'], icon: 'skull', art: { hue: 18, motif: 'skull' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type === 'unitDied' && ev.player === BARBARIAN && ev.killer === ctx.player.id) {
          addGold(ctx.state, ctx.player.id, 10, 'Headhunters', ctx.emit);
          ctx.flash('+10 gold', ev.tile);
        }
      },
      chronicle(_ctx, c) { if (c.stats.campsCleared) c.addRenown(30 * c.stats.campsCleared); },
    },
  },
  {
    id: 'march_wardens', name: 'Wardens of the March', rarity: 'common', cost: 4,
    description: 'Your units +25% strength against barbarians.',
    flavor: 'The border is not a line. It is a promise.',
    tags: ['barbarian', 'conquest'], icon: 'shield', art: { hue: 25, motif: 'tower' },
    effects: {
      combat(_ctx, a) { if (ownUnit(a) && enemyOwnerOf(a) === BARBARIAN) ownMod(a, 'Wardens of the March', 25); },
    },
  },
  {
    id: 'bardic_college', name: 'Bardic College', rarity: 'common', cost: 4,
    description: 'Cities with an Arts building +2 {cul}.',
    flavor: 'Nine verses for the king, ten for the tavern.',
    tags: ['culture'], icon: 'lyre', art: { hue: 300, motif: 'lyre' },
    effects: {
      cityYield(_ctx, a) { if (cityHasPillarBuilding(a.city, 'arts')) a.yields.cul += 2; },
    },
  },
  {
    id: 'storytellers', name: 'Storytellers', rarity: 'common', cost: 4,
    description: '**+1** {renown} per 2 {cul} generated this chapter.',
    flavor: 'Tell it again — and bigger this time.',
    tags: ['culture', 'renown'], icon: 'book', art: { hue: 310, motif: 'book' },
    effects: {
      chronicle(_ctx, c) { const n = Math.floor(c.stats.culture / 2); if (n) c.addRenown(n); },
    },
  },
  {
    id: 'star_charts', name: 'Star Charts', rarity: 'common', cost: 4,
    description: '**+20** {renown} per tech discovered this chapter.',
    flavor: 'Map the heavens and the earth follows.',
    tags: ['science', 'renown'], icon: 'star', art: { hue: 230, motif: 'star' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.techs) c.addRenown(20 * c.stats.techs); },
    },
  },
  {
    id: 'market_criers', name: 'Market Criers', rarity: 'common', cost: 4,
    description: 'Cities with 6 or more pop +3 {gold}.',
    flavor: 'Figs! Silk! Rumors, two for a copper!',
    tags: ['gold', 'tall'], icon: 'market', art: { hue: 46, motif: 'hand' },
    effects: {
      cityYield(_ctx, a) { if (a.city.pop >= 6) a.yields.gold += 3; },
    },
  },
  {
    id: 'coin_counters', name: 'Coin Counters', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per 100 {gold} in your treasury (max +8).',
    flavor: 'Wealth unspent is wealth admired.',
    tags: ['gold', 'splendor'], icon: 'gold', art: { hue: 48, motif: 'coin' },
    status(_counters, state) { return `+${Math.min(8, Math.floor(Math.max(0, state.players[0]?.gold ?? 0) / 100))} Splendor`; },
    effects: {
      chronicle(ctx, c) { const n = Math.min(8, Math.floor(Math.max(0, ctx.player.gold) / 100)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'tithe_box', name: 'Tithe Box', rarity: 'common', cost: 4,
    description: '**+2** {influence} at the end of every chapter.',
    flavor: 'A coin for the gods; the gods are patient.',
    tags: ['influence', 'economy'], icon: 'influence', art: { hue: 280, motif: 'chalice' },
    effects: {
      influenceIncome(_ctx, a) { a.lines.push({ label: 'Tithe Box', amount: 2 }); },
    },
  },
  {
    id: 'granary_keepers', name: 'Granary Keepers', rarity: 'common', cost: 4,
    description: 'Cities need 15% less {food} to grow.',
    flavor: 'Seven fat years, counted grain by grain.',
    tags: ['growth'], icon: 'granary', art: { hue: 75, motif: 'wheat' },
    effects: {
      growthThreshold(_ctx, a) { a.value *= 0.85; },
    },
  },
  {
    id: 'fertile_fields', name: 'Fertile Fields', rarity: 'common', cost: 4,
    description: 'Farms +1 {food}. **+2** {renown} per farm you own.',
    flavor: 'Plough, sow, sing, reap.',
    tags: ['growth', 'renown'], icon: 'farm', art: { hue: 85, motif: 'wheat' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.improvement === 'farm' && !a.tile.pillaged) a.yields.food += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, (t) => t.improvement === 'farm' && !t.pillaged); if (n) c.addRenown(2 * n); },
    },
  },
  {
    id: 'midwives', name: 'Midwives', rarity: 'common', cost: 4,
    description: '**+8** {renown} per population grown this chapter.',
    flavor: 'Every cry at dawn is a vote for tomorrow.',
    tags: ['growth', 'renown'], icon: 'prosperity', art: { hue: 95, motif: 'hand' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.popGrown) c.addRenown(8 * c.stats.popGrown); },
    },
  },
  {
    id: 'forgemasters', name: 'Forgemasters', rarity: 'common', cost: 4,
    description: 'Mines +1 {prod}. Quarries +1 {prod} and +1 {gold}.',
    flavor: 'The mountain gives. The hammer thanks.',
    tags: ['production', 'mountain'], icon: 'mine', art: { hue: 22, motif: 'gear' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.pillaged) return;
        if (a.tile.improvement === 'mine') a.yields.prod += 1;
        if (a.tile.improvement === 'quarry') { a.yields.prod += 1; a.yields.gold += 1; }
      },
    },
  },
  {
    id: 'foremen', name: 'Foremen', rarity: 'common', cost: 4,
    description: 'Buildings cost 10% less {prod}.',
    flavor: 'Measure twice, shout once.',
    tags: ['production'], icon: 'prod', art: { hue: 20, motif: 'gear' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building') a.cost *= 0.9; },
    },
  },
  {
    id: 'master_masons', name: 'Master Masons', rarity: 'common', cost: 4,
    description: 'Wonders cost 15% less {prod}.',
    flavor: 'Their marks are on every stone that matters.',
    tags: ['wonders', 'production'], icon: 'wonder', art: { hue: 34, motif: 'pyramid' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'wonder') a.cost *= 0.85; },
    },
  },
  {
    id: 'bread_and_circuses', name: 'Bread & Circuses', rarity: 'common', cost: 4,
    description: '**+3** {happy} empire happiness.',
    flavor: 'Full bellies seldom riot.',
    tags: ['happiness'], icon: 'happy', art: { hue: 335, motif: 'mask' },
    effects: {
      happiness(_ctx, a) { a.value += 3; },
    },
  },
  {
    id: 'content_folk', name: 'Content Folk', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per 3 {happy} happiness (max +6).',
    flavor: 'A smiling people is a monument in itself.',
    tags: ['happiness', 'splendor'], icon: 'happy', art: { hue: 330, motif: 'sun' },
    status(_counters, state) { return `+${Math.min(6, Math.floor(Math.max(0, state.players[0]?.happiness ?? 0) / 3))} Splendor`; },
    effects: {
      chronicle(ctx, c) { const n = Math.min(6, Math.floor(Math.max(0, ctx.player.happiness) / 3)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'patrons_seal', name: "Patron's Seal", rarity: 'common', cost: 4,
    description: 'Doctrine cards in the Council cost **1** {influence} less.',
    flavor: 'A friend at court is worth a purse of rubies.',
    tags: ['influence', 'shop'], icon: 'doctrine', art: { hue: 265, motif: 'key' },
    effects: {
      ...COUNCIL_REPRICER,
    },
  },
  {
    id: 'open_market', name: 'Open Market', rarity: 'common', cost: 4,
    description: "The Council's reroll cost starts at **0** {influence}.",
    flavor: 'Look all you like, friend.',
    tags: ['influence', 'shop'], icon: 'reroll', art: { hue: 275, motif: 'hand' },
    effects: {
      council(_ctx, a) { if (!a.reroll) a.council.rerollCost = 0; },
    },
  },
  {
    id: 'heralds', name: 'Heralds', rarity: 'common', cost: 4,
    description: 'Whenever you use an Edict, gain **+15** {gold}.',
    flavor: 'Hear ye! And pay ye.',
    tags: ['edict', 'gold'], icon: 'edict', art: { hue: 40, motif: 'scroll' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'edictUsed' || !ctx.player.isHuman) return;
        addGold(ctx.state, ctx.player.id, 15, 'Heralds', ctx.emit);
        ctx.flash('+15 gold');
      },
    },
  },
  {
    id: 'scribes_of_decree', name: 'Scribes of Decree', rarity: 'common', cost: 4,
    description: '**+2** {splendor} per Edict used this chapter.',
    flavor: 'Signed, sealed, remembered.',
    tags: ['edict', 'splendor'], icon: 'edict', art: { hue: 290, motif: 'feather' },
    status(counters) { return `${counters.used ?? 0} Edicts this chapter`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type === 'chapterStarted') ctx.counters.used = 0;
        else if (ev.type === 'edictUsed' && ctx.player.isHuman) ctx.counters.used = (ctx.counters.used ?? 0) + 1;
      },
      chronicle(ctx, c) { const n = ctx.counters.used ?? 0; if (n) c.addSplendor(2 * n); },
    },
  },
  {
    id: 'lorekeepers', name: 'Lorekeepers', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per 2 Scroll levels gained across all pillars.',
    flavor: 'Each scroll a candle; together, a dawn.',
    tags: ['scroll', 'splendor'], icon: 'scroll', art: { hue: 250, motif: 'scroll' },
    status(_counters, state) { return `+${Math.floor(scrollLevels(state) / 2)} Splendor`; },
    effects: {
      chronicle(ctx, c) { const n = Math.floor(scrollLevels(ctx.state) / 2); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'stoic_chroniclers', name: 'Stoic Chroniclers', rarity: 'common', cost: 4,
    description: '**+5** {splendor} during a Crisis chapter.',
    flavor: 'History is written loudest in dark ink.',
    tags: ['crisis', 'splendor'], icon: 'crisis', art: { hue: 350, motif: 'book' },
    effects: {
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) c.addSplendor(5); },
    },
  },
  {
    id: 'hoarders_vault', name: "Hoarders' Vault", rarity: 'common', cost: 4,
    description: 'During a Crisis chapter, every city +2 {food} and +2 {prod}.',
    flavor: 'Laughed at in the good years. Thanked in the bad.',
    tags: ['crisis', 'growth', 'production'], icon: 'granary', art: { hue: 345, motif: 'key' },
    effects: {
      cityYield(ctx, a) { if (ctx.state.run.crisisActive) { a.yields.food += 2; a.yields.prod += 2; } },
    },
  },
  {
    id: 'oracle_bones', name: 'Oracle Bones', rarity: 'common', cost: 4,
    description: '**+0** to **+8** {splendor}, divined anew every turn.',
    flavor: 'Crack, hiss, and the future speaks in lines.',
    tags: ['risk', 'splendor'], icon: 'eye', art: { hue: 32, motif: 'eye' },
    effects: {
      chronicle(ctx, c) { const n = divination(ctx.state.turn, ctx.uid ?? 0, 9); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'tally_stones', name: 'Tally Stones', rarity: 'common', cost: 4,
    description: 'Gains **+3** {renown} at the start of every turn.',
    flavor: 'One pebble per sunrise. The pile remembers.',
    tags: ['scaling', 'renown'], icon: 'hourglass', art: { hue: 25, motif: 'hourglass' },
    status(counters) { return `+${counters.renown ?? 0} Renown`; },
    effects: {
      turnStart(ctx) { ctx.counters.renown = (ctx.counters.renown ?? 0) + 3; },
      chronicle(ctx, c) { const n = ctx.counters.renown ?? 0; if (n) c.addRenown(n); },
    },
  },
  {
    id: 'bonfire_of_tales', name: 'Bonfire of Tales', rarity: 'common', cost: 4,
    description: '**+10** {splendor}; loses 1 after every Chronicle. Crumbles at 0.',
    flavor: 'The best stories are told before the fire dies.',
    tags: ['splendor', 'risk'], icon: 'flame', art: { hue: 15, motif: 'flame' },
    status(counters) { return `+${Math.max(0, 10 - (counters.spent ?? 0))} Splendor`; },
    effects: {
      chronicle(ctx, c) { const n = Math.max(0, 10 - (ctx.counters.spent ?? 0)); if (n) c.addSplendor(n); },
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle' || ctx.uid == null) return;
        ctx.counters.spent = (ctx.counters.spent ?? 0) + 1;
        if (ctx.counters.spent >= 10) destroyDoctrine(ctx.state, ctx.uid, ctx.emit);
        else ctx.flash(`${10 - ctx.counters.spent} left`);
      },
    },
  },
  {
    id: 'gilders_guild', name: "Gilders' Guild", rarity: 'common', cost: 4,
    description: '**+3** {splendor} per doctrine with an edition.',
    flavor: 'Leaf of gold on everything, even the gilders.',
    tags: ['edition', 'splendor'], icon: 'star', art: { hue: 50, motif: 'crown' },
    effects: {
      chronicle(ctx, c) { const n = ctx.state.run.doctrines.filter((d) => d.edition !== 'base').length; if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'nest_egg', name: 'Nest Egg', rarity: 'common', cost: 4,
    description: 'Gains **+2** {influence} of sell value after every Chronicle.',
    flavor: 'Patience compounds.',
    tags: ['economy', 'influence', 'scaling'], icon: 'coin', art: { hue: 44, motif: 'owl' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle') return;
        const self = selfDoctrine(ctx);
        if (!self) return;
        self.sellValue += 2;
        ctx.flash(`Sell value ${self.sellValue}`);
      },
    },
  },
  {
    id: 'vanguard', name: 'Vanguard', rarity: 'common', cost: 4,
    description: '**+8** {splendor} if this is your leftmost doctrine.',
    flavor: 'First through the gate, first in the songs.',
    tags: ['position', 'splendor'], icon: 'chevronLeft', art: { hue: 8, motif: 'eagle' },
    effects: {
      chronicle(ctx, c) { if (doctrineIndex(ctx.state, ctx.uid) === 0) c.addSplendor(8); },
    },
  },
  {
    id: 'rearguard', name: 'Rearguard', rarity: 'common', cost: 4,
    description: '**+25%** {renown} if this is your rightmost doctrine.',
    flavor: 'Someone must close the gate behind the legend.',
    tags: ['position', 'renown'], icon: 'chevronRight', art: { hue: 210, motif: 'shield' },
    effects: {
      chronicle(ctx, c) {
        const i = doctrineIndex(ctx.state, ctx.uid);
        if (i >= 0 && i === ctx.state.run.doctrines.length - 1) c.addRenown(Math.round(c.renown() * 0.25));
      },
    },
  },
  {
    id: 'road_wardens', name: 'Road Wardens', rarity: 'common', cost: 4,
    description: 'Your units +1 vision. Scouts +1 movement.',
    flavor: 'Eyes on every milestone.',
    tags: ['exploration'], icon: 'vision', art: { hue: 150, motif: 'compass' },
    effects: {
      unitVision(_ctx, a) { a.value += 1; },
      unitMoves(_ctx, a) { if (a.unit.type === 'scout') a.value += 1; },
    },
  },
  {
    id: 'pathfinders', name: 'Pathfinders', rarity: 'common', cost: 4,
    description: '**+3** {renown} per tile explored this chapter.',
    flavor: 'Beyond the map, the margins are full of glory.',
    tags: ['exploration', 'renown'], icon: 'map', art: { hue: 160, motif: 'compass' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.tilesExplored) c.addRenown(3 * c.stats.tilesExplored); },
    },
  },
  focusBonus('muses_favor', "Muses' Favor", 'arts', 'Arts', 'lyre', 300, 'Sing, goddess, of an empire worth the singing.'),
  focusBonus('lamplighters', 'Lamplighters', 'discovery', 'Discovery', 'flask', 230, 'Every lit window is a question being asked.'),
  focusBonus('guild_ledger', 'Guild Ledger', 'commerce', 'Commerce', 'coin', 48, 'Debits left, credits right, glory in the margin.'),
  focusBonus('war_banner', 'War Banner', 'conquest', 'Conquest', 'sword', 0, 'Raise it high; let them count the stitches.'),
  focusBonus('harvest_moon', 'Harvest Moon', 'prosperity', 'Prosperity', 'wheat', 85, 'The moon ripens the grain, and the grain the people.'),
  focusBonus('triumphal_arch', 'Triumphal Arch', 'glory', 'Glory', 'laurel', 38, 'Built for one parade, remembered for a thousand years.'),
];

const UNCOMMON: DoctrineDef[] = [
  {
    id: 'legend_of_the_steppe', name: 'Legend of the Steppe', rarity: 'uncommon', cost: 6,
    description: 'Gains **+0.5** {splendor} whenever one of your units kills an enemy unit.',
    flavor: 'The grass remembers every hoofbeat.',
    tags: ['conquest', 'scaling', 'splendor'], icon: 'horse', art: { hue: 12, motif: 'horse' },
    status(counters) { return `+${counters.splendor ?? 0} Splendor`; },
    effects: {
      onEvent(ctx, ev) {
        const kill = unitKillBy(ev, ctx.player.id);
        if (!kill) return;
        ctx.counters.splendor = (ctx.counters.splendor ?? 0) + 0.5;
        ctx.flash(`+${ctx.counters.splendor} Splendor`, kill.tile);
      },
      chronicle(ctx, c) { const n = ctx.counters.splendor ?? 0; if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'river_kings', name: 'River Kings', rarity: 'uncommon', cost: 6,
    description: 'Cities on rivers +15% {prod} and +15% {gold}.',
    flavor: 'They tax the current and the current pays.',
    tags: ['river', 'production', 'gold'], icon: 'river', art: { hue: 198, motif: 'crown' },
    effects: {
      cityYield(ctx, a) { if (isRiverCity(ctx.state, a.city)) { a.pct.prod += 15; a.pct.gold += 15; } },
    },
  },
  {
    id: 'harbor_masters', name: 'Harbor Masters', rarity: 'uncommon', cost: 6,
    description: 'Coastal cities +2 {prod}. **+2** {splendor} per city with a Harbor.',
    flavor: 'Every mast in the bay answers to one ledger.',
    tags: ['coastal', 'production', 'splendor'], icon: 'harbor', art: { hue: 195, motif: 'anchor' },
    effects: {
      cityYield(ctx, a) { if (isCoastalCity(ctx.state, a.city)) a.yields.prod += 2; },
      chronicle(_ctx, c) { const n = c.cities.filter((x) => cityHas(x, 'harbor')).length; if (n) c.addSplendor(2 * n); },
    },
  },
  {
    id: 'mountain_monastery', name: 'Mountain Monastery', rarity: 'uncommon', cost: 6,
    description: 'Cities next to a mountain +2 {sci} and +2 {cul}.',
    flavor: 'Closer to heaven, farther from noise.',
    tags: ['mountain', 'science', 'culture'], icon: 'temple', art: { hue: 215, motif: 'temple' },
    effects: {
      cityYield(ctx, a) { if (isNextToMountain(ctx.state, a.city.tile)) { a.yields.sci += 2; a.yields.cul += 2; } },
    },
  },
  {
    id: 'dune_riders', name: 'Dune Riders', rarity: 'uncommon', cost: 6,
    description: 'Mounted units +1 movement, and +25% strength when fighting from or on desert.',
    flavor: 'The sand swallows armies. It carries us.',
    tags: ['desert', 'conquest'], icon: 'mounted', art: { hue: 38, motif: 'horse' },
    effects: {
      unitMoves(_ctx, a) { if (unitClassOf(a.unit.type) === 'mounted') a.value += 1; },
      combat(_ctx, a) {
        const u = ownUnit(a);
        if (u && unitClassOf(u.type) === 'mounted' && ownTile(a).terrain === 'desert') ownMod(a, 'Dune Riders', 25);
      },
    },
  },
  {
    id: 'sacred_grove', name: 'Sacred Grove', rarity: 'uncommon', cost: 6,
    description: 'Forest and jungle tiles +1 {cul}. **+1** {splendor} per 4 forest or jungle tiles you own (max +8).',
    flavor: 'Every trunk a pillar; every canopy a vault.',
    tags: ['forest', 'culture', 'splendor'], icon: 'tree', art: { hue: 125, motif: 'tree' },
    effects: {
      tileYield(_ctx, a) { if (isWoodland(a.tile)) a.yields.cul += 1; },
      chronicle(ctx, c) { const n = Math.min(8, Math.floor(countOwnedTiles(ctx.state, ctx.player.id, isWoodland) / 4)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'wide_horizons', name: 'Wide Horizons', rarity: 'uncommon', cost: 6,
    description: '**×1.1** {splendor} for each city you own beyond your third.',
    flavor: 'The sun never sets; the cartographers never sleep.',
    tags: ['wide', 'xsplendor'], icon: 'map', art: { hue: 65, motif: 'compass' },
    unlock: { text: 'Own 8 cities at the end of a run.', rule: 'cities8' },
    effects: {
      chronicle(_ctx, c) { mul(c, Math.pow(1.1, Math.max(0, c.cities.length - 3))); },
    },
  },
  {
    id: 'imperial_census', name: 'Imperial Census', rarity: 'uncommon', cost: 6,
    description: '**+4** {renown} per citizen in your empire.',
    flavor: 'Counted, named, and glorious.',
    tags: ['growth', 'wide', 'renown'], icon: 'city', art: { hue: 70, motif: 'scroll' },
    effects: {
      chronicle(_ctx, c) { let n = 0; for (const x of c.cities) n += x.pop; if (n) c.addRenown(4 * n); },
    },
  },
  {
    id: 'philosopher_kings', name: 'Philosopher Kings', rarity: 'uncommon', cost: 6,
    description: '**×1.5** {splendor} if you own 3 or fewer cities.',
    flavor: 'Until philosophers rule, cities will have no rest.',
    tags: ['tall', 'xsplendor'], icon: 'owl', art: { hue: 240, motif: 'owl' },
    effects: {
      chronicle(_ctx, c) { if (c.cities.length > 0 && c.cities.length <= 3) mul(c, 1.5); },
    },
  },
  {
    id: 'hanging_terraces', name: 'Hanging Terraces', rarity: 'uncommon', cost: 6,
    description: '**+3** {splendor} for each city with 10 or more pop.',
    flavor: 'Gardens stacked to the clouds, and people beneath them.',
    tags: ['tall', 'growth', 'splendor'], icon: 'prosperity', art: { hue: 100, motif: 'tower' },
    effects: {
      chronicle(_ctx, c) { const n = c.cities.filter((x) => x.pop >= 10).length; if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'veterans_pride', name: "Veterans' Pride", rarity: 'uncommon', cost: 6,
    description: 'Units at full health +20% strength when attacking.',
    flavor: 'Not a scratch — yet.',
    tags: ['conquest'], icon: 'hp', art: { hue: 2, motif: 'lion' },
    effects: {
      combat(_ctx, a) { if (a.side === 'attack' && a.attacker && a.attacker.hp >= 100) ownMod(a, "Veterans' Pride", 20); },
    },
  },
  {
    id: 'conquerors_spoils', name: "Conqueror's Spoils", rarity: 'uncommon', cost: 6,
    description: 'Capturing a city grants **+2** {influence} and **+100** {gold}. **+3** {splendor} per city captured this run.',
    flavor: 'To the victor, the vaults.',
    tags: ['conquest', 'influence', 'gold', 'splendor'], icon: 'crown', art: { hue: 358, motif: 'crown' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'cityCaptured' || ev.to !== ctx.player.id || ev.from === ctx.player.id) return;
        addInfluence(ctx.state, 2, ctx.emit);
        addGold(ctx.state, ctx.player.id, 100, "Conqueror's Spoils", ctx.emit);
        ctx.flash('+2 influence, +100 gold', ev.tile);
      },
      chronicle(ctx, c) { const n = ctx.state.run.totals.citiesCaptured; if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'bounty_board', name: 'Bounty Board', rarity: 'uncommon', cost: 6,
    description: 'Clearing a barbarian camp grants **+2** {influence}.',
    flavor: 'Wanted: brave fools. Reward: generous.',
    tags: ['barbarian', 'influence'], icon: 'skull', art: { hue: 20, motif: 'scroll' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'campCleared' || ev.player !== ctx.player.id) return;
        addInfluence(ctx.state, 2, ctx.emit);
        ctx.flash('+2 influence', ev.tile);
      },
    },
  },
  {
    id: 'patron_of_the_arts', name: 'Patron of the Arts', rarity: 'uncommon', cost: 6,
    description: '**+1** {splendor} per Arts building you own.',
    flavor: 'Commission beauty and beauty commissions you.',
    tags: ['culture', 'splendor'], icon: 'arts', art: { hue: 305, motif: 'mask' },
    effects: {
      chronicle(ctx, c) { const n = countBuildings(ctx.state, ctx.player.id, (b) => b.pillar === 'arts'); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'grand_academy', name: 'Grand Academy', rarity: 'uncommon', cost: 6,
    description: '**+2** {splendor} per tech discovered this chapter.',
    flavor: 'Lectures at dawn. Revolutions by dusk.',
    tags: ['science', 'splendor'], icon: 'discovery', art: { hue: 228, motif: 'flask' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.techs) c.addSplendor(2 * c.stats.techs); },
    },
  },
  {
    id: 'eureka_cycle', name: 'Eureka Cycle', rarity: 'uncommon', cost: 6,
    description: 'Every 4th tech you acquire grants a free random available tech.',
    flavor: 'Three failures, then the bath overflows.',
    tags: ['science', 'scaling'], icon: 'bolt', art: { hue: 235, motif: 'bolt' },
    unlock: { text: 'Win a run as the Kethran Archive.', rule: 'winWith:kethran' },
    status(counters) { return `${(counters.techs ?? 0) % 4}/4 techs`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'techResearched' || ev.player !== ctx.player.id) return;
        ctx.counters.techs = (ctx.counters.techs ?? 0) + 1;
        if (ctx.counters.techs % 4 !== 0) return;
        const options = availableTechs(ctx.state, ctx.player.id);
        if (!options.length) return;
        const tech = options[randInt(ctx.state.rng, options.length)];
        ctx.flash('Eureka!');
        grantTech(ctx.state, ctx.player.id, tech, ctx.emit);
      },
    },
  },
  {
    id: 'usurers_guild', name: "Usurers' Guild", rarity: 'uncommon', cost: 6,
    description: 'Earn interest twice.',
    flavor: 'Money sleeps; money dreams of more money.',
    tags: ['influence', 'economy'], icon: 'influence', art: { hue: 270, motif: 'coin' },
    unlock: { text: 'Earn 5 Triumphs in a single run.', rule: 'triumphs5' },
    effects: {
      influenceIncome(_ctx, a) {
        let n = 0;
        for (const l of a.lines) if (l.amount > 0 && /interest/i.test(l.label)) n += l.amount;
        if (n > 0) a.lines.push({ label: "Usurers' Guild interest", amount: n });
      },
    },
  },
  {
    id: 'merchant_princes', name: 'Merchant Princes', rarity: 'uncommon', cost: 6,
    description: 'Luxury resource tiles +2 {gold}. **+2** {splendor} per distinct luxury you own.',
    flavor: 'Silk for the court, spice for the soup, pearls for the portrait.',
    tags: ['gold', 'splendor', 'happiness'], icon: 'gems', art: { hue: 45, motif: 'chalice' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.resource && RESOURCES[a.tile.resource]?.kind === 'luxury') a.yields.gold += 2; },
      chronicle(ctx, c) { const n = luxuriesOwned(ctx.state, ctx.player.id); if (n) c.addSplendor(2 * n); },
    },
  },
  {
    id: 'harvest_festival', name: 'Harvest Festival', rarity: 'uncommon', cost: 6,
    description: 'Farms +1 {food}. **+1** {splendor} per 4 farms you own.',
    flavor: 'Dance on the stubble; the barns are full.',
    tags: ['growth', 'splendor'], icon: 'farm', art: { hue: 88, motif: 'wheat' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.improvement === 'farm' && !a.tile.pillaged) a.yields.food += 1; },
      chronicle(ctx, c) { const n = Math.floor(countOwnedTiles(ctx.state, ctx.player.id, (t) => t.improvement === 'farm' && !t.pillaged) / 4); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'cornucopia', name: 'Cornucopia', rarity: 'uncommon', cost: 6,
    description: 'Whenever one of your cities grows, it gains **+8** {prod} toward its current build.',
    flavor: 'More hands, more hammers.',
    tags: ['growth', 'production'], icon: 'wheat', art: { hue: 78, motif: 'chalice' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'cityGrew' || ev.player !== ctx.player.id) return;
        const city = ctx.state.cities[ev.cityId];
        if (!city) return;
        city.prodStored += 8;
        ctx.flash('+8 production', city.tile);
      },
    },
  },
  {
    id: 'forge_of_ages', name: 'Forge of Ages', rarity: 'uncommon', cost: 6,
    description: 'Every city +1 {prod} per 3 pop.',
    flavor: 'The furnace was lit before the first king, and never went out.',
    tags: ['production', 'tall'], icon: 'forge', art: { hue: 18, motif: 'flame' },
    effects: {
      cityYield(_ctx, a) { a.yields.prod += Math.floor(a.city.pop / 3); },
    },
  },
  {
    id: 'hammers_of_glory', name: 'Hammers of Glory', rarity: 'uncommon', cost: 6,
    description: '**+2** {renown} per {prod} your cities make each turn.',
    flavor: 'Sweat becomes stone becomes story.',
    tags: ['production', 'renown'], icon: 'prod', art: { hue: 24, motif: 'gear' },
    effects: {
      chronicle(_ctx, c) { let n = 0; for (const x of c.cities) n += x.yields.prod; n = Math.floor(n); if (n > 0) c.addRenown(2 * n); },
    },
  },
  {
    id: 'jubilee', name: 'Jubilee', rarity: 'uncommon', cost: 6,
    description: '**×1.5** {splendor} if empire happiness is 10 or more.',
    flavor: 'Bells in every tower, wine in every fountain.',
    tags: ['happiness', 'xsplendor'], icon: 'happy', art: { hue: 325, motif: 'laurel' },
    effects: {
      chronicle(ctx, c) { if (ctx.player.happiness >= 10) mul(c, 1.5); },
    },
  },
  {
    id: 'black_market', name: 'Black Market', rarity: 'uncommon', cost: 6,
    description: 'The Council offers **1** extra Doctrine card.',
    flavor: "Don't ask where it came from. Don't tell where it goes.",
    tags: ['influence', 'shop'], icon: 'doctrine', art: { hue: 262, motif: 'mask' },
    unlock: { text: 'Reach the Medieval era.', rule: 'reachEra3' },
    effects: {
      council(ctx, a) { pushDoctrineCard(ctx.state, a.council); },
    },
  },
  {
    id: 'pack_rat', name: 'Pack Rat', rarity: 'uncommon', cost: 6,
    description: 'Packs in the Council cost **2** {influence} less.',
    flavor: 'One more crate. There is always room for one more crate.',
    tags: ['influence', 'shop'], icon: 'pack', art: { hue: 268, motif: 'key' },
    effects: {
      ...COUNCIL_REPRICER,
    },
  },
  {
    id: 'edict_hoard', name: 'Edict Hoard', rarity: 'uncommon', cost: 6,
    description: '**+1** Edict slot.',
    flavor: 'A decree in the drawer is worth two on the wall.',
    tags: ['edict'], icon: 'edict', art: { hue: 285, motif: 'scroll' },
    effects: {
      onGain(ctx) { ctx.state.run.edictSlots += 1; },
      onLose(ctx) { ctx.state.run.edictSlots = Math.max(0, ctx.state.run.edictSlots - 1); },
    },
  },
  {
    id: 'arcane_recycler', name: 'Arcane Recycler', rarity: 'uncommon', cost: 6,
    description: 'Whenever you use an Edict, 1 in 3 chance to gain a random Edict (if you have room).',
    flavor: 'Ink, once spent, can be persuaded to return.',
    tags: ['edict', 'risk'], icon: 'reroll', art: { hue: 292, motif: 'serpent' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'edictUsed' || !ctx.player.isHuman) return;
        const run = ctx.state.run;
        if (run.edicts.length >= run.edictSlots) return;
        if (randInt(ctx.state.rng, 3) !== 0) return;
        const locked = ctx.state.config.locked ?? [];
        const pool = Object.keys(EDICTS).filter((id) => !locked.includes(id));
        if (!pool.length) return;
        const id = pool[randInt(ctx.state.rng, pool.length)];
        run.edicts.push({ uid: run.nextUid++, id });
        ctx.flash(`+${EDICTS[id].name}`);
      },
    },
  },
  {
    id: 'focus_lens', name: 'Focus Lens', rarity: 'uncommon', cost: 6,
    description: "Adds your Focus pillar's base {splendor} again.",
    flavor: 'Gather the light, and set the page aflame.',
    tags: ['focus', 'scroll', 'splendor'], icon: 'eye', art: { hue: 55, motif: 'eye' },
    effects: {
      chronicle(ctx, c) {
        const def = PILLAR_DEFS[c.focus];
        if (def) c.addSplendor(def.splendor(ctx.state.run.pillarLevels[c.focus] ?? 1));
      },
    },
  },
  {
    id: 'pillar_harmony', name: 'Pillar Harmony', rarity: 'uncommon', cost: 6,
    description: '**×1.5** {splendor} if every pillar produced {renown} this chapter.',
    flavor: 'Six columns, one roof.',
    tags: ['focus', 'xsplendor'], icon: 'glory', art: { hue: 42, motif: 'temple' },
    unlock: { text: 'Score 100,000 Legacy in a single Chronicle.', rule: 'score100k' },
    effects: {
      chronicle(ctx, c) { if (PILLARS.every((p) => pillarRenown(ctx.state, c.stats, p) > 0)) mul(c, 1.5); },
    },
  },
  {
    id: 'crisis_forged', name: 'Crisis-Forged', rarity: 'uncommon', cost: 6,
    description: 'Gains **+2** {splendor} permanently each time you pass a Crisis chapter.',
    flavor: 'What does not end us, engraves us.',
    tags: ['crisis', 'scaling', 'splendor'], icon: 'crisis', art: { hue: 348, motif: 'flame' },
    unlock: { text: 'Win a run as the Celestine Veil.', rule: 'winWith:celestine' },
    status(counters) { return `+${counters.splendor ?? 0} Splendor`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle' || ev.result.chapter !== 2 || !ev.result.passed) return;
        ctx.counters.splendor = (ctx.counters.splendor ?? 0) + 2;
        ctx.flash(`+${ctx.counters.splendor} Splendor`);
      },
      chronicle(ctx, c) { const n = ctx.counters.splendor ?? 0; if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'doomsayers', name: 'Doomsayers', rarity: 'uncommon', cost: 6,
    description: '**×1.5** {splendor} during a Crisis chapter.',
    flavor: 'We told you so, and now we sing of it.',
    tags: ['crisis', 'xsplendor'], icon: 'skull', art: { hue: 352, motif: 'eye' },
    effects: {
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) mul(c, 1.5); },
    },
  },
  {
    id: 'blood_price', name: 'Blood Price', rarity: 'uncommon', cost: 6,
    description: '**×2** {splendor}. After every Chronicle, your largest city loses 1 pop.',
    flavor: 'Glory is never free. It sends its bill in children.',
    tags: ['risk', 'xsplendor'], icon: 'unhappy', art: { hue: 350, motif: 'chalice' },
    unlock: { text: 'Win a run on Ascension 2.', rule: 'winAsc2' },
    effects: {
      chronicle(_ctx, c) { mul(c, 2); },
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle') return;
        let largest: City | null = null;
        for (const city of citiesOf(ctx.state, ctx.player.id)) if (!largest || city.pop > largest.pop) largest = city;
        if (largest && largest.pop > 1) {
          changePop(ctx.state, largest, -1, ctx.emit);
          ctx.flash('-1 pop', largest.tile);
        }
      },
    },
  },
  {
    id: 'aeon_clock', name: 'Aeon Clock', rarity: 'uncommon', cost: 6,
    description: '**×1** {splendor}, gaining **+×0.1** after every Chronicle.',
    flavor: 'Tick. Tock. Empire.',
    tags: ['scaling', 'xsplendor'], icon: 'hourglass', art: { hue: 210, motif: 'hourglass' },
    unlock: { text: 'Play 3 runs.', rule: 'runs3' },
    status(counters) { return `×${(1 + 0.1 * (counters.ticks ?? 0)).toFixed(1)} Splendor`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle') return;
        ctx.counters.ticks = (ctx.counters.ticks ?? 0) + 1;
        ctx.flash(`×${(1 + 0.1 * ctx.counters.ticks).toFixed(1)}`);
      },
      chronicle(ctx, c) { mul(c, 1 + 0.1 * (ctx.counters.ticks ?? 0)); },
    },
  },
  {
    id: 'glory_hunters', name: 'Glory Hunters', rarity: 'uncommon', cost: 6,
    description: '**+3** {splendor} per Wonder you own.',
    flavor: 'Build it tall enough and the gods must look.',
    tags: ['wonders', 'splendor'], icon: 'wonder', art: { hue: 40, motif: 'pyramid' },
    effects: {
      chronicle(ctx, c) { const n = countWonders(ctx.state, ctx.player.id); if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'relic_hunters', name: 'Relic Hunters', rarity: 'uncommon', cost: 6,
    description: '**+40** {renown} per natural wonder you have discovered. **+1** {happy} each.',
    flavor: 'The world is the greatest museum; we merely label it.',
    tags: ['exploration', 'wonders', 'renown', 'happiness'], icon: 'explore', art: { hue: 170, motif: 'compass' },
    effects: {
      chronicle(ctx, c) { const n = ctx.state.naturalWondersSeen[ctx.player.id]?.length ?? 0; if (n) c.addRenown(40 * n); },
      happiness(ctx, a) { a.value += ctx.state.naturalWondersSeen[ctx.player.id]?.length ?? 0; },
    },
  },
  {
    id: 'citizen_militia', name: 'Citizen Militia', rarity: 'uncommon', cost: 6,
    description: 'Your cities +25% strength when defending.',
    flavor: 'Bakers with pikes. Poets with crossbows.',
    tags: ['conquest', 'crisis'], icon: 'walls', art: { hue: 28, motif: 'castle' },
    effects: {
      combat(_ctx, a) { if (a.side === 'defense' && a.defenderCity && !a.defender) ownMod(a, 'Citizen Militia', 25); },
    },
  },
  {
    id: 'silk_roads', name: 'Silk Roads', rarity: 'uncommon', cost: 6,
    description: 'Cities with a Market +3 {gold} and +1 {cul}.',
    flavor: 'A thread of silk can bind two empires.',
    tags: ['gold', 'culture'], icon: 'silk', art: { hue: 50, motif: 'compass' },
    effects: {
      cityYield(_ctx, a) { if (cityHas(a.city, 'market')) { a.yields.gold += 3; a.yields.cul += 1; } },
    },
  },
  {
    id: 'conscripts', name: 'Conscripts', rarity: 'uncommon', cost: 6,
    description: 'Military units cost 20% less {prod}.',
    flavor: 'Every village sends its sons, and every son a spear.',
    tags: ['conquest', 'production'], icon: 'melee', art: { hue: 6, motif: 'sword' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'unit' && unitClassOf(a.item.id) !== 'civilian') a.cost *= 0.8; },
    },
  },
  {
    id: 'pilgrimage', name: 'Pilgrimage', rarity: 'uncommon', cost: 6,
    description: 'Each Temple and Shrine +2 {cul} and +1 {happy}.',
    flavor: 'The road is the prayer.',
    tags: ['culture', 'happiness'], icon: 'temple', art: { hue: 318, motif: 'temple' },
    effects: {
      cityYield(_ctx, a) { a.yields.cul += 2 * shrineCount(a.city); },
      happiness(ctx, a) { for (const city of citiesOf(ctx.state, ctx.player.id)) a.value += shrineCount(city); },
    },
  },
  {
    id: 'council_seat', name: 'Council Seat', rarity: 'uncommon', cost: 6,
    description: '**+1** {influence} per chapter for each Reform you own.',
    flavor: 'Every law you pass buys another chair at the table.',
    tags: ['influence', 'economy'], icon: 'reform', art: { hue: 278, motif: 'crown' },
    effects: {
      influenceIncome(ctx, a) { const n = ctx.state.run.reforms.length; if (n) a.lines.push({ label: 'Council Seat', amount: n }); },
    },
  },
];

const RARE: DoctrineDef[] = [
  {
    id: 'echo', name: 'Echo', rarity: 'rare', cost: 8,
    description: 'Copies the Chronicle effect of the doctrine to its right.',
    flavor: 'Said once, it is news. Said twice, it is law.',
    tags: ['position', 'copy'], icon: 'chevronRight', art: { hue: 190, motif: 'feather' },
    unlock: { text: 'Reach the Renaissance era.', rule: 'reachEra4' },
    effects: {
      chronicle(ctx, c) {
        const i = doctrineIndex(ctx.state, ctx.uid);
        if (i >= 0) copyChronicle(ctx, ctx.state.run.doctrines[i + 1], c);
      },
    },
  },
  {
    id: 'keystone', name: 'Keystone', rarity: 'rare', cost: 8,
    description: '**×1** {splendor}, plus **×0.25** for each doctrine to its left.',
    flavor: 'The last stone set holds up all the others.',
    tags: ['position', 'xsplendor'], icon: 'castle', art: { hue: 36, motif: 'key' },
    unlock: { text: 'Reach the Medieval era.', rule: 'reachEra3' },
    effects: {
      chronicle(ctx, c) { const i = doctrineIndex(ctx.state, ctx.uid); if (i > 0) mul(c, 1 + 0.25 * i); },
    },
  },
  {
    id: 'iron_oath', name: 'Iron Oath', rarity: 'rare', cost: 8,
    description: '**×3** {splendor}. Lose 1 {mandate} whenever you make peace.',
    flavor: 'We swore on the anvil. The anvil does not forgive.',
    tags: ['conquest', 'risk', 'xsplendor'], icon: 'war', art: { hue: 0, motif: 'sword' },
    unlock: { text: 'Slay 40 enemy units in a single run.', rule: 'kills40' },
    effects: {
      chronicle(_ctx, c) { mul(c, 3); },
      onEvent(ctx, ev) {
        if (ev.type !== 'peaceMade' || (ev.a !== ctx.player.id && ev.b !== ctx.player.id)) return;
        ctx.flash('Oath broken!');
        changeMandate(ctx.state, -1, 'Iron Oath broken', ctx.emit);
      },
    },
  },
  {
    id: 'collectors_cabinet', name: "Collector's Cabinet", rarity: 'rare', cost: 8,
    description: '**×1.25** {splendor} for each doctrine with an edition.',
    flavor: 'Rare, rarer, mine.',
    tags: ['edition', 'xsplendor'], icon: 'star', art: { hue: 55, motif: 'key' },
    unlock: { text: 'End a run owning a Legendary doctrine.', rule: 'legendary' },
    effects: {
      chronicle(ctx, c) { const n = ctx.state.run.doctrines.filter((d) => d.edition !== 'base').length; if (n) mul(c, Math.pow(1.25, n)); },
    },
  },
  {
    id: 'warlords_crown', name: "Warlord's Crown", rarity: 'rare', cost: 8,
    description: '**×1** {splendor}, plus **×0.5** for each city you captured this chapter.',
    flavor: 'Heavy is the head, and heavier the plunder.',
    tags: ['conquest', 'xsplendor'], icon: 'crown', art: { hue: 356, motif: 'crown' },
    unlock: { text: 'Win a run as the Varkhan Horde.', rule: 'winWith:varkhan' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.citiesCaptured) mul(c, 1 + 0.5 * c.stats.citiesCaptured); },
    },
  },
  {
    id: 'codex_infinitum', name: 'Codex Infinitum', rarity: 'rare', cost: 8,
    description: '**+1** {splendor} per 3 techs you know.',
    flavor: 'The final page is always blank.',
    tags: ['science', 'splendor', 'scaling'], icon: 'book', art: { hue: 238, motif: 'book' },
    unlock: { text: 'Discover 24 techs in a single run.', rule: 'techs24' },
    status(_counters, state) { return `+${Math.floor((state.players[0]?.techs.length ?? 0) / 3)} Splendor`; },
    effects: {
      chronicle(ctx, c) { const n = Math.floor(ctx.player.techs.length / 3); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'momentum', name: 'Momentum', rarity: 'rare', cost: 8,
    description: '**×2** {splendor} if your previous Chronicle was a Triumph.',
    flavor: 'Glory begets glory.',
    tags: ['risk', 'xsplendor'], icon: 'arrowUp', art: { hue: 48, motif: 'eagle' },
    unlock: { text: 'Earn 5 Triumphs in a single run.', rule: 'triumphs5' },
    status(_counters, state) { return state.run.lastChronicle?.triumph ? 'Active: ×2 Splendor' : 'Inactive'; },
    effects: {
      chronicle(ctx, c) { if (ctx.state.run.lastChronicle?.triumph) mul(c, 2); },
    },
  },
  {
    id: 'river_of_gold', name: 'River of Gold', rarity: 'rare', cost: 8,
    description: 'River tiles +1 {gold}. **×1.5** {splendor} if your capital is on a river.',
    flavor: 'The current carries silt, and silt becomes silver.',
    tags: ['river', 'gold', 'xsplendor'], icon: 'river', art: { hue: 46, motif: 'river' },
    effects: {
      tileYield(_ctx, a) { if (isRiverTile(a.tile)) a.yields.gold += 1; },
      chronicle(ctx, c) { const cap = c.cities.find((x) => x.isCapital); if (cap && isRiverCity(ctx.state, cap)) mul(c, 1.5); },
    },
  },
  {
    id: 'sky_citadels', name: 'Sky Citadels', rarity: 'rare', cost: 8,
    description: 'Cities on hills +20% {prod}. **+3** {splendor} per city on hills.',
    flavor: 'Built where the eagles argue with the wind.',
    tags: ['mountain', 'production', 'splendor'], icon: 'castle', art: { hue: 205, motif: 'castle' },
    unlock: { text: 'Win a run as the Morvane Forgeholds.', rule: 'winWith:morvane' },
    effects: {
      cityYield(ctx, a) { if (cityTileOf(ctx.state, a.city).elevation === 'hills') a.pct.prod += 20; },
      chronicle(ctx, c) { const n = c.cities.filter((x) => cityTileOf(ctx.state, x).elevation === 'hills').length; if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'desert_bloom', name: 'Desert Bloom', rarity: 'rare', cost: 8,
    description: 'Desert tiles +2 {food}. **+1** {splendor} per 3 desert tiles you own.',
    flavor: 'One rain in ten years, and the sands wake in flowers.',
    tags: ['desert', 'growth', 'splendor'], icon: 'food', art: { hue: 42, motif: 'sun' },
    unlock: { text: 'Win a run as the Ashkari Sultanate.', rule: 'winWith:ashkari' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'desert') a.yields.food += 2; },
      chronicle(ctx, c) { const n = Math.floor(countOwnedTiles(ctx.state, ctx.player.id, (t) => t.terrain === 'desert') / 3); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'elder_canopy', name: 'Elder Canopy', rarity: 'rare', cost: 8,
    description: '**×1.5** {splendor} if you own 12 or more forest or jungle tiles.',
    flavor: 'Beneath the old boughs, time walks slower.',
    tags: ['forest', 'xsplendor'], icon: 'tree', art: { hue: 128, motif: 'tree' },
    unlock: { text: 'Win a run as the Sylvaran Wilds.', rule: 'winWith:sylvaran' },
    status(_counters, state) { return `${countOwnedTiles(state, 0, isWoodland)}/12 woodland tiles`; },
    effects: {
      chronicle(ctx, c) { if (countOwnedTiles(ctx.state, ctx.player.id, isWoodland) >= 12) mul(c, 1.5); },
    },
  },
  {
    id: 'alchemy', name: 'Alchemy', rarity: 'rare', cost: 8,
    description: '**+1** {renown} per {gold} earned this chapter.',
    flavor: 'Lead into gold is child\'s play. Gold into glory — that is the art.',
    tags: ['gold', 'renown'], icon: 'flask', art: { hue: 52, motif: 'flask' },
    effects: {
      chronicle(_ctx, c) { const n = Math.floor(c.stats.gold); if (n > 0) c.addRenown(n); },
    },
  },
  {
    id: 'imperial_mandate', name: 'Imperial Mandate', rarity: 'rare', cost: 8,
    description: '**+1** max {mandate} and restore 1 {mandate}.',
    flavor: 'The heavens renew their lease.',
    tags: ['crisis', 'mandate'], icon: 'mandate', art: { hue: 44, motif: 'sun' },
    unlock: { text: 'Win a run without losing any Mandate.', rule: 'noMandateLost' },
    effects: {
      onGain(ctx) {
        ctx.state.run.maxMandate += 1;
        changeMandate(ctx.state, 1, 'Imperial Mandate', ctx.emit);
      },
      onLose(ctx) {
        const run = ctx.state.run;
        run.maxMandate = Math.max(1, run.maxMandate - 1);
        if (run.mandate > run.maxMandate) changeMandate(ctx.state, run.maxMandate - run.mandate, 'Imperial Mandate lost', ctx.emit);
      },
    },
  },
  {
    id: 'marshals_baton', name: "Marshal's Baton", rarity: 'rare', cost: 8,
    description: 'All your units +1 movement.',
    flavor: 'Where it points, the army already is.',
    tags: ['conquest', 'exploration'], icon: 'moves', art: { hue: 8, motif: 'eagle' },
    effects: {
      unitMoves(_ctx, a) { a.value += 1; },
    },
  },
  {
    id: 'edifice_complex', name: 'Edifice Complex', rarity: 'rare', cost: 8,
    description: '**+1** {splendor} per 4 buildings you own.',
    flavor: 'If it stands, it counts.',
    tags: ['production', 'splendor', 'scaling'], icon: 'building', art: { hue: 32, motif: 'tower' },
    effects: {
      chronicle(ctx, c) { const n = Math.floor(countBuildings(ctx.state, ctx.player.id) / 4); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'campfire_tales', name: 'Campfire Tales', rarity: 'rare', cost: 8,
    description: 'Gains **+2** {splendor} whenever another doctrine is sold or destroyed.',
    flavor: 'Old heroes, told around new flames.',
    tags: ['scaling', 'splendor', 'shop'], icon: 'flame', art: { hue: 22, motif: 'flame' },
    unlock: { text: 'Play 3 runs.', rule: 'runs3' },
    status(counters) { return `+${counters.splendor ?? 0} Splendor`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'doctrineLost' || ev.uid === ctx.uid) return;
        ctx.counters.splendor = (ctx.counters.splendor ?? 0) + 2;
        ctx.flash(`+${ctx.counters.splendor} Splendor`);
      },
      chronicle(ctx, c) { const n = ctx.counters.splendor ?? 0; if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'harbinger', name: 'Harbinger', rarity: 'rare', cost: 8,
    description: 'Crisis chapter targets +25%, but **×2.5** {splendor} during Crisis chapters.',
    flavor: 'I have seen the end, and it applauds.',
    tags: ['crisis', 'risk', 'xsplendor'], icon: 'crisis', art: { hue: 345, motif: 'skull' },
    unlock: { text: 'Survive 6 Crisis chapters in a single run.', rule: 'crises6' },
    effects: {
      target(ctx, a) { if (ctx.state.run.chapter === 2) a.value *= 1.25; },
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) mul(c, 2.5); },
    },
  },
  {
    id: 'glass_crown', name: 'Glass Crown', rarity: 'rare', cost: 8,
    description: '**×4** {splendor}. Shatters if you fail a Chronicle.',
    flavor: 'Beautiful. Brittle. Blinding.',
    tags: ['risk', 'xsplendor'], icon: 'crown', art: { hue: 180, motif: 'crown' },
    unlock: { text: 'Win a run on Ascension 4.', rule: 'winAsc4' },
    effects: {
      chronicle(_ctx, c) { mul(c, 4); },
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle' || ev.result.passed || ctx.uid == null) return;
        ctx.flash('Shattered!');
        destroyDoctrine(ctx.state, ctx.uid, ctx.emit);
      },
    },
  },
  {
    id: 'banner_of_ascendancy', name: 'Banner of Ascendancy', rarity: 'rare', cost: 8,
    description: 'Your units +20% strength. **+1** {splendor} per enemy unit killed this chapter.',
    flavor: 'Where it flies, the ground changes owners.',
    tags: ['conquest', 'splendor'], icon: 'sword', art: { hue: 3, motif: 'lion' },
    effects: {
      combat(_ctx, a) { if (ownUnit(a)) ownMod(a, 'Banner of Ascendancy', 20); },
      chronicle(_ctx, c) { if (c.stats.kills) c.addSplendor(c.stats.kills); },
    },
  },
  {
    id: 'dynasty', name: 'Dynasty', rarity: 'rare', cost: 8,
    description: '**×1** {splendor}, gaining **+×0.5** at the start of every Era.',
    flavor: 'Kings die. The name does not.',
    tags: ['scaling', 'xsplendor'], icon: 'crown', art: { hue: 40, motif: 'lion' },
    unlock: { text: 'Reach the Industrial era.', rule: 'reachEra5' },
    status(counters) { return `×${1 + 0.5 * (counters.eras ?? 0)} Splendor`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'eraStarted') return;
        ctx.counters.eras = (ctx.counters.eras ?? 0) + 1;
        ctx.flash(`×${1 + 0.5 * ctx.counters.eras}`);
      },
      chronicle(ctx, c) { mul(c, 1 + 0.5 * (ctx.counters.eras ?? 0)); },
    },
  },
  {
    id: 'scholars_quill', name: "Scholar's Quill", rarity: 'rare', cost: 8,
    description: '**×1.2** {splendor} for each level of your Focus pillar above 1.',
    flavor: 'One subject, mastered utterly.',
    tags: ['focus', 'scroll', 'xsplendor'], icon: 'feather', art: { hue: 248, motif: 'feather' },
    unlock: { text: 'Score 100,000 Legacy in a single Chronicle.', rule: 'score100k' },
    effects: {
      chronicle(ctx, c) { const n = Math.max(0, (ctx.state.run.pillarLevels[c.focus] ?? 1) - 1); if (n) mul(c, Math.pow(1.2, n)); },
    },
  },
  {
    id: 'silver_tongue', name: 'Silver Tongue', rarity: 'rare', cost: 8,
    description: 'Everything in the Council costs **1** {influence} less.',
    flavor: 'Flattery is the cheapest currency, and the most accepted.',
    tags: ['influence', 'shop'], icon: 'influence', art: { hue: 272, motif: 'hand' },
    unlock: { text: 'Play 10 runs.', rule: 'runs10' },
    effects: {
      ...COUNCIL_REPRICER,
    },
  },
];

const LEGENDARY: DoctrineDef[] = [
  {
    id: 'mirror_court', name: 'Mirror Court', rarity: 'legendary', cost: 12,
    description: 'Copies the Chronicle effect of your leftmost doctrine, then **×1.5** {splendor}.',
    flavor: 'A thousand reflections, and every one a king.',
    tags: ['position', 'copy', 'xsplendor'], icon: 'eye', art: { hue: 200, motif: 'eye' },
    unlock: { text: 'Win a run on Ascension 2.', rule: 'winAsc2' },
    effects: {
      chronicle(ctx, c) {
        const first = ctx.state.run.doctrines[0];
        if (first && first.uid !== ctx.uid) copyChronicle(ctx, first, c);
        mul(c, 1.5);
      },
    },
  },
  {
    id: 'eternal_emperor', name: 'The Eternal Emperor', rarity: 'legendary', cost: 12,
    description: 'Gains **+×1** {splendor} whenever you capture a city (starts at ×1).',
    flavor: 'Every crown he takes, he wears at once.',
    tags: ['conquest', 'scaling', 'xsplendor'], icon: 'crown', art: { hue: 350, motif: 'crown' },
    unlock: { text: 'Capture 5 cities in a single run.', rule: 'capture5' },
    status(counters) { return `×${1 + (counters.captures ?? 0)} Splendor`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'cityCaptured' || ev.to !== ctx.player.id || ev.from === ctx.player.id) return;
        ctx.counters.captures = (ctx.counters.captures ?? 0) + 1;
        ctx.flash(`×${1 + ctx.counters.captures}`, ev.tile);
      },
      chronicle(ctx, c) { mul(c, 1 + (ctx.counters.captures ?? 0)); },
    },
  },
  {
    id: 'golden_sovereign', name: 'The Golden Sovereign', rarity: 'legendary', cost: 12,
    description: '**×1.25** {splendor} for each city with 12 or more pop.',
    flavor: 'Her cities are crowns, and she wears them all.',
    tags: ['tall', 'growth', 'xsplendor'], icon: 'crown', art: { hue: 46, motif: 'sun' },
    unlock: { text: 'Own 8 cities at the end of a run.', rule: 'cities8' },
    effects: {
      chronicle(_ctx, c) { const n = c.cities.filter((x) => x.pop >= 12).length; if (n) mul(c, Math.pow(1.25, n)); },
    },
  },
  {
    id: 'undying_architect', name: 'The Undying Architect', rarity: 'legendary', cost: 12,
    description: 'Gains **+×0.5** {splendor} for every 8 buildings you construct (starts at ×1).',
    flavor: 'He has been building the same city for four thousand years.',
    tags: ['production', 'scaling', 'xsplendor'], icon: 'building', art: { hue: 30, motif: 'tower' },
    unlock: { text: 'Build 4 Wonders in a single run.', rule: 'wonders4' },
    status(counters) { const n = counters.built ?? 0; return `×${1 + 0.5 * Math.floor(n / 8)} Splendor (${n % 8}/8)`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'buildingBuilt' || ev.player !== ctx.player.id || ev.building === 'palace') return;
        ctx.counters.built = (ctx.counters.built ?? 0) + 1;
        if (ctx.counters.built % 8 === 0) ctx.flash(`×${1 + 0.5 * (ctx.counters.built / 8)}`);
      },
      chronicle(ctx, c) { mul(c, 1 + 0.5 * Math.floor((ctx.counters.built ?? 0) / 8)); },
    },
  },
  {
    id: 'the_unbowed', name: 'The Unbowed', rarity: 'legendary', cost: 12,
    description: 'Crisis target multipliers are ignored, and **×3** {splendor} during Crisis chapters.',
    flavor: 'Let the sky fall. We have a roof.',
    tags: ['crisis', 'xsplendor'], icon: 'shield', art: { hue: 340, motif: 'shield' },
    unlock: { text: 'Survive 6 Crisis chapters in a single run.', rule: 'crises6' },
    effects: {
      target(ctx, a) {
        const run = ctx.state.run;
        if (run.chapter !== 2 || !run.crisis) return;
        const m = CRISES[run.crisis]?.targetMul ?? 1;
        if (m > 0) a.value /= m;
      },
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) mul(c, 3); },
    },
  },
  {
    id: 'the_archivist', name: 'The Archivist', rarity: 'legendary', cost: 12,
    description: 'At the start of every chapter, duplicate a random Edict you hold (up to 2 over your slot limit).',
    flavor: 'Nothing is lost. Everything is filed. Twice.',
    tags: ['edict', 'scaling'], icon: 'scroll', art: { hue: 288, motif: 'scroll' },
    unlock: { text: 'Complete 5 Omens in a single run.', rule: 'omens5' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'chapterStarted' || !ctx.player.isHuman) return;
        const run = ctx.state.run;
        if (!run.edicts.length || run.edicts.length >= run.edictSlots + 2) return;
        const src = run.edicts[randInt(ctx.state.rng, run.edicts.length)];
        run.edicts.push({ uid: run.nextUid++, id: src.id });
        ctx.flash(`Copied ${EDICTS[src.id]?.name ?? 'Edict'}`);
      },
    },
  },
  {
    id: 'architect_of_ages', name: 'Architect of Ages', rarity: 'legendary', cost: 12,
    description: 'Wonders cost 30% less {prod}. **×1.5** {splendor} for each Wonder you own.',
    flavor: 'Stone outlives flesh. Wonder outlives stone.',
    tags: ['wonders', 'production', 'xsplendor'], icon: 'wonder', art: { hue: 38, motif: 'pyramid' },
    unlock: { text: 'Build 8 Wonders in a single run.', rule: 'wonders8' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'wonder') a.cost *= 0.7; },
      chronicle(ctx, c) { const n = countWonders(ctx.state, ctx.player.id); if (n) mul(c, Math.pow(1.5, n)); },
    },
  },
  {
    id: 'apotheosis', name: 'Apotheosis', rarity: 'legendary', cost: 12,
    description: 'Retriggers the Chronicle effect of every doctrine to its left.',
    flavor: 'History, sung a second time, becomes myth.',
    tags: ['position', 'copy'], icon: 'sun', art: { hue: 50, motif: 'sun' },
    unlock: { text: 'Win a run.', rule: 'win' },
    effects: {
      chronicle(ctx, c) {
        const list = ctx.state.run.doctrines;
        const i = doctrineIndex(ctx.state, ctx.uid);
        for (let k = 0; k < i; k++) copyChronicle(ctx, list[k], c);
      },
    },
  },
];

// Leader starting doctrines (never in shops).
const LEADER_DOCTRINES: DoctrineDef[] = [
  {
    id: 'solar_dynasty', name: 'Solar Dynasty', rarity: 'uncommon', cost: 6, noShop: true,
    description: '**+2** {splendor}. **×1.5** {splendor} if you completed a Wonder this chapter.',
    flavor: 'The Aurelian line was lit from the first dawn.',
    tags: ['leader', 'wonders', 'xsplendor'], icon: 'sun', art: { hue: 44, motif: 'sun' },
    effects: {
      chronicle(_ctx, c) { c.addSplendor(2); if (c.stats.wonders > 0) mul(c, 1.5); },
    },
  },
  {
    id: 'tidal_charter', name: 'Tidal Charter', rarity: 'uncommon', cost: 6, noShop: true,
    description: 'Coastal cities +1 {food}. **+1** {splendor} per coastal city.',
    flavor: 'Signed on a ship\'s deck, sealed with salt.',
    tags: ['leader', 'coastal', 'splendor'], icon: 'anchor', art: { hue: 190, motif: 'ship' },
    effects: {
      cityYield(ctx, a) { if (isCoastalCity(ctx.state, a.city)) a.yields.food += 1; },
      chronicle(ctx, c) { const n = coastalCount(ctx.state, c); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'hoofbeat_saga', name: 'Hoofbeat Saga', rarity: 'uncommon', cost: 6, noShop: true,
    description: '**+1** {splendor} per 2 enemy units killed this chapter. Your units heal 20 HP when they kill.',
    flavor: 'Sung at a gallop, in rhythm with the charge.',
    tags: ['leader', 'conquest', 'splendor'], icon: 'horse', art: { hue: 356, motif: 'horse' },
    effects: {
      onEvent(ctx, ev) {
        const kill = unitKillBy(ev, ctx.player.id);
        const u = kill ? ctx.state.units[kill.unitId] : undefined;
        if (!u) return;
        u.hp = Math.min(100, u.hp + 20);
        ctx.flash('+20 HP', u.tile);
      },
      chronicle(_ctx, c) { const n = Math.floor(c.stats.kills / 2); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'heartwood_rites', name: 'Heartwood Rites', rarity: 'uncommon', cost: 6, noShop: true,
    description: '**+1** {splendor} per 3 forest or jungle tiles you own (max +10).',
    flavor: 'Each grove a hymn; each root a verse.',
    tags: ['leader', 'forest', 'splendor'], icon: 'tree', art: { hue: 120, motif: 'tree' },
    effects: {
      chronicle(ctx, c) { const n = Math.min(10, Math.floor(countOwnedTiles(ctx.state, ctx.player.id, isWoodland) / 3)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'caravan_of_stars', name: 'Caravan of Stars', rarity: 'uncommon', cost: 6, noShop: true,
    description: '**+1** {splendor} per distinct luxury you own, and **+1** {splendor} per 4 desert tiles you own.',
    flavor: 'By night the caravans follow the same stars as the prophets.',
    tags: ['leader', 'desert', 'gold', 'splendor'], icon: 'star', art: { hue: 26, motif: 'star' },
    effects: {
      chronicle(ctx, c) {
        const n = luxuriesOwned(ctx.state, ctx.player.id) + Math.floor(countOwnedTiles(ctx.state, ctx.player.id, (t) => t.terrain === 'desert') / 4);
        if (n) c.addSplendor(n);
      },
    },
  },
  {
    id: 'infinite_codex', name: 'The Infinite Codex', rarity: 'uncommon', cost: 6, noShop: true,
    description: '**+2** {splendor} per tech discovered this chapter. Discovery pillar {renown} +25%.',
    flavor: 'Written in a hand that is never the same twice.',
    tags: ['leader', 'science', 'splendor'], icon: 'book', art: { hue: 268, motif: 'book' },
    effects: {
      chronicle(ctx, c) {
        const r = Math.round(pillarRenown(ctx.state, c.stats, 'discovery') * (c.focus === 'discovery' ? 2 : 1) * 0.25);
        if (r > 0) c.addRenown(r);
        if (c.stats.techs) c.addSplendor(2 * c.stats.techs);
      },
    },
  },
  {
    id: 'anvil_oath', name: 'Anvil Oath', rarity: 'uncommon', cost: 6, noShop: true,
    description: '**+1** {splendor} per 8 {prod} your cities make each turn.',
    flavor: 'Strike true, and the metal remembers.',
    tags: ['leader', 'production', 'splendor'], icon: 'gear', art: { hue: 212, motif: 'gear' },
    effects: {
      chronicle(_ctx, c) { let p = 0; for (const x of c.cities) p += x.yields.prod; const n = Math.floor(p / 8); if (n > 0) c.addSplendor(n); },
    },
  },
  {
    id: 'veil_of_fate', name: 'Veil of Fate', rarity: 'uncommon', cost: 6, noShop: true,
    description: '**×1.5** {splendor} during Crisis chapters. **+1** {splendor} per Omen completed this run.',
    flavor: 'The Veil does not hide the future. It frames it.',
    tags: ['leader', 'crisis', 'omen', 'xsplendor'], icon: 'eye', art: { hue: 322, motif: 'eye' },
    status(counters) { return `${counters.omens ?? 0} Omens fulfilled`; },
    effects: {
      onEvent(ctx, ev) { if (ev.type === 'omenCompleted') ctx.counters.omens = (ctx.counters.omens ?? 0) + 1; },
      chronicle(ctx, c) {
        const n = ctx.counters.omens ?? 0;
        if (n) c.addSplendor(n);
        if (ctx.state.run.crisisActive) mul(c, 1.5);
      },
    },
  },
];

export const DOCTRINES: Record<string, DoctrineDef> = Object.fromEntries(
  [...COMMON, ...UNCOMMON, ...RARE, ...LEGENDARY, ...LEADER_DOCTRINES].map((d) => [d.id, d]),
);
