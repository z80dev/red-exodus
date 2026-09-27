// OWNER: ContentRogue. Omens — optional chapter objectives (Against the Storm orders). One of two is offered at
// chapter start; the goal is fixed when accepted. `progress` counts only the given player's deeds.
// Goals that scale read "+N per later Era": era index 0 = Ancient.
import type { OmenDef } from '../sim/defs';
import type { PlayerId, SimEvent } from '../sim/types';
import { BARBARIAN, HUMAN } from '../sim/types';
import { DOCTRINE_PRICE } from '../sim/roguelite/constants';
import { unitClassOf } from './doctrines';

const ALL_ERAS = [0, 1, 2, 3, 4, 5];
const LATER_ERAS = [1, 2, 3, 4, 5];
const EDICT_REWARD = 'A random **Edict** (or {influence} if your Edict slots are full)';
const SCROLL_REWARD = 'A random **Scroll**, read at once';

function doctrineReward(rarity: 'common' | 'uncommon' | 'rare'): string {
  const label = rarity[0].toUpperCase() + rarity.slice(1);
  return `A random **${label}** Doctrine (or **${DOCTRINE_PRICE[rarity]}** {influence} if your slots are full)`;
}

/** income, plunder, camps and ruins count; omen rewards, edicts and tribute do not */
function earnedGold(ev: SimEvent, player: PlayerId): number {
  if (ev.type !== 'goldChanged' || ev.player !== player || !(ev.delta > 0)) return 0;
  if (ev.reason.startsWith('Omen') || ev.reason.startsWith('Edict') || ev.reason.startsWith('Tribute')) return 0;
  return ev.delta;
}

