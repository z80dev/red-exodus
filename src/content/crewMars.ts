// OWNER: Crew. Mars-native Crew (storms, Cryo, Orbital Drops, Breakthroughs, nationality synergies),
// merged into DOCTRINES by content/index.ts.
import type { DoctrineDef, HookCtx, ChronicleCtx, StormDamageArgs } from '../sim/defs';
import { registerCrew } from './doctrineRegistry';
import { stormPowerAt } from '../sim/mars';
import type { SimEvent, GameState } from '../sim/types';
import { addGold } from '../sim/economy';
import { neighbors } from '../sim/hex';
import { changePop } from '../sim/cities';
import { CHAPTERS_PER_ERA } from '../sim/roguelite/constants';
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
  crew({ id: 'storm_chaser', name: 'Mara Velez, Storm Chaser', rarity: 'common', cost: 4, nation: 'brazil', hue: 28, motif: 'cyclone', tags: ['storm', 'hope'], description: 'Each storm hit on your units or colonies adds **+1 {splendor}** in the next Chapter Report.', flavor: 'She says the weather app is “a long story.”', onEvent(ctx, ev) { trackStorm(ctx, ev, 'stormHits'); if (ev.type === 'stormDamage' && ev.player === ctx.player.id) ctx.counters.hope = (ctx.counters.hope ?? 0) + 1; }, chronicle(ctx, c) { const n = ctx.counters.hope ?? 0; if (n) c.addSplendor(n, 'Storm Chaser'); ctx.counters.hope = 0; }, status(c) { return `+${c.hope ?? 0} Multiplier banked`; } }),
  crew({ id: 'wind_farmer', name: 'Asha Nwosu, Wind Farmer', rarity: 'common', cost: 4, nation: 'nigeria', hue: 45, motif: 'turbine', tags: ['storm', 'industry'], description: 'Each storm hit on your colonies adds **+2 {renown}**.', flavor: 'The wind farms work. The weather reports do not.', onEvent(ctx, ev) { if (ev.type === 'stormDamage' && ev.player === ctx.player.id && ev.cityId != null) ctx.counters.output = (ctx.counters.output ?? 0) + 2; }, chronicle(ctx, c) { if (ctx.counters.output) c.addRenown(ctx.counters.output, 'Wind Farmer'); ctx.counters.output = 0; }, status(c) { return `+${c.output ?? 0} Points banked`; } }),
  crew({ id: 'dust_hood', name: 'Jin Park, Dust Hood', rarity: 'common', cost: 4, nation: 'japan', hue: 18, motif: 'visor', tags: ['storm', 'hope'], description: 'Each storm hit that does not kill your unit adds **+1 {splendor}** this chapter.', flavor: 'Her helmet has a second helmet. She feels safe.', onEvent(ctx, ev) { if (ev.type === 'stormDamage' && ev.player === ctx.player.id && !ev.killed) { ctx.counters.hope = (ctx.counters.hope ?? 0) + 1; } }, chronicle(ctx, c) { if (ctx.counters.hope) c.addSplendor(ctx.counters.hope, 'Dust Hood'); ctx.counters.hope = 0; } }),
  crew({ id: 'cryo_tech', name: 'Ravi Menon, Pod Tech', rarity: 'common', cost: 4, nation: 'india', hue: 195, motif: 'pod', tags: ['cryo', 'growth'], description: 'Each time you Wake Colonists, add **+1 colonist** to the colony.', flavor: 'His Pod defrost setting has a “not too cold” option.', onEvent(ctx, ev) { if (ev.type !== 'colonistsThawed' || ev.player !== ctx.player.id) return; const city = ctx.state.cities[ev.cityId]; if (city) changePop(ctx.state, city, 1, ctx.emit); ctx.counters.thaws = (ctx.counters.thaws ?? 0) + 1; } }),
  crew({ id: 'orbital_bookie', name: 'Luca Bellini, Drop Bookie', rarity: 'common', cost: 4, nation: 'vatican', hue: 275, motif: 'orbit', tags: ['drop', 'credits'], description: 'Each time you Land a Colony, get **2 {gold}** back.', flavor: 'The house always wins. The house is a tent.', onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id) { addGold(ctx.state, ctx.player.id, 2, 'Drop Bookie', ctx.emit); ctx.counters.drops = (ctx.counters.drops ?? 0) + 1; } } }),
  crew({ id: 'ice_librarian', name: 'Yuki Sato, Ice Librarian', rarity: 'common', cost: 4, nation: 'japan', hue: 205, motif: 'crystal', tags: ['terrain', 'science'], description: 'Each colony on Frost Plains or Ice Cap adds **+2 {renown}**.', flavor: 'Her return policy is 300,000 years.', chronicle(_ctx, c) { const n = c.cities.filter(city => { const t = _ctx.state.map.tiles[city.tile]; return t.terrain === 'tundra' || t.terrain === 'snow'; }).length; if (n) c.addRenown(n * 2, 'Ice Librarian'); } }),
  crew({ id: 'tube_gardener', name: 'Mina Haddad, Tube Gardener', rarity: 'common', cost: 4, nation: 'uae', hue: 110, motif: 'sprout', tags: ['terrain', 'food'], description: 'Each colony on Lava Tubes adds **+1 {splendor}**.', flavor: 'Her greenhouse has no sunlight and a long waiting list.', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].feature === 'jungle').length; if (n) c.addSplendor(n, 'Tube Gardener'); } }),
  crew({ id: 'hoodoo_surveyor', name: 'Émile Roche, Spire Surveyor', rarity: 'common', cost: 4, nation: 'france', hue: 35, motif: 'spire', tags: ['terrain', 'industry'], description: 'Each colony on Rock Spires adds **+2 {renown}**.', flavor: 'To him, every rock looks like a retired mayor.', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].feature === 'forest').length; if (n) c.addRenown(n * 2, 'Spire Surveyor'); } }),
  crew({ id: 'brine_sommelier', name: 'Olena Volkov, Salt Lake Taster', rarity: 'common', cost: 4, nation: 'russia', hue: 185, motif: 'drop', tags: ['terrain', 'hope'], description: 'Each colony next to a Salt Lake adds **+1 {splendor}**.', flavor: 'Tastes like salt, copper, and a lost ocean.', chronicle(ctx, c) { const n = c.cities.filter(city => neighbors(ctx.state.map, city.tile).some(idx => ctx.state.map.tiles[idx].terrain === 'lake')).length; if (n) c.addSplendor(n, 'Salt Lake Taster'); } }),
  crew({ id: 'channel_runner', name: 'Nikhil Rao, Channel Runner', rarity: 'common', cost: 4, nation: 'india', hue: 215, motif: 'ripple', tags: ['terrain', 'growth'], description: 'Each colony on an Ice Channel adds **+1 {renown}** for each pop.', flavor: 'He delivers mail by rover. It arrives before the answer.', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].riverEdges !== 0).reduce((sum, city) => sum + city.pop, 0); if (n) c.addRenown(n, 'Channel Runner'); } }),
  crew({ id: 'first_thaw', name: 'Mei Lin, First Wake', rarity: 'common', cost: 4, nation: 'china', hue: 195, motif: 'sunrise', tags: ['cryo', 'hope'], description: 'The first time you Wake Colonists each chapter, add **+3 {splendor}**.', flavor: 'She packed a sunrise in the medical kit. It was a lamp.', onEvent(ctx, ev) { const chapter = ctx.state.run.era * CHAPTERS_PER_ERA + ctx.state.run.chapter + 1; if (ev.type === 'colonistsThawed' && ev.player === ctx.player.id && ctx.counters.firstThaw !== chapter) { ctx.counters.firstThaw = chapter; ctx.counters.hope = 3; } }, chronicle(ctx, c) { if (ctx.counters.hope) c.addSplendor(ctx.counters.hope, 'First Wake'); ctx.counters.hope = 0; } }),
  crew({ id: 'draft_clerk', name: 'Noah Kim, Research Clerk', rarity: 'common', cost: 4, nation: 'usa', hue: 225, motif: 'clipboard', tags: ['research', 'science'], description: 'Each research offer adds **+1 {renown}**.', flavor: 'He has been “checking in” since Earth went dark.', onEvent(ctx, ev) { if (ev.type === 'researchOffered' && ev.player === ctx.player.id) { ctx.counters.offers = (ctx.counters.offers ?? 0) + 1; } }, chronicle(ctx, c) { if (ctx.counters.offers) c.addRenown(ctx.counters.offers, 'Research Clerk'); ctx.counters.offers = 0; } }),
  crew({ id: 'storm_kite', name: 'Mateo Silva, Storm Kite', rarity: 'common', cost: 4, nation: 'brazil', hue: 250, motif: 'kite', tags: ['storm', 'research'], description: 'Each storm hit on your colonies adds **+1 {renown}**.', flavor: 'He flies kites in thin air. His boss calls it “a plan.”', onEvent(ctx, ev) { if (ev.type === 'stormDamage' && ev.player === ctx.player.id && ev.cityId != null) ctx.counters.output = (ctx.counters.output ?? 0) + 1; }, chronicle(ctx, c) { if (ctx.counters.output) c.addRenown(ctx.counters.output, 'Storm Kite'); ctx.counters.output = 0; } }),
  crew({ id: 'pod_cad', name: 'Sofia Keller, Pod Designer', rarity: 'common', cost: 4, nation: 'switzerland', hue: 40, motif: 'blueprint', tags: ['drop', 'industry'], description: 'Each time you Land a Colony, add **+2 {renown}**.', flavor: 'Her Pods land within 20 centimeters. The crew needs longer.', onEvent(ctx, ev) { if (ev.type === 'podLanded' && ev.player === ctx.player.id) ctx.counters.output = (ctx.counters.output ?? 0) + 2; }, chronicle(ctx, c) { if (ctx.counters.output) c.addRenown(ctx.counters.output, 'Pod Designer'); ctx.counters.output = 0; } }),

  // UNCOMMON (11)
  crew({ id: 'dust_prophet', name: 'Sister Agnes, Dust Prophet', rarity: 'uncommon', cost: 6, nation: 'vatican', hue: 290, motif: 'halo', tags: ['storm', 'hope'], description: 'If storms hit you **3+** times this chapter, get **×1.5 {splendor}**.', flavor: 'The forecast said disaster. She said “again?”', onEvent(ctx, ev) { trackStorm(ctx, ev, 'stormHits'); }, chronicle(ctx, c) { if ((ctx.state.run.stats.extra.stormHits ?? 0) >= 3) c.mulSplendor(1.5, 'Dust Prophet'); }, status(_c, state) { return `${state.run.stats.extra.stormHits ?? 0}/3 storm hits`; } }),
  crew({ id: 'storm_broker', name: 'Viktor Sokolov, Storm Broker', rarity: 'uncommon', cost: 6, nation: 'russia', hue: 5, motif: 'barometer', tags: ['storm', 'credits'], description: 'Each storm hit on your units gives **1 {gold}**.', flavor: 'He sells insurance that never pays. He is very good at it.', onEvent(ctx, ev) { if (ev.type === 'stormDamage' && ev.player === ctx.player.id && ev.unitId != null) addGold(ctx.state, ctx.player.id, 1, 'Storm Broker', ctx.emit); } }),
  crew({ id: 'safe_harbor', name: 'Amina Okafor, Safe Harbor', rarity: 'uncommon', cost: 6, nation: 'nigeria', hue: 120, motif: 'shield', tags: ['storm', 'defense'], description: 'Your units take **1 less storm damage**.', flavor: 'Her shelter is just a cave with better paperwork.', storm(ctx, a) { if (a.victim === ctx.player.id) a.damage = Math.max(0, a.damage - 1); } }),
  crew({ id: 'cheap_seats', name: 'Pavel Orlov, Cheap Seats', rarity: 'uncommon', cost: 6, nation: 'russia', hue: 265, motif: 'ticket', tags: ['drop', 'cryo'], description: 'Land Colony costs **1 less {gold}** (minimum 0).', flavor: 'The Pod is first class. The landing is not.', dropPrice(_ctx, a) { a.gold = Math.max(0, a.gold - 1); } }),
  crew({ id: 'cryo_accountant', name: 'Elena Rossi, Pod Accountant', rarity: 'uncommon', cost: 6, nation: 'france', hue: 50, motif: 'ledger', tags: ['cryo', 'credits'], description: 'Each time you Wake Colonists, get **1 {gold}** back.', flavor: '“The last passenger is a small mistake.” She had not met him yet.', onEvent(ctx, ev) { if (ev.type === 'colonistsThawed' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 1, 'Pod Accountant', ctx.emit); } }),
  crew({ id: 'three_bids', name: 'Priya Das, Three Bids', rarity: 'uncommon', cost: 6, nation: 'india', hue: 220, motif: 'cards', tags: ['research', 'science'], description: 'Each research offer has **1 more tech**.', flavor: 'She wants three offers before she accepts the end of the universe.', researchOffers(_ctx, a) { a.value += 1; } }),
  crew({ id: 'reroll_ref', name: 'Tomás Costa, Reroll Judge', rarity: 'uncommon', cost: 6, nation: 'brazil', hue: 30, motif: 'whistle', tags: ['research', 'credits'], description: 'Research rerolls cost **2 less {gold}** (minimum 0).', flavor: 'He will change any result, even his own.', researchReroll(_ctx, a) { a.value = Math.max(0, a.value - 2); } }),
  crew({ id: 'diaspora', name: 'Mariam Haddad, Many Homes', rarity: 'uncommon', cost: 6, nation: 'uae', hue: 310, motif: 'constellation', tags: ['nationality', 'hope'], description: 'Add **+1 {splendor}** for each different nation among your Crew.', flavor: 'Mars has one sky. We brought fifty ways to argue about it.', chronicle(ctx, c) { const nations = new Set(ctx.state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)); if (nations.size) c.addSplendor(nations.size, 'Many Homes'); }, status(_c, state) { return `${new Set(state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size} nations`; } }),
  crew({ id: 'polar_pair', name: 'Yelena Morozova, Polar Pair', rarity: 'uncommon', cost: 6, nation: 'russia', hue: 200, motif: 'snowflake', tags: ['nationality', 'hope'], description: 'If you have a Russian or Swiss Crew member, add **+4 {splendor}**.', flavor: 'Two people, one heater. Neither says it is cold.', chronicle(ctx, c) { if (hasNation(ctx, ['russia', 'switzerland'])) c.addSplendor(4, 'Polar Pair'); } }),
  crew({ id: 'brine_union', name: 'Chen Wei, Salt Lake Union', rarity: 'uncommon', cost: 6, nation: 'china', hue: 185, motif: 'water', tags: ['terrain', 'nationality'], description: 'Each colony next to a Salt Lake adds **+2 {renown}**, or **+4** if you have a Chinese Crew member.', flavor: 'The fight over water lasted longer than the water.', chronicle(ctx, c) { const n = c.cities.filter(city => neighbors(ctx.state.map, city.tile).some(idx => ctx.state.map.tiles[idx].terrain === 'lake')).length; if (n) c.addRenown(n * (hasNation(ctx, ['china']) ? 4 : 2), 'Salt Lake Union'); } }),
  crew({ id: 'channel_cartographer', name: 'Camila Nascimento, Channel Mapper', rarity: 'uncommon', cost: 6, nation: 'brazil', hue: 210, motif: 'map', tags: ['terrain', 'research'], description: 'Each colony on an Ice Channel adds **+1 {renown}** for each pop.', flavor: 'The map says “river.” The river says “I am under you.”', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].riverEdges !== 0).reduce((sum, city) => sum + city.pop, 0); if (n) c.addRenown(n, 'Channel Mapper'); } }),

  // RARE (7)
  crew({ id: 'storm_crown', name: 'Zhao Wen, Storm Crown', rarity: 'rare', cost: 8, nation: 'china', hue: 15, motif: 'crown', tags: ['storm', 'hope'], description: 'Each unit that a storm kills on your land adds **+5 {splendor}**.', flavor: 'A bad day for Raiders. A great day for his report.', onEvent(ctx, ev) { trackStorm(ctx, ev, 'stormKills'); }, chronicle(ctx, c) { const n = ctx.counters.pendingStormKills ?? 0; if (n) c.addSplendor(n * 5, 'Storm Crown'); ctx.counters.pendingStormKills = 0; }, status(c) { return `${c.stormKills ?? 0} storm kills`; } }),
  crew({ id: 'drop_commissioner', name: 'Grace Miller, Drop Chief', rarity: 'rare', cost: 8, nation: 'usa', hue: 55, motif: 'pod', tags: ['drop', 'cryo'], description: 'Land Colony costs **1 less Pod** (minimum 0).', flavor: 'The team approved the landing. Gravity had already voted.', dropPrice(_ctx, a) { a.cryo = Math.max(0, a.cryo - 1); } }),
  crew({ id: 'black_box', name: 'Jun Seo, Black Box', rarity: 'rare', cost: 8, nation: 'japan', hue: 230, motif: 'recorder', tags: ['research', 'hope'], description: 'Each tech you finish adds **+2 {splendor}**.', flavor: 'The flight recorder has one line: “we tried.”', onEvent(ctx, ev) { if (ev.type === 'techResearched' && ev.player === ctx.player.id) { ctx.counters.techs = (ctx.counters.techs ?? 0) + 1; ctx.counters.pendingTechs = (ctx.counters.pendingTechs ?? 0) + 1; } }, chronicle(ctx, c) { if (ctx.counters.pendingTechs) c.addSplendor(ctx.counters.pendingTechs * 2, 'Black Box'); ctx.counters.pendingTechs = 0; }, status(c) { return `${c.techs ?? 0} techs logged`; } }),
  crew({ id: 'storm_wallflower', name: 'Anika Meier, Storm Hider', rarity: 'rare', cost: 8, nation: 'switzerland', hue: 165, motif: 'dome', tags: ['storm', 'growth'], description: 'If any tile you own is in a storm, get **×1.5 {splendor}**.', flavor: 'She only goes out when the weather tries to kill her.', chronicle(ctx, c) { if (touchedStormTiles(ctx) > 0) c.mulSplendor(1.5, 'Storm Hider'); } }),
  crew({ id: 'three_languages', name: 'Amara Bello, Three Languages', rarity: 'rare', cost: 8, nation: 'nigeria', hue: 320, motif: 'speech', tags: ['nationality', 'hope'], description: '**×1** {splendor}, plus **×0.25** for each different nation among your Crew beyond the first (max **×2**).', flavor: 'The meeting has twelve translators and no shared plan.', chronicle(ctx, c) { const n = new Set(ctx.state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size; if (n > 1) c.mulSplendor(Math.min(2, 1 + (n - 1) * 0.25), 'Three Languages'); }, status(_c, state) { const n = new Set(state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size; return `×${Math.min(2, 1 + Math.max(0, n - 1) * .25).toFixed(2)} Multiplier`; } }),
  crew({ id: 'tube_network', name: 'Dara Kim, Tube Network', rarity: 'rare', cost: 8, nation: 'japan', hue: 125, motif: 'roots', tags: ['terrain', 'growth'], description: 'Each colony on Lava Tubes adds **+3 {renown}** and **+1 {splendor}**.', flavor: 'The tunnels are safe and wide. Only some are full of dust.', chronicle(ctx, c) { const n = c.cities.filter(city => ctx.state.map.tiles[city.tile].feature === 'jungle').length; if (n) { c.addRenown(n * 3, 'Tube Network'); c.addSplendor(n, 'Tube Network'); } } }),
  crew({ id: 'thaw_manifest', name: 'Lucía Ferreira, Wake List', rarity: 'rare', cost: 8, nation: 'brazil', hue: 195, motif: 'manifest', tags: ['cryo', 'hope'], description: 'Every **2 times** you Wake Colonists, add **+5 {splendor}**.', flavor: 'She keeps three copies of the list. Nobody asks why.', onEvent(ctx, ev) { if (ev.type === 'colonistsThawed' && ev.player === ctx.player.id) ctx.counters.thaws = (ctx.counters.thaws ?? 0) + 1; }, chronicle(ctx, c) { const milestones = Math.floor((ctx.counters.thaws ?? 0) / 2); const unpaid = milestones - (ctx.counters.thawMilestonesPaid ?? 0); if (unpaid > 0) c.addSplendor(unpaid * 5, 'Wake List'); ctx.counters.thawMilestonesPaid = milestones; }, status(c) { return `${c.thaws ?? 0} wakes`; } }),

  // LEGENDARY (3)
  crew({ id: 'last_passenger', name: 'The Last Passenger', rarity: 'legendary', cost: 12, nation: 'north_korea', hue: 355, motif: 'capsule', tags: ['cryo', 'drop', 'legendary'], description: 'Land Colony costs **0 Pods**. Each time you Wake Colonists, add **+5 {splendor}**.', flavor: 'Nobody remembers booking him. He has a seat number.', dropPrice(_ctx, a) { a.cryo = 0; }, onEvent(ctx, ev) { if (ev.type === 'colonistsThawed' && ev.player === ctx.player.id) ctx.counters.thaws = (ctx.counters.thaws ?? 0) + 1; }, chronicle(ctx, c) { const unpaid = (ctx.counters.thaws ?? 0) - (ctx.counters.thawsPaid ?? 0); if (unpaid > 0) c.addSplendor(unpaid * 5, 'Last Passenger'); ctx.counters.thawsPaid = ctx.counters.thaws ?? 0; }, status(c) { return `${c.thaws ?? 0} wakes`; } }),
  crew({ id: 'red_weather', name: 'Dr. Anika Rao, Red Weather', rarity: 'legendary', cost: 12, nation: 'india', hue: 10, motif: 'sun', tags: ['storm', 'hope', 'legendary'], description: 'With **3+ storm hits** this chapter, get **×2 {splendor}**. With fewer, add **+2 {splendor}** for each hit.', flavor: 'She predicts the weather very well. She is also very sure.', onEvent(ctx, ev) { trackStorm(ctx, ev, 'stormHits'); }, chronicle(ctx, c) { const n = ctx.state.run.stats.extra.stormHits ?? 0; if (n >= 3) c.mulSplendor(2, 'Red Weather'); else if (n) c.addSplendor(n * 2, 'Red Weather'); }, status(_c, state) { return `${state.run.stats.extra.stormHits ?? 0}/3 storm hits`; } }),
  crew({ id: 'ark_diaspora', name: 'Captain Amara Okoye, Ark Peoples', rarity: 'legendary', cost: 12, nation: 'nigeria', hue: 285, motif: 'ark', tags: ['nationality', 'hope', 'legendary'], description: 'Add **+2 {splendor}** for each different nation among your Crew. With 5 or more nations, also get **×1.5 {splendor}**.', flavor: 'Fifty flags. One planet. Too many committee chairs.', chronicle(ctx, c) { const n = new Set(ctx.state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size; if (n) c.addSplendor(n * 2, 'Ark Peoples'); if (n >= 5) c.mulSplendor(1.5, 'Ark Peoples'); }, status(_c, state) { return `${new Set(state.run.doctrines.map(d => CREW_NATION[d.id]).filter(Boolean)).size} nations`; } }),
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
