// Human-seat bot's Council, Omen and Chronicle policy. No random draws or state mutation here.
import { DOCTRINES, EDICTS, OMENS, SCROLLS } from '../../content';
import { councilBuyError, councilRerollError, doctrineSlotsUsed, packPickError } from '../roguelite/council';
import { useEdictError } from '../roguelite/edicts';
import { omenGoal } from '../roguelite/omens';
import type { Action, GameState, PillarId, ShopItem } from '../types';
import { HUMAN } from '../types';

const FOCUS_TAG: Record<PillarId, string> = {
  arts: 'culture', discovery: 'science', commerce: 'gold', conquest: 'conquest', prosperity: 'growth', glory: 'production',
};

function doctrineValue(state: GameState, id: string, edition: string): number {
  const def = DOCTRINES[id];
  if (!def) return -Infinity;
  const { run } = state;
  const tags = def.tags;
  const era = run.era;
  const cities = Object.values(state.cities).filter((c) => c.owner === HUMAN);
  let value = 8;
  if (tags.includes('splendor')) value += 11;
  if (tags.includes('renown')) value += 5;
  if (tags.includes('xsplendor')) value += 9 + era * 3;
  if (tags.includes('scaling')) value += Math.max(0, 5 - era);
  if (tags.includes('influence')) value += era < 4 ? 7 : 2;
  if (tags.includes('risk')) value -= 8;
  if (tags.includes('conquest') && run.stats.kills === 0) value -= 6;
  if (tags.includes('focus')) value += tags.includes(run.focus) ? 10 : 4;
  if (tags.includes(FOCUS_TAG[run.focus])) value += 5;
  if (tags.includes('wide')) value += Math.min(8, cities.length * 2);
  if (tags.includes('tall') && cities.length > 3) value -= 7;
  if (tags.includes('river')) value += cities.some((c) => state.map.tiles[c.tile].riverEdges) ? 5 : -8;
  if (tags.includes('coastal')) value += cities.some((c) => state.map.tiles[c.tile].terrain === 'coast') ? 4 : -8;
  if (tags.includes('mountain')) value += state.map.tiles.some((t) => t.owner === HUMAN && t.elevation === 'mountain') ? 3 : -7;
  if (tags.includes('desert')) value += state.map.tiles.some((t) => t.owner === HUMAN && t.terrain === 'desert') ? 2 : -8;
  if (tags.includes('forest')) value += state.map.tiles.some((t) => t.owner === HUMAN && t.feature === 'forest') ? 3 : -8;
  if (tags.includes('wonders') && !cities.some((c) => c.wonders.length)) value -= 6;
  if (tags.includes('position') && run.doctrines.length < 2) value -= 5;
  for (const owned of run.doctrines) {
    const other = DOCTRINES[owned.id];
    if (other && other.tags.some((t) => !['splendor', 'xsplendor', 'renown'].includes(t) && tags.includes(t))) value += 2;
  }
  if (edition === 'prismatic') value += 18;
  if (edition === 'radiant') value += 12;
  if (edition === 'ethereal') value += 15;
  if (edition === 'gilded') value += era < 2 ? 8 : 3;
  if (def.rarity === 'legendary') value += 16;
  else if (def.rarity === 'rare') value += 8;
  else if (def.rarity === 'uncommon') value += 3;
  return value;
}

function itemValue(state: GameState, item: ShopItem): number {
  const { run } = state;
  switch (item.kind) {
    case 'doctrine': return doctrineValue(state, item.id, item.edition) - item.price * 1.1;
    case 'scroll': {
      const scroll = SCROLLS[item.id];
      const relevant = scroll.scope === 'all' || scroll.scope === 'focus' || scroll.pillar === run.focus;
      return (relevant ? 19 : 8) + (scroll.levels ?? 1) * 5 - item.price;
    }
    case 'reform': return 26 - item.price + (run.era < 3 ? 5 : 0);
    case 'pack': return item.pack === 'doctrine' ? 18 + run.era * 2 - item.price :
      item.pack === 'archive' ? 16 - item.price : item.pack === 'edict' ? 7 - item.price : -Infinity;
    case 'edict': return (['codex_universalis', 'epiphany', 'patronage', 'hermits_tithe', 'grand_festival', 'heavens_clemency', 'golden_harvest', 'rain_of_plenty'].includes(item.id) ? 18 : 7) - item.price;
  }
}

