// OWNER: Nations. Canada, Mexico, Argentina, Colombia, Chile, Australia, South Africa, Egypt, Iran, Pakistan and their
// starting Crew (noShop). Leader effects apply to every player led by that nation (AIs included): hooks always use
// ctx.player, and run-level perks (edicts, Scrip, Sol Report) are guarded by ctx.player.isHuman.
import type { DoctrineDef, HookCtx, LeaderDef } from '../../sim/defs';
import type { GameState } from '../../sim/types';
import { addGold } from '../../sim/economy';
import { changePop } from '../../sim/cities';
import { neighbors } from '../../sim/hex';
import { changeCryo } from '../../sim/mars';
import { chance, randInt } from '../../sim/rng';
import { addInfluence } from '../../sim/roguelite';
import { addEdict } from '../../sim/roguelite/council';
import { DOCTRINES, registerCrew } from '../doctrineRegistry';
import { EDICTS } from '../edicts';
import { RESOURCES } from '../resources';
import { UNITS } from '../units';

/** hand the human a random non-legendary Salvage card if a slot is free; returns its name (null = no slot) */
function grantRandomEdict(state: GameState): string | null {
  const pool = Object.values(EDICTS).filter((e) => e.rarity !== 'legendary');
  if (!pool.length) return null;
  const def = pool[randInt(state.rng, pool.length)];
  return addEdict(state, def.id) == null ? null : def.name;
}

function notify(ctx: HookCtx, text: string): void {
  ctx.emit({ type: 'notify', text, icon: 'star', tone: 'good' });
}

/** carpet-weaving luxuries of the Pardis Ark */
const CARPET_LUXURIES: Record<string, true> = { spices: true, cotton: true, silk: true, dyes: true };

