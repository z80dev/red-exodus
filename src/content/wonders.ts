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
    id: 'pyramids', name: 'The Pyramids', era: 0, cost: 115, tech: 'bronze_working', requiresTerrain: ['desert', 'plains', 'grassland'],
    yields: { prod: 2, cul: 1 },
    effects: {
      cost(_ctx, a) {
        if (a.currency === 'prod' && a.item.kind === 'building') a.cost = Math.round(a.cost * 0.8);
      },
    },
    description: '+2 {prod} +1 {cul}. **Buildings cost 20% less {prod} in every city** (+25% build speed).',
    flavor: '“Ten thousand hands, one sunrise, and a mountain made by men.”',
  }),
  wonder({
    id: 'stonehenge', name: 'Stonehenge', era: 0, cost: 110, tech: 'mining',
    yields: { cul: 3 },
    effects: {
      cityYield(_ctx, a) { a.yields.cul += 1; },
      chronicle(_ctx, c) { if (c.focus === 'arts') c.addSplendor(1, 'Stonehenge'); },
    },
    description: '+3 {cul}. **+1 {cul} in every city.** Chronicles with an **Arts** Focus gain +1 {splendor}.',
    flavor: '“The stones remember every solstice. So will they remember you.”',
  }),
  wonder({
    id: 'hanging_gardens', name: 'Hanging Gardens', era: 0, cost: 120, tech: 'agriculture', requiresRiver: true,
    yields: { food: 3 }, happiness: 1,
    effects: {
      cityYield(_ctx, a) { a.pct.food += 10; },
    },
    description: '+3 {food}, +1 {happy}. Must be built on a river. **+10% {food} in every city.**',
    flavor: '“A queen longed for the hills of home, so a king raised a forest into the sky.”',
  }),

  // ───────── Era 1 · Classical ─────────
  wonder({
    id: 'colossus', name: 'The Colossus', era: 1, cost: 180, tech: 'currency', requiresCoastal: true,
    yields: { gold: 3 },
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && TERRAINS[a.tile.terrain]?.water) a.yields.gold += 1;
      },
    },
    description: '+3 {gold}. Coastal. **Every water tile of this city yields +1 {gold}.**',
    flavor: '“Bronze giant astride the harbor, every sail that passes pays him homage.”',
  }),
  wonder({
    id: 'great_library', name: 'The Great Library', era: 1, cost: 195, tech: 'writing',
    yields: { sci: 3, cul: 1 },
    effects: {
      onEvent: onCompleted((ctx) => {
        for (const tech of cheapestAvailableTechs(ctx.player.techs, 2)) grantTech(ctx.state, ctx.player.id, tech, ctx.emit);
      }),
    },
    description: '+3 {sci} +1 {cul}. **On completion: 2 free techs** (the cheapest available).',
    flavor: '“Every ship that docks must surrender its scrolls. Knowledge is the only tax worth paying.”',
  }),
  wonder({
    id: 'oracle', name: 'The Oracle', era: 1, cost: 175, tech: 'calendar', requiresTerrain: ['plains', 'grassland', 'tundra', 'desert'],
    yields: { cul: 3 }, happiness: 2,
    effects: {
      onEvent: onCompleted((ctx) => {
        if (ctx.player.id === HUMAN) addInfluence(ctx.state, 4, ctx.emit);
      }),
      influenceIncome(_ctx, a) { a.lines.push({ label: 'The Oracle', amount: 1 }); },
    },
    description: '+3 {cul}, +2 {happy}. **On completion: +4 {influence}**, then +1 {influence} every chapter.',
    flavor: '“Ask, and the smoke will answer. Whether you like the answer is another matter.”',
  }),

  // ───────── Era 2 · Medieval ─────────
  wonder({
    id: 'great_wall', name: 'The Great Wall', era: 2, cost: 290, tech: 'engineering',
    yields: { cul: 2, prod: 1 },
    effects: {
      combat(ctx, a) {
        const me = ctx.player.id;
        if (a.side === 'defense' && a.defender && a.tile.owner === me) a.defenseMods.push({ label: 'Great Wall', pct: 15 });
        if (a.side === 'attack' && a.attacker && a.fromTile.owner === me) a.attackMods.push({ label: 'Great Wall', pct: 15 });
      },
      cost(_ctx, a) {
        if (a.currency === 'prod' && a.item.kind === 'building' && (a.item.id === 'walls' || a.item.id === 'castle')) a.cost = Math.round(a.cost * 0.5);
      },
    },
    description: '+2 {cul} +1 {prod}. **Your units fight at +15% inside your borders.** Walls and Castles cost 50% less {prod}.',
    flavor: '“Ten thousand li of stone, and every brick a sleepless sentry.”',
  }),
  wonder({
    id: 'hagia_sophia', name: 'Hagia Sophia', era: 2, cost: 300, tech: 'theology',
    yields: { cul: 3 }, happiness: 2,
    effects: {
      happiness(ctx, a) {
        for (const c of Object.values(ctx.state.cities)) {
          if (c.owner !== ctx.player.id) continue;
          for (const b of c.buildings) if (b === 'temple' || b === 'cathedral') a.value += 1;
        }
      },
    },
    description: '+3 {cul}, +2 {happy}. **+1 {happy} for every Temple and Cathedral** in your empire.',
    flavor: '“The dome does not rest on its walls. It hangs from heaven by a golden chain.”',
  }),
  wonder({
    id: 'angkor_wat', name: 'Angkor Wat', era: 2, cost: 310, tech: 'theology',
    yields: { cul: 3, food: 2 },
    effects: {
      borderThreshold(_ctx, a) { a.value = Math.round(a.value * 0.66); },
      cityYield(_ctx, a) { a.yields.food += 1; },
    },
    description: '+3 {cul} +2 {food}. **Borders grow 33% faster and every city gains +1 {food}.**',
    flavor: '“The city is a temple, and the temple is a map of the universe drawn in water.”',
  }),

  // ───────── Era 3 · Renaissance ─────────
  wonder({
    id: 'taj_mahal', name: 'Taj Mahal', era: 3, cost: 450, tech: 'architecture', requiresRiver: true,
    yields: { cul: 4 }, happiness: 4,
    effects: {
      cityYield(_ctx, a) { a.pct.cul += 15; },
    },
    description: '+4 {cul}, +4 {happy}. Must be built on a river. **+15% {cul} in every city.**',
    flavor: '“A teardrop on the cheek of time, carved in marble that blushes at dawn.”',
  }),
  wonder({
    id: 'leaning_tower', name: 'Leaning Tower', era: 3, cost: 440, tech: 'astronomy',
    yields: { sci: 4 },
    effects: {
      cityYield(_ctx, a) { if (a.city.buildings.includes('library')) a.yields.sci += 2; },
      chronicle(_ctx, c) { if (c.focus === 'discovery') c.addSplendor(1, 'Leaning Tower'); },
    },
    description: '+4 {sci}. **+2 {sci} in every city with a Library.** Chronicles with a **Discovery** Focus gain +1 {splendor}.',
    flavor: '“Drop two stones from the top and the world will never fall the same way again.”',
  }),
  wonder({
    id: 'himeji', name: 'Himeji Castle', era: 3, cost: 460, tech: 'gunpowder', requiresTerrain: ['grassland', 'plains', 'tundra'],
    yields: { prod: 2, cul: 2 },
    effects: {
      unitHeal(_ctx, a) { a.value += 10; },
      combat(ctx, a) {
        if (a.side === 'defense' && a.defender && a.tile.owner === ctx.player.id) a.defenseMods.push({ label: 'Himeji Castle', pct: 15 });
      },
    },
    description: '+2 {prod} +2 {cul}. **Your units heal +10 HP per turn** and defend at +15% inside your borders.',
    flavor: '“The White Heron spreads its wings, and no arrow has ever found its heart.”',
  }),

  // ───────── Era 4 · Industrial ─────────
  wonder({
    id: 'big_ben', name: 'Big Ben', era: 4, cost: 650, tech: 'economics',
    yields: { gold: 6 },
    effects: {
      cost(_ctx, a) { if (a.currency === 'gold') a.cost = Math.round(a.cost * 0.75); },
    },
    description: '+6 {gold}. **Everything bought with {gold} costs 25% less** — items, improvements and upgrades.',
    flavor: '“Every hour on the hour, the empire checks its ledgers and smiles.”',
  }),
  wonder({
    id: 'eiffel', name: 'Eiffel Tower', era: 4, cost: 660, tech: 'industrialization',
    yields: { cul: 5 }, happiness: 10,
    description: '+5 {cul}. **+10 {happy}.** An iron lattice the whole world comes to see.',
    flavor: '“They called it a monstrous skeleton. Then they could not stop looking at it.”',
  }),
  wonder({
    id: 'liberty', name: 'Statue of Liberty', era: 4, cost: 680, tech: 'electricity', requiresCoastal: true,
    yields: { cul: 3 }, happiness: 2,
    effects: {
      onEvent: onCompleted((ctx) => {
        for (const c of citiesOf(ctx.state, ctx.player.id)) changePop(ctx.state, c, 1, ctx.emit);
      }),
      growthThreshold(_ctx, a) { a.value = Math.round(a.value * 0.9); },
    },
    description: '+3 {cul}, +2 {happy}. Coastal. **On completion: +1 population in every city.** Cities grow 10% faster.',
    flavor: '“Give me your tired, your poor — and watch them build a nation.”',
  }),

  // ───────── Era 5 · Modern ─────────
  wonder({
    id: 'opera_house', name: 'Opera House', era: 5, cost: 900, tech: 'computers', requiresCoastal: true,
    yields: { cul: 8 },
    effects: {
      chronicle(_ctx, c) { c.addSplendor(2, 'Opera House'); },
    },
    description: '+8 {cul}. Coastal. **+2 {splendor} in every Chronicle.**',
    flavor: '“White sails of concrete, forever about to leave the harbor.”',
  }),
  wonder({
    id: 'cristo', name: 'Cristo Redentor', era: 5, cost: 920, tech: 'radio', requiresTerrain: ['grassland', 'plains', 'desert', 'tundra'],
    yields: { cul: 5 }, happiness: 4,
    effects: {
      cityYield(_ctx, a) { a.pct.cul += 10; a.pct.gold += 10; },
    },
    description: '+5 {cul}, +4 {happy}. **+10% {cul} and {gold} in every city.**',
    flavor: '“A radio signal from across the sea lit him up, and he has not let go of the city since.”',
  }),
  wonder({
    id: 'launch_pad', name: 'Launch Pad', era: 5, cost: 1000, tech: 'rocketry',
    yields: { sci: 10 },
    effects: {
      chronicle(_ctx, c) { c.mulSplendor(2, 'Launch Pad'); },
    },
    description: '+10 {sci}. **×2 {splendor} in every future Chronicle.** The last great race.',
    flavor: '“Three. Two. One. And the story of your people leaves the world behind.”',
  }),
];

export const WONDERS: Record<string, WonderDef> = Object.fromEntries(LIST.map((w) => [w.id, w]));
