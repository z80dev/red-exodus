// OWNER: Nations (slice westeurope). Leader-unique units & buildings for Germany, the UK, Italy, Spain, the
// Netherlands, Belgium, Ireland, Portugal, Austria and Denmark.
// Literal defs only: units.ts/buildings.ts import this module at evaluation time, so nothing here may read
// UNITS/BUILDINGS while the module evaluates (type imports only). Unique units reuse the replaced unit's model.
import type { BuildingDef, UnitDef } from '../../sim/defs';

export const UNIQUE_UNITS_WESTEUROPE: Record<string, UnitDef> = {
  eisenfaust_driver: {
    id: 'eisenfaust_driver', name: 'Eisenfaust Driver', era: 3, class: 'siege', cost: 82, strength: 16, rangedStrength: 36, range: 2, moves: 2, vision: 2,
    tech: 'metallurgy', upgradesTo: 'artillery', abilities: ['noMelee'],
    uniqueTo: 'germany', replaces: 'cannon', model: 'u_cannon', icon: 'siege',
    description: 'Replaces the Mass Driver. Ranged attack with range 2. Stronger shot. No special resource needed.',
  },
  longbow_coilgunner: {
    id: 'longbow_coilgunner', name: 'Longbow Coil Gunner', era: 2, class: 'ranged', cost: 52, strength: 13, rangedStrength: 19, range: 2, moves: 2, vision: 3,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    uniqueTo: 'uk', replaces: 'crossbowman', model: 'u_crossbowman', icon: 'ranged',
    description: 'Replaces the Coil Gunner. Ranged attack with range 2. Stronger, and sees farther.',
  },
  codex_mortar: {
    id: 'codex_mortar', name: 'Codex Mortar', era: 1, class: 'siege', cost: 40, strength: 7, rangedStrength: 18, range: 2, moves: 2, vision: 2,
    tech: 'mathematics', upgradesTo: 'trebuchet', abilities: ['noMelee', 'ignoreTerrain'],
    uniqueTo: 'italy', replaces: 'catapult', model: 'u_catapult', icon: 'siege',
    description: 'Replaces the Mortar Team. Stronger shot. Ignores terrain costs.',
  },
  matador_hover_bike: {
    id: 'matador_hover_bike', name: 'Matador Hover Bike', era: 2, class: 'mounted', cost: 62, strength: 23, moves: 4, vision: 2,
    tech: 'chivalry', upgradesTo: 'cavalry', bonusVs: { mounted: 30 }, abilities: ['moveAfterAttack'],
    uniqueTo: 'spain', replaces: 'knight', model: 'u_knight', icon: 'mounted',
    description: 'Replaces the Hover Bike. +30% against mounted units. Can move after attacking. No special resource needed.',
  },
  dijkwacht_squad: {
    id: 'dijkwacht_squad', name: 'Dijkwacht Squad', era: 2, class: 'antiCavalry', cost: 50, strength: 17, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'at_gun', bonusVs: { mounted: 100 }, abilities: ['amphibious'],
    uniqueTo: 'netherlands', replaces: 'pikeman', model: 'u_pikeman', icon: 'antiCavalry',
    description: 'Replaces the Rocket Squad. Stronger, and +100% against mounted units. No penalty for attacking across rivers.',
  },
  ardennes_ranger: {
    id: 'ardennes_ranger', name: 'Ardennes Ranger', era: 2, class: 'melee', cost: 58, strength: 22, moves: 2, vision: 3,
    tech: 'steel', upgradesTo: 'musketman', abilities: ['noZoc'],
    uniqueTo: 'belgium', replaces: 'man_at_arms', model: 'u_man_at_arms', icon: 'melee',
    description: 'Replaces the Exo-Trooper. Sees farther. Enemy units do not slow it down. No special resource needed.',
  },
  sliotar_slinger: {
    id: 'sliotar_slinger', name: 'Ball Slinger', era: 0, class: 'ranged', cost: 24, strength: 6, rangedStrength: 9, range: 2, moves: 2, vision: 2,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee'],
    uniqueTo: 'ireland', replaces: 'archer', model: 'u_archer', icon: 'ranged',
    description: 'Replaces the Slug Thrower. Cheaper, with a stronger shot. Range 2. Cannot melee.',
  },
  navegador_rover: {
    id: 'navegador_rover', name: 'Navegador Rover', era: 0, class: 'recon', cost: 22, strength: 5, moves: 3, vision: 5,
    tech: null, abilities: ['amphibious'],
    uniqueTo: 'portugal', replaces: 'scout', model: 'u_scout', icon: 'recon',
    description: 'Replaces the Scout Rover. Sees very far. Can move over water.',
  },
  edelweiss_jager: {
    id: 'edelweiss_jager', name: 'Edelweiss Jäger', era: 4, class: 'melee', cost: 105, strength: 46, moves: 2, vision: 3,
    tech: 'rifling', upgradesTo: 'infantry', abilities: ['ignoreTerrain'],
    uniqueTo: 'austria', replaces: 'rifleman', model: 'u_rifleman', icon: 'melee',
    description: 'Replaces the Hardsuit Marine. Stronger, and ignores terrain costs.',
  },
  viking_raider: {
    id: 'viking_raider', name: 'Viking Warrior', era: 0, class: 'melee', cost: 22, strength: 10, moves: 3, vision: 2,
    tech: null, upgradesTo: 'swordsman',
    uniqueTo: 'denmark', replaces: 'warrior', model: 'u_warrior', icon: 'melee',
    description: 'Replaces the Militia. Stronger and faster.',
  },
};

