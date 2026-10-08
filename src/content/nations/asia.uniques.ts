// OWNER: Nations (Asia slice). Leader-unique units & buildings, spread into UNITS/BUILDINGS by ContentCiv.
// Literal defs only: units.ts/buildings.ts import this module at evaluation time, so nothing here may
// read UNITS/BUILDINGS (or any runtime value) while the module evaluates. Unique units reuse the replaced unit's model.
import type { BuildingDef, UnitDef } from '../../sim/defs';

export const UNIQUE_UNITS_ASIA: Record<string, UnitDef> = {
  hwacha_swarm_rack: {
    id: 'hwacha_swarm_rack', name: 'Rocket Cart', era: 1, class: 'siege', cost: 40, strength: 7, rangedStrength: 18, range: 2, moves: 2, vision: 2,
    tech: 'mathematics', upgradesTo: 'trebuchet', abilities: ['noMelee'],
    uniqueTo: 'south_korea', replaces: 'catapult', model: 'u_catapult', icon: 'siege',
    description: 'A hand cart with forty rocket tubes, all fired together. Replaces the Mortar Team with a stronger, faster volley.',
  },
  silat_skirmisher: {
    id: 'silat_skirmisher', name: 'Silat Fighter', era: 0, class: 'melee', cost: 26, strength: 11, moves: 2, vision: 2,
    tech: null, upgradesTo: 'swordsman', abilities: ['amphibious'],
    uniqueTo: 'indonesia', replaces: 'warrior', model: 'u_warrior', icon: 'melee',
    description: 'A fighter who crosses a canal like a hallway. Replaces the Militia. Attacks across rivers with no penalty.',
  },
  dromedary_courser: {
    id: 'dromedary_courser', name: 'Camel Rover', era: 3, class: 'mounted', cost: 80, strength: 31, moves: 4, vision: 3,
    tech: 'metallurgy', upgradesTo: 'cavalry', abilities: ['ignoreTerrain', 'moveAfterAttack'],
    uniqueTo: 'saudi_arabia', replaces: 'lancer', model: 'u_lancer', icon: 'mounted',
    description: 'A long-legged rover that needs almost no water and crosses Dunes with ease. Replaces the Strike Rover. Ignores terrain costs. Needs no Methane.',
  },
  typhoon_battery: {
    id: 'typhoon_battery', name: 'Typhoon Cannon', era: 3, class: 'siege', cost: 78, strength: 16, rangedStrength: 36, range: 2, moves: 2, vision: 2,
    tech: 'metallurgy', upgradesTo: 'artillery', abilities: ['noMelee'],
    uniqueTo: 'taiwan', replaces: 'cannon', model: 'u_cannon', icon: 'siege',
    description: 'A cannon on a hill, designed from a weather map and tested in a clean room. Replaces the Mass Driver with sharper aim. Needs no Toxic Salts.',
  },
  elephant_walker: {
    id: 'elephant_walker', name: 'Elephant Walker', era: 2, class: 'mounted', cost: 60, strength: 27, moves: 3, vision: 2,
    tech: 'chivalry', upgradesTo: 'cavalry', abilities: ['moveAfterAttack'],
    uniqueTo: 'thailand', replaces: 'knight', model: 'u_knight', icon: 'mounted',
    description: 'A six-legged heavy crawler with a very calm driver. Replaces the Hover Bike. Stronger. Needs no Methane.',
  },
  lion_city_sentinel: {
    id: 'lion_city_sentinel', name: 'Lion-City Guard', era: 2, class: 'ranged', cost: 55, strength: 14, rangedStrength: 21, range: 2, moves: 2, vision: 3,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    uniqueTo: 'singapore', replaces: 'crossbowman', model: 'u_crossbowman', icon: 'ranged',
    description: 'Small, well trained and always on time. Replaces the Coil Gunner with sharper aim and wider vision.',
  },
  eskrima_duelist: {
    id: 'eskrima_duelist', name: 'Stick Fighter', era: 1, class: 'melee', cost: 36, strength: 15, moves: 2, vision: 2,
    tech: 'iron_working', upgradesTo: 'man_at_arms', abilities: ['moveAfterAttack'],
    uniqueTo: 'philippines', replaces: 'swordsman', model: 'u_swordsman', icon: 'melee',
    description: 'Strikes, steps back, and is already gone. Replaces the Security Trooper. Moves after attacking. Needs no Nickel-Iron.',
  },
  tunnel_sniper: {
    id: 'tunnel_sniper', name: 'Tunnel Sniper', era: 0, class: 'ranged', cost: 28, strength: 6, rangedStrength: 9, range: 2, moves: 2, vision: 2,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee', 'noZoc'],
    uniqueTo: 'vietnam', replaces: 'archer', model: 'u_archer', icon: 'ranged',
    description: 'A marksman who was on this tile before you arrived. Replaces the Slug Thrower with better aim. Slips past enemy lines.',
  },
  lathial_guard: {
    id: 'lathial_guard', name: 'Pole Guard', era: 2, class: 'antiCavalry', cost: 44, strength: 18, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'at_gun', bonusVs: { mounted: 100 }, abilities: ['amphibious'],
    uniqueTo: 'bangladesh', replaces: 'pikeman', model: 'u_pikeman', icon: 'antiCavalry',
    description: 'A delta guard with a strong pole and a firm hold on the river wall. Replaces the Rocket Squad with a cheaper, tougher line. No river penalty.',
  },
  keris_vanguard: {
    id: 'keris_vanguard', name: 'Blade Trooper', era: 3, class: 'melee', cost: 74, strength: 31, moves: 2, vision: 2,
    tech: 'gunpowder', upgradesTo: 'rifleman', abilities: ['ignoreTerrain'],
    uniqueTo: 'malaysia', replaces: 'musketman', model: 'u_musketman', icon: 'melee',
    description: 'Power armor with a curved blade on the arm and an eye for jungle paths. Replaces Power Armor. Ignores terrain costs. Needs no Toxic Salts.',
  },
};

