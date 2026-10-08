// OWNER: Nations (Asia slice). Leader effects apply to every player led by that nation (AIs included): hooks always use ctx.player.
// Run-level perks (run.edicts, influence) are guarded by ctx.player.isHuman like France/Russia/Vatican.
import type { DoctrineDef, LeaderDef } from '../../sim/defs';
import { citiesOf } from '../../sim/cities';
import { addGold } from '../../sim/economy';
import { registerCrew } from '../doctrineRegistry';

const KOREAN_CULTURE_BUILDINGS: readonly string[] = ['amphitheater', 'museum', 'broadcast_tower', 'hallyu_hub', 'stadium'];
const KOREAN_STAGE_BUILDINGS: readonly string[] = ['amphitheater', 'broadcast_tower', 'hallyu_hub', 'stadium'];
const DOCK_BUILDINGS: readonly string[] = ['lighthouse', 'harbor', 'pinisi_harbor'];
const TAIWANESE_FAB_BUILDINGS: readonly string[] = ['workshop', 'factory', 'semiconductor_fab', 'research_lab'];
const SPICE_RESOURCES: readonly string[] = ['spices', 'sugar', 'dyes', 'pearls'];

export const LEADERS_ASIA: Record<string, LeaderDef> = {
  south_korea: {
    id: 'south_korea', name: 'Park Ha-neul', title: 'Hanbit Ark Producer', civName: 'Hanbit Ark', adjective: 'South Korean',
    country: 'South Korea', code: 'KOR', flagColors: ['#ffffff', '#cd2e3a', '#0047a0', '#000000'], colors: { primary: '#e0457b', secondary: '#3b5fb0' },
    description: 'Every module has a rehearsal plan and a livestream. Nobody has slept since landing.',
    bonus: 'Holo-Theaters, Holo-Archives, Broadcast Towers, Hallyu Broadcast Hubs and Arenas cost **30%** less {prod}. At the end of each chapter, gain **+1** {splendor} for each **75** {cul} earned that chapter (max **+8**). Colony Crawlers get **+1** Moves.',
    startDoctrine: 'idol_trainee', uniqueUnit: 'hwacha_swarm_rack', uniqueBuilding: 'hallyu_hub', aiPersonality: 'scientist',
    cityNames: ['New Seoul', 'Busan Beachhead', 'Incheon Landing', 'Daejeon Dome', 'Gwangju Light', 'Jeju Crater', 'Ulsan Works', 'Suwon Fortress II', 'Pangyo Valley', 'Hanbit Station', 'Gangnam Style Hab', 'Daegu Heights', 'Ppalli-Ppalli Basin', 'Han River Dome', 'Soju Station'],
    portrait: { hue: 338, motif: 'lyre', crest: 'bolt' },
    gender: 'f', alt: { name: 'Seo Joon-ho', title: 'Hanbit Ark Show Chief', gender: 'm', description: 'Every module has a rehearsal plan and a livestream. Nobody has slept since landing.' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && KOREAN_CULTURE_BUILDINGS.includes(a.item.id)) a.cost *= 0.7; },
      chronicle(_ctx, c) { const n = Math.min(8, Math.floor(c.stats.culture / 75)); if (n > 0) c.addSplendor(n, 'Hallyu Wave'); },
      unitMoves(_ctx, a) { if (a.unit.type === 'settler') a.value += 1; },
    },
  },
  indonesia: {
    id: 'indonesia', name: 'Dewi Kusuma', title: 'Nusantara Ark Harbor Chief', civName: 'Nusantara Ark', adjective: 'Indonesian',
    country: 'Indonesia', code: 'IDN', flagColors: ['#ce1126', '#ffffff'], colors: { primary: '#9c2f6e', secondary: '#f1e4d6' },
    description: 'The Ark left as a fleet of a thousand small habitats. Each one has its own opinion about coffee.',
    bonus: 'Shallows and Dust Sea tiles yield **+1** {food}. Hills yield **+1** {food}. Beacon Towers, Skiff Docks and Sail Harbors cost **40%** less {prod}.',
    startDoctrine: 'spice_trader', uniqueUnit: 'silat_skirmisher', uniqueBuilding: 'pinisi_harbor', aiPersonality: 'expansionist',
    cityNames: ['Nusantara Prime', 'New Jakarta', 'Bandung Crater', 'Surabaya Harbor', 'Yogyakarta Dome', 'Bali High', 'Borobudur Base', 'Komodo Heights', 'Medan Station', 'Makassar Skiff', 'Krakatoa Rim', 'Sumatra Two', 'Java Junction', 'Lombok Landing', 'Thousand Islands, One Wi-Fi'],
    portrait: { hue: 322, motif: 'ship', crest: 'mountain' },
    gender: 'f', alt: { name: 'Bayu Santoso', title: 'Nusantara Ark Fleet Chief', gender: 'm', description: 'The Ark left as a fleet of a thousand small habitats. Each one has its own opinion about coffee.' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'coast' || a.tile.terrain === 'ocean') a.yields.food += 1;
        if (a.tile.elevation === 'hills') a.yields.food += 1;
      },
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'building' && DOCK_BUILDINGS.includes(a.item.id)) a.cost *= 0.6; },
    },
  },
  saudi_arabia: {
    id: 'saudi_arabia', name: 'Reem Al-Harbi', title: 'Najd Ark Director', civName: 'Najd Ark', adjective: 'Saudi',
    country: 'Saudi Arabia', code: 'SAU', flagColors: ['#006c35', '#ffffff'], colors: { primary: '#14633f', secondary: '#e8dfbf' },
    description: 'The Ark brought one drill, three huge projects and a plan that calls the desert a gift.',
    bonus: 'Heavy Ice tiles yield **+3** {gold}. Dunes yield **+1** {prod}. Buying units and buildings with {gold} costs **25%** less.',
    startDoctrine: 'wildcatter', uniqueUnit: 'dromedary_courser', uniqueBuilding: 'deuterium_refinery', aiPersonality: 'builder',
    cityNames: ['Najd Prime', 'New Riyadh', 'Jeddah Skiff', 'Dammam Dome', 'Tabuk Station', 'Abha Heights', 'Dhahran Rig', 'Neom Next', 'Qassim Oasis', 'Ha’il Habitat', 'Al-Ula Arch', 'Yanbu Harbor', 'Empty Quarter Annex', 'Rover Crossing', 'Heavy Ice Is Fine, Honestly'],
    portrait: { hue: 150, motif: 'compass', crest: 'sword' },
    gender: 'f', alt: { name: 'Khalid Al-Dosari', title: 'Najd Ark Chief Driller', gender: 'm', description: 'The Ark brought one drill, three huge projects and a plan that calls the desert a gift.' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.resource === 'oil') a.yields.gold += 3;
        if (a.tile.terrain === 'desert') a.yields.prod += 1;
      },
      cost(_ctx, a) { if (a.currency === 'gold' && (a.item.kind === 'building' || a.item.kind === 'unit')) a.cost *= 0.75; },
    },
  },
  taiwan: {
    id: 'taiwan', name: 'Chen Yu-ting', title: 'Yushan Ark Chip Chief', civName: 'Yushan Ark', adjective: 'Taiwanese',
    country: 'Taiwan', code: 'TWN', flagColors: ['#fe0000', '#000095', '#ffffff'], colors: { primary: '#7f8cf0', secondary: '#e04a4a' },
    description: 'The Ark is mostly a clean room with a few beds. The beds are clean too.',
    bonus: 'Each Workshop, Factory and Research Lab yields **+2** {sci}. Your units on Hills get **+25%** defense. When you finish Research, gain **4** {gold} for each era you have reached (max **24**).',
    startDoctrine: 'chip_designer', uniqueUnit: 'typhoon_battery', uniqueBuilding: 'semiconductor_fab', aiPersonality: 'scientist',
    cityNames: ['Yushan Prime', 'New Taipei', 'Hsinchu Fab', 'Taichung Dome', 'Kaohsiung Harbor', 'Tainan Station', 'Alishan Ridge', 'Taroko Gorge II', 'Sun Moon Basin', 'Keelung Rain', 'Hualien Heights', 'Chiayi Crater', 'Night Market No. 1', 'Bubble Tea Basin', 'Cleanroom Colony'],
    portrait: { hue: 232, motif: 'bolt', crest: 'mountain' },
    gender: 'm', alt: { name: 'Dr. Lin Shu-fen', title: 'Yushan Ark Clean Room Chief', gender: 'f', description: 'The Ark is mostly a clean room with a few beds. The beds are clean too.' },
    effects: {
      cityYield(_ctx, a) { const n = a.city.buildings.filter((b) => TAIWANESE_FAB_BUILDINGS.includes(b)).length; if (n > 0) a.yields.sci += 2 * n; },
      combat(ctx, a) { if (a.side === 'defense' && a.defender?.owner === ctx.player.id && a.tile.elevation === 'hills') a.defenseMods.push({ label: 'Ridge Fortress', pct: 25 }); },
      onEvent(ctx, ev) { if (ev.type === 'techResearched' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 4 * (Math.min(5, ctx.state.run.era) + 1), 'Chip exports', ctx.emit); },
    },
  },
  thailand: {
    id: 'thailand', name: 'Nattaya Chaiyasit', title: 'Suvarnabhumi Ark Director', civName: 'Suvarnabhumi Ark', adjective: 'Thai',
    country: 'Thailand', code: 'THA', flagColors: ['#a51931', '#f4f5f8', '#2d2a4a'], colors: { primary: '#27307e', secondary: '#e8c24a' },
    description: 'The Ark has no plan to be pushed around and a detailed plan for lunch. Both plans work.',
    bonus: 'Each Colony yields **+1** {gold} and **+1** {cul}. **+3** {happy}.',
    startDoctrine: 'night_market_chef', uniqueUnit: 'elephant_walker', uniqueBuilding: 'spirit_house_garden', aiPersonality: 'builder',
    cityNames: ['Suvarnabhumi', 'New Bangkok', 'Chiang Mai Dome', 'Phuket Hab', 'Ayutthaya Two', 'Pattaya Pressure', 'Sukhothai Station', 'Krabi Crater', 'Khon Kaen Heights', 'Hua Hin Habitat', 'Nakhon Orbit', 'Chao Phraya Basin', 'Street Food Corner', 'Tuk-Tuk Terminal', 'Land of Smiles, Mostly'],
    portrait: { hue: 248, motif: 'temple', crest: 'laurel' },
    gender: 'f', alt: { name: 'Anan Wongsakul', title: 'Suvarnabhumi Ark Rice Chief', gender: 'm', description: 'The Ark has no plan to be pushed around and a detailed plan for lunch. Both plans work.' },
    effects: {
      cityYield(_ctx, a) { a.yields.gold += 1; a.yields.cul += 1; },
      happiness(_ctx, a) { a.value += 3; },
    },
  },
  singapore: {
    id: 'singapore', name: 'Dr. Grace Tan', title: 'Merlion Ark Port Director', civName: 'Merlion Ark', adjective: 'Singaporean',
    country: 'Singapore', code: 'SGP', flagColors: ['#ed2939', '#ffffff'], colors: { primary: '#f27a3a', secondary: '#fff1e0' },
    description: 'A small, clean, air-conditioned habitat with a harbor, a market and a fine for everything.',
    bonus: 'Your Capital yields **+50%** {gold} and **+25%** {sci}. You can found Colonies **1** tile closer together. Gain **+3** {influence} every chapter.',
    startDoctrine: 'harbourmaster', uniqueUnit: 'lion_city_sentinel', uniqueBuilding: 'free_port_exchange', aiPersonality: 'scientist',
    cityNames: ['Merlion Prime', 'New Singapura', 'Marina Bay Dome', 'Sentosa Pressurized', 'Jurong Works', 'Changi Terminal', 'Orchard Road Hab', 'Tampines Heights', 'Raffles Landing', 'Bukit Timah Ridge', 'Clarke Quay Skiff', 'Punggol Point', 'Woodlands Dock', 'Fine City Annex', 'Chewing-Gum Free Zone'],
    portrait: { hue: 18, motif: 'anchor', crest: 'lion' },
    gender: 'f', alt: { name: 'Dr. Ravi Pillai', title: 'Merlion Ark Water Director', gender: 'm', description: 'A small, clean, air-conditioned habitat with a harbor, a market and a fine for everything.' },
    effects: {
      cityYield(_ctx, a) { if (a.city.isCapital) { a.pct.gold += 50; a.pct.sci += 25; } },
      canFoundCity(_ctx, a) { a.minDistance = Math.min(a.minDistance, 2); },
      influenceIncome(ctx, a) { if (ctx.player.isHuman) a.lines.push({ label: 'Free Port fees', amount: 3 }); },
    },
  },
  philippines: {
    id: 'philippines', name: 'Marisol Dela Cruz', title: 'Perlas Ark Chief Nurse', civName: 'Perlas Ark', adjective: 'Filipino',
    country: 'Philippines', code: 'PHL', flagColors: ['#0038a8', '#ce1126', '#fcd116', '#ffffff'], colors: { primary: '#f0b323', secondary: '#1d4fa3' },
    description: 'One person is the medic, the choir leader and owner of the only karaoke machine.',
    bonus: 'Every turn, gain **2** {gold} for each Pod you still have (max **12**). Your units heal **+10** HP. Your Colonies take **half** damage from Dust Storms.',
    startDoctrine: 'balikbayan_courier', uniqueUnit: 'eskrima_duelist', uniqueBuilding: 'nurse_corps_clinic', aiPersonality: 'expansionist',
    cityNames: ['Perlas Prime', 'New Manila', 'Cebu Crater', 'Davao Dome', 'Baguio Heights', 'Iloilo Skiff', 'Palawan Reef (Dry)', 'Tacloban Rebuilt', 'Zamboanga Station', 'Boracay Basin', 'Vigan Cobblestone', 'Cagayan Landing', 'Bohol Hills', 'Mayon Rim', 'Karaoke Night Colony'],
    portrait: { hue: 46, motif: 'sun', crest: 'star' },
    gender: 'f', alt: { name: 'Ramón Villanueva', title: 'Perlas Ark Deck Chief', gender: 'm', description: 'One person is the medic, the choir leader and owner of the only karaoke machine.' },
    effects: {
      turnStart(ctx) { const amount = Math.min(2 * ctx.player.cryo, 12); if (amount > 0) addGold(ctx.state, ctx.player.id, amount, 'Pod family money', ctx.emit); },
      unitHeal(_ctx, a) { a.value += 10; },
      storm(ctx, a) { if (a.victim === ctx.player.id && a.city) a.damage = Math.floor(a.damage / 2); },
    },
  },
  vietnam: {
    id: 'vietnam', name: 'Trần Minh Anh', title: 'Hồng Hà Ark Tunnel Chief', civName: 'Hồng Hà Ark', adjective: 'Vietnamese',
    country: 'Vietnam', code: 'VNM', flagColors: ['#da251d', '#ffff00'], colors: { primary: '#d02a2a', secondary: '#f5d23a' },
    description: 'Everything on this Ark was built twice: once above ground and once below. The second one is better.',
    bonus: 'Your units and Colonies get **+25%** defense inside your borders. Lava Tubes and Rock Spires yield **+1** {prod}. When you destroy an enemy unit inside your borders, gain **8** {gold}.',
    startDoctrine: 'tunnel_scout', uniqueUnit: 'tunnel_sniper', uniqueBuilding: 'tunnel_network', aiPersonality: 'warmonger',
    cityNames: ['Hồng Hà Prime', 'New Hanoi', 'Saigon Underneath', 'Da Nang Dome', 'Hue Citadel II', 'Hai Phong Harbor', 'Can Tho Delta', 'Nha Trang Reef (Dry)', 'Dalat Highlands', 'Ha Long Dust Bay', 'Sapa Terraces', 'Vung Tau Skiff', 'Quy Nhon Crater', 'Cu Chi Depths', 'Second Tunnel Level'],
    portrait: { hue: 2, motif: 'mountain', crest: 'star' },
    gender: 'f', alt: { name: 'Nguyễn Quang Huy', title: 'Hồng Hà Ark River Wall Chief', gender: 'm', description: 'Everything on this Ark was built twice: once above ground and once below. The second one is better.' },
    effects: {
      combat(ctx, a) { if (a.side === 'defense' && a.defenderOwner === ctx.player.id && a.tile.owner === ctx.player.id) a.defenseMods.push({ label: 'Home Ground', pct: 25 }); },
      tileYield(_ctx, a) { if (a.tile.feature === 'jungle' || a.tile.feature === 'forest') a.yields.prod += 1; },
      onEvent(ctx, ev) {
        if (ev.type !== 'unitDied' || ev.killer !== ctx.player.id || ev.player === ctx.player.id) return;
        if (ctx.state.map.tiles[ev.tile]?.owner === ctx.player.id) addGold(ctx.state, ctx.player.id, 8, 'Tunnel finds', ctx.emit);
      },
    },
  },
  bangladesh: {
    id: 'bangladesh', name: 'Tahmina Haque', title: 'Padma Ark Delta Chief', civName: 'Padma Ark', adjective: 'Bangladeshi',
    country: 'Bangladesh', code: 'BGD', flagColors: ['#006a4e', '#f42a41'], colors: { primary: '#38c98f', secondary: '#d1383a' },
    description: 'The planners know floods and hunger well. Mars offers both, and storms too.',
    bonus: 'Each Colony yields **+1** {prod} and **+1** {gold} for every **3** colonists. Colonies with **3** or fewer colonists need **30%** less {food} to grow.',
    startDoctrine: 'textile_foreman', uniqueUnit: 'lathial_guard', uniqueBuilding: 'embankment_works', aiPersonality: 'expansionist',
    cityNames: ['Padma Prime', 'New Dhaka', 'Chattogram Port', 'Sylhet Tea Dome', 'Khulna Delta', 'Rajshahi Station', 'Cox’s Bazar Dunes', 'Barishal Skiff', 'Rangpur Heights', 'Mymensingh Basin', 'Comilla Crater', 'Sundarbans Annex', 'Rickshaw Roundabout', 'Hilsa Harbor', 'Monsoon Drill Colony'],
    portrait: { hue: 155, motif: 'river', crest: 'wheat' },
    gender: 'f', alt: { name: 'Dr. Imran Chowdhury', title: 'Padma Ark River Pilot', gender: 'm', description: 'The planners know floods and hunger well. Mars offers both, and storms too.' },
    effects: {
      cityYield(_ctx, a) { const n = Math.floor(a.city.pop / 3); if (n > 0) { a.yields.prod += n; a.yields.gold += n; } },
      growthThreshold(_ctx, a) { if (a.city.pop <= 3) a.value *= 0.7; },
    },
  },
  malaysia: {
    id: 'malaysia', name: 'Zahra Ibrahim', title: 'Muhibbah Ark Leader', civName: 'Muhibbah Ark', adjective: 'Malaysian',
    country: 'Malaysia', code: 'MYS', flagColors: ['#cc0001', '#010066', '#ffcc00', '#ffffff'], colors: { primary: '#9a5b34', secondary: '#f2cf5a' },
    description: 'Four languages, nine kinds of noodles, and a tea break before every decision. It is always worth it.',
    bonus: '**+1** Boost slot. Colony borders grow **25%** faster. Relay Stations yield **+2** {gold}.',
    startDoctrine: 'teh_tarik_mediator', uniqueUnit: 'keris_vanguard', uniqueBuilding: 'canopy_institute', aiPersonality: 'builder',
    cityNames: ['Muhibbah Prime', 'New Kuala Lumpur', 'Penang Hab', 'Johor Dome', 'Malacca Straits (Dry)', 'Kuching Heights', 'Kota Kinabalu Ridge', 'Ipoh Cavern', 'Putrajaya Annex', 'Langkawi Skiff', 'Cameron Highlands II', 'Shah Alam Station', 'Teh Tarik Terminal', 'Rainforest Annex', 'Four Languages, One Airlock'],
    portrait: { hue: 22, motif: 'tree', crest: 'compass' },
    gender: 'f', alt: { name: 'Hafiz Abdullah', title: 'Muhibbah Ark Translator', gender: 'm', description: 'Four languages, nine kinds of noodles, and a tea break before every decision. It is always worth it.' },
    effects: {
      onGain(ctx) { if (ctx.player.isHuman) ctx.state.run.edictSlots += 1; },
      borderThreshold(_ctx, a) { a.value *= 0.75; },
      tileYield(_ctx, a) { if (a.tile.improvement === 'trading_post') a.yields.gold += 2; },
    },
  },
};

