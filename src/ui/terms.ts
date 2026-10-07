// Single source of player-facing vocabulary (docs/DESIGN.md §4). Internal ids never change; UI copy
// reads these so the Mars reskin stays consistent across HUD, run overlays and menus.
import type { PillarId } from '../sim/types';

export const TITLE = 'RED EXODUS';
export const SUBTITLE = 'Fifty-one Arks. One red world.';

export const T = {
  score: 'Viability',
  renown: 'Output',
  splendor: 'Hope',
  report: 'Sol Report',
  focus: 'Priority',
  mandate: 'Charter',
  influence: 'Scrip',
  council: 'The Uplink',
  doctrine: 'Crew',
  doctrines: 'Crew',
  doctrineSlot: 'Bunk',
  edict: 'Salvage',
  edicts: 'Salvage',
  scroll: 'Blueprint',
  scrolls: 'Blueprints',
  pack: 'Supply Drop',
  reform: 'Ark Module',
  reforms: 'Ark Modules',
  omen: 'Directive',
  omens: 'Directives',
  crisis: 'Crisis',
  ascension: 'Hazard',
  darkAge: 'Lifeline',
  triumph: 'Triumph',
  leader: 'Nation',
  leaders: 'Nations',
  city: 'Colony',
  cities: 'Colonies',
  capital: 'Ark Hab',
  barbarians: 'Ferals',
  camp: 'Feral Den',
  ruin: 'Crash Site',
  happiness: 'Stability',
  tech: 'Research',
  breakthrough: 'Breakthrough',
  wonder: 'Megaproject',
  wonders: 'Megaprojects',
  naturalWonder: 'Landmark',
  improvement: 'Installation',
  cryo: 'Cryo Pods',
  drop: 'Orbital Drop',
  thaw: 'Thaw Colonists',
  storm: 'Dust Storm',
  turn: 'Sol',
} as const;

export const YIELD_NAMES = { food: 'Food', prod: 'Industry', gold: 'Credits', sci: 'Data', cul: 'Morale' } as const;

export const PILLAR_NAMES: Record<PillarId, string> = {
  arts: 'Heritage',
  discovery: 'Science',
  commerce: 'Trade',
  conquest: 'Warfare',
  prosperity: 'Growth',
  glory: 'Monuments',
};

export const PACK_NAMES = { doctrine: 'Crew Capsule', archive: 'Blueprint Cache', edict: 'Salvage Crate' } as const;

export const EDITION_NAMES = { base: '', gilded: 'Decorated', radiant: 'Inspired', prismatic: 'Legendary Tale', ethereal: 'Ghost' } as const;
