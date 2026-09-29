// OWNER: ContentRogue. Crises — the Balatro boss blinds. One is rolled per era and revealed at the era's start;
// it rules the era's Chapter III ("Crisis"). Hooks apply to the human (and to rivals when `affectsAll`);
// onBegin/onEnd run with the human ctx only. Per-player counters persist in ctx.counters (reset in onBegin).
import type { CombatArgs, CrisisDef, HookCtx } from '../sim/defs';
import type { City, GameState, Player, TileIdx } from '../sim/types';
import { BARBARIAN, HUMAN, YIELD_KEYS } from '../sim/types';
import { changePop, citiesOf } from '../sim/cities';
import { connectedResources, LUXURY_HAPPINESS } from '../sim/economy';
import { hexDistance, neighbors, tilesInRadius } from '../sim/hex';
import { createUnit } from '../sim/units';
import { chance, pick } from '../sim/rng';
import { FOCUS_RENOWN_MUL } from '../sim/roguelite/constants';
import { RESOURCES } from './resources';
import { UNITS } from './units';
import {
  barbarianUnitForEra, enemyOwnerOf, isAtWar, isCoastalCity, isCoastalTile, isRiverTile, isWaterTile, pillarRenown,
} from './doctrines';

// ───────────────────────────── helpers ─────────────────────────────

function strike(ctx: HookCtx, text: string, icon: string, tile?: TileIdx): void {
  ctx.emit({ type: 'notify', text, icon, tile, tone: 'bad' });
}

/** clear this crisis' counters for every player (it may have run in an earlier era) */
function resetCounters(ctx: HookCtx): void {
  for (const p of ctx.state.players) {
    const bag = p.effectCounters?.[`crisis:${ctx.id}`];
    if (bag) for (const k of Object.keys(bag)) delete bag[k];
  }
  for (const k of Object.keys(ctx.counters)) delete ctx.counters[k];
}

/** advance and return the owner's crisis turn counter (1 on the first turn start of the chapter) */
function tick(ctx: HookCtx): number {
  ctx.counters.turn = (ctx.counters.turn ?? 0) + 1;
  return ctx.counters.turn;
}

/** the city has any of the buildings (a missing city has none) */
function has(city: City | null | undefined, ...ids: string[]): boolean {
  return !!city && ids.some((id) => city.buildings.includes(id));
}

function largestCity(state: GameState, pid: number): City | null {
  let best: City | null = null;
  for (const c of citiesOf(state, pid)) if (!best || c.pop > best.pop) best = c;
  return best;
}

/** push a modifier onto the side opposing the hook owner */
function enemyMod(a: CombatArgs, label: string, pct: number): void {
  (a.side === 'attack' ? a.defenseMods : a.attackMods).push({ label, pct });
}

function occupiedTiles(state: GameState): Set<TileIdx> {
  const s = new Set<TileIdx>();
  for (const u of Object.values(state.units)) s.add(u.tile);
  return s;
}

/** open land a fresh unit can stand on: not water, mountain, city, or occupied */
function openLand(state: GameState, idx: TileIdx, occupied: Set<TileIdx>): boolean {
  const t = state.map.tiles[idx];
  if (!t || isWaterTile(t) || t.elevation === 'mountain' || occupied.has(idx)) return false;
  return !(t.cityId != null && state.cities[t.cityId]?.tile === idx);
}

/** spawn barbarians on the given tiles (every third one ranged); returns how many appeared */
function spawnRaiders(state: GameState, tiles: TileIdx[], emit: HookCtx['emit']): number {
  let n = 0;
  tiles.forEach((tile, i) => {
    const type = barbarianUnitForEra(state.run.era, i % 3 === 2);
    if (!UNITS[type]) return;
    if (createUnit(state, BARBARIAN, type, tile, emit)) n++;
  });
  return n;
}

/** the `count` open tiles nearest a random anchor among `cands` */
function clusterAround(state: GameState, cands: TileIdx[], count: number): TileIdx[] {
  if (!cands.length || count <= 0) return [];
  const anchor = pick(state.rng, cands);
  return [...cands].sort((a, b) => hexDistance(state.map, anchor, a) - hexDistance(state.map, anchor, b) || a - b).slice(0, count);
}

