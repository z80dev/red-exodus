// OWNER: CrewReskin. Uncommon Crew — merged into DOCTRINES by content/index.ts.
import type { DoctrineDef } from '../sim/defs';
import { registerCrew } from './doctrineRegistry';
import type { City } from '../sim/types';
import { BARBARIAN, PILLARS } from '../sim/types';
import { RESOURCES } from './resources';
import { PILLAR_DEFS } from './pillars';
import { EDICTS } from './edicts';
import { changePop,citiesOf } from '../sim/cities';
import { addGold,availableTechs,grantTech } from '../sim/economy';
import { randInt } from '../sim/rng';
import { addInfluence, CRISIS_CHAPTER } from '../sim/roguelite';
import { isNextToMountain,isWoodland,isRiverCity,isCoastalCity,countOwnedTiles,countBuildings,cityHas,countWonders,luxuriesOwned,unitClassOf,ownMod,ownUnit,ownTile,unitKillBy,pillarRenown,pushDoctrineCard,mul,shrineCount,COUNCIL_REPRICER } from './doctrines';

export const UNCOMMON: DoctrineDef[] = [
  {
    id: 'legend_of_the_steppe', name: 'Dune Buggy Scout', rarity: 'uncommon', cost: 6,
    description: 'Gains **+0.5** {splendor} each time one of your units defeats an enemy unit.',
    flavor: 'The dust keeps a record. The scout keeps driving.',
    tags: ['conquest', 'scaling', 'splendor'], icon: 'horse', art: { hue: 12, motif: 'horse' }, nation: 'russia',
    status(counters) { return `+${counters.splendor ?? 0} Multiplier`; },
    effects: {
      onEvent(ctx, ev) {
        const kill = unitKillBy(ev, ctx.player.id);
        if (!kill) return;
        ctx.counters.splendor = (ctx.counters.splendor ?? 0) + 0.5;
        ctx.flash(`+${ctx.counters.splendor} Multiplier`, kill.tile);
      },
      chronicle(ctx, c) { const n = ctx.counters.splendor ?? 0; if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'river_kings', name: 'Channel Pump Operator', rarity: 'uncommon', cost: 6,
    description: 'Colonies on Ice Channels get +15% {prod} and +15% {gold}.',
    flavor: 'The water is limited. The paperwork is not.',
    tags: ['river', 'production', 'gold'], icon: 'river', art: { hue: 198, motif: 'river' }, nation: 'india',
    effects: {
      cityYield(ctx, a) { if (isRiverCity(ctx.state, a.city)) { a.pct.prod += 15; a.pct.gold += 15; } },
    },
  },
  {
    id: 'harbor_masters', name: 'Dust Skiff Dock Crew', rarity: 'uncommon', cost: 6,
    description: 'Coastal colonies get +2 {prod}. **+2** {splendor} for each colony with a Harbor.',
    flavor: 'Every skiff answers to one very tired radio.',
    tags: ['coastal', 'production', 'splendor'], icon: 'harbor', art: { hue: 195, motif: 'anchor' }, nation: 'uae',
    effects: {
      cityYield(ctx, a) { if (isCoastalCity(ctx.state, a.city)) a.yields.prod += 2; },
      chronicle(_ctx, c) { const n = c.cities.filter((x) => cityHas(x, 'harbor')).length; if (n) c.addSplendor(2 * n); },
    },
  },
  {
    id: 'mountain_monastery', name: 'Mountain Signal Tech', rarity: 'uncommon', cost: 6,
    description: 'Colonies next to Mountains get +2 {sci} and +2 {cul}.',
    flavor: 'The antenna reaches orbit. The coffee barely reaches morning.',
    tags: ['mountain', 'science', 'culture'], icon: 'temple', art: { hue: 215, motif: 'mountain' }, nation: 'switzerland',
    effects: {
      cityYield(ctx, a) { if (isNextToMountain(ctx.state, a.city.tile)) { a.yields.sci += 2; a.yields.cul += 2; } },
    },
  },
  {
    id: 'dune_riders', name: 'Dune Skimmer Courier', rarity: 'uncommon', cost: 6,
    description: 'Mounted units get +1 movement. They get +25% strength when fighting on Dunes.',
    flavor: 'Sand stops wheels. These wheels learned to hover.',
    tags: ['desert', 'conquest'], icon: 'mounted', art: { hue: 38, motif: 'horse' }, nation: 'usa',
    effects: {
      unitMoves(_ctx, a) { if (unitClassOf(a.unit.type) === 'mounted') a.value += 1; },
      combat(_ctx, a) {
        const u = ownUnit(a);
        if (u && unitClassOf(u.type) === 'mounted' && ownTile(a).terrain === 'desert') ownMod(a, 'Dune Skimmer Courier', 25);
      },
    },
  },
  {
    id: 'sacred_grove', name: 'Lava-Tube Moss Tender', rarity: 'uncommon', cost: 6,
    description: 'Rock Spires and Lava Tubes give +1 {cul}. **+1** {splendor} for every 4 of these tiles you own (max +8).',
    flavor: 'They grow moss in the dark. It is very polite.',
    tags: ['forest', 'culture', 'splendor'], icon: 'tree', art: { hue: 125, motif: 'tree' }, nation: 'brazil',
    effects: {
      tileYield(_ctx, a) { if (isWoodland(a.tile)) a.yields.cul += 1; },
      chronicle(ctx, c) { const n = Math.min(8, Math.floor(countOwnedTiles(ctx.state, ctx.player.id, isWoodland) / 4)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'wide_horizons', name: 'Orbit Survey Pair', rarity: 'uncommon', cost: 6,
    description: '**×1.1** {splendor} for each colony you own after your third.',
    flavor: 'They mapped the horizon. It kept moving away.',
    tags: ['wide', 'xsplendor'], icon: 'map', art: { hue: 65, motif: 'compass' }, nation: 'japan',
    effects: {
      chronicle(_ctx, c) { mul(c, Math.pow(1.1, Math.max(0, c.cities.length - 3))); },
    },
  },
  {
    id: 'imperial_census', name: 'Pod Bay Census Clerk', rarity: 'uncommon', cost: 6,
    description: '**+4** {renown} for each colonist in your colonies.',
    flavor: 'Everyone is counted, even the missing.',
    tags: ['growth', 'wide', 'renown'], icon: 'city', art: { hue: 70, motif: 'book' }, nation: 'china',
    effects: {
      chronicle(_ctx, c) { let n = 0; for (const x of c.cities) n += x.pop; if (n) c.addRenown(4 * n); },
    },
  },
  {
    id: 'philosopher_kings', name: 'Capital Mediator', rarity: 'uncommon', cost: 6,
    description: '**×1.5** {splendor} if you own 3 or fewer colonies.',
    flavor: 'The small hab has one window. Everyone gets a turn.',
    tags: ['tall', 'xsplendor'], icon: 'owl', art: { hue: 240, motif: 'owl' }, nation: 'france',
    effects: {
      chronicle(_ctx, c) { if (c.cities.length > 0 && c.cities.length <= 3) mul(c, 1.5); },
    },
  },
  {
    id: 'hanging_terraces', name: 'Greenhouse Builder Crew', rarity: 'uncommon', cost: 6,
    description: '**+3** {splendor} for each colony with 10 or more colonists.',
    flavor: 'More levels mean more lettuce and more stairs.',
    tags: ['tall', 'growth', 'splendor'], icon: 'prosperity', art: { hue: 100, motif: 'tower' }, nation: 'nigeria',
    effects: {
      chronicle(_ctx, c) { const n = c.cities.filter((x) => x.pop >= 10).length; if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'veterans_pride', name: 'Patchwork Suit Drill Lead', rarity: 'uncommon', cost: 6,
    description: 'Units at full health get +20% strength when attacking.',
    flavor: 'No dents yet. The suit is starting to feel proud.',
    tags: ['conquest'], icon: 'hp', art: { hue: 2, motif: 'shield' }, nation: 'russia',
    effects: {
      combat(_ctx, a) { if (a.side === 'attack' && a.attacker && a.attacker.hp >= 100) ownMod(a, 'Patchwork Suit Drill Lead', 20); },
    },
  },
  {
    id: 'conquerors_spoils', name: 'Crash-Site Scrap Broker', rarity: 'uncommon', cost: 6,
    description: 'Each Raider unit you defeat gives **+15** {gold}. **+1** {splendor} for every 3 Raider units defeated this run.',
    flavor: 'The old owners left a surprisingly good stock.',
    tags: ['conquest', 'influence', 'gold', 'splendor'], icon: 'crown', art: { hue: 358, motif: 'key' }, nation: 'usa',
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'unitDied' || ev.killer !== ctx.player.id || ev.player !== BARBARIAN) return;
        addGold(ctx.state, ctx.player.id, 15, 'Raider loot', ctx.emit);
        ctx.flash('+15 Credits', ev.tile);
      },
      chronicle(ctx, c) { const n = Math.floor(ctx.state.run.totals.kills / 3); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'bounty_board', name: 'Raider Camp Recovery Pair', rarity: 'uncommon', cost: 6,
    description: 'Clearing a Raider Camp gives **+2** {influence}.',
    flavor: 'Wanted: brave people. Must like odd meals.',
    tags: ['barbarian', 'influence'], icon: 'skull', art: { hue: 20, motif: 'scroll' }, nation: 'nigeria',
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'campCleared' || ev.player !== ctx.player.id) return;
        addInfluence(ctx.state, 2, ctx.emit);
        ctx.flash('+2 Coins', ev.tile);
      },
    },
  },
  {
    id: 'patron_of_the_arts', name: 'Capital Art Restorer', rarity: 'uncommon', cost: 6,
    description: '**+1** {splendor} for each Culture building you own.',
    flavor: 'They make art from air filters and packing foam.',
    tags: ['culture', 'splendor'], icon: 'arts', art: { hue: 305, motif: 'mask' }, nation: 'france',
    effects: {
      chronicle(ctx, c) { const n = countBuildings(ctx.state, ctx.player.id, (b) => b.pillar === 'arts'); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'grand_academy', name: 'Research Lab Instructor', rarity: 'uncommon', cost: 6,
    description: '**+2** {splendor} for each Research you finish this chapter.',
    flavor: 'Today\'s lesson: why the alarm is probably fine.',
    tags: ['science', 'splendor'], icon: 'discovery', art: { hue: 228, motif: 'flask' }, nation: 'india',
    effects: {
      chronicle(_ctx, c) { if (c.stats.techs) c.addSplendor(2 * c.stats.techs); },
    },
  },
  {
    id: 'eureka_cycle', name: 'Research Technician', rarity: 'uncommon', cost: 6,
    description: 'Every 4th Research you finish gives you a free random Research.',
    flavor: 'Three failures, then the bath overflows.',
    tags: ['science', 'scaling'], icon: 'bolt', art: { hue: 235, motif: 'bolt' }, nation: 'india',
    unlock: { text: 'Win a run with India.', rule: 'winWith:india' },
    status(counters) { return `${(counters.techs ?? 0) % 4}/4 Research`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'techResearched' || ev.player !== ctx.player.id) return;
        ctx.counters.techs = (ctx.counters.techs ?? 0) + 1;
        if (ctx.counters.techs % 4 !== 0) return;
        const options = availableTechs(ctx.state, ctx.player.id);
        if (!options.length) return;
        const tech = options[randInt(ctx.state.rng, options.length)];
        ctx.flash('Research!');
        grantTech(ctx.state, ctx.player.id, tech, ctx.emit);
      },
    },
  },
  {
    id: 'usurers_guild', name: 'Coin Vault Accountant', rarity: 'uncommon', cost: 6,
    description: 'You get the Savings bonus twice.',
    flavor: 'Money sleeps, and dreams of more money.',
    tags: ['influence', 'economy'], icon: 'influence', art: { hue: 270, motif: 'coin' }, nation: 'switzerland',
    unlock: { text: 'Get 5 Big Wins in one run.', rule: 'triumphs5' },
    effects: {
      influenceIncome(_ctx, a) {
        let n = 0;
        for (const l of a.lines) if (l.amount > 0 && l.label === 'Savings bonus') n += l.amount;
        if (n > 0) a.lines.push({ label: 'Coin Vault savings', amount: n });
      },
    },
  },
  {
    id: 'merchant_princes', name: 'Luxury Traders', rarity: 'uncommon', cost: 6,
    description: 'Luxury resource tiles give +2 {gold}. **+2** {splendor} for each different luxury you own.',
    flavor: 'Silk for the suit, spice for the soup, pearls for the portrait.',
    tags: ['gold', 'splendor', 'happiness'], icon: 'gems', art: { hue: 45, motif: 'coin' }, nation: 'uae',
    effects: {
      tileYield(_ctx, a) { if (a.tile.resource && RESOURCES[a.tile.resource]?.kind === 'luxury') a.yields.gold += 2; },
      chronicle(ctx, c) { const n = luxuriesOwned(ctx.state, ctx.player.id); if (n) c.addSplendor(2 * n); },
    },
  },
  {
    id: 'harvest_festival', name: 'Greenhouse Harvest Crew', rarity: 'uncommon', cost: 6,
    description: 'Farms give +1 {food}. **+1** {splendor} for every 4 farms you own.',
    flavor: 'Dance on the dust. The food is almost good enough.',
    tags: ['growth', 'splendor'], icon: 'farm', art: { hue: 88, motif: 'wheat' }, nation: 'brazil',
    effects: {
      tileYield(_ctx, a) { if (a.tile.improvement === 'farm') a.yields.food += 1; },
      chronicle(ctx, c) { const n = Math.floor(countOwnedTiles(ctx.state, ctx.player.id, (t) => t.improvement === 'farm') / 4); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'cornucopia', name: 'Pod Wake Logistics Chief', rarity: 'uncommon', cost: 6,
    description: 'When one of your colonies grows, it gets **+8** {prod} for its current build.',
    flavor: 'More hands, more tools, more meal tickets.',
    tags: ['growth', 'production'], icon: 'wheat', art: { hue: 78, motif: 'chalice' }, nation: 'china',
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'cityGrew' || ev.player !== ctx.player.id) return;
        const city = ctx.state.cities[ev.cityId];
        if (!city) return;
        city.prodStored += 8;
        ctx.flash('+8 Production', city.tile);
      },
    },
  },
  {
    id: 'forge_of_ages', name: 'Reactor Builder', rarity: 'uncommon', cost: 6,
    description: 'Every colony gets +1 {prod} for every 3 colonists.',
    flavor: 'The reactor is older than the hab. Nobody knows who wired it.',
    tags: ['production', 'tall'], icon: 'forge', art: { hue: 18, motif: 'flame' }, nation: 'japan',
    effects: {
      cityYield(_ctx, a) { a.yields.prod += Math.floor(a.city.pop / 3); },
    },
  },
  {
    id: 'hammers_of_glory', name: 'Dust Foundry Crew', rarity: 'uncommon', cost: 6,
    description: '**+2** {renown} for each {prod} your colonies make each turn.',
    flavor: 'Sweat becomes dust becomes a very heavy door.',
    tags: ['production', 'renown'], icon: 'prod', art: { hue: 24, motif: 'gear' }, nation: 'china',
    effects: {
      chronicle(_ctx, c) { let n = 0; for (const x of c.cities) n += x.yields.prod; n = Math.floor(n); if (n > 0) c.addRenown(2 * n); },
    },
  },
  {
    id: 'jubilee', name: 'Party DJ', rarity: 'uncommon', cost: 6,
    description: '**×1.5** {splendor} if your Happiness is 10 or more.',
    flavor: 'One speaker, four songs, and a strict noise curfew.',
    tags: ['happiness', 'xsplendor'], icon: 'happy', art: { hue: 325, motif: 'laurel' }, nation: 'nigeria',
    effects: {
      chronicle(ctx, c) { if (ctx.player.happiness >= 10) mul(c, 1.5); },
    },
  },
  {
    id: 'black_market', name: 'Shop Smuggler', rarity: 'uncommon', cost: 6,
    description: 'The Shop offers **1** extra Crew card.',
    flavor: 'Don\'t ask where it came from. Don\'t tell where it goes.',
    tags: ['influence', 'shop'], icon: 'doctrine', art: { hue: 262, motif: 'mask' },
    unlock: { text: 'Reach the Expansion era.', rule: 'reachEra3' },
    effects: {
      council(ctx, a) { pushDoctrineCard(ctx.state, a.council); },
    },
  },
  {
    id: 'pack_rat', name: 'Pack Hoarder', rarity: 'uncommon', cost: 6,
    description: 'Packs in the Shop cost **2** {influence} less.',
    flavor: 'One more crate. There is always room for one more crate.',
    tags: ['influence', 'shop'], icon: 'pack', art: { hue: 268, motif: 'key' }, nation: 'usa',
    effects: {
      ...COUNCIL_REPRICER,
    },
  },
  {
    id: 'edict_hoard', name: 'Boost Locker Keeper', rarity: 'uncommon', cost: 6,
    description: '**+1** Boost slot.',
    flavor: 'A spare tool in the drawer beats a clever speech.',
    tags: ['edict'], icon: 'edict', art: { hue: 285, motif: 'key' }, nation: 'france',
    effects: {
      onGain(ctx) { ctx.state.run.edictSlots += 1; },
      onLose(ctx) { ctx.state.run.edictSlots = Math.max(0, ctx.state.run.edictSlots - 1); },
    },
  },
  {
    id: 'arcane_recycler', name: 'Boost Recycler', rarity: 'uncommon', cost: 6,
    description: 'When you use a Boost, you have a 1 in 3 chance to get a random Boost (if you have room).',
    flavor: 'Nothing is trash until the recycler says so.',
    tags: ['edict', 'risk'], icon: 'reroll', art: { hue: 292, motif: 'gear' }, nation: 'india',
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
    id: 'focus_lens', name: 'Solar Array Alignment Tech', rarity: 'uncommon', cost: 6,
    description: 'Adds the base {splendor} of your Focus again.',
    flavor: 'Gather the light, and set the regulator carefully.',
    tags: ['focus', 'level', 'splendor'], icon: 'eye', art: { hue: 55, motif: 'eye' }, nation: 'japan',
    effects: {
      chronicle(ctx, c) {
        const def = PILLAR_DEFS[c.focus];
        if (def) c.addSplendor(def.splendor(ctx.state.run.pillarLevels[c.focus] ?? 1));
      },
    },
  },
  {
    id: 'pillar_harmony', name: 'Chapter Report Team', rarity: 'uncommon', cost: 6,
    description: '**×1.5** {splendor} if every Focus pillar made {renown} this chapter.',
    flavor: 'Six readouts, one alarm, and one very tense shift.',
    tags: ['focus', 'xsplendor'], icon: 'glory', art: { hue: 42, motif: 'gear' },
    unlock: { text: 'Score 100,000 in one Chapter Report.', rule: 'score100k' },
    effects: {
      chronicle(ctx, c) { if (PILLARS.every((p) => pillarRenown(ctx.state, c.stats, p) > 0)) mul(c, 1.5); },
    },
  },
  {
    id: 'crisis_forged', name: 'Crisis Shelter Engineer', rarity: 'uncommon', cost: 6,
    description: 'Gains **+2** {splendor} for the rest of the run each time you pass a Crisis chapter.',
    flavor: 'What does not stop us gets a repair sticker.',
    tags: ['crisis', 'scaling', 'splendor'], icon: 'crisis', art: { hue: 348, motif: 'flame' }, nation: 'vatican',
    unlock: { text: 'Win a run with the Holy See.', rule: 'winWith:vatican' },
    status(counters) { return `+${counters.splendor ?? 0} Multiplier`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle' || ev.result.chapter !== CRISIS_CHAPTER || !ev.result.passed) return;
        ctx.counters.splendor = (ctx.counters.splendor ?? 0) + 2;
        ctx.flash(`+${ctx.counters.splendor} Multiplier`);
      },
      chronicle(ctx, c) { const n = ctx.counters.splendor ?? 0; if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'doomsayers', name: 'Solar Flare Forecasters', rarity: 'uncommon', cost: 6,
    description: '**×1.5** {splendor} during a Crisis chapter.',
    flavor: 'The forecast is bad. Their singing is worse.',
    tags: ['crisis', 'xsplendor'], icon: 'skull', art: { hue: 352, motif: 'eye' }, nation: 'north_korea',
    effects: {
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) mul(c, 1.5); },
    },
  },
  {
    id: 'blood_price', name: 'Pod Bay Nurse Pair', rarity: 'uncommon', cost: 6,
    description: '**×2** {splendor}. After every Chapter Report, your largest colony loses 1 colonist.',
    flavor: 'The numbers look great. The waiting room does not.',
    tags: ['risk', 'xsplendor'], icon: 'unhappy', art: { hue: 350, motif: 'hourglass' }, nation: 'france',
    unlock: { text: 'Win a run on Difficulty 2.', rule: 'winAsc2' },
    effects: {
      chronicle(_ctx, c) { mul(c, 2); },
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle') return;
        let largest: City | null = null;
        for (const city of citiesOf(ctx.state, ctx.player.id)) if (!largest || city.pop > largest.pop) largest = city;
        if (largest && largest.pop > 1) {
          changePop(ctx.state, largest, -1, ctx.emit);
          ctx.flash('-1 colonist', largest.tile);
        }
      },
    },
  },
  {
    id: 'aeon_clock', name: 'Blackout Timer Technician', rarity: 'uncommon', cost: 6,
    description: '**×1** {splendor}. It gains **+×0.1** after every Chapter Report.',
    flavor: 'Tick. Tock. The backup battery has opinions.',
    tags: ['scaling', 'xsplendor'], icon: 'hourglass', art: { hue: 210, motif: 'hourglass' }, nation: 'russia',
    unlock: { text: 'Play 3 runs.', rule: 'runs3' },
    status(counters) { return `×${(1 + 0.1 * (counters.ticks ?? 0)).toFixed(1)} Multiplier`; },
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
    id: 'glory_hunters', name: 'Wonder Builder Crew', rarity: 'uncommon', cost: 6,
    description: '**+3** {splendor} for each Wonder you own.',
    flavor: 'Build it tall enough and the orbit camera sees it.',
    tags: ['wonders', 'splendor'], icon: 'wonder', art: { hue: 40, motif: 'pyramid' }, nation: 'china',
    effects: {
      chronicle(ctx, c) { const n = countWonders(ctx.state, ctx.player.id); if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'relic_hunters', name: 'Crash-Site Survey Pair', rarity: 'uncommon', cost: 6,
    description: '**+40** {renown} for each Landmark you find. **+1** {happy} for each Landmark.',
    flavor: 'The old hardware is a museum. They label the dangerous parts.',
    tags: ['exploration', 'wonders', 'renown', 'happiness'], icon: 'explore', art: { hue: 170, motif: 'compass' }, nation: 'france',
    effects: {
      chronicle(ctx, c) { const n = ctx.state.naturalWondersSeen[ctx.player.id]?.length ?? 0; if (n) c.addRenown(40 * n); },
      happiness(ctx, a) { a.value += ctx.state.naturalWondersSeen[ctx.player.id]?.length ?? 0; },
    },
  },
  {
    id: 'citizen_militia', name: 'Capital Defense Volunteers', rarity: 'uncommon', cost: 6,
    description: 'Your colonies get +25% strength when defending.',
    flavor: 'Bakers with shields. Poets with great aim.',
    tags: ['conquest', 'crisis'], icon: 'walls', art: { hue: 28, motif: 'shield' }, nation: 'usa',
    effects: {
      combat(_ctx, a) { if (a.side === 'defense' && a.defenderCity && !a.defender) ownMod(a, 'Citizen Militia', 25); },
    },
  },
  {
    id: 'silk_roads', name: 'Relay Station Traders', rarity: 'uncommon', cost: 6,
    description: 'Colonies with a Market get +3 {gold} and +1 {cul}.',
    flavor: 'A fiber line links two domes. A tax links everything.',
    tags: ['gold', 'culture'], icon: 'silk', art: { hue: 50, motif: 'compass' }, nation: 'uae',
    effects: {
      cityYield(_ctx, a) { if (cityHas(a.city, 'market')) { a.yields.gold += 3; a.yields.cul += 1; } },
    },
  },
  {
    id: 'conscripts', name: 'Army Sign-Up Clerk', rarity: 'uncommon', cost: 6,
    description: 'Military units cost 20% less {prod}.',
    flavor: 'Every hab sends a volunteer. Nobody mentions the forms.',
    tags: ['conquest', 'production'], icon: 'melee', art: { hue: 6, motif: 'shield' }, nation: 'nigeria',
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'unit' && unitClassOf(a.item.id) !== 'civilian') a.cost *= 0.8; },
    },
  },
  {
    id: 'pilgrimage', name: 'Earth Memorial Guide', rarity: 'uncommon', cost: 6,
    description: 'Each Memorial Chapel and Shrine gives +2 {cul} and +1 {happy}.',
    flavor: 'A quiet walk, with a very useful water stop.',
    tags: ['culture', 'happiness'], icon: 'temple', art: { hue: 318, motif: 'moon' }, nation: 'vatican',
    effects: {
      cityYield(_ctx, a) { a.yields.cul += 2 * shrineCount(a.city); },
      happiness(ctx, a) { for (const city of citiesOf(ctx.state, ctx.player.id)) a.value += shrineCount(city); },
    },
  },
  {
    id: 'council_seat', name: 'Colony Council Liaison', rarity: 'uncommon', cost: 6,
    description: '**+2** {influence} at the end of every chapter.',
    flavor: 'Every meeting ends with a small payment.',
    tags: ['influence', 'economy'], icon: 'influence', art: { hue: 278, motif: 'book' }, nation: 'switzerland',
    effects: {
      influenceIncome(_ctx, a) { a.lines.push({ label: 'Council Liaison', amount: 2 }); },
    },
  },
];

registerCrew(UNCOMMON);
