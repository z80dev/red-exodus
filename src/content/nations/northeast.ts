// OWNER: Nations (northeast slice). Sweden, Norway, Finland, Poland, Czechia, Romania, Türkiye, Israel, Kazakhstan.
// Leader effects apply to every player led by that nation (AIs included): hooks always use ctx.player, and
// run-level perks (influence income) are guarded by ctx.player.isHuman.
import type { DoctrineDef, LeaderDef } from '../../sim/defs';
import { addGold } from '../../sim/economy';
import { changePop } from '../../sim/cities';
import { changeCryo } from '../../sim/mars';
import { chance } from '../../sim/rng';
import { registerCrew } from '../doctrineRegistry';
import { cityHas, coastalCount, ownMod, ownTile, ownUnit, unitClassOf } from '../doctrines';

export const LEADERS_NORTHEAST: Record<string, LeaderDef> = {
  sweden: {
    id: 'sweden', name: 'Astrid Lindqvist', title: 'Chair of the Prize Committee; Chief Safety Inspector', civName: 'Folkhem Ark', adjective: 'Swedish',
    country: 'Sweden', code: 'SWE', flagColors: ['#006aa7', '#fecc00'], colors: { primary: '#f2c230', secondary: '#1f5fa8' },
    description: 'The Ark arrived in 1,400 flat-packed pieces, with one diagram, and a committee ready to discuss the diagram.',
    bonus: 'Each Breakthrough researched pays **25** {gold} from the Prize Fund. Colonies with a Data Archive yield **+2** {cul} (fika). Your units heal **+10** HP each turn.',
    startDoctrine: 'laureate', uniqueUnit: 'carolean_marcher', uniqueBuilding: 'nobel_hall', aiPersonality: 'scientist',
    cityNames: ['New Stockholm', 'Göteborg Gantry', 'Malmö Dome', 'Uppsala Array', 'Kiruna Deep', 'Västerås Works', 'Örebro Orbit', 'Linköping Lander', 'Fika Junction', 'Visby Walls', 'Umeå Underground', 'Abisko Lights', 'Flat-Pack Landing', 'Lund Lab', 'Skål Station'],
    portrait: { hue: 56, motif: 'book', crest: 'laurel' },
    gender: 'f', alt: { name: 'Lars-Erik Bergström', title: 'Chair of the Assembly Committee; Chief Instruction Manual Inspector', gender: 'm', description: 'The Ark arrived in 1,400 flat-packed pieces, with one diagram, and a committee ready to discuss the diagram.' },
    effects: {
      onEvent(ctx, ev) { if (ev.type === 'techResearched' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 25, 'Prize Fund', ctx.emit); },
      cityYield(_ctx, a) { if (cityHas(a.city, 'library')) a.yields.cul += 2; },
      unitHeal(ctx, a) { if (a.unit.owner === ctx.player.id) a.value += 10; },
    },
  },
  norway: {
    id: 'norway', name: 'Ingrid Solheim', title: 'Harbour Admiral of the Fjord Ark', civName: 'Fjord Ark', adjective: 'Norwegian',
    country: 'Norway', code: 'NOR', flagColors: ['#ba0c2f', '#ffffff', '#00205b'], colors: { primary: '#2a6f97', secondary: '#d0383f' },
    description: 'The longships were retired long ago. The Ark’s skiff docks, however, are fully staffed and slightly smug.',
    bonus: 'Dust Shallows, Dust Sea and Brine Lake tiles yield **+1** {gold}. Frost Flats and Polar Ice yield **+1** {food}. Every enemy unit destroyed plunders **10** {gold}.',
    startDoctrine: 'fjord_pilot', uniqueUnit: 'ski_patrol', uniqueBuilding: 'fjord_pier', aiPersonality: 'expansionist',
    cityNames: ['Nye Oslo', 'Bergen Basin', 'Trondheim Tholus', 'Stavanger Station', 'Tromsø Aurora', 'Narvik Crater', 'Ålesund Airlock', 'Bodø Dome', 'Lillehammer Luge', 'Kristiansand South', 'Hammerfest Habitat', 'Svalbard Two', 'Valhalla Annex', 'Longship Landing', 'Midnight Sun Colony'],
    portrait: { hue: 222, motif: 'ship', crest: 'anchor' },
    gender: 'f', alt: { name: 'Magnus Haugen', title: 'Harbour Admiral of the Fjord Ark', gender: 'm', description: 'The longships were retired long ago. The Ark’s skiff docks, however, are fully staffed and slightly smug.' },
    effects: {
      tileYield(_ctx, a) {
        const t = a.tile.terrain;
        if (t === 'coast' || t === 'ocean' || t === 'lake') a.yields.gold += 1;
        else if (t === 'tundra' || t === 'snow') a.yields.food += 1;
      },
      onEvent(ctx, ev) { if (ev.type === 'unitDied' && ev.killer === ctx.player.id && ev.player !== ctx.player.id) addGold(ctx.state, ctx.player.id, 10, 'Plunder', ctx.emit); },
    },
  },
  finland: {
    id: 'finland', name: 'Aino Virtanen', title: 'Reservist General and Sauna Warden of the Sisu Ark', civName: 'Sisu Ark', adjective: 'Finnish',
    country: 'Finland', code: 'FIN', flagColors: ['#ffffff', '#003580'], colors: { primary: '#86c5ea', secondary: '#ffffff' },
    description: 'Two meters of frost, zero small talk, and a sauna rated for hard vacuum.',
    bonus: 'Units below half HP fight **+40%** harder (Sisu). Hoodoo Fields yield **+1** {prod}. Frost Flats and Polar Ice yield **+1** {sci}.',
    startDoctrine: 'winter_sniper', uniqueUnit: 'sisu_sharpshooter', uniqueBuilding: 'sauna', aiPersonality: 'builder',
    cityNames: ['Uusi Helsinki', 'Espoo Escarpment', 'Tampere Tholus', 'Oulu Outpost', 'Rovaniemi Redux', 'Turku Terminus', 'Lahti Lander', 'Kuopio Crater', 'Jyväskylä Junction', 'Vaasa Vault', 'Sauna Station Nine', 'Nokia Nest', 'Lapland Airlock', 'Silent Crater', 'Sisu Summit'],
    portrait: { hue: 178, motif: 'mountain', crest: 'shield' },
    gender: 'f', alt: { name: 'Eino Korhonen', title: 'Reservist Colonel and Sauna Warden of the Sisu Ark', gender: 'm', description: 'Two meters of frost, zero small talk, and a sauna rated for hard vacuum.' },
    effects: {
      combat(_ctx, a) { const u = ownUnit(a); if (u && u.hp <= 50) ownMod(a, 'Sisu', 40); },
      tileYield(_ctx, a) {
        if (a.tile.feature === 'forest') a.yields.prod += 1;
        if (a.tile.terrain === 'tundra' || a.tile.terrain === 'snow') a.yields.sci += 1;
      },
    },
  },
  poland: {
    id: 'poland', name: 'Katarzyna Nowak', title: 'Marshal of the Feniks Ark; Union Steward', civName: 'Feniks Ark', adjective: 'Polish',
    country: 'Poland', code: 'POL', flagColors: ['#ffffff', '#dc143c'], colors: { primary: '#d94f7a', secondary: '#f4efe6' },
    description: 'The Ark has been shaken before. It stood up, drank the tea, and filed a very thorough grievance.',
    bonus: 'Each Sol Report pays **1** {influence} per 2 Colonies (max **4**). Mounted units attack with **+30%** strength. Whenever a Colony of yours is captured, gain **+1** Cryo Pod.',
    startDoctrine: 'pierogi_chef', uniqueUnit: 'winged_hussar', uniqueBuilding: 'wawel_bastion', aiPersonality: 'warmonger',
    cityNames: ['Nowa Warszawa', 'Kraków Krater', 'Gdańsk Gantry', 'Wrocław Warren', 'Poznań Pad', 'Łódź Lander', 'Lublin Dome', 'Katowice Works', 'Szczecin Station', 'Białystok Base', 'Toruń Terminus', 'Zakopane Massif', 'Pierogi Point', 'Wawel on Mars', 'Solidarity Square'],
    portrait: { hue: 340, motif: 'feather', crest: 'horse' },
    gender: 'f', alt: { name: 'Tomasz Kowalczyk', title: 'Marshal of the Feniks Ark; Union Steward', gender: 'm', description: 'The Ark has been shaken before. It stood up, drank the tea, and filed a very thorough grievance.' },
    effects: {
      influenceIncome(ctx, a) {
        if (!ctx.player.isHuman) return;
        const n = Object.values(ctx.state.cities).filter((city) => city.owner === ctx.player.id).length;
        const amount = Math.min(4, Math.floor(n / 2));
        if (amount > 0) a.lines.push({ label: 'Solidarity', amount });
      },
      combat(_ctx, a) { if (a.side === 'attack' && a.attacker && unitClassOf(a.attacker.type) === 'mounted') ownMod(a, 'Winged Charge', 30); },
      onEvent(ctx, ev) { if (ev.type === 'cityCaptured' && ev.from === ctx.player.id) changeCryo(ctx.state, ctx.player.id, 1, ctx.emit); },
    },
  },
  czechia: {
    id: 'czechia', name: 'Marta Novotná', title: 'Master Horologist and Chief Brewmaster of the Orloj Ark', civName: 'Orloj Ark', adjective: 'Czech',
    country: 'Czechia', code: 'CZE', flagColors: ['#ffffff', '#d7141a', '#11457e'], colors: { primary: '#5b3db0', secondary: '#d9d2f0' },
    description: 'The astronomical clock made the crossing intact. It now insists the 24-hour-39-minute sol is the planet’s mistake.',
    bonus: 'Unit upgrades cost **50%** less {gold}. Each Sol Report gains **+1** {splendor} per **6** techs known. Colonies with a Fabricator make **+15%** {prod}.',
    startDoctrine: 'brewmaster', uniqueUnit: 'hussite_wagon_crew', uniqueBuilding: 'orloj_tower', aiPersonality: 'builder',
    cityNames: ['Nová Praha', 'Brno Basin', 'Ostrava Works', 'Plzeň Pale Lager', 'Olomouc Orbit', 'Liberec Lander', 'Karlovy Vary Spa', 'Český Crater', 'Kutná Hora Cache', 'Hradec Habitat', 'Pardubice Pad', 'Defenestration Dome', 'Orloj Square', 'Bohemian Basin', 'Golem Gate'],
    portrait: { hue: 258, motif: 'hourglass', crest: 'lion' },
    gender: 'f', alt: { name: 'Václav Horák', title: 'Master Clockmaker and Chief Brewmaster of the Orloj Ark', gender: 'm', description: 'The astronomical clock made the crossing intact. It now insists the 24-hour-39-minute sol is the planet’s mistake.' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'gold' && a.item.kind === 'upgrade') a.cost *= 0.5; },
      chronicle(ctx, c) { const n = Math.floor(ctx.player.techs.length / 6); if (n > 0) c.addSplendor(n); },
      cityYield(_ctx, a) { if (cityHas(a.city, 'workshop')) a.pct.prod += 15; },
    },
  },
  romania: {
    id: 'romania', name: 'Ileana Munteanu', title: 'Voivode of the Carpathian Ark; Keeper of the Pods', civName: 'Carpathian Ark', adjective: 'Romanian',
    country: 'Romania', code: 'ROU', flagColors: ['#002b7f', '#fcd116', '#ce1126'], colors: { primary: '#7b1e3a', secondary: '#e0b030' }, cryo: 4,
    description: 'A castle, a mountain, a freezer full of coffin-shaped pods, and a perfectly reasonable explanation for all three.',
    bonus: 'Start with **+1** Cryo Pod. Each Orbital Drop has a **1-in-3** chance to return its pod. Lava Tubes yield **+1** {prod}. Units on Ridges and Massifs fight **+30%** harder.',
    startDoctrine: 'night_count', uniqueUnit: 'haiduk_raider', uniqueBuilding: 'bran_keep', aiPersonality: 'expansionist',
    cityNames: ['Noua București', 'Cluj Crater', 'Brașov Basin', 'Sibiu Station', 'Timișoara Terminal', 'Iași Inlet', 'Sighișoara Keep', 'Bran Dome', 'Peleș Pressurized', 'Ploiești Pumpjack', 'Transfăgărășan Pass', 'Carpathian Cache', 'Garlic Airlock', 'Poienari Spire', 'Midnight Pod Bay'],
    portrait: { hue: 352, motif: 'castle', crest: 'tower' },
    gender: 'f', alt: { name: 'Radu Vasilescu', title: 'Voivode of the Carpathian Ark; Keeper of the Pods', gender: 'm', description: 'A castle, a mountain, a freezer full of coffin-shaped pods, and a perfectly reasonable explanation for all three.' },
    effects: {
      onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id && chance(ctx.state.rng, 1 / 3)) changeCryo(ctx.state, ctx.player.id, 1, ctx.emit); },
      tileYield(_ctx, a) { if (a.tile.feature === 'jungle') a.yields.prod += 1; },
      combat(_ctx, a) { const e = ownTile(a).elevation; if (ownUnit(a) && (e === 'hills' || e === 'mountain')) ownMod(a, 'Carpathian Redoubt', 30); },
    },
  },
  turkey: {
    id: 'turkey', name: 'Deniz Aksoy', title: 'Caravanserai Warden of the Crossroads Ark', civName: 'Crossroads Ark', adjective: 'Turkish',
    country: 'Türkiye', code: 'TUR', flagColors: ['#e30a17', '#ffffff'], colors: { primary: '#e6392f', secondary: '#f5f0e6' },
    description: 'An Ark that is mostly a bazaar with an airlock, a very large kettle, and a cat nobody can explain.',
    bonus: 'Roads yield **+1** {gold}. Melee and siege units attack Colonies with **+25%** strength. Capturing a Colony pays **50** {gold}.',
    startDoctrine: 'tea_seller', uniqueUnit: 'janissary_bombardier', uniqueBuilding: 'covered_bazaar', aiPersonality: 'warmonger',
    cityNames: ['Yeni İstanbul', 'Ankara Airlock', 'İzmir Inlet', 'Bursa Basin', 'Antalya Annex', 'Konya Crater', 'Trabzon Terminal', 'Gaziantep Gantry', 'Kayseri Keep', 'Çanakkale Cut', 'Cappadocia Cavern', 'Pamukkale Terraces', 'Bazaar Gate', 'Çay Corner', 'Cats of Mars'],
    portrait: { hue: 6, motif: 'coin', crest: 'moon' },
    gender: 'm', alt: { name: 'Zeynep Yıldız', title: 'Caravanserai Warden of the Crossroads Ark', gender: 'f', description: 'An Ark that is mostly a bazaar with an airlock, a very large kettle, and a cat nobody can explain.' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.road) a.yields.gold += 1; },
      combat(_ctx, a) {
        if (a.side !== 'attack' || !a.attacker || !a.defenderCity) return;
        const cls = unitClassOf(a.attacker.type);
        if (cls === 'melee' || cls === 'siege') ownMod(a, 'Assault Drill', 25);
      },
      onEvent(ctx, ev) { if (ev.type === 'cityCaptured' && ev.to === ctx.player.id) addGold(ctx.state, ctx.player.id, 50, 'Spoils of the bazaar', ctx.emit); },
    },
  },
  kazakhstan: {
    id: 'kazakhstan', name: 'Aigerim Sarsenova', title: 'Launch Director of the Baikonur Ark; Marshal of the Steppe', civName: 'Baikonur Ark', adjective: 'Kazakh',
    country: 'Kazakhstan', code: 'KAZ', flagColors: ['#00afca', '#fec50c'], colors: { primary: '#2fc4b2', secondary: '#f0b92f' },
    description: 'The cosmodrome is leased, the steppe is endless, and the horses have strong opinions about the rovers.',
    bonus: 'Colonies founded by an Orbital Drop start with **+1** colonist. Regolith Plain tiles yield **+1** {prod}. Mounted units gain **+1** Move and cost **25%** less {prod}.',
    startDoctrine: 'launch_director', uniqueUnit: 'steppe_batyr', uniqueBuilding: 'cosmodrome_gantry', aiPersonality: 'expansionist',
    cityNames: ['New Astana', 'Almaty Apex', 'Baikonur Prime', 'Shymkent Station', 'Karaganda Coalface', 'Aktau Shallows', 'Semey Steppe', 'Turkistan Terminal', 'Pavlodar Pad', 'Aral Basin', 'Kokshetau Keep', 'Charyn Canyon', 'Kumis Corner', 'Steppe Horizon', 'Yurt Dome One'],
    portrait: { hue: 156, motif: 'horse', crest: 'sun' },
    gender: 'f', alt: { name: 'Nurlan Zhaksybekov', title: 'Launch Director of the Baikonur Ark; Marshal of the Steppe', gender: 'm', description: 'The cosmodrome is leased, the steppe is endless, and the horses have strong opinions about the rovers.' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type === 'podLanded' && ev.player === ctx.player.id) ctx.counters.dropTile = ev.tile + 1;
        if (ev.type === 'cityFounded' && ev.player === ctx.player.id && ctx.counters.dropTile === ev.tile + 1) {
          ctx.counters.dropTile = 0;
          const city = ctx.state.cities[ev.cityId];
          if (city) changePop(ctx.state, city, 1, ctx.emit);
        }
      },
      tileYield(_ctx, a) { if (a.tile.terrain === 'plains') a.yields.prod += 1; },
      unitMoves(ctx, a) { if (a.unit.owner === ctx.player.id && unitClassOf(a.unit.type) === 'mounted') a.value += 1; },
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'unit' && unitClassOf(a.item.id) === 'mounted') a.cost *= 0.75; },
    },
  },
};

