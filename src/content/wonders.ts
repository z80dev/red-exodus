// OWNER: ContentCiv. World wonders: 18 (3 per era). Each is a race against the rivals; each has a memorable hook.
// Wonder `effects` run for the owning player (sim/effects.ts). Empire-wide hooks apply to every city; hooks
// meant for the host city only filter on `ctx.cityId`. One-shot rewards fire on the owner's own `wonderBuilt`
// event and latch `ctx.counters.done` so recapture/replays never re-trigger them.
import type { EffectHooks, HookCtx, WonderDef } from '../sim/defs';
import type { SimEvent, TechId } from '../sim/types';
import { HUMAN } from '../sim/types';
import { changePop, citiesOf } from '../sim/cities';
import { grantTech } from '../sim/economy';
import { addInfluence } from '../sim/roguelite';
import { TECHS } from './techs';
import { TERRAINS } from './terrain';

type WonderSpec = Omit<WonderDef, 'model' | 'icon'>;
function wonder(spec: WonderSpec): WonderDef {
  return { ...spec, model: `w_${spec.id}`, icon: spec.id };
}

/** Run `fn` once, when the owner completes this wonder. */
function onCompleted(fn: (ctx: HookCtx) => void): NonNullable<EffectHooks['onEvent']> {
  return (ctx: HookCtx, ev: SimEvent) => {
    if (ev.type !== 'wonderBuilt' || ev.wonder !== ctx.id || ev.player !== ctx.player.id || ctx.counters.done) return;
    ctx.counters.done = 1;
    fn(ctx);
  };
}

/** Cheapest techs the player can research right now (ties broken by era/layout order). */
export function cheapestAvailableTechs(known: readonly TechId[], n: number): TechId[] {
  const have = new Set(known);
  return Object.values(TECHS)
    .filter((t) => !have.has(t.id) && t.prereqs.every((p) => have.has(p)))
    .sort((a, b) => a.cost - b.cost || a.era - b.era || a.pos.col - b.pos.col || a.pos.row - b.pos.row)
    .slice(0, n)
    .map((t) => t.id);
}

