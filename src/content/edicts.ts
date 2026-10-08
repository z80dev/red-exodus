// OWNER: ContentRogue. Edicts — the Balatro tarot set: one-shot decrees issued any time during play.
// Every `canUse` rejects invalid targets with a player-facing reason; `use` assumes canUse passed.
// Era-scaled numbers use the 1-based Era (Ancient = 1 … Modern = 6, Endless keeps counting).
import type { EdictDef, HookCtx } from '../sim/defs';
import type { City, Edition, FeatureId, PlayerId, Tile, TileIdx, Unit } from '../sim/types';
import { BARBARIAN, PILLARS } from '../sim/types';
import { DOCTRINES, bestUnitFor, eraNumber, isWaterTile, liveRenown, unitClassOf } from './doctrines';
import { IMPROVEMENTS } from './improvements';
import { RESOURCES } from './resources';
import { TECHS } from './techs';
import { UNITS } from './units';
import { PILLAR_DEFS } from './pillars';
import { canProduce, changePop, citiesOf, completeItem, nextBorderTile, refreshCity } from '../sim/cities';
import { addGold, availableTechs, grantTech, round1, techCost } from '../sim/economy';
import { createUnit, grantXp, XP_LEVELS, xpToNextLevel } from '../sim/units';
import { tilesInRadius } from '../sim/hex';
import { recomputeVisibility, revealArea } from '../sim/visibility';
import { chance, pick } from '../sim/rng';
import { addInfluence, changeMandate, grantDoctrine } from '../sim/roguelite';
import { doctrineSlotsUsed } from '../sim/roguelite/council';
import { canOrbitalDrop, changeCryo, dropPrice, orbitalDrop, STORM_SHELTER_COUNTER } from '../sim/mars';
import { hexDistance } from '../sim/hex';

type Target = { tile?: TileIdx; cityId?: number; unitId?: number };

// ───────────────────────────── private helpers ─────────────────────────────

function ownCityArg(ctx: HookCtx, t: Target): City | null {
  const c = t.cityId != null ? ctx.state.cities[t.cityId] : undefined;
  return c && c.owner === ctx.player.id ? c : null;
}
function cityError(ctx: HookCtx, t: Target): string | null {
  const c = t.cityId != null ? ctx.state.cities[t.cityId] : undefined;
  if (!c) return 'Choose a colony';
  if (c.owner !== ctx.player.id) return 'Choose one of your colonies';
  return null;
}
function ownUnitArg(ctx: HookCtx, t: Target): Unit | null {
  const u = t.unitId != null ? ctx.state.units[t.unitId] : undefined;
  return u && u.owner === ctx.player.id ? u : null;
}
function unitError(ctx: HookCtx, t: Target, military: boolean): string | null {
  const u = t.unitId != null ? ctx.state.units[t.unitId] : undefined;
  if (!u) return 'Choose a unit';
  if (u.owner !== ctx.player.id) return 'Choose one of your units';
  if (!UNITS[u.type]) return 'Unknown unit';
  if (military && unitClassOf(u.type) === 'civilian') return 'Choose a combat unit';
  return null;
}
function ownTileArg(ctx: HookCtx, t: Target): Tile | null {
  const tile = t.tile != null ? ctx.state.map.tiles[t.tile] : undefined;
  return tile && tile.owner === ctx.player.id ? tile : null;
}
function ownedLandError(ctx: HookCtx, t: Target): string | null {
  const tile = t.tile != null ? ctx.state.map.tiles[t.tile] : undefined;
  if (!tile) return 'Choose a tile';
  if (tile.owner !== ctx.player.id) return 'Choose a tile inside your borders';
  if (isWaterTile(tile)) return 'Water cannot be changed';
  if (tile.elevation === 'mountain') return 'Mountains cannot be changed';
  if (tile.naturalWonder) return 'A Landmark cannot be changed';
  return null;
}
function capitalOf(ctx: HookCtx): City | null {
  const id = ctx.player.capitalId;
  const c = id != null ? ctx.state.cities[id] : undefined;
  return c && c.owner === ctx.player.id ? c : null;
}
function rivals(ctx: HookCtx) {
  return ctx.state.players.filter((p) => p.alive && p.id !== ctx.player.id && p.id !== BARBARIAN);
}
function notify(ctx: HookCtx, text: string, icon: string, tile?: TileIdx, tone: 'good' | 'bad' | 'info' = 'good'): void {
  ctx.emit({ type: 'notify', text, icon, tile, tone });
}