/** unowned open land 2–4 tiles beyond the player's borders */
function beyondBorders(state: GameState, pid: number): TileIdx[] {
  const dist = new Map<TileIdx, number>();
  let fringe: TileIdx[] = [];
  for (const t of state.map.tiles) if (t.owner === pid) { dist.set(t.idx, 0); fringe.push(t.idx); }
  for (let d = 1; d <= 4 && fringe.length; d++) {
    const next: TileIdx[] = [];
    for (const i of fringe) for (const n of neighbors(state.map, i)) if (!dist.has(n)) { dist.set(n, d); next.push(n); }
    fringe = next;
  }
  const occupied = occupiedTiles(state);
  const out: TileIdx[] = [];
  for (const [i, d] of dist) if (d >= 2 && state.map.tiles[i].owner == null && openLand(state, i, occupied)) out.push(i);
  return out;
}

/** open land within 2 tiles of a city (the city tile itself excluded) */
function nearCity(state: GameState, city: City, pred?: (idx: TileIdx) => boolean): TileIdx[] {
  const occupied = occupiedTiles(state);
  return tilesInRadius(state.map, city.tile, 2).filter((i) => i !== city.tile && openLand(state, i, occupied) && (!pred || pred(i)));
}

/** set `by` and `target` at war (both directions); emits warDeclared if they were not already at war */
function forceWar(by: Player, target: Player, emit: HookCtx['emit']): boolean {
  if (by.id === target.id) return false;
  const was = by.relations[target.id] === 'war' && target.relations[by.id] === 'war';
  by.relations[target.id] = 'war';
  target.relations[by.id] = 'war';
  if (!was) emit({ type: 'warDeclared', by: by.id, target: target.id });
  return !was;
}

/** every living civilization at war with every other; returns declarations made */
function worldAtWar(state: GameState, emit: HookCtx['emit']): number {
  const list = state.players.filter((p) => p.alive && p.id !== BARBARIAN);
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      // the human is always the one declared upon
      const [by, target] = list[i].id === HUMAN ? [list[j], list[i]] : [list[i], list[j]];
      if (forceWar(by, target, emit)) n++;
    }
  }
  return n;
}

/** each listed city loses 1 pop; notifies the human */
function sicken(ctx: HookCtx, cities: City[], text: string, icon: string): void {
  for (const c of cities) {
    changePop(ctx.state, c, -1, ctx.emit);
    if (ctx.player.id === HUMAN) strike(ctx, `${text} ${c.name} loses a citizen.`, icon, c.tile);
  }
}

// ───────────────────────────── crises ─────────────────────────────

