// OWNER: Nations (slice westeurope). Germany, the UK, Italy, Spain, the Netherlands, Belgium, Ireland, Portugal,
// Austria and Denmark. Leader effects apply to every player led by that nation (AIs included): hooks always use
// ctx.player, and run-level perks (council, Scrip) never touch the run unless ctx.player.isHuman.
import type { DoctrineDef, LeaderDef } from '../../sim/defs';
import type { Tile } from '../../sim/types';
import { citiesOf } from '../../sim/cities';
import { addGold } from '../../sim/economy';
import { chance } from '../../sim/rng';
import { REROLL_BASE, REROLL_STEP } from '../../sim/roguelite';
import { registerCrew } from '../doctrineRegistry';
import { isCoastalCity, luxuriesOwned } from '../doctrines';
import { RESOURCES } from '../resources';
import { UNITS } from '../units';

const isWaterTile = (t: Tile): boolean => t.terrain === 'coast' || t.terrain === 'ocean' || t.terrain === 'lake';
/** Foundry-line buildings (Alloy Foundry, Fabricator, Foundry, Fusion Plant and the German Foundry). */
const INDUSTRIAL: Record<string, true> = { forge: true, workshop: true, factory: true, powerplant: true, mittelstand_works: true };
/** Heritage buildings Italy builds on the cheap. */
const CULTURE_BUILDINGS: Record<string, true> = {
  monument: true, shrine: true, temple: true, amphitheater: true, museum: true, cathedral: true, broadcast_tower: true, stadium: true, grand_galleria: true,
};
/** Skiff Dock / Beacon Tower line Portugal builds on the cheap. */
const COASTAL_BUILDINGS: Record<string, true> = { lighthouse: true, harbor: true, sagres_beacon: true, royal_dockyard: true };

const isIn = (set: Record<string, true>, id: string): boolean => Object.hasOwn(set, id);