export const LEADERS_AMERICAS: Record<string, LeaderDef> = {
  canada: {
    id: 'canada', name: 'Marguerite Beaulieu', title: 'Search-and-Rescue Commander of the Aurora Ark', civName: 'Aurora Ark', adjective: 'Canadian',
    country: 'Canada', code: 'CAN', flagColors: ['#d80621', '#ffffff'], colors: { primary: '#e2574c', secondary: '#f6efe4' },
    description: 'Every airlock was held open for the person behind. The person behind was also Canadian, and also apologized.',
    bonus: 'Your units heal **+10** HP each turn. Hoodoo Field tiles yield **+1** {food}. When a rival declares war on you, gain **60** {gold} and **1** {influence} in Sympathy Aid.',
    startDoctrine: 'maple_tapper', uniqueUnit: 'mountie_sled', uniqueBuilding: 'universal_med_bay', aiPersonality: 'builder',
    cityNames: ['Nouvelle Ottawa', 'Toronto Dome', 'Montréal Souterrain', 'Vancouver Shallows', 'Calgary Crater', 'Edmonton Frost', 'Winnipeg Winter', 'Halifax Landing', 'Yellowknife Two', 'Saskatoon Station', 'Victoria Vent', 'Whitehorse Ridge', 'Niagara Falls Down', 'Moose Jaw Outpost', 'Sorry, Mars'],
    portrait: { hue: 5, motif: 'tree', crest: 'laurel' },
    gender: 'f', alt: { name: 'Étienne Gallant', title: 'Ice-Road Chief of the Aurora Ark', gender: 'm', description: 'Every airlock was held open for the person behind. The person behind was also Canadian, and also apologized.' },
    effects: {
      unitHeal(ctx, a) { if (a.unit.owner === ctx.player.id) a.value += 10; },
      tileYield(_ctx, a) { if (a.tile.feature === 'forest') a.yields.food += 1; },
      onEvent(ctx, ev) {
        if (ev.type !== 'warDeclared' || ev.target !== ctx.player.id) return;
        addGold(ctx.state, ctx.player.id, 60, 'Sympathy aid', ctx.emit);
        if (ctx.player.isHuman) addInfluence(ctx.state, 1, ctx.emit);
      },
    },
  },
  mexico: {
    id: 'mexico', name: 'Itzel Navarro Cruz', title: 'Commander of the Quinto Sol Ark', civName: 'Arca Quinto Sol', adjective: 'Mexican',
    country: 'Mexico', code: 'MEX', flagColors: ['#006847', '#ffffff', '#ce1126'], colors: { primary: '#e0529c', secondary: '#2f8f5b' },
    description: 'The crew made peace with death a long time ago. Every November, they invite it to dinner.',
    bonus: 'When one of your units is lost, hold a wake: gain **12** {gold}. Your units fight at **+25%** strength while below half health. **+15%** {cul}.',
    startDoctrine: 'la_catrina', uniqueUnit: 'luchador_trooper', uniqueBuilding: 'sun_stone_chapel', aiPersonality: 'warmonger',
    cityNames: ['Nueva Tenochtitlán', 'Guadalupe Roja', 'Monterrey Dome', 'Guadalajara Station', 'Puebla de los Cráteres', 'Mérida Crater', 'Oaxaca Base', 'Tijuana Outpost', 'Cancún Dust Shallows', 'Veracruz Landing', 'Zacatecas Deep', 'Chihuahua Dune', 'Taco Station Alpha', 'Fiesta Basin', 'Mañana, Mars'],
    portrait: { hue: 330, motif: 'mask', crest: 'eagle' },
    gender: 'f', alt: { name: 'Mateo Aguilar Ríos', title: 'Capitán and Keeper of the Ofrenda of the Quinto Sol Ark', gender: 'm', description: 'The crew made peace with death a long time ago. Every November, they invite it to dinner.' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type === 'unitDied' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 12, 'Día de Muertos', ctx.emit);
      },
      combat(ctx, a) {
        const unit = a.side === 'attack' ? a.attacker : a.defender;
        if (!unit || unit.owner !== ctx.player.id || unit.hp >= 50) return;
        (a.side === 'attack' ? a.attackMods : a.defenseMods).push({ label: 'Underdog', pct: 25 });
      },
      cityYield(_ctx, a) { a.pct.cul += 15; },
    },
  },
  argentina: {
    id: 'argentina', name: 'Lucía Benedetti', title: 'Comandante of the Pampa Ark', civName: 'Arca Pampa', adjective: 'Argentine',
    country: 'Argentina', code: 'ARG', flagColors: ['#74acdf', '#ffffff', '#f6b40e'], colors: { primary: '#8ecbf0', secondary: '#f3c94d' },
    description: 'The grill was lit, the tango was rehearsed, and the launch budget changed three times during the countdown.',
    bonus: 'Lichen Beds and Methane Seeps yield **+1** {food} and **+1** {gold}. Everything you buy with {gold} costs **15%** less, but the peso never rests: **3%** of banked {gold} evaporates each turn (max **10**).',
    startDoctrine: 'gaucho', uniqueUnit: 'gaucho_hoverbike', uniqueBuilding: 'estancia', aiPersonality: 'expansionist',
    cityNames: ['Nueva Buenos Aires', 'Córdoba Crater', 'Rosario Station', 'Mendoza Vintage', 'La Plata Basin', 'Tucumán Dome', 'Salta Heights', 'Mar del Plata Shallows', 'Ushuaia Frost', 'Bariloche Ice', 'Santa Fe, Mars', 'Pampa Station', 'Asado Alpha', 'Tango Landing', 'Empanada Heights'],
    portrait: { hue: 200, motif: 'horse', crest: 'sun' },
    gender: 'f', alt: { name: 'Joaquín Ferreyra', title: 'Comandante and Head Asador of the Pampa Ark', gender: 'm', description: 'The grill was lit, the tango was rehearsed, and the launch budget changed three times during the countdown.' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.resource === 'cattle' || a.tile.resource === 'sheep') { a.yields.food += 1; a.yields.gold += 1; }
      },
      cost(_ctx, a) { if (a.currency === 'gold') a.cost *= 0.85; },
      turnStart(ctx) {
        const loss = Math.min(Math.floor(ctx.player.gold * 0.03), 10);
        if (loss > 0) addGold(ctx.state, ctx.player.id, -loss, 'Inflation', ctx.emit);
      },
    },
  },
  colombia: {
    id: 'colombia', name: 'Valeria Quintero Montoya', title: 'Coffee Grower and Commander of the Arca Esmeralda', civName: 'Arca Esmeralda', adjective: 'Colombian',
    country: 'Colombia', code: 'COL', flagColors: ['#fcd116', '#003893', '#ce1126'], colors: { primary: '#12b076', secondary: '#f6c02a' },
    description: 'Three mountain ranges, one very strong coffee, and a launch nobody can fully explain. The official report says “a miracle.” The unofficial report says “several.”',
    bonus: 'Ridges yield **+1** {food}; Coffee Clones yield **+2** {gold}. Breakthrough rerolls cost **half**. Each turn there is a **1-in-12** chance of Magical Realism: gain **30** {gold}, **1** Cryo Pod, or a free Salvage card.',
    startDoctrine: 'cafetero', uniqueUnit: 'chiva_rover', uniqueBuilding: 'cafeteria_exchange', aiPersonality: 'expansionist',
    cityNames: ['Nueva Bogotá', 'Medellín Alta', 'Cali Orbital', 'Cartagena de Indias Rojas', 'Barranquilla Dome', 'Santa Marta Station', 'Bucaramanga Heights', 'Pereira Café', 'Manizales Crater', 'Armenia Quindío', 'Cúcuta Dust', 'El Dorado Two', 'Macondo', 'Villa de Leyva Dome', 'Cocora Valley'],
    portrait: { hue: 150, motif: 'chalice', crest: 'feather' },
    gender: 'f', alt: { name: 'Santiago Restrepo Villa', title: 'Emerald Prospector and Commander of the Arca Esmeralda', gender: 'm', description: 'Three mountain ranges, one very strong coffee, and a launch nobody can fully explain. The official report says “a miracle.” The unofficial report says “several.”' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.elevation === 'hills') a.yields.food += 1;
        if (a.tile.resource === 'sugar') a.yields.gold += 2;
      },
      researchReroll(_ctx, a) { a.value = Math.ceil(a.value / 2); },
      turnStart(ctx) {
        if (!chance(ctx.state.rng, 1 / 12)) return;
        const roll = randInt(ctx.state.rng, 3);
        if (roll === 1) {
          changeCryo(ctx.state, ctx.player.id, 1, ctx.emit);
          if (ctx.player.isHuman) notify(ctx, 'Magical Realism: a Cryo Pod appears in the cargo bay, nobody ordered it.');
          return;
        }
        const edict = roll === 2 && ctx.player.isHuman ? grantRandomEdict(ctx.state) : null;
        if (edict) { notify(ctx, `Magical Realism: ${edict} arrives, wrapped in yellow butterflies.`); return; }
        addGold(ctx.state, ctx.player.id, 30, 'Magical Realism', ctx.emit);
        if (ctx.player.isHuman) notify(ctx, 'Magical Realism: it rains Credits for four sols. Nobody asks why.');
      },
    },
  },
  chile: {
    id: 'chile', name: 'Dr. Ignacia Carrasco Millán', title: 'Chief Astronomer of the Cordillera Ark', civName: 'Arca Cordillera', adjective: 'Chilean',
    country: 'Chile', code: 'CHL', flagColors: ['#0039a6', '#ffffff', '#d52b1e'], colors: { primary: '#b8623a', secondary: '#3d5fa8' },
    description: 'A nation shaped like a hallway built an Ark shaped like a hallway. The hallway has a telescope.',
    bonus: 'Colonies may be founded **1** tile closer together. Dune Sea tiles yield **+1** {sci}. Regolith Mines yield **+1** {gold}.',
    startDoctrine: 'seismologist', uniqueUnit: 'andean_sentinel', uniqueBuilding: 'atacama_array', aiPersonality: 'scientist',
    cityNames: ['Nuevo Santiago', 'Valparaíso Dome', 'Atacama Lookout', 'Antofagasta Station', 'Concepción Crater', 'La Serena Clear-Sky', 'Punta Arenas Frost', 'Temuco Two', 'Calama Copper', 'Iquique Shallows', 'Puerto Montt Base', 'Chiloé Dome', 'Rapa Nui Watch', 'Torres del Paine', 'Pisco Sour Base'],
    portrait: { hue: 18, motif: 'eye', crest: 'star' },
    gender: 'f', alt: { name: 'Dr. Matías Ibáñez Soto', title: 'Chief Surveyor of the Cordillera Ark', gender: 'm', description: 'A nation shaped like a hallway built an Ark shaped like a hallway. The hallway has a telescope.' },
    effects: {
      canFoundCity(_ctx, a) { a.minDistance = Math.max(2, a.minDistance - 1); },
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'desert') a.yields.sci += 1;
        if (a.tile.improvement === 'mine' && !a.tile.pillaged) a.yields.gold += 1;
      },
    },
  },
  australia: {
    id: 'australia', name: 'Bronwyn Hartigan', title: 'Chief Ranger of the Southern Cross Ark', civName: 'Southern Cross Ark', adjective: 'Australian',
    country: 'Australia', code: 'AUS', flagColors: ['#00247d', '#ffffff', '#cf142b'], colors: { primary: '#7a5cc4', secondary: '#e8c46a' },
    description: 'Everything back home was trying to kill them. Mars is mostly a promotion.',
    bonus: 'Your units and Colonies take **half** Dust Storm damage. Dust Shallows yield **+1** {prod}. Martian Opal tiles yield **+2** {gold}.',
    startDoctrine: 'wildlife_ranger', uniqueUnit: 'boomerang_mortar', uniqueBuilding: 'shell_harbour', aiPersonality: 'expansionist',
    cityNames: ['Nova Sydney', 'Melbourne Crater', 'Perth Isolation', 'Brisbane Outpost', 'Adelaide Dome', 'Canberra Compromise', 'Darwin Heatwave', 'Alice Springs Two', 'Hobart Frost', 'Gold Coast Shallows', 'Cairns Reef', 'Broome Base', 'Bondi Beachhead', 'Coober Pedy Burrow', 'Down Under, Mars'],
    portrait: { hue: 265, motif: 'compass', crest: 'star' },
    gender: 'f', alt: { name: 'Declan Thornbury', title: 'Head Stockman of the Southern Cross Ark', gender: 'm', description: 'Everything back home was trying to kill them. Mars is mostly a promotion.' },
    effects: {
      storm(ctx, a) { if (a.victim === ctx.player.id) a.damage = Math.floor(a.damage / 2); },
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'coast') a.yields.prod += 1;
        if (a.tile.resource === 'gems') a.yields.gold += 2;
      },
    },
  },
  south_africa: {
    id: 'south_africa', name: 'Thandiwe van Wyk', title: 'Convener of the Rainbow Ark', civName: 'Rainbow Ark', adjective: 'South African',
    country: 'South Africa', code: 'ZAF', flagColors: ['#007749', '#ffb81c', '#de3831', '#002395'], colors: { primary: '#e6a817', secondary: '#1f6f4a' },
    description: 'Eleven official languages aboard, one airlock, and a braai that has never once started on schedule.',
    bonus: 'Each Sol Report gains **+1** {splendor} per different nationality among your Crew. Colonies beside a Massif make **+2** {prod} and **+2** {cul}. Platinum Nuggets and Martian Opal yield **+1** {gold}.',
    startDoctrine: 'braai_master', uniqueUnit: 'springbok_scrum', uniqueBuilding: 'reef_foundry', aiPersonality: 'builder',
    cityNames: ['Nuwe Johannesburg', 'Kaapstad Crater', 'Durban Shallows', 'Pretoria Prime', 'Soweto Station', 'Bloemfontein Base', 'Gqeberha Dome', 'Kimberley Big Hole', 'Stellenbosch Vintage', 'Table Mountain Two', 'Kruger Reserve', 'Sandton Heights', 'Pietermaritzburg Pass', 'Polokwane Plateau', 'Braai Alpha'],
    portrait: { hue: 42, motif: 'lion', crest: 'star' },
    gender: 'f', alt: { name: 'Sipho Ndlovu', title: 'Reef Foreman of the Rainbow Ark', gender: 'm', description: 'Eleven official languages aboard, one airlock, and a braai that has never once started on schedule.' },
    effects: {
      chronicle(ctx, c) {
        if (!ctx.player.isHuman) return;
        const nations: Record<string, true> = {};
        for (const d of ctx.state.run.doctrines) {
          const nation = DOCTRINES[d.id]?.nation;
          if (nation && !d.disabled) nations[nation] = true;
        }
        const n = Object.keys(nations).length;
        if (n) c.addSplendor(n, 'Rainbow Nation');
      },
      cityYield(ctx, a) {
        if (!neighbors(ctx.state.map, a.city.tile).some((n) => ctx.state.map.tiles[n]?.elevation === 'mountain')) return;
        a.yields.prod += 2;
        a.yields.cul += 2;
      },
      tileYield(_ctx, a) { if (a.tile.resource === 'gold' || a.tile.resource === 'gems') a.yields.gold += 1; },
    },
  },
  egypt: {
    id: 'egypt', name: 'Dr. Amira Khalil', title: 'Curator-General of the Sphinx Ark', civName: 'Sphinx Ark', adjective: 'Egyptian',
    country: 'Egypt', code: 'EGY', flagColors: ['#ce1126', '#ffffff', '#000000'], colors: { primary: '#2a7de1', secondary: '#d9b04a' }, cryo: 5,
    description: 'Five thousand years of planning for a very long sleep turned out to be excellent preparation for a cryo bay.',
    bonus: 'Start with **+2** Cryo Pods. Each Thaw wakes **1 extra** colonist. Ancient Delta tiles yield **+1** {food} and **+1** {cul}. Borders grow **25%** faster.',
    startDoctrine: 'royal_scribe', uniqueUnit: 'medjay_sentry', uniqueBuilding: 'house_of_life', aiPersonality: 'builder',
    cityNames: ['New Thebes', 'Cairo Prime', 'Alexandria Annex', 'Giza Landing', 'Luxor Dome', 'Aswan Dam Two', 'Memphis Station', 'Karnak Crater', 'Sharm Shallows', 'Nile Basin', 'Port Said Dock', 'Heliopolis Two', 'Abu Simbel Cliff', 'Sphinx Base', 'Siwa Geyser Dome'],
    portrait: { hue: 215, motif: 'pyramid', crest: 'eye' },
    gender: 'f', alt: { name: 'Dr. Youssef Mansour', title: 'Chief Archaeologist of the Sphinx Ark', gender: 'm', description: 'Five thousand years of planning for a very long sleep turned out to be excellent preparation for a cryo bay.' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.feature === 'floodplains') { a.yields.food += 1; a.yields.cul += 1; }
      },
      borderThreshold(_ctx, a) { a.value = Math.round(a.value * 0.75); },
      onEvent(ctx, ev) {
        if (ev.type !== 'colonistsThawed' || ev.player !== ctx.player.id) return;
        const city = ctx.state.cities[ev.cityId];
        if (city) changePop(ctx.state, city, 1, ctx.emit);
      },
    },
  },
  iran: {
    id: 'iran', name: 'Dr. Shirin Karimi-Nejad', title: 'Astronomer-Poet and Navigator of the Pardis Ark', civName: 'Pardis Ark', adjective: 'Iranian',
    country: 'Iran', code: 'IRN', flagColors: ['#239f40', '#ffffff', '#da0000'], colors: { primary: '#b3263e', secondary: '#39b9a8' },
    description: 'A garden, a poem and a rug that survived the crossing. The garden is currently the most heavily defended object on the Ark.',
    bonus: 'At the start of every Era (Nowruz), gain **50** {gold} and a free Salvage card. Saffron Seedstock, Bio-Cotton, Spider-Silk Culture and Jarosite Pigment yield **+1** {gold} and **+1** {cul}. Dune Sea tiles yield **+1** {food}.',
    startDoctrine: 'garden_keeper', uniqueUnit: 'immortal_guard', uniqueBuilding: 'qanat_reclaimer', aiPersonality: 'builder',
    cityNames: ['New Isfahan', 'Tehran Dome', 'Shiraz Garden', 'Tabriz Station', 'Persepolis Two', 'Mashhad Base', 'Yazd Windcatcher', 'Kerman Crater', 'Kashan Carpet Works', 'Ahvaz Deep', 'Rasht Shallows', 'Hamadan Heights', 'Pasargadae Landing', 'Naqsh-e Mars', 'Nowruz Station'],
    portrait: { hue: 350, motif: 'feather', crest: 'sun' },
    gender: 'f', alt: { name: 'Dr. Kaveh Rostami', title: 'Engineer-Poet and Water-Keeper of the Pardis Ark', gender: 'm', description: 'A garden, a poem and a rug that survived the crossing. The garden is currently the most heavily defended object on the Ark.' },
    effects: {
      tileYield(_ctx, a) {
        const res = a.tile.resource;
        if (res && CARPET_LUXURIES[res]) { a.yields.gold += 1; a.yields.cul += 1; }
        if (a.tile.terrain === 'desert') a.yields.food += 1;
      },
      onEvent(ctx, ev) {
        if (ev.type !== 'eraStarted') return;
        addGold(ctx.state, ctx.player.id, 50, 'Nowruz gifts', ctx.emit);
        if (!ctx.player.isHuman) return;
        const edict = grantRandomEdict(ctx.state);
        if (edict) notify(ctx, `Nowruz: the table is set, and ${edict} sits at it.`);
      },
    },
  },
  pakistan: {
    id: 'pakistan', name: 'Major Ayesha Chaudhry', title: 'Expedition Leader of the Karakoram Ark', civName: 'Karakoram Ark', adjective: 'Pakistani',
    country: 'Pakistan', code: 'PAK', flagColors: ['#01411c', '#ffffff'], colors: { primary: '#1c6b50', secondary: '#e8f1ea' },
    description: 'The mountaineers reached the launch pad first. The truck painters arrived two hours later and made it look better.',
    bonus: 'Ridges yield **+1** {prod}. Your units fight at **+20%** strength while standing on Ridges. Relay Stations yield **+1** {gold} and **+1** {cul}: every truck gets repainted.',
    startDoctrine: 'truck_artist', uniqueUnit: 'karakoram_marksman', uniqueBuilding: 'karakoram_ramparts', aiPersonality: 'warmonger',
    cityNames: ['New Islamabad', 'Karachi Shallows', 'Lahore Garden Dome', 'Rawalpindi Base', 'Peshawar Pass', 'Quetta Crater', 'Multan Dust', 'Faisalabad Works', 'Sindh Delta', 'Gilgit Heights', 'Skardu Station', 'K2 Base Camp', 'Hunza Valley Dome', 'Indus Bend', 'Jingle Junction'],
    portrait: { hue: 155, motif: 'mountain', crest: 'moon' },
    gender: 'f', alt: { name: 'Captain Hamza Qureshi', title: 'Convoy Commander of the Karakoram Ark', gender: 'm', description: 'The mountaineers reached the launch pad first. The truck painters arrived two hours later and made it look better.' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.elevation === 'hills') a.yields.prod += 1;
        if (a.tile.improvement === 'trading_post' && !a.tile.pillaged) { a.yields.gold += 1; a.yields.cul += 1; }
      },
      combat(ctx, a) {
        const unit = a.side === 'attack' ? a.attacker : a.defender;
        if (!unit || unit.owner !== ctx.player.id) return;
        const own = a.side === 'attack' ? a.fromTile : a.tile;
        if (own.elevation !== 'hills') return;
        (a.side === 'attack' ? a.attackMods : a.defenseMods).push({ label: 'High Altitude', pct: 20 });
      },
    },
  },
};