/** does the tile's improvement still belong after a terrain change (resource connections always do)? */
function improvementFits(t: Tile, clearedFeature: FeatureId | null): boolean {
  if (!t.improvement) return true;
  const d = IMPROVEMENTS[t.improvement];
  if (!d) return true;
  const res = t.resource ? RESOURCES[t.resource] : undefined;
  if (res && res.improvement === d.id) return true;
  if (d.requiresResource) return false;
  if (d.terrains && !d.terrains.includes(t.terrain)) return false;
  if (d.elevations && !d.elevations.includes(t.elevation)) return false;
  if (t.feature && d.features && !d.features.includes(t.feature)) return false;
  if (clearedFeature && d.features?.length === 1 && d.features[0] === clearedFeature) return false;
  return true;
}
/** after reshaping a tile: drop an improvement that no longer fits, refresh yields & sight lines */
function afterReshape(ctx: HookCtx, tile: Tile, clearedFeature: FeatureId | null): void {
  if (!improvementFits(tile, clearedFeature)) {
    tile.improvement = null;
  }
  const city = tile.cityId != null ? ctx.state.cities[tile.cityId] : undefined;
  if (city) refreshCity(ctx.state, city);
  recomputeVisibility(ctx.state, ctx.player.id, ctx.emit);
}

function woundedUnits(ctx: HookCtx): Unit[] {
  return Object.values(ctx.state.units).filter((u) => u.owner === ctx.player.id && u.hp < 100);
}
function woundedCities(ctx: HookCtx): City[] {
  return citiesOf(ctx.state, ctx.player.id).filter((c) => c.hp < c.maxHp);
}
function unexploredWithin(ctx: HookCtx, center: TileIdx, radius: number): number {
  let n = 0;
  for (const i of tilesInRadius(ctx.state.map, center, radius)) if (!ctx.player.vis[i]) n++;
  return n;
}
function rivalCapitals(ctx: HookCtx): City[] {
  const out: City[] = [];
  for (const p of rivals(ctx)) {
    const c = p.capitalId != null ? ctx.state.cities[p.capitalId] : undefined;
    if (c && c.owner === p.id) out.push(c);
  }
  return out;
}
function roadlessLand(ctx: HookCtx): Tile[] {
  return ctx.state.map.tiles.filter((t) => t.owner === ctx.player.id && !t.road && !isWaterTile(t) && t.elevation !== 'mountain');
}
function tributeFrom(ctx: HookCtx): { id: PlayerId; amount: number }[] {
  const cap = 20 * eraNumber(ctx.state);
  const out: { id: PlayerId; amount: number }[] = [];
  for (const p of rivals(ctx)) {
    const amount = Math.min(cap, Math.floor(p.gold));
    if (amount > 0) out.push({ id: p.id, amount });
  }
  return out;
}
function commonDoctrineCandidates(ctx: HookCtx): string[] {
  const owned = new Set(ctx.state.run.doctrines.map((d) => d.id));
  const locked = new Set(ctx.state.config.locked ?? []);
  return Object.values(DOCTRINES)
    .filter((d) => d.rarity === 'common' && !d.noShop && !owned.has(d.id) && !locked.has(d.id))
    .map((d) => d.id);
}
function doctrineName(id: string): string {
  return DOCTRINES[id]?.name ?? id;
}
const EDITION_NAMES: Record<Edition, string> = { base: 'Base', gilded: 'Gold', radiant: 'Shiny', prismatic: 'Rainbow', ethereal: 'Ghost' };

function levelUpPillar(ctx: HookCtx, pillar: (typeof PILLARS)[number]): void {
  const levels = ctx.state.run.pillarLevels;
  levels[pillar] = (levels[pillar] ?? 1) + 1;
}

// ───────────────────────────── edicts ─────────────────────────────