export const UNIQUE_BUILDINGS_ASIA: Record<string, BuildingDef> = {
  hallyu_hub: {
    id: 'hallyu_hub', name: 'Hallyu Broadcast Hub', era: 5, cost: 320, tech: 'radio', yields: { cul: 5, gold: 2 }, pct: { cul: 33 }, influence: 1, happiness: 1, maintenance: 4,
    uniqueTo: 'south_korea', replaces: 'broadcast_tower', requires: 'museum', pillar: 'arts', icon: 'broadcast_tower',
    description: 'Replaces the Broadcast Tower: +5 {cul}, +2 {gold}, +33% {cul}, +1 {happy}, +1 {influence} every chapter. Seventeen studios share one air recycler.',
  },
  pinisi_harbor: {
    id: 'pinisi_harbor', name: 'Sail Harbor', era: 2, cost: 110, tech: 'cartography', yields: { gold: 2 }, maintenance: 2, coastal: true,
    uniqueTo: 'indonesia', replaces: 'harbor', model: 'bld_harbor', pillar: 'prosperity', icon: 'harbor',
    effects: {
      tileYield(ctx, a) {
        if (!a.city || a.city.id !== ctx.cityId) return;
        if (a.tile.terrain !== 'coast' && a.tile.terrain !== 'ocean' && a.tile.terrain !== 'lake') return;
        a.yields.food += 1;
        a.yields.gold += 1;
      },
    },
    description: 'Replaces the Skiff Dock: +2 {gold}. Water tiles this Colony works yield **+1** {food} and **+1** {gold}. Every boat is a family business.',
  },
  deuterium_refinery: {
    id: 'deuterium_refinery', name: 'Heavy Ice Plant', era: 1, cost: 80, tech: 'iron_working', yields: { prod: 2, gold: 2 }, maintenance: 1,
    uniqueTo: 'saudi_arabia', replaces: 'forge', pillar: 'glory', icon: 'forge',
    effects: {
      tileYield(ctx, a) {
        if (!a.city || a.city.id !== ctx.cityId) return;
        if (a.tile.resource === 'oil') a.yields.prod += 2;
        if (a.tile.improvement === 'mine') a.yields.prod += 1;
      },
    },
    description: 'Replaces the Metal Foundry: +2 {prod}, +2 {gold}. Heavy Ice tiles this Colony works yield **+2** {prod}. Ground Mines yield +1 {prod}. The flame is visible from orbit.',
  },
  semiconductor_fab: {
    id: 'semiconductor_fab', name: 'Chip Factory', era: 4, cost: 260, tech: 'industrialization', yields: { prod: 3, sci: 2 }, pct: { prod: 25 }, maintenance: 3,
    uniqueTo: 'taiwan', replaces: 'factory', requires: 'workshop', model: 'bld_factory', pillar: 'discovery', icon: 'factory',
    effects: {
      tileYield(ctx, a) {
        if (!a.city || a.city.id !== ctx.cityId) return;
        if (a.tile.resource === 'coal' || a.tile.resource === 'iron') a.yields.prod += 1;
      },
    },
    description: 'Replaces the Factory: +3 {prod}, +2 {sci}, +25% {prod}. Needs a Workshop. Thorium and Nickel-Iron tiles yield +1 {prod}. The clean room is cleaner than the rest of the Ark.',
  },
  spirit_house_garden: {
    id: 'spirit_house_garden', name: 'Spirit House Garden', era: 1, cost: 70, tech: 'calendar', yields: { cul: 3, gold: 1 }, happiness: 3, maintenance: 2,
    uniqueTo: 'thailand', replaces: 'temple', requires: 'shrine', model: 'bld_temple', pillar: 'arts', icon: 'temple',
    description: 'Replaces the Memorial Chapel: +3 {cul}, +1 {gold}, +3 {happy}. Needs an Earth Shrine. Jasmine grows in the water farm, and a tiny gift sits by the airlock.',
  },
  free_port_exchange: {
    id: 'free_port_exchange', name: 'Free Port Exchange', era: 4, cost: 240, tech: 'economics', yields: { gold: 5 }, pct: { gold: 33 }, influence: 1, maintenance: 0,
    uniqueTo: 'singapore', replaces: 'stock_exchange', requires: 'bank', pillar: 'commerce', icon: 'stock_exchange',
    description: 'Replaces the Stock Exchange: +5 {gold}, +33% {gold}, +1 {influence} every chapter. Needs a Credit Vault. Open day and night, and fines are instant.',
  },
  nurse_corps_clinic: {
    id: 'nurse_corps_clinic', name: 'Nurse Clinic', era: 4, cost: 240, tech: 'electricity', yields: { food: 3, gold: 2 }, happiness: 3, maintenance: 2,
    uniqueTo: 'philippines', replaces: 'hospital', requires: 'aqueduct', pillar: 'prosperity', icon: 'hospital',
    effects: {
      growthThreshold(ctx, a) { if (a.city.id === ctx.cityId) a.value = Math.round(a.value * 0.85); },
    },
    description: 'Replaces the Med Bay: +3 {food}, +2 {gold}, +3 {happy}. This Colony needs 15% less {food} to grow. Needs a Water Recycler. Every nurse has a second job and a cousin who sends credits.',
  },
  tunnel_network: {
    id: 'tunnel_network', name: 'Tunnel Network', era: 0, cost: 45, tech: 'bronze_working', yields: { prod: 1 }, cityHp: 100, cityStrength: 8, maintenance: 1,
    uniqueTo: 'vietnam', replaces: 'walls', pillar: 'conquest', icon: 'walls',
    description: 'Replaces Blast Walls: +1 {prod}, +100 Colony HP, +8 Colony strength. The tunnels were here before the enemy. Maybe before the Ark.',
  },
  embankment_works: {
    id: 'embankment_works', name: 'Flood Wall', era: 2, cost: 110, tech: 'engineering', yields: { food: 3 }, happiness: 1, cityHp: 40, maintenance: 1,
    uniqueTo: 'bangladesh', replaces: 'aqueduct', model: 'bld_aqueduct', pillar: 'prosperity', icon: 'aqueduct',
    effects: {
      growthThreshold(ctx, a) { if (a.city.id === ctx.cityId) a.value = Math.round(a.value * 0.75); },
    },
    description: 'Replaces the Water Recycler: +3 {food}, +1 {happy}, +40 Colony HP. This Colony needs 25% less {food} to grow. A flood wall, a pump and a serious talk with the flood.',
  },
  canopy_institute: {
    id: 'canopy_institute', name: 'Jungle Institute', era: 3, cost: 180, tech: 'education', yields: { sci: 3 }, pct: { sci: 25 }, happiness: 1, maintenance: 3,
    uniqueTo: 'malaysia', replaces: 'university', requires: 'library', model: 'bld_university', pillar: 'discovery', icon: 'university',
    effects: {
      tileYield(ctx, a) {
        if (!a.city || a.city.id !== ctx.cityId || a.tile.feature !== 'jungle') return;
        a.yields.sci += 1;
        a.yields.food += 1;
      },
    },
    description: 'Replaces the Research Institute: +3 {sci}, +25% {sci}, +1 {happy}. Needs a Data Archive. Lava Tubes this Colony works yield +1 {sci} and +1 {food}. Lectures run in four languages, with a break.',
  },
};