export const CREW_AMERICAS: DoctrineDef[] = [
  {
    id: 'maple_tapper', name: 'The Maple Tapper', rarity: 'uncommon', cost: 6, noShop: true, nation: 'canada',
    description: 'Taps the Hoodoo Fields for something sweet and legally debatable. Every Colony working a Hoodoo Field makes **+2** {gold}.',
    flavor: '“It is not syrup. It is liquid diplomacy.”', tags: ['nation', 'credits', 'terrain'], icon: 'tree', art: { hue: 12, motif: 'tree' },
    effects: {
      cityYield(ctx, a) {
        if (a.city.worked.some((idx) => ctx.state.map.tiles[idx]?.feature === 'forest')) a.yields.gold += 2;
      },
    },
  },
  {
    id: 'la_catrina', name: 'La Catrina', rarity: 'uncommon', cost: 6, noShop: true, nation: 'mexico',
    description: 'Elegant, skeletal and delighted to see everyone. Each Sol Report gains **+1** {splendor} for every unit lost that chapter (max **+5**).',
    flavor: '“The dead are not gone. They are just on a very long rotation.”', tags: ['nation', 'combat', 'splendor'], icon: 'skull', art: { hue: 335, motif: 'skull' },
    effects: {
      chronicle(_ctx, c) {
        const n = Math.min(5, c.stats.unitsLost);
        if (n > 0) c.addSplendor(n, 'La Catrina');
      },
    },
  },
  {
    id: 'gaucho', name: 'The Gaucho', rarity: 'uncommon', cost: 6, noShop: true, nation: 'argentina',
    description: 'Rides the plains like he owns them, and in a sense he does. Your mounted units gain **+1** Moves and **+20%** strength while fighting on Regolith Plain.',
    flavor: '“The rover knows the way. The rover has opinions about the route.”', tags: ['nation', 'units', 'terrain'], icon: 'mounted', art: { hue: 200, motif: 'horse' },
    effects: {
      unitMoves(ctx, a) { if (a.unit.owner === ctx.player.id && UNITS[a.unit.type]?.class === 'mounted') a.value += 1; },
      combat(ctx, a) {
        const unit = a.side === 'attack' ? a.attacker : a.defender;
        if (!unit || unit.owner !== ctx.player.id || UNITS[unit.type]?.class !== 'mounted') return;
        const own = a.side === 'attack' ? a.fromTile : a.tile;
        if (own.terrain !== 'plains') return;
        (a.side === 'attack' ? a.attackMods : a.defenseMods).push({ label: 'Pampa Charge', pct: 20 });
      },
    },
  },
  {
    id: 'cafetero', name: 'The Cafetero', rarity: 'uncommon', cost: 6, noShop: true, nation: 'colombia',
    description: 'Hand-picks every bean and distrusts any machine that says it can do the same. Each luxury tile your Colonies work yields **+1** {sci} (max **3** per Colony).',
    flavor: '“This is not caffeine. This is infrastructure.”', tags: ['nation', 'science', 'luxuries'], icon: 'flask', art: { hue: 150, motif: 'chalice' },
    effects: {
      cityYield(ctx, a) {
        let n = 0;
        for (const idx of a.city.worked) {
          const res = ctx.state.map.tiles[idx]?.resource;
          if (res && RESOURCES[res]?.kind === 'luxury') n++;
        }
        if (n > 0) a.yields.sci += Math.min(3, n);
      },
    },
  },
  {
    id: 'seismologist', name: 'The Seismologist', rarity: 'uncommon', cost: 6, noShop: true, nation: 'chile',
    description: 'Has felt every tremor since childhood and filed a report on each. Your Colonies take **half** Dust Storm damage.',
    flavor: '“It is not shaking. It is a very enthusiastic planet.”', tags: ['nation', 'storm', 'defense'], icon: 'shield', art: { hue: 20, motif: 'mountain' },
    effects: {
      storm(ctx, a) { if (a.victim === ctx.player.id && a.city) a.damage = Math.floor(a.damage / 2); },
    },
  },
  {
    id: 'wildlife_ranger', name: 'The Wildlife Ranger', rarity: 'uncommon', cost: 6, noShop: true, nation: 'australia',
    description: 'There is a joey in her jacket and a snake in her boot; both are technically cargo. At the start of each Era, gain **1** Cryo Pod (nobody knows where she keeps them).',
    flavor: '“No, the pouch is not full. The pouch is never full.”', tags: ['nation', 'cryo', 'colonies'], icon: 'hand', art: { hue: 265, motif: 'compass' },
    effects: {
      onEvent(ctx, ev) { if (ev.type === 'eraStarted') changeCryo(ctx.state, ctx.player.id, 1, ctx.emit); },
    },
  },
  {
    id: 'braai_master', name: 'The Braai Master', rarity: 'uncommon', cost: 6, noShop: true, nation: 'south_africa',
    description: 'One fire, one grill and an argument settled over meat. Your empire gains **+6** {happy}, and every Colony gains **+10%** {cul}.',
    flavor: 'Nobody has ever left a braai angry. Several have left it late.', tags: ['nation', 'happiness', 'culture'], icon: 'flame', art: { hue: 28, motif: 'flame' },
    effects: {
      happiness(_ctx, a) { a.value += 6; },
      cityYield(_ctx, a) { a.pct.cul += 10; },
    },
  },
  {
    id: 'royal_scribe', name: 'The Royal Scribe', rarity: 'uncommon', cost: 6, noShop: true, nation: 'egypt',
    description: 'Counts everything twice and writes it down once, in stone. Each Sol Report gains **+1** {splendor} per Data Archive or House of Life you own (max **+5**).',
    flavor: '“The backup is carved. The backup of the backup is also carved.”', tags: ['nation', 'science', 'splendor'], icon: 'book', art: { hue: 45, motif: 'scroll' },
    effects: {
      chronicle(_ctx, c) {
        let n = 0;
        for (const city of c.cities) if (city.buildings.includes('library') || city.buildings.includes('house_of_life')) n++;
        if (n > 0) c.addSplendor(Math.min(5, n), 'Royal Scribe');
      },
    },
  },
  {
    id: 'garden_keeper', name: 'The Garden Keeper', rarity: 'uncommon', cost: 6, noShop: true, nation: 'iran',
    description: 'A paradise is only a garden with a good irrigation plan. Every Colony with a Water Reclaimer makes **+2** {food} and **+2** {cul}.',
    flavor: '“Do not tell the algae it is the second most important thing here.”', tags: ['nation', 'food', 'culture'], icon: 'tree', art: { hue: 150, motif: 'tree' },
    effects: {
      cityYield(_ctx, a) {
        if (!a.city.buildings.includes('aqueduct') && !a.city.buildings.includes('qanat_reclaimer')) return;
        a.yields.food += 2;
        a.yields.cul += 2;
      },
    },
  },
  {
    id: 'truck_artist', name: 'The Truck Artist', rarity: 'uncommon', cost: 6, noShop: true, nation: 'pakistan',
    description: 'Paints flowers, eagles and cheerful warnings on everything that moves. Each Sol Report gains **+1** {splendor} per Relay Station you own (max **+6**).',
    flavor: '“If it carries cargo, it also carries a poem. Yes, the poem is on the bumper.”', tags: ['nation', 'installations', 'splendor'], icon: 'hand', art: { hue: 130, motif: 'hand' },
    effects: {
      chronicle(ctx, c) {
        let n = 0;
        for (const tile of ctx.state.map.tiles) if (tile.owner === ctx.player.id && tile.improvement === 'trading_post' && !tile.pillaged) n++;
        if (n > 0) c.addSplendor(Math.min(6, n), 'Truck Artist');
      },
    },
  },
];

registerCrew(CREW_AMERICAS);
