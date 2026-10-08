// OWNER: Nations (northeast slice). Leader-unique units & buildings for Sweden, Norway, Finland, Poland,
// Czechia, Romania, Türkiye, Israel and Kazakhstan (spread into UNITS/BUILDINGS by the content barrel).
// Literal defs only: units.ts/buildings.ts import this module at evaluation time, so nothing here may
// read UNITS/BUILDINGS (or import anything but types). Unique units reuse the replaced unit's model.
import type { BuildingDef, UnitDef } from '../../sim/defs';

export const UNIQUE_UNITS_NORTHEAST: Record<string, UnitDef> = {
  carolean_marcher: {
    id: 'carolean_marcher', name: 'Carolean Marcher', era: 3, class: 'melee', cost: 76, strength: 32, moves: 2, vision: 2,
    tech: 'gunpowder', upgradesTo: 'rifleman', bonusVs: { ranged: 30 },
    uniqueTo: 'sweden', replaces: 'musketman', model: 'u_musketman', icon: 'melee',
    description: 'Replaces Power Armor. +30% against ranged units. No special resource needed.',
  },
  ski_patrol: {
    id: 'ski_patrol', name: 'Ski Patrol', era: 2, class: 'ranged', cost: 55, strength: 14, rangedStrength: 19, range: 2, moves: 3, vision: 3,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    uniqueTo: 'norway', replaces: 'crossbowman', model: 'u_crossbowman', icon: 'ranged',
    description: 'Replaces the Coil Gunner. Ranged attack with range 2. More moves and sight.',
  },
  sisu_sharpshooter: {
    id: 'sisu_sharpshooter', name: 'Sisu Sharpshooter', era: 0, class: 'ranged', cost: 28, strength: 7, rangedStrength: 10, range: 2, moves: 2, vision: 3,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee'],
    uniqueTo: 'finland', replaces: 'archer', model: 'u_archer', icon: 'ranged',
    description: 'Replaces the Slug Thrower. Range 2. Stronger shot, and sees farther.',
  },
  winged_hussar: {
    id: 'winged_hussar', name: 'Winged Hussar Rover', era: 3, class: 'mounted', cost: 82, strength: 35, moves: 4, vision: 2,
    tech: 'metallurgy', upgradesTo: 'cavalry', abilities: ['moveAfterAttack'], bonusVs: { ranged: 25 },
    uniqueTo: 'poland', replaces: 'lancer', model: 'u_lancer', icon: 'mounted',
    description: 'Replaces the Strike Rover. +25% against ranged units. Can move after attacking. No special resource needed.',
  },
  hussite_wagon_crew: {
    id: 'hussite_wagon_crew', name: 'Wagon-Fort Crew', era: 2, class: 'antiCavalry', cost: 48, strength: 18, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'at_gun', bonusVs: { mounted: 100 },
    uniqueTo: 'czechia', replaces: 'pikeman', model: 'u_pikeman', icon: 'antiCavalry',
    description: 'Replaces the Rocket Squad. Stronger, and +100% against mounted units.',
  },
  haiduk_raider: {
    id: 'haiduk_raider', name: 'Haiduk Fighter', era: 2, class: 'melee', cost: 58, strength: 22, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'musketman', abilities: ['ignoreTerrain'],
    uniqueTo: 'romania', replaces: 'man_at_arms', model: 'u_man_at_arms', icon: 'melee',
    description: 'Replaces the Exo-Trooper. Ignores terrain costs. No special resource needed.',
  },
  janissary_bombardier: {
    id: 'janissary_bombardier', name: 'Janissary Mortar Crew', era: 2, class: 'siege', cost: 60, strength: 13, rangedStrength: 24, range: 2, moves: 2, vision: 2,
    tech: 'machinery', upgradesTo: 'cannon', abilities: ['noMelee'],
    uniqueTo: 'turkey', replaces: 'trebuchet', model: 'u_trebuchet', icon: 'siege',
    description: 'Replaces the Rail Mortar. Range 2. Stronger shot. Cannot melee.',
  },
  steppe_batyr: {
    id: 'steppe_batyr', name: 'Steppe Rider', era: 2, class: 'mounted', cost: 62, strength: 23, moves: 5, vision: 3,
    tech: 'chivalry', upgradesTo: 'cavalry', abilities: ['moveAfterAttack'],
    uniqueTo: 'kazakhstan', replaces: 'knight', model: 'u_knight', icon: 'mounted',
    description: 'Replaces the Hover Bike. One extra Move. Can move after attacking. No special resource needed.',
  },
};

