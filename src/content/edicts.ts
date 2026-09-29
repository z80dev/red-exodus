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
import { OMENS } from './omens';
import { canProduce, changePop, citiesOf, completeItem, nextBorderTile, refreshAllCities, refreshCity } from '../sim/cities';
import { addGold, availableTechs, grantTech, hasResource, round1, techCost } from '../sim/economy';
import { createUnit, grantXp, upgradeInfo, XP_LEVELS } from '../sim/units';
import { tilesInRadius } from '../sim/hex';
import { recomputeVisibility, revealArea } from '../sim/visibility';
import { chance, pick } from '../sim/rng';
import { addInfluence, changeMandate, grantDoctrine } from '../sim/roguelite';
import { doctrineSlotsUsed } from '../sim/roguelite/council';
import { grantOmenReward, omenGoal } from '../sim/roguelite/omens';
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
  if (!c) return 'Choose a city';
  if (c.owner !== ctx.player.id) return 'Choose one of your cities';
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
  if (military && unitClassOf(u.type) === 'civilian') return 'Choose a military unit';
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
  if (isWaterTile(tile)) return 'Water cannot be reshaped';
  if (tile.elevation === 'mountain') return 'Mountains will not be moved';
  if (tile.naturalWonder) return 'A natural wonder must stay as it is';
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
    tile.pillaged = false;
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
    if (ctx.player.relations[p.id] !== 'peace') continue;
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
const EDITION_NAMES: Record<Edition, string> = { base: 'Base', gilded: 'Decorated', radiant: 'Inspired', prismatic: 'Legendary Tale', ethereal: 'Ghost' };

function levelUpPillar(ctx: HookCtx, pillar: (typeof PILLARS)[number]): void {
  const levels = ctx.state.run.pillarLevels;
  levels[pillar] = (levels[pillar] ?? 1) + 1;
}

// ───────────────────────────── edicts ─────────────────────────────