export const LEADERS_WESTEUROPE: Record<string, LeaderDef> = {
  germany: {
    id: 'germany', name: 'Dr. Katharina Weidner', title: 'Ordnung Ark Chief Engineer', civName: 'Arche Ordnung', adjective: 'German',
    country: 'Germany', code: 'DEU', flagColors: ['#000000', '#dd0000', '#ffce00'], colors: { primary: '#4b5560', secondary: '#e3b341' },
    description: 'Every airlock has a certificate. Every certificate has an inspector.',
    bonus: 'Metal Foundries, Workshops, Factories and Fusion Plants cost **25%** less {prod}. Each one gives its Colony **+10%** {prod}. Every building you finish pays **4** {gold}.',
    startDoctrine: 'safety_inspector', uniqueUnit: 'eisenfaust_driver', uniqueBuilding: 'mittelstand_works', aiPersonality: 'builder',
    cityNames: ['Neu-Berlin', 'Bavaria Basin', 'Hamburg-on-Dust', 'Köln Crater', 'Frankfurt Airlock', 'Stuttgart Works', 'Düsseldorf Dome', 'Leipzig Lowlands', 'Dresden Redux', 'Nürnberg Station', 'Bremen Base', 'Hannover Habitat', 'Autobahn Junction', 'Zweites Frühstück', 'Genehmigung Pending'],
    portrait: { hue: 215, motif: 'gear', crest: 'eagle' },
    gender: 'f', alt: { name: 'Dr. Lukas Brenner', title: 'Chief Safety Engineer', gender: 'm', description: 'Every airlock has a certificate. Every certificate has an inspector.' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && isIn(INDUSTRIAL, a.item.id)) a.cost *= 0.75; },
      cityYield(_ctx, a) { const n = a.city.buildings.filter(b => isIn(INDUSTRIAL, b)).length; if (n) a.pct.prod += 10 * n; },
      onEvent(ctx, ev) { if (ev.type === 'buildingBuilt' && ev.player === ctx.player.id && ev.building !== 'palace') addGold(ctx.state, ctx.player.id, 4, 'Building subsidy', ctx.emit); },
    },
  },
  uk: {
    id: 'uk', name: 'Dame Imogen Hartley-Pryce', title: 'Admiral of the Albion Ark', civName: 'Albion Ark', adjective: 'British',
    country: 'United Kingdom', code: 'GBR', flagColors: ['#012169', '#ffffff', '#c8102e'], colors: { primary: '#b0293b', secondary: '#26324f' },
    description: 'Dust storms hit the Ark for a week. The Admiral calls it “a bit windy.”',
    bonus: 'Coastal Colonies yield **+20%** {gold}. Every chapter pays **+1** {influence} for each 3 Colonies. Your units defending on your own land gain **+15%** strength.',
    startDoctrine: 'tea_lady', uniqueUnit: 'longbow_coilgunner', uniqueBuilding: 'royal_dockyard', aiPersonality: 'expansionist',
    cityNames: ['New London', 'Dover Dome', 'Manchester Mars', 'Birmingham Basin', 'Leeds Landing', 'Brighton Rock(et)', 'Edinburgh Crater', 'Cardiff Station', 'York Dome', 'Little Britain', 'Piccadilly Airlock', 'Queue Hollow', 'Nether Wallop', 'Upper Dustwick', 'Stiff Upper Lip'],
    portrait: { hue: 350, motif: 'ship', crest: 'crown' },
    gender: 'f', alt: { name: 'Sir Percival Ashdown', title: 'Admiral of the Albion Ark', gender: 'm', description: 'Dust storms hit the Ark for a week. The Admiral calls it “a bit windy.”' },
    effects: {
      cityYield(ctx, a) { if (isCoastalCity(ctx.state, a.city)) a.pct.gold += 20; },
      influenceIncome(ctx, a) { a.lines.push({ label: 'Colony income', amount: Math.floor(citiesOf(ctx.state, ctx.player.id).length / 3) }); },
      combat(ctx, a) { if (a.side === 'defense' && a.defender?.owner === ctx.player.id && a.tile.owner === ctx.player.id) a.defenseMods.push({ label: 'Home Defense', pct: 15 }); },
    },
  },
  italy: {
    id: 'italy', name: 'Dr. Giulia Ferrante', title: 'Curator of the Rinascimento Ark', civName: 'Arca Rinascimento', adjective: 'Italian',
    country: 'Italy', code: 'ITA', flagColors: ['#009246', '#ffffff', '#ce2b37'], colors: { primary: '#a63d78', secondary: '#e8e1cf' },
    description: 'The scaffolding came aboard first. The statues still wait for a permit.',
    bonus: 'Culture buildings (Crew Memorial, Earth Shrine, Memorial Chapel, Holo-Theater, Holo-Archive, Cathedral of Earth, Broadcast Tower, Arena, Grand Galleria) cost **25%** less {prod}. Colonies with a Wonder yield **+3** {cul}. Every chapter pays **+1** {influence} for each Wonder (max 3).',
    startDoctrine: 'barista', uniqueUnit: 'codex_mortar', uniqueBuilding: 'grand_galleria', aiPersonality: 'builder',
    cityNames: ['Nuova Roma Rossa', 'Firenze Crater', 'Venezia Senz’Acqua', 'Milano Dome', 'Napoli Station', 'Torino Two', 'Bologna Basin', 'Pisa (Leaning, Slightly)', 'Siena Habitat', 'Genova Airlock', 'Palermo Marte', 'Verona Balcony', 'Pompeii Redux', 'Colosseo Dome', 'Ponte Vecchio Bis'],
    portrait: { hue: 320, motif: 'temple', crest: 'tower' },
    gender: 'f', alt: { name: 'Prof. Matteo Lombardi', title: 'Head of Restoration', gender: 'm', description: 'The scaffolding came aboard first. The statues still wait for a permit.' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && isIn(CULTURE_BUILDINGS, a.item.id)) a.cost *= 0.75; },
      cityYield(_ctx, a) { if (a.city.wonders.length) a.yields.cul += 3; },
      influenceIncome(ctx, a) {
        const wonders = citiesOf(ctx.state, ctx.player.id).reduce((n, city) => n + city.wonders.length, 0);
        a.lines.push({ label: 'Wonder income', amount: Math.min(3, wonders) });
      },
    },
  },
  spain: {
    id: 'spain', name: 'Capitana Lucía Navarro', title: 'Captain of the Sun Ark', civName: 'Arca del Sol', adjective: 'Spanish',
    country: 'Spain', code: 'ESP', flagColors: ['#aa151b', '#f1bf00'], colors: { primary: '#f0a81a', secondary: '#a31f2b' },
    description: 'The Ark landed at noon, found no shade, and took a long break.',
    bonus: 'All your units see **+1** hex. Scout Rovers move **+1**. Dunes yield **+1** {food} and **+1** {gold}. Crash Sites pay **20** {gold}. Each Landmark you find pays **30** {gold}.',
    startDoctrine: 'cartografo', uniqueUnit: 'matador_hover_bike', uniqueBuilding: 'plaza_mayor', aiPersonality: 'warmonger',
    cityNames: ['Nueva Madrid', 'Barcelona Crater', 'Sevilla Station', 'Valencia Dome', 'Bilbao Base', 'Granada Habitat', 'Toledo Airlock', 'Salamanca Heights', 'Córdoba Camp', 'Santiago de la Duna', 'Málaga Mons', 'Zaragoza Two', 'Ibiza After Dark', 'La Siesta', 'Mañana Colony'],
    portrait: { hue: 38, motif: 'sun', crest: 'castle' },
    gender: 'f', alt: { name: 'Capitán Mateo Ibarra', title: 'Captain of the Sun Ark', gender: 'm', description: 'The Ark landed at noon, found no shade, and took a long break.' },
    effects: {
      unitVision(_ctx, a) { a.value += 1; },
      unitMoves(_ctx, a) { if (UNITS[a.unit.type]?.class === 'recon') a.value += 1; },
      tileYield(_ctx, a) { if (a.tile.terrain === 'desert') { a.yields.food += 1; a.yields.gold += 1; } },
      onEvent(ctx, ev) {
        if (ev.type === 'ruinExplored' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 20, 'Crash Site reward', ctx.emit);
        if (ev.type === 'naturalWonderFound' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 30, 'Landmark reward', ctx.emit);
      },
    },
  },
  netherlands: {
    id: 'netherlands', name: 'Dr. Fenna de Vries', title: 'Water Chief of the Polder Ark', civName: 'Polder Ark', adjective: 'Dutch',
    country: 'Netherlands', code: 'NLD', flagColors: ['#ae1c28', '#ffffff', '#21468b'], colors: { primary: '#f26b21', secondary: '#1f3f7a' },
    description: 'They saw the Dust Sea and said, “Give us a few decades.”',
    bonus: 'You can found Colonies **1** hex closer together. Shallows yield **+1** {food} and **+1** {prod}. The {influence} interest cap is **3** higher.',
    startDoctrine: 'pump_engineer', uniqueUnit: 'dijkwacht_squad', uniqueBuilding: 'polder_pump', aiPersonality: 'expansionist',
    cityNames: ['Nieuw-Amsterdam', 'Rotterdam Rift', 'Utrecht Underdome', 'Delft Dome', 'Haarlem Habitat', 'Eindhoven Lab', 'Groningen Ground', 'Maastricht Mons', 'Leiden Landing', 'Zuiderzee Station', 'Tulip Hollow', 'Windmill Heights', 'Bike Lane Basin', 'Below Mars Level', 'Gouda Gate'],
    portrait: { hue: 24, motif: 'river', crest: 'wheat' },
    gender: 'f', alt: { name: 'Dr. Joost Hendriks', title: 'Water Chief of the Polder Ark', gender: 'm', description: 'They saw the Dust Sea and said, “Give us a few decades.”' },
    effects: {
      canFoundCity(_ctx, a) { a.minDistance = Math.max(2, a.minDistance - 1); },
      tileYield(_ctx, a) { if (a.tile.terrain === 'coast') { a.yields.food += 1; a.yields.prod += 1; } },
      interestCap(_ctx, a) { a.value += 3; },
    },
  },
  belgium: {
    id: 'belgium', name: 'Commissaire Hélène Van den Berg', title: 'Commissioner of the Atomium Ark', civName: 'Atomium Ark', adjective: 'Belgian',
    country: 'Belgium', code: 'BEL', flagColors: ['#000000', '#fae042', '#ed2939'], colors: { primary: '#a65d3f', secondary: '#2a1d1a' },
    description: 'The Ark carries three languages, four governments and one chocolate reserve.',
    bonus: 'Luxury resource tiles yield **+1** {gold} and **+1** {cul}. The first Shop reroll each visit is free. Later rerolls cost **1** less. Every chapter pays **+1** {influence}.',
    startDoctrine: 'chocolatier', uniqueUnit: 'ardennes_ranger', uniqueBuilding: 'chocolaterie', aiPersonality: 'scientist',
    cityNames: ['Nouvelle Bruxelles', 'Antwerp Airlock', 'Gent Station', 'Brugge Dome', 'Liège Crater', 'Namur Habitat', 'Leuven Lab', 'Mons Base', 'Ostend Dust-Shore', 'Waterloo, Mars', 'Manneken Pis Fountain', 'Atomium Annex', 'Mechelen Two', 'Charleroi Works', 'Subcommittee Heights'],
    portrait: { hue: 18, motif: 'chalice', crest: 'lion' },
    gender: 'f', alt: { name: 'Commissaire Luc Vandenbroucke', title: 'Commissioner of the Atomium Ark', gender: 'm', description: 'The Ark carries three languages, four governments and one chocolate reserve.' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.resource && RESOURCES[a.tile.resource]?.kind === 'luxury') { a.yields.gold += 1; a.yields.cul += 1; } },
      council(ctx, a) {
        if (!ctx.player.isHuman) return;
        a.council.rerollCost = a.council.rerolls === 0 ? 0 : REROLL_BASE + REROLL_STEP * (a.council.rerolls - 1);
      },
      influenceIncome(_ctx, a) { a.lines.push({ label: 'Office income', amount: 1 }); },
    },
  },
  ireland: {
    id: 'ireland', name: 'Siobhán Gallagher', title: 'Captain of the Emerald Ark', civName: 'Emerald Ark', adjective: 'Irish',
    country: 'Ireland', code: 'IRL', flagColors: ['#169b62', '#ffffff', '#ff883e'], colors: { primary: '#27b36a', secondary: '#f2a541' },
    description: 'The forecast was one word: “soft.” It was wrong.',
    bonus: 'Each Dust Storm hit on your units or Colonies has a **50%** chance to do no damage. Rock Spires yield **+1** {food} and **+1** {cul}. Every Land Colony pays **12** {gold}.',
    startDoctrine: 'publican', uniqueUnit: 'sliotar_slinger', uniqueBuilding: 'last_orders_pub', aiPersonality: 'expansionist',
    cityNames: ['New Dublin', 'Cork Crater', 'Galway Dry Bay', 'Limerick Limit', 'Kilkenny Dome', 'Waterford Station', 'Sligo Settlement', 'Dingle Dust', 'Tralee Habitat', 'Athlone Airlock', 'Killarney Crater', 'Drogheda Dome', 'Soft Day Basin', 'The Craic Pit', 'Last Orders, Mars'],
    portrait: { hue: 140, motif: 'lyre', crest: 'tree' },
    gender: 'f', alt: { name: 'Cormac Ó Briain', title: 'Captain of the Emerald Ark', gender: 'm', description: 'The forecast was one word: “soft.” It was wrong.' },
    effects: {
      storm(ctx, a) { if (a.victim === ctx.player.id && a.damage > 0 && chance(ctx.state.rng, 0.5)) a.damage = 0; },
      tileYield(_ctx, a) { if (a.tile.feature === 'forest') { a.yields.food += 1; a.yields.cul += 1; } },
      onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 12, 'Money from home', ctx.emit); },
    },
  },
  portugal: {
    id: 'portugal', name: 'Inês Carvalho', title: 'Navigator of the Navegante Ark', civName: 'Arca Navegante', adjective: 'Portuguese',
    country: 'Portugal', code: 'PRT', flagColors: ['#006600', '#ff0000', '#ffcc00'], colors: { primary: '#e9967a', secondary: '#2a6f4e' },
    description: 'The Ark is quietly homesick. Portuguese has a special word for that.',
    bonus: 'Units on Shallows, Dust Sea or Salt Lake tiles get **+2** moves. Water tiles yield **+1** {sci}. Beacon Towers and Skiff Docks cost **30%** less {prod}.',
    startDoctrine: 'fadista', uniqueUnit: 'navegador_rover', uniqueBuilding: 'sagres_beacon', aiPersonality: 'expansionist',
    cityNames: ['Nova Lisboa', 'Porto Poente', 'Sagres Dome', 'Faro Station', 'Coimbra Crater', 'Braga Base', 'Évora Habitat', 'Cascais Airlock', 'Setúbal Skiffs', 'Aveiro Basin', 'Madeira Mons', 'Azores Array', 'Belém Beacon', 'Saudade Bay', 'Nata Plaza'],
    portrait: { hue: 12, motif: 'compass', crest: 'anchor' },
    gender: 'f', alt: { name: 'Tiago Mendes', title: 'Navigator of the Navegante Ark', gender: 'm', description: 'The Ark is quietly homesick. Portuguese has a special word for that.' },
    effects: {
      unitMoves(ctx, a) { const tile = ctx.state.map.tiles[a.unit.tile]; if (tile && isWaterTile(tile)) a.value += 2; },
      tileYield(_ctx, a) { if (isWaterTile(a.tile)) a.yields.sci += 1; },
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && isIn(COASTAL_BUILDINGS, a.item.id)) a.cost *= 0.7; },
    },
  },
  austria: {
    id: 'austria', name: 'Dr. Theresia Gruber', title: 'Director of the Edelweiss Ark', civName: 'Edelweiss Ark', adjective: 'Austrian',
    country: 'Austria', code: 'AUT', flagColors: ['#ed2939', '#ffffff'], colors: { primary: '#7b6fd6', secondary: '#f1e9d2' },
    description: 'The Ark has a concert hall, a café and a very small airlock.',
    bonus: 'Until Turn **40**, your units and Colonies defend with **+25%** strength. Hills yield **+1** {cul}. Colonies with a Holo-Theater or Memorial Chapel yield **+20%** {cul}.',
    startDoctrine: 'kapellmeister', uniqueUnit: 'edelweiss_jager', uniqueBuilding: 'kaffeehaus', aiPersonality: 'scientist',
    cityNames: ['Neu-Wien', 'Salzburg Station', 'Graz Crater', 'Linz Lab', 'Innsbruck Heights', 'Klagenfurt Basin', 'Hallstatt Habitat', 'Schönbrunn Dome', 'Sachertorte Station', 'Eisenstadt Airlock', 'Bregenz Base', 'Melk Mons', 'Waltz Landing', 'Ringstraße Loop', 'Second Movement'],
    portrait: { hue: 250, motif: 'mountain', crest: 'eagle' },
    gender: 'f', alt: { name: 'Dr. Maximilian Eder', title: 'Director of the Edelweiss Ark', gender: 'm', description: 'The Ark has a concert hall, a café and a very small airlock.' },
    effects: {
      combat(ctx, a) { if (a.side === 'defense' && a.defenderOwner === ctx.player.id && ctx.state.turn < 40) a.defenseMods.push({ label: 'Strong Defense', pct: 25 }); },
      tileYield(_ctx, a) { if (a.tile.elevation === 'hills') a.yields.cul += 1; },
      cityYield(_ctx, a) { if (a.city.buildings.some(b => b === 'amphitheater' || b === 'temple')) a.pct.cul += 20; },
    },
  },
  denmark: {
    id: 'denmark', name: 'Kaptajn Freja Madsen', title: 'Leader of the Hygge Ark', civName: 'Hygge Ark', adjective: 'Danish',
    country: 'Denmark', code: 'DNK', flagColors: ['#c8102e', '#ffffff'], colors: { primary: '#a9d3e3', secondary: '#c8102e' },
    description: 'The Ark runs on wind and candles. Everyone feels cosy, even in a crisis.',
    bonus: 'Wind Farms cost **50%** less {prod} and yield **+2** {prod} more. **+6** {happy}. Your units attack with **+15%** strength.',
    startDoctrine: 'windsmith', uniqueUnit: 'viking_raider', uniqueBuilding: 'hygge_lounge', aiPersonality: 'warmonger',
    cityNames: ['Nye København', 'Aarhus Airlock', 'Odense Outpost', 'Aalborg Array', 'Roskilde Rift', 'Esbjerg Wind', 'Kronborg Keep', 'Tivoli Dome', 'Brick Landing', 'Hygge Hollow', 'Skagen Shelf', 'Ribe Ridge', 'Bornholm Basin', 'Candlelight Crater', 'Smørrebrød Station'],
    portrait: { hue: 195, motif: 'tower', crest: 'serpent' },
    gender: 'f', alt: { name: 'Kaptajn Søren Lindholm', title: 'Leader of the Hygge Ark', gender: 'm', description: 'The Ark runs on wind and candles. Everyone feels cosy, even in a crisis.' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && a.item.id === 'wind_farm') a.cost *= 0.5; },
      cityYield(_ctx, a) { if (a.city.buildings.includes('wind_farm')) a.yields.prod += 2; },
      happiness(_ctx, a) { a.value += 6; },
      combat(ctx, a) { if (a.side === 'attack' && a.attacker?.owner === ctx.player.id) a.attackMods.push({ label: 'Viking Raid', pct: 15 }); },
    },
  },
};

