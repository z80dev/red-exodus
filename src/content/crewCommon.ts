// OWNER: CrewReskin. Common Crew — merged into DOCTRINES by content/index.ts.
import type { DoctrineDef } from '../sim/defs';
import { registerCrew } from './doctrineRegistry';
import { BARBARIAN } from '../sim/types';
import { changePop,citiesOf } from '../sim/cities';
import { addGold } from '../sim/economy';
import {
isRiverTile,isCoastalCity,countOwnedTiles,cityHasPillarBuilding,unitClassOf,ownMod,ownUnit,enemyOwnerOf,
ownTile,doctrineIndex,selfDoctrine,destroyDoctrine,pillarLevelsGained,onRiver,coastalCount,focusBonus,divination,
COUNCIL_REPRICER,
} from './doctrines';

export const COMMON: DoctrineDef[] = [
  {
    id: 'riverfolk', name: 'The Ice Channel Scientist', rarity: 'common', cost: 4,
    description: '+1 {food} on Ice Channel tiles. +1 {splendor} for each colony on a channel.',
    flavor: 'She drinks the samples after the meters break. She says it is fine.',
    nation: 'india', tags: ['river', 'growth', 'splendor'], icon: 'river', art: { hue: 200, motif: 'river' },
    effects: {
      tileYield(_ctx, a) { if (isRiverTile(a.tile)) a.yields.food += 1; },
      chronicle(ctx, c) { const n = onRiver(ctx.state, c); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'ferrymen', name: 'The Channel Survey Pair', rarity: 'common', cost: 4,
    description: '+1 {gold} on Ice Channel tiles. At the end of each chapter, +4 {renown} for each channel tile you own.',
    flavor: 'They charge double if you ask whether the seal is safe.',
    nation: 'usa', tags: ['river', 'gold', 'renown'], icon: 'river', art: { hue: 205, motif: 'ship' },
    effects: {
      tileYield(_ctx, a) { if (isRiverTile(a.tile)) a.yields.gold += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, isRiverTile); if (n) c.addRenown(4 * n); },
    },
  },
  {
    id: 'tidecallers', name: 'The Salt Lake Dive Medic', rarity: 'common', cost: 4,
    description: '+1 {food} on Shallows and Salt Lake tiles. +1 {splendor} for each coastal colony.',
    flavor: 'The algae is good food. The dive team is not so sure.',
    nation: 'japan', tags: ['coastal', 'growth', 'splendor'], icon: 'wave', art: { hue: 190, motif: 'wave' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'coast' || a.tile.terrain === 'lake') a.yields.food += 1; },
      chronicle(ctx, c) { const n = coastalCount(ctx.state, c); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'salt_traders', name: 'The Salt Lake Trader', rarity: 'common', cost: 4,
    description: 'Coastal colonies make +3 {gold}. At the end of each chapter, +10 {renown} for each coastal colony.',
    flavor: 'White salt, sold by the barrel. The barrel costs extra.',
    nation: 'uae', tags: ['coastal', 'gold', 'renown'], icon: 'anchor', art: { hue: 185, motif: 'anchor' },
    effects: {
      cityYield(ctx, a) { if (isCoastalCity(ctx.state, a.city)) a.yields.gold += 3; },
      chronicle(ctx, c) { const n = coastalCount(ctx.state, c); if (n) c.addRenown(10 * n); },
    },
  },
  {
    id: 'highlanders', name: 'The Hill Surveyor', rarity: 'common', cost: 4,
    description: '+1 {prod} on Hills tiles. Your units on Hills get +15% defense.',
    flavor: 'Her map is perfect. It is also the only one left.',
    nation: 'switzerland', tags: ['mountain', 'production', 'conquest'], icon: 'mountain', art: { hue: 28, motif: 'mountain' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.elevation === 'hills') a.yields.prod += 1; },
      combat(_ctx, a) { if (a.side === 'defense' && ownUnit(a) && ownTile(a).elevation === 'hills') ownMod(a, 'Highlanders', 15); },
    },
  },
  {
    id: 'peak_shrines', name: 'The Oxygen Ration Priest', rarity: 'common', cost: 4,
    description: '+1 {splendor} for every 2 Mountains tiles you own (max +6).',
    flavor: 'The mountain air is thin. The donation box is not.',
    nation: 'vatican', tags: ['mountain', 'splendor'], icon: 'mountain', art: { hue: 220, motif: 'mountain' },
    effects: {
      chronicle(ctx, c) {
        const n = Math.min(6, Math.floor(countOwnedTiles(ctx.state, ctx.player.id, (t) => t.elevation === 'mountain') / 2));
        if (n) c.addSplendor(n);
      },
    },
  },
  {
    id: 'sand_walkers', name: 'The Dune Rover Repair Crew', rarity: 'common', cost: 4,
    description: '+1 {prod} on Dunes tiles. +1 {food} and +1 {gold} on Geyser and Old Delta tiles.',
    flavor: 'They fix anything with a wrench, some wire, and a wrong manual.',
    nation: 'russia', tags: ['desert', 'production', 'growth'], icon: 'sun', art: { hue: 40, motif: 'sun' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'desert') a.yields.prod += 1;
        if (a.tile.feature === 'oasis' || a.tile.feature === 'floodplains') { a.yields.food += 1; a.yields.gold += 1; }
      },
    },
  },
  {
    id: 'mirage_poets', name: 'The Last Broadcast Poet', rarity: 'common', cost: 4,
    description: '+1 {cul} on Dunes tiles. At the end of each chapter, +3 {renown} for each Dunes tile you own.',
    flavor: 'His last broadcast to Earth got applause from three empty suits.',
    nation: 'nigeria', tags: ['desert', 'culture', 'renown'], icon: 'feather', art: { hue: 36, motif: 'feather' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'desert') a.yields.cul += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, (t) => t.terrain === 'desert'); if (n) c.addRenown(3 * n); },
    },
  },
  {
    id: 'woodwardens', name: 'Rock Spire Rangers', rarity: 'common', cost: 4,
    description: '+1 {prod} on Rock Spires tiles. Your units on Rock Spires get +15% defense.',
    flavor: 'The rocks give better cover than any government did.',
    nation: 'brazil', tags: ['forest', 'production', 'conquest'], icon: 'tree', art: { hue: 118, motif: 'tree' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.feature === 'forest') a.yields.prod += 1; },
      combat(_ctx, a) { if (a.side === 'defense' && ownUnit(a) && ownTile(a).feature === 'forest') ownMod(a, 'Woodwardens', 15); },
    },
  },
  {
    id: 'jungle_sages', name: 'Lava Tube Mushroom Growers', rarity: 'common', cost: 4,
    description: '+1 {sci} and +1 {cul} on Lava Tubes tiles.',
    flavor: 'They found a mushroom that glows. Nobody knows if you can eat it.',
    nation: 'china', tags: ['forest', 'science', 'culture'], icon: 'serpent', art: { hue: 135, motif: 'serpent' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.feature === 'jungle') { a.yields.sci += 1; a.yields.cul += 1; } },
    },
  },
  {
    id: 'frontier_charter', name: 'The Pod Clerk', rarity: 'common', cost: 4,
    description: '+1 {splendor} for each colony you own.',
    flavor: 'Forms are the only thing between the frontier and chaos.',
    nation: 'france', tags: ['wide', 'splendor'], icon: 'compass', art: { hue: 60, motif: 'compass' },
    effects: {
      chronicle(_ctx, c) { if (c.cities.length) c.addSplendor(c.cities.length); },
    },
  },
  {
    id: 'tax_farmers', name: 'The Coin Auditor', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, +1 {influence} for every 3 colonies you own.',
    flavor: 'Not loved, but fast. His spreadsheet even has airlocks.',
    nation: 'nigeria', tags: ['wide', 'economy'], icon: 'coin', art: { hue: 52, motif: 'coin' },
    effects: {
      influenceIncome(ctx, a) {
        const n = Math.floor(citiesOf(ctx.state, ctx.player.id).length / 3);
        if (n > 0) a.lines.push({ label: 'Coin Auditor', amount: n });
      },
    },
  },
  {
    id: 'homesteaders', name: 'Pod Bay Nursery Crew', rarity: 'common', cost: 4,
    description: 'Colony Crawlers cost 25% less {prod}. New colonies start with +1 pop.',
    flavor: 'Bring seeds, bring children, bring a spare pressure patch.',
    nation: 'brazil', tags: ['wide', 'growth'], icon: 'found', art: { hue: 80, motif: 'wheat' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'unit' && a.item.id === 'settler') a.cost *= 0.75; },
      onEvent(ctx, ev) {
        if (ev.type !== 'cityFounded' || ev.player !== ctx.player.id) return;
        const city = ctx.state.cities[ev.cityId];
        if (!city) return;
        changePop(ctx.state, city, 1, ctx.emit);
        ctx.flash('+1 colonist', city.tile);
      },
    },
  },
  {
    id: 'walled_garden', name: 'The Small Hab Gardener', rarity: 'common', cost: 4,
    description: '+6 {splendor} if you own 3 or fewer colonies.',
    flavor: 'Small habs with good care leak less.',
    nation: 'japan', tags: ['tall', 'splendor'], icon: 'walls', art: { hue: 100, motif: 'tree' },
    effects: {
      chronicle(_ctx, c) { if (c.cities.length <= 3) c.addSplendor(6); },
    },
  },
  {
    id: 'great_hall', name: 'Capital Dining Hall Manager', rarity: 'common', cost: 4,
    description: '+15% {prod} in your Capital. +5 {renown} for each pop in your Capital.',
    flavor: 'All meal lines lead to the long table. The coffee is rationed.',
    nation: 'china', tags: ['tall', 'production', 'renown'], icon: 'palace', art: { hue: 30, motif: 'crown' },
    effects: {
      cityYield(_ctx, a) { if (a.city.isCapital) a.pct.prod += 15; },
      chronicle(_ctx, c) { const cap = c.cities.find((x) => x.isCapital); if (cap) c.addRenown(5 * cap.pop); },
    },
  },
  {
    id: 'drill_sergeants', name: 'The Suit Drill Coach', rarity: 'common', cost: 4,
    description: 'Your units get +10% strength when they attack.',
    flavor: 'Again. Faster. Again. The suit should not smoke.',
    nation: 'russia', tags: ['conquest'], icon: 'strength', art: { hue: 5, motif: 'sword' },
    effects: {
      combat(_ctx, a) { if (a.side === 'attack' && ownUnit(a)) ownMod(a, 'Suit Drill Coach', 10); },
    },
  },
  {
    id: 'bloodied_banners', name: 'The Suit Patch Keeper', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, +15 {renown} for each enemy unit you killed that chapter.',
    flavor: 'Every burn mark is a story. Every tear is a medal.',
    nation: 'usa', tags: ['conquest', 'renown'], icon: 'conquest', art: { hue: 355, motif: 'skull' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.kills) c.addRenown(15 * c.stats.kills); },
    },
  },
  {
    id: 'shieldwall', name: 'The Dome Defense Team', rarity: 'common', cost: 4,
    description: 'Your melee and anti-cavalry units get +15% defense.',
    flavor: 'Shields up. Hold the airlock. Keep breathing.',
    nation: 'north_korea', tags: ['conquest'], icon: 'shield', art: { hue: 15, motif: 'shield' },
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
    id: 'war_drums', name: 'The Rover Convoy Drummers', rarity: 'common', cost: 4,
    description: 'Your mounted units get +1 movement.',
    flavor: 'The wheels learn the beat first. Then the driver does.',
    nation: 'nigeria', tags: ['conquest'], icon: 'mounted', art: { hue: 10, motif: 'horse' },
    effects: {
      unitMoves(_ctx, a) { if (unitClassOf(a.unit.type) === 'mounted') a.value += 1; },
    },
  },
  {
    id: 'headhunters', name: 'Crash Site Recovery Crew', rarity: 'common', cost: 4,
    description: 'When you kill a Raider unit, gain +10 {gold}. At the end of each chapter, +30 {renown} for each Raider Camp you cleared that chapter.',
    flavor: 'They bill by the helmet. The helmets bill them back.',
    nation: 'uae', tags: ['feral', 'conquest', 'gold'], icon: 'skull', art: { hue: 18, motif: 'skull' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type === 'unitDied' && ev.player === BARBARIAN && ev.killer === ctx.player.id) {
          addGold(ctx.state, ctx.player.id, 10, 'Crash-Site Recovery Crew', ctx.emit);
          ctx.flash('+10 Credits', ev.tile);
        }
      },
      chronicle(_ctx, c) { if (c.stats.campsCleared) c.addRenown(30 * c.stats.campsCleared); },
    },
  },
  {
    id: 'march_wardens', name: 'Dust Fence Watch', rarity: 'common', cost: 4,
    description: 'Your units get +25% strength against Raiders.',
    flavor: 'The fence is mostly tape, but the tape looks very strong.',
    nation: 'north_korea', tags: ['feral', 'conquest'], icon: 'shield', art: { hue: 25, motif: 'tower' },
    effects: {
      combat(_ctx, a) { if (ownUnit(a) && enemyOwnerOf(a) === BARBARIAN) ownMod(a, 'Dust Fence Watch', 25); },
    },
  },
  {
    id: 'bardic_college', name: 'The Holo-Theater Sound Tech', rarity: 'common', cost: 4,
    description: 'Colonies with a Culture building get +2 {cul}.',
    flavor: 'Nine verses for the lost, ten for the vending machine.',
    nation: 'vatican', tags: ['culture'], icon: 'lyre', art: { hue: 300, motif: 'lyre' },
    effects: {
      cityYield(_ctx, a) { if (cityHasPillarBuilding(a.city, 'arts')) a.yields.cul += 2; },
    },
  },
  {
    id: 'storytellers', name: 'The Crash Site Storyteller', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, +1 {renown} for every 2 {cul} you made that chapter.',
    flavor: 'Tell it again, and make the air filter sound brave.',
    nation: 'france', tags: ['culture', 'renown'], icon: 'book', art: { hue: 310, motif: 'book' },
    effects: {
      chronicle(_ctx, c) { const n = Math.floor(c.stats.culture / 2); if (n) c.addRenown(n); },
    },
  },
  {
    id: 'star_charts', name: 'The Orbit Tracker', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, +20 {renown} for each Research you finished that chapter.',
    flavor: 'Map the sky. One day something maps you back.',
    nation: 'india', tags: ['science', 'renown'], icon: 'star', art: { hue: 230, motif: 'star' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.techs) c.addRenown(20 * c.stats.techs); },
    },
  },
  {
    id: 'market_criers', name: 'The Shop Capsule Seller', rarity: 'common', cost: 4,
    description: 'Colonies with 6 or more pop make +3 {gold}.',
    flavor: 'Nitrate! Aerogel! Rumors, two for one dead battery!',
    nation: 'usa', tags: ['gold', 'tall'], icon: 'hand', art: { hue: 46, motif: 'hand' },
    effects: {
      cityYield(_ctx, a) { if (a.city.pop >= 6) a.yields.gold += 3; },
    },
  },
  {
    id: 'coin_counters', name: 'The Credit Vault Counter', rarity: 'common', cost: 4,
    description: '+1 {splendor} for every 100 {gold} you hold (max +8).',
    flavor: 'Saved money looks great. Spent money needs a receipt.',
    nation: 'switzerland', tags: ['gold', 'splendor'], icon: 'coin', art: { hue: 48, motif: 'coin' },
    status(_counters, state) { return `+${Math.min(8, Math.floor(Math.max(0, state.players[0]?.gold ?? 0) / 100))} Multiplier`; },
    effects: {
      chronicle(ctx, c) { const n = Math.min(8, Math.floor(Math.max(0, ctx.player.gold) / 100)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'tithe_box', name: 'The Air Filter Fundraiser', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, gain +2 {influence}.',
    flavor: 'A coin for the air filter. The filter can wait.',
    nation: 'vatican', tags: ['economy'], icon: 'coin', art: { hue: 280, motif: 'chalice' },
    effects: {
      influenceIncome(_ctx, a) { a.lines.push({ label: 'Air Filter Fundraiser', amount: 2 }); },
    },
  },
  {
    id: 'granary_keepers', name: 'The Seed Silo Crew', rarity: 'common', cost: 4,
    description: 'Colonies need 15% less {food} to grow.',
    flavor: 'Seven big harvests, counted one algae tray at a time.',
    nation: 'china', tags: ['growth'], icon: 'wheat', art: { hue: 75, motif: 'wheat' },
    effects: {
      growthThreshold(_ctx, a) { a.value *= 0.85; },
    },
  },
  {
    id: 'fertile_fields', name: 'The Greenhouse Tender', rarity: 'common', cost: 4,
    description: '+1 {food} on tiles with a Greenhouse Dome. At the end of each chapter, +2 {renown} for each Greenhouse Dome you own.',
    flavor: 'Dig, plant, sing, pick. The compost is in quarantine.',
    nation: 'brazil', tags: ['growth', 'renown'], icon: 'wheat', art: { hue: 85, motif: 'wheat' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.improvement === 'farm') a.yields.food += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, (t) => t.improvement === 'farm'); if (n) c.addRenown(2 * n); },
    },
  },
  {
    id: 'midwives', name: 'The Pod Midwife', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, +8 {renown} for each pop your colonies grew that chapter.',
    flavor: 'Every baby cry is a vote for tomorrow. Also a loud one.',
    nation: 'india', tags: ['growth', 'renown'], icon: 'hand', art: { hue: 95, motif: 'hand' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.popGrown) c.addRenown(8 * c.stats.popGrown); },
    },
  },
  {
    id: 'forgemasters', name: 'The Quarry Fabricator', rarity: 'common', cost: 4,
    description: '+1 {prod} on tiles with a Mine. +1 {prod} and +1 {gold} on tiles with a Quarry.',
    flavor: 'The hill gives way. The cutter sends a thank-you note.',
    nation: 'russia', tags: ['production', 'mountain'], icon: 'gear', art: { hue: 22, motif: 'gear' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.improvement === 'mine') a.yields.prod += 1;
        if (a.tile.improvement === 'quarry') { a.yields.prod += 1; a.yields.gold += 1; }
      },
    },
  },
  {
    id: 'foremen', name: 'The Hab Site Foreman', rarity: 'common', cost: 4,
    description: 'Buildings cost 10% less {prod}.',
    flavor: 'Measure twice, shout once. The airlock is behind you.',
    nation: 'china', tags: ['production'], icon: 'gear', art: { hue: 20, motif: 'gear' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building') a.cost *= 0.9; },
    },
  },
  {
    id: 'master_masons', name: 'The Wonder Builder', rarity: 'common', cost: 4,
    description: 'Wonders cost 15% less {prod}.',
    flavor: 'Their fingerprints are melted into every wall.',
    nation: 'france', tags: ['wonders', 'production'], icon: 'pyramid', art: { hue: 34, motif: 'pyramid' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'wonder') a.cost *= 0.85; },
    },
  },
  {
    id: 'bread_and_circuses', name: 'The Dome Party Organizer', rarity: 'common', cost: 4,
    description: '+3 {happy} in all colonies.',
    flavor: 'Full bellies rarely riot. The karaoke machine helps.',
    nation: 'nigeria', tags: ['happiness'], icon: 'happy', art: { hue: 335, motif: 'mask' },
    effects: {
      happiness(_ctx, a) { a.value += 3; },
    },
  },
  {
    id: 'content_folk', name: 'The Happiness Mediator', rarity: 'common', cost: 4,
    description: '+1 {splendor} for every 3 {happy} you have (max +6).',
    flavor: 'A happy colony is a monument. The dentist is still on Earth.',
    nation: 'japan', tags: ['happiness', 'splendor'], icon: 'happy', art: { hue: 330, motif: 'sun' },
    status(_counters, state) { return `+${Math.min(6, Math.floor(Math.max(0, state.players[0]?.happiness ?? 0) / 3))} Multiplier`; },
    effects: {
      chronicle(ctx, c) { const n = Math.min(6, Math.floor(Math.max(0, ctx.player.happiness) / 3)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'patrons_seal', name: 'The Shop Capsule Broker', rarity: 'common', cost: 4,
    description: 'Crew in the Shop cost 1 {influence} less.',
    flavor: 'A friend in logistics is worth a bag of spare filters.',
    nation: 'uae', tags: ['shop'], icon: 'key', art: { hue: 265, motif: 'key' },
    effects: {
      ...COUNCIL_REPRICER,
    },
  },
  {
    id: 'open_market', name: 'The Shop Clerk', rarity: 'common', cost: 4,
    description: 'The Shop reroll cost starts at 0 {influence}.',
    flavor: 'Look all you like, friend. The shelves are mostly empty.',
    nation: 'switzerland', tags: ['shop'], icon: 'hand', art: { hue: 275, motif: 'hand' },
    effects: {
      council(_ctx, a) { if (!a.reroll) a.council.rerollCost = 0; },
    },
  },
  {
    id: 'heralds', name: 'The Boost Broadcaster', rarity: 'common', cost: 4,
    description: 'When you use a Boost, gain +15 {gold}.',
    flavor: 'Urgent message! Also, please pay your bill.',
    nation: 'usa', tags: ['edict', 'gold'], icon: 'bolt', art: { hue: 40, motif: 'bolt' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'edictUsed' || !ctx.player.isHuman) return;
        addGold(ctx.state, ctx.player.id, 15, 'Boost Broadcaster', ctx.emit);
        ctx.flash('+15 Credits');
      },
    },
  },
  {
    id: 'scribes_of_decree', name: 'The Boost Logbook Keeper', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, +2 {splendor} for each Boost you used that chapter.',
    flavor: 'Written down and saved on a drive that might still work.',
    nation: 'france', tags: ['edict', 'splendor'], icon: 'feather', art: { hue: 290, motif: 'feather' },
    status(counters) { return `${counters.used ?? 0} Boosts used this chapter`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type === 'chapterStarted') ctx.counters.used = 0;
        else if (ev.type === 'edictUsed' && ctx.player.isHuman) ctx.counters.used = (ctx.counters.used ?? 0) + 1;
      },
      chronicle(ctx, c) { const n = ctx.counters.used ?? 0; if (n) c.addSplendor(2 * n); },
    },
  },
  {
    id: 'lorekeepers', name: 'The Records Technician', rarity: 'common', cost: 4,
    description: '+1 {splendor} for every 2 levels your Focus pillars have gained.',
    flavor: 'Each data slate is a night light. Together they show the airlock.',
    nation: 'china', tags: ['level', 'splendor'], icon: 'book', art: { hue: 250, motif: 'book' },
    status(_counters, state) { return `+${Math.floor(pillarLevelsGained(state) / 2)} Multiplier`; },
    effects: {
      chronicle(ctx, c) { const n = Math.floor(pillarLevelsGained(ctx.state) / 2); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'stoic_chroniclers', name: 'The Crisis Channel Broadcaster', rarity: 'common', cost: 4,
    description: '+5 {splendor} during a Crisis chapter.',
    flavor: 'The signal is mostly noise. The good mood is on purpose.',
    nation: 'north_korea', tags: ['crisis', 'splendor'], icon: 'crisis', art: { hue: 350, motif: 'book' },
    effects: {
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) c.addSplendor(5); },
    },
  },
  {
    id: 'hoarders_vault', name: 'The Emergency Ration Keeper', rarity: 'common', cost: 4,
    description: 'During a Crisis chapter, every colony makes +2 {food} and +2 {prod}.',
    flavor: 'People laughed in good years. They said thanks when the filters clogged.',
    nation: 'switzerland', tags: ['crisis', 'growth', 'production'], icon: 'key', art: { hue: 345, motif: 'key' },
    effects: {
      cityYield(ctx, a) { if (ctx.state.run.crisisActive) { a.yields.food += 2; a.yields.prod += 2; } },
    },
  },
  {
    id: 'oracle_bones', name: 'The Crash Site Pattern Reader', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, gain a random +0 to +8 {splendor}.',
    flavor: 'Shake the pieces, read the noise, say it was the plan.',
    nation: 'india', tags: ['risk', 'splendor'], icon: 'eye', art: { hue: 32, motif: 'eye' },
    effects: {
      chronicle(ctx, c) { const n = divination(ctx.state.turn, ctx.uid ?? 0, 9); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'tally_stones', name: 'The Shift Change Tally Clerk', rarity: 'common', cost: 4,
    description: 'Stores +3 {renown} every turn. At the end of each chapter, adds all stored {renown}.',
    flavor: 'One washer per sunrise. The pile is a database, sort of.',
    nation: 'japan', tags: ['scaling', 'renown'], icon: 'hourglass', art: { hue: 25, motif: 'hourglass' },
    status(counters) { return `+${counters.renown ?? 0} Points`; },
    effects: {
      turnStart(ctx) { ctx.counters.renown = (ctx.counters.renown ?? 0) + 3; },
      chronicle(ctx, c) { const n = ctx.counters.renown ?? 0; if (n) c.addRenown(n); },
    },
  },
  {
    id: 'bonfire_of_tales', name: 'The Emergency Signal Fire Keeper', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, gain +10 {splendor}. This drops by 1 after each chapter. The Crew leaves at 0.',
    flavor: 'The best stories come before the air runs out.',
    nation: 'brazil', tags: ['splendor', 'risk'], icon: 'flame', art: { hue: 15, motif: 'flame' },
    status(counters) { return `+${Math.max(0, 10 - (counters.spent ?? 0))} Multiplier`; },
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
    id: 'gilders_guild', name: 'The Suit Patch Decorator', rarity: 'common', cost: 4,
    description: '+3 {splendor} for each Crew with an edition.',
    flavor: 'Gold foil on everything, even the oxygen warning labels.',
    nation: 'uae', tags: ['edition', 'splendor'], icon: 'star', art: { hue: 50, motif: 'crown' },
    effects: {
      chronicle(ctx, c) { const n = ctx.state.run.doctrines.filter((d) => d.edition !== 'base').length; if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'nest_egg', name: 'The Coin Value Appraiser', rarity: 'common', cost: 4,
    description: 'After each chapter, this Crew gains +2 {influence} of sell value.',
    flavor: 'Wait long enough and the price goes up. So does the late fee.',
    nation: 'switzerland', tags: ['economy', 'scaling'], icon: 'coin', art: { hue: 44, motif: 'owl' },
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
    id: 'vanguard', name: 'The First Through the Airlock', rarity: 'common', cost: 4,
    description: '+8 {splendor} if this is your leftmost Crew.',
    flavor: 'First through the hatch, first in the incident report.',
    nation: 'usa', tags: ['position', 'splendor'], icon: 'chevronLeft', art: { hue: 8, motif: 'eagle' },
    effects: {
      chronicle(ctx, c) { if (doctrineIndex(ctx.state, ctx.uid) === 0) c.addSplendor(8); },
    },
  },
  {
    id: 'rearguard', name: 'The Last Through the Airlock', rarity: 'common', cost: 4,
    description: '+25% {renown} if this is your rightmost Crew.',
    flavor: 'Someone must close the hatch behind everyone else.',
    nation: 'russia', tags: ['position', 'renown'], icon: 'chevronRight', art: { hue: 210, motif: 'shield' },
    effects: {
      chronicle(ctx, c) {
        const i = doctrineIndex(ctx.state, ctx.uid);
        if (i >= 0 && i === ctx.state.run.doctrines.length - 1) c.addRenown(Math.round(c.renown() * 0.25));
      },
    },
  },
  {
    id: 'road_wardens', name: 'The Relay Beacon Technician', rarity: 'common', cost: 4,
    description: 'Your units get +1 vision. Scout Rovers get +1 movement.',
    flavor: 'Eyes on every beacon. They still miss the obvious.',
    nation: 'china', tags: ['exploration'], icon: 'vision', art: { hue: 150, motif: 'compass' },
    effects: {
      unitVision(_ctx, a) { a.value += 1; },
      unitMoves(_ctx, a) { if (a.unit.type === 'scout') a.value += 1; },
    },
  },
  {
    id: 'pathfinders', name: 'The Crash Site Survey Pair', rarity: 'common', cost: 4,
    description: 'At the end of each chapter, +3 {renown} for each tile you explored that chapter.',
    flavor: 'Past the edge of the map, the old shipping labels begin.',
    nation: 'france', tags: ['exploration', 'renown'], icon: 'map', art: { hue: 160, motif: 'compass' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.tilesExplored) c.addRenown(3 * c.stats.tilesExplored); },
    },
  },
  focusBonus('muses_favor', 'The Dome Choir Director', 'arts', 'Culture', 'lyre', 300, 'She conducts in an airlock. The helmets make the sound amazing.', 'vatican'),
  focusBonus('lamplighters', 'The Night Shift Lab Tech', 'discovery', 'Science', 'flask', 230, 'He asks the machine what happened to Earth. It never answers.', 'north_korea'),
  focusBonus('guild_ledger', 'Coin Accountant Chen', 'commerce', 'Trade', 'coin', 48, 'Every credit is counted. Every receipt smells a little like glue.', 'china'),
  focusBonus('war_banner', 'The Flag Repair Crew', 'conquest', 'Military', 'sword', 0, 'They fix the flag between attacks. Nobody asked them to stop.', 'usa'),
  focusBonus('harvest_moon', 'The Greenhouse Keeper', 'prosperity', 'Growth', 'wheat', 85, 'She calls the tomatoes a victory. The tomatoes have no comment.', 'brazil'),
  focusBonus('triumphal_arch', 'Crash Site Memorial Builder', 'glory', 'Wonders', 'laurel', 38, 'He builds memorials from wreckage. He never runs out of material.', 'france'),
];

registerCrew(COMMON);
