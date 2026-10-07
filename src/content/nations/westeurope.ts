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
    id: 'germany', name: 'Dr. Katharina Weidner', title: 'Chief Engineer of the Ordnung Ark', civName: 'Arche Ordnung', adjective: 'German',
    country: 'Germany', code: 'DEU', flagColors: ['#000000', '#dd0000', '#ffce00'], colors: { primary: '#4b5560', secondary: '#e3b341' },
    description: 'Every airlock has a certificate, every certificate has an inspector, and the inspector has already found the problem.',
    bonus: 'Alloy Foundries, Fabricators, Foundries and Fusion Plants cost **25%** less {prod} and each gives its Colony **+10%** {prod}. Every building you complete pays a **4** {gold} subsidy.',
    startDoctrine: 'safety_inspector', uniqueUnit: 'eisenfaust_driver', uniqueBuilding: 'mittelstand_works', aiPersonality: 'builder',
    cityNames: ['Neu-Berlin', 'Bavaria Basin', 'Hamburg-on-Dust', 'Köln Crater', 'Frankfurt Airlock', 'Stuttgart Works', 'Düsseldorf Dome', 'Leipzig Lowlands', 'Dresden Redux', 'Nürnberg Station', 'Bremen Base', 'Hannover Habitat', 'Autobahn Junction', 'Zweites Frühstück', 'Genehmigung Pending'],
    portrait: { hue: 215, motif: 'gear', crest: 'eagle' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && isIn(INDUSTRIAL, a.item.id)) a.cost *= 0.75; },
      cityYield(_ctx, a) { const n = a.city.buildings.filter(b => isIn(INDUSTRIAL, b)).length; if (n) a.pct.prod += 10 * n; },
      onEvent(ctx, ev) { if (ev.type === 'buildingBuilt' && ev.player === ctx.player.id && ev.building !== 'palace') addGold(ctx.state, ctx.player.id, 4, 'Förderbescheid', ctx.emit); },
    },
  },
  uk: {
    id: 'uk', name: 'Dame Imogen Hartley-Pryce', title: 'Admiral-Governor of the Albion Ark', civName: 'Albion Ark', adjective: 'British',
    country: 'United Kingdom', code: 'GBR', flagColors: ['#012169', '#ffffff', '#c8102e'], colors: { primary: '#b0293b', secondary: '#26324f' },
    description: 'The Ark has been under heavy dust bombardment for a week. The Admiral describes this as “a bit blustery.”',
    bonus: 'Coastal Colonies yield **+20%** {gold}. Each Sol Report pays **+1** {influence} per 3 Colonies. Your units defending in your own territory gain **+15%** strength.',
    startDoctrine: 'tea_lady', uniqueUnit: 'longbow_coilgunner', uniqueBuilding: 'royal_dockyard', aiPersonality: 'expansionist',
    cityNames: ['New London', 'Dover Dome', 'Manchester Mars', 'Birmingham Basin', 'Leeds Landing', 'Brighton Rock(et)', 'Edinburgh Crater', 'Cardiff Station', 'York Dome', 'Little Britain', 'Piccadilly Airlock', 'Queue Hollow', 'Nether Wallop', 'Upper Dustwick', 'Stiff Upper Lip'],
    portrait: { hue: 350, motif: 'ship', crest: 'crown' },
    effects: {
      cityYield(ctx, a) { if (isCoastalCity(ctx.state, a.city)) a.pct.gold += 20; },
      influenceIncome(ctx, a) { a.lines.push({ label: 'Commonwealth tithe', amount: Math.floor(citiesOf(ctx.state, ctx.player.id).length / 3) }); },
      combat(ctx, a) { if (a.side === 'defense' && a.defender?.owner === ctx.player.id && a.tile.owner === ctx.player.id) a.defenseMods.push({ label: 'Stiff Upper Lip', pct: 15 }); },
    },
  },
  italy: {
    id: 'italy', name: 'Dr. Giulia Ferrante', title: 'Curator-General of the Rinascimento Ark; Superintendent of Eternal Restoration', civName: 'Arca Rinascimento', adjective: 'Italian',
    country: 'Italy', code: 'ITA', flagColors: ['#009246', '#ffffff', '#ce2b37'], colors: { primary: '#a63d78', secondary: '#e8e1cf' },
    description: 'The scaffolding came aboard first. The statues are still waiting for the permit.',
    bonus: 'Heritage buildings (Crew Memorial, Earth Shrine, Memorial Chapel, Holo-Theater, Holo-Archive, Cathedral of Earth, Broadcast Tower, Arena) cost **25%** less {prod}. Colonies with a Megaproject yield **+3** {cul}. Each Sol Report pays **+1** {influence} per Megaproject (max 3).',
    startDoctrine: 'barista', uniqueUnit: 'codex_mortar', uniqueBuilding: 'grand_galleria', aiPersonality: 'builder',
    cityNames: ['Nuova Roma Rossa', 'Firenze Crater', 'Venezia Senz’Acqua', 'Milano Dome', 'Napoli Station', 'Torino Two', 'Bologna Basin', 'Pisa (Leaning, Slightly)', 'Siena Habitat', 'Genova Airlock', 'Palermo Marte', 'Verona Balcony', 'Pompeii Redux', 'Colosseo Dome', 'Ponte Vecchio Bis'],
    portrait: { hue: 320, motif: 'temple', crest: 'tower' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && isIn(CULTURE_BUILDINGS, a.item.id)) a.cost *= 0.75; },
      cityYield(_ctx, a) { if (a.city.wonders.length) a.yields.cul += 3; },
      influenceIncome(ctx, a) {
        const wonders = citiesOf(ctx.state, ctx.player.id).reduce((n, city) => n + city.wonders.length, 0);
        a.lines.push({ label: 'Patronage of the arts', amount: Math.min(3, wonders) });
      },
    },
  },
  spain: {
    id: 'spain', name: 'Capitana Lucía Navarro', title: 'Capitana of the Sol Ark; Director of the Great Survey', civName: 'Arca del Sol', adjective: 'Spanish',
    country: 'Spain', code: 'ESP', flagColors: ['#aa151b', '#f1bf00'], colors: { primary: '#f0a81a', secondary: '#a31f2b' },
    description: 'The Ark landed at noon, found no shade, and took a three-hour break to think about it.',
    bonus: 'All your units see **+1** hex; Scout Rovers move **+1**. Dune Sea tiles yield **+1** {food} and **+1** {gold}. Crash Sites pay **20** {gold}; each Landmark you discover pays **30** {gold}.',
    startDoctrine: 'cartografo', uniqueUnit: 'matador_hover_bike', uniqueBuilding: 'plaza_mayor', aiPersonality: 'warmonger',
    cityNames: ['Nueva Madrid', 'Barcelona Crater', 'Sevilla Station', 'Valencia Dome', 'Bilbao Base', 'Granada Habitat', 'Toledo Airlock', 'Salamanca Heights', 'Córdoba Camp', 'Santiago de la Duna', 'Málaga Mons', 'Zaragoza Two', 'Ibiza After Dark', 'La Siesta', 'Mañana Colony'],
    portrait: { hue: 38, motif: 'sun', crest: 'castle' },
    effects: {
      unitVision(_ctx, a) { a.value += 1; },
      unitMoves(_ctx, a) { if (UNITS[a.unit.type]?.class === 'recon') a.value += 1; },
      tileYield(_ctx, a) { if (a.tile.terrain === 'desert') { a.yields.food += 1; a.yields.gold += 1; } },
      onEvent(ctx, ev) {
        if (ev.type === 'ruinExplored' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 20, 'Crash Site salvage', ctx.emit);
        if (ev.type === 'naturalWonderFound' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 30, 'Landmark survey', ctx.emit);
      },
    },
  },
  netherlands: {
    id: 'netherlands', name: 'Dr. Fenna de Vries', title: 'Dike-Warden of the Polder Ark', civName: 'Polder Ark', adjective: 'Dutch',
    country: 'Netherlands', code: 'NLD', flagColors: ['#ae1c28', '#ffffff', '#21468b'], colors: { primary: '#f26b21', secondary: '#1f3f7a' },
    description: 'They looked at the Dust Sea and said, “Give us a few decades.” The pump is already on order.',
    bonus: 'Colonies may be founded **1** hex closer together. Dust Shallows yield **+1** {food} and **+1** {prod}. The Scrip interest cap is raised by **3**.',
    startDoctrine: 'pump_engineer', uniqueUnit: 'dijkwacht_squad', uniqueBuilding: 'polder_pump', aiPersonality: 'expansionist',
    cityNames: ['Nieuw-Amsterdam', 'Rotterdam Rift', 'Utrecht Underdome', 'Delft Dome', 'Haarlem Habitat', 'Eindhoven Lab', 'Groningen Ground', 'Maastricht Mons', 'Leiden Landing', 'Zuiderzee Station', 'Tulip Hollow', 'Windmill Heights', 'Bike Lane Basin', 'Below Mars Level', 'Gouda Gate'],
    portrait: { hue: 24, motif: 'river', crest: 'wheat' },
    effects: {
      canFoundCity(_ctx, a) { a.minDistance = Math.max(2, a.minDistance - 1); },
      tileYield(_ctx, a) { if (a.tile.terrain === 'coast') { a.yields.food += 1; a.yields.prod += 1; } },
      interestCap(_ctx, a) { a.value += 3; },
    },
  },
  belgium: {
    id: 'belgium', name: 'Commissaire Hélène Van den Berg', title: 'Commissioner of the Atomium Ark; Chair of the Subcommittee on Subcommittees', civName: 'Atomium Ark', adjective: 'Belgian',
    country: 'Belgium', code: 'BEL', flagColors: ['#000000', '#fae042', '#ed2939'], colors: { primary: '#a65d3f', secondary: '#2a1d1a' },
    description: 'The Ark carries three official languages, four governments and one chocolate reserve under round-the-clock guard.',
    bonus: 'Luxury deposit tiles yield **+1** {gold} and **+1** {cul}. The first Uplink reroll each visit is free, and later rerolls cost **1** less. Each Sol Report pays **+1** {influence}.',
    startDoctrine: 'chocolatier', uniqueUnit: 'ardennes_ranger', uniqueBuilding: 'chocolaterie', aiPersonality: 'scientist',
    cityNames: ['Nouvelle Bruxelles', 'Antwerp Airlock', 'Gent Station', 'Brugge Dome', 'Liège Crater', 'Namur Habitat', 'Leuven Lab', 'Mons Base', 'Ostend Dust-Shore', 'Waterloo, Mars', 'Manneken Pis Fountain', 'Atomium Annex', 'Mechelen Two', 'Charleroi Works', 'Subcommittee Heights'],
    portrait: { hue: 18, motif: 'chalice', crest: 'lion' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.resource && RESOURCES[a.tile.resource]?.kind === 'luxury') { a.yields.gold += 1; a.yields.cul += 1; } },
      council(ctx, a) {
        if (!ctx.player.isHuman) return;
        a.council.rerollCost = a.council.rerolls === 0 ? 0 : REROLL_BASE + REROLL_STEP * (a.council.rerolls - 1);
      },
      influenceIncome(_ctx, a) { a.lines.push({ label: 'Brussels bureaucracy', amount: 1 }); },
    },
  },
  ireland: {
    id: 'ireland', name: 'Siobhán Gallagher', title: 'Skipper of the Emerald Ark', civName: 'Emerald Ark', adjective: 'Irish',
    country: 'Ireland', code: 'IRL', flagColors: ['#169b62', '#ffffff', '#ff883e'], colors: { primary: '#27b36a', secondary: '#f2a541' },
    description: 'The weather forecast was one word long: “soft.” It has proved optimistic.',
    bonus: 'Each Dust Storm hit on your units or Colonies has a **50%** chance to do no damage. Hoodoo Fields yield **+1** {food} and **+1** {cul}. Every Orbital Drop pays **12** {gold} in remittances from the cousins aboard.',
    startDoctrine: 'publican', uniqueUnit: 'sliotar_slinger', uniqueBuilding: 'last_orders_pub', aiPersonality: 'expansionist',
    cityNames: ['New Dublin', 'Cork Crater', 'Galway Dry Bay', 'Limerick Limit', 'Kilkenny Dome', 'Waterford Station', 'Sligo Settlement', 'Dingle Dust', 'Tralee Habitat', 'Athlone Airlock', 'Killarney Crater', 'Drogheda Dome', 'Soft Day Basin', 'The Craic Pit', 'Last Orders, Mars'],
    portrait: { hue: 140, motif: 'lyre', crest: 'tree' },
    effects: {
      storm(ctx, a) { if (a.victim === ctx.player.id && a.damage > 0 && chance(ctx.state.rng, 0.5)) a.damage = 0; },
      tileYield(_ctx, a) { if (a.tile.feature === 'forest') { a.yields.food += 1; a.yields.cul += 1; } },
      onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 12, 'Diaspora remittances', ctx.emit); },
    },
  },
  portugal: {
    id: 'portugal', name: 'Inês Carvalho', title: 'Navigator-General of the Navegante Ark', civName: 'Arca Navegante', adjective: 'Portuguese',
    country: 'Portugal', code: 'PRT', flagColors: ['#006600', '#ff0000', '#ffcc00'], colors: { primary: '#e9967a', secondary: '#2a6f4e' },
    description: 'The Ark is quietly homesick. There is a word for this feeling, and the manifest has a budget for it.',
    bonus: 'Units that start their turn on Dust Shallows or Dust Sea gain **+2** moves. Worked water tiles yield **+1** {sci}. Beacon Towers and Skiff Docks cost **30%** less {prod}.',
    startDoctrine: 'fadista', uniqueUnit: 'navegador_rover', uniqueBuilding: 'sagres_beacon', aiPersonality: 'expansionist',
    cityNames: ['Nova Lisboa', 'Porto Poente', 'Sagres Dome', 'Faro Station', 'Coimbra Crater', 'Braga Base', 'Évora Habitat', 'Cascais Airlock', 'Setúbal Skiffs', 'Aveiro Basin', 'Madeira Mons', 'Azores Array', 'Belém Beacon', 'Saudade Bay', 'Nata Plaza'],
    portrait: { hue: 12, motif: 'compass', crest: 'anchor' },
    effects: {
      unitMoves(ctx, a) { const tile = ctx.state.map.tiles[a.unit.tile]; if (tile && isWaterTile(tile)) a.value += 2; },
      tileYield(_ctx, a) { if (isWaterTile(a.tile)) a.yields.sci += 1; },
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && isIn(COASTAL_BUILDINGS, a.item.id)) a.cost *= 0.7; },
    },
  },
  austria: {
    id: 'austria', name: 'Dr. Theresia Gruber', title: 'Director of the Edelweiss Ark; Chair of the Philharmonic Hab', civName: 'Edelweiss Ark', adjective: 'Austrian',
    country: 'Austria', code: 'AUT', flagColors: ['#ed2939', '#ffffff'], colors: { primary: '#7b6fd6', secondary: '#f1e9d2' },
    description: 'The Ark has a concert hall, a coffeehouse and a very small airlock. The order of priority is disputed.',
    bonus: 'Rivals cannot declare war on you before Sol **40**. Ridges yield **+1** {cul}. Colonies with a Holo-Theater or Memorial Chapel yield **+20%** {cul}.',
    startDoctrine: 'kapellmeister', uniqueUnit: 'edelweiss_jager', uniqueBuilding: 'kaffeehaus', aiPersonality: 'scientist',
    cityNames: ['Neu-Wien', 'Salzburg Station', 'Graz Crater', 'Linz Lab', 'Innsbruck Heights', 'Klagenfurt Basin', 'Hallstatt Habitat', 'Schönbrunn Dome', 'Sachertorte Station', 'Eisenstadt Airlock', 'Bregenz Base', 'Melk Mons', 'Waltz Landing', 'Ringstraße Loop', 'Second Movement'],
    portrait: { hue: 250, motif: 'mountain', crest: 'eagle' },
    effects: {
      warDeclaration(ctx, a) { if (a.target === ctx.player.id && ctx.state.turn < 40) { a.allowed = false; a.reason = 'The Congress of Vienna shields the Edelweiss Ark until Sol 40.'; } },
      tileYield(_ctx, a) { if (a.tile.elevation === 'hills') a.yields.cul += 1; },
      cityYield(_ctx, a) { if (a.city.buildings.some(b => b === 'amphitheater' || b === 'temple')) a.pct.cul += 20; },
    },
  },
  denmark: {
    id: 'denmark', name: 'Kaptajn Freja Madsen', title: 'Jarl-Director of the Hygge Ark', civName: 'Hygge Ark', adjective: 'Danish',
    country: 'Denmark', code: 'DNK', flagColors: ['#c8102e', '#ffffff'], colors: { primary: '#a9d3e3', secondary: '#c8102e' },
    description: 'The Ark runs on wind, candles and a deep conviction that the situation is, on balance, cosy.',
    bonus: 'Wind Farms cost **50%** less {prod} and yield **+2** {prod} more. **+6** Stability. Your units gain **+20%** strength when attacking Colonies.',
    startDoctrine: 'windsmith', uniqueUnit: 'viking_raider', uniqueBuilding: 'hygge_lounge', aiPersonality: 'warmonger',
    cityNames: ['Nye København', 'Aarhus Airlock', 'Odense Outpost', 'Aalborg Array', 'Roskilde Rift', 'Esbjerg Wind', 'Kronborg Keep', 'Tivoli Dome', 'Brick Landing', 'Hygge Hollow', 'Skagen Shelf', 'Ribe Ridge', 'Bornholm Basin', 'Candlelight Crater', 'Smørrebrød Station'],
    portrait: { hue: 195, motif: 'tower', crest: 'serpent' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && a.item.id === 'wind_farm') a.cost *= 0.5; },
      cityYield(_ctx, a) { if (a.city.buildings.includes('wind_farm')) a.yields.prod += 2; },
      happiness(_ctx, a) { a.value += 6; },
      combat(ctx, a) { if (a.side === 'attack' && a.attacker?.owner === ctx.player.id && a.defenderCity) a.attackMods.push({ label: 'Raiders', pct: 20 }); },
    },
  },
};