function purchaseAllowed(state: GameState, item: ShopItem): boolean {
  if (item.kind === 'pack' && item.pack === 'doctrine' && doctrineSlotsUsed(state.run) >= state.run.doctrineSlots) return false;
  if (item.kind === 'edict' && state.run.edicts.length >= state.run.edictSlots) return false;
  return true;
}

export function councilAction(state: GameState): Action {
  const council = state.run.council;
  if (!council) return { type: 'leaveCouncil' };
  if (council.pack) {
    let best = -1;
    let value = -Infinity;
    for (let i = 0; i < council.pack.options.length; i++) {
      const item = council.pack.options[i];
      if (packPickError(state, i) !== null) continue;
      const rating = itemValue(state, item);
      if (rating > value) { value = rating; best = i; }
    }
    return { type: 'packPick', index: best < 0 ? null : best };
  }
  let best = -1;
  let value = 10;
  for (let i = 0; i < council.items.length; i++) {
    const item = council.items[i];
    if (!item || councilBuyError(state, i) !== null || !purchaseAllowed(state, item)) continue;
    const rating = itemValue(state, item);
    if (rating > value) { value = rating; best = i; }
  }
  if (best >= 0) return { type: 'councilBuy', slot: best };
  // Replace a weak early card if a substantially better one is on offer.
  if (doctrineSlotsUsed(state.run) >= state.run.doctrineSlots) {
    let weakest = state.run.doctrines.find((d) => d.edition !== 'ethereal' && !DOCTRINES[d.id]?.noSell);
    for (const d of state.run.doctrines) if (d.edition !== 'ethereal' && !DOCTRINES[d.id]?.noSell &&
      weakest && doctrineValue(state, d.id, d.edition) < doctrineValue(state, weakest.id, weakest.edition)) weakest = d;
    const upgrade = council.items.find((item) => item?.kind === 'doctrine' && item.price <= state.run.influence &&
      item.edition !== 'ethereal' && weakest && doctrineValue(state, item.id, item.edition) > doctrineValue(state, weakest.id, weakest.edition) + 12);
    if (weakest && upgrade) return { type: 'sellDoctrine', uid: weakest.uid };
  }
  if (!council.rerollLocked && council.rerolls === 0 && state.run.influence >= council.rerollCost + 8 && councilRerollError(state) === null &&
    doctrineSlotsUsed(state.run) < state.run.doctrineSlots) return { type: 'councilReroll' };
  return { type: 'leaveCouncil' };
}

/** Rank goals by projected chapter progress, rather than accepting whichever omen was first. */
export function chooseOmen(state: GameState): string | null {
  const cities = Object.values(state.cities).filter((c) => c.owner === HUMAN);
  const { era, chapterLength } = state.run;
  const player = state.players.find((p) => p.id === HUMAN)!;
  const gold = cities.reduce((n, c) => n + Math.max(0, c.yields.gold), 0) * chapterLength;
  const pop = cities.reduce((n, c) => n + Math.max(0, c.yields.food - c.pop * 2), 0) * chapterLength / 12;
  const estimates: Record<string, number> = {
    coin_of_the_realm: gold, teeming_masses: pop, shining_city: pop / Math.max(1, cities.length),
    seeds_of_empire: state.turn < 30 ? 1.2 : 0, hands_to_the_soil: player.gold > 70 ? 2 + cities.length : 0,
    stone_upon_stone: cities.length * chapterLength / 8, widening_realm: cities.length * chapterLength * 0.7,
    font_of_knowledge: chapterLength * cities.reduce((n, c) => n + c.yields.sci, 0) / (35 + era * 65),
    beyond_the_edge: state.turn < 30 ? 35 : 0, relics_of_the_ancients: state.turn < 25 ? 1 : 0,
    iron_tide: Math.max(0, 2 - cities.length / 3), red_harvest: state.run.stats.kills + (Object.values(player.relations).includes('war') ? 2 : 0),
    bane_of_barbarians: state.run.stats.kills, hold_the_line: Object.values(player.relations).includes('war') ? 2 : 0,
    word_of_law: state.run.edicts.length, days_of_revelry: 0,
  };
  let best: string | null = null;
  let score = 0;
  for (const id of state.run.omenOffer) {
    const def = OMENS[id];
    if (!def) continue;
    const chance = (estimates[id] ?? 0) / omenGoal(state, def);
    const reward = def.reward.kind === 'doctrine' ? 1.3 : def.reward.kind === 'mandate' && state.run.mandate < state.run.maxMandate ? 1.5 : 1;
    if (chance * reward > score) { score = chance * reward; best = id; }
  }
  return score >= 0.45 ? best : null;
}

