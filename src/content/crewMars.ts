// OWNER: Crew. Mars-native Crew (storms, Cryo, Orbital Drops, Breakthroughs, nationality synergies),
// merged into DOCTRINES by content/index.ts.
import type { DoctrineDef, HookCtx, ChronicleCtx, StormDamageArgs } from '../sim/defs';
import { registerCrew } from './doctrineRegistry';
import { stormPowerAt } from '../sim/mars';
import type { SimEvent, GameState } from '../sim/types';
import { addGold } from '../sim/economy';
import { neighbors } from '../sim/hex';
import { changePop } from '../sim/cities';
const ART_MOTIFS: Record<string, string> = {
  cyclone: 'wave', turbine: 'gear', visor: 'mask', pod: 'hourglass', orbit: 'anchor',
  crystal: 'moon', sprout: 'tree', spire: 'mountain', drop: 'chalice', ripple: 'river',
  sunrise: 'sun', clipboard: 'book', kite: 'eagle', blueprint: 'scroll', halo: 'eye',
  barometer: 'compass', ticket: 'coin', ledger: 'scroll', cards: 'hand', whistle: 'hand',
  constellation: 'star', snowflake: 'mountain', water: 'wave', map: 'compass',
  recorder: 'book', dome: 'tower', speech: 'lyre', roots: 'tree', manifest: 'scroll',
  capsule: 'ship', ark: 'ship',
};

type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
type CardSpec = {
  id: string; name: string; rarity: Rarity; cost: number; description: string; flavor: string;
  nation: string; tags: string[]; hue: number; motif: string;
  onEvent?: (ctx: HookCtx, ev: SimEvent) => void;
  chronicle?: (ctx: HookCtx, c: ChronicleCtx) => void;
  storm?: (ctx: HookCtx, a: StormDamageArgs) => void;
  dropPrice?: DoctrineDef['effects']['dropPrice'];
  researchOffers?: DoctrineDef['effects']['researchOffers'];
  researchReroll?: DoctrineDef['effects']['researchReroll'];
  status?: (counters: Record<string, number>, state: GameState) => string | null;
};

function crew(s: CardSpec): DoctrineDef {
  const effects: DoctrineDef['effects'] = {};
  if (s.onEvent) effects.onEvent = s.onEvent;
  if (s.chronicle) effects.chronicle = s.chronicle;
  if (s.storm) effects.storm = s.storm;
  if (s.dropPrice) effects.dropPrice = s.dropPrice;
  if (s.researchOffers) effects.researchOffers = s.researchOffers;
  if (s.researchReroll) effects.researchReroll = s.researchReroll;
  return {
    id: s.id, name: s.name, rarity: s.rarity, cost: s.cost, description: s.description,
    flavor: s.flavor, nation: s.nation, tags: s.tags, icon: s.tags.includes('storm') ? 'storm' : s.tags.includes('cryo') ? 'cryo' : s.tags.includes('drop') ? 'drop' : s.tags.includes('research') ? 'breakthrough' : 'doctrine', art: { hue: s.hue, motif: ART_MOTIFS[s.motif] ?? s.motif },
    ...(s.status ? { status: (counters, state) => s.status?.(counters, state) ?? null } : {}), effects,
  };
}
function trackStorm(ctx: HookCtx, ev: SimEvent, key: 'stormHits' | 'stormKills'): void {
  if (ev.type !== 'stormDamage') return;
  const tile = ctx.state.map.tiles[ev.tile];
  const counts = key === 'stormHits'
    ? ev.player === ctx.player.id
    : !!ev.killed && tile?.owner === ctx.player.id;
  if (counts) {
    ctx.counters[key] = (ctx.counters[key] ?? 0) + 1;
    if (key === 'stormKills') ctx.counters.pendingStormKills = (ctx.counters.pendingStormKills ?? 0) + 1;
  }
}
function touchedStormTiles(ctx: HookCtx): number {
  return ctx.state.map.tiles.reduce((n, tile) => n + (tile.owner === ctx.player.id && stormPowerAt(ctx.state, tile.idx) > 0 ? 1 : 0), 0);
}

