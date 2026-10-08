// OWNER: Nations (northeast slice). Sweden, Norway, Finland, Poland, Czechia, Romania, Türkiye, Israel, Kazakhstan.
// Leader effects apply to every player led by that nation (AIs included): hooks always use ctx.player, and
// run-level perks (influence income) are guarded by ctx.player.isHuman.
import type { DoctrineDef, LeaderDef } from '../../sim/defs';
import { addGold } from '../../sim/economy';
import { changePop } from '../../sim/cities';
import { changeCryo } from '../../sim/mars';
import { chance } from '../../sim/rng';
import { grantXp } from '../../sim/units';
import { registerCrew } from '../doctrineRegistry';
import { cityHas, coastalCount, ownMod, ownTile, ownUnit, unitClassOf } from '../doctrines';

export const LEADERS_NORTHEAST: Record<string, LeaderDef> = {
  sweden: {
    id: 'sweden', name: 'Astrid Lindqvist', title: 'Prize Committee Chair', civName: 'Folkhem Ark', adjective: 'Swedish',
    country: 'Sweden', code: 'SWE', flagColors: ['#006aa7', '#fecc00'], colors: { primary: '#f2c230', secondary: '#1f5fa8' },
    description: 'The Ark came in 1,400 flat-packed pieces. Everyone is still reading the diagram.',
    bonus: 'Each Research you finish pays **25** {gold}. Colonies with a Data Archive yield **+2** {cul}. Your units heal **+10** HP every turn.',
    startDoctrine: 'laureate', uniqueUnit: 'carolean_marcher', uniqueBuilding: 'nobel_hall', aiPersonality: 'scientist',
    cityNames: ['New Stockholm', 'Göteborg Gantry', 'Malmö Dome', 'Uppsala Array', 'Kiruna Deep', 'Västerås Works', 'Örebro Orbit', 'Linköping Lander', 'Fika Junction', 'Visby Walls', 'Umeå Underground', 'Abisko Lights', 'Flat-Pack Landing', 'Lund Lab', 'Skål Station'],
    portrait: { hue: 56, motif: 'book', crest: 'laurel' },
    gender: 'f', alt: { name: 'Lars-Erik Bergström', title: 'Assembly Committee Chair', gender: 'm', description: 'The Ark came in 1,400 flat-packed pieces. Everyone is still reading the diagram.' },
    effects: {
      onEvent(ctx, ev) { if (ev.type === 'techResearched' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 25, 'Prize money', ctx.emit); },
      cityYield(_ctx, a) { if (cityHas(a.city, 'library')) a.yields.cul += 2; },
      unitHeal(ctx, a) { if (a.unit.owner === ctx.player.id) a.value += 10; },
    },
  },
  norway: {
    id: 'norway', name: 'Ingrid Solheim', title: 'Harbor Chief of the Fjord Ark', civName: 'Fjord Ark', adjective: 'Norwegian',
    country: 'Norway', code: 'NOR', flagColors: ['#ba0c2f', '#ffffff', '#00205b'], colors: { primary: '#2a6f97', secondary: '#d0383f' },
    description: 'The longships are gone. The skiff docks are fully staffed and a bit proud.',
    bonus: 'Shallows, Dust Sea and Salt Lake tiles yield **+1** {gold}. Frost Plains and Ice Cap tiles yield **+1** {food}. Every enemy unit you destroy pays **10** {gold}.',
    startDoctrine: 'fjord_pilot', uniqueUnit: 'ski_patrol', uniqueBuilding: 'fjord_pier', aiPersonality: 'expansionist',
    cityNames: ['Nye Oslo', 'Bergen Basin', 'Trondheim Tholus', 'Stavanger Station', 'Tromsø Aurora', 'Narvik Crater', 'Ålesund Airlock', 'Bodø Dome', 'Lillehammer Luge', 'Kristiansand South', 'Hammerfest Habitat', 'Svalbard Two', 'Valhalla Annex', 'Longship Landing', 'Midnight Sun Colony'],
    portrait: { hue: 222, motif: 'ship', crest: 'anchor' },
    gender: 'f', alt: { name: 'Magnus Haugen', title: 'Harbor Chief of the Fjord Ark', gender: 'm', description: 'The longships are gone. The skiff docks are fully staffed and a bit proud.' },
    effects: {
      tileYield(_ctx, a) {
        const t = a.tile.terrain;
        if (t === 'coast' || t === 'ocean' || t === 'lake') a.yields.gold += 1;
        else if (t === 'tundra' || t === 'snow') a.yields.food += 1;
      },
      onEvent(ctx, ev) { if (ev.type === 'unitDied' && ev.killer === ctx.player.id && ev.player !== ctx.player.id) addGold(ctx.state, ctx.player.id, 10, 'Kill reward', ctx.emit); },
    },
  },
  finland: {
    id: 'finland', name: 'Aino Virtanen', title: 'General of the Sisu Ark', civName: 'Sisu Ark', adjective: 'Finnish',
    country: 'Finland', code: 'FIN', flagColors: ['#ffffff', '#003580'], colors: { primary: '#86c5ea', secondary: '#ffffff' },
    description: 'Two meters of frost, no small talk, and a sauna made for space.',
    bonus: 'Units at half HP or less fight with **+40%** strength (Sisu). Rock Spires yield **+1** {prod}. Frost Plains and Ice Cap tiles yield **+1** {sci}.',
    startDoctrine: 'winter_sniper', uniqueUnit: 'sisu_sharpshooter', uniqueBuilding: 'sauna', aiPersonality: 'builder',
    cityNames: ['Uusi Helsinki', 'Espoo Escarpment', 'Tampere Tholus', 'Oulu Outpost', 'Rovaniemi Redux', 'Turku Terminus', 'Lahti Lander', 'Kuopio Crater', 'Jyväskylä Junction', 'Vaasa Vault', 'Sauna Station Nine', 'Nokia Nest', 'Lapland Airlock', 'Silent Crater', 'Sisu Summit'],
    portrait: { hue: 178, motif: 'mountain', crest: 'shield' },
    gender: 'f', alt: { name: 'Eino Korhonen', title: 'Colonel of the Sisu Ark', gender: 'm', description: 'Two meters of frost, no small talk, and a sauna made for space.' },
    effects: {
      combat(_ctx, a) { const u = ownUnit(a); if (u && u.hp <= 50) ownMod(a, 'Sisu', 40); },
      tileYield(_ctx, a) {
        if (a.tile.feature === 'forest') a.yields.prod += 1;
        if (a.tile.terrain === 'tundra' || a.tile.terrain === 'snow') a.yields.sci += 1;
      },
    },
  },
  poland: {
    id: 'poland', name: 'Katarzyna Nowak', title: 'Marshal of the Feniks Ark', civName: 'Feniks Ark', adjective: 'Polish',
    country: 'Poland', code: 'POL', flagColors: ['#ffffff', '#dc143c'], colors: { primary: '#d94f7a', secondary: '#f4efe6' },
    description: 'The Ark was shaken before. It stood up, drank tea, and wrote a long complaint.',
    bonus: 'Every chapter pays **1** {influence} for each 2 Colonies (max **4**). Mounted units attack with **+30%** strength. When you lose a defender in a Colony, gain **+1** Pod.',
    startDoctrine: 'pierogi_chef', uniqueUnit: 'winged_hussar', uniqueBuilding: 'wawel_bastion', aiPersonality: 'warmonger',
    cityNames: ['Nowa Warszawa', 'Kraków Krater', 'Gdańsk Gantry', 'Wrocław Warren', 'Poznań Pad', 'Łódź Lander', 'Lublin Dome', 'Katowice Works', 'Szczecin Station', 'Białystok Base', 'Toruń Terminus', 'Zakopane Peaks', 'Pierogi Point', 'Wawel on Mars', 'Solidarity Square'],
    portrait: { hue: 340, motif: 'feather', crest: 'horse' },
    gender: 'f', alt: { name: 'Tomasz Kowalczyk', title: 'Marshal of the Feniks Ark', gender: 'm', description: 'The Ark was shaken before. It stood up, drank tea, and wrote a long complaint.' },
    effects: {
      influenceIncome(ctx, a) {
        if (!ctx.player.isHuman) return;
        const n = Object.values(ctx.state.cities).filter((city) => city.owner === ctx.player.id).length;
        const amount = Math.min(4, Math.floor(n / 2));
        if (amount > 0) a.lines.push({ label: 'Solidarity', amount });
      },
      combat(_ctx, a) { if (a.side === 'attack' && a.attacker && unitClassOf(a.attacker.type) === 'mounted') ownMod(a, 'Winged Charge', 30); },
      onEvent(ctx, ev) { if (ev.type === 'combat' && ev.defender.cityId != null && ev.defender.player === ctx.player.id && ev.defenderKilled) changeCryo(ctx.state, ctx.player.id, 1, ctx.emit); },
    },
  },
  czechia: {
    id: 'czechia', name: 'Marta Novotná', title: 'Clock Master of the Orloj Ark', civName: 'Orloj Ark', adjective: 'Czech',
    country: 'Czechia', code: 'CZE', flagColors: ['#ffffff', '#d7141a', '#11457e'], colors: { primary: '#5b3db0', secondary: '#d9d2f0' },
    description: 'The famous clock arrived safe. It says the 24-hour-39-minute day is Mars’s mistake.',
    bonus: 'When one of your units upgrades, it heals fully and gets **10** XP. At the end of each chapter, **+1** {splendor} for every **6** Research you know. Colonies with a Workshop make **+15%** {prod}.',
    startDoctrine: 'brewmaster', uniqueUnit: 'hussite_wagon_crew', uniqueBuilding: 'orloj_tower', aiPersonality: 'builder',
    cityNames: ['Nová Praha', 'Brno Basin', 'Ostrava Works', 'Plzeň Pale Lager', 'Olomouc Orbit', 'Liberec Lander', 'Karlovy Vary Spa', 'Český Crater', 'Kutná Hora Cache', 'Hradec Habitat', 'Pardubice Pad', 'Defenestration Dome', 'Orloj Square', 'Bohemian Basin', 'Golem Gate'],
    portrait: { hue: 258, motif: 'hourglass', crest: 'lion' },
    gender: 'f', alt: { name: 'Václav Horák', title: 'Clockmaker of the Orloj Ark', gender: 'm', description: 'The famous clock arrived safe. It says the 24-hour-39-minute day is Mars’s mistake.' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'unitUpgraded') return;
        const unit = ctx.state.units[ev.unitId];
        if (!unit || unit.owner !== ctx.player.id) return;
        unit.hp = 100;
        grantXp(unit, 10, ctx.emit);
      },
      chronicle(ctx, c) { const n = Math.floor(ctx.player.techs.length / 6); if (n > 0) c.addSplendor(n); },
      cityYield(_ctx, a) { if (cityHas(a.city, 'workshop')) a.pct.prod += 15; },
    },
  },
  romania: {
    id: 'romania', name: 'Ileana Munteanu', title: 'Lord of the Carpathian Ark', civName: 'Carpathian Ark', adjective: 'Romanian',
    country: 'Romania', code: 'ROU', flagColors: ['#002b7f', '#fcd116', '#ce1126'], colors: { primary: '#7b1e3a', secondary: '#e0b030' }, cryo: 4,
    description: 'A castle, a mountain, and a freezer full of coffin-shaped pods.',
    bonus: 'Start with **+1** Pod. Each Land Colony has a **1-in-3** chance to return its Pod. Lava Tubes yield **+1** {prod}. Units on Hills and Mountains fight with **+30%** strength.',
    startDoctrine: 'night_count', uniqueUnit: 'haiduk_raider', uniqueBuilding: 'bran_keep', aiPersonality: 'expansionist',
    cityNames: ['Noua București', 'Cluj Crater', 'Brașov Basin', 'Sibiu Station', 'Timișoara Terminal', 'Iași Inlet', 'Sighișoara Keep', 'Bran Dome', 'Peleș Pressurized', 'Ploiești Pumpjack', 'Transfăgărășan Pass', 'Carpathian Cache', 'Garlic Airlock', 'Poienari Spire', 'Midnight Pod Bay'],
    portrait: { hue: 352, motif: 'castle', crest: 'tower' },
    gender: 'f', alt: { name: 'Radu Vasilescu', title: 'Lord of the Carpathian Ark', gender: 'm', description: 'A castle, a mountain, and a freezer full of coffin-shaped pods.' },
    effects: {
      onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id && chance(ctx.state.rng, 1 / 3)) changeCryo(ctx.state, ctx.player.id, 1, ctx.emit); },
      tileYield(_ctx, a) { if (a.tile.feature === 'jungle') a.yields.prod += 1; },
      combat(_ctx, a) { const e = ownTile(a).elevation; if (ownUnit(a) && (e === 'hills' || e === 'mountain')) ownMod(a, 'Carpathian Redoubt', 30); },
    },
  },
  turkey: {
    id: 'turkey', name: 'Deniz Aksoy', title: 'Crossroads Ark Bazaar Keeper', civName: 'Crossroads Ark', adjective: 'Turkish',
    country: 'Türkiye', code: 'TUR', flagColors: ['#e30a17', '#ffffff'], colors: { primary: '#e6392f', secondary: '#f5f0e6' },
    description: 'An Ark that is mostly a bazaar with an airlock, a big kettle, and one mystery cat.',
    bonus: 'Road tiles yield **+1** {gold}. Melee and siege units attack with **+15%** strength. Clearing a Raider Camp pays **50** {gold}.',
    startDoctrine: 'tea_seller', uniqueUnit: 'janissary_bombardier', uniqueBuilding: 'covered_bazaar', aiPersonality: 'warmonger',
    cityNames: ['Yeni İstanbul', 'Ankara Airlock', 'İzmir Inlet', 'Bursa Basin', 'Antalya Annex', 'Konya Crater', 'Trabzon Terminal', 'Gaziantep Gantry', 'Kayseri Keep', 'Çanakkale Cut', 'Cappadocia Cavern', 'Pamukkale Terraces', 'Bazaar Gate', 'Çay Corner', 'Cats of Mars'],
    portrait: { hue: 6, motif: 'coin', crest: 'moon' },
    gender: 'm', alt: { name: 'Zeynep Yıldız', title: 'Crossroads Ark Bazaar Keeper', gender: 'f', description: 'An Ark that is mostly a bazaar with an airlock, a big kettle, and one mystery cat.' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.road) a.yields.gold += 1; },
      combat(_ctx, a) {
        if (a.side !== 'attack' || !a.attacker) return;
        const cls = unitClassOf(a.attacker.type);
        if (cls === 'melee' || cls === 'siege') ownMod(a, 'Assault Drill', 15);
      },
      onEvent(ctx, ev) { if (ev.type === 'campCleared' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 50, 'Raider Camp reward', ctx.emit); },
    },
  },
  kazakhstan: {
    id: 'kazakhstan', name: 'Aigerim Sarsenova', title: 'Launch Director of Baikonur Ark', civName: 'Baikonur Ark', adjective: 'Kazakh',
    country: 'Kazakhstan', code: 'KAZ', flagColors: ['#00afca', '#fec50c'], colors: { primary: '#2fc4b2', secondary: '#f0b92f' },
    description: 'The launch site is rented, the steppe is endless, and the horses have opinions.',
    bonus: 'A Colony founded by a Land Colony starts with **+1** colonist. Plains yield **+1** {prod}. Mounted units get **+1** Move and cost **25%** less {prod}.',
    startDoctrine: 'launch_director', uniqueUnit: 'steppe_batyr', uniqueBuilding: 'cosmodrome_gantry', aiPersonality: 'expansionist',
    cityNames: ['New Astana', 'Almaty Apex', 'Baikonur Prime', 'Shymkent Station', 'Karaganda Coalface', 'Aktau Shallows', 'Semey Steppe', 'Turkistan Terminal', 'Pavlodar Pad', 'Aral Basin', 'Kokshetau Keep', 'Charyn Canyon', 'Kumis Corner', 'Steppe Horizon', 'Yurt Dome One'],
    portrait: { hue: 156, motif: 'horse', crest: 'sun' },
    gender: 'f', alt: { name: 'Nurlan Zhaksybekov', title: 'Launch Director of Baikonur Ark', gender: 'm', description: 'The launch site is rented, the steppe is endless, and the horses have opinions.' },
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
    id: 'laureate', name: 'The Prize Winner', rarity: 'uncommon', cost: 6, noShop: true, nation: 'sweden',
    description: 'At the end of each chapter, **+1** {splendor} for each Research you finished that chapter (max **3**).',
    flavor: '“I thank the committee, the reactor, and the last biscuit.”', tags: ['nation', 'research', 'splendor'], icon: 'laurel', art: { hue: 52, motif: 'laurel' },
    effects: { chronicle(_ctx, c) { const n = Math.min(3, c.stats.techs); if (n > 0) c.addSplendor(n); } },
  },
  {
    id: 'fjord_pilot', name: 'The Fjord Pilot', rarity: 'uncommon', cost: 6, noShop: true, nation: 'norway',
    description: 'At the end of each chapter, **+1** {splendor} for each coastal Colony (max **4**).',
    flavor: '“Narrow, deep, and hard to park. Like a good argument.”', tags: ['nation', 'coastal', 'splendor'], icon: 'ship', art: { hue: 205, motif: 'anchor' },
    effects: { chronicle(ctx, c) { const n = Math.min(4, coastalCount(ctx.state, c)); if (n > 0) c.addSplendor(n); } },
  },
  {
    id: 'winter_sniper', name: 'The Winter Sniper', rarity: 'uncommon', cost: 6, noShop: true, nation: 'finland',
    description: 'Your ranged units attack with **+25%** strength.',
    flavor: '“I am not hiding. The snow is just very friendly.”', tags: ['nation', 'combat', 'ranged'], icon: 'eye', art: { hue: 190, motif: 'eye' },
    effects: { combat(_ctx, a) { if (a.side === 'attack' && a.ranged && a.attacker) ownMod(a, 'Winter Sniper', 25); } },
  },
  {
    id: 'pierogi_chef', name: 'The Pierogi Chef', rarity: 'uncommon', cost: 6, noShop: true, nation: 'poland',
    description: 'Each time one of your Colonies grows, gain **4** {gold}.',
    flavor: 'The filling is a secret. The dumplings are a national treasure.', tags: ['nation', 'growth', 'credits'], icon: 'wheat', art: { hue: 36, motif: 'wheat' },
    effects: { onEvent(ctx, ev) { if (ev.type === 'cityGrew' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 4, 'Pierogi sales', ctx.emit); } },
  },
  {
    id: 'brewmaster', name: 'The Beer Maker', rarity: 'uncommon', cost: 6, noShop: true, nation: 'czechia',
    description: 'At the end of each chapter, **+1** {splendor} for each 3 colonists grown that chapter (max **3**).',
    flavor: '“Beer is almost water. That is my legal position.”', tags: ['nation', 'growth', 'splendor'], icon: 'chalice', art: { hue: 40, motif: 'chalice' },
    effects: { chronicle(_ctx, c) { const n = Math.min(3, Math.floor(c.stats.popGrown / 3)); if (n > 0) c.addSplendor(n); } },
  },
  {
    id: 'night_count', name: 'The Count', rarity: 'uncommon', cost: 6, noShop: true, nation: 'romania',
    description: 'At the end of each chapter, **+1** {splendor} for each enemy unit destroyed that chapter (max **4**).',
    flavor: '“The sun is a scheduling problem. I work around it.”', tags: ['nation', 'combat', 'splendor'], icon: 'moon', art: { hue: 350, motif: 'moon' },
    effects: { chronicle(_ctx, c) { const n = Math.min(4, c.stats.kills); if (n > 0) c.addSplendor(n); } },
  },
  {
    id: 'tea_seller', name: 'The Tea Seller', rarity: 'uncommon', cost: 6, noShop: true, nation: 'turkey',
    description: 'At the start of each turn, gain **1** {gold} for each Colony (max **10**).',
    flavor: '“Sit, sit. The talk can wait until the second glass.”', tags: ['nation', 'credits', 'colonies'], icon: 'chalice', art: { hue: 8, motif: 'chalice' },
    effects: {
      turnStart(ctx) {
        const n = Math.min(10, Object.values(ctx.state.cities).filter((city) => city.owner === ctx.player.id).length);
        if (n > 0) addGold(ctx.state, ctx.player.id, n, 'Tea money', ctx.emit);
      },
    },
  },
  {
    id: 'launch_director', name: 'The Launch Director', rarity: 'uncommon', cost: 6, noShop: true, nation: 'kazakhstan',
    description: 'Every Land Colony pays **30** {gold}.',
    flavor: '“T-minus ten. Please move the horses.”', tags: ['nation', 'drop', 'credits'], icon: 'tower', art: { hue: 170, motif: 'tower' },
    effects: { onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 30, 'Launch fees', ctx.emit); } },
  },
];

registerCrew(CREW_NORTHEAST);