const LIST: OmenDef[] = [
  // ── conquest ──
  {
    id: 'red_harvest', name: 'The Red Harvest', icon: 'sword', eras: ALL_ERAS,
    description: 'Slay **3** enemy units (**+1** per later Era).',
    goal: (s) => 3 + s.run.era,
    progress: (ev, _s, p) => (ev.type === 'unitDied' && ev.killer === p && ev.player !== p ? 1 : 0),
    reward: { kind: 'doctrine', rarity: 'uncommon' }, rewardText: doctrineReward('uncommon'),
  },
  {
    id: 'bane_of_barbarians', name: 'Bane of the Barbarians', icon: 'skull', eras: [0, 1, 2],
    description: 'Slay **4** barbarian units.',
    goal: 4,
    progress: (ev, _s, p) => (ev.type === 'unitDied' && ev.killer === p && ev.player === BARBARIAN ? 1 : 0),
    reward: { kind: 'gold', amount: 100 }, rewardText: '**+100** {gold}',
  },
  {
    id: 'ashes_of_the_horde', name: 'Ashes of the Horde', icon: 'flame', eras: [0, 1, 2, 3],
    description: 'Burn **2** barbarian camps.',
    goal: 2,
    progress: (ev, _s, p) => (ev.type === 'campCleared' && ev.player === p ? 1 : 0),
    reward: { kind: 'influence', amount: 5 }, rewardText: '**+5** {influence}',
  },
  {
    id: 'fallen_crown', name: 'The Fallen Crown', icon: 'crown', eras: LATER_ERAS,
    description: 'Capture a city.',
    goal: 1,
    progress: (ev, _s, p) => (ev.type === 'cityCaptured' && ev.to === p ? 1 : 0),
    reward: { kind: 'doctrine', rarity: 'rare' }, rewardText: doctrineReward('rare'),
  },
  {
    id: 'hold_the_line', name: 'Hold the Line', icon: 'shield', eras: ALL_ERAS,
    description: 'Repel **3** attacks: your unit or city survives being attacked.',
    goal: 3,
    progress: (ev, _s, p) => (ev.type === 'combat' && ev.defender.player === p && ev.attacker.player !== p && !ev.defenderKilled ? 1 : 0),
    reward: { kind: 'doctrine', rarity: 'common' }, rewardText: doctrineReward('common'),
  },
  {
    id: 'scorched_earth', name: 'Scorched Earth', icon: 'flame', eras: LATER_ERAS,
    description: 'Pillage **3** enemy improvements.',
    goal: 3,
    progress: (ev, _s, p) => (ev.type === 'improvementPillaged' && ev.by === p ? 1 : 0),
    reward: { kind: 'doctrine', rarity: 'common' }, rewardText: doctrineReward('common'),
  },
  {
    id: 'veterans_of_the_line', name: 'Veterans of the Line', icon: 'xp', eras: LATER_ERAS,
    description: 'Promote **2** units.',
    goal: 2,
    progress: (ev, s, p) => (ev.type === 'unitPromoted' && s.units[ev.unitId]?.owner === p ? 1 : 0),
    reward: { kind: 'influence', amount: 4 }, rewardText: '**+4** {influence}',
  },
  {
    id: 'steel_for_old_swords', name: 'Steel for Old Swords', icon: 'upgrade', eras: LATER_ERAS,
    description: 'Upgrade **2** units.',
    goal: 2,
    progress: (ev, s, p) => (ev.type === 'unitUpgraded' && s.units[ev.unitId]?.owner === p ? 1 : 0),
    reward: { kind: 'influence', amount: 3 }, rewardText: '**+3** {influence}',
  },
  {
    id: 'iron_tide', name: 'The Iron Tide', icon: 'war', eras: [0, 1, 2],
    description: 'Muster **3** military units (**+1** per later Era).',
    goal: (s) => 3 + s.run.era,
    progress: (ev, s, p) => (ev.type === 'unitCreated' && ev.player === p && s.units[ev.unitId] && unitClassOf(s.units[ev.unitId].type) !== 'civilian' ? 1 : 0),
    reward: { kind: 'gold', amount: 100 }, rewardText: '**+100** {gold}',
  },
  {
    id: 'blood_and_thunder', name: 'Blood and Thunder', icon: 'skull', eras: [2, 3, 4, 5],
    description: 'Slay **8** enemy units (**+2** per Era after the Medieval).',
    goal: (s) => 8 + 2 * Math.max(0, s.run.era - 2),
    progress: (ev, _s, p) => (ev.type === 'unitDied' && ev.killer === p && ev.player !== p ? 1 : 0),
    reward: { kind: 'mandate' }, rewardText: '**+1** {mandate}',
  },
  {
    id: 'doom_of_kings', name: 'Doom of Kings', icon: 'skull', eras: [2, 3, 4, 5],
    description: 'Eliminate a rival civilization.',
    goal: 1,
    progress: (ev, _s, p) => (ev.type === 'playerEliminated' && ev.by === p && ev.player !== BARBARIAN ? 1 : 0),
    reward: { kind: 'mandate' }, rewardText: '**+1** {mandate}',
  },
  {
    id: 'doves_return', name: "The Dove's Return", icon: 'peace', eras: LATER_ERAS,
    description: 'Make peace with a rival civilization.',
    goal: 1,
    progress: (ev, _s, p) => (ev.type === 'peaceMade' && (ev.a === p || ev.b === p) ? 1 : 0),
    reward: { kind: 'influence', amount: 5 }, rewardText: '**+5** {influence}',
  },

  // ── prosperity ──
  {
    id: 'seeds_of_empire', name: 'Seeds of Empire', icon: 'found', eras: [0, 1, 2],
    description: 'Found **2** cities.',
    goal: 2,
    progress: (ev, _s, p) => (ev.type === 'cityFounded' && ev.player === p ? 1 : 0),
    reward: { kind: 'doctrine', rarity: 'common' }, rewardText: doctrineReward('common'),
  },
  {
    id: 'teeming_masses', name: 'The Teeming Masses', icon: 'food', eras: ALL_ERAS,
    description: 'Grow your population **4** times (**+2** per later Era).',
    goal: (s) => 4 + 2 * s.run.era,
    progress: (ev, _s, p) => (ev.type === 'cityGrew' && ev.player === p ? 1 : 0),
    reward: { kind: 'scroll' }, rewardText: SCROLL_REWARD,
  },
  {
    id: 'shining_city', name: 'The Shining City', icon: 'city', eras: ALL_ERAS,
    description: 'Grow your capital **3** times.',
    goal: 3,
    progress: (ev, s, p) => (ev.type === 'cityGrew' && ev.player === p && s.cities[ev.cityId]?.isCapital ? 1 : 0),
    reward: { kind: 'scroll' }, rewardText: SCROLL_REWARD,
  },
  {
    id: 'hands_to_the_soil', name: 'Hands to the Soil', icon: 'improve', eras: [0, 1, 2, 3],
    description: 'Build **3** improvements (**+1** per later Era).',
    goal: (s) => 3 + s.run.era,
    progress: (ev, _s, p) => (ev.type === 'improvementBuilt' && ev.player === p ? 1 : 0),
    reward: { kind: 'gold', amount: 120 }, rewardText: '**+120** {gold}',
  },
  {
    id: 'widening_realm', name: 'The Widening Realm', icon: 'map', eras: ALL_ERAS,
    description: 'Claim **4** tiles through border growth (**+1** per later Era).',
    goal: (s) => 4 + s.run.era,
    progress: (ev, _s, p) => (ev.type === 'borderGrew' && ev.player === p ? ev.tiles.length : 0),
    reward: { kind: 'influence', amount: 3 }, rewardText: '**+3** {influence}',
  },
  {
    id: 'coin_of_the_realm', name: 'Coin of the Realm', icon: 'gold', eras: ALL_ERAS,
    description: 'Earn **60** {gold} from income, camps, ruins and plunder (**+110** per later Era).',
    goal: (s) => 60 + 110 * s.run.era,
    progress: (ev, _s, p) => earnedGold(ev, p),
    reward: { kind: 'influence', amount: 4 }, rewardText: '**+4** {influence}',
  },

  // ── glory & discovery ──
  {
    id: 'stone_upon_stone', name: 'Stone upon Stone', icon: 'castle', eras: ALL_ERAS,
    description: 'Raise **2** buildings (**+1** per later Era).',
    goal: (s) => 2 + s.run.era,
    progress: (ev, _s, p) => (ev.type === 'buildingBuilt' && ev.player === p && ev.building !== 'palace' ? 1 : 0),
    reward: { kind: 'edict' }, rewardText: EDICT_REWARD,
  },
  {
    id: 'wonder_for_the_ages', name: 'A Wonder for the Ages', icon: 'pyramid', eras: ALL_ERAS,
    description: 'Complete a Wonder.',
    goal: 1,
    progress: (ev, _s, p) => (ev.type === 'wonderBuilt' && ev.player === p ? 1 : 0),
    reward: { kind: 'doctrine', rarity: 'rare' }, rewardText: doctrineReward('rare'),
  },
  {
    id: 'heavenly_accord', name: 'The Heavenly Accord', icon: 'sun', eras: LATER_ERAS,
    description: 'Complete **2** Wonders.',
    goal: 2,
    progress: (ev, _s, p) => (ev.type === 'wonderBuilt' && ev.player === p ? 1 : 0),
    reward: { kind: 'mandate' }, rewardText: '**+1** {mandate}',
  },
  {
    id: 'font_of_knowledge', name: 'Font of Knowledge', icon: 'flask', eras: ALL_ERAS,
    description: 'Discover **2** technologies.',
    goal: 2,
    progress: (ev, _s, p) => (ev.type === 'techResearched' && ev.player === p ? 1 : 0),
    reward: { kind: 'scroll' }, rewardText: SCROLL_REWARD,
  },
  {
    id: 'beyond_the_edge', name: "Beyond the Map's Edge", icon: 'compass', eras: [0, 1, 2],
    description: 'Chart **30** unexplored tiles.',
    goal: 30,
    progress: (ev, _s, p) => (ev.type === 'tilesRevealed' && ev.player === p ? ev.tiles.length : 0),
    reward: { kind: 'influence', amount: 4 }, rewardText: '**+4** {influence}',
  },
  {
    id: 'relics_of_the_ancients', name: 'Relics of the Ancients', icon: 'key', eras: [0, 1],
    description: 'Explore ancient ruins or discover natural wonders: **2** in total.',
    goal: 2,
    progress: (ev, _s, p) => ((ev.type === 'ruinExplored' || ev.type === 'naturalWonderFound') && ev.player === p ? 1 : 0),
    reward: { kind: 'edict' }, rewardText: EDICT_REWARD,
  },

  // ── the chronicle ──
  {
    id: 'word_of_law', name: 'The Word of Law', icon: 'edict', eras: ALL_ERAS,
    description: 'Issue **2** Edicts.',
    goal: 2,
    progress: (ev, _s, p) => (ev.type === 'edictUsed' && p === HUMAN ? 1 : 0),
    reward: { kind: 'edict' }, rewardText: EDICT_REWARD,
  },
  {
    id: 'days_of_revelry', name: 'Days of Revelry', icon: 'mask', eras: ALL_ERAS,
    description: 'Bank **40** {renown} × Era² as live Renown from festivals and edicts (Ancient = 1).',
    goal: (s) => 40 * (s.run.era + 1) * (s.run.era + 1),
    progress: (ev, _s, p) => (ev.type === 'renownGained' && p === HUMAN ? Math.max(0, ev.amount) : 0),
    reward: { kind: 'influence', amount: 4 }, rewardText: '**+4** {influence}',
  },
];

export const OMENS: Record<string, OmenDef> = Object.fromEntries(LIST.map((o) => [o.id, o]));