export const CREW_ASIA: DoctrineDef[] = [
  {
    id: 'idol_trainee', name: 'The Idol Trainee', rarity: 'uncommon', cost: 6, noShop: true, nation: 'south_korea',
    description: 'Practices sixteen hours a day and still smiles. At the end of each chapter, gain **+1** {splendor} for each Holo-Theater, Broadcast Tower, Hallyu Broadcast Hub and Arena you own.',
    flavor: '“The debut is tomorrow. The air recycler will play the music.”', tags: ['nation', 'buildings', 'splendor'], icon: 'star', art: { hue: 336, motif: 'lyre' },
    effects: {
      chronicle(_ctx, c) {
        let n = 0;
        for (const city of c.cities) for (const b of city.buildings) if (KOREAN_STAGE_BUILDINGS.includes(b)) n++;
        if (n > 0) c.addSplendor(n);
      },
    },
  },
  {
    id: 'spice_trader', name: 'The Spice Trader', rarity: 'uncommon', cost: 6, noShop: true, nation: 'indonesia',
    description: 'Knows what a pinch of saffron is worth on a world with no taste. Saffron Seeds, Coffee Clones, Yellow Pigment and Iron Blueberries worked by your Colonies yield **+2** {gold}.',
    flavor: '“To be honest, I am selling you the smell.”', tags: ['nation', 'credits', 'luxuries'], icon: 'coin', art: { hue: 24, motif: 'coin' },
    effects: { tileYield(ctx, a) { if (a.city?.owner === ctx.player.id && a.tile.resource != null && SPICE_RESOURCES.includes(a.tile.resource)) a.yields.gold += 2; } },
  },
  {
    id: 'wildcatter', name: 'The Driller', rarity: 'uncommon', cost: 6, noShop: true, nation: 'saudi_arabia',
    description: 'Always finds Heavy Ice. Deep Drills worked by your Colonies yield **+2** {prod}.',
    flavor: 'The geologist says there is nothing here. The driller has already named the well.', tags: ['nation', 'industry', 'installations'], icon: 'flame', art: { hue: 36, motif: 'flame' },
    effects: { tileYield(ctx, a) { if (a.city?.owner === ctx.player.id && a.tile.improvement === 'oil_well') a.yields.prod += 2; } },
  },
  {
    id: 'chip_designer', name: 'The Chip Designer', rarity: 'uncommon', cost: 6, noShop: true, nation: 'taiwan',
    description: 'Tests every result before it happens. Rerolling Research costs **half** as much {gold}.',
    flavor: 'The plan is perfect. If it fails, there are nine hundred pages of apology.', tags: ['nation', 'research', 'credits'], icon: 'bolt', art: { hue: 230, motif: 'bolt' },
    effects: { researchReroll(_ctx, a) { a.value = Math.floor(a.value / 2); } },
  },
  {
    id: 'night_market_chef', name: 'The Night Market Chef', rarity: 'uncommon', cost: 6, noShop: true, nation: 'thailand',
    description: 'A wok, a flame and a line that never gets shorter. You get **+2** {happy}. At the end of each chapter, gain **+3** {splendor}.',
    flavor: '“Is it spicy? Please sit down first.”', tags: ['nation', 'peace', 'splendor'], icon: 'flame', art: { hue: 18, motif: 'flame' },
    effects: {
      happiness(_ctx, a) { a.value += 2; },
      chronicle(_ctx, c) { c.addSplendor(3); },
    },
  },
  {
    id: 'harbourmaster', name: 'The Harbor Master', rarity: 'uncommon', cost: 6, noShop: true, nation: 'singapore',
    description: 'Logs every boat, every beacon and every late fee. Every chapter, gain **+1** {influence} for each Colony with a Beacon Tower, Skiff Dock or Sail Harbor (max **4**).',
    flavor: 'No ship docks without paperwork. The paperwork has its own parking space.', tags: ['nation', 'scrip', 'trade'], icon: 'anchor', art: { hue: 200, motif: 'anchor' },
    effects: {
      influenceIncome(ctx, a) {
        if (!ctx.player.isHuman) return;
        const n = Math.min(4, citiesOf(ctx.state, ctx.player.id).filter((city) => city.buildings.some((b) => DOCK_BUILDINGS.includes(b))).length);
        if (n > 0) a.lines.push({ label: 'Harbourmaster', amount: n });
      },
    },
  },
  {
    id: 'balikbayan_courier', name: 'The Gift Box Courier', rarity: 'uncommon', cost: 6, noShop: true, nation: 'philippines',
    description: 'Somebody’s cousin always sends a box. Each time you Land a Colony or Wake Colonists, gain **+6** {gold}.',
    flavor: '“Inside the box: soap, chocolate, a rice cooker, and one tiny solar panel.”', tags: ['nation', 'drop', 'cryo', 'credits'], icon: 'hand', art: { hue: 44, motif: 'hand' },
    effects: {
      onEvent(ctx, ev) {
        if ((ev.type === 'podLanded' || ev.type === 'colonistsThawed') && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 6, 'Balikbayan box', ctx.emit);
      },
    },
  },
  {
    id: 'tunnel_scout', name: 'The Tunnel Scout', rarity: 'uncommon', cost: 6, noShop: true, nation: 'vietnam',
    description: 'Attacks from a tile you did not know was a tile. Your units that attack from Lava Tubes or Rock Spires get **+25%** strength.',
    flavor: 'The map says nothing is here. The map has never been underground.', tags: ['nation', 'combat', 'terrain'], icon: 'eye', art: { hue: 6, motif: 'eye' },
    effects: {
      combat(ctx, a) {
        if (a.side === 'attack' && a.attackerOwner === ctx.player.id && a.attacker && (a.fromTile.feature === 'jungle' || a.fromTile.feature === 'forest')) a.attackMods.push({ label: 'Tunnel Ambush', pct: 25 });
      },
    },
  },
  {
    id: 'textile_foreman', name: 'The Cloth Boss', rarity: 'uncommon', cost: 6, noShop: true, nation: 'bangladesh',
    description: 'Runs the loudest cloth factory on the planet. Bio-Cotton and Spider Silk tiles worked by your Colonies yield **+2** {prod} and **+1** {gold}.',
    flavor: 'The order is due before dawn. The dawn is on the order too.', tags: ['nation', 'industry', 'luxuries'], icon: 'gear', art: { hue: 160, motif: 'gear' },
    effects: {
      tileYield(ctx, a) {
        if (a.city?.owner === ctx.player.id && (a.tile.resource === 'cotton' || a.tile.resource === 'silk')) { a.yields.prod += 2; a.yields.gold += 1; }
      },
    },
  },
  {
    id: 'teh_tarik_mediator', name: 'The Tea Peacemaker', rarity: 'uncommon', cost: 6, noShop: true, nation: 'malaysia',
    description: 'No fight survives a second cup of tea. At the end of each chapter, gain **+2** {splendor} for each Boost you hold.',
    flavor: '“Everyone agrees, as soon as the tea cools down.”', tags: ['nation', 'salvage', 'splendor'], icon: 'chalice', art: { hue: 28, motif: 'chalice' },
    effects: { chronicle(ctx, c) { const n = ctx.player.isHuman ? ctx.state.run.edicts.length : 0; if (n > 0) c.addSplendor(2 * n); } },
  },
];

registerCrew(CREW_ASIA);