const LIST: EdictDef[] = [
  // ── growth & cities ──
  {
    id: 'golden_harvest', name: 'Hydroponic Ration', rarity: 'common', cost: 3, target: 'city',
    description: 'A colony gains **+3** population from a recycled seed batch.',
    icon: 'food', art: { hue: 45, motif: 'flask' },
    canUse: (ctx, t) => cityError(ctx, t),
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      if (!c) return;
      changePop(ctx.state, c, 3, ctx.emit);
      notify(ctx, `Golden Harvest: ${c.name} swells with new families.`, 'food', c.tile);
    },
  },
  {
    id: 'rain_of_plenty', name: 'Cryo Thaw', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Every colony gains **+1** population from the reserve.',
    icon: 'seed', art: { hue: 200, motif: 'flask' },
    canUse: (ctx) => (citiesOf(ctx.state, ctx.player.id).length ? null : 'You have no cities'),
    use(ctx) {
      const cities = citiesOf(ctx.state, ctx.player.id);
      for (const c of cities) changePop(ctx.state, c, 1, ctx.emit);
      notify(ctx, `Rain of Plenty: ${cities.length} ${cities.length === 1 ? 'city grows' : 'cities grow'}.`, 'food', cities[0]?.tile);
    },
  },
  {
    id: 'pioneers_charter', name: 'Crawler Fabrication Order', rarity: 'uncommon', cost: 4, target: 'city',
    description: 'A colony fabricates a free **Hab Crawler** without losing population.',
    icon: 'found', art: { hue: 90, motif: 'gear' },
    canUse: (ctx, t) => cityError(ctx, t) ?? (UNITS.settler ? null : 'Settlers are unavailable'),
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      if (!c) return;
      const u = createUnit(ctx.state, ctx.player.id, 'settler', c.tile, ctx.emit);
      if (u) notify(ctx, `Pioneers' Charter: settlers set out from ${c.name}.`, 'found', u.tile);
      else notify(ctx, `${c.name} has no room for the pioneers.`, 'found', c.tile, 'bad');
    },
  },
  {
    id: 'royal_survey', name: 'Perimeter Beacon Kit', rarity: 'uncommon', cost: 4, target: 'city',
    description: 'A colony claims up to **3** unowned tiles along its perimeter.',
    icon: 'map', art: { hue: 180, motif: 'compass' },
    canUse(ctx, t) {
      const err = cityError(ctx, t);
      if (err) return err;
      const c = ownCityArg(ctx, t);
      return c && nextBorderTile(ctx.state, c) >= 0 ? null : 'No unclaimed land borders this city';
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
    id: 'guild_overtime', name: 'Emergency Double Shift', rarity: 'common', cost: 3, target: 'city',
    description: 'A colony adds **5** turns of its {prod} output to its current construction.',
    icon: 'prod', art: { hue: 20, motif: 'gear' },
    canUse(ctx, t) {
      const err = cityError(ctx, t);
      if (err) return err;
      const c = ownCityArg(ctx, t)!;
      const item = c.queue[0];
      if (!item) return 'Choose something for this city to produce first';
      if (item.kind === 'project') return 'Projects cannot be hurried';
      if (!(c.yields.prod > 0)) return 'This city produces no production';
      return null;
    },
    use(ctx, t) {
      const c = ownCityArg(ctx, t);
      if (!c || !c.queue[0] || c.queue[0].kind === 'project') return;
      const gain = round1(5 * Math.max(0, c.yields.prod));
      c.prodStored = round1(c.prodStored + gain);
      notify(ctx, `Guild Overtime: +${gain} production in ${c.name}.`, 'prod', c.tile);
    },
  },
  {
    id: 'master_builders', name: 'Rapid Assembly Kit', rarity: 'rare', cost: 5, target: 'city',
    description: 'Instantly complete a habitat module under construction; invested Industry carries over.',
    icon: 'prod', art: { hue: 25, motif: 'gear' },
    canUse(ctx, t) {
      const err = cityError(ctx, t);
      if (err) return err;
      const c = ownCityArg(ctx, t)!;
      const item = c.queue[0];
      if (!item || item.kind !== 'building') return 'This city is not constructing a building';
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
    id: 'miracle_of_masons', name: 'Megaproject Assembly Kit', rarity: 'legendary', cost: 6, target: 'city',
    description: 'Instantly complete the Megaproject under construction; invested Industry carries over.',
    icon: 'crown', art: { hue: 42, motif: 'gear' },
    unlock: { text: 'Build 4 wonders in one run', rule: 'wonders4' },
    canUse(ctx, t) {
      const err = cityError(ctx, t);
      if (err) return err;
      const c = ownCityArg(ctx, t)!;
      const item = c.queue[0];
      if (!item || item.kind !== 'wonder') return 'This city is not building a Wonder';
      if (ctx.state.wonderOwners[item.id] != null) return 'That Wonder already stands elsewhere';
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
    id: 'terraform', name: 'Regolith Grader', rarity: 'common', cost: 3, target: 'ownedTile',
    description: 'Strip surface debris from a tile you own; flat regolith is graded into ridged terrain.',
    icon: 'improve', art: { hue: 95, motif: 'mountain' },
    canUse(ctx, t) {
      const err = ownedLandError(ctx, t);
      if (err) return err;
      const tile = ownTileArg(ctx, t)!;
      if (tile.feature === 'forest' || tile.feature === 'jungle' || tile.feature === 'marsh') return null;
      if (tile.elevation === 'flat' && !tile.feature) return null;
      return 'Nothing here can be reshaped';
    },
    use(ctx, t) {
      const tile = ownTileArg(ctx, t);
      if (!tile) return;
      const f = tile.feature;
      if (f === 'forest' || f === 'jungle' || f === 'marsh') {
        tile.feature = null;
        afterReshape(ctx, tile, f);
        notify(ctx, `Terraform: the ${f} is cleared.`, 'improve', tile.idx);
      } else if (tile.elevation === 'flat' && !f) {
        tile.elevation = 'hills';
        afterReshape(ctx, tile, null);
        notify(ctx, 'Terraform: the land rises into hills.', 'improve', tile.idx);
      }
    },
  },
  {
    id: 'verdant_rain', name: 'Soil Remediation Foam', rarity: 'common', cost: 3, target: 'ownedTile',
    description: 'Improve barren soil: Dune Sea or Frost Flats become Regolith Plain, Polar Ice becomes Frost Flats, and plains become Clay Basin.',
    icon: 'food', art: { hue: 120, motif: 'gear' },
    canUse(ctx, t) {
      const err = ownedLandError(ctx, t);
      if (err) return err;
      const tile = ownTileArg(ctx, t)!;
      if (tile.feature === 'oasis') return 'The oasis must keep its desert';
      if (tile.terrain === 'grassland') return 'Already lush grassland';
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
      notify(ctx, `Verdant Rain: the land turns to ${next}.`, 'food', tile.idx);
    },
  },
  {
    id: 'imperial_roads', name: 'Beacon Cairn Network', rarity: 'common', cost: 3, target: 'none',
    description: 'Mark every land tile inside your borders with a navigation beacon.',
    icon: 'map', art: { hue: 28, motif: 'compass' },
    canUse: (ctx) => (roadlessLand(ctx).length ? null : 'Every road in your realm is already paved'),
    use(ctx) {
      const tiles = roadlessLand(ctx);
      for (const tile of tiles) tile.road = true;
      notify(ctx, `Imperial Roads: ${tiles.length} tiles paved.`, 'map');
    },
  },

  // ── arms ──
  {
    id: 'levy', name: 'Emergency Muster', rarity: 'common', cost: 3, target: 'none',
    description: 'Deploy **2** of your strongest combat units beside the Ark Hab.',
    icon: 'sword', art: { hue: 10, motif: 'shield' },
    canUse(ctx) {
      if (!capitalOf(ctx)) return 'You have no capital';
      return bestUnitFor(ctx.state, ctx.player.id, ['melee', 'ranged', 'antiCavalry', 'mounted']) ? null : 'No unit can answer the call';
    },
    use(ctx) {
      const cap = capitalOf(ctx);
      const type = bestUnitFor(ctx.state, ctx.player.id, ['melee', 'ranged', 'antiCavalry', 'mounted']);
      if (!cap || !type) return;
      let n = 0;
      for (let i = 0; i < 2; i++) if (createUnit(ctx.state, ctx.player.id, type, cap.tile, ctx.emit)) n++;
      notify(ctx, n ? `The Levy: ${n} ${UNITS[type]?.name ?? type} muster at ${cap.name}.` : `${cap.name} has no room for the levy.`, 'sword', cap.tile, n ? 'good' : 'bad');
    },
  },
  {
    id: 'conscription', name: 'Crew Draft', rarity: 'common', cost: 3, target: 'none',
    description: 'Every colony with **3+** population assigns **1** colonist to the strongest available infantry unit.',
    icon: 'war', art: { hue: 355, motif: 'sword' },
    canUse(ctx) {
      if (!citiesOf(ctx.state, ctx.player.id).some((c) => c.pop >= 3)) return 'No city has 3 or more population';
      return bestUnitFor(ctx.state, ctx.player.id, ['melee']) ? null : 'No melee unit is available';
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
      notify(ctx, `Conscription: ${n} ${UNITS[type]?.name ?? type} take up arms.`, 'war');
    },
  },
  {
    id: 'sanctuary', name: 'Field Patch', rarity: 'common', cost: 3, target: 'unit',
    description: 'Fully repair one combat unit and entrench it at full strength (**+50%** defense).',
    icon: 'heal', art: { hue: 150, motif: 'gear' },
    canUse(ctx, t) {
      const err = unitError(ctx, t, true);
      if (err) return err;
      const u = ownUnitArg(ctx, t)!;
      return u.hp >= 100 && u.fortifyTurns >= 2 ? 'This unit is already whole and entrenched' : null;
    },
    use(ctx, t) {
      const u = ownUnitArg(ctx, t);
      if (!u) return;
      u.hp = 100;
      u.order = { kind: 'fortify' };
      u.fortifyTurns = 2;
      notify(ctx, `Sanctuary: the ${UNITS[u.type]?.name ?? 'unit'} stands renewed.`, 'heal', u.tile);
    },
  },
  {
    id: 'balm_of_ages', name: 'Colony Repair Kit', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Restore all your units and colonies to full health.',
    icon: 'heal', art: { hue: 160, motif: 'gear' },
    canUse: (ctx) => (woundedUnits(ctx).length || woundedCities(ctx).length ? null : 'Nothing in your realm needs healing'),
    use(ctx) {
      for (const u of woundedUnits(ctx)) u.hp = 100;
      for (const c of woundedCities(ctx)) c.hp = c.maxHp;
      notify(ctx, 'Balm of Ages: every wound in the realm is mended.', 'heal');
    },
  },
  {
    id: 'forge_of_heroes', name: 'Field Retrofit Kit', rarity: 'uncommon', cost: 4, target: 'unit',
    description: 'Upgrade one of your units for free, even outside your borders.',
    icon: 'upgrade', art: { hue: 30, motif: 'gear' },
    canUse(ctx, t) {
      const err = unitError(ctx, t, false);
      if (err) return err;
      const u = ownUnitArg(ctx, t)!;
      const info = UNITS[u.type]?.upgradesTo ? upgradeInfo(ctx.state, u) : null;
      const to = info ? UNITS[info.to] : undefined;
      if (!to) return 'This unit has no upgrade';
      if (to.tech && !ctx.player.techs.includes(to.tech)) return `Requires ${TECHS[to.tech]?.name ?? to.tech}`;
      if (to.resource && !hasResource(ctx.state, ctx.player.id, to.resource)) return `Requires ${RESOURCES[to.resource]?.name ?? to.resource}`;
      return null;
    },
    use(ctx, t) {
      const u = ownUnitArg(ctx, t);
      const info = u && UNITS[u.type]?.upgradesTo ? upgradeInfo(ctx.state, u) : null;
      if (!u || !info || !UNITS[info.to]) return;
      const from = u.type;
      u.type = info.to;
      ctx.emit({ type: 'unitUpgraded', unitId: u.id, from, to: info.to });
    },
  },
  {
    id: 'veterans_laurels', name: 'Combat Data Cache', rarity: 'common', cost: 3, target: 'unit',
    description: 'A combat unit instantly gains the field experience for its next promotion.',
    icon: 'xp', art: { hue: 50, motif: 'bolt' },
    canUse(ctx, t) {
      const err = unitError(ctx, t, true);
      if (err) return err;
      const u = ownUnitArg(ctx, t)!;
      if (u.promotionChoices?.length) return 'Choose its pending promotion first';
      if (u.level >= XP_LEVELS.length) return 'This unit is already a living legend';
      return null;
    },
    use(ctx, t) {
      const u = ownUnitArg(ctx, t);
      if (!u || u.level >= XP_LEVELS.length) return;
      grantXp(ctx.state, u, Math.max(0, XP_LEVELS[u.level] - u.xp), ctx.emit);
    },
  },
  {
    id: 'olive_branch', name: 'Ceasefire Packet', rarity: 'rare', cost: 5, target: 'none',
    description: 'Make peace with every rival nation currently at war with you.',
    icon: 'peace', art: { hue: 110, motif: 'key' },
    canUse: (ctx) => (rivals(ctx).some((p) => ctx.player.relations[p.id] === 'war') ? null : 'You are at war with no one'),
    use(ctx) {
      const s = ctx.state;
      const me = ctx.player;
      const foes = rivals(ctx).filter((p) => me.relations[p.id] === 'war');
      for (const p of foes) {
        me.relations[p.id] = 'peace';
        p.relations[me.id] = 'peace';
        me.counters[`peace:${p.id}`] = s.turn;
        p.counters[`peace:${me.id}`] = s.turn;
        ctx.emit({ type: 'peaceMade', a: me.id, b: p.id });
        refreshAllCities(s, p.id);
      }
      refreshAllCities(s, me.id);
    },
  },

  // ── knowledge ──
  {
    id: 'revelation', name: 'Breakthrough Injection', rarity: 'rare', cost: 5, target: 'none',
    description: 'Instantly complete your current research project.',
    icon: 'tech', art: { hue: 270, motif: 'flask' },
    canUse: (ctx) => (ctx.player.researching && TECHS[ctx.player.researching] ? null : 'Choose a technology to research first'),
    use(ctx) {
      const tech = ctx.player.researching;
      if (tech) grantTech(ctx.state, ctx.player.id, tech, ctx.emit);
    },
  },
  {
    id: 'scholars_boon', name: 'Research Data Cache', rarity: 'common', cost: 3, target: 'none',
    description: 'Your current research gains {sci} equal to **50%** of its cost.',
    icon: 'sci', art: { hue: 220, motif: 'flask' },
    canUse: (ctx) => (ctx.player.researching && TECHS[ctx.player.researching] ? null : 'Choose a technology to research first'),
    use(ctx) {
      const p = ctx.player;
      const tech = p.researching;
      if (!tech || !TECHS[tech]) return;
      const gain = round1(0.5 * techCost(ctx.state, p.id, tech));
      p.researchProgress[tech] = round1((p.researchProgress[tech] ?? 0) + gain);
      notify(ctx, `Scholar's Boon: +${gain} science toward ${TECHS[tech].name}.`, 'sci');
    },
  },
  {
    id: 'rediscovery', name: 'Research Salvage', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Complete the cheapest technology currently available to you.',
    icon: 'book', art: { hue: 35, motif: 'gear' },
    canUse: (ctx) => (availableTechs(ctx.state, ctx.player.id).length ? null : 'No technology is left to learn'),
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
    id: 'cartographers_commission', name: 'Survey Drone Battery', rarity: 'common', cost: 3, target: 'tile',
    description: 'Reveal every tile within **4** of an explored coordinate.',
    icon: 'map', art: { hue: 205, motif: 'compass' },
    canUse(ctx, t) {
      const tile = t.tile != null ? ctx.state.map.tiles[t.tile] : undefined;
      if (!tile) return 'Choose a tile';
      if (!ctx.player.vis[tile.idx]) return 'That land is unexplored';
      return unexploredWithin(ctx, tile.idx, 4) ? null : 'Every tile there is already charted';
    },
    use(ctx, t) {
      if (t.tile == null || !ctx.state.map.tiles[t.tile]) return;
      revealArea(ctx.state, ctx.player.id, t.tile, 4, ctx.emit);
    },
  },
  {
    id: 'spymasters_ledger', name: 'Relay Scan', rarity: 'common', cost: 3, target: 'none',
    description: 'Reveal the land within **2** tiles of every rival landing site.',
    icon: 'eye', art: { hue: 280, motif: 'eye' },
    canUse(ctx) {
      const caps = rivalCapitals(ctx);
      if (!caps.length) return 'No rival capital stands';
      return caps.some((c) => unexploredWithin(ctx, c.tile, 2)) ? null : 'Your spies already know every rival capital';
    },
    use(ctx) {
      for (const c of rivalCapitals(ctx)) revealArea(ctx.state, ctx.player.id, c.tile, 2, ctx.emit);
    },
  },

  // ── wealth & influence ──
  {
    id: 'windfall', name: 'Credit Cache', rarity: 'common', cost: 3, target: 'none',
    description: 'Gain **60** {gold} per era (**60** Landfall → **360** New Earth).',
    icon: 'gold', art: { hue: 48, motif: 'coin' },
    use(ctx) {
      addGold(ctx.state, ctx.player.id, 60 * eraNumber(ctx.state), 'Edict: Windfall', ctx.emit);
    },
  },
  {
    id: 'tribute', name: 'Emergency Asset Transfer', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Every peaceful rival transfers up to **20** {gold} per era from its reserves.',
    icon: 'gold', art: { hue: 40, motif: 'gear' },
    canUse: (ctx) => (tributeFrom(ctx).length ? null : 'No rival at peace has gold to spare'),
    use(ctx) {
      let total = 0;
      for (const { id, amount } of tributeFrom(ctx)) {
        addGold(ctx.state, id, -amount, 'Tribute', ctx.emit);
        total += amount;
      }
      addGold(ctx.state, ctx.player.id, total, 'Edict: Tribute of Kings', ctx.emit);
    },
  },
  {
    id: 'hermits_tithe', name: 'Reserve Scrip Cache', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Double your {influence} (max **+10**).',
    icon: 'influence', art: { hue: 260, motif: 'coin' },
    canUse: (ctx) => (ctx.state.run.influence > 0 ? null : 'You have no Influence to double'),
    use(ctx) {
      addInfluence(ctx.state, Math.min(10, Math.max(0, ctx.state.run.influence)), ctx.emit);
    },
  },
  {
    id: 'royal_audit', name: 'Crew Appraisal', rarity: 'common', cost: 3, target: 'none',
    description: 'Gain {influence} equal to the total sell value of your Crew (max **8**).',
    icon: 'influence', art: { hue: 55, motif: 'gear' },
    canUse: (ctx) => (ctx.state.run.doctrines.some((d) => d.sellValue > 0) ? null : 'You have no Crew to appraise'),
    use(ctx) {
      let sum = 0;
      for (const d of ctx.state.run.doctrines) sum += Math.max(0, d.sellValue);
      addInfluence(ctx.state, Math.min(8, sum), ctx.emit);
    },
  },

  // ── the chronicle ──
  {
    id: 'grand_festival', name: 'Sol Report Broadcast', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Bank **50** {renown} × era² now (**50** Landfall → **1,800** New Earth).',
    icon: 'renown', art: { hue: 330, motif: 'sun' },
    use(ctx) {
      const n = eraNumber(ctx.state);
      liveRenown(ctx.state, 50 * n * n, 'Grand Festival', ctx.emit, capitalOf(ctx)?.tile);
    },
  },
  {
    id: 'epiphany', name: 'Priority Report', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Your current Priority pillar gains **+1** level.',
    icon: 'scroll', art: { hue: 300, motif: 'flask' },
    use(ctx) {
      const focus = ctx.state.run.focus;
      levelUpPillar(ctx, focus);
      notify(ctx, `Epiphany: ${focus[0].toUpperCase()}${focus.slice(1)} reaches level ${ctx.state.run.pillarLevels[focus]}.`, focus);
    },
  },
  {
    id: 'codex_universalis', name: 'All-Systems Report', rarity: 'legendary', cost: 6, target: 'none',
    description: 'Every pillar gains **+1** level.',
    icon: 'book', art: { hue: 265, motif: 'gear' },
    unlock: { text: 'Reach the Terraform era', rule: 'reachEra4' },
    use(ctx) {
      for (const p of PILLARS) levelUpPillar(ctx, p);
      notify(ctx, 'Codex Universalis: every Pillar rises a level.', 'book');
    },
  },
  {
    id: 'heavens_clemency', name: 'Charter Repair Voucher', rarity: 'legendary', cost: 6, target: 'none',
    description: 'Restore **1** {mandate} Charter (up to your maximum).',
    icon: 'mandate', art: { hue: 50, motif: 'bolt' },
    unlock: { text: 'Overcome 6 Crises in one run', rule: 'crises6' },
    canUse: (ctx) => (ctx.state.run.mandate < ctx.state.run.maxMandate ? null : 'Your Mandate is already whole'),
    use(ctx) {
      const run = ctx.state.run;
      if (run.mandate < run.maxMandate) changeMandate(ctx.state, 1, "Heaven's Clemency", ctx.emit);
    },
  },
  {
    id: 'augurs_sign', name: 'Directive Progress Packet', rarity: 'common', cost: 3, target: 'none',
    description: 'Your accepted Directive advances by a **third** of its goal.',
    icon: 'omen', art: { hue: 275, motif: 'gear' },
    canUse(ctx) {
      const directive = ctx.state.run.omen;
      if (!directive || !OMENS[directive.id]) return 'You have not accepted a Directive';
      return directive.done ? 'Your Directive is already complete' : null;
    },
    use(ctx) {
      const state = ctx.state;
      const directive = state.run.omen;
      const def = directive ? OMENS[directive.id] : undefined;
      if (!directive || !def || directive.done) return;
      const goal = directive.goal ?? omenGoal(state, def);
      directive.progress = Math.min(goal, directive.progress + Math.max(1, Math.ceil(goal / 3)));
      ctx.emit({ type: 'omenProgress', id: directive.id, progress: directive.progress, goal });
      if (directive.progress < goal) return;
      directive.done = true;
      state.run.totals.extra.omensCompleted = (state.run.totals.extra.omensCompleted ?? 0) + 1;
      ctx.emit({ type: 'omenCompleted', id: directive.id });
      grantOmenReward(state, def, ctx.emit);
    },
  },

  // ── Crew ──
  {
    id: 'patronage', name: 'Crew Candidate File', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Add a random **Common** Crew member (needs a free bunk).',
    icon: 'doctrine', art: { hue: 190, motif: 'hand' },
    canUse(ctx) {
      const run = ctx.state.run;
      if (doctrineSlotsUsed(run) >= run.doctrineSlots) return 'Your Crew bunks are full';
      return commonDoctrineCandidates(ctx).length ? null : 'No Common Crew member is available';
    },
    use(ctx) {
      const pool = commonDoctrineCandidates(ctx);
      if (!pool.length) return;
      const id = pick(ctx.state.rng, pool);
      if (!grantDoctrine(ctx.state, id, 'base', ctx.emit)) notify(ctx, `Patronage: ${doctrineName(id)} is adopted.`, 'doctrine');
    },
  },
  {
    id: 'gilded_charter', name: 'Decorated Crew Patch', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Your leftmost base-edition Crew member becomes **Decorated**.',
    icon: 'star', art: { hue: 45, motif: 'gear' },
    canUse: (ctx) => (ctx.state.run.doctrines.some((d) => d.edition === 'base') ? null : 'No base-edition Crew member to upgrade'),
    use(ctx) {
      const d = ctx.state.run.doctrines.find((x) => x.edition === 'base');
      if (!d) return;
      d.edition = 'gilded';
      notify(ctx, `${doctrineName(d.id)} is now Decorated.`, 'star');
    },
  },
  {
    id: 'fortunes_wheel', name: 'Crew Upgrade Lottery', rarity: 'uncommon', cost: 4, target: 'none',
    description: '**1 in 3** chance: a random base-edition Crew member improves to Decorated, Inspired or Legendary Tale.',
    icon: 'reroll', art: { hue: 285, motif: 'gear' },
    canUse: (ctx) => (ctx.state.run.doctrines.some((d) => d.edition === 'base') ? null : 'No base-edition Crew member to upgrade'),
    use(ctx) {
      const s = ctx.state;
      const pool = s.run.doctrines.filter((d) => d.edition === 'base');
      if (!pool.length) return;
      if (!chance(s.rng, 1 / 3)) {
        notify(ctx, 'The Crew Upgrade Lottery draws a blank.', 'reroll', undefined, 'info');
        return;
      }
      const d = pick(s.rng, pool);
      const edition = pick(s.rng, ['gilded', 'radiant', 'prismatic'] as const);
      d.edition = edition;
      notify(ctx, `${doctrineName(d.id)} becomes ${EDITION_NAMES[edition]}.`, 'star');
    },
  },
  {
    id: 'mirror_of_ages', name: 'Crew Edition Transfer', rarity: 'rare', cost: 5, target: 'none',
    description: 'Copy the edition of your leftmost improved Crew member onto your leftmost base-edition Crew member.',
    icon: 'doctrine', art: { hue: 230, motif: 'gear' },
    unlock: { text: 'Earn 5 Triumphs in one run', rule: 'triumphs5' },
    canUse(ctx) {
      const ds = ctx.state.run.doctrines;
      if (!ds.some((d) => d.edition !== 'base')) return 'No Crew member has an edition upgrade';
      return ds.some((d) => d.edition === 'base') ? null : 'No base-edition Crew member to receive an upgrade';
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
    description: 'Your rightmost base-edition Crew member becomes **Ghost** (it no longer takes a bunk).',
    icon: 'doctrine', art: { hue: 190, motif: 'bolt' },
    unlock: { text: 'Hold a Legendary Crew member', rule: 'legendary' },
    canUse: (ctx) => (ctx.state.run.doctrines.some((d) => d.edition === 'base') ? null : 'No base-edition Crew member to upgrade'),
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
    description: 'Detonate an orbital warhead on a tile and its radius-1 neighbors. Hostile units and colonies are left at **1 HP**. Russia starts with this charge.',
    icon: 'war', art: { hue: 8, motif: 'flame' },
    canUse(ctx, t) {
      return t.tile != null && ctx.state.map.tiles[t.tile] ? null : 'Choose a landing coordinate';
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
      notify(ctx, 'Tsar Charge: the impact site is now a crater with opinions.', 'war', t.tile, 'bad');
    },
  },
  {
    id: 'weather_sat_uplink', name: 'Weather Sat Uplink', rarity: 'rare', cost: 5, target: 'tile',
    description: 'Lock onto a storm eye to dissipate the storm before it reaches a colony.',
    icon: 'storm', art: { hue: 205, motif: 'eye' },
    canUse(ctx, t) {
      return t.tile != null && ctx.state.storms.some((s) => s.path[s.step] === t.tile) ? null : 'Choose a current storm eye';
    },
    use(ctx, t) {
      if (t.tile == null) return;
      const storm = ctx.state.storms.find((s) => s.path[s.step] === t.tile);
      if (!storm) return;
      ctx.state.storms = ctx.state.storms.filter((s) => s.id !== storm.id);
      ctx.emit({ type: 'stormEnded', id: storm.id, tile: t.tile });
      notify(ctx, 'Weather Sat Uplink: one dust wall has lost its appointment.', 'storm', t.tile);
    },
  },
  {
    id: 'cryo_batch', name: 'Cryo Batch', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Recover **1 Cryo pod** from the reserve freezer. The freezer is making that noise again.',
    icon: 'cryo', art: { hue: 190, motif: 'flask' },
    use(ctx) { changeCryo(ctx.state, ctx.player.id, 1, ctx.emit); },
  },
  {
    id: 'emergency_shelter', name: 'Emergency Shelter', rarity: 'uncommon', cost: 4, target: 'none',
    description: 'Protect your units and colonies from dust-storm damage for this round.',
    icon: 'shield', art: { hue: 28, motif: 'tower' },
    use(ctx) {
      ctx.player.counters[STORM_SHELTER_COUNTER] = ctx.state.turn;
      notify(ctx, 'Emergency Shelter: seal the hatches; the weather can yell outside.', 'shield');
    },
  },
  {
    id: 'supply_pod', name: 'Supply Pod', rarity: 'rare', cost: 5, target: 'tile',
    description: 'Land a free Orbital Drop on a valid explored site.',
    icon: 'drop', art: { hue: 24, motif: 'flame' },
    canUse(ctx, t) {
      if (t.tile == null) return 'Choose an explored landing site';
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
    description: 'A city gains **2** population from the last viable seed bank. Hope nobody asks what happened to the rest.',
    icon: 'seed', art: { hue: 92, motif: 'key' },
    canUse: (ctx, t) => cityError(ctx, t),
    use(ctx, t) {
      const city = ownCityArg(ctx, t);
      if (city) changePop(ctx.state, city, 2, ctx.emit);
    },
  },
];

export const EDICTS: Record<string, EdictDef> = Object.fromEntries(LIST.map((e) => [e.id, e]));