const LIST: WonderDef[] = [
  // ───────── Era 0 · Ancient ─────────
  wonder({
    id: 'pyramids', name: 'Dust-Brick Citadel', era: 0, cost: 115, tech: 'bronze_working', requiresTerrain: ['desert', 'plains', 'grassland'],
    yields: { prod: 2, cul: 1 },
    effects: {
      cost(_ctx, a) {
        if (a.currency === 'prod' && a.item.kind === 'building') a.cost = Math.round(a.cost * 0.8);
      },
    },
    description: '+2 {prod} +1 {cul}. **Buildings cost 20% less {prod} in every colony.**',
    flavor: '“Ten thousand hands built a mountain from dust.”',
  }),
  wonder({
    id: 'stonehenge', name: 'Solar Henge', era: 0, cost: 110, tech: 'mining',
    yields: { cul: 3 },
    effects: {
      cityYield(_ctx, a) { a.yields.cul += 1; },
      chronicle(_ctx, c) { if (c.focus === 'arts') c.addSplendor(1, 'Solar Henge'); },
    },
    description: '+3 {cul}. **+1 {cul} in every colony.** Chapter Reports with Culture Focus get +1 {splendor}.',
    flavor: '“Mirrors follow the sun. At night they show an empty sky.”',
  }),
  wonder({
    id: 'hanging_gardens', name: 'Hanging Greenhouses', era: 0, cost: 120, tech: 'agriculture', requiresRiver: true,
    yields: { food: 3 }, happiness: 1,
    effects: {
      cityYield(_ctx, a) { a.pct.food += 10; },
    },
    description: '+3 {food} +1 {happy}. Build next to an Ice Channel. **+10% {food} in every colony.**',
    flavor: '“Gardens hang above the dust. Gravity complains, but the crops do not.”',
  }),

  // ───────── Era 1 · Classical ─────────
  wonder({
    id: 'colossus', name: 'Beacon Colossus', era: 1, cost: 180, tech: 'currency', requiresCoastal: true,
    yields: { gold: 3 },
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && TERRAINS[a.tile.terrain]?.water) a.yields.gold += 1;
      },
    },
    description: '+3 {gold}. Coastal. **Each water tile of this colony gets +1 {gold}.**',
    flavor: '“A tall beacon. The ships are gone, but the signal still works.”',
  }),
  wonder({
    id: 'great_library', name: 'Library of Earth', era: 1, cost: 195, tech: 'writing',
    yields: { sci: 3, cul: 1 },
    effects: {
      onEvent: onCompleted((ctx) => {
        for (const tech of cheapestAvailableTechs(ctx.player.techs, 2)) grantTech(ctx.state, ctx.player.id, tech, ctx.emit);
      }),
    },
    description: '+3 {sci} +1 {cul}. **When built: get 2 free techs** (the cheapest ones).',
    flavor: '“Knowledge was the one thing nobody could take. Keep the backups.”',
  }),
  wonder({
    id: 'oracle', name: 'The Deep Ear', era: 1, cost: 175, tech: 'calendar', requiresTerrain: ['plains', 'grassland', 'tundra', 'desert'],
    yields: { cul: 3 }, happiness: 2,
    effects: {
      onEvent: onCompleted((ctx) => {
        if (ctx.player.id === HUMAN) addInfluence(ctx.state, 4, ctx.emit);
      }),
      influenceIncome(_ctx, a) { a.lines.push({ label: 'The Deep Ear', amount: 1 }); },
    },
    description: '+3 {cul} +2 {happy}. **When built: +4 {influence}.** Then +1 {influence} every chapter.',
    flavor: '“The dish listens for Earth. Mostly static. Sometimes an answer.”',
  }),

  // ───────── Era 2 · Medieval ─────────
  wonder({
    id: 'great_wall', name: 'Storm Wall', era: 2, cost: 290, tech: 'engineering',
    yields: { cul: 2, prod: 1 },
    effects: {
      combat(ctx, a) {
        const me = ctx.player.id;
        if (a.side === 'defense' && a.defender && a.tile.owner === me) a.defenseMods.push({ label: 'Storm Wall', pct: 15 });
        if (a.side === 'attack' && a.attacker && a.fromTile.owner === me) a.attackMods.push({ label: 'Storm Wall', pct: 15 });
      },
      cost(_ctx, a) {
        if (a.currency === 'prod' && a.item.kind === 'building' && (a.item.id === 'walls' || a.item.id === 'castle')) a.cost = Math.round(a.cost * 0.5);
      },
    },
    description: '+2 {cul} +1 {prod}. **Your units fight at +15% inside your borders.** Blast Walls and Bastion Domes cost 50% less {prod}.',
    flavor: '“Storms do not negotiate.”',
  }),
  wonder({
    id: 'hagia_sophia', name: 'Dome of Remembrance', era: 2, cost: 300, tech: 'theology',
    yields: { cul: 3 }, happiness: 2,
    effects: {
      happiness(ctx, a) {
        for (const c of Object.values(ctx.state.cities)) {
          if (c.owner !== ctx.player.id) continue;
          for (const b of c.buildings) if (b === 'temple' || b === 'cathedral') a.value += 1;
        }
      },
    },
    description: '+3 {cul} +2 {happy}. **+1 {happy} for each Memorial Chapel and Cathedral of Earth** you own.',
    flavor: '“A dome for memory, sealed against the dust.”',
  }),
  wonder({
    id: 'angkor_wat', name: 'Lava Tube Temple City', era: 2, cost: 310, tech: 'theology',
    yields: { cul: 3, food: 2 },
    effects: {
      borderThreshold(_ctx, a) { a.value = Math.round(a.value * 0.66); },
      cityYield(_ctx, a) { a.yields.food += 1; },
    },
    description: '+3 {cul} +2 {food}. **Borders grow 33% faster. Every colony gets +1 {food}.**',
    flavor: '“Shelter in the old tubes. Feed the colony above.”',
  }),

  // ───────── Era 3 · Renaissance ─────────
  wonder({
    id: 'taj_mahal', name: 'Monument to the Lost', era: 3, cost: 450, tech: 'architecture', requiresRiver: true,
    yields: { cul: 4 }, happiness: 4,
    effects: {
      cityYield(_ctx, a) { a.pct.cul += 15; },
    },
    description: '+4 {cul} +4 {happy}. Build next to an Ice Channel. **+15% {cul} in every colony.**',
    flavor: '“A glass memorial where the lost can look up.”',
  }),
  wonder({
    id: 'leaning_tower', name: 'Tilted Spire', era: 3, cost: 440, tech: 'astronomy',
    yields: { sci: 4 },
    effects: {
      cityYield(_ctx, a) { if (a.city.buildings.includes('library')) a.yields.sci += 2; },
      chronicle(_ctx, c) { if (c.focus === 'discovery') c.addSplendor(1, 'Tilted Spire'); },
    },
    description: '+4 {sci}. **+2 {sci} in every colony with a Data Archive.** Chapter Reports with Science Focus get +1 {splendor}.',
    flavor: '“It leans on purpose, say the engineers.”',
  }),
  wonder({
    id: 'himeji', name: 'Olympus Observatory', era: 3, cost: 460, tech: 'gunpowder', requiresTerrain: ['grassland', 'plains', 'tundra'],
    yields: { prod: 2, cul: 2 },
    effects: {
      unitHeal(_ctx, a) { a.value += 10; },
      combat(ctx, a) {
        if (a.side === 'defense' && a.defender && a.tile.owner === ctx.player.id) a.defenseMods.push({ label: 'Olympus Observatory', pct: 15 });
      },
    },
    description: '+2 {prod} +2 {cul}. **Your units heal +10 HP each turn.** They also defend at +15% inside your borders.',
    flavor: '“It watches the horizon but cannot make it less scary.”',
  }),

  // ───────── Era 4 · Industrial ─────────
  wonder({
    id: 'big_ben', name: 'Mars Clocktower', era: 4, cost: 650, tech: 'economics',
    yields: { gold: 6 },
    effects: {
      cost(_ctx, a) { if (a.currency === 'gold') a.cost = Math.round(a.cost * 0.75); },
    },
    description: '+6 {gold}. **Everything you buy with {gold} costs 25% less.**',
    flavor: '“Every hour, the colony checks its accounts and smiles.”',
  }),
  wonder({
    id: 'eiffel', name: 'Sky Tower', era: 4, cost: 660, tech: 'industrialization',
    yields: { cul: 5 }, happiness: 10,
    description: '+5 {cul}. **+10 {happy}.** A tall tower lifts cargo above the worst dust.',
    flavor: '“A cable to orbit: the longest lift queue in the solar system.”',
  }),
  wonder({
    id: 'liberty', name: 'Statue of Tomorrow', era: 4, cost: 680, tech: 'electricity', requiresCoastal: true,
    yields: { cul: 3 }, happiness: 2,
    effects: {
      onEvent: onCompleted((ctx) => {
        for (const c of citiesOf(ctx.state, ctx.player.id)) changePop(ctx.state, c, 1, ctx.emit);
      }),
      growthThreshold(_ctx, a) { a.value = Math.round(a.value * 0.9); },
    },
    description: '+3 {cul} +2 {happy}. Coastal. **When built: +1 population in every colony.** Colonies also grow 10% faster.',
    flavor: '“The light on the horizon is a lander with another crew.”',
  }),

  // ───────── Era 5 · Modern ─────────
  wonder({
    id: 'opera_house', name: 'Biodome Opera', era: 5, cost: 900, tech: 'computers', requiresCoastal: true,
    yields: { cul: 8 },
    effects: {
      chronicle(_ctx, c) { c.addSplendor(2, 'Biodome Opera'); },
    },
    description: '+8 {cul}. Coastal. **+2 {splendor} in every Chapter Report.**',
    flavor: '“A glass dome opens to the stars. Everyone has a seat.”',
  }),
  wonder({
    id: 'cristo', name: 'Guardian of Mars', era: 5, cost: 920, tech: 'radio', requiresTerrain: ['grassland', 'plains', 'desert', 'tundra'],
    yields: { cul: 5 }, happiness: 4,
    effects: {
      cityYield(_ctx, a) { a.pct.cul += 10; a.pct.gold += 10; },
    },
    description: '+5 {cul} +4 {happy}. **+10% {cul} and +10% {gold} in every colony.**',
    flavor: '“Arms open over the valley, watching over a wild world.”',
  }),
  wonder({
    id: 'launch_pad', name: 'Space Elevator', era: 5, cost: 1000, tech: 'rocketry',
    yields: { sci: 10 },
    effects: {
      chronicle(_ctx, c) { c.mulSplendor(2, 'Space Elevator'); },
    },
    description: '+10 {sci}. **×2 {splendor} in every future Chapter Report.**',
    flavor: '“Three, two, one. The colony reaches up. Earth does not answer.”',
  }),
];

export const WONDERS: Record<string, WonderDef> = Object.fromEntries(LIST.map((w) => [w.id, w]));
