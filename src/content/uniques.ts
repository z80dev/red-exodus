// OWNER: Nations. Leader-unique units & buildings (spread into UNITS/BUILDINGS by ContentCiv).
// Literal defs only: units.ts/buildings.ts import this module at evaluation time, so nothing here may
// read UNITS/BUILDINGS while the module evaluates. Unique units reuse the replaced unit's model.
import type { BuildingDef, UnitDef } from '../sim/defs';
import { UNIQUE_BUILDINGS_AMERICAS, UNIQUE_UNITS_AMERICAS } from './nations/americas.uniques';
import { UNIQUE_BUILDINGS_ASIA, UNIQUE_UNITS_ASIA } from './nations/asia.uniques';
import { UNIQUE_BUILDINGS_NORTHEAST, UNIQUE_UNITS_NORTHEAST } from './nations/northeast.uniques';
import { UNIQUE_BUILDINGS_WESTEUROPE, UNIQUE_UNITS_WESTEUROPE } from './nations/westeurope.uniques';

export const UNIQUE_UNITS: Record<string, UnitDef> = {
  marine_raider: {
    id: 'marine_raider', name: 'Marine Raider', era: 1, class: 'melee', cost: 38, strength: 16, moves: 2, vision: 2,
    tech: 'iron_working', upgradesTo: 'man_at_arms', bonusVs: { city: 20 },
    uniqueTo: 'usa', replaces: 'swordsman', model: 'u_swordsman', icon: 'melee',
    description: 'A salt-stained orbital insertion veteran. Replaces the Security Trooper with a harder-hitting raider built to breach hostile habs.',
  },
  jade_rabbit_crawler: {
    id: 'jade_rabbit_crawler', name: 'Jade Rabbit Crawler', era: 0, class: 'mounted', cost: 30, strength: 12, moves: 4, vision: 3,
    tech: 'animal_husbandry', upgradesTo: 'knight', abilities: ['ignoreTerrain'],
    uniqueTo: 'china', replaces: 'horseman', model: 'u_horseman', icon: 'mounted',
    description: 'A lunar-tested scout chassis that refuses to respect rough terrain. Replaces the Dune Buggy; no methane requirement.',
  },
  frostguard_spetsnaz: {
    id: 'frostguard_spetsnaz', name: 'Frostguard Spetsnaz', era: 0, class: 'melee', cost: 30, strength: 13, moves: 2, vision: 2,
    tech: null, upgradesTo: 'swordsman', bonusVs: { ranged: 25 },
    uniqueTo: 'russia', replaces: 'warrior', model: 'u_warrior', icon: 'melee',
    description: 'Polar-trained survivors in insulated combat shells. Replaces the Militia with a brutal counter to exposed rifle teams.',
  },
  pragyan_rover: {
    id: 'pragyan_rover', name: 'Pragyan Rover', era: 0, class: 'recon', cost: 24, strength: 7, moves: 4, vision: 4,
    tech: null, abilities: ['ignoreTerrain'],
    uniqueTo: 'india', replaces: 'scout', model: 'u_scout', icon: 'recon',
    description: 'A repurposed lunar-probe platform with an antenna held on by optimism. Replaces the Scout Rover with extra reach and rugged wheels.',
  },
  mecha_frame: {
    id: 'mecha_frame', name: 'Mecha Frame', era: 3, class: 'melee', cost: 78, strength: 31, moves: 3, vision: 3,
    tech: 'gunpowder', upgradesTo: 'rifleman', bonusVs: { city: 15 },
    uniqueTo: 'japan', replaces: 'musketman', model: 'u_musketman', icon: 'melee',
    description: 'A precision-built powered exoskeleton. Replaces Power Armor with a faster frame that hits cities like a delayed maintenance invoice.',
  },
  legion_etrangere: {
    id: 'legion_etrangere', name: 'Légion Étrangère', era: 2, class: 'melee', cost: 58, strength: 24, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'musketman', bonusVs: { city: 15 },
    uniqueTo: 'france', replaces: 'man_at_arms', model: 'u_man_at_arms', icon: 'melee',
    description: 'The last foreign legion, now defending a planet none of them were born on. Replaces Exo-Troopers with a disciplined siege specialist.',
  },
  jaguar_rover: {
    id: 'jaguar_rover', name: 'Jaguar Rover', era: 1, class: 'mounted', cost: 38, strength: 15, moves: 5, vision: 3,
    tech: 'the_wheel', resource: 'horses', upgradesTo: 'knight', abilities: ['moveAfterAttack'],
    uniqueTo: 'brazil', replaces: 'chariot', model: 'u_chariot', icon: 'mounted',
    description: 'A biofuel rover named for the animal that did not make the manifest. Replaces the Assault Rover with extra vision and hit-and-run mobility.',
  },
  falcon_drone: {
    id: 'falcon_drone', name: 'Falcon Drone', era: 0, class: 'ranged', cost: 42, strength: 8, rangedStrength: 13, range: 2, moves: 3, vision: 3,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee', 'ignoreTerrain'],
    uniqueTo: 'uae', replaces: 'archer', model: 'u_archer', icon: 'ranged',
    description: 'A solar-winged reconnaissance drone retrofitted with a very persuasive payload. Replaces the Slug Thrower with extra mobility and a range-2 strike.',
  },
  okada_rider: {
    id: 'okada_rider', name: 'Okada Rider', era: 0, class: 'mounted', cost: 28, strength: 11, moves: 5, vision: 3,
    tech: 'animal_husbandry', upgradesTo: 'knight', abilities: ['moveAfterAttack'],
    uniqueTo: 'nigeria', replaces: 'horseman', model: 'u_horseman', icon: 'mounted',
    description: 'A nimble two-seat regolith bike: one rider, one radio, and no patience for traffic. Replaces the Dune Buggy with a cheaper, faster raider.',
  },
  alpine_guard: {
    id: 'alpine_guard', name: 'Alpine Guard', era: 0, class: 'antiCavalry', cost: 28, strength: 14, moves: 2, vision: 2,
    tech: 'bronze_working', upgradesTo: 'pikeman', bonusVs: { mounted: 50 },
    uniqueTo: 'switzerland', replaces: 'spearman', model: 'u_spearman', icon: 'antiCavalry',
    description: 'A compact bunker defender trained to stop anything with an engine. Replaces the Breacher with a stronger anti-vehicle line-holder.',
  },
  songun_trooper: {
    id: 'songun_trooper', name: 'Songun Trooper', era: 1, class: 'melee', cost: 34, strength: 17, moves: 2, vision: 2,
    tech: 'iron_working', upgradesTo: 'man_at_arms', bonusVs: { city: 10 },
    uniqueTo: 'north_korea', replaces: 'swordsman', model: 'u_swordsman', icon: 'melee',
    description: 'A parade-ground veteran whose armor is mostly slogans and absolutely not optional. Replaces the Security Trooper with added city pressure.',
  },
  swiss_guard: {
    id: 'swiss_guard', name: 'Swiss Guard', era: 0, class: 'antiCavalry', cost: 28, strength: 14, moves: 2, vision: 2,
    tech: 'bronze_working', upgradesTo: 'pikeman', bonusVs: { mounted: 50 },
    uniqueTo: 'vatican', replaces: 'spearman', model: 'u_spearman', icon: 'antiCavalry',
    description: 'The smallest army still taking its oath seriously. Replaces the Breacher with a stout anti-vehicle guard in unmistakable colors.',
  },
  ...UNIQUE_UNITS_WESTEUROPE,
  ...UNIQUE_UNITS_NORTHEAST,
  ...UNIQUE_UNITS_AMERICAS,
  ...UNIQUE_UNITS_ASIA,
};