const LIST: CrisisDef[] = [
  // ── Ancient ──
  {
    id: 'long_winter', name: 'The Long Winter', eras: [0, 1], reward: 4, affectsAll: true,
    icon: 'moon', art: { hue: 205, motif: 'mountain' },
    description: '**Tundra** and **snow** tiles yield nothing, and {food} Food is **−25%** in every city. Grips every civilization.',
    flavor: 'The sun rose pale and small that year, and the rivers did not wake.',
    effects: {
      onBegin(ctx) {
        strike(ctx, 'The Long Winter falls. Frost locks the northern lands.', 'moon');
      },
      tileYield(_ctx, a) {
        if (a.tile.terrain !== 'tundra' && a.tile.terrain !== 'snow') return;
        for (const k of YIELD_KEYS) a.yields[k] = 0;
      },
      cityYield(_ctx, a) {
        a.pct.food -= 25;
      },
    },
  },
  {
    id: 'steppe_horde', name: 'Horde from the Steppe', eras: [0, 1, 2], reward: 5,
    icon: 'horse', art: { hue: 22, motif: 'horse' },
    description: 'Now and every other turn, a war band of **2 raiders, +1 per era after Ancient** (max 6) rides in 2–4 tiles beyond your borders.',
    flavor: 'First the dust. Then the drums. Then nothing at all where the villages stood.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        ctx.counters.turn = 0;
        hordeWave(ctx, true);
      },
      turnStart(ctx) {
        if (tick(ctx) % 2 === 0) hordeWave(ctx, false);
      },
    },
  },
  {
    id: 'great_flood', name: 'The Great Flood', eras: [0, 1], reward: 4,
    icon: 'wave', art: { hue: 195, motif: 'wave' },
    description: 'Each improvement on your **river** and **floodplain** tiles has a **1-in-3** chance to wash away (pillaged); those tiles yield **−1** {prod}.',
    flavor: 'It rained for forty days, and the old gods laughed from the hilltops.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        const { state } = ctx;
        let lost = 0;
        let first: TileIdx | undefined;
        for (const t of state.map.tiles) {
          if (t.owner !== ctx.player.id || !t.improvement || t.pillaged || !floodable(t)) continue;
          if (!chance(state.rng, 1 / 3)) continue;
          t.pillaged = true;
          lost++;
          first ??= t.idx;
        }
        ctx.counters.washedAway = lost;
        strike(ctx, lost
          ? `The Great Flood! The waters wash away ${lost} improvement${lost === 1 ? '' : 's'}.`
          : 'The Great Flood! The rivers burst their banks.', 'wave', first);
      },
      tileYield(_ctx, a) {
        if (floodable(a.tile)) a.yields.prod -= 1;
      },
    },
  },
  {
    id: 'dark_prophecy', name: 'Dark Prophecy', eras: [0, 1, 2, 3, 4, 5], reward: 10, targetMul: 1.5, weight: 0.5,
    icon: 'eye', art: { hue: 275, motif: 'eye' },
    description: 'The Chronicle target is **+50%**. No other rule — but overcoming it pays a doubled **10** {influence}.',
    flavor: 'The oracle spoke your name, and then she spoke of ashes.',
    effects: {
      onBegin(ctx) {
        strike(ctx, 'A Dark Prophecy is spoken. The Chronicle demands more of you.', 'eye');
      },
    },
  },

  // ── Classical ──
  {
    id: 'schism', name: 'The Great Schism', eras: [1, 2], reward: 5,
    icon: 'temple', art: { hue: 300, motif: 'temple' },
    description: '{cul} Culture is **−50%** in cities without a **Shrine** or **Temple**.',
    flavor: 'Two high priests, one altar, and a city that must choose which fire to feed.',
    effects: {
      onBegin(ctx) {
        const bare = citiesOf(ctx.state, ctx.player.id).filter((c) => !has(c, 'shrine', 'temple')).length;
        strike(ctx, bare
          ? `Schism! The faithful scatter — ${bare} of your cities ${bare === 1 ? 'has' : 'have'} no Shrine or Temple.`
          : 'Schism! Heresy spreads, but your temples hold firm.', 'temple');
      },
      cityYield(_ctx, a) {
        if (!has(a.city, 'shrine', 'temple')) a.pct.cul -= 50;
      },
    },
  },
  {
    id: 'sea_peoples', name: 'The Sea Peoples', eras: [1, 2], reward: 5,
    icon: 'ship', art: { hue: 215, motif: 'ship' },
    description: 'Now and every other turn, **2** raiders (**3** from the Medieval era) storm ashore beside one of your coastal cities (your capital if none).',
    flavor: 'They came from no land anyone could name, and they did not come to trade.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        ctx.counters.turn = 0;
        seaRaid(ctx);
      },
      turnStart(ctx) {
        if (tick(ctx) % 2 === 0) seaRaid(ctx);
      },
    },
  },
  {
    id: 'rival_ascendant', name: 'Rival Ascendant', eras: [1, 2, 3], reward: 6,
    icon: 'crown', art: { hue: 0, motif: 'crown' },
    description: 'The mightiest rival (most cities + population) **declares war**, and its forces fight at **+30%** strength against you.',
    flavor: 'There cannot be two suns in one sky, said the envoy, and burned the treaty before your throne.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        const { state } = ctx;
        let rival: Player | null = null;
        let best = -1;
        for (const p of state.players) {
          if (!p.alive || p.id === BARBARIAN) continue;
          if (p.id === ctx.player.id) continue;
          const cities = citiesOf(state, p.id);
          const might = cities.length + cities.reduce((s, c) => s + c.pop, 0);
          if (might > best) { best = might; rival = p; }
        }
        ctx.counters.rival = rival ? rival.id : -1;
        if (!rival) return;
        forceWar(rival, ctx.player, ctx.emit);
        strike(ctx, `${rival.civName} ascends! ${rival.name} declares war on you.`, 'war');
      },
      combat(ctx, a) {
        const rival = ctx.counters.rival ?? -1;
        if (rival >= 0 && enemyOwnerOf(a) === rival) enemyMod(a, 'Rival Ascendant', 30);
      },
    },
  },

  // ── Medieval ──
  {
    id: 'plague', name: 'The Plague', eras: [2, 3], reward: 6, affectsAll: true,
    icon: 'skull', art: { hue: 88, motif: 'skull' },
    description: 'Every 3rd turn, each city of **8+** pop without an **Aqueduct** loses 1 pop. Strikes every civilization.',
    flavor: 'Bells rang for the dead until there was no one left to ring them.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        strike(ctx, 'Plague! Crowded cities without an Aqueduct will suffer.', 'skull');
      },
      turnStart(ctx) {
        if (tick(ctx) % 3 !== 0) return;
        const sick = citiesOf(ctx.state, ctx.player.id).filter((c) => c.pop >= 8 && !has(c, 'aqueduct'));
        sicken(ctx, sick, 'Plague!', 'skull');
      },
    },
  },
  {
    id: 'iconoclasm', name: 'Iconoclasm', eras: [2, 3], reward: 6,
    icon: 'mask', art: { hue: 35, motif: 'mask' },
    description: 'Your **leftmost** active Doctrine is silenced for the chapter, and restored when the Crisis ends.',
    flavor: 'They took hammers to the old saints, and to the old ideas with them.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        const target = ctx.state.run.doctrines.find((d) => !d.disabled);
        ctx.counters.uid = target ? target.uid : -1;
        if (!target) {
          strike(ctx, 'Iconoclasm! The zealots find no doctrine to burn.', 'mask');
          return;
        }
        target.disabled = true;
        strike(ctx, 'Iconoclasm! Your leftmost Doctrine is silenced.', 'mask');
      },
      onEnd(ctx) {
        const uid = ctx.counters.uid ?? -1;
        const inst = ctx.state.run.doctrines.find((d) => d.uid === uid);
        if (inst) {
          inst.disabled = false;
          ctx.emit({ type: 'notify', text: 'The icons return. Your silenced Doctrine speaks again.', icon: 'doctrine', tone: 'good' });
        }
        ctx.counters.uid = -1;
      },
    },
  },
  {
    id: 'famine', name: 'The Great Famine', eras: [2, 3], reward: 5, affectsAll: true,
    icon: 'wheat', art: { hue: 40, motif: 'wheat' },
    description: '{food} Food is **−25%** in every city (**−10%** with a **Granary**). Strikes every civilization.',
    flavor: 'The granaries echoed. Mothers sang to children about bread.',
    effects: {
      onBegin(ctx) {
        strike(ctx, 'Famine! The harvest has failed across the world.', 'wheat');
      },
      cityYield(_ctx, a) {
        a.pct.food -= has(a.city, 'granary') ? 10 : 25;
      },
    },
  },

  // ── Renaissance ──
  {
    id: 'peasant_revolt', name: 'Peasant Revolt', eras: [3, 4], reward: 6,
    icon: 'unhappy', art: { hue: 12, motif: 'flame' },
    description: '**−3** {happy}. Every other turn, if your {happy} is negative, **1 rebel per 5 unhappiness** (1–3) rises beside your largest city.',
    flavor: 'Pitchforks first. Then muskets. Then the gallows in the square.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        strike(ctx, 'The peasants revolt! Keep your people content or face the mob.', 'unhappy');
      },
      happiness(_ctx, a) {
        a.value -= 3;
      },
      turnStart(ctx) {
        if (tick(ctx) % 2 !== 0) return;
        const h = ctx.player.happiness;
        if (!(h < 0)) return;
        const city = largestCity(ctx.state, ctx.player.id);
        if (!city) return;
        const count = Math.min(3, Math.max(1, Math.ceil(-h / 5)));
        const spots = clusterAround(ctx.state, nearCity(ctx.state, city), count);
        const n = spawnRaiders(ctx.state, spots, ctx.emit);
        if (n) strike(ctx, `Rebellion! ${n} rebel${n === 1 ? '' : 's'} rise${n === 1 ? 's' : ''} outside ${city.name}.`, 'unhappy', city.tile);
      },
    },
  },
  {
    id: 'comet_omen', name: 'Comet of Ill Omen', eras: [3, 4], reward: 6,
    icon: 'star', art: { hue: 250, motif: 'star' },
    description: "Your **Focus** pillar receives only half its usual bonus in this chapter's Chronicle (×1.5 instead of ×2).",
    flavor: 'A second sun with a burning tail — the astrologers wept, and the people believed them.',
    effects: {
      onBegin(ctx) {
        strike(ctx, 'A comet blazes overhead. Your Focus bonus is halved this chapter.', 'star');
      },
      chronicle(ctx, c) {
        const focus = pillarRenown(ctx.state, c.stats, c.focus);
        if (focus > 0) c.addRenown(-focus * (FOCUS_RENOWN_MUL - 1) * 0.5, 'Comet: Focus eclipsed');
      },
    },
  },
  {
    id: 'debt_crisis', name: 'Debt Crisis', eras: [3, 4], reward: 7,
    icon: 'coin', art: { hue: 50, motif: 'coin' },
    description: '{gold} Gold is **−50%** in every city, and this chapter\'s Council pays **no interest** on your {influence}.',
    flavor: 'The crown borrowed against the harvest, then the harvest against the crown.',
    effects: {
      onBegin(ctx) {
        strike(ctx, 'Debt Crisis! The treasury is pledged to foreign bankers.', 'coin');
      },
      cityYield(_ctx, a) {
        a.pct.gold -= 50;
      },
      influenceIncome(_ctx, a) {
        // every interest line (base Interest and reform interest) is seized
        let interest = 0;
        for (const l of a.lines) if (/interest/i.test(l.label) && l.amount > 0) interest += l.amount;
        if (interest > 0) a.lines.push({ label: 'Debt Crisis: creditors seize', amount: -interest });
      },
    },
  },

  // ── Industrial ──
  {
    id: 'trade_collapse', name: 'Collapse of Trade', eras: [4, 5], reward: 7,
    icon: 'anchor', art: { hue: 28, motif: 'anchor' },
    description: 'Luxury resources grant **no** {happy}, and improvements cost **+50%** {gold}.',
    flavor: 'Ships rot at anchor. Silk rots in the warehouses. Nobody can pay for either.',
    effects: {
      onBegin(ctx) {
        strike(ctx, 'Trade collapses! Luxuries no longer comfort your people.', 'commerce');
      },
      happiness(ctx, a) {
        for (const res of connectedResources(ctx.state, ctx.player.id)) {
          const def = RESOURCES[res];
          if (def?.kind === 'luxury') a.value -= def.happiness ?? LUXURY_HAPPINESS;
        }
      },
      cost(_ctx, a) {
        if (a.currency === 'gold' && a.item.kind === 'improvement') a.cost *= 1.5;
      },
    },
  },
  {
    id: 'industrial_smog', name: 'The Great Smog', eras: [4, 5], reward: 7, affectsAll: true,
    icon: 'gear', art: { hue: 70, motif: 'gear' },
    description: 'Cities with a **Factory** or **Power Plant** but no **Hospital**: {food} **−25%** and **−1** {happy} each. Chokes every civilization.',
    flavor: 'Noon looked like dusk, and the children coughed black.',
    effects: {
      onBegin(ctx) {
        strike(ctx, 'The Great Smog settles over the industrial cities.', 'gear');
      },
      cityYield(_ctx, a) {
        if (smoggy(a.city)) a.pct.food -= 25;
      },
      happiness(ctx, a) {
        a.value -= citiesOf(ctx.state, ctx.player.id).filter(smoggy).length;
      },
    },
  },
  {
    id: 'pandemic', name: 'The Pandemic', eras: [4, 5], reward: 7, affectsAll: true,
    icon: 'serpent', art: { hue: 140, motif: 'serpent' },
    description: 'Every other turn, each city of **10+** pop without a **Hospital** loses 1 pop. Units heal **half** as fast. Strikes every civilization.',
    flavor: 'It crossed oceans in a week. The doctors worked until they, too, lay down.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        strike(ctx, 'Pandemic! Great cities without a Hospital will sicken.', 'skull');
      },
      turnStart(ctx) {
        if (tick(ctx) % 2 !== 0) return;
        const sick = citiesOf(ctx.state, ctx.player.id).filter((c) => c.pop >= 10 && !has(c, 'hospital'));
        sicken(ctx, sick, 'Pandemic!', 'skull');
      },
      unitHeal(_ctx, a) {
        a.value = Math.floor(a.value / 2);
      },
    },
  },
  {
    id: 'world_war', name: 'The World War', eras: [4, 5], reward: 8,
    icon: 'war', art: { hue: 355, motif: 'sword' },
    description: 'Every civilization goes to **war with every other**, and any peace collapses at the start of each of your turns.',
    flavor: 'The lamps are going out all over the world.',
    effects: {
      onBegin(ctx) {
        worldAtWar(ctx.state, ctx.emit);
        strike(ctx, 'World War! Every nation takes up arms against every other.', 'war');
      },
      turnStart(ctx) {
        if (worldAtWar(ctx.state, ctx.emit) > 0) strike(ctx, 'The armistice fails. The World War rages on.', 'war');
      },
    },
  },

  // ── Modern ──
  {
    id: 'nuclear_standoff', name: 'Nuclear Standoff', eras: [5], reward: 8,
    icon: 'hourglass', art: { hue: 15, motif: 'sun' },
    description: '{sci} Science **−25%**. Each turn you start **at war** with a rival ticks the Doomsday Clock; at **4**, your largest city loses **half** its pop and the Clock resets.',
    flavor: 'Two fingers on two buttons, and the whole world holding its breath.',
    effects: {
      onBegin(ctx) {
        resetCounters(ctx);
        ctx.counters.clock = 0;
        strike(ctx, 'Nuclear Standoff! The Doomsday Clock starts ticking whenever you are at war.', 'hourglass');
      },
      cityYield(_ctx, a) {
        a.pct.sci -= 25;
      },
      turnStart(ctx) {
        if (!isAtWar(ctx.state, ctx.player.id)) return;
        const clock = (ctx.counters.clock ?? 0) + 1;
        if (clock < 4) {
          ctx.counters.clock = clock;
          strike(ctx, `The Doomsday Clock ticks: ${clock}/4.`, 'hourglass');
          return;
        }
        ctx.counters.clock = 0;
        const city = largestCity(ctx.state, ctx.player.id);
        if (!city) return;
        const loss = Math.floor(city.pop / 2);
        if (loss > 0) changePop(ctx.state, city, -loss, ctx.emit);
        strike(ctx, `Midnight. Fire falls on ${city.name}${loss > 0 ? ` — ${loss} pop lost` : ''}.`, 'skull', city.tile);
      },
    },
  },
  {
    id: 'great_blackout', name: 'The Great Blackout', eras: [5], reward: 8,
    icon: 'bolt', art: { hue: 230, motif: 'bolt' },
    description: 'Cities without a **Power Plant** suffer **−30%** {prod} Production and {sci} Science.',
    flavor: 'The grid failed at 4:13 in the afternoon. By nightfall, so had everything else.',
    effects: {
      onBegin(ctx) {
        const dark = citiesOf(ctx.state, ctx.player.id).filter((c) => !has(c, 'powerplant')).length;
        strike(ctx, dark
          ? `The Great Blackout! ${dark} of your cities ${dark === 1 ? 'goes' : 'go'} dark without a Power Plant.`
          : 'The Great Blackout! Your grid holds while the world goes dark.', 'bolt');
      },
      cityYield(_ctx, a) {
        if (has(a.city, 'powerplant')) return;
        a.pct.prod -= 30;
        a.pct.sci -= 30;
      },
    },
  },
];