export const CREW_WESTEUROPE: DoctrineDef[] = [
  {
    id: 'safety_inspector', name: 'The Safety Inspector', rarity: 'uncommon', cost: 6, noShop: true, nation: 'germany',
    description: 'At the end of each chapter, **+1** {splendor} for every 4 buildings you own.',
    flavor: '“The airlock is certified. The certificate is certified. The air is not.”', tags: ['nation', 'buildings', 'splendor'], icon: 'eye', art: { hue: 215, motif: 'eye' },
    effects: {
      chronicle(ctx, c) {
        const n = citiesOf(ctx.state, ctx.player.id).reduce((sum, city) => sum + city.buildings.filter(b => b !== 'palace').length, 0);
        if (n >= 4) c.addSplendor(Math.floor(n / 4));
      },
    },
  },
  {
    id: 'tea_lady', name: 'The Tea Lady', rarity: 'uncommon', cost: 6, noShop: true, nation: 'uk',
    description: 'At the end of each chapter, **+1** {splendor}. If you lost no units that chapter, **+4** {splendor} instead.',
    flavor: '“It is only weather, dear. Biscuit?”', tags: ['nation', 'survival', 'splendor'], icon: 'happy', art: { hue: 350, motif: 'chalice' },
    effects: { chronicle(_ctx, c) { c.addSplendor(c.stats.unitsLost === 0 ? 4 : 1); } },
  },
  {
    id: 'barista', name: 'The Barista', rarity: 'uncommon', cost: 6, noShop: true, nation: 'italy',
    description: 'Each Holo-Theater, Holo-Archive and Grand Galleria gives its Colony **+2** {cul}.',
    flavor: '“The coffee is a crime, but a good one.”', tags: ['nation', 'culture', 'buildings'], icon: 'flask', art: { hue: 320, motif: 'flask' },
    effects: {
      cityYield(_ctx, a) {
        for (const b of a.city.buildings) if (b === 'amphitheater' || b === 'museum' || b === 'grand_galleria') a.yields.cul += 2;
      },
    },
  },
  {
    id: 'cartografo', name: 'El Cartógrafo', rarity: 'uncommon', cost: 6, noShop: true, nation: 'spain',
    description: 'At the end of each chapter, **+2** {splendor} for each Landmark you found.',
    flavor: '“The map and the land disagree. The map wins.”', tags: ['nation', 'landmarks', 'splendor'], icon: 'map', art: { hue: 38, motif: 'compass' },
    effects: {
      chronicle(ctx, c) {
        const n = ctx.state.naturalWondersSeen[ctx.player.id]?.length ?? 0;
        if (n) c.addSplendor(2 * n);
      },
    },
  },
  {
    id: 'pump_engineer', name: 'The Pump Engineer', rarity: 'uncommon', cost: 6, noShop: true, nation: 'netherlands',
    description: 'Your Colonies take **half** Dust Storm damage.',
    flavor: '“It is not a leak. It is a feature.”', tags: ['nation', 'storms', 'colonies'], icon: 'wave', art: { hue: 24, motif: 'wave' },
    effects: { storm(ctx, a) { if (a.city && a.victim === ctx.player.id) a.damage *= 0.5; } },
  },
  {
    id: 'chocolatier', name: 'The Chocolate Maker', rarity: 'uncommon', cost: 6, noShop: true, nation: 'belgium',
    description: 'At the end of each chapter, **+1** {splendor} for each luxury resource you own.',
    flavor: '“A strategic reserve. Also very good for the mood.”', tags: ['nation', 'luxury', 'splendor'], icon: 'coin', art: { hue: 18, motif: 'coin' },
    effects: {
      chronicle(ctx, c) {
        const n = luxuriesOwned(ctx.state, ctx.player.id);
        if (n) c.addSplendor(n);
      },
    },
  },
  {
    id: 'publican', name: 'The Pub Owner', rarity: 'uncommon', cost: 6, noShop: true, nation: 'ireland',
    description: 'Whenever one of your Colonies grows, gain **3** {gold}.',
    flavor: '“Last orders were an hour ago. They keep ordering.”', tags: ['nation', 'growth', 'credits'], icon: 'coin', art: { hue: 140, motif: 'flame' },
    effects: { onEvent(ctx, ev) { if (ev.type === 'cityGrew' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 3, 'Pub money', ctx.emit); } },
  },
  {
    id: 'fadista', name: 'The Fado Singer', rarity: 'uncommon', cost: 6, noShop: true, nation: 'portugal',
    description: 'Shallows and Dust Sea tiles worked by your Colonies yield **+1** {cul}.',
    flavor: '“There is a word for this feeling. It is also the song.”', tags: ['nation', 'culture', 'coast'], icon: 'feather', art: { hue: 12, motif: 'lyre' },
    effects: { tileYield(ctx, a) { if (a.city?.owner === ctx.player.id && (a.tile.terrain === 'coast' || a.tile.terrain === 'ocean')) a.yields.cul += 1; } },
  },
  {
    id: 'kapellmeister', name: 'The Music Director', rarity: 'uncommon', cost: 6, noShop: true, nation: 'austria',
    description: 'Dawn chapter targets are **12%** lower.',
    flavor: '“Not too fast. The committee likes it slow.”', tags: ['nation', 'target', 'score'], icon: 'scroll', art: { hue: 250, motif: 'scroll' },
    effects: { target(ctx, a) { if (ctx.state.run.chapter === 0) a.value *= 0.88; } },
  },
  {
    id: 'windsmith', name: 'The Wind Builder', rarity: 'uncommon', cost: 6, noShop: true, nation: 'denmark',
    description: 'At the end of each chapter, **+1** {splendor} for each Wind Farm you own.',
    flavor: '“It is not a storm. It is a free power plant.”', tags: ['nation', 'wind', 'splendor'], icon: 'bolt', art: { hue: 195, motif: 'gear' },
    effects: {
      chronicle(_ctx, c) {
        const n = c.cities.reduce((sum, city) => sum + city.buildings.filter(b => b === 'wind_farm').length, 0);
        if (n) c.addSplendor(n);
      },
    },
  },
];

registerCrew(CREW_WESTEUROPE);