function edictTarget(state: GameState, uid: number, id: string): Action | null {
  const def = EDICTS[id];
  if (!def) return null;
  const player = state.players.find((p) => p.id === HUMAN)!;
  const cities = Object.values(state.cities).filter((c) => c.owner === HUMAN);
  // Don't spend a powerful one-shot until it has useful targets.
  if (id === 'heavens_clemency' && state.run.mandate >= state.run.maxMandate) return null;
  if (id === 'pioneers_charter' && cities.length >= 5) return null;
  if (id === 'hermits_tithe' && state.run.influence < 5) return null;
  if (id === 'balm_of_ages' && !Object.values(state.units).some((u) => u.owner === HUMAN && u.hp < 70)) return null;
  if (id === 'olive_branch' && !Object.values(player.relations).includes('war')) return null;
  if (id === 'augurs_sign' && !state.run.omen) return null;
  if (id === 'golden_harvest' && !cities.length) return null;
  const targets = def.target === 'city' ? cities.sort((a, b) => b.yields.prod - a.yields.prod).map((c) => ({ cityId: c.id })) :
    def.target === 'unit' ? Object.values(state.units).filter((u) => u.owner === HUMAN).sort((a, b) => a.hp - b.hp).map((u) => ({ unitId: u.id })) :
      def.target === 'ownedTile' ? state.map.tiles.filter((t) => t.owner === HUMAN && t.elevation !== 'mountain').map((t) => ({ target: t.idx })) :
        def.target === 'tile' ? state.map.tiles.filter((t) => player.vis[t.idx] > 0).map((t) => ({ target: t.idx })) : [{}];
  for (const target of targets) {
    if (useEdictError(state, uid, { tile: 'target' in target ? target.target : undefined,
      cityId: 'cityId' in target ? target.cityId : undefined, unitId: 'unitId' in target ? target.unitId : undefined }) === null)
      return { type: 'useEdict', uid, ...target };
  }
  return null;
}

export function playEdict(state: GameState): Action | null {
  for (const edict of state.run.edicts) {
    const action = edictTarget(state, edict.uid, edict.id);
    if (action) return action;
  }
  return null;
}

/** Stable insertion-sort target: additive beats before multipliers, honoring positional effects. */
export function orderDoctrine(state: GameState): Action | null {
  const cards = state.run.doctrines;
  const rank = (id: string): number => id === 'vanguard' ? -2 : id === 'echo' ? 1 :
    id === 'rearguard' ? 6 : id === 'apotheosis' ? 5 : id === 'keystone' || id === 'mirror_court' ? 4 :
      DOCTRINES[id]?.tags.includes('xsplendor') ? 3 : DOCTRINES[id]?.tags.includes('splendor') ? 1 : 0;
  for (let i = 1; i < cards.length; i++) if (rank(cards[i].id) < rank(cards[i - 1].id))
    return { type: 'moveDoctrine', uid: cards[i].uid, toIndex: i - 1 };
  return null;
}