// ───────────────────────────── crisis-specific logic ─────────────────────────────

function floodable(t: GameState['map']['tiles'][number]): boolean {
  return !isWaterTile(t) && (isRiverTile(t) || t.feature === 'floodplains');
}

function smoggy(c: City): boolean {
  return has(c, 'factory', 'powerplant') && !has(c, 'hospital');
}

function hordeWave(ctx: HookCtx, first: boolean): void {
  const { state } = ctx;
  const count = Math.min(6, 2 + Math.max(0, state.run.era));
  const spots = clusterAround(state, beyondBorders(state, ctx.player.id), count);
  const n = spawnRaiders(state, spots, ctx.emit);
  if (n) strike(ctx, first ? `The Horde rides! ${n} raiders gather beyond your borders.` : `Another war band of ${n} rides out of the steppe.`, 'horse', spots[0]);
}

function seaRaid(ctx: HookCtx): void {
  const { state } = ctx;
  const cities = citiesOf(state, ctx.player.id);
  if (!cities.length) return;
  const coastal = cities.filter((c) => isCoastalCity(state, c));
  const city = coastal.length ? pick(state.rng, coastal) : cities.find((c) => c.isCapital) ?? cities[0];
  const count = state.run.era >= 2 ? 3 : 2;
  const shore = nearCity(state, city, (i) => isCoastalTile(state, state.map.tiles[i]));
  const spots = clusterAround(state, shore.length >= count ? shore : nearCity(state, city), count);
  const n = spawnRaiders(state, spots, ctx.emit);
  if (n) strike(ctx, `The Sea Peoples land near ${city.name}! ${n} raiders storm ashore.`, 'ship', city.tile);
}

export const CRISES: Record<string, CrisisDef> = Object.fromEntries(LIST.map((c) => [c.id, c]));
