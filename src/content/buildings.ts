// OWNER: ContentCiv. City buildings (32 + leader uniques from content/uniques.ts appended at the end).
//
// SPECIAL CASE — `palace`: cost 0 and tech null. It is never offered in production; SimCore grants it
// automatically to a player's first city (the capital) at founding, and moves/re-grants it per its capital rules.
// Rule for production UIs/availability: a building with `cost <= 0` is never buildable.
//
// Building `effects` hooks run once per city that owns the building (sim/effects.ts collectEffects), so every
// local effect filters on `ctx.cityId`.
import type { BuildingDef, EffectHooks, HookCtx } from '../sim/defs';
import type { City, ResourceId, SimEvent, Tile } from '../sim/types';
import { grantXp } from '../sim/units';
import { UNIQUE_BUILDINGS } from './uniques';
import { TERRAINS } from './terrain';
import { UNITS } from './units';
import { hexDistance } from '../sim/hex';
import { stormPowerAt } from '../sim/mars';

type BuildingSpec = Omit<BuildingDef, 'icon'>;
function building(spec: BuildingSpec): BuildingDef {
  return { ...spec, icon: spec.id };
}

const isLocal = (ctx: HookCtx, city: City | null): boolean => city != null && city.id === ctx.cityId;
const isWater = (tile: Tile): boolean => TERRAINS[tile.terrain]?.water ?? false;
const improved = (tile: Tile, id: string): boolean => tile.improvement === id && !tile.pillaged;

/** Units trained in this city start with extra XP (land military only unless `classes` given). */
function trainingXp(xp: number, classes?: readonly string[]): EffectHooks {
  return {
    onEvent(ctx: HookCtx, ev: SimEvent) {
      if (ev.type !== 'unitCreated' || ev.player !== ctx.player.id || ev.cityId == null || ev.cityId !== ctx.cityId) return;
      const unit = ctx.state.units[ev.unitId];
      if (!unit) return;
      const def = UNITS[unit.type];
      if (!def || def.class === 'civilian' || def.class === 'naval') return;
      if (classes && !classes.includes(def.class)) return;
      grantXp(ctx.state, unit, xp, ctx.emit);
    },
  };
}

/** +N of a yield on tiles of this city matching `pred`. */
function localTileBonus(pred: (tile: Tile) => boolean, key: 'food' | 'prod' | 'gold' | 'sci' | 'cul', n = 1): EffectHooks['tileYield'] {
  return (ctx, a) => {
    if (isLocal(ctx, a.city) && pred(a.tile)) a.yields[key] += n;
  };
}

const hasRes = (ids: readonly ResourceId[]) => (tile: Tile): boolean => tile.resource != null && ids.includes(tile.resource);


function windFarmEffects(): EffectHooks {
  return {
    tileYield(ctx, a) {
      if (!isLocal(ctx, a.city)) return;
      a.yields.prod += stormPowerAt(ctx.state, a.tile.idx);
    },
  };
}

function stormShelterEffects(): EffectHooks {
  return {
    storm(ctx, a) {
      const city = ctx.cityId ? ctx.state.cities[ctx.cityId] : null;
      if (!city || !a.unit || a.unit.owner !== ctx.player.id) return;
      if (hexDistance(ctx.state.map, city.tile, a.tile.idx) <= 1) a.damage = Math.floor(a.damage / 2);
    },
  };
}