const LIST: EdictDef[] = [
  // ── growth & cities ──
  {
    id: 'golden_harvest', name: 'Hydroponic Ration', rarity: 'common', cost: 3, target: 'city',
    description: 'A colony gains **+3** population.',
    icon: 'food', art: { hue: 45, motif: 'flask' },
    canUse: (ctx, t) => cityError(ctx, t),
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      if (!c) return;
      changePop(ctx.state, c, 3, ctx.emit);
      notify(ctx, `Hydroponic Ration: ${c.name} gains 3 population.`, 'food', c.tile);
    },
  },
  {
    id: 'rain_of_plenty', name: 'Fresh Colonists', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Every colony gains **+1** population.',
    icon: 'seed', art: { hue: 200, motif: 'flask' },
    canUse: (ctx) => (citiesOf(ctx.state, ctx.player.id).length ? null : 'You have no colonies'),
    use(ctx) {
      const cities = citiesOf(ctx.state, ctx.player.id);
      for (const c of cities) changePop(ctx.state, c, 1, ctx.emit);
      notify(ctx, `Fresh Colonists: ${cities.length} ${cities.length === 1 ? 'colony grows' : 'colonies grow'}.`, 'food', cities[0]?.tile);
    },
  },
  {
    id: 'pioneers_charter', name: 'Free Crawler', rarity: 'uncommon', cost: 4, target: 'city',
    description: 'A colony builds a free **Colony Crawler**. The colony keeps its population.',
    icon: 'found', art: { hue: 90, motif: 'gear' },
    canUse: (ctx, t) => cityError(ctx, t) ?? (UNITS.settler ? null : 'Colony Crawlers are not available'),
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      if (!c) return;
      const u = createUnit(ctx.state, ctx.player.id, 'settler', c.tile, ctx.emit);
      if (u) notify(ctx, `Free Crawler: a Colony Crawler leaves ${c.name}.`, 'found', u.tile);
      else notify(ctx, `${c.name} has no room for a Colony Crawler.`, 'found', c.tile, 'bad');
    },
  },
  {
    id: 'royal_survey', name: 'Border Kit', rarity: 'uncommon', cost: 4, target: 'city',
    description: 'A colony claims up to **3** free tiles next to its border.',
    icon: 'map', art: { hue: 180, motif: 'compass' },
    canUse(ctx, t) {
      const err = cityError(ctx, t);
      if (err) return err;
      const c = ownCityArg(ctx, t);
      return c && nextBorderTile(ctx.state, c) >= 0 ? null : 'No free land is next to this colony';
    },
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      if (!c) return;
      const claimed: TileIdx[] = [];
      for (let i = 0; i < 3; i++) {
        const idx = nextBorderTile(ctx.state, c);
        if (idx < 0) break;
        const tile = ctx.state.map.tiles[idx];
        tile.owner = c.owner;
        tile.cityId = c.id;
        claimed.push(idx);
      }
      if (!claimed.length) return;
      ctx.emit({ type: 'borderGrew', cityId: c.id, player: c.owner, tiles: claimed });
      refreshCity(ctx.state, c);
      recomputeVisibility(ctx.state, ctx.player.id, ctx.emit);
    },
  },

  // ── production ──
  {
    id: 'guild_overtime', name: 'Double Shift', rarity: 'common', cost: 3, target: 'city',
    description: 'A colony adds **5** turns of its {prod} to what it is building.',
    icon: 'prod', art: { hue: 20, motif: 'gear' },
    canUse(ctx, t) {
      const err = cityError(ctx, t);
      if (err) return err;
      const c = ownCityArg(ctx, t)!;
      const item = c.queue[0];
      if (!item) return 'Choose what this colony builds first';
      if (item.kind === 'project') return 'This cannot be sped up';
      if (!(c.yields.prod > 0)) return 'This colony makes no Production';
      return null;
    },
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      if (!c || !c.queue[0] || c.queue[0].kind === 'project') return;
      const gain = round1(5 * Math.max(0, c.yields.prod));
      c.prodStored = round1(c.prodStored + gain);
      notify(ctx, `Double Shift: +${gain} Production in ${c.name}.`, 'prod', c.tile);
    },
  },
  {
    id: 'master_builders', name: 'Rapid Assembly Kit', rarity: 'rare', cost: 5, target: 'city',
    description: 'Finish the building in progress now. {prod} already spent carries over.',
    icon: 'prod', art: { hue: 25, motif: 'gear' },
    canUse(ctx, t) {
      const err = cityError(ctx, t);
      if (err) return err;
      const c = ownCityArg(ctx, t)!;
      const item = c.queue[0];
      if (!item || item.kind !== 'building') return 'This colony is not building a building';
      return canProduce(ctx.state, c, item);
    },
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      const item = c?.queue[0];
      if (!c || !item || item.kind !== 'building') return;
      c.queue.shift();
      completeItem(ctx.state, c, item, ctx.emit);
    },
  },
  {
    id: 'miracle_of_masons', name: 'Wonder Assembly Kit', rarity: 'legendary', cost: 6, target: 'city',
    description: 'Finish the Wonder in progress now. {prod} already spent carries over.',
    icon: 'crown', art: { hue: 42, motif: 'gear' },
    unlock: { text: 'Build 4 Wonders in one run', rule: 'wonders4' },
    canUse(ctx, t) {
      const err = cityError(ctx, t);
      if (err) return err;
      const c = ownCityArg(ctx, t)!;
      const item = c.queue[0];
      if (!item || item.kind !== 'wonder') return 'This colony is not building a Wonder';
      if (ctx.state.wonderOwners[item.id] != null) return 'That Wonder is already built elsewhere';
      return canProduce(ctx.state, c, item);
    },
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      const item = c?.queue[0];
      if (!c || !item || item.kind !== 'wonder') return;
      c.queue.shift();
      completeItem(ctx.state, c, item, ctx.emit);
    },
  },

  // ── land ──
  {
    id: 'terraform', name: 'Land Grader', rarity: 'common', cost: 3, target: 'ownedTile',
    description: 'On a tile you own, clear Rock Spires, Lava Tubes or Toxic Bog. Flat land with no feature becomes Hills.',
    icon: 'improve', art: { hue: 95, motif: 'mountain' },
    canUse(ctx, t) {
      const err = ownedLandError(ctx, t);
      if (err) return err;
      const tile = ownTileArg(ctx, t)!;
      if (tile.feature === 'forest' || tile.feature === 'jungle' || tile.feature === 'marsh') return null;
      if (tile.elevation === 'flat' && !tile.feature) return null;
      return 'Nothing here can be changed';
    },
    use(ctx, t) {
      const tile = ownTileArg(ctx, t);
      if (!tile) return;
      const f = tile.feature;
      if (f === 'forest' || f === 'jungle' || f === 'marsh') {
        tile.feature = null;
        afterReshape(ctx, tile, f);
        notify(ctx, 'Land Grader: the tile is cleared.', 'improve', tile.idx);
      } else if (tile.elevation === 'flat' && !f) {
        tile.elevation = 'hills';
        afterReshape(ctx, tile, null);
        notify(ctx, 'Land Grader: the land rises into Hills.', 'improve', tile.idx);
      }
    },
  },
  {
    id: 'verdant_rain', name: 'Soil Foam', rarity: 'common', cost: 3, target: 'ownedTile',
    description: 'Improve the soil of a tile you own: Dunes or Frost Plains become Plains, Ice Cap becomes Frost Plains, and Plains become Clay Basin.',
    icon: 'food', art: { hue: 120, motif: 'gear' },
    canUse(ctx, t) {
      const err = ownedLandError(ctx, t);
      if (err) return err;
      const tile = ownTileArg(ctx, t)!;
      if (tile.feature === 'oasis') return 'A Geyser tile cannot be changed';
      if (tile.terrain === 'grassland') return 'This tile is already Clay Basin';
      return null;
    },
    use(ctx, t) {
      const tile = ownTileArg(ctx, t);
      if (!tile) return;
      const next = tile.terrain === 'desert' || tile.terrain === 'tundra' ? 'plains'
        : tile.terrain === 'snow' ? 'tundra'
          : tile.terrain === 'plains' ? 'grassland' : null;
      if (!next) return;
      tile.terrain = next;
      afterReshape(ctx, tile, null);
      notify(ctx, 'Soil Foam: the soil is better now.', 'food', tile.idx);
    },
  },
  {
    id: 'imperial_roads', name: 'Road Beacons', rarity: 'common', cost: 3, target: 'none',
    description: 'Build a road on every land tile inside your borders.',
    icon: 'map', art: { hue: 28, motif: 'compass' },
    canUse: (ctx) => (roadlessLand(ctx).length ? null : 'Every tile you own already has a road'),
    use(ctx) {
      const tiles = roadlessLand(ctx);
      for (const tile of tiles) tile.road = true;
      notify(ctx, `Road Beacons: ${tiles.length} tiles now have roads.`, 'map');
    },
  },

  // ── arms ──
  {
    id: 'levy', name: 'Emergency Troops', rarity: 'common', cost: 3, target: 'none',
    description: 'Get **2** of your strongest combat units next to your Capital.',
    icon: 'sword', art: { hue: 10, motif: 'shield' },
    canUse(ctx) {
      if (!capitalOf(ctx)) return 'You have no Capital';
      return bestUnitFor(ctx.state, ctx.player.id, ['melee', 'ranged', 'antiCavalry', 'mounted']) ? null : 'No combat unit is available';
    },
    use(ctx) {
      const cap = capitalOf(ctx);
      const type = bestUnitFor(ctx.state, ctx.player.id, ['melee', 'ranged', 'antiCavalry', 'mounted']);
      if (!cap || !type) return;
      let n = 0;
      for (let i = 0; i < 2; i++) if (createUnit(ctx.state, ctx.player.id, type, cap.tile, ctx.emit)) n++;
      notify(ctx, n ? `Emergency Troops: ${n} ${UNITS[type]?.name ?? type} arrive at ${cap.name}.` : `${cap.name} has no room for troops.`, 'sword', cap.tile, n ? 'good' : 'bad');
    },
  },
  {
    id: 'conscription', name: 'Colonist Soldiers', rarity: 'common', cost: 3, target: 'none',
    description: 'Each colony with **3+** population loses **1** population and gets **1** infantry unit.',
    icon: 'war', art: { hue: 355, motif: 'sword' },
    canUse(ctx) {
      if (!citiesOf(ctx.state, ctx.player.id).some((c) => c.pop >= 3)) return 'No colony has 3 or more population';
      return bestUnitFor(ctx.state, ctx.player.id, ['melee']) ? null : 'No infantry unit is available';
    },
    use(ctx) {
      const type = bestUnitFor(ctx.state, ctx.player.id, ['melee']);
      if (!type) return;
      let n = 0;
      for (const c of citiesOf(ctx.state, ctx.player.id)) {
        if (c.pop < 3) continue;
        if (!createUnit(ctx.state, ctx.player.id, type, c.tile, ctx.emit)) continue;
        changePop(ctx.state, c, -1, ctx.emit);
        n++;
      }
      notify(ctx, `Colonist Soldiers: ${n} ${UNITS[type]?.name ?? type} join up.`, 'war');
    },
  },
  {
    id: 'sanctuary', name: 'Field Patch', rarity: 'common', cost: 3, target: 'unit',
    description: 'Fully heal one combat unit. It also digs in (**+50%** defense).',
    icon: 'heal', art: { hue: 150, motif: 'gear' },
    canUse(ctx, t) {
      const err = unitError(ctx, t, true);
      if (err) return err;
      const u = ownUnitArg(ctx, t)!;
      return u.hp >= 100 && u.fortifyTurns >= 2 ? 'This unit is already healthy and dug in' : null;
    },
    use(ctx, t) {
      const u = ownUnitArg(ctx, t);
      if (!u) return;
      u.hp = 100;
      u.order = { kind: 'fortify' };
      u.fortifyTurns = 2;
      notify(ctx, `Field Patch: the ${UNITS[u.type]?.name ?? 'unit'} is healed.`, 'heal', u.tile);
    },
  },
  {
    id: 'balm_of_ages', name: 'Colony Repair Kit', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Heal all your units and colonies to full health.',
    icon: 'heal', art: { hue: 160, motif: 'gear' },
    canUse: (ctx) => (woundedUnits(ctx).length || woundedCities(ctx).length ? null : 'Nothing needs repair'),
    use(ctx) {
      for (const u of woundedUnits(ctx)) u.hp = 100;
      for (const c of woundedCities(ctx)) c.hp = c.maxHp;
      notify(ctx, 'Colony Repair Kit: everything is healed.', 'heal');
    },
  },
  {
    id: 'veterans_laurels', name: 'Combat Training', rarity: 'common', cost: 3, target: 'unit',
    description: 'A combat unit gets enough XP for its next level.',
    icon: 'xp', art: { hue: 50, motif: 'bolt' },
    canUse(ctx, t) {
      const err = unitError(ctx, t, true);
      if (err) return err;
      const u = ownUnitArg(ctx, t)!;
      if (u.level >= XP_LEVELS.length) return 'This unit is already at the top level';
      return null;
    },
    use(ctx, t) {
      const u = ownUnitArg(ctx, t);
      if (!u || u.level >= XP_LEVELS.length) return;
      grantXp(u, xpToNextLevel(u), ctx.emit);
    },
  },

  // ── knowledge ──
  {
    id: 'revelation', name: 'Research Injection', rarity: 'rare', cost: 5, target: 'none',
    description: 'Finish your current Research now.',
    icon: 'tech', art: { hue: 270, motif: 'flask' },
    canUse: (ctx) => (ctx.player.researching && TECHS[ctx.player.researching] ? null : 'Choose a Research first'),
    use(ctx) {
      const tech = ctx.player.researching;
      if (tech) grantTech(ctx.state, ctx.player.id, tech, ctx.emit);
    },
  },
  {
    id: 'scholars_boon', name: 'Research Data Cache', rarity: 'common', cost: 3, target: 'none',
    description: 'Your current Research gets {sci} equal to **50%** of its cost.',
    icon: 'sci', art: { hue: 220, motif: 'flask' },
    canUse: (ctx) => (ctx.player.researching && TECHS[ctx.player.researching] ? null : 'Choose a Research first'),
    use(ctx) {
      const p = ctx.player;
      const tech = p.researching;
      if (!tech || !TECHS[tech]) return;
      const gain = round1(0.5 * techCost(ctx.state, p.id, tech));
      p.researchProgress[tech] = round1((p.researchProgress[tech] ?? 0) + gain);
      notify(ctx, `Research Data Cache: +${gain} Science for ${TECHS[tech].name}.`, 'sci');
    },
  },
  {
    id: 'rediscovery', name: 'Research Shortcut', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Finish the cheapest Research you can start now.',
    icon: 'book', art: { hue: 35, motif: 'gear' },
    canUse: (ctx) => (availableTechs(ctx.state, ctx.player.id).length ? null : 'No Research is left'),
    use(ctx) {
      let best: string | null = null;
      let bestCost = Infinity;
      for (const id of availableTechs(ctx.state, ctx.player.id)) {
        const c = techCost(ctx.state, ctx.player.id, id);
        if (c < bestCost) { best = id; bestCost = c; }
      }
      if (best) grantTech(ctx.state, ctx.player.id, best, ctx.emit);
    },
  },
  {
    id: 'cartographers_commission', name: 'Survey Drones', rarity: 'common', cost: 3, target: 'tile',
    description: 'Reveal all tiles within **4** of a tile you have explored.',
    icon: 'map', art: { hue: 205, motif: 'compass' },
    canUse(ctx, t) {
      const tile = t.tile != null ? ctx.state.map.tiles[t.tile] : undefined;
      if (!tile) return 'Choose a tile';
      if (!ctx.player.vis[tile.idx]) return 'You have not explored that land';
      return unexploredWithin(ctx, tile.idx, 4) ? null : 'You already see every tile there';
    },
    use(ctx, t) {
      if (t.tile == null || !ctx.state.map.tiles[t.tile]) return;
      revealArea(ctx.state, ctx.player.id, t.tile, 4, ctx.emit);
    },
  },
  {
    id: 'spymasters_ledger', name: 'Relay Scan', rarity: 'common', cost: 3, target: 'none',
    description: 'Reveal all tiles within **2** of every rival Capital.',
    icon: 'eye', art: { hue: 280, motif: 'eye' },
    canUse(ctx) {
      const caps = rivalCapitals(ctx);
      if (!caps.length) return 'No rival Capital exists';
      return caps.some((c) => unexploredWithin(ctx, c.tile, 2)) ? null : 'You already see every rival Capital';
    },
    use(ctx) {
      for (const c of rivalCapitals(ctx)) revealArea(ctx.state, ctx.player.id, c.tile, 2, ctx.emit);
    },
  },

  // ── wealth & influence ──
  {
    id: 'windfall', name: 'Credit Cache', rarity: 'common', cost: 3, target: 'none',
    description: 'Get **60** {gold} × the era number (**60** in Era 1, **360** in Era 6).',
    icon: 'gold', art: { hue: 48, motif: 'coin' },
    use(ctx) {
      addGold(ctx.state, ctx.player.id, 60 * eraNumber(ctx.state), 'Boost: Credit Cache', ctx.emit);
    },
  },
  {
    id: 'tribute', name: 'Credit Transfer', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Every rival Nation gives you up to **20** {gold} × the era number.',
    icon: 'gold', art: { hue: 40, motif: 'gear' },
    canUse: (ctx) => (tributeFrom(ctx).length ? null : 'No rival has Credits to give'),
    use(ctx) {
      let total = 0;
      for (const { id, amount } of tributeFrom(ctx)) {
        addGold(ctx.state, id, -amount, 'Credit Transfer', ctx.emit);
        total += amount;
      }
      addGold(ctx.state, ctx.player.id, total, 'Boost: Credit Transfer', ctx.emit);
    },
  },
  {
    id: 'hermits_tithe', name: 'Coin Doubler', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Double your {influence}. You get at most **+10**.',
    icon: 'influence', art: { hue: 260, motif: 'coin' },
    canUse: (ctx) => (ctx.state.run.influence > 0 ? null : 'You have no Coins to double'),
    use(ctx) {
      addInfluence(ctx.state, Math.min(10, Math.max(0, ctx.state.run.influence)), ctx.emit);
    },
  },
  {
    id: 'royal_audit', name: 'Crew Value', rarity: 'common', cost: 3, target: 'none',
    description: 'Get {influence} equal to the sell value of all your Crew (max **8**).',
    icon: 'influence', art: { hue: 55, motif: 'gear' },
    canUse: (ctx) => (ctx.state.run.doctrines.some((d) => d.sellValue > 0) ? null : 'You have no Crew to value'),
    use(ctx) {
      let sum = 0;
      for (const d of ctx.state.run.doctrines) sum += Math.max(0, d.sellValue);
      addInfluence(ctx.state, Math.min(8, sum), ctx.emit);
    },
  },

  // ── the chronicle ──
  {
    id: 'grand_festival', name: 'Points Broadcast', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Add **50** {renown} × era number × era number to this chapter (**50** in Era 1, **1,800** in Era 6).',
    icon: 'renown', art: { hue: 330, motif: 'sun' },
    use(ctx) {
      const n = eraNumber(ctx.state);
      liveRenown(ctx.state, 50 * n * n, 'Points Broadcast', ctx.emit, capitalOf(ctx)?.tile);
    },
  },
  {
    id: 'epiphany', name: 'Focus Report', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Your current Focus pillar gains **+1** level.',
    icon: 'scroll', art: { hue: 300, motif: 'flask' },
    use(ctx) {
      const focus = ctx.state.run.focus;
      levelUpPillar(ctx, focus);
      notify(ctx, `${PILLAR_DEFS[focus].name} is now level ${ctx.state.run.pillarLevels[focus]}.`, focus);
    },
  },
  {
    id: 'codex_universalis', name: 'All Pillars Report', rarity: 'legendary', cost: 6, target: 'none',
    description: 'Every pillar gains **+1** level.',
    icon: 'book', art: { hue: 265, motif: 'gear' },
    unlock: { text: 'Reach the Terraform era', rule: 'reachEra4' },
    use(ctx) {
      for (const p of PILLARS) levelUpPillar(ctx, p);
      notify(ctx, 'Every pillar gains a level.', 'book');
    },
  },
  {
    id: 'heavens_clemency', name: 'Extra Life', rarity: 'legendary', cost: 6, target: 'none',
    description: 'Get **1** {mandate} back (up to your maximum).',
    icon: 'mandate', art: { hue: 50, motif: 'bolt' },
    unlock: { text: 'Overcome 6 Crises in one run', rule: 'crises6' },
    canUse: (ctx) => (ctx.state.run.mandate < ctx.state.run.maxMandate ? null : 'Your Lives are already full'),
    use(ctx) {
      const run = ctx.state.run;
      if (run.mandate < run.maxMandate) changeMandate(ctx.state, 1, 'Extra Life', ctx.emit);
    },
  },
  {
    id: 'augurs_sign', name: 'Points Packet', rarity: 'common', cost: 3, target: 'none',
    description: 'Add **25** {renown} × era number × era number to this chapter (**25** in Era 1, **900** in Era 6).',
    icon: 'renown', art: { hue: 275, motif: 'gear' },
    use(ctx) {
      const n = eraNumber(ctx.state);
      liveRenown(ctx.state, 25 * n * n, 'Points Packet', ctx.emit, capitalOf(ctx)?.tile);
    },
  },

  // ── Crew ──
  {
    id: 'patronage', name: 'Crew Candidate', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Add a random **Common** Crew member. You need a free Slot.',
    icon: 'doctrine', art: { hue: 190, motif: 'hand' },
    canUse(ctx) {
      const run = ctx.state.run;
      if (doctrineSlotsUsed(run) >= run.doctrineSlots) return 'Your Crew Slots are full';
      return commonDoctrineCandidates(ctx).length ? null : 'No Common Crew member is available';
    },
    use(ctx) {
      const pool = commonDoctrineCandidates(ctx);
      if (!pool.length) return;
      const id = pick(ctx.state.rng, pool);
      if (!grantDoctrine(ctx.state, id, 'base', ctx.emit)) notify(ctx, `Crew Candidate: ${doctrineName(id)} joins your Crew.`, 'doctrine');
    },
  },
  {
    id: 'gilded_charter', name: 'Gold Crew Patch', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Your leftmost Crew member with no edition becomes **Gold**.',
    icon: 'star', art: { hue: 45, motif: 'gear' },
    canUse: (ctx) => (ctx.state.run.doctrines.some((d) => d.edition === 'base') ? null : 'No Crew member without an edition'),
    use(ctx) {
      const d = ctx.state.run.doctrines.find((x) => x.edition === 'base');
      if (!d) return;
      d.edition = 'gilded';
      notify(ctx, `${doctrineName(d.id)} is now Gold.`, 'star');
    },
  },
  {
    id: 'fortunes_wheel', name: 'Edition Lottery', rarity: 'uncommon', cost: 4, target: 'none',
    description: '**1 in 3** chance: a random Crew member with no edition becomes Gold, Shiny or Rainbow.',
    icon: 'reroll', art: { hue: 285, motif: 'gear' },
    canUse: (ctx) => (ctx.state.run.doctrines.some((d) => d.edition === 'base') ? null : 'No Crew member without an edition'),
    use(ctx) {
      const s = ctx.state;
      const pool = s.run.doctrines.filter((d) => d.edition === 'base');
      if (!pool.length) return;
      if (!chance(s.rng, 1 / 3)) {
        notify(ctx, 'Edition Lottery: no luck this time.', 'reroll', undefined, 'info');
        return;
      }
      const d = pick(s.rng, pool);
      const edition = pick(s.rng, ['gilded', 'radiant', 'prismatic'] as const);
      d.edition = edition;
      notify(ctx, `${doctrineName(d.id)} becomes ${EDITION_NAMES[edition]}.`, 'star');
    },
  },
  {
    id: 'mirror_of_ages', name: 'Edition Copy', rarity: 'rare', cost: 5, target: 'none',
    description: 'Your leftmost Crew member with no edition gets the edition of your leftmost Crew member that has one.',
    icon: 'doctrine', art: { hue: 230, motif: 'gear' },
    unlock: { text: 'Earn 5 Big Wins in one run', rule: 'triumphs5' },
    canUse(ctx) {
      const ds = ctx.state.run.doctrines;
      if (!ds.some((d) => d.edition !== 'base')) return 'No Crew member has an edition';
      return ds.some((d) => d.edition === 'base') ? null : 'No Crew member without an edition to copy to';
    },
    use(ctx) {
      const ds = ctx.state.run.doctrines;
      const src = ds.find((d) => d.edition !== 'base');
      const dst = ds.find((d) => d.edition === 'base');
      if (!src || !dst) return;
      dst.edition = src.edition;
      notify(ctx, `${doctrineName(dst.id)} becomes ${EDITION_NAMES[src.edition]}.`, 'doctrine');
    },
  },
  {
    id: 'veil_of_ether', name: 'Ghost Protocol', rarity: 'legendary', cost: 6, target: 'none',
    description: 'Your rightmost Crew member with no edition becomes **Ghost**. It no longer uses a Slot.',
    icon: 'doctrine', art: { hue: 190, motif: 'bolt' },
    unlock: { text: 'Hold a Legendary Crew member', rule: 'legendary' },
    canUse: (ctx) => (ctx.state.run.doctrines.some((d) => d.edition === 'base') ? null : 'No Crew member without an edition'),
    use(ctx) {
      const ds = ctx.state.run.doctrines;
      for (let i = ds.length - 1; i >= 0; i--) {
        if (ds[i].edition !== 'base') continue;
        ds[i].edition = 'ethereal';
        notify(ctx, `${doctrineName(ds[i].id)} becomes Ghost.`, 'doctrine');
        return;
      }
    },
  },
  {
    id: 'tsar_charge', name: 'Tsar Charge', rarity: 'legendary', cost: 6, target: 'tile',
    description: 'Hit a tile and the tiles next to it. Enemy units and colonies drop to **1 HP**. Russia starts with this Boost.',
    icon: 'war', art: { hue: 8, motif: 'flame' },
    canUse(ctx, t) {
      return t.tile != null && ctx.state.map.tiles[t.tile] ? null : 'Choose a tile';
    },
    use(ctx, t) {
      if (t.tile == null) return;
      for (const idx of tilesInRadius(ctx.state.map, t.tile, 1)) {
        for (const u of Object.values(ctx.state.units)) {
          if (u.owner !== ctx.player.id && hexDistance(ctx.state.map, u.tile, idx) === 0) u.hp = 1;
        }
        const city = Object.values(ctx.state.cities).find((c) => c.tile === idx && c.owner !== ctx.player.id);
        if (city) city.hp = 1;
      }
      notify(ctx, 'Tsar Charge: the target area is badly hurt.', 'war', t.tile, 'bad');
    },
  },
  {
    id: 'weather_sat_uplink', name: 'Weather Satellite', rarity: 'rare', cost: 5, target: 'tile',
    description: 'Pick the center of a Dust Storm. The storm disappears.',
    icon: 'storm', art: { hue: 205, motif: 'eye' },
    canUse(ctx, t) {
      return t.tile != null && ctx.state.storms.some((s) => s.path[s.step] === t.tile) ? null : 'Choose the center of a Dust Storm';
    },
    use(ctx, t) {
      if (t.tile == null) return;
      const storm = ctx.state.storms.find((s) => s.path[s.step] === t.tile);
      if (!storm) return;
      ctx.state.storms = ctx.state.storms.filter((s) => s.id !== storm.id);
      ctx.emit({ type: 'stormEnded', id: storm.id, tile: t.tile });
      notify(ctx, 'Weather Satellite: the Dust Storm is gone.', 'storm', t.tile);
    },
  },
  {
    id: 'cryo_batch', name: 'Spare Pod', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Get **1 Pod** from the reserve.',
    icon: 'cryo', art: { hue: 190, motif: 'flask' },
    use(ctx) { changeCryo(ctx.state, ctx.player.id, 1, ctx.emit); },
  },
  {
    id: 'emergency_shelter', name: 'Emergency Shelter', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Your units and colonies take no Dust Storm damage this turn.',
    icon: 'shield', art: { hue: 28, motif: 'tower' },
    use(ctx) {
      ctx.player.counters[STORM_SHELTER_COUNTER] = ctx.state.turn;
      notify(ctx, 'Emergency Shelter: no Dust Storm damage this turn.', 'shield');
    },
  },
  {
    id: 'supply_pod', name: 'Supply Pod', rarity: 'rare', cost: 5, target: 'tile',
    description: 'Make a free Land Colony on a tile you have explored.',
    icon: 'drop', art: { hue: 24, motif: 'flame' },
    canUse(ctx, t) {
      if (t.tile == null) return 'Choose an explored tile';
      const p = ctx.player;
      const price = dropPrice(ctx.state, p.id);
      const cryo = p.cryo;
      const gold = p.gold;
      p.cryo += price.cryo;
      p.gold += price.gold;
      const error = canOrbitalDrop(ctx.state, p.id, t.tile);
      p.cryo = cryo;
      p.gold = gold;
      return error;
    },
    use(ctx, t) {
      if (t.tile == null) return;
      const p = ctx.player;
      const price = dropPrice(ctx.state, p.id);
      const cryo = p.cryo;
      const gold = p.gold;
      p.cryo += price.cryo;
      p.gold += price.gold;
      orbitalDrop(ctx.state, p.id, t.tile, ctx.emit);
      p.cryo = cryo;
      p.gold = gold;
    },
  },
  {
    id: 'seed_vault_key', name: 'Seed Vault Key', rarity: 'uncommon', cost: 4, target: 'city',
    description: 'A colony gains **2** population.',
    icon: 'seed', art: { hue: 92, motif: 'key' },
    canUse: (ctx, t) => cityError(ctx, t),
    use(ctx, t) {
      const city = ownCityArg(ctx, t);
      if (city) changePop(ctx.state, city, 2, ctx.emit);
    },
  },
];

export const EDICTS: Record<string, EdictDef> = Object.fromEntries(LIST.map((e) => [e.id, e]));
