// OWNER: CrewReskin. Common Crew — merged into DOCTRINES by content/index.ts.
import type { DoctrineDef } from '../sim/defs';
import { registerCrew } from './doctrineRegistry';
import { BARBARIAN } from '../sim/types';
import { changePop,citiesOf } from '../sim/cities';
import { addGold } from '../sim/economy';
import {
isRiverTile,isCoastalCity,countOwnedTiles,cityHasPillarBuilding,unitClassOf,ownMod,ownUnit,enemyOwnerOf,
ownTile,doctrineIndex,selfDoctrine,destroyDoctrine,scrollLevels,onRiver,coastalCount,focusBonus,divination,
COUNCIL_REPRICER,
} from './doctrines';

export const COMMON: DoctrineDef[] = [
  {
    id: 'riverfolk', name: 'The Channel Hydrologist', rarity: 'common', cost: 4,
    description: 'Ancient Channels +1 {food}. **+1** {splendor} per colony on a channel.',
    flavor: 'She drinks the samples after the meters break. Says it builds character.',
    nation: 'india', tags: ['river', 'growth', 'splendor'], icon: 'river', art: { hue: 200, motif: 'river' },
    effects: {
      tileYield(_ctx, a) { if (isRiverTile(a.tile)) a.yields.food += 1; },
      chronicle(ctx, c) { const n = onRiver(ctx.state, c); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'ferrymen', name: 'The Channel-Survey Pair', rarity: 'common', cost: 4,
    description: 'Ancient Channels +1 {gold}. **+4** {renown} per channel tile you own.',
    flavor: 'They charge twice if you ask whether the pressure seal is sound.',
    nation: 'usa', tags: ['river', 'gold', 'renown'], icon: 'river', art: { hue: 205, motif: 'ship' },
    effects: {
      tileYield(_ctx, a) { if (isRiverTile(a.tile)) a.yields.gold += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, isRiverTile); if (n) c.addRenown(4 * n); },
    },
  },
  {
    id: 'tidecallers', name: 'The Brine-Lake Dive Medic', rarity: 'common', cost: 4,
    description: 'Dust Shallows and Brine Lake tiles +1 {food}. **+1** {splendor} per coastal colony.',
    flavor: 'The algae is nutritious. The dive team is less certain.',
    nation: 'japan', tags: ['coastal', 'growth', 'splendor'], icon: 'wave', art: { hue: 190, motif: 'wave' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'coast' || a.tile.terrain === 'lake') a.yields.food += 1; },
      chronicle(ctx, c) { const n = coastalCount(ctx.state, c); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'salt_traders', name: 'The Brine-Lake Salvager', rarity: 'common', cost: 4,
    description: 'Coastal colonies +3 {gold}. **+10** {renown} per coastal colony.',
    flavor: 'White salt, sold by the barrel. The barrel is extra.',
    nation: 'uae', tags: ['coastal', 'gold', 'renown'], icon: 'anchor', art: { hue: 185, motif: 'anchor' },
    effects: {
      cityYield(ctx, a) { if (isCoastalCity(ctx.state, a.city)) a.yields.gold += 3; },
      chronicle(ctx, c) { const n = coastalCount(ctx.state, c); if (n) c.addRenown(10 * n); },
    },
  },
  {
    id: 'highlanders', name: 'The Ridge-Line EVA Surveyor', rarity: 'common', cost: 4,
    description: 'Ridge tiles +1 {prod}. Your units on ridges +15% defense.',
    flavor: 'Her map is immaculate. Hers is also the only one that survived.',
    nation: 'switzerland', tags: ['mountain', 'production', 'conquest'], icon: 'mountain', art: { hue: 28, motif: 'mountain' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.elevation === 'hills') a.yields.prod += 1; },
      combat(_ctx, a) { if (a.side === 'defense' && ownUnit(a) && ownTile(a).elevation === 'hills') ownMod(a, 'Highlanders', 15); },
    },
  },
  {
    id: 'peak_shrines', name: 'The Oxygen-Ration Chaplain', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per 2 Massif tiles in your territory (max +6).',
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
    id: 'sand_walkers', name: 'The Dune-Rover Repair Crew', rarity: 'common', cost: 4,
    description: 'Dune Sea tiles +1 {prod}. Geyser Vents and Ancient Deltas +1 {food} and +1 {gold}.',
    flavor: 'They can fix anything with a wrench, wire, and a deeply inaccurate manual.',
    nation: 'russia', tags: ['desert', 'production', 'growth'], icon: 'sun', art: { hue: 40, motif: 'sun' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'desert') a.yields.prod += 1;
        if (a.tile.feature === 'oasis' || a.tile.feature === 'floodplains') { a.yields.food += 1; a.yields.gold += 1; }
      },
    },
  },
  {
    id: 'mirage_poets', name: 'The Last-Broadcast Poet', rarity: 'common', cost: 4,
    description: 'Dune Sea tiles +1 {cul}. **+3** {renown} per Dune Sea tile you own.',
    flavor: 'His final Earth broadcast got a standing ovation from three empty suits.',
    nation: 'nigeria', tags: ['desert', 'culture', 'renown'], icon: 'feather', art: { hue: 36, motif: 'feather' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'desert') a.yields.cul += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, (t) => t.terrain === 'desert'); if (n) c.addRenown(3 * n); },
    },
  },
  {
    id: 'woodwardens', name: 'Hoodoo Field Rangers', rarity: 'common', cost: 4,
    description: 'Hoodoo Field tiles +1 {prod}. Your units in Hoodoo Fields +15% defense.',
    flavor: 'The rocks offer better cover than the government ever did.',
    nation: 'brazil', tags: ['forest', 'production', 'conquest'], icon: 'tree', art: { hue: 118, motif: 'tree' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.feature === 'forest') a.yields.prod += 1; },
      combat(_ctx, a) { if (a.side === 'defense' && ownUnit(a) && ownTile(a).feature === 'forest') ownMod(a, 'Woodwardens', 15); },
    },
  },
  {
    id: 'jungle_sages', name: 'Lava-Tube Mycologists', rarity: 'common', cost: 4,
    description: 'Lava Tube tiles +1 {sci} and +1 {cul}.',
    flavor: 'They found a fungus that glows. Nobody has checked if it is edible.',
    nation: 'china', tags: ['forest', 'science', 'culture'], icon: 'serpent', art: { hue: 135, motif: 'serpent' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.feature === 'jungle') { a.yields.sci += 1; a.yields.cul += 1; } },
    },
  },
  {
    id: 'frontier_charter', name: 'The Cryo-Pod Registrar', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per colony you own.',
    flavor: 'Forms are the last thing keeping the frontier from becoming a parking lot.',
    nation: 'france', tags: ['wide', 'splendor'], icon: 'compass', art: { hue: 60, motif: 'compass' },
    effects: {
      chronicle(_ctx, c) { if (c.cities.length) c.addSplendor(c.cities.length); },
    },
  },
  {
    id: 'tax_farmers', name: 'The Scrip Yield Auditor', rarity: 'common', cost: 4,
    description: '**+1** Scrip per chapter for every 3 colonies you own.',
    flavor: 'Efficient, if not beloved. The spreadsheet has airlocks.',
    nation: 'nigeria', tags: ['wide', 'economy'], icon: 'coin', art: { hue: 52, motif: 'coin' },
    effects: {
      influenceIncome(ctx, a) {
        const n = Math.floor(citiesOf(ctx.state, ctx.player.id).length / 3);
        if (n > 0) a.lines.push({ label: 'Scrip Yield Auditor', amount: n });
      },
    },
  },
  {
    id: 'homesteaders', name: 'Cryo-Bay Nursery Crew', rarity: 'common', cost: 4,
    description: 'Hab Crawlers cost 25% less {prod}. New colonies start with +1 pop.',
    flavor: 'Bring seed, bring children, bring an emergency pressure patch.',
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
    id: 'walled_garden', name: 'The Compact-Hab Gardener', rarity: 'common', cost: 4,
    description: '**+6** {splendor} if you own 3 or fewer colonies.',
    flavor: 'Small habitats, tended well, leak less often.',
    nation: 'japan', tags: ['tall', 'splendor'], icon: 'walls', art: { hue: 100, motif: 'tree' },
    effects: {
      chronicle(_ctx, c) { if (c.cities.length <= 3) c.addSplendor(6); },
    },
  },
  {
    id: 'great_hall', name: 'Ark Hab Mess-Hall Manager', rarity: 'common', cost: 4,
    description: 'Your Ark Hab +15% {prod}. **+5** {renown} per pop in your Ark Hab.',
    flavor: 'All meal lines lead to the long table. The coffee is rationed.',
    nation: 'china', tags: ['tall', 'production', 'renown'], icon: 'palace', art: { hue: 30, motif: 'crown' },
    effects: {
      cityYield(_ctx, a) { if (a.city.isCapital) a.pct.prod += 15; },
      chronicle(_ctx, c) { const cap = c.cities.find((x) => x.isCapital); if (cap) c.addRenown(5 * cap.pop); },
    },
  },
  {
    id: 'drill_sergeants', name: 'The Exo-Suit Drill Coach', rarity: 'common', cost: 4,
    description: 'Your units +10% strength when attacking.',
    flavor: 'Again. Faster. Again. The suit is not supposed to smoke.',
    nation: 'russia', tags: ['conquest'], icon: 'strength', art: { hue: 5, motif: 'sword' },
    effects: {
      combat(_ctx, a) { if (a.side === 'attack' && ownUnit(a)) ownMod(a, 'Exo-Suit Drill Coach', 10); },
    },
  },
  {
    id: 'bloodied_banners', name: 'The Suit-Patch Memorialist', rarity: 'common', cost: 4,
    description: '**+15** {renown} per enemy unit killed this chapter.',
    flavor: 'Each scorched patch a story, each tear a triumphant debrief.',
    nation: 'usa', tags: ['conquest', 'renown'], icon: 'conquest', art: { hue: 355, motif: 'skull' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.kills) c.addRenown(15 * c.stats.kills); },
    },
  },
  {
    id: 'shieldwall', name: 'The Hab-Dome Breach Team', rarity: 'common', cost: 4,
    description: 'Melee and anti-cavalry units +15% defense.',
    flavor: 'Lock shields. Hold the airlock. Keep breathing.',
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
    id: 'war_drums', name: 'The Rover-Convoy Drummers', rarity: 'common', cost: 4,
    description: 'Mounted units +1 movement.',
    flavor: 'The wheels learn the rhythm first. Then the driver does.',
    nation: 'nigeria', tags: ['conquest'], icon: 'mounted', art: { hue: 10, motif: 'horse' },
    effects: {
      unitMoves(_ctx, a) { if (unitClassOf(a.unit.type) === 'mounted') a.value += 1; },
    },
  },
  {
    id: 'headhunters', name: 'Crash-Site Recovery Crew', rarity: 'common', cost: 4,
    description: 'Killing a Feral grants **+10** {gold}. **+30** {renown} per Feral Den cleared this chapter.',
    flavor: 'They invoice by the helmet. The helmets invoice back.',
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
    id: 'march_wardens', name: 'Dust-Perimeter Watch', rarity: 'common', cost: 4,
    description: 'Your units +25% strength against Ferals.',
    flavor: 'The perimeter is mostly tape, but the tape is very convincing.',
    nation: 'north_korea', tags: ['feral', 'conquest'], icon: 'shield', art: { hue: 25, motif: 'tower' },
    effects: {
      combat(_ctx, a) { if (ownUnit(a) && enemyOwnerOf(a) === BARBARIAN) ownMod(a, 'Dust-Perimeter Watch', 25); },
    },
  },
  {
    id: 'bardic_college', name: 'The Holo-Theater Sound Tech', rarity: 'common', cost: 4,
    description: 'Colonies with a Heritage building +2 {cul}.',
    flavor: 'Nine verses for the lost, ten for the vending machine.',
    nation: 'vatican', tags: ['culture'], icon: 'lyre', art: { hue: 300, motif: 'lyre' },
    effects: {
      cityYield(_ctx, a) { if (cityHasPillarBuilding(a.city, 'arts')) a.yields.cul += 2; },
    },
  },
  {
    id: 'storytellers', name: 'The Crash-Site Oral Historian', rarity: 'common', cost: 4,
    description: '**+1** {renown} per 2 {cul} generated this chapter.',
    flavor: 'Tell it again—and make the air filter sound heroic.',
    nation: 'france', tags: ['culture', 'renown'], icon: 'book', art: { hue: 310, motif: 'book' },
    effects: {
      chronicle(_ctx, c) { const n = Math.floor(c.stats.culture / 2); if (n) c.addRenown(n); },
    },
  },
  {
    id: 'star_charts', name: 'The Orbital-Track Analyst', rarity: 'common', cost: 4,
    description: '**+20** {renown} per Breakthrough this chapter.',
    flavor: 'Map the sky; eventually something maps you back.',
    nation: 'india', tags: ['science', 'renown'], icon: 'star', art: { hue: 230, motif: 'star' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.techs) c.addRenown(20 * c.stats.techs); },
    },
  },
  {
    id: 'market_criers', name: 'The Uplink Capsule Hawker', rarity: 'common', cost: 4,
    description: 'Colonies with 6 or more pop +3 {gold}.',
    flavor: 'Nitrate! Aerogel! Rumors, two for a dead battery!',
    nation: 'usa', tags: ['gold', 'tall'], icon: 'hand', art: { hue: 46, motif: 'hand' },
    effects: {
      cityYield(_ctx, a) { if (a.city.pop >= 6) a.yields.gold += 3; },
    },
  },
  {
    id: 'coin_counters', name: 'The Credit-Vault Counter', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per 100 {gold} in your treasury (max +8).',
    flavor: 'Wealth unspent is wealth admired. Wealth spent needs a receipt.',
    nation: 'switzerland', tags: ['gold', 'splendor'], icon: 'coin', art: { hue: 48, motif: 'coin' },
    status(_counters, state) { return `+${Math.min(8, Math.floor(Math.max(0, state.players[0]?.gold ?? 0) / 100))} Hope`; },
    effects: {
      chronicle(ctx, c) { const n = Math.min(8, Math.floor(Math.max(0, ctx.player.gold) / 100)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'tithe_box', name: 'The Oxygen-Filter Fundraiser', rarity: 'common', cost: 4,
    description: '**+2** Scrip at the end of every chapter.',
    flavor: 'A coin for the air scrubber; the scrubber is patient.',
    nation: 'vatican', tags: ['economy'], icon: 'coin', art: { hue: 280, motif: 'chalice' },
    effects: {
      influenceIncome(_ctx, a) { a.lines.push({ label: 'Tithe Box', amount: 2 }); },
    },
  },
  {
    id: 'granary_keepers', name: 'The Seed-Silo Inventory Crew', rarity: 'common', cost: 4,
    description: 'Colonies need 15% less {food} to grow.',
    flavor: 'Seven fat harvests, counted one algae tray at a time.',
    nation: 'china', tags: ['growth'], icon: 'wheat', art: { hue: 75, motif: 'wheat' },
    effects: {
      growthThreshold(_ctx, a) { a.value *= 0.85; },
    },
  },
  {
    id: 'fertile_fields', name: 'The Regolith Greenhouse Tender', rarity: 'common', cost: 4,
    description: 'Greenhouse Domes +1 {food}. **+2** {renown} per Greenhouse Dome you own.',
    flavor: 'Rake, seed, sing, harvest. The compost is under quarantine.',
    nation: 'brazil', tags: ['growth', 'renown'], icon: 'wheat', art: { hue: 85, motif: 'wheat' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.improvement === 'farm' && !a.tile.pillaged) a.yields.food += 1; },
      chronicle(ctx, c) { const n = countOwnedTiles(ctx.state, ctx.player.id, (t) => t.improvement === 'farm' && !t.pillaged); if (n) c.addRenown(2 * n); },
    },
  },
  {
    id: 'midwives', name: 'The Cryo-Wake Midwife', rarity: 'common', cost: 4,
    description: '**+8** {renown} per population grown this chapter.',
    flavor: 'Every cry at dawn is a vote for tomorrow. And earplugs.',
    nation: 'india', tags: ['growth', 'renown'], icon: 'hand', art: { hue: 95, motif: 'hand' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.popGrown) c.addRenown(8 * c.stats.popGrown); },
    },
  },
  {
    id: 'forgemasters', name: 'The Basalt-Quarry Fabricator', rarity: 'common', cost: 4,
    description: 'Regolith Mines +1 {prod}. Basalt Quarries +1 {prod} and +1 {gold}.',
    flavor: 'The ridge gives. The plasma cutter sends a thank-you note.',
    nation: 'russia', tags: ['production', 'mountain'], icon: 'gear', art: { hue: 22, motif: 'gear' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.pillaged) return;
        if (a.tile.improvement === 'mine') a.yields.prod += 1;
        if (a.tile.improvement === 'quarry') { a.yields.prod += 1; a.yields.gold += 1; }
      },
    },
  },
  {
    id: 'foremen', name: 'The Prefab-Hab Site Foreman', rarity: 'common', cost: 4,
    description: 'Buildings cost 10% less {prod}.',
    flavor: 'Measure twice, shout once. The airlock is behind you.',
    nation: 'china', tags: ['production'], icon: 'gear', art: { hue: 20, motif: 'gear' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building') a.cost *= 0.9; },
    },
  },
  {
    id: 'master_masons', name: 'The Megaproject Sinterer', rarity: 'common', cost: 4,
    description: 'Megaprojects cost 15% less {prod}.',
    flavor: 'Their fingerprints are fused into every load-bearing wall.',
    nation: 'france', tags: ['wonders', 'production'], icon: 'pyramid', art: { hue: 34, motif: 'pyramid' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'wonder') a.cost *= 0.85; },
    },
  },
  {
    id: 'bread_and_circuses', name: 'The Dome-Festival Organizer', rarity: 'common', cost: 4,
    description: '**+3** {happy} colony Stability.',
    flavor: 'Full bellies seldom riot. The karaoke machine helps.',
    nation: 'nigeria', tags: ['happiness'], icon: 'happy', art: { hue: 335, motif: 'mask' },
    effects: {
      happiness(_ctx, a) { a.value += 3; },
    },
  },
  {
    id: 'content_folk', name: 'The Stability-Systems Mediator', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per 3 {happy} Stability (max +6).',
    flavor: 'A smiling colony is a monument. The dentist is still on Earth.',
    nation: 'japan', tags: ['happiness', 'splendor'], icon: 'happy', art: { hue: 330, motif: 'sun' },
    status(_counters, state) { return `+${Math.min(6, Math.floor(Math.max(0, state.players[0]?.happiness ?? 0) / 3))} Hope`; },
    effects: {
      chronicle(ctx, c) { const n = Math.min(6, Math.floor(Math.max(0, ctx.player.happiness) / 3)); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'patrons_seal', name: 'The Uplink Capsule Broker', rarity: 'common', cost: 4,
    description: 'Crew cards in the Uplink cost **1** Scrip less.',
    flavor: 'A friend in logistics is worth a pouch of spare filters.',
    nation: 'uae', tags: ['shop'], icon: 'key', art: { hue: 265, motif: 'key' },
    effects: {
      ...COUNCIL_REPRICER,
    },
  },
  {
    id: 'open_market', name: 'The Uplink Inventory Clerk', rarity: 'common', cost: 4,
    description: 'The Uplink reroll cost starts at **0** Scrip.',
    flavor: 'Look all you like, friend. The stock is mostly air.',
    nation: 'switzerland', tags: ['shop'], icon: 'hand', art: { hue: 275, motif: 'hand' },
    effects: {
      council(_ctx, a) { if (!a.reroll) a.council.rerollCost = 0; },
    },
  },
  {
    id: 'heralds', name: 'The Salvage Dispatch Broadcaster', rarity: 'common', cost: 4,
    description: 'Whenever you use Salvage, gain **+15** {gold}.',
    flavor: 'Urgent transmission! Also, please settle your invoice.',
    nation: 'usa', tags: ['edict', 'gold'], icon: 'bolt', art: { hue: 40, motif: 'bolt' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'edictUsed' || !ctx.player.isHuman) return;
        addGold(ctx.state, ctx.player.id, 15, 'Salvage Dispatch Broadcaster', ctx.emit);
        ctx.flash('+15 Credits');
      },
    },
  },
  {
    id: 'scribes_of_decree', name: 'The Salvage Logbook Keeper', rarity: 'common', cost: 4,
    description: '**+2** {splendor} per Salvage used this chapter.',
    flavor: 'Logged, sealed, backed up to a drive that may still work.',
    nation: 'france', tags: ['edict', 'splendor'], icon: 'feather', art: { hue: 290, motif: 'feather' },
    status(counters) { return `${counters.used ?? 0} Salvage used this chapter`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type === 'chapterStarted') ctx.counters.used = 0;
        else if (ev.type === 'edictUsed' && ctx.player.isHuman) ctx.counters.used = (ctx.counters.used ?? 0) + 1;
      },
      chronicle(ctx, c) { const n = ctx.counters.used ?? 0; if (n) c.addSplendor(2 * n); },
    },
  },
  {
    id: 'lorekeepers', name: 'The Blueprint Archive Technician', rarity: 'common', cost: 4,
    description: '**+1** {splendor} per 2 Blueprint levels gained across all pillars.',
    flavor: 'Each data slate a night-light; together, enough to find the airlock.',
    nation: 'china', tags: ['scroll', 'splendor'], icon: 'book', art: { hue: 250, motif: 'book' },
    status(_counters, state) { return `+${Math.floor(scrollLevels(state) / 2)} Hope`; },
    effects: {
      chronicle(ctx, c) { const n = Math.floor(scrollLevels(ctx.state) / 2); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'stoic_chroniclers', name: 'The Crisis-Channel Broadcaster', rarity: 'common', cost: 4,
    description: '**+5** {splendor} during a Crisis chapter.',
    flavor: 'The signal is mostly static. The optimism is completely deliberate.',
    nation: 'north_korea', tags: ['crisis', 'splendor'], icon: 'crisis', art: { hue: 350, motif: 'book' },
    effects: {
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) c.addSplendor(5); },
    },
  },
  {
    id: 'hoarders_vault', name: 'The Emergency Ration Custodian', rarity: 'common', cost: 4,
    description: 'During a Crisis chapter, every colony +2 {food} and +2 {prod}.',
    flavor: 'Mocked in the easy years. Thanked when the filters clog.',
    nation: 'switzerland', tags: ['crisis', 'growth', 'production'], icon: 'key', art: { hue: 345, motif: 'key' },
    effects: {
      cityYield(ctx, a) { if (ctx.state.run.crisisActive) { a.yields.food += 2; a.yields.prod += 2; } },
    },
  },
  {
    id: 'oracle_bones', name: 'The Crash-Site Pattern Reader', rarity: 'common', cost: 4,
    description: '**+0** to **+8** {splendor}, recalculated every turn.',
    flavor: 'Shake the fragments, read the static, pretend that was the plan.',
    nation: 'india', tags: ['risk', 'splendor'], icon: 'eye', art: { hue: 32, motif: 'eye' },
    effects: {
      chronicle(ctx, c) { const n = divination(ctx.state.turn, ctx.uid ?? 0, 9); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'tally_stones', name: 'The Shift-Change Tally Clerk', rarity: 'common', cost: 4,
    description: 'Gains **+3** {renown} at the start of every turn.',
    flavor: 'One washer per sunrise. The pile is technically a database.',
    nation: 'japan', tags: ['scaling', 'renown'], icon: 'hourglass', art: { hue: 25, motif: 'hourglass' },
    status(counters) { return `+${counters.renown ?? 0} Output`; },
    effects: {
      turnStart(ctx) { ctx.counters.renown = (ctx.counters.renown ?? 0) + 3; },
      chronicle(ctx, c) { const n = ctx.counters.renown ?? 0; if (n) c.addRenown(n); },
    },
  },
  {
    id: 'bonfire_of_tales', name: 'The Emergency Signal-Fire Keeper', rarity: 'common', cost: 4,
    description: '**+10** {splendor}; loses 1 after every Sol Report. Fizzles at 0.',
    flavor: 'The best stories are told before the oxygen runs out.',
    nation: 'brazil', tags: ['splendor', 'risk'], icon: 'flame', art: { hue: 15, motif: 'flame' },
    status(counters) { return `+${Math.max(0, 10 - (counters.spent ?? 0))} Hope`; },
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
    id: 'gilders_guild', name: 'The EVA-Suit Patch Decorator', rarity: 'common', cost: 4,
    description: '**+3** {splendor} per Crew card with an edition.',
    flavor: 'Gold foil on everything, including the oxygen warning labels.',
    nation: 'uae', tags: ['edition', 'splendor'], icon: 'star', art: { hue: 50, motif: 'crown' },
    effects: {
      chronicle(ctx, c) { const n = ctx.state.run.doctrines.filter((d) => d.edition !== 'base').length; if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'nest_egg', name: 'The Scrip-Value Appraiser', rarity: 'common', cost: 4,
    description: 'Gains **+2** Scrip of sell value after every Sol Report.',
    flavor: 'Patience compounds. So does the late fee.',
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
    id: 'vanguard', name: 'The First-Through-the-Airlock Tech', rarity: 'common', cost: 4,
    description: '**+8** {splendor} if this is your leftmost Crew card.',
    flavor: 'First through the hatch, first in the incident report.',
    nation: 'usa', tags: ['position', 'splendor'], icon: 'chevronLeft', art: { hue: 8, motif: 'eagle' },
    effects: {
      chronicle(ctx, c) { if (doctrineIndex(ctx.state, ctx.uid) === 0) c.addSplendor(8); },
    },
  },
  {
    id: 'rearguard', name: 'The Last-Through-the-Airlock Tech', rarity: 'common', cost: 4,
    description: '**+25%** {renown} if this is your rightmost Crew card.',
    flavor: 'Someone must close the hatch behind the evacuees.',
    nation: 'russia', tags: ['position', 'renown'], icon: 'chevronRight', art: { hue: 210, motif: 'shield' },
    effects: {
      chronicle(ctx, c) {
        const i = doctrineIndex(ctx.state, ctx.uid);
        if (i >= 0 && i === ctx.state.run.doctrines.length - 1) c.addRenown(Math.round(c.renown() * 0.25));
      },
    },
  },
  {
    id: 'road_wardens', name: 'The Relay-Beacon Technician', rarity: 'common', cost: 4,
    description: 'Your units +1 vision. Scout Rovers +1 movement.',
    flavor: 'Eyes on every cairn beacon. They still miss the obvious.',
    nation: 'china', tags: ['exploration'], icon: 'vision', art: { hue: 150, motif: 'compass' },
    effects: {
      unitVision(_ctx, a) { a.value += 1; },
      unitMoves(_ctx, a) { if (a.unit.type === 'scout') a.value += 1; },
    },
  },
  {
    id: 'pathfinders', name: 'The Crash-Site Survey Pair', rarity: 'common', cost: 4,
    description: '**+3** {renown} per tile explored this chapter.',
    flavor: 'Beyond the map, the margins are full of old shipping labels.',
    nation: 'france', tags: ['exploration', 'renown'], icon: 'map', art: { hue: 160, motif: 'compass' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.tilesExplored) c.addRenown(3 * c.stats.tilesExplored); },
    },
  },
  focusBonus('muses_favor', 'The Dome Choir Director', 'arts', 'Heritage', 'lyre', 300, 'She conducts in an airlock. The helmets make the acoustics incredible.', 'vatican'),
  focusBonus('lamplighters', 'The Night-Shift Lab Tech', 'discovery', 'Science', 'flask', 230, 'He keeps asking the spectrometer what happened to Earth. It will not answer.', 'north_korea'),
  focusBonus('guild_ledger', 'Scrip Accountant Chen', 'commerce', 'Trade', 'coin', 48, 'Every credit reconciled; every receipt smells faintly of solvent.', 'china'),
  focusBonus('war_banner', 'The Flag Repair Crew', 'conquest', 'Warfare', 'sword', 0, 'They patch the flag between incoming rounds. Nobody asked them to stop.', 'usa'),
  focusBonus('harvest_moon', 'The Greenhouse Tender', 'prosperity', 'Growth', 'wheat', 85, 'She calls the tomatoes a victory. The tomatoes have no comment.', 'brazil'),
  focusBonus('triumphal_arch', 'Crash-Site Commemorator', 'glory', 'Monuments', 'laurel', 38, 'He builds memorials from wreckage. There is never a shortage of material.', 'france'),
];

registerCrew(COMMON);
