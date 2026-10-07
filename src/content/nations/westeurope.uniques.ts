// OWNER: Nations (slice westeurope). Leader-unique units & buildings for Germany, the UK, Italy, Spain, the
// Netherlands, Belgium, Ireland, Portugal, Austria and Denmark.
// Literal defs only: units.ts/buildings.ts import this module at evaluation time, so nothing here may read
// UNITS/BUILDINGS while the module evaluates (type imports only). Unique units reuse the replaced unit's model.
import type { BuildingDef, UnitDef } from '../../sim/defs';

export const UNIQUE_UNITS_WESTEUROPE: Record<string, UnitDef> = {
  eisenfaust_driver: {
    id: 'eisenfaust_driver', name: 'Eisenfaust Driver', era: 3, class: 'siege', cost: 82, strength: 16, rangedStrength: 32, range: 2, moves: 2, vision: 2,
    tech: 'metallurgy', upgradesTo: 'artillery', bonusVs: { city: 200 }, abilities: ['noMelee'],
    uniqueTo: 'germany', replaces: 'cannon', model: 'u_cannon', icon: 'siege',
    description: 'A precision-machined mass driver that never misses a maintenance window. Replaces the Mass Driver with a sharper punch and no Perchlorate requirement.',
  },
  longbow_coilgunner: {
    id: 'longbow_coilgunner', name: 'Longbow Coilgunner', era: 2, class: 'ranged', cost: 52, strength: 13, rangedStrength: 19, range: 2, moves: 2, vision: 3,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    uniqueTo: 'uk', replaces: 'crossbowman', model: 'u_crossbowman', icon: 'ranged',
    description: 'Fires in an orderly queue, one very polite hit after another. Replaces the Coilgunner with a stiffer punch and a longer view of the dunes.',
  },
  codex_mortar: {
    id: 'codex_mortar', name: 'Codex Mortar', era: 1, class: 'siege', cost: 40, strength: 7, rangedStrength: 16, range: 2, moves: 2, vision: 2,
    tech: 'mathematics', upgradesTo: 'trebuchet', bonusVs: { city: 200 }, abilities: ['noMelee', 'ignoreTerrain'],
    uniqueTo: 'italy', replaces: 'catapult', model: 'u_catapult', icon: 'siege',
    description: 'Built from a notebook of brilliant designs nobody had time to test. Replaces the Mortar Team with folding legs that shrug off rough ground.',
  },
  matador_hover_bike: {
    id: 'matador_hover_bike', name: 'Matador Hover Bike', era: 2, class: 'mounted', cost: 62, strength: 23, moves: 4, vision: 2,
    tech: 'chivalry', upgradesTo: 'cavalry', bonusVs: { mounted: 30, city: -20 }, abilities: ['moveAfterAttack'],
    uniqueTo: 'spain', replaces: 'knight', model: 'u_knight', icon: 'mounted',
    description: 'Dodges the charge, strikes, and rides off to loud applause. Replaces the Hover Bike with a duelist’s edge against other rovers; no Methane requirement.',
  },
  dijkwacht_squad: {
    id: 'dijkwacht_squad', name: 'Dijkwacht Squad', era: 2, class: 'antiCavalry', cost: 50, strength: 17, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'at_gun', bonusVs: { mounted: 100 }, abilities: ['amphibious'],
    uniqueTo: 'netherlands', replaces: 'pikeman', model: 'u_pikeman', icon: 'antiCavalry',
    description: 'Dike wardens who treat every river as a municipal project. Replaces the Lancer Squad with extra strength and no penalty for attacking across rivers.',
  },
  ardennes_ranger: {
    id: 'ardennes_ranger', name: 'Ardennes Ranger', era: 2, class: 'melee', cost: 58, strength: 22, moves: 2, vision: 3,
    tech: 'steel', upgradesTo: 'musketman', abilities: ['noZoc'],
    uniqueTo: 'belgium', replaces: 'man_at_arms', model: 'u_man_at_arms', icon: 'melee',
    description: 'Moves through enemy lines like a signature that was never on the form. Replaces the Exo-Trooper with longer vision and no zone-of-control penalty; no Nickel-Iron requirement.',
  },
  sliotar_slinger: {
    id: 'sliotar_slinger', name: 'Sliotar Slinger', era: 0, class: 'ranged', cost: 24, strength: 6, rangedStrength: 9, range: 2, moves: 2, vision: 2,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee'],
    uniqueTo: 'ireland', replaces: 'archer', model: 'u_archer', icon: 'ranged',
    description: 'A hurley, a hard little ball and a lifetime of grudges settled by sport. Replaces the Slug Thrower with a cheaper, harder-hitting shot.',
  },
  navegador_rover: {
    id: 'navegador_rover', name: 'Navegador Rover', era: 0, class: 'recon', cost: 22, strength: 5, moves: 3, vision: 5,
    tech: null, abilities: ['amphibious'],
    uniqueTo: 'portugal', replaces: 'scout', model: 'u_scout', icon: 'recon',
    description: 'A scout with a sextant bolted to the dashboard and a lot of opinions about the horizon. Replaces the Scout Rover with a far longer view.',
  },
  edelweiss_jager: {
    id: 'edelweiss_jager', name: 'Edelweiss Jäger', era: 4, class: 'melee', cost: 105, strength: 46, moves: 2, vision: 3,
    tech: 'rifling', upgradesTo: 'infantry', abilities: ['ignoreTerrain'],
    uniqueTo: 'austria', replaces: 'rifleman', model: 'u_rifleman', icon: 'melee',
    description: 'Mountain troops who consider a vertical ridge a mild inconvenience. Replaces the Hardsuit Marine with a sharper edge and a pass for rough ground.',
  },
  viking_raider: {
    id: 'viking_raider', name: 'Viking Raider', era: 0, class: 'melee', cost: 22, strength: 9, moves: 3, vision: 2,
    tech: null, upgradesTo: 'swordsman', bonusVs: { city: 25 },
    uniqueTo: 'denmark', replaces: 'warrior', model: 'u_warrior', icon: 'melee',
    description: 'Arrives fast, shouts a lot and leaves with the pantry. Replaces the Militia with extra reach and a taste for colony storerooms.',
  },
};