export const MARS_CREW: DoctrineDef[] = [
  // COMMON (14)
  crew({ id: 'storm_chaser', name: 'Mara Velez, Storm Chaser', rarity: 'common', cost: 4, nation: 'brazil', hue: 28, motif: 'cyclone', tags: ['storm', 'hope'], description: 'Each storm hit on your people banks **+1 {splendor}** in the next Sol Report.', flavor: 'She calls the weather app “a biography.”', onEvent(ctx, ev) { trackStorm(ctx, ev, 'stormHits'); if (ev.type === 'stormDamage' && ev.player === ctx.player.id) ctx.counters.hope = (ctx.counters.hope ?? 0) + 1; }, chronicle(ctx, c) { const n = ctx.counters.hope ?? 0; if (n) c.addSplendor(n, 'Storm Chaser'); ctx.counters.hope = 0; }, status(c) { return `+${c.hope ?? 0} Hope banked`; } }),
  crew({ id: 'wind_farmer', name: 'Asha Nwosu, Wind Farmer', rarity: 'common', cost: 4, nation: 'nigeria', hue: 45, motif: 'turbine', tags: ['storm', 'industry'], description: 'Your colonies in a storm add **+2 {renown}** per storm hit.', flavor: 'The wind farms work. The weather reports are propaganda.', onEvent(ctx, ev) { if (ev.type === 'stormDamage' && ev.player === ctx.player.id && ev.cityId != null) ctx.counters.output = (ctx.counters.output ?? 0) + 2; }, chronicle(ctx, c) { if (ctx.counters.output) c.addRenown(ctx.counters.output, 'Wind Farmer'); ctx.counters.output = 0; }, status(c) { return `+${c.output ?? 0} Output banked`; } }),
  crew({ id: 'dust_hood', name: 'Jin Park, Dust Hood', rarity: 'common', cost: 4, nation: 'japan', hue: 18, motif: 'visor', tags: ['storm', 'hope'], description: 'Survive a storm hit: **+1 {splendor}** this Sol Report.', flavor: 'Her helmet has a second helmet. This is considered sensible.', onEvent(ctx, ev) { if (ev.type === 'stormDamage' && ev.player === ctx.player.id && !ev.killed) { ctx.counters.hope = (ctx.counters.hope ?? 0) + 1; } }, chronicle(ctx, c) { if (ctx.counters.hope) c.addSplendor(ctx.counters.hope, 'Dust Hood'); ctx.counters.hope = 0; } }),
  crew({ id: 'cryo_tech', name: 'Ravi Menon, Cryo Tech', rarity: 'common', cost: 4, nation: 'india', hue: 195, motif: 'pod', tags: ['cryo', 'growth'], description: 'Each Thaw adds **+1 colonist** after the regular thaw. The paperwork thaws last.', flavor: 'His defrost setting has an “al dente” option.', onEvent(ctx, ev) { if (ev.type !== 'colonistsThawed' || ev.player !== ctx.player.id) return; const city = ctx.state.cities[ev.cityId]; if (city) changePop(ctx.state, city, 1, ctx.emit); ctx.counters.thaws = (ctx.counters.thaws ?? 0) + 1; } }),
  crew({ id: 'orbital_bookie', name: 'Luca Bellini, Orbital Bookie', rarity: 'common', cost: 4, nation: 'vatican', hue: 275, motif: 'orbit', tags: ['drop', 'credits'], description: 'Each Orbital Drop grants **2 {gold}** back after the pod lands.', flavor: 'The house always wins. The house is currently a tent.', onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id) { addGold(ctx.state, ctx.player.id, 2, 'Orbital Bookie', ctx.emit); ctx.counters.drops = (ctx.counters.drops ?? 0) + 1; } } }),
  crew({ id: 'ice_librarian', name: 'Yuki Sato, Ice Librarian', rarity: 'common', cost: 4, nation: 'japan', hue: 205, motif: 'crystal', tags: ['terrain', 'science'], description: 'Cities on Frost Flats or Polar Ice add **+2 {renown}**.', flavor: 'Her return policy is 300,000 years.', chronicle(_ctx, c) { const n = c.cities.filter(city => { const t = _ctx.state.map.tiles[city.tile]; return t.terrain === 'tundra' || t.terrain === 'snow'; }).length; if (n) c.addRenown(n * 2, 'Ice Librarian'); } }),
  crew({ id: 'tube_gardener', name: 'Mina Haddad, Tube Gardener', rarity: 'common', cost: 4, nation: 'uae', hue: 110, motif: 'sprout', tags: ['terrain', 'food'], description: 'Colonies in Lava Tubes add **+1 {splendor}**.', flavor: 'Her greenhouse has zero sunlight and a waiting list.', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].feature === 'jungle').length; if (n) c.addSplendor(n, 'Tube Gardener'); } }),
  crew({ id: 'hoodoo_surveyor', name: 'Émile Roche, Hoodoo Surveyor', rarity: 'common', cost: 4, nation: 'france', hue: 35, motif: 'spire', tags: ['terrain', 'industry'], description: 'Colonies in Hoodoo Fields add **+2 {renown}**.', flavor: 'Every rock formation looks like a retired minister to him.', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].feature === 'forest').length; if (n) c.addRenown(n * 2, 'Hoodoo Surveyor'); } }),
  crew({ id: 'brine_sommelier', name: 'Olena Volkov, Brine Sommelier', rarity: 'common', cost: 4, nation: 'russia', hue: 185, motif: 'drop', tags: ['terrain', 'hope'], description: 'Colonies by a Brine Lake add **+1 {splendor}**.', flavor: 'Notes of salt, copper, and an extinct ocean.', chronicle(ctx, c) { const n = c.cities.filter(city => neighbors(ctx.state.map, city.tile).some(idx => ctx.state.map.tiles[idx].terrain === 'lake')).length; if (n) c.addSplendor(n, 'Brine Sommelier'); } }),
  crew({ id: 'channel_runner', name: 'Nikhil Rao, Channel Runner', rarity: 'common', cost: 4, nation: 'india', hue: 215, motif: 'ripple', tags: ['terrain', 'growth'], description: 'Each colony on Ancient Channels adds **+1 {renown}** per population.', flavor: 'He delivers mail by rover. It arrives before the reply.', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].riverEdges !== 0).reduce((sum, city) => sum + city.pop, 0); if (n) c.addRenown(n, 'Channel Runner'); } }),
  crew({ id: 'first_thaw', name: 'Mei Lin, First Thaw', rarity: 'common', cost: 4, nation: 'china', hue: 195, motif: 'sunrise', tags: ['cryo', 'hope'], description: 'The first Thaw each chapter adds **+3 {splendor}**.', flavor: 'She packed a sunrise in the medical kit. It was technically a lamp.', onEvent(ctx, ev) { const chapter = ctx.state.run.era * 3 + ctx.state.run.chapter + 1; if (ev.type === 'colonistsThawed' && ev.player === ctx.player.id && ctx.counters.firstThaw !== chapter) { ctx.counters.firstThaw = chapter; ctx.counters.hope = 3; } }, chronicle(ctx, c) { if (ctx.counters.hope) c.addSplendor(ctx.counters.hope, 'First Thaw'); ctx.counters.hope = 0; } }),
  crew({ id: 'draft_clerk', name: 'Noah Kim, Draft Clerk', rarity: 'common', cost: 4, nation: 'usa', hue: 225, motif: 'clipboard', tags: ['research', 'science'], description: 'Each Breakthrough offer adds **+1 {renown}**.', flavor: 'He has been “circling back” since Earth went dark.', onEvent(ctx, ev) { if (ev.type === 'researchOffered' && ev.player === ctx.player.id) { ctx.counters.offers = (ctx.counters.offers ?? 0) + 1; } }, chronicle(ctx, c) { if (ctx.counters.offers) c.addRenown(ctx.counters.offers, 'Draft Clerk'); ctx.counters.offers = 0; } }),
  crew({ id: 'storm_kite', name: 'Mateo Silva, Storm Kite', rarity: 'common', cost: 4, nation: 'brazil', hue: 250, motif: 'kite', tags: ['storm', 'research'], description: 'A storm that damages your colony adds **+1 {renown}** to the Sol Report.', flavor: 'He flies kites in a vacuum. Management calls it “initiative.”', onEvent(ctx, ev) { if (ev.type === 'stormDamage' && ev.player === ctx.player.id && ev.cityId != null) ctx.counters.output = (ctx.counters.output ?? 0) + 1; }, chronicle(ctx, c) { if (ctx.counters.output) c.addRenown(ctx.counters.output, 'Storm Kite'); ctx.counters.output = 0; } }),
  crew({ id: 'pod_cad', name: 'Sofia Keller, Pod CAD', rarity: 'common', cost: 4, nation: 'switzerland', hue: 40, motif: 'blueprint', tags: ['drop', 'industry'], description: 'Every Orbital Drop adds **+2 {renown}** to the Sol Report.', flavor: 'Her capsules land within 20 centimeters. The crew lands within 20 existential crises.', onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id) ctx.counters.output = (ctx.counters.output ?? 0) + 2; }, chronicle(ctx, c) { if (ctx.counters.output) c.addRenown(ctx.counters.output, 'Pod CAD'); ctx.counters.output = 0; } }),

  // UNCOMMON (11)
  crew({ id: 'dust_prophet', name: 'Sister Agnes, Dust Prophet', rarity: 'uncommon', cost: 6, nation: 'vatican', hue: 290, motif: 'halo', tags: ['storm', 'hope'], description: 'If storms have hit you **3+** times this chapter, gain **×1.5 {splendor}**.', flavor: 'The forecast said apocalypse. She said “again?”', onEvent(ctx, ev) { trackStorm(ctx, ev, 'stormHits'); }, chronicle(ctx, c) { if ((ctx.state.run.stats.extra.stormHits ?? 0) >= 3) c.mulSplendor(1.5, 'Dust Prophet'); }, status(_c, state) { return `${state.run.stats.extra.stormHits ?? 0}/3 storm hits`; } }),
  crew({ id: 'storm_broker', name: 'Viktor Sokolov, Storm Broker', rarity: 'uncommon', cost: 6, nation: 'russia', hue: 5, motif: 'barometer', tags: ['storm', 'credits'], description: 'Storm hits on your units grant **1 {gold}** each.', flavor: 'He sells insurance with a 100% deductible and excellent branding.', onEvent(ctx, ev) { if (ev.type === 'stormDamage' && ev.player === ctx.player.id && ev.unitId != null) addGold(ctx.state, ctx.player.id, 1, 'Storm Broker', ctx.emit); } }),
  crew({ id: 'safe_harbor', name: 'Amina Okafor, Safe Harbor', rarity: 'uncommon', cost: 6, nation: 'nigeria', hue: 120, motif: 'shield', tags: ['storm', 'defense'], description: 'Your units take **1 less storm damage**.', flavor: 'Her shelter is just a cave with better paperwork.', storm(ctx, a) { if (a.victim === ctx.player.id) a.damage = Math.max(0, a.damage - 1); } }),
  crew({ id: 'cheap_seats', name: 'Pavel Orlov, Cheap Seats', rarity: 'uncommon', cost: 6, nation: 'russia', hue: 265, motif: 'ticket', tags: ['drop', 'cryo'], description: 'Orbital Drops cost **1 fewer {gold}** (minimum 0).', flavor: 'The pod is premium. The landing is economy.', dropPrice(_ctx, a) { a.gold = Math.max(0, a.gold - 1); } }),
  crew({ id: 'cryo_accountant', name: 'Elena Rossi, Cryo Accountant', rarity: 'uncommon', cost: 6, nation: 'france', hue: 50, motif: 'ledger', tags: ['cryo', 'credits'], description: 'A Thaw refunds **1 {gold}**.', flavor: '“The last passenger is a rounding error.” — her, before meeting the last passenger.', onEvent(ctx, ev) { if (ev.type === 'colonistsThawed' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 1, 'Cryo Accountant', ctx.emit); } }),
  crew({ id: 'three_bids', name: 'Priya Das, Three Bids', rarity: 'uncommon', cost: 6, nation: 'india', hue: 220, motif: 'cards', tags: ['research', 'science'], description: 'Your Breakthrough offers contain **+1 tech**.', flavor: 'She asks for three estimates before accepting the heat death of the universe.', researchOffers(_ctx, a) { a.value += 1; } }),
  crew({ id: 'reroll_ref', name: 'Tomás Costa, Reroll Ref', rarity: 'uncommon', cost: 6, nation: 'brazil', hue: 30, motif: 'whistle', tags: ['research', 'credits'], description: 'Research rerolls cost **2 fewer {gold}** (minimum 0).', flavor: 'He will overturn any result, including his own.', researchReroll(_ctx, a) { a.value = Math.max(0, a.value - 2); } }),
  crew({ id: 'diaspora', name: 'Mariam Haddad, Diaspora', rarity: 'uncommon', cost: 6, nation: 'uae', hue: 310, motif: 'constellation', tags: ['nationality', 'hope'], description: 'Gain **+1 {splendor}** per distinct nationality among your Crew.', flavor: 'Mars has one atmosphere. We brought twelve ways to argue about it.', chronicle(ctx, c) { const nations = new Set(ctx.state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)); if (nations.size) c.addSplendor(nations.size, 'Diaspora'); }, status(_c, state) { return `${new Set(state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size} nationalities`; } }),
  crew({ id: 'polar_pair', name: 'Yelena Morozova, Polar Pair', rarity: 'uncommon', cost: 6, nation: 'russia', hue: 200, motif: 'snowflake', tags: ['nationality', 'hope'], description: 'With a Russian or Swiss Crew member, gain **+4 {splendor}**.', flavor: 'Two people, one heater, neither willing to admit it is cold.', chronicle(ctx, c) { if (hasNation(ctx, ['russia', 'switzerland'])) c.addSplendor(4, 'Polar Pair'); } }),
  crew({ id: 'brine_union', name: 'Chen Wei, Brine Union', rarity: 'uncommon', cost: 6, nation: 'china', hue: 185, motif: 'water', tags: ['terrain', 'nationality'], description: 'Each Brine Lake colony adds **+2 {renown}**; Chinese Crew add **+2 more**.', flavor: 'A labor dispute over water rights lasted longer than the water.', chronicle(ctx, c) { const n = c.cities.filter(city => neighbors(ctx.state.map, city.tile).some(idx => ctx.state.map.tiles[idx].terrain === 'lake')).length; if (n) c.addRenown(n * (hasNation(ctx, ['china']) ? 4 : 2), 'Brine Union'); } }),
  crew({ id: 'channel_cartographer', name: 'Camila Nascimento, Channel Cartographer', rarity: 'uncommon', cost: 6, nation: 'brazil', hue: 210, motif: 'map', tags: ['terrain', 'research'], description: 'Ancient Channel colonies add **+1 {renown}** per population to the Sol Report.', flavor: 'The map says “river.” The river says “I’m underneath you.”', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].riverEdges !== 0).reduce((sum, city) => sum + city.pop, 0); if (n) c.addRenown(n, 'Channel Cartographer'); } }),

  // RARE (7)
  crew({ id: 'storm_crown', name: 'Zhao Wen, Storm Crown', rarity: 'rare', cost: 8, nation: 'china', hue: 15, motif: 'crown', tags: ['storm', 'hope'], description: 'Each storm kill grants **+5 {splendor}** at the Sol Report.', flavor: 'A bad day for the Ferals. A great day for his quarterly review.', onEvent(ctx, ev) { trackStorm(ctx, ev, 'stormKills'); }, chronicle(ctx, c) { const n = ctx.counters.pendingStormKills ?? 0; if (n) c.addSplendor(n * 5, 'Storm Crown'); ctx.counters.pendingStormKills = 0; }, status(c) { return `${c.stormKills ?? 0} storm kills`; } }),
  crew({ id: 'drop_commissioner', name: 'Grace Miller, Drop Commissioner', rarity: 'rare', cost: 8, nation: 'usa', hue: 55, motif: 'pod', tags: ['drop', 'cryo'], description: 'Orbital Drops cost **1 fewer Cryo Pod** (minimum 0).', flavor: 'The committee approved the landing. Gravity had already voted.', dropPrice(_ctx, a) { a.cryo = Math.max(0, a.cryo - 1); } }),
  crew({ id: 'black_box', name: 'Jun Seo, Black Box', rarity: 'rare', cost: 8, nation: 'japan', hue: 230, motif: 'recorder', tags: ['research', 'hope'], description: 'Each researched tech grants **+2 {splendor}**.', flavor: 'The flight recorder has one entry: “we tried.”', onEvent(ctx, ev) { if (ev.type === 'techResearched' && ev.player === ctx.player.id) { ctx.counters.techs = (ctx.counters.techs ?? 0) + 1; ctx.counters.pendingTechs = (ctx.counters.pendingTechs ?? 0) + 1; } }, chronicle(ctx, c) { if (ctx.counters.pendingTechs) c.addSplendor(ctx.counters.pendingTechs * 2, 'Black Box'); ctx.counters.pendingTechs = 0; }, status(c) { return `${c.techs ?? 0} Breakthroughs logged`; } }),
  crew({ id: 'storm_wallflower', name: 'Anika Meier, Storm Wallflower', rarity: 'rare', cost: 8, nation: 'switzerland', hue: 165, motif: 'dome', tags: ['storm', 'growth'], description: 'While any owned tile is in a storm, gain **×1.5 {splendor}**.', flavor: 'She only comes out when the weather is actively trying to kill her.', chronicle(ctx, c) { if (touchedStormTiles(ctx) > 0) c.mulSplendor(1.5, 'Storm Wallflower'); } }),
  crew({ id: 'three_languages', name: 'Amara Bello, Three Languages', rarity: 'rare', cost: 8, nation: 'nigeria', hue: 320, motif: 'speech', tags: ['nationality', 'hope'], description: 'Gain **×1.25 {splendor}** for each distinct Crew nationality beyond the first (max ×2).', flavor: 'The meeting has twelve translators and no shared agenda.', chronicle(ctx, c) { const n = new Set(ctx.state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size; if (n > 1) c.mulSplendor(Math.min(2, 1 + (n - 1) * 0.25), 'Three Languages'); }, status(_c, state) { const n = new Set(state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size; return `×${Math.min(2, 1 + Math.max(0, n - 1) * .25).toFixed(2)} Hope`; } }),
  crew({ id: 'tube_network', name: 'Dara Kim, Tube Network', rarity: 'rare', cost: 8, nation: 'japan', hue: 125, motif: 'roots', tags: ['terrain', 'growth'], description: 'Each colony in Lava Tubes adds **+3 {renown}** and **+1 {splendor}**.', flavor: 'The tunnels are safe, spacious, and only occasionally full of ancient dust.', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].feature === 'jungle').length; if (n) { c.addRenown(n * 3, 'Tube Network'); c.addSplendor(n, 'Tube Network'); } } }),
  crew({ id: 'thaw_manifest', name: 'Lucía Ferreira, Thaw Manifest', rarity: 'rare', cost: 8, nation: 'brazil', hue: 195, motif: 'manifest', tags: ['cryo', 'hope'], description: 'Every **2 Thaws** grant **+5 {splendor}**.', flavor: 'She keeps the list in triplicate. The passengers keep asking why.', onEvent(ctx, ev) { if (ev.type === 'colonistsThawed' && ev.player === ctx.player.id) ctx.counters.thaws = (ctx.counters.thaws ?? 0) + 1; }, chronicle(ctx, c) { const milestones = Math.floor((ctx.counters.thaws ?? 0) / 2); const unpaid = milestones - (ctx.counters.thawMilestonesPaid ?? 0); if (unpaid > 0) c.addSplendor(unpaid * 5, 'Thaw Manifest'); ctx.counters.thawMilestonesPaid = milestones; }, status(c) { return `${c.thaws ?? 0} Thaws`; } }),

  // LEGENDARY (3)
  crew({ id: 'last_passenger', name: 'The Last Passenger', rarity: 'legendary', cost: 12, nation: 'north_korea', hue: 355, motif: 'capsule', tags: ['cryo', 'drop', 'legendary'], description: 'Orbital Drops cost **0 Cryo Pods**. Each Thaw grants **+5 {splendor}**.', flavor: 'Nobody remembers booking them. They have a seat assignment.', dropPrice(_ctx, a) { a.cryo = 0; }, onEvent(ctx, ev) { if (ev.type === 'colonistsThawed' && ev.player === ctx.player.id) ctx.counters.thaws = (ctx.counters.thaws ?? 0) + 1; }, chronicle(ctx, c) { const unpaid = (ctx.counters.thaws ?? 0) - (ctx.counters.thawsPaid ?? 0); if (unpaid > 0) c.addSplendor(unpaid * 5, 'Last Passenger'); ctx.counters.thawsPaid = ctx.counters.thaws ?? 0; }, status(c) { return `${c.thaws ?? 0} Thaws`; } }),
  crew({ id: 'red_weather', name: 'Dr. Anika Rao, Red Weather', rarity: 'legendary', cost: 12, nation: 'india', hue: 10, motif: 'sun', tags: ['storm', 'hope', 'legendary'], description: 'If you have taken **3+ storm hits**, gain **×2 {splendor}**; otherwise each hit adds **+2 {splendor}**.', flavor: 'She predicts the weather with unsettling accuracy and unsettling confidence.', onEvent(ctx, ev) { trackStorm(ctx, ev, 'stormHits'); }, chronicle(ctx, c) { const n = ctx.state.run.stats.extra.stormHits ?? 0; if (n >= 3) c.mulSplendor(2, 'Red Weather'); else if (n) c.addSplendor(n * 2, 'Red Weather'); }, status(_c, state) { return `${state.run.stats.extra.stormHits ?? 0}/3 storm hits`; } }),
  crew({ id: 'ark_diaspora', name: 'Captain Amara Okoye, Ark Diaspora', rarity: 'legendary', cost: 12, nation: 'nigeria', hue: 285, motif: 'ark', tags: ['nationality', 'hope', 'legendary'], description: 'Gain **+2 {splendor}** per distinct Crew nationality, then **×1.5 {splendor}** if you have 5+.', flavor: 'Twelve flags. One planet. An alarming number of committee chairs.', chronicle(ctx, c) { const n = new Set(ctx.state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size; if (n) c.addSplendor(n * 2, 'Ark Diaspora'); if (n >= 5) c.mulSplendor(1.5, 'Ark Diaspora'); }, status(_c, state) { return `${new Set(state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size} nationalities`; } }),
];

const CREW_NATION: Record<string, string> = {
  astronaut: 'usa', foreman: 'china', veteran_cosmonaut: 'russia', jugaad_mechanic: 'india',
  roboticist: 'japan', la_joconde: 'france', botanist: 'brazil', wealth_manager: 'uae',
  nollywood_star: 'nigeria', private_banker: 'switzerland', eternal_leader: 'north_korea',
  cardinal: 'vatican', ...Object.fromEntries(MARS_CREW.map(d => [d.id, d.nation ?? ''])),
};
function hasNation(ctx: HookCtx, nations: string[]): boolean {
  return ctx.state.run.doctrines.some(d => nations.includes(CREW_NATION[d.id] ?? ''));
}

registerCrew(MARS_CREW);