export const CREW_NORTHEAST: DoctrineDef[] = [
  {
    id: 'laureate', name: 'The Laureate', rarity: 'uncommon', cost: 6, noShop: true, nation: 'sweden',
    description: 'Won the big prize for a paper nobody on Mars can reproduce. Each Breakthrough this chapter adds **+1** {splendor} to the Sol Report (max **3**).',
    flavor: '“I would like to thank the committee, the reactor, and the last biscuit.”', tags: ['nation', 'research', 'splendor'], icon: 'laurel', art: { hue: 52, motif: 'laurel' },
    effects: { chronicle(_ctx, c) { const n = Math.min(3, c.stats.techs); if (n > 0) c.addSplendor(n); } },
  },
  {
    id: 'fjord_pilot', name: 'The Fjord Pilot', rarity: 'uncommon', cost: 6, noShop: true, nation: 'norway',
    description: 'Threads a skiff through any shallows, in any gale, without spilling the coffee. Each Sol Report gains **+1** {splendor} per Colony on the Dust Shallows (max **4**).',
    flavor: '“Narrow, deep, and hard to park. Like a decent argument.”', tags: ['nation', 'coastal', 'splendor'], icon: 'ship', art: { hue: 205, motif: 'anchor' },
    effects: { chronicle(ctx, c) { const n = Math.min(4, coastalCount(ctx.state, c)); if (n > 0) c.addSplendor(n); } },
  },
  {
    id: 'winter_sniper', name: 'The Winter Sniper', rarity: 'uncommon', cost: 6, noShop: true, nation: 'finland',
    description: 'One patient shot, no small talk. Your ranged units attack with **+25%** strength.',
    flavor: '“I am not hiding. The snow is simply very welcoming.”', tags: ['nation', 'combat', 'ranged'], icon: 'eye', art: { hue: 190, motif: 'eye' },
    effects: { combat(_ctx, a) { if (a.side === 'attack' && a.ranged && a.attacker) ownMod(a, 'Winter Sniper', 25); } },
  },
  {
    id: 'pierogi_chef', name: 'The Pierogi Chef', rarity: 'uncommon', cost: 6, noShop: true, nation: 'poland',
    description: 'A hot meal solves most problems, and a second one solves the rest. Each time a Colony grows, gain **4** {gold}.',
    flavor: 'The filling is a state secret. The dumplings are a national resource.', tags: ['nation', 'growth', 'credits'], icon: 'wheat', art: { hue: 36, motif: 'wheat' },
    effects: { onEvent(ctx, ev) { if (ev.type === 'cityGrew' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 4, 'Pierogi sales', ctx.emit); } },
  },
  {
    id: 'brewmaster', name: 'The Brewmaster', rarity: 'uncommon', cost: 6, noShop: true, nation: 'czechia',
    description: 'Keeps the colony cheerful with a legally distinct beverage. Each Sol Report gains **+1** {splendor} per 3 colonists grown this chapter (max **3**).',
    flavor: '“Beer is nutritionally adjacent to water. That is a legal position.”', tags: ['nation', 'growth', 'splendor'], icon: 'chalice', art: { hue: 40, motif: 'chalice' },
    effects: { chronicle(_ctx, c) { const n = Math.min(3, Math.floor(c.stats.popGrown / 3)); if (n > 0) c.addSplendor(n); } },
  },
  {
    id: 'night_count', name: 'The Count', rarity: 'uncommon', cost: 6, noShop: true, nation: 'romania',
    description: 'Works the night shift and dislikes being photographed. Each Sol Report gains **+1** {splendor} per enemy unit destroyed this chapter (max **4**).',
    flavor: '“The sun is a scheduling issue. I have scheduled around it.”', tags: ['nation', 'combat', 'splendor'], icon: 'moon', art: { hue: 350, motif: 'moon' },
    effects: { chronicle(_ctx, c) { const n = Math.min(4, c.stats.kills); if (n > 0) c.addSplendor(n); } },
  },
  {
    id: 'tea_seller', name: 'The Tea Seller', rarity: 'uncommon', cost: 6, noShop: true, nation: 'turkey',
    description: 'Appears at every airlock with a tray of small glasses. At the start of each turn, gain **1** {gold} per Colony (max **10**).',
    flavor: '“Sit, sit. The negotiation can wait until the second glass.”', tags: ['nation', 'credits', 'colonies'], icon: 'chalice', art: { hue: 8, motif: 'chalice' },
    effects: {
      turnStart(ctx) {
        const n = Math.min(10, Object.values(ctx.state.cities).filter((city) => city.owner === ctx.player.id).length);
        if (n > 0) addGold(ctx.state, ctx.player.id, n, 'Tea money', ctx.emit);
      },
    },
  },
  {
    id: 'launch_director', name: 'The Launch Director', rarity: 'uncommon', cost: 6, noShop: true, nation: 'kazakhstan',
    description: 'Counts down in three languages and bills in one. Every Orbital Drop pays **30** {gold} in launch fees.',
    flavor: '“T-minus ten. The horses have been moved. Please move the horses.”', tags: ['nation', 'drop', 'credits'], icon: 'tower', art: { hue: 170, motif: 'tower' },
    effects: { onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 30, 'Launch fees', ctx.emit); } },
  },
];

registerCrew(CREW_NORTHEAST);