export const UNIQUE_BUILDINGS: Record<string, BuildingDef> = {
  liberty_exchange: {
    id: 'liberty_exchange', name: 'Liberty Exchange', era: 1, cost: 70, tech: 'currency', yields: { gold: 4 }, maintenance: 1,
    uniqueTo: 'usa', replaces: 'market', model: 'bld_market', pillar: 'commerce', icon: 'market',
    description: 'Replaces the Exchange: +4 {gold}. Every transaction has a convenience fee, even the oxygen.',
  },
  harmony_hab_block: {
    id: 'harmony_hab_block', name: 'Harmony Hab Block', era: 0, cost: 70, tech: 'agriculture', yields: { food: 2, cul: 1 }, perPop: { food: 0.25 },
    happiness: 2, maintenance: 1, uniqueTo: 'china', replaces: 'granary', model: 'bld_granary', pillar: 'prosperity', icon: 'granary',
    description: 'Replaces the Seed Silo: +2 {food}, +1 {cul}, +0.25 {food} per colonist, and +2 {happy}. Harmony is mandatory; breakfast is negotiable.',
  },
  rbmk_reactor: {
    id: 'rbmk_reactor', name: 'RBMK Reactor', era: 2, cost: 100, tech: 'machinery', yields: { prod: 5 }, happiness: -1, maintenance: 3,
    uniqueTo: 'russia', replaces: 'workshop', model: 'bld_workshop', pillar: 'discovery', icon: 'workshop',
    description: 'Replaces the Fabricator: +5 {prod}. Extremely productive, conspicuously warm, and definitely not a ventilation concern.',
  },
  orbiter_relay: {
    id: 'orbiter_relay', name: 'Orbiter Relay', era: 1, cost: 70, tech: 'writing', yields: { sci: 4 }, maintenance: 1,
    uniqueTo: 'india', replaces: 'library', model: 'bld_library', pillar: 'discovery', icon: 'library',
    description: 'Replaces the Data Archive: +4 {sci}. A relay network assembled from spare parts and the phrase “it should work.”',
  },
  robotics_lab: {
    id: 'robotics_lab', name: 'Robotics Lab', era: 2, cost: 95, tech: 'machinery', yields: { sci: 2, prod: 2 }, maintenance: 2,
    uniqueTo: 'japan', replaces: 'workshop', model: 'bld_workshop', pillar: 'discovery', icon: 'workshop',
    description: 'Replaces the Fabricator: +2 {sci}, +2 {prod}. Every robot receives a checklist. The checklist has a checklist.',
  },
  salon: {
    id: 'salon', name: 'Salon', era: 1, cost: 85, tech: 'mathematics', yields: { cul: 4 }, happiness: 2, maintenance: 2,
    uniqueTo: 'france', replaces: 'amphitheater', model: 'bld_amphitheater', pillar: 'arts', icon: 'amphitheater',
    description: 'Replaces the Holo-Theater: +4 {cul}, +2 {happy}. The Louvre survived Earth. The gift shop did too.',
  },
  biodome: {
    id: 'biodome', name: 'Biodome', era: 0, cost: 90, tech: 'agriculture', yields: { food: 3, cul: 1 }, happiness: 2, maintenance: 2,
    uniqueTo: 'brazil', replaces: 'granary', model: 'bld_granary', pillar: 'prosperity', icon: 'granary',
    description: 'Replaces the Seed Silo: +3 {food}, +1 {cul}, +2 {happy}. A stubborn pocket of green, with a very strict humidity policy.',
  },
  sky_souk: {
    id: 'sky_souk', name: 'Sky Souk', era: 3, cost: 180, tech: 'banking', yields: { gold: 4 }, influence: 1, maintenance: 2,
    uniqueTo: 'uae', replaces: 'bank', requires: 'market', model: 'bld_bank', pillar: 'commerce', icon: 'bank',
    description: 'Replaces the Credit Vault: +4 {gold} and +1 {influence} per chapter. The market is open until the last airlock closes.',
  },
  nollywood_studio: {
    id: 'nollywood_studio', name: 'Nollywood Studio', era: 1, cost: 90, tech: 'mathematics', yields: { cul: 3, gold: 2 }, influence: 1, maintenance: 2,
    uniqueTo: 'nigeria', replaces: 'amphitheater', model: 'bld_amphitheater', pillar: 'arts', icon: 'amphitheater',
    description: 'Replaces the Holo-Theater: +3 {cul}, +2 {gold}, and +1 {influence} per chapter. The apocalypse gets a rewrite, and a bigger third act.',
  },
  bunker_bank: {
    id: 'bunker_bank', name: 'Bunker Bank', era: 3, cost: 100, tech: 'banking', yields: { gold: 3 }, cityHp: 50, cityStrength: 20, maintenance: 2,
    uniqueTo: 'switzerland', replaces: 'bank', requires: 'market', model: 'bld_bank', pillar: 'commerce', icon: 'bank',
    description: 'Replaces the Credit Vault: +3 {gold}, +50 city HP, and +20 city strength. Your money and your colonists both sleep underground.',
  },
  mass_games_arena: {
    id: 'mass_games_arena', name: 'Mass Games Arena', era: 5, cost: 310, tech: 'radio', yields: { cul: 4 }, happiness: 3, maintenance: 3,
    uniqueTo: 'north_korea', replaces: 'stadium', model: 'bld_stadium', pillar: 'arts', icon: 'stadium',
    description: 'Replaces the Arena: +4 {cul}, +3 {happy}. The synchronized routine ends when the air recycler says so.',
  },
  basilica_red_planet: {
    id: 'basilica_red_planet', name: 'Basilica of the Red Planet', era: 2, cost: 145, tech: 'theology', yields: { cul: 5, sci: 2 }, happiness: 3, maintenance: 3,
    uniqueTo: 'vatican', replaces: 'cathedral', requires: 'temple', model: 'bld_cathedral', pillar: 'glory', icon: 'cathedral',
    description: 'Replaces the Cathedral of Earth: +5 {cul}, +2 {sci}, +3 {happy}. The ceiling is a pressure dome; the heavens are still included.',
  },
  ...UNIQUE_BUILDINGS_WESTEUROPE,
  ...UNIQUE_BUILDINGS_NORTHEAST,
  ...UNIQUE_BUILDINGS_AMERICAS,
  ...UNIQUE_BUILDINGS_ASIA,
};
