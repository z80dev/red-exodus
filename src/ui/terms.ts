// Single source of player-facing vocabulary (docs/DESIGN.md §4). Internal ids never change; UI copy
// reads these so names stay consistent across HUD, run overlays and menus. Plain B2 English: Mars flavour
// lives in content names and descriptions, not in game-rule words.
import type { PillarId } from '../sim/types';

export const TITLE = 'RED EXODUS';
export const SUBTITLE = 'Fifty Arks. One red world.';

export const T = {
  score: 'Score',
  renown: 'Points',
  splendor: 'Multiplier',
  report: 'Chapter Report',
  focus: 'Focus',
  mandate: 'Lives',
  influence: 'Coins',
  council: 'Shop',
  doctrine: 'Crew',
  doctrines: 'Crew',
  doctrineSlot: 'Slot',
  edict: 'Boost',
  edicts: 'Boosts',
  pack: 'Pack',
  crisis: 'Crisis',
  ascension: 'Difficulty',
  darkAge: 'Second Chance',
  triumph: 'Big Win',
  leader: 'Nation',
  leaders: 'Nations',
  city: 'Colony',
  cities: 'Colonies',
  capital: 'Capital',
  barbarians: 'Raiders',
  camp: 'Raider Camp',
  ruin: 'Crash Site',
  happiness: 'Happiness',
  tech: 'Research',
  breakthrough: 'Research',
  wonder: 'Wonder',
  wonders: 'Wonders',
  naturalWonder: 'Landmark',
  improvement: 'Improvement',
  cryo: 'Pods',
  drop: 'Land Colony',
  thaw: 'Wake Colonists',
  storm: 'Dust Storm',
  turn: 'Turn',
} as const;

export const YIELD_NAMES = { food: 'Food', prod: 'Production', gold: 'Credits', sci: 'Science', cul: 'Culture' } as const;

export const PILLAR_NAMES: Record<PillarId, string> = {
  arts: 'Culture',
  discovery: 'Science',
  commerce: 'Trade',
  conquest: 'Military',
  prosperity: 'Growth',
  glory: 'Wonders',
};

export const PACK_NAMES = { doctrine: 'Crew Pack', edict: 'Boost Pack' } as const;

export const EDITION_NAMES = { base: '', gilded: 'Gold', radiant: 'Shiny', prismatic: 'Rainbow', ethereal: 'Ghost' } as const;