export const UNIQUE_BUILDINGS_NORTHEAST: Record<string, BuildingDef> = {
  nobel_hall: {
    id: 'nobel_hall', name: 'Prize Hall', era: 3, cost: 175, tech: 'education', yields: { sci: 3, gold: 2 }, pct: { sci: 25 }, influence: 1, maintenance: 3,
    requires: 'library', uniqueTo: 'sweden', replaces: 'university', model: 'bld_university', pillar: 'discovery', icon: 'university',
    description: 'Replaces the Research Institute: +3 {sci}, +2 {gold}, +25% {sci}, +1 {influence} per chapter. Requires a Data Archive.',
  },
  fjord_pier: {
    id: 'fjord_pier', name: 'Fjord Pier', era: 0, cost: 50, tech: 'sailing', yields: { gold: 1 }, coastal: true, maintenance: 1,
    uniqueTo: 'norway', replaces: 'lighthouse', model: 'bld_lighthouse', pillar: 'commerce', icon: 'lighthouse',
    effects: {
      tileYield(ctx, a) {
        if (!a.city || a.city.id !== ctx.cityId) return;
        const t = a.tile.terrain;
        if (t === 'coast' || t === 'ocean' || t === 'lake') { a.yields.gold += 1; a.yields.food += 1; }
      },
    },
    description: 'Replaces the Beacon Tower: +1 {gold}. Coastal only. Water tiles worked by this Colony yield +1 {gold} and +1 {food}.',
  },
  sauna: {
    id: 'sauna', name: 'Sauna', era: 1, cost: 70, tech: 'calendar', yields: { cul: 2, prod: 1 }, happiness: 3, maintenance: 1,
    requires: 'shrine', uniqueTo: 'finland', replaces: 'temple', model: 'bld_temple', pillar: 'arts', icon: 'temple',
    description: 'Replaces the Memorial Chapel: +2 {cul}, +1 {prod}, +3 {happy}. Requires an Earth Shrine.',
  },
  wawel_bastion: {
    id: 'wawel_bastion', name: 'Bastion of the Hill', era: 2, cost: 115, tech: 'steel', yields: { cul: 2 }, cityHp: 120, cityStrength: 10, happiness: 1, maintenance: 2,
    requires: 'walls', uniqueTo: 'poland', replaces: 'castle', model: 'bld_castle', pillar: 'conquest', icon: 'castle',
    description: 'Replaces the Bastion Dome: +2 {cul}, +1 {happy}, +120 Colony HP, +10 Colony strength. Requires Blast Walls.',
  },
  orloj_tower: {
    id: 'orloj_tower', name: 'Orloj Tower', era: 3, cost: 165, tech: 'astronomy', yields: { sci: 2, cul: 2 }, pct: { sci: 20 }, happiness: 1, maintenance: 2,
    uniqueTo: 'czechia', replaces: 'observatory', model: 'bld_observatory', pillar: 'discovery', icon: 'observatory',
    effects: {
      tileYield(ctx, a) {
        if (a.city && a.city.id === ctx.cityId && a.tile.elevation === 'hills') a.yields.sci += 1;
      },
    },
    description: 'Replaces the Deep Space Array: +2 {sci}, +2 {cul}, +1 {happy}, +20% {sci}. Hills worked by this Colony yield +1 {sci}.',
  },
  bran_keep: {
    id: 'bran_keep', name: 'Bran Keep', era: 0, cost: 45, tech: 'bronze_working', yields: { cul: 1 }, cityHp: 100, cityStrength: 9, maintenance: 1,
    uniqueTo: 'romania', replaces: 'walls', pillar: 'conquest', icon: 'walls',
    description: 'Replaces Blast Walls: +1 {cul}, +100 Colony HP, +9 Colony strength.',
  },
  covered_bazaar: {
    id: 'covered_bazaar', name: 'Covered Bazaar', era: 1, cost: 70, tech: 'currency', yields: { gold: 3, cul: 1 }, pct: { gold: 20 }, maintenance: 0,
    uniqueTo: 'turkey', replaces: 'market', model: 'bld_market', pillar: 'commerce', icon: 'market',
    description: 'Replaces the Exchange: +3 {gold}, +1 {cul}, +20% {gold}. No upkeep.',
  },
  cosmodrome_gantry: {
    id: 'cosmodrome_gantry', name: 'Launch Gantry', era: 1, cost: 80, tech: 'iron_working', yields: { prod: 2, sci: 1 }, maintenance: 1,
    uniqueTo: 'kazakhstan', replaces: 'forge', pillar: 'glory', icon: 'forge',
    effects: {
      tileYield(ctx, a) {
        if (a.city && a.city.id === ctx.cityId && a.tile.improvement === 'mine') a.yields.prod += 1;
      },
    },
    description: 'Replaces the Metal Foundry: +2 {prod}, +1 {sci}. Each Ground Mine worked by this Colony yields +1 {prod}.',
  },
};
