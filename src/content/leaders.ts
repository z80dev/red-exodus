// OWNER: ContentRogue. The eight fictional civilizations (Balatro decks). Leader effects apply to every
// player led by that leader (AIs included), so hooks always act on ctx.player, never on HUMAN directly.
import type { LeaderDef } from '../sim/defs';
import { RESOURCES } from './resources';
import { addGold } from '../sim/economy';
import { changeMandate } from '../sim/roguelite';
import {
  countWonders, isCoastalCity, isNextToMountain, isRiverTile, isWoodland, ownMod, ownTile, ownUnit,
  unitClassOf, unitKillBy,
} from './doctrines';

export const LEADERS: Record<string, LeaderDef> = {
  aurelian: {
    id: 'aurelian', name: 'Solenne the Radiant', title: 'Sun-Queen of the Aurelian Dominion',
    civName: 'Aurelian Dominion', adjective: 'Aurelian',
    colors: { primary: '#e3b53c', secondary: '#6b3a10' },
    description: 'A golden dynasty of builders who raise wonders to outshine the sun.',
    bonus: 'Capital +2 {prod} and +2 {cul}. Wonders cost **20%** less {prod}. **+1** {happy} per Wonder you own.',
    startDoctrine: 'solar_dynasty', uniqueBuilding: 'sun_court', aiPersonality: 'builder',
    cityNames: ['Aurelia', 'Solmere', 'Helion', 'Goldcrest', 'Dawnspire', 'Vesperine', 'Lumenhall', 'Brightwater', 'Castellum Sol', 'Ambergate', 'Radiance', 'Sunhollow', 'Saffronreach', 'Meridia', 'Glimmerford'],
    portrait: { hue: 44, motif: 'sun', crest: 'crown' },
    effects: {
      cityYield(_ctx, a) {
        if (a.city.isCapital) { a.yields.prod += 2; a.yields.cul += 2; }
      },
      cost(_ctx, a) {
        if (a.currency === 'prod' && a.item.kind === 'wonder') a.cost *= 0.8;
      },
      happiness(ctx, a) {
        a.value += countWonders(ctx.state, ctx.player.id);
      },
    },
  },
  thalassan: {
    id: 'thalassan', name: 'Kaelo Tidewarden', title: 'Grand Admiral of the Thalassan League',
    civName: 'Thalassan League', adjective: 'Thalassan',
    colors: { primary: '#1aa3b5', secondary: '#0b3a52' },
    description: 'Island merchant-princes whose fleets bind every shore with silver.',
    bonus: 'Coast and lake tiles +1 {gold}. Coastal cities +15% {gold} and +1 {prod}. **+1** {influence} per chapter per 3 coastal cities.',
    startDoctrine: 'tidal_charter', uniqueBuilding: 'tide_market', aiPersonality: 'expansionist',
    cityNames: ['Thalassa', 'Pearlhaven', 'Coralmouth', 'Saltmere', 'Wavecrest', 'Brineholt', 'Moonharbor', 'Tidewick', 'Azure Quay', 'Seaglass', 'Gullreach', 'Foamspire', 'Anchorfall', 'Driftmoor', 'Nacre'],
    portrait: { hue: 190, motif: 'wave', crest: 'anchor' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.terrain === 'coast' || a.tile.terrain === 'lake') a.yields.gold += 1;
      },
      cityYield(ctx, a) {
        if (isCoastalCity(ctx.state, a.city)) { a.pct.gold += 15; a.yields.prod += 1; }
      },
      influenceIncome(ctx, a) {
        if (!ctx.player.isHuman) return;
        let coastal = 0;
        for (const c of Object.values(ctx.state.cities)) if (c.owner === ctx.player.id && isCoastalCity(ctx.state, c)) coastal++;
        const n = Math.floor(coastal / 3);
        if (n > 0) a.lines.push({ label: 'Thalassan Tolls', amount: n });
      },
    },
  },
  varkhan: {
    id: 'varkhan', name: 'Ulzai Khagan', title: 'Khagan of the Varkhan Horde',
    civName: 'Varkhan Horde', adjective: 'Varkhan',
    colors: { primary: '#b8272c', secondary: '#2e0a0b' },
    description: 'Thunder on the steppe — a people who measure glory in conquered horizons.',
    bonus: 'Mounted units +1 movement. Every enemy unit your units kill grants **+10** {gold}. Your units +15% strength when attacking.',
    startDoctrine: 'hoofbeat_saga', uniqueUnit: 'steppe_rider', aiPersonality: 'warmonger',
    unlock: { text: 'Slay 40 enemy units in a single run.', rule: 'kills40' },
    cityNames: ['Kharakum', 'Ordu-Baal', 'Tengriyn', 'Sukhkar', 'Altanbaz', 'Khoridai', 'Irgesh', 'Bayanshar', 'Temurkai', 'Ulaan Tor', 'Jebeh', 'Khasar', 'Borjin', 'Yesugar', 'Chagatur'],
    portrait: { hue: 356, motif: 'horse', crest: 'sword' },
    effects: {
      unitMoves(_ctx, a) {
        if (unitClassOf(a.unit.type) === 'mounted') a.value += 1;
      },
      combat(_ctx, a) {
        if (a.side === 'attack' && a.attacker) ownMod(a, 'Varkhan Fury', 15);
      },
      onEvent(ctx, ev) {
        if (unitKillBy(ev, ctx.player.id)) addGold(ctx.state, ctx.player.id, 10, 'Varkhan plunder', ctx.emit);
      },
    },
  },
  sylvaran: {
    id: 'sylvaran', name: 'Myrrh of the Thousand Boughs', title: 'Elder Warden of Sylvara',
    civName: 'Sylvaran Wilds', adjective: 'Sylvaran',
    colors: { primary: '#3e9b3f', secondary: '#15361a' },
    description: 'Ancient forest-keepers who sing their cities out of living wood.',
    bonus: 'Forest and jungle tiles +1 {cul} and +1 {prod}. Your units +20% defense in forest or jungle. Thornwardens +25% strength there.',
    startDoctrine: 'heartwood_rites', uniqueUnit: 'thornwarden', aiPersonality: 'builder',
    unlock: { text: 'Reach the Medieval era.', rule: 'reachEra3' },
    cityNames: ['Sylvaris', 'Elderholt', 'Mossgrave', 'Fernwhisper', 'Oakenhearth', 'Thornmere', 'Willowreach', 'Ashgrove', 'Briarlight', 'Canopy', 'Rootsong', 'Lichenfall', 'Hollowbough', 'Greenveil', 'Amberleaf'],
    portrait: { hue: 120, motif: 'tree', crest: 'owl' },
    effects: {
      tileYield(_ctx, a) {
        if (isWoodland(a.tile)) { a.yields.cul += 1; a.yields.prod += 1; }
      },
      combat(_ctx, a) {
        const u = ownUnit(a);
        if (!u || !isWoodland(ownTile(a))) return;
        if (a.side === 'defense') ownMod(a, 'Sylvan Cover', 20);
        if (u.type === 'thornwarden') ownMod(a, 'Thornwarden Grove', 25);
      },
    },
  },
  ashkari: {
    id: 'ashkari', name: 'Zahirah Sunveil', title: 'Sultana of the Ashkari Sands',
    civName: 'Ashkari Sultanate', adjective: 'Ashkari',
    colors: { primary: '#e0752d', secondary: '#4a1f06' },
    description: 'Caravan-queens of the burning dunes, rich in spice, silk and starlit secrets.',
    bonus: 'Desert tiles +1 {prod} and +1 {gold}; oases and floodplains +2 {food}. Dune Chariots +20% strength on desert. Luxury tiles +1 {gold}.',
    startDoctrine: 'caravan_of_stars', uniqueUnit: 'dune_chariot', aiPersonality: 'expansionist',
    unlock: { text: 'Reach the Renaissance era.', rule: 'reachEra4' },
    cityNames: ['Ashkar', 'Qasr al-Nur', 'Zafira', 'Mirabad', 'Sahriyan', 'Dunehold', 'Kharesh', 'Oasis of Tears', 'Almira', 'Samarind', 'Taj Ruhan', 'Nahrzan', 'Soukara', 'Faridun', 'Emberdune'],
    portrait: { hue: 26, motif: 'pyramid', crest: 'serpent' },
    effects: {
      tileYield(_ctx, a) {
        const t = a.tile;
        if (t.terrain === 'desert') { a.yields.prod += 1; a.yields.gold += 1; }
        if (t.feature === 'oasis' || t.feature === 'floodplains') a.yields.food += 2;
        if (t.resource && RESOURCES[t.resource]?.kind === 'luxury') a.yields.gold += 1;
      },
      combat(_ctx, a) {
        const u = ownUnit(a);
        if (u?.type === 'dune_chariot' && ownTile(a).terrain === 'desert') ownMod(a, 'Dune Charge', 20);
      },
    },
  },
  kethran: {
    id: 'kethran', name: 'Ilven Starquill', title: 'Archmagister of the Kethran Archive',
    civName: 'Kethran Archive', adjective: 'Kethran',
    colors: { primary: '#8e5bd6', secondary: '#24124a' },
    description: 'Scholar-mages who chart the heavens and bind knowledge into towers of glass.',
    bonus: 'Techs cost **10%** less {sci}. Cities next to a mountain +3 {sci}. Each tech you discover grants **+15** {gold}.',
    startDoctrine: 'infinite_codex', uniqueBuilding: 'athenaeum', aiPersonality: 'scientist',
    unlock: { text: 'Discover 24 techs in a single run.', rule: 'techs24' },
    cityNames: ['Kethra', 'Quillspire', 'Astrolabe', 'Glassmere', 'Runeholm', 'Starwell', 'Inkhaven', 'Lumina Arcana', 'Orrery', 'Sagecrest', 'Vellum', 'Prism Hall', 'Cogitara', 'Nightlamp', 'Aethermoor'],
    portrait: { hue: 268, motif: 'flask', crest: 'book' },
    effects: {
      cost(_ctx, a) {
        if (a.currency === 'sci' && a.item.kind === 'tech') a.cost *= 0.9;
      },
      cityYield(ctx, a) {
        if (isNextToMountain(ctx.state, a.city.tile)) a.yields.sci += 3;
      },
      onEvent(ctx, ev) {
        if (ev.type === 'techResearched' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 15, 'Kethran patents', ctx.emit);
      },
    },
  },
  morvane: {
    id: 'morvane', name: 'Brask Ironhand', title: 'Iron Duke of the Morvane Forgeholds',
    civName: 'Morvane Forgeholds', adjective: 'Morvane',
    colors: { primary: '#56708c', secondary: '#d98c3a' },
    description: 'Mountain smiths whose hammers never rest and whose legions never kneel.',
    bonus: 'Hills tiles +1 {prod}; mines +1 {prod}. Units cost **15%** less {prod}. Forgeguard heal +10 HP when resting on hills.',
    startDoctrine: 'anvil_oath', uniqueUnit: 'forgeguard', aiPersonality: 'warmonger',
    unlock: { text: 'Capture 5 cities in a single run.', rule: 'capture5' },
    cityNames: ['Morvane', 'Anvilgate', 'Ironcrag', 'Slagmoor', 'Hammerfell', 'Coalhearth', 'Bellowmont', 'Rivetholm', 'Cinderpeak', 'Steelwatch', 'Forgebarrow', 'Emberdeep', 'Graniteward', 'Tongsreach', 'Blackvault'],
    portrait: { hue: 212, motif: 'gear', crest: 'shield' },
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.elevation === 'hills') a.yields.prod += 1;
        if (a.tile.improvement === 'mine' && !a.tile.pillaged) a.yields.prod += 1;
      },
      cost(_ctx, a) {
        if (a.currency === 'prod' && a.item.kind === 'unit') a.cost *= 0.85;
      },
      unitHeal(ctx, a) {
        if (a.unit.type === 'forgeguard' && ctx.state.map.tiles[a.unit.tile]?.elevation === 'hills') a.value += 10;
      },
    },
  },
  celestine: {
    id: 'celestine', name: 'Isara the Veiled', title: 'High Oracle of the Celestine Veil',
    civName: 'Celestine Veil', adjective: 'Celestine',
    colors: { primary: '#e05a9c', secondary: '#fbe3f0' },
    description: 'Prophets who read fate in comets and turn every catastrophe into revelation.',
    bonus: 'Start with **+1** Edict slot and **+1** {mandate} (max 4). River tiles +1 {sci}. **+2** {influence} after every Crisis chapter.',
    startDoctrine: 'veil_of_fate', uniqueBuilding: 'seers_spire', aiPersonality: 'scientist',
    unlock: { text: 'Survive 6 Crisis chapters in a single run.', rule: 'crises6' },
    cityNames: ['Celestia', 'Veilmoor', 'Starfall', 'Omenreach', 'Halcyon', 'Mirrorwake', 'Cometspire', 'Seraphel', 'Lunara', 'Augury', 'Dreamwell', 'Nocturne', 'Ethervale', 'Silverbrow', 'Prophecy'],
    portrait: { hue: 322, motif: 'eye', crest: 'star' },
    effects: {
      onGain(ctx) {
        if (!ctx.player.isHuman) return;
        ctx.state.run.edictSlots += 1;
        ctx.state.run.maxMandate += 1;
        changeMandate(ctx.state, 1, 'Celestine Veil', ctx.emit);
      },
      tileYield(_ctx, a) {
        if (isRiverTile(a.tile)) a.yields.sci += 1;
      },
      influenceIncome(ctx, a) {
        if (ctx.player.isHuman && ctx.state.run.chapter === 2) a.lines.push({ label: 'Celestine Revelation', amount: 2 });
      },
    },
  },
};
