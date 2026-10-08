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
    id: 'canada', name: 'Marguerite Beaulieu', title: 'Aurora Ark Rescue Chief', civName: 'Aurora Ark', adjective: 'Canadian',
    country: 'Canada', code: 'CAN', flagColors: ['#d80621', '#ffffff'], colors: { primary: '#e2574c', secondary: '#f6efe4' },
    description: 'Everyone holds the airlock open for the next person. Everyone also says sorry.',
    bonus: 'Your units heal **+10** HP each turn. Rock Spires tiles yield **+1** {food}. When you clear a Raider Camp, gain **60** {gold} and **1** {influence}.',
    startDoctrine: 'maple_tapper', uniqueUnit: 'mountie_sled', uniqueBuilding: 'universal_med_bay', aiPersonality: 'builder',
    cityNames: ['Nouvelle Ottawa', 'Toronto Dome', 'Montréal Souterrain', 'Vancouver Shallows', 'Calgary Crater', 'Edmonton Frost', 'Winnipeg Winter', 'Halifax Landing', 'Yellowknife Two', 'Saskatoon Station', 'Victoria Vent', 'Whitehorse Ridge', 'Niagara Falls Down', 'Moose Jaw Outpost', 'Sorry, Mars'],
    portrait: { hue: 5, motif: 'tree', crest: 'laurel' },
    gender: 'f', alt: { name: 'Étienne Gallant', title: 'Aurora Ark Ice-Road Chief', gender: 'm', description: 'Everyone holds the airlock open for the next person. Everyone also says sorry.' },
    effects: {
      unitHeal(ctx, a) { if (a.unit.owner === ctx.player.id) a.value += 10; },
      tileYield(_ctx, a) { if (a.tile.feature === 'forest') a.yields.food += 1; },
      onEvent(ctx, ev) {
        if (ev.type !== 'campCleared' || ev.player !== ctx.player.id) return;
        addGold(ctx.state, ctx.player.id, 60, 'Rescue aid', ctx.emit);
        if (ctx.player.isHuman) addInfluence(ctx.state, 1, ctx.emit);
      },
    },
  },
  mexico: {
    id: 'mexico', name: 'Itzel Navarro Cruz', title: 'Quinto Sol Ark Commander', civName: 'Arca Quinto Sol', adjective: 'Mexican',
    country: 'Mexico', code: 'MEX', flagColors: ['#006847', '#ffffff', '#ce1126'], colors: { primary: '#e0529c', secondary: '#2f8f5b' },
    description: 'The crew is not afraid of death. Every November, they invite it to dinner.',
    bonus: 'When you lose a unit, gain **12** {gold}. Your units fight with **+25%** strength when below half health. **+15%** {cul}.',
    startDoctrine: 'la_catrina', uniqueUnit: 'luchador_trooper', uniqueBuilding: 'sun_stone_chapel', aiPersonality: 'warmonger',
    cityNames: ['Nueva Tenochtitlán', 'Guadalupe Roja', 'Monterrey Dome', 'Guadalajara Station', 'Puebla de los Cráteres', 'Mérida Crater', 'Oaxaca Base', 'Tijuana Outpost', 'Cancún Shallows', 'Veracruz Landing', 'Zacatecas Deep', 'Chihuahua Dune', 'Taco Station Alpha', 'Fiesta Basin', 'Mañana, Mars'],
    portrait: { hue: 330, motif: 'mask', crest: 'eagle' },
    gender: 'f', alt: { name: 'Mateo Aguilar Ríos', title: 'Quinto Sol Ark Captain', gender: 'm', description: 'The crew is not afraid of death. Every November, they invite it to dinner.' },
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
    id: 'argentina', name: 'Lucía Benedetti', title: 'Pampa Ark Commander', civName: 'Arca Pampa', adjective: 'Argentine',
    country: 'Argentina', code: 'ARG', flagColors: ['#74acdf', '#ffffff', '#f6b40e'], colors: { primary: '#8ecbf0', secondary: '#f3c94d' },
    description: 'The grill was lit and the tango was ready. The launch plan changed three times.',
    bonus: 'Lichen Beds and Methane Seeps yield **+1** {food} and **+1** {gold}. Everything you buy with {gold} costs **15%** less. Every turn, you lose **3%** of your {gold} (max **10**).',
    startDoctrine: 'gaucho', uniqueUnit: 'gaucho_hoverbike', uniqueBuilding: 'estancia', aiPersonality: 'expansionist',
    cityNames: ['Nueva Buenos Aires', 'Córdoba Crater', 'Rosario Station', 'Mendoza Vintage', 'La Plata Basin', 'Tucumán Dome', 'Salta Heights', 'Mar del Plata Shallows', 'Ushuaia Frost', 'Bariloche Ice', 'Santa Fe, Mars', 'Pampa Station', 'Asado Alpha', 'Tango Landing', 'Empanada Heights'],
    portrait: { hue: 200, motif: 'horse', crest: 'sun' },
    gender: 'f', alt: { name: 'Joaquín Ferreyra', title: 'Pampa Ark Grill Master', gender: 'm', description: 'The grill was lit and the tango was ready. The launch plan changed three times.' },
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
    id: 'colombia', name: 'Valeria Quintero Montoya', title: 'Coffee Grower and Ark Commander', civName: 'Arca Esmeralda', adjective: 'Colombian',
    country: 'Colombia', code: 'COL', flagColors: ['#fcd116', '#003893', '#ce1126'], colors: { primary: '#12b076', secondary: '#f6c02a' },
    description: 'Three mountain ranges, very strong coffee, and a launch nobody can explain. The report says “a miracle.”',
    bonus: 'Hills yield **+1** {food}. Coffee Clones yield **+2** {gold}. Research rerolls cost **half**. Every turn, there is a **1-in-12** chance to gain **30** {gold}, **1** Pod, or a free Boost.',
    startDoctrine: 'cafetero', uniqueUnit: 'chiva_rover', uniqueBuilding: 'cafeteria_exchange', aiPersonality: 'expansionist',
    cityNames: ['Nueva Bogotá', 'Medellín Alta', 'Cali Orbital', 'Cartagena de Indias Rojas', 'Barranquilla Dome', 'Santa Marta Station', 'Bucaramanga Heights', 'Pereira Café', 'Manizales Crater', 'Armenia Quindío', 'Cúcuta Dust', 'El Dorado Two', 'Macondo', 'Villa de Leyva Dome', 'Cocora Valley'],
    portrait: { hue: 150, motif: 'chalice', crest: 'feather' },
    gender: 'f', alt: { name: 'Santiago Restrepo Villa', title: 'Emerald Miner and Ark Commander', gender: 'm', description: 'Three mountain ranges, very strong coffee, and a launch nobody can explain. The report says “a miracle.”' },
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
          if (ctx.player.isHuman) notify(ctx, 'Magical Realism: a Pod appears in the cargo bay. Nobody ordered it.');
          return;
        }
        const edict = roll === 2 && ctx.player.isHuman ? grantRandomEdict(ctx.state) : null;
        if (edict) { notify(ctx, `Magical Realism: ${edict} arrives, wrapped in yellow butterflies.`); return; }
        addGold(ctx.state, ctx.player.id, 30, 'Magical Realism', ctx.emit);
        if (ctx.player.isHuman) notify(ctx, 'Magical Realism: it rains Credits for four turns. Nobody asks why.');
      },
    },
  },
  chile: {
    id: 'chile', name: 'Dr. Ignacia Carrasco Millán', title: 'Cordillera Ark Chief Astronomer', civName: 'Arca Cordillera', adjective: 'Chilean',
    country: 'Chile', code: 'CHL', flagColors: ['#0039a6', '#ffffff', '#d52b1e'], colors: { primary: '#b8623a', secondary: '#3d5fa8' },
    description: 'A long, thin nation built a long, thin Ark. It has a telescope.',
    bonus: 'You can found Colonies **1** tile closer together. Dunes yield **+1** {sci}. Ground Mines yield **+1** {gold}.',
    startDoctrine: 'seismologist', uniqueUnit: 'andean_sentinel', uniqueBuilding: 'atacama_array', aiPersonality: 'scientist',
    cityNames: ['Nuevo Santiago', 'Valparaíso Dome', 'Atacama Lookout', 'Antofagasta Station', 'Concepción Crater', 'La Serena Clear-Sky', 'Punta Arenas Frost', 'Temuco Two', 'Calama Copper', 'Iquique Shallows', 'Puerto Montt Base', 'Chiloé Dome', 'Rapa Nui Watch', 'Torres del Paine', 'Pisco Sour Base'],
    portrait: { hue: 18, motif: 'eye', crest: 'star' },
    gender: 'f', alt: { name: 'Dr. Matías Ibáñez Soto', title: 'Cordillera Ark Chief Mapper', gender: 'm', description: 'A long, thin nation built a long, thin Ark. It has a telescope.' },
    effects: {
      canFoundCity(_ctx, a) { a.minDistance = Math.max(2, a.minDistance - 1); },
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'desert') a.yields.sci += 1;
        if (a.tile.improvement === 'mine') a.yields.gold += 1;
      },
    },
  },
  australia: {
    id: 'australia', name: 'Bronwyn Hartigan', title: 'Southern Cross Chief Ranger', civName: 'Southern Cross Ark', adjective: 'Australian',
    country: 'Australia', code: 'AUS', flagColors: ['#00247d', '#ffffff', '#cf142b'], colors: { primary: '#7a5cc4', secondary: '#e8c46a' },
    description: 'At home, everything tried to kill them. Mars is easier.',
    bonus: 'Your units and Colonies take **half** damage from Dust Storms. Shallows yield **+1** {prod}. Martian Opal tiles yield **+2** {gold}.',
    startDoctrine: 'wildlife_ranger', uniqueUnit: 'boomerang_mortar', uniqueBuilding: 'shell_harbour', aiPersonality: 'expansionist',
    cityNames: ['Nova Sydney', 'Melbourne Crater', 'Perth Isolation', 'Brisbane Outpost', 'Adelaide Dome', 'Canberra Compromise', 'Darwin Heatwave', 'Alice Springs Two', 'Hobart Frost', 'Gold Coast Shallows', 'Cairns Reef', 'Broome Base', 'Bondi Beachhead', 'Coober Pedy Burrow', 'Down Under, Mars'],
    portrait: { hue: 265, motif: 'compass', crest: 'star' },
    gender: 'f', alt: { name: 'Declan Thornbury', title: 'Southern Cross Cattle Boss', gender: 'm', description: 'At home, everything tried to kill them. Mars is easier.' },
    effects: {
      storm(ctx, a) { if (a.victim === ctx.player.id) a.damage = Math.floor(a.damage / 2); },
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'coast') a.yields.prod += 1;
        if (a.tile.resource === 'gems') a.yields.gold += 2;
      },
    },
  },
  south_africa: {
    id: 'south_africa', name: 'Thandiwe van Wyk', title: 'Rainbow Ark Leader', civName: 'Rainbow Ark', adjective: 'South African',
    country: 'South Africa', code: 'ZAF', flagColors: ['#007749', '#ffb81c', '#de3831', '#002395'], colors: { primary: '#e6a817', secondary: '#1f6f4a' },
    description: 'Eleven languages, one airlock. The barbecue never starts on time.',
    bonus: 'At the end of each chapter, gain **+1** {splendor} for each different Nation among your Crew. Colonies next to Mountains make **+2** {prod} and **+2** {cul}. Platinum Nuggets and Martian Opal yield **+1** {gold}.',
    startDoctrine: 'braai_master', uniqueUnit: 'springbok_scrum', uniqueBuilding: 'reef_foundry', aiPersonality: 'builder',
    cityNames: ['Nuwe Johannesburg', 'Kaapstad Crater', 'Durban Shallows', 'Pretoria Prime', 'Soweto Station', 'Bloemfontein Base', 'Gqeberha Dome', 'Kimberley Big Hole', 'Stellenbosch Vintage', 'Table Mountain Two', 'Kruger Reserve', 'Sandton Heights', 'Pietermaritzburg Pass', 'Polokwane Plateau', 'Braai Alpha'],
    portrait: { hue: 42, motif: 'lion', crest: 'star' },
    gender: 'f', alt: { name: 'Sipho Ndlovu', title: 'Rainbow Ark Mine Boss', gender: 'm', description: 'Eleven languages, one airlock. The barbecue never starts on time.' },
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
    id: 'egypt', name: 'Dr. Amira Khalil', title: 'Sphinx Ark Museum Chief', civName: 'Sphinx Ark', adjective: 'Egyptian',
    country: 'Egypt', code: 'EGY', flagColors: ['#ce1126', '#ffffff', '#000000'], colors: { primary: '#2a7de1', secondary: '#d9b04a' }, cryo: 5,
    description: 'Five thousand years of planning for a long sleep. Perfect practice for a Pod bay.',
    bonus: 'Start with **+2** Pods. Old Delta tiles yield **+1** {food} and **+1** {cul}. Colony borders grow **25%** faster. When you Wake Colonists, **1 extra** colonist wakes.',
    startDoctrine: 'royal_scribe', uniqueUnit: 'medjay_sentry', uniqueBuilding: 'house_of_life', aiPersonality: 'builder',
    cityNames: ['New Thebes', 'Cairo Prime', 'Alexandria Annex', 'Giza Landing', 'Luxor Dome', 'Aswan Dam Two', 'Memphis Station', 'Karnak Crater', 'Sharm Shallows', 'Nile Basin', 'Port Said Dock', 'Heliopolis Two', 'Abu Simbel Cliff', 'Sphinx Base', 'Siwa Geyser Dome'],
    portrait: { hue: 215, motif: 'pyramid', crest: 'eye' },
    gender: 'f', alt: { name: 'Dr. Youssef Mansour', title: 'Sphinx Ark Ruins Expert', gender: 'm', description: 'Five thousand years of planning for a long sleep. Perfect practice for a Pod bay.' },
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
    id: 'iran', name: 'Dr. Shirin Karimi-Nejad', title: 'Star Poet and Ark Navigator', civName: 'Pardis Ark', adjective: 'Iranian',
    country: 'Iran', code: 'IRN', flagColors: ['#239f40', '#ffffff', '#da0000'], colors: { primary: '#b3263e', secondary: '#39b9a8' },
    description: 'A garden, a poem and a rug survived the trip. The garden is the best-defended thing on the Ark.',
    bonus: 'Saffron Seeds, Bio-Cotton, Spider Silk and Yellow Pigment yield **+1** {gold} and **+1** {cul}. Dunes yield **+1** {food}. At the start of each era, gain **50** {gold} and a free Boost.',
    startDoctrine: 'garden_keeper', uniqueUnit: 'immortal_guard', uniqueBuilding: 'qanat_reclaimer', aiPersonality: 'builder',
    cityNames: ['New Isfahan', 'Tehran Dome', 'Shiraz Garden', 'Tabriz Station', 'Persepolis Two', 'Mashhad Base', 'Yazd Windcatcher', 'Kerman Crater', 'Kashan Carpet Works', 'Ahvaz Deep', 'Rasht Shallows', 'Hamadan Heights', 'Pasargadae Landing', 'Naqsh-e Mars', 'Nowruz Station'],
    portrait: { hue: 350, motif: 'feather', crest: 'sun' },
    gender: 'f', alt: { name: 'Dr. Kaveh Rostami', title: 'Water Engineer and Poet', gender: 'm', description: 'A garden, a poem and a rug survived the trip. The garden is the best-defended thing on the Ark.' },
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
    id: 'pakistan', name: 'Major Ayesha Chaudhry', title: 'Karakoram Ark Expedition Leader', civName: 'Karakoram Ark', adjective: 'Pakistani',
    country: 'Pakistan', code: 'PAK', flagColors: ['#01411c', '#ffffff'], colors: { primary: '#1c6b50', secondary: '#e8f1ea' },
    description: 'The mountain climbers reached the launch pad first. The truck painters came later and made it look better.',
    bonus: 'Hills yield **+1** {prod}. Relay Stations yield **+1** {gold} and **+1** {cul}. Your units fight with **+20%** strength when they stand on Hills.',
    startDoctrine: 'truck_artist', uniqueUnit: 'karakoram_marksman', uniqueBuilding: 'karakoram_ramparts', aiPersonality: 'warmonger',
    cityNames: ['New Islamabad', 'Karachi Shallows', 'Lahore Garden Dome', 'Rawalpindi Base', 'Peshawar Pass', 'Quetta Crater', 'Multan Dust', 'Faisalabad Works', 'Sindh Delta', 'Gilgit Heights', 'Skardu Station', 'K2 Base Camp', 'Hunza Valley Dome', 'Indus Bend', 'Jingle Junction'],
    portrait: { hue: 155, motif: 'mountain', crest: 'moon' },
    gender: 'f', alt: { name: 'Captain Hamza Qureshi', title: 'Karakoram Ark Convoy Chief', gender: 'm', description: 'The mountain climbers reached the launch pad first. The truck painters came later and made it look better.' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.elevation === 'hills') a.yields.prod += 1;
        if (a.tile.improvement === 'trading_post') { a.yields.gold += 1; a.yields.cul += 1; }
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
    description: 'Taps Rock Spires for something sweet. Every Colony that works a Rock Spires tile makes **+2** {gold}.',
    flavor: '“It is not syrup. It is a gift for friends.”', tags: ['nation', 'credits', 'terrain'], icon: 'tree', art: { hue: 12, motif: 'tree' },
    effects: {
      cityYield(ctx, a) {
        if (a.city.worked.some((idx) => ctx.state.map.tiles[idx]?.feature === 'forest')) a.yields.gold += 2;
      },
    },
  },
  {
    id: 'la_catrina', name: 'La Catrina', rarity: 'uncommon', cost: 6, noShop: true, nation: 'mexico',
    description: 'Elegant, a skeleton, and happy to see everyone. At the end of each chapter, gain **+1** {splendor} for each unit you lost that chapter (max **+5**).',
    flavor: '“The dead are not gone. They are on a long break.”', tags: ['nation', 'combat', 'splendor'], icon: 'skull', art: { hue: 335, motif: 'skull' },
    effects: {
      chronicle(_ctx, c) {
        const n = Math.min(5, c.stats.unitsLost);
        if (n > 0) c.addSplendor(n, 'La Catrina');
      },
    },
  },
  {
    id: 'gaucho', name: 'The Gaucho', rarity: 'uncommon', cost: 6, noShop: true, nation: 'argentina',
    description: 'Rides the plains as if he owns them. Your mounted units get **+1** Moves, and **+20%** strength when they fight on Plains.',
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
    id: 'cafetero', name: 'The Coffee Grower', rarity: 'uncommon', cost: 6, noShop: true, nation: 'colombia',
    description: 'Picks every bean by hand and does not trust machines. Each Colony gets **+1** {sci} for each luxury tile it works (max **+3**).',
    flavor: '“This is not just coffee. This is power.”', tags: ['nation', 'science', 'luxuries'], icon: 'flask', art: { hue: 150, motif: 'chalice' },
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
    id: 'seismologist', name: 'The Quake Expert', rarity: 'uncommon', cost: 6, noShop: true, nation: 'chile',
    description: 'Has felt every small quake since childhood. Your Colonies take **half** damage from Dust Storms.',
    flavor: '“It is not shaking. It is a very excited planet.”', tags: ['nation', 'storm', 'defense'], icon: 'shield', art: { hue: 20, motif: 'mountain' },
    effects: {
      storm(ctx, a) { if (a.victim === ctx.player.id && a.city) a.damage = Math.floor(a.damage / 2); },
    },
  },
  {
    id: 'wildlife_ranger', name: 'The Wildlife Ranger', rarity: 'uncommon', cost: 6, noShop: true, nation: 'australia',
    description: 'Keeps a baby kangaroo in her jacket and a snake in her boot. At the start of each era, gain **1** Pod.',
    flavor: '“Is the pocket full? No. The pocket is never full.”', tags: ['nation', 'cryo', 'colonies'], icon: 'hand', art: { hue: 265, motif: 'compass' },
    effects: {
      onEvent(ctx, ev) { if (ev.type === 'eraStarted') changeCryo(ctx.state, ctx.player.id, 1, ctx.emit); },
    },
  },
  {
    id: 'braai_master', name: 'The Grill Master', rarity: 'uncommon', cost: 6, noShop: true, nation: 'south_africa',
    description: 'One fire, one grill, and every argument ends with a meal. You get **+6** {happy}. Every Colony gets **+10%** {cul}.',
    flavor: 'Nobody leaves a barbecue angry. Many leave it late.', tags: ['nation', 'happiness', 'culture'], icon: 'flame', art: { hue: 28, motif: 'flame' },
    effects: {
      happiness(_ctx, a) { a.value += 6; },
      cityYield(_ctx, a) { a.pct.cul += 10; },
    },
  },
  {
    id: 'royal_scribe', name: 'The Royal Writer', rarity: 'uncommon', cost: 6, noShop: true, nation: 'egypt',
    description: 'Counts everything twice and writes it once, in stone. At the end of each chapter, gain **+1** {splendor} for each Colony with a Data Archive or House of Life (max **+5**).',
    flavor: '“The backup is carved in stone. So is the backup of the backup.”', tags: ['nation', 'science', 'splendor'], icon: 'book', art: { hue: 45, motif: 'scroll' },
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
    description: 'A paradise is just a garden with a good water plan. Every Colony with a Water Recycler or Tunnel Recycler makes **+2** {food} and **+2** {cul}.',
    flavor: '“Do not tell the algae it is second most important here.”', tags: ['nation', 'food', 'culture'], icon: 'tree', art: { hue: 150, motif: 'tree' },
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
    description: 'Paints flowers and birds on everything that moves. At the end of each chapter, gain **+1** {splendor} for each Relay Station you own (max **+6**).',
    flavor: '“If it carries cargo, it carries a poem. The poem is on the bumper.”', tags: ['nation', 'installations', 'splendor'], icon: 'hand', art: { hue: 130, motif: 'hand' },
    effects: {
      chronicle(ctx, c) {
        let n = 0;
        for (const tile of ctx.state.map.tiles) if (tile.owner === ctx.player.id && tile.improvement === 'trading_post') n++;
        if (n > 0) c.addSplendor(Math.min(6, n), 'Truck Artist');
      },
    },
  },
];

registerCrew(CREW_AMERICAS);