export const UNIQUE_BUILDINGS_WESTEUROPE: Record<string, BuildingDef> = {
  mittelstand_works: {
    id: 'mittelstand_works', name: 'Mittelstand Works', era: 4, cost: 240, tech: 'industrialization', yields: { prod: 4 }, pct: { prod: 30 }, maintenance: 3,
    uniqueTo: 'germany', replaces: 'factory', requires: 'workshop', model: 'bld_factory', pillar: 'glory', icon: 'factory',
    description: 'Replaces the Foundry: +4 {prod} and +30% {prod}. A family firm with 140 years of tradition and one very specific opinion about your tolerances.',
  },
  royal_dockyard: {
    id: 'royal_dockyard', name: 'Royal Dockyard', era: 2, cost: 105, tech: 'cartography', yields: { gold: 2, food: 2 }, pct: { gold: 15 }, maintenance: 2,
    coastal: true, uniqueTo: 'uk', replaces: 'harbor', model: 'bld_harbor', pillar: 'commerce', icon: 'harbor',
    description: 'Replaces the Skiff Dock: +2 {gold}, +2 {food} and +15% {gold}. Coastal. Every hull launched here is christened, then inspected, then apologized to.',
  },
  grand_galleria: {
    id: 'grand_galleria', name: 'Grand Galleria', era: 3, cost: 180, tech: 'architecture', yields: { cul: 6 }, happiness: 2, influence: 1, maintenance: 3,
    uniqueTo: 'italy', replaces: 'museum', requires: 'amphitheater', pillar: 'arts', icon: 'museum',
    description: 'Replaces the Holo-Archive: +6 {cul}, +2 {happy} and +1 {influence} per chapter. Requires a Holo-Theater. The scaffolding is a permanent installation, and an exhibit.',
  },
  plaza_mayor: {
    id: 'plaza_mayor', name: 'Plaza Mayor', era: 0, cost: 40, tech: null, yields: { cul: 2, gold: 2 }, happiness: 1, maintenance: 0,
    uniqueTo: 'spain', replaces: 'monument', pillar: 'arts', icon: 'monument',
    description: 'Replaces the Crew Memorial: +2 {cul}, +2 {gold}, +1 {happy}. Everyone meets here after sundown, and under the dome it is always sundown somewhere.',
  },
  polder_pump: {
    id: 'polder_pump', name: 'Polder Pump', era: 2, cost: 105, tech: 'engineering', yields: { food: 3, prod: 1 }, perPop: { food: 0.25 }, maintenance: 1,
    uniqueTo: 'netherlands', replaces: 'aqueduct', model: 'bld_aqueduct', pillar: 'prosperity', icon: 'aqueduct',
    description: 'Replaces the Water Reclaimer: +3 {food}, +1 {prod} and +1 {food} per 4 citizens. It pumps out the Dust Sea slightly faster than the Dust Sea comes back.',
  },
  chocolaterie: {
    id: 'chocolaterie', name: 'Chocolaterie', era: 1, cost: 80, tech: 'currency', yields: { gold: 2, cul: 1 }, pct: { gold: 20 }, happiness: 2, maintenance: 1,
    uniqueTo: 'belgium', replaces: 'market', model: 'bld_market', pillar: 'commerce', icon: 'market',
    description: 'Replaces the Exchange: +2 {gold}, +1 {cul}, +2 {happy} and +20% {gold}. The most dangerous building in the colony is the one that smells this good.',
  },
  last_orders_pub: {
    id: 'last_orders_pub', name: 'Last Orders Pub', era: 0, cost: 40, tech: null, yields: { cul: 2, gold: 1 }, happiness: 2, maintenance: 1,
    uniqueTo: 'ireland', replaces: 'shrine', pillar: 'arts', icon: 'shrine',
    description: 'Replaces the Earth Shrine: +2 {cul}, +1 {gold}, +2 {happy}. Last orders have been called since landfall. Nobody has noticed.',
  },
  sagres_beacon: {
    id: 'sagres_beacon', name: 'Sagres Beacon', era: 0, cost: 45, tech: 'sailing', yields: { gold: 1, sci: 2 }, pct: { sci: 10 }, maintenance: 1,
    coastal: true, uniqueTo: 'portugal', replaces: 'lighthouse', model: 'bld_lighthouse', pillar: 'discovery', icon: 'lighthouse',
    description: 'Replaces the Beacon Tower: +1 {gold}, +2 {sci} and +10% {sci}. Coastal. A navigation school with a lamp on top; the exams are harder than the voyage.',
  },
  kaffeehaus: {
    id: 'kaffeehaus', name: 'Kaffeehaus', era: 1, cost: 70, tech: 'writing', yields: { sci: 2, cul: 2 }, perPop: { sci: 0.25 }, maintenance: 1,
    uniqueTo: 'austria', replaces: 'library', model: 'bld_library', pillar: 'discovery', icon: 'library',
    description: 'Replaces the Data Archive: +2 {sci}, +2 {cul}, +1 {sci} per 4 citizens. One coffee, six hours of table, and an astonishing number of dissertations.',
  },
  hygge_lounge: {
    id: 'hygge_lounge', name: 'Hygge Lounge', era: 1, cost: 65, tech: 'calendar', yields: { cul: 2, food: 1 }, happiness: 3, maintenance: 1,
    uniqueTo: 'denmark', replaces: 'temple', requires: 'shrine', model: 'bld_temple', pillar: 'arts', icon: 'temple',
    description: 'Replaces the Memorial Chapel: +2 {cul}, +1 {food}, +3 {happy}. Requires an Earth Shrine. Candles, blankets, and a strict policy of not mentioning the dust.',
  },
};
