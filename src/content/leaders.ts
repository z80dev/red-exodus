// OWNER: Nations. Leader effects apply to every player led by that nation (AIs included): hooks always use ctx.player.
import type { LeaderDef } from '../sim/defs';
import { addGold } from '../sim/economy';
import { chance, randInt } from '../sim/rng';
import { changeMandate, addExtraStat } from '../sim/roguelite';
import { addEdict } from '../sim/roguelite/council';
import { EDICTS } from './edicts';
import { UNITS } from './units';
import { pushDoctrineCard } from './doctrines';

export const LEADERS: Record<string, LeaderDef> = {
  usa: {
    id: 'usa', name: 'Harlan Price', title: 'Designated Survivor; Former Secretary of the Interior', civName: 'Liberty Ark', adjective: 'American',
    country: 'United States', code: 'USA', flagColors: ['#b22234', '#ffffff', '#3c3b6e'], colors: { primary: '#2474a6', secondary: '#f0c85a' },
    description: 'The national emergency plan worked. The person in charge is still arguing about the invoice.',
    bonus: 'The Uplink stocks **+1** Crew card. Selling Crew refunds its full price. **+10%** {gold}.',
    startDoctrine: 'astronaut', uniqueUnit: 'marine_raider', uniqueBuilding: 'liberty_exchange', aiPersonality: 'expansionist',
    cityNames: ['New Houston', 'Cape Canaveral II', 'New Albuquerque', 'Little Rock(et)', 'Phoenix Rising', 'New Detroit', 'Houston, We Have Air', 'New Anchorage', 'Omaha Beachhead', 'Dust Vegas', 'New Cleveland', 'Camp David Dome', 'New Seattle', 'Independence, Mars', 'Last Exit, Texas'],
    portrait: { hue: 205, motif: 'eagle', crest: 'star' },
    effects: {
      council(ctx, a) { pushDoctrineCard(ctx.state, a.council); },
      cityYield(_ctx, a) { a.pct.gold += 10; },
      sellValue(_ctx, a) { a.value = a.price; },
    },
  },
  china: {
    id: 'china', name: 'Lin Weiqi', title: 'Chief Engineer of the Tiangong Mission', civName: 'Tiangong Ark', adjective: 'Chinese',
    country: 'China', code: 'CHN', flagColors: ['#de2910', '#ffde00'], colors: { primary: '#168f86', secondary: '#f2cf4a' }, cryo: 5,
    description: 'The habitat arrived ahead of schedule. The schedule was written before Earth went dark.',
    bonus: 'Megaprojects cost **25%** less {prod}. Gain **+2** {splendor} per Megaproject owned in each Sol Report. Start with **+2** Cryo Pods.',
    startDoctrine: 'foreman', uniqueUnit: 'jade_rabbit_crawler', uniqueBuilding: 'harmony_hab_block', aiPersonality: 'builder',
    cityNames: ['New Beijing', 'Chang’e Harbour', 'Jade Rabbit One', 'Dustzhou', 'Red Dragon Bay', 'Xīn Shanghai', 'Tiangong City', 'Long March East', 'Mòhe Crater', 'New Guangzhou', 'Quietly Thriving', 'Plan Ahead Basin', 'Second Shenzhen', 'The Future Is On Time', 'Xiǎo Mars'],
    portrait: { hue: 12, motif: 'gear', crest: 'lion' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'wonder') a.cost *= 0.75; },
      chronicle(ctx, c) { const count = Object.values(ctx.state.cities).filter(city => city.owner === ctx.player.id).reduce((n, city) => n + city.wonders.length, 0); if (count) c.addSplendor(2 * count); },
    },
  },
  russia: {
    id: 'russia', name: 'Valentina Sokolova', title: 'Cosmonaut-Colonel of Novaya Zarya', civName: 'Novaya Zarya', adjective: 'Russian',
    country: 'Russia', code: 'RUS', flagColors: ['#ffffff', '#2455a4', '#d52b1e'], colors: { primary: '#507fc0', secondary: '#394a63' },
    description: 'She brought the reactor manual, the emergency vodka, and a strict definition of “weather.”',
    bonus: 'Your units and Colonies take no Dust Storm damage. Enemy units in your territory take **double** storm damage. Frost Flats and Polar Ice yield **+1** {prod}. Start with Tsar Charge Salvage.',
    startDoctrine: 'veteran_cosmonaut', uniqueUnit: 'frostguard_spetsnaz', uniqueBuilding: 'rbmk_reactor', aiPersonality: 'warmonger',
    cityNames: ['Novaya Zarya', 'New Baikonur', 'Krasnoyarsk Crater', 'Vostok Dome', 'Sovetskaya Gavan', 'Perm Frost', 'Petropavlovsk-Red', 'New Murmansk', 'Omsk-on-Mars', 'Yekaterinburg East', 'Volga Station', 'New Yakutsk', 'Cold Shoulder', 'Comrade Springs', 'Cosmodrome No. 2'],
    portrait: { hue: 198, motif: 'moon', crest: 'star' },
    effects: {
      storm(ctx, a) { if (a.victim === ctx.player.id) a.damage = 0; else if (a.territoryOwner === ctx.player.id) a.damage *= 2; },
      tileYield(_ctx, a) { if (a.tile.terrain === 'tundra' || a.tile.terrain === 'snow') a.yields.prod += 1; },
      onGain(ctx) { if (ctx.player.isHuman) addEdict(ctx.state, 'tsar_charge'); },
    },
  },
  india: {
    id: 'india', name: 'Dr. Anjali Rao', title: 'Mission Director of Mangalyaan Collective', civName: 'Mangalyaan Collective', adjective: 'Indian',
    country: 'India', code: 'IND', flagColors: ['#ff9933', '#ffffff', '#138808'], colors: { primary: '#a75bd1', secondary: '#62d3c4' },
    description: 'A launch system assembled from three spare parts and one extremely convincing presentation.',
    bonus: 'Breakthrough offers **4** Research choices; the first reroll of each offer is free. Installations cost **30%** less {gold}. **+10%** {sci}.',
    startDoctrine: 'jugaad_mechanic', uniqueUnit: 'pragyan_rover', uniqueBuilding: 'orbiter_relay', aiPersonality: 'scientist',
    cityNames: ['Naya Delhi', 'Mangalapuram', 'Pragyan Nagar', 'New Bengaluru', 'Chandrayaan Chowk', 'Jaipur Red', 'Kochi Crater', 'Pune Orbit', 'Thiruvananthapuram Two', 'Old Hyderabad', 'Mysuru Dome', 'Ahmedabad East', 'Vikram Landing', 'Jugaad Junction', 'New Varanasi'],
    portrait: { hue: 276, motif: 'flask', crest: 'book' },
    effects: {
      researchOffers(_ctx, a) { a.value = 4; },
      researchReroll(ctx, a) { if (ctx.player.researchRerolls === 0) a.value = 0; },
      cost(_ctx, a) { if (a.currency === 'gold' && a.item.kind === 'improvement') a.cost *= 0.7; },
      cityYield(_ctx, a) { a.pct.sci += 10; },
    },
  },
  japan: {
    id: 'japan', name: 'Kenji Arakawa', title: 'Director of the Yamato Ark', civName: 'Yamato Ark', adjective: 'Japanese',
    country: 'Japan', code: 'JPN', flagColors: ['#ffffff', '#bc002d'], colors: { primary: '#394c9f', secondary: '#c3d6ff' },
    description: 'The robots run the checklist. The humans run the checklist about the robots.',
    bonus: 'Every new unit arrives with a free promotion. Buildings cost **15%** less {prod}.',
    startDoctrine: 'roboticist', uniqueUnit: 'mecha_frame', uniqueBuilding: 'robotics_lab', aiPersonality: 'scientist',
    cityNames: ['New Tokyo', 'Yamato Landing', 'Akihabara Dome', 'Osaka Base', 'Kyoto Crater', 'Sapporo South', 'Naha Station', 'Sendai New Town', 'Hokkaido Habitat', 'Kobe Two', 'Fuji View Estate', 'Shinjuku-Red', 'Nagoya Works', 'Matsumoto Airlock', 'Neo Yokohama'],
    portrait: { hue: 228, motif: 'gear', crest: 'sun' },
    effects: { cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building') a.cost *= 0.85; } },
  },
  france: {
    id: 'france', name: 'Élodie Marchand', title: 'Louvre Curator and Chief of Arche Lumière', civName: 'Arche Lumière', adjective: 'French',
    country: 'France', code: 'FRA', flagColors: ['#0055a4', '#ffffff', '#ef4135'], colors: { primary: '#72b965', secondary: '#bc78d1' },
    description: 'The Louvre made it aboard. The Mona Lisa has seen the manifest and is not smiling.',
    bonus: 'Start with La Joconde (Legendary Crew: **+1** {splendor} per chapter, permanent). Heritage begins at level **2**. **+20%** {happy}.',
    startDoctrine: 'la_joconde', uniqueUnit: 'legion_etrangere', uniqueBuilding: 'salon', aiPersonality: 'builder',
    cityNames: ['Nouvelle Paris', 'Lyon-sur-Mars', 'Cité Lumière', 'Bordeaux Rouge', 'Marseille Deux', 'Toulouse Station', 'Dijon Dome', 'Nice Try', 'Avignon-les-Dunes', 'Montpellier B', 'Saint-Étienne', 'Cannes du Cratère', 'Lille Nouvelle', 'Versailles Pressurisée', 'La Rochelle Rouge'],
    portrait: { hue: 166, motif: 'lyre', crest: 'laurel' },
    effects: {
      onGain(ctx) { if (ctx.player.isHuman) ctx.state.run.pillarLevels.arts = Math.max(2, ctx.state.run.pillarLevels.arts); },
      cityYield(_ctx, a) { a.pct.cul += 20; },
    },
  },
  brazil: {
    id: 'brazil', name: 'Thaís Oliveira', title: 'Seed-Keeper of Arca Amazônia', civName: 'Arca Amazônia', adjective: 'Brazilian',
    country: 'Brazil', code: 'BRA', flagColors: ['#009739', '#ffdf00', '#002776'], colors: { primary: '#d68a35', secondary: '#6344a5' },
    description: 'The seed vault is intact. The planet is a desert. The botanist remains offensively optimistic.',
    bonus: 'Clay Basin and Ancient Delta tiles yield **+1** {food}. Colonies need **20%** less Food to grow. Carnival converts at **double** rate.',
    startDoctrine: 'botanist', uniqueUnit: 'jaguar_rover', uniqueBuilding: 'biodome', aiPersonality: 'expansionist',
    unlock: { text: 'Rule 8 Colonies at once', rule: 'cities8' },
    cityNames: ['Novo Cuiabá', 'Nova Manaus', 'Brasília Vermelha', 'Santos Dumont', 'Belém do Cráter', 'Porto Alegre II', 'Recife de Marte', 'Salvador da Terra', 'Rio de Janeiro Novo', 'Campinas Orbital', 'Florianópolis Sul', 'Fortaleza Solar', 'Curitiba Pressurizada', 'Natal do Planeta', 'Boa Vista, Literally'],
    portrait: { hue: 28, motif: 'tree', crest: 'serpent' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'grassland' || a.tile.feature === 'floodplains') a.yields.food += 1; },
      growthThreshold(_ctx, a) { a.value *= 0.8; },
      onEvent(ctx, ev) { if (ctx.player.isHuman && ev.type === 'renownGained' && ev.label.startsWith('Festival in ')) addExtraStat(ctx.state, 'festival', ev.amount); },
    },
  },
  uae: {
    id: 'uae', name: 'Rashid Al-Falasi', title: 'Minister of the Al-Amal Mission', civName: 'Al-Amal (Hope)', adjective: 'Emirati',
    country: 'United Arab Emirates', code: 'UAE', flagColors: ['#00732f', '#ffffff', '#ff0000', '#000000'], colors: { primary: '#35c4d9', secondary: '#e6b84c' },
    description: 'The Ark runs on sunlight, sovereign wealth, and a very expensive contingency plan.',
    bonus: 'Start with **100** {gold}. Banked Credits earn **3%** interest per turn, capped at **15** {gold} per turn. If out of pods, Orbital Drops cost Credits.',
    startDoctrine: 'wealth_manager', uniqueUnit: 'falcon_drone', uniqueBuilding: 'sky_souk', aiPersonality: 'builder',
    unlock: { text: 'Win a run', rule: 'win' },
    cityNames: ['Al-Amal City', 'New Abu Dhabi', 'Dubai Next Door', 'Sharjah Station', 'Al Ain on Mars', 'Fujairah Dome', 'Ras al-Khaimah Red', 'Ajman Heights', 'Umm al-Quwain Two', 'Masdar Crater', 'The Palm, Regolith Edition', 'Jebel Hafeet Base', 'Hope, With Valet', 'New Liwa', 'Falcon Heights'],
    portrait: { hue: 190, motif: 'sun', crest: 'eagle' },
    effects: {
      onGain(ctx) { addGold(ctx.state, ctx.player.id, 100, 'Sovereign fund', ctx.emit); },
      turnStart(ctx) { const amount = Math.min(Math.floor(ctx.player.gold * 0.03), 15); if (amount > 0) addGold(ctx.state, ctx.player.id, amount, 'Sovereign fund interest', ctx.emit); },
      dropPrice(_ctx, a) { if (a.cryoLeft <= 0) { a.cryo = 0; a.gold = 50; } },
    },
  },
  nigeria: {
    id: 'nigeria', name: 'Chidinma Okafor', title: 'Governor of the Naija Ark', civName: 'Naija Ark', adjective: 'Nigerian',
    country: 'Nigeria', code: 'NGA', flagColors: ['#008751', '#ffffff'], colors: { primary: '#c5c93f', secondary: '#6b57bd' },
    description: 'If the crash site has anything useful, the crew will find it. If it does not, they will make a business.',
    bonus: 'Crash Sites grant a random Salvage. Feral Dens pay **double**. Colonies grow **15%** faster.',
    startDoctrine: 'nollywood_star', uniqueUnit: 'okada_rider', uniqueBuilding: 'nollywood_studio', aiPersonality: 'expansionist',
    unlock: { text: 'Complete 3 runs', rule: 'runs3' },
    cityNames: ['New Lagos', 'Abuja Station', 'Kano Crater', 'Port Harcourt Two', 'Ibadan Red', 'Enugu Heights', 'Benin-on-Mars', 'Jos Plateau Base', 'Warri Airlock', 'Akure Dome', 'Calabar Crossing', 'Kaduna Junction', 'Onitsha Market', 'Abeokuta New Town', 'No Wahala Colony'],
    portrait: { hue: 47, motif: 'flame', crest: 'eagle' },
    effects: {
      growthThreshold(_ctx, a) { a.value *= 0.85; },
      onEvent(ctx, ev) {
        if (ev.type === 'campCleared' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, ev.gold, 'Feral Den double payout', ctx.emit);
        if (ev.type === 'ruinExplored' && ev.player === ctx.player.id && ctx.player.isHuman) {
          const ids = Object.keys(EDICTS);
          if (ids.length && ctx.state.run.edicts.length < ctx.state.run.edictSlots) addEdict(ctx.state, ids[randInt(ctx.state.rng, ids.length)]);
        }
      },
    },
  },
  switzerland: {
    id: 'switzerland', name: 'Anna Brunner', title: 'Federal Councillor of the Helvetia Vault', civName: 'Helvetia Vault', adjective: 'Swiss',
    country: 'Switzerland', code: 'CHE', flagColors: ['#ff0000', '#ffffff'], colors: { primary: '#c0c9d2', secondary: '#3d628c' },
    description: 'A nation-sized bunker with immaculate accounts and absolutely no opinion about your war.',
    bonus: 'Rivals can never declare war on you and you can never declare war. Colonies gain **+50%** defense. Scrip interest cap is doubled.',
    startDoctrine: 'private_banker', uniqueUnit: 'alpine_guard', uniqueBuilding: 'bunker_bank', aiPersonality: 'builder',
    unlock: { text: 'Win without losing Charter', rule: 'noMandateLost' },
    cityNames: ['New Zürich', 'Genève Rouge', 'Bern Base', 'Lausanne-les-Dunes', 'Basel Habitat', 'Luzern Crater', 'Lugano Nuovo', 'Neuchâtel North', 'Sion Station', 'Winterthur Dome', 'Interlaken East', 'Fribourg Airlock', 'St. Gallen Two', 'Davos Downhill', 'Neutrality, Incorporated'],
    portrait: { hue: 205, motif: 'shield', crest: 'key' },
    effects: {
      warDeclaration(_ctx, a) { a.allowed = false; a.reason = 'Swiss neutrality forbids declaring war in either direction.'; },
      combat(ctx, a) { const city = a.side === 'attack' ? a.attackerCity : a.defenderCity; if (a.side === 'defense' && city?.owner === ctx.player.id) a.defenseMods.push({ label: 'Armed Neutrality', pct: 50 }); },
      interestCap(_ctx, a) { a.value *= 2; },
    },
  },
  north_korea: {
    id: 'north_korea', name: 'Ri Song-hwa', title: 'Marshal and Dear Commander of the Juche Ark', civName: 'Juche Ark', adjective: 'North Korean',
    country: 'North Korea', code: 'PRK', flagColors: ['#024fa2', '#ed1c27', '#ffffff'], colors: { primary: '#829d37', secondary: '#3b4b1d' },
    description: 'The Ark has one channel, one approved portrait, and a reroll policy of zero.',
    bonus: 'The Uplink cannot be rerolled. Military units cost **30%** less {prod} and gain **+15%** strength. **−25%** {happy}. Start with Eternal Leader (×2 Hope; cannot be sold).',
    startDoctrine: 'eternal_leader', uniqueUnit: 'songun_trooper', uniqueBuilding: 'mass_games_arena', aiPersonality: 'warmonger',
    unlock: { text: 'Win a run at Hazard 4+', rule: 'winAsc4' },
    cityNames: ['Juche City', 'Pyongyang Red', 'New Hamhung', 'Kaesong Dome', 'Wonsan Landing', 'Sinuiju Station', 'Chongjin Heights', 'Hyesan Habitat', 'Nampo Basin', 'The Glorious Crater', 'One Channel Town', 'People’s Paradise 2', 'Songun Square', 'Dear Leader Heights', 'No Questions Colony'],
    portrait: { hue: 265, motif: 'crown', crest: 'shield' },
    effects: {
      council(_ctx, a) { a.council.rerollLocked = true; },
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'unit' && UNITS[a.item.id] && UNITS[a.item.id].class !== 'civilian' && UNITS[a.item.id].class !== 'recon') a.cost *= 0.7; },
      combat(_ctx, a) { if (a.side === 'attack' && a.attacker) a.attackMods.push({ label: 'Songun Strength', pct: 15 }); if (a.side === 'defense' && a.defender) a.defenseMods.push({ label: 'Songun Strength', pct: 15 }); },
      happiness(_ctx, a) { a.value -= 25; },
    },
  },
  vatican: {
    id: 'vatican', name: 'Pope Innocent XIV', title: 'Pontiff of the Last Conclave', civName: 'The Last Conclave', adjective: 'Vatican',
    country: 'Holy See', code: 'VAT', flagColors: ['#ffcc00', '#ffffff'], colors: { primary: '#c6a84b', secondary: '#f0eee4' },
    description: 'The last Conclave landed on Mars with one relic, one plan, and a truly impressive airlock blessing.',
    bonus: '**+2** {splendor} in every Sol Report. Salvage has a **1-in-3** chance to be returned after use. Start with **+1** Charter.',
    startDoctrine: 'cardinal', uniqueUnit: 'swiss_guard', uniqueBuilding: 'basilica_red_planet', aiPersonality: 'builder',
    unlock: { text: 'Overcome 6 Crises in one run', rule: 'crises6' },
    cityNames: ['Città del Redentore', 'Nuova Roma', 'San Pietro Base', 'Assisi Crater', 'Loreto Station', 'Benedictine Heights', 'New Castel Gandolfo', 'Via della Speranza', 'Civitas Vaticana', 'Monte Cassino Two', 'Piazza del Sole', 'Orvieto Dome', 'Santa Maria Nuova', 'Conclave Heights', 'Urbi et Orbiti'],
    portrait: { hue: 44, motif: 'chalice', crest: 'shield' },
    effects: {
      chronicle(_ctx, c) { c.addSplendor(2); },
      onGain(ctx) { if (!ctx.player.isHuman) return; ctx.state.run.maxMandate += 1; changeMandate(ctx.state, 1, 'Faith Beyond Earth', ctx.emit); },
      onEvent(ctx, ev) { if (ev.type === 'edictUsed' && ctx.player.isHuman && chance(ctx.state.rng, 1 / 3)) addEdict(ctx.state, ev.id); },
    },
  },
};