export const CREW_WESTEUROPE: DoctrineDef[] = [
  {
    id: 'safety_inspector', name: 'The Safety Inspector', rarity: 'uncommon', cost: 6, noShop: true, nation: 'germany',
    description: 'Has signed off on everything, twice. Each Sol Report gains **+1** {splendor} for every 4 buildings you own.',
    flavor: '“The airlock is certified. The certificate is certified. The air is pending.”', tags: ['nation', 'buildings', 'splendor'], icon: 'eye', art: { hue: 215, motif: 'eye' },
    effects: {
      chronicle(ctx, c) {
        const n = citiesOf(ctx.state, ctx.player.id).reduce((sum, city) => sum + city.buildings.filter(b => b !== 'palace').length, 0);
        if (n >= 4) c.addSplendor(Math.floor(n / 4));
      },
    },
  },
  {
    id: 'tea_lady', name: 'The Tea Lady', rarity: 'uncommon', cost: 6, noShop: true, nation: 'uk',
    description: 'Morale is a hot drink and a polite “there, there.” Each Sol Report gains **+1** {splendor}, or **+4** {splendor} if you lost no units that chapter.',
    flavor: '“It is simply weather, dear. Biscuit?”', tags: ['nation', 'survival', 'splendor'], icon: 'happy', art: { hue: 350, motif: 'chalice' },
    effects: { chronicle(_ctx, c) { c.addSplendor(c.stats.unitsLost === 0 ? 4 : 1); } },
  },
  {
    id: 'barista', name: 'The Barista', rarity: 'uncommon', cost: 6, noShop: true, nation: 'italy',
    description: 'Runs the only espresso machine on Mars, which is a moral position. Every Holo-Theater and Holo-Archive gives its Colony **+2** {cul}.',
    flavor: '“Three hundred million kilometers from Naples. The espresso is still a crime, but a good one.”', tags: ['nation', 'culture', 'buildings'], icon: 'flask', art: { hue: 320, motif: 'flask' },
    effects: {
      cityYield(_ctx, a) {
        for (const b of a.city.buildings) if (b === 'amphitheater' || b === 'museum' || b === 'grand_galleria') a.yields.cul += 2;
      },
    },
  },
  {
    id: 'cartografo', name: 'El Cartógrafo', rarity: 'uncommon', cost: 6, noShop: true, nation: 'spain',
    description: 'Redraws the map every time the dunes move. Each Landmark you have discovered adds **+2** {splendor} to every Sol Report.',
    flavor: '“The map and the territory disagree. The map has seniority.”', tags: ['nation', 'landmarks', 'splendor'], icon: 'map', art: { hue: 38, motif: 'compass' },
    effects: {
      chronicle(ctx, c) {
        const n = ctx.state.naturalWondersSeen[ctx.player.id]?.length ?? 0;
        if (n) c.addSplendor(2 * n);
      },
    },
  },
  {
    id: 'pump_engineer', name: 'The Pump Engineer', rarity: 'uncommon', cost: 6, noShop: true, nation: 'netherlands',
    description: 'Keeps the water out and the dust under negotiation. Your Colonies take **half** Dust Storm damage.',
    flavor: '“It is only a leak if you refuse to call it a feature.”', tags: ['nation', 'storms', 'colonies'], icon: 'wave', art: { hue: 24, motif: 'wave' },
    effects: { storm(ctx, a) { if (a.city && a.victim === ctx.player.id) a.damage *= 0.5; } },
  },
  {
    id: 'chocolatier', name: 'The Chocolatier', rarity: 'uncommon', cost: 6, noShop: true, nation: 'belgium',
    description: 'Guards the cocoa reserve with a grin and a locksmith. Each Sol Report gains **+1** {splendor} for every luxury resource you own.',
    flavor: '“Technically a strategic reserve. Practically a morale device.”', tags: ['nation', 'luxury', 'splendor'], icon: 'coin', art: { hue: 18, motif: 'coin' },
    effects: {
      chronicle(ctx, c) {
        const n = luxuriesOwned(ctx.state, ctx.player.id);
        if (n) c.addSplendor(n);
      },
    },
  },
  {
    id: 'publican', name: 'The Publican', rarity: 'uncommon', cost: 6, noShop: true, nation: 'ireland',
    description: 'Everyone has a tab and nobody has a wallet. Whenever one of your Colonies grows, gain **3** {gold}.',
    flavor: '“Last orders were called an hour ago. They keep ordering.”', tags: ['nation', 'growth', 'credits'], icon: 'coin', art: { hue: 140, motif: 'flame' },
    effects: { onEvent(ctx, ev) { if (ev.type === 'cityGrew' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 3, 'Pub tab', ctx.emit); } },
  },
  {
    id: 'fadista', name: 'The Fadista', rarity: 'uncommon', cost: 6, noShop: true, nation: 'portugal',
    description: 'Sings of home so beautifully that the whole canteen forgets to be homesick. Dust Shallows and Dust Sea tiles worked by your Colonies yield **+1** {cul}.',
    flavor: '“There is a word for this feeling. Unfortunately it is also the name of the song.”', tags: ['nation', 'culture', 'coast'], icon: 'feather', art: { hue: 12, motif: 'lyre' },
    effects: { tileYield(ctx, a) { if (a.city?.owner === ctx.player.id && (a.tile.terrain === 'coast' || a.tile.terrain === 'ocean')) a.yields.cul += 1; } },
  },
  {
    id: 'kapellmeister', name: 'The Kapellmeister', rarity: 'uncommon', cost: 6, noShop: true, nation: 'austria',
    description: 'Brings the overture in under time and makes the committee applaud. Dawn Sol Reports need **12%** less Viability.',
    flavor: '“Allegro ma non troppo. The Charter prefers non troppo.”', tags: ['nation', 'target', 'score'], icon: 'scroll', art: { hue: 250, motif: 'scroll' },
    effects: { target(ctx, a) { if (ctx.state.run.chapter === 0) a.value *= 0.88; } },
  },
  {
    id: 'windsmith', name: 'The Windsmith', rarity: 'uncommon', cost: 6, noShop: true, nation: 'denmark',
    description: 'Builds turbines out of whatever happens to be spinning nearby. Each Sol Report gains **+1** {splendor} per Wind Farm you own.',
    flavor: '“It is not a storm. It is a free subscription.”', tags: ['nation', 'wind', 'splendor'], icon: 'bolt', art: { hue: 195, motif: 'gear' },
    effects: {
      chronicle(_ctx, c) {
        const n = c.cities.reduce((sum, city) => sum + city.buildings.filter(b => b === 'wind_farm').length, 0);
        if (n) c.addSplendor(n);
      },
    },
  },
];

registerCrew(CREW_WESTEUROPE);