function stormScrubberEffects(): EffectHooks {
  return {
    tileYield(ctx, a) {
      if (isLocal(ctx, a.city)) a.yields.food += stormPowerAt(ctx.state, a.tile.idx);
    },
  };
}
const LIST: BuildingDef[] = [
  // ───────── Era 0 · Ancient ─────────
  building({
    id: 'palace', name: 'Ark Hab Command', era: 0, cost: 0, tech: null, maintenance: 0, pillar: 'glory',
    yields: { prod: 3, sci: 3, gold: 3, cul: 2 }, happiness: 1, cityStrength: 3, cityHp: 25,
    description: 'The Ark Hab is command center, last refuge and free capital building. +3 {prod} +3 {sci} +3 {gold} +2 {cul}, +1 {happy}. Lose it and the mission ends.',
  }),
  building({
    id: 'monument', name: 'Crew Memorial', era: 0, cost: 30, tech: null, maintenance: 0, pillar: 'arts',
    yields: { cul: 2 },
    description: '+2 {cul}. A carved roster remembers the people who did not make the crossing. Speeds border growth.',
  }),
  building({
    id: 'shrine', name: 'Earth Shrine', era: 0, cost: 30, tech: null, maintenance: 0, pillar: 'arts',
    yields: { cul: 1 }, happiness: 1,
    description: '+1 {cul}, +1 {happy}. A quiet place for whatever survived the old world.',
  }),
  building({
    id: 'granary', name: 'Seed Silo', era: 0, cost: 45, tech: 'agriculture', maintenance: 1, pillar: 'prosperity', model: 'bld_granary',
    yields: { food: 2 },
    effects: { tileYield: localTileBonus(hasRes(['wheat', 'rice', 'bananas', 'deer', 'cattle']), 'food') },
    description: '+2 {food}. Tiles with Nitrate Salts, Brine Algae, Glowcap Fungus, Crater Ice or Lichen Beds yield +1 {food}.',
  }),
  building({
    id: 'walls', name: 'Blast Walls', era: 0, cost: 45, tech: 'bronze_working', maintenance: 1, pillar: 'conquest',
    yields: {}, cityHp: 75, cityStrength: 6,
    description: '+75 colony HP and +6 colony strength. Regolith berms and armored panels keep the outside outside.',
  }),
  building({
    id: 'barracks', name: 'Armory', era: 0, cost: 45, tech: 'bronze_working', maintenance: 1, pillar: 'conquest', model: 'bld_barracks',
    yields: { prod: 1 },
    effects: trainingXp(15),
    description: '+1 {prod}. Troops trained here start with **+15 XP** and a serviceable helmet.',
  }),
  building({
    id: 'lighthouse', name: 'Beacon Tower', era: 0, cost: 45, tech: 'sailing', maintenance: 1, pillar: 'commerce', model: 'bld_lighthouse',
    yields: { gold: 1 }, coastal: true,
    effects: { tileYield: localTileBonus(isWater, 'gold') },
    description: '+1 {gold}. Coastal. Worked water tiles gain +1 {gold} from this relay beacon.',
  }),

  // ───────── Era 1 · Classical ─────────
  building({
    id: 'library', name: 'Data Archive', era: 1, cost: 70, tech: 'writing', maintenance: 1, pillar: 'discovery', model: 'bld_library',
    yields: { sci: 2 }, perPop: { sci: 0.25 },
    description: '+2 {sci}, plus +1 {sci} for every 4 citizens. Backups are civilization’s least dramatic survivors.',
  }),
  building({
    id: 'temple', name: 'Memorial Chapel', era: 1, cost: 70, tech: 'calendar', maintenance: 2, pillar: 'arts', model: 'bld_temple', requires: 'shrine',
    yields: { cul: 2 }, happiness: 2,
    description: '+2 {cul}, +2 {happy}. Requires an Earth Shrine. A room for mourning that does not leak.',
  }),
  building({
    id: 'market', name: 'Exchange', era: 1, cost: 75, tech: 'currency', maintenance: 0, pillar: 'commerce', model: 'bld_market',
    yields: { gold: 2 }, pct: { gold: 20 },
    description: '+2 {gold} and +20% {gold}. No upkeep: the stalls pay for themselves, somehow.',
  }),
  building({
    id: 'forge', name: 'Alloy Foundry', era: 1, cost: 75, tech: 'iron_working', maintenance: 1, pillar: 'glory',
    yields: { prod: 1 },
    effects: { tileYield: localTileBonus((t) => improved(t, 'mine'), 'prod') },
    description: '+1 {prod}. Every Regolith Mine worked by this colony yields +1 {prod}.',
  }),
  building({
    id: 'amphitheater', name: 'Holo-Theater', era: 1, cost: 85, tech: 'mathematics', maintenance: 2, pillar: 'arts', model: 'bld_amphitheater',
    yields: { cul: 3 }, happiness: 2,
    description: '+3 {cul}, +2 {happy}. Drama, comedy and the occasional evacuation notice.',
  }),

  // ───────── Era 2 · Medieval ─────────
  building({
    id: 'harbor', name: 'Skiff Dock', era: 2, cost: 110, tech: 'cartography', maintenance: 2, pillar: 'prosperity', model: 'bld_harbor',
    yields: { gold: 1 }, coastal: true,
    effects: {
      tileYield(ctx, a) {
        if (!isLocal(ctx, a.city) || !isWater(a.tile)) return;
        a.yields.food += 1;
        if (hasRes(['fish', 'whales', 'pearls'])(a.tile)) a.yields.prod += 1;
      },
    },
    description: '+1 {gold}. Coastal. Water tiles worked by this colony yield +1 {food}; Regolith Silt, Orbital Debris and Hematite Blueberries +1 {prod}.',
  }),
  building({
    id: 'aqueduct', name: 'Water Reclaimer', era: 2, cost: 110, tech: 'engineering', maintenance: 1, pillar: 'prosperity', model: 'bld_aqueduct',
    yields: { food: 2 },
    effects: {
      growthThreshold(ctx, a) {
        if (isLocal(ctx, a.city)) a.value = Math.round(a.value * 0.75);
      },
    },
    description: '+2 {food}. This colony needs 25% less {food} to grow. Drink responsibly; the loop is closed.',
  }),
  building({
    id: 'castle', name: 'Bastion Dome', era: 2, cost: 120, tech: 'steel', maintenance: 2, pillar: 'conquest', model: 'bld_castle', requires: 'walls',
    yields: { cul: 1 }, cityHp: 100, cityStrength: 8,
    description: '+100 colony HP, +8 colony strength, +1 {cul}. Requires Blast Walls. A pressure-rated fortress.',
  }),
  building({
    id: 'workshop', name: 'Fabricator', era: 2, cost: 120, tech: 'machinery', maintenance: 2, pillar: 'glory', model: 'bld_workshop',
    yields: { prod: 2 }, pct: { prod: 10 },
    effects: { tileYield: localTileBonus((t) => improved(t, 'lumbermill'), 'prod') },
    description: '+2 {prod} and +10% {prod}. Sinter Works tiles worked by this colony yield +1 {prod}.',
  }),
  building({
    id: 'stable', name: 'Rover Bay', era: 2, cost: 90, tech: 'chivalry', maintenance: 1, pillar: 'conquest',
    yields: {},
    effects: {
      ...trainingXp(15, ['mounted', 'armor']),
      tileYield: localTileBonus((t) => improved(t, 'pasture'), 'prod'),
      cost(ctx, a) {
        if (a.currency !== 'prod' || a.item.kind !== 'unit' || !isLocal(ctx, a.city)) return;
        const cls = UNITS[a.item.id]?.class;
        if (cls === 'mounted' || cls === 'armor') a.cost = Math.round(a.cost * 0.75);
      },
    },
    description: 'Mounted and armor units cost 25% less {prod} here and start with **+15 XP**. Bioreactors yield +1 {prod}.',
  }),
  building({
    id: 'cathedral', name: 'Cathedral of Earth', era: 2, cost: 140, tech: 'theology', maintenance: 3, pillar: 'arts', model: 'bld_cathedral', requires: 'temple',
    yields: { cul: 3 }, happiness: 3, influence: 1,
    description: '+3 {cul}, +3 {happy}, +1 {influence} every chapter. Requires a Memorial Chapel; pilgrims bring gifts to the Uplink.',
  }),

  // ───────── Era 3 · Renaissance ─────────
  building({
    id: 'university', name: 'Research Institute', era: 3, cost: 180, tech: 'education', maintenance: 3, pillar: 'discovery', model: 'bld_university', requires: 'library',
    yields: { sci: 3 }, pct: { sci: 25 },
    effects: { tileYield: localTileBonus((t) => t.feature === 'jungle', 'sci') },
    description: '+3 {sci} and +25% {sci}. Requires a Data Archive. Lava Tube tiles worked by this colony yield +1 {sci}.',
  }),
  building({
    id: 'observatory', name: 'Deep Space Array', era: 3, cost: 170, tech: 'astronomy', maintenance: 2, pillar: 'discovery', model: 'bld_observatory',
    yields: { sci: 2 }, pct: { sci: 20 },
    effects: { tileYield: localTileBonus((t) => t.elevation === 'hills', 'sci') },
    description: '+2 {sci} and +20% {sci}. Ridges worked by this colony yield +1 {sci}.',
  }),
  building({
    id: 'bank', name: 'Credit Vault', era: 3, cost: 180, tech: 'banking', maintenance: 0, pillar: 'commerce', model: 'bld_bank', requires: 'market',
    yields: { gold: 3 }, pct: { gold: 25 },
    description: '+3 {gold} and +25% {gold}. Requires an Exchange. No upkeep.',
  }),
  building({
    id: 'museum', name: 'Holo-Archive', era: 3, cost: 190, tech: 'architecture', maintenance: 3, pillar: 'arts', requires: 'amphitheater',
    yields: { cul: 5 }, happiness: 1, influence: 1,
    description: '+5 {cul}, +1 {happy}, +1 {influence} every chapter. Requires a Holo-Theater.',
  }),
  building({
    id: 'armory', name: 'Weapons Foundry', era: 3, cost: 150, tech: 'gunpowder', maintenance: 2, pillar: 'conquest', requires: 'barracks',
    yields: { prod: 1 },
    effects: trainingXp(15),
    description: '+1 {prod}. Requires an Armory. Land units trained here gain another **+15 XP**.',
  }),

  // ───────── Era 4 · Industrial ─────────
  building({
    id: 'factory', name: 'Foundry', era: 4, cost: 260, tech: 'industrialization', maintenance: 3, pillar: 'glory', model: 'bld_factory', requires: 'workshop',
    yields: { prod: 3 }, pct: { prod: 25 },
    effects: { tileYield: localTileBonus(hasRes(['coal', 'iron']), 'prod') },
    description: '+3 {prod} and +25% {prod}. Requires a Fabricator. Thorium and Nickel-Iron tiles yield +1 {prod}.',
  }),
  building({
    id: 'stock_exchange', name: 'Scrip Exchange', era: 4, cost: 250, tech: 'economics', maintenance: 0, pillar: 'commerce', requires: 'bank',
    yields: { gold: 4 }, pct: { gold: 33 },
    description: '+4 {gold} and +33% {gold}. Requires a Credit Vault. No upkeep.',
  }),
  building({
    id: 'powerplant', name: 'Fusion Plant', era: 4, cost: 280, tech: 'electricity', maintenance: 4, pillar: 'glory', model: 'bld_powerplant', requires: 'factory',
    yields: { prod: 3 }, pct: { prod: 25 },
    description: '+3 {prod} and +25% {prod}. Requires a Foundry.',
  }),
  building({
    id: 'hospital', name: 'Med Bay', era: 4, cost: 240, tech: 'electricity', maintenance: 3, pillar: 'prosperity', requires: 'aqueduct',
    yields: { food: 3 }, happiness: 2,
    effects: {
      growthThreshold(ctx, a) {
        if (isLocal(ctx, a.city)) a.value = Math.round(a.value * 0.85);
      },
    },
    description: '+3 {food}, +2 {happy}. Requires a Water Reclaimer. This colony needs 15% less {food} to grow.',
  }),
  building({
    id: 'military_academy', name: 'Tactical School', era: 4, cost: 230, tech: 'military_science', maintenance: 3, pillar: 'conquest', requires: 'armory',
    yields: { sci: 2 }, cityStrength: 4,
    effects: trainingXp(20),
    description: '+2 {sci}, +4 colony strength. Requires a Weapons Foundry. Land units trained here gain another **+20 XP**.',
  }),

  // ───────── Era 5 · Modern ─────────
  building({
    id: 'research_lab', name: 'Research Lab', era: 5, cost: 360, tech: 'computers', maintenance: 4, pillar: 'discovery', requires: 'university',
    yields: { sci: 4 }, pct: { sci: 50 },
    description: '+4 {sci} and +50% {sci}. Requires a Research Institute.',
  }),
  building({
    id: 'broadcast_tower', name: 'Broadcast Tower', era: 5, cost: 330, tech: 'radio', maintenance: 4, pillar: 'arts', requires: 'museum',
    yields: { cul: 4 }, pct: { cul: 33 }, influence: 1,
    description: '+4 {cul}, +33% {cul}, +1 {influence} every chapter. Requires a Holo-Archive.',
  }),
  building({
    id: 'stadium', name: 'Arena', era: 5, cost: 310, tech: 'radio', maintenance: 3, pillar: 'glory', model: 'bld_stadium',
    yields: { cul: 2 }, happiness: 4,
    description: '+4 {happy}, +2 {cul}. The scoreboard says "viable." The crowd knows better.',
  }),
  building({
    id: 'supermarket', name: 'Supply Depot', era: 5, cost: 290, tech: 'combustion', maintenance: 3, pillar: 'prosperity', requires: 'granary',
    yields: { food: 2 }, pct: { food: 15 },
    effects: { tileYield: localTileBonus((t) => improved(t, 'farm'), 'food') },
    description: '+2 {food} and +15% {food}. Requires a Seed Silo. Greenhouse Domes worked by this colony yield +1 {food}.',
  }),
  building({
    id: 'wind_farm', name: 'Wind Farm', era: 2, cost: 65, tech: 'engineering', maintenance: 1, pillar: 'glory',
    yields: {},
    effects: windFarmEffects(),
    description: 'Wind turbines turn dust-storm power into +1 {prod} per storm power on tiles worked by this colony. The forecast is now an energy bill.',
  }),
  building({
    id: 'storm_shelter', name: 'Storm Shelter', era: 2, cost: 115, tech: 'engineering', maintenance: 1, pillar: 'prosperity',
    yields: { food: 1 },
    effects: stormShelterEffects(),
    description: 'A buried refuge halves dust-storm damage to your units within this colony or one hex of it.',
  }),
  building({
    id: 'dust_scrubbers', name: 'Dust Scrubbers', era: 4, cost: 185, tech: 'industrialization', maintenance: 2, pillar: 'prosperity',
    yields: { prod: 1 },
    effects: stormScrubberEffects(),
    description: '+1 {prod}. Scrubbers reclaim storm-blown fines: +1 {food} per storm power on this colony’s tiles.',
  }),
];

export const BUILDINGS: Record<string, BuildingDef> = {
  ...Object.fromEntries(LIST.map((b) => [b.id, b])),
  ...UNIQUE_BUILDINGS,
};