export const UNIQUE_BUILDINGS_WESTEUROPE: Record<string, BuildingDef> = {
  mittelstand_works: {
    id: 'mittelstand_works', name: 'Mittelstand Works', era: 4, cost: 240, tech: 'industrialization', yields: { prod: 4 }, pct: { prod: 30 }, maintenance: 3,
    uniqueTo: 'germany', replaces: 'factory', requires: 'workshop', model: 'bld_factory', pillar: 'glory', icon: 'factory',
    description: 'Replaces the Factory: +4 {prod} and +30% {prod}. Requires a Workshop.',
  },
  royal_dockyard: {
    id: 'royal_dockyard', name: 'Royal Dockyard', era: 2, cost: 105, tech: 'cartography', yields: { gold: 2, food: 2 }, pct: { gold: 15 }, maintenance: 2,
    coastal: true, uniqueTo: 'uk', replaces: 'harbor', model: 'bld_harbor', pillar: 'commerce', icon: 'harbor',
    description: 'Replaces the Skiff Dock: +2 {gold}, +2 {food}, +15% {gold}. Coastal only.',
  },
  grand_galleria: {
    id: 'grand_galleria', name: 'Grand Galleria', era: 3, cost: 180, tech: 'architecture', yields: { cul: 6 }, happiness: 2, influence: 1, maintenance: 3,
    uniqueTo: 'italy', replaces: 'museum', requires: 'amphitheater', pillar: 'arts', icon: 'museum',
    description: 'Replaces the Holo-Archive: +6 {cul}, +2 {happy}, +1 {influence} per chapter. Requires a Holo-Theater.',
  },
  plaza_mayor: {
    id: 'plaza_mayor', name: 'Plaza Mayor', era: 0, cost: 40, tech: null, yields: { cul: 2, gold: 2 }, happiness: 1, maintenance: 0,
    uniqueTo: 'spain', replaces: 'monument', pillar: 'arts', icon: 'monument',
    description: 'Replaces the Crew Memorial: +2 {cul}, +2 {gold}, +1 {happy}.',
  },
  polder_pump: {
    id: 'polder_pump', name: 'Polder Pump', era: 2, cost: 105, tech: 'engineering', yields: { food: 3, prod: 1 }, perPop: { food: 0.25 }, maintenance: 1,
    uniqueTo: 'netherlands', replaces: 'aqueduct', model: 'bld_aqueduct', pillar: 'prosperity', icon: 'aqueduct',
    description: 'Replaces the Water Recycler: +3 {food}, +1 {prod}, +0.25 {food} per colonist.',
  },
  chocolaterie: {
    id: 'chocolaterie', name: 'Chocolaterie', era: 1, cost: 80, tech: 'currency', yields: { gold: 2, cul: 1 }, pct: { gold: 20 }, happiness: 2, maintenance: 1,
    uniqueTo: 'belgium', replaces: 'market', model: 'bld_market', pillar: 'commerce', icon: 'market',
    description: 'Replaces the Exchange: +2 {gold}, +1 {cul}, +2 {happy}, +20% {gold}.',
  },
  last_orders_pub: {
    id: 'last_orders_pub', name: 'Last Orders Pub', era: 0, cost: 40, tech: null, yields: { cul: 2, gold: 1 }, happiness: 2, maintenance: 1,
    uniqueTo: 'ireland', replaces: 'shrine', pillar: 'arts', icon: 'shrine',
    description: 'Replaces the Earth Shrine: +2 {cul}, +1 {gold}, +2 {happy}.',
  },
  sagres_beacon: {
    id: 'sagres_beacon', name: 'Sagres Beacon', era: 0, cost: 45, tech: 'sailing', yields: { gold: 1, sci: 2 }, pct: { sci: 10 }, maintenance: 1,
    coastal: true, uniqueTo: 'portugal', replaces: 'lighthouse', model: 'bld_lighthouse', pillar: 'discovery', icon: 'lighthouse',
    description: 'Replaces the Beacon Tower: +1 {gold}, +2 {sci}, +10% {sci}. Coastal only.',
  },
  kaffeehaus: {
    id: 'kaffeehaus', name: 'Kaffeehaus', era: 1, cost: 70, tech: 'writing', yields: { sci: 2, cul: 2 }, perPop: { sci: 0.25 }, maintenance: 1,
    uniqueTo: 'austria', replaces: 'library', model: 'bld_library', pillar: 'discovery', icon: 'library',
    description: 'Replaces the Data Archive: +2 {sci}, +2 {cul}, +0.25 {sci} per colonist.',
  },
  hygge_lounge: {
    id: 'hygge_lounge', name: 'Hygge Lounge', era: 1, cost: 65, tech: 'calendar', yields: { cul: 2, food: 1 }, happiness: 3, maintenance: 1,
    uniqueTo: 'denmark', replaces: 'temple', requires: 'shrine', model: 'bld_temple', pillar: 'arts', icon: 'temple',
    description: 'Replaces the Memorial Chapel: +2 {cul}, +1 {food}, +3 {happy}. Requires an Earth Shrine.',
  },
};
