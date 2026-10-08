// OWNER: Nations. Unique units & buildings for Canada, Mexico, Argentina, Colombia, Chile, Australia, South Africa,
// Egypt, Iran and Pakistan (spread into UNITS/BUILDINGS by ContentCiv). Literal defs only: units.ts/buildings.ts
// import this module at evaluation time, so nothing here may read UNITS/BUILDINGS while the module evaluates.
// Unique units reuse the replaced unit's model, class, era, tech and upgrade; unique buildings keep the base tech/model.
import type { BuildingDef, UnitDef } from '../../sim/defs';

/** mounted/armor unit ids (base + the mounted uniques of this slice) for the Estancia's Rover Bay discount */
const ROVER_IDS: Record<string, true> = {
  horseman: true, chariot: true, knight: true, lancer: true, cavalry: true, tank: true,
  mountie_sled: true, chiva_rover: true, gaucho_hoverbike: true,
};

export const UNIQUE_UNITS_AMERICAS: Record<string, UnitDef> = {
  mountie_sled: {
    id: 'mountie_sled', name: 'Mountie Sled Rover', era: 0, class: 'mounted', cost: 30, strength: 13, moves: 4, vision: 3,
    tech: 'animal_husbandry', upgradesTo: 'knight', abilities: ['moveAfterAttack'],
    uniqueTo: 'canada', replaces: 'horseman', model: 'u_horseman', icon: 'mounted',
    description: 'A rescue sled with a heated cab. Replaces the Dune Buggy with more vision. Needs no Methane.',
  },
  luchador_trooper: {
    id: 'luchador_trooper', name: 'Wrestler Trooper', era: 1, class: 'melee', cost: 38, strength: 16, moves: 2, vision: 2,
    tech: 'iron_working', upgradesTo: 'man_at_arms', bonusVs: { melee: 20 },
    uniqueTo: 'mexico', replaces: 'swordsman', model: 'u_swordsman', icon: 'melee',
    description: 'A masked wrestler in a tough suit. Replaces the Security Trooper with +20% strength against melee units. Needs no Nickel-Iron.',
  },
  gaucho_hoverbike: {
    id: 'gaucho_hoverbike', name: 'Gaucho Hover Bike', era: 2, class: 'mounted', cost: 62, strength: 23, moves: 5, vision: 3,
    tech: 'chivalry', upgradesTo: 'cavalry', bonusVs: { ranged: 25 }, abilities: ['moveAfterAttack'],
    uniqueTo: 'argentina', replaces: 'knight', model: 'u_knight', icon: 'mounted',
    description: 'A fast hover bike with a bola launcher. Replaces the Hover Bike with +25% strength against ranged units. Needs no Methane.',
  },
  chiva_rover: {
    id: 'chiva_rover', name: 'Chiva Rover', era: 1, class: 'mounted', cost: 40, strength: 15, moves: 4, vision: 3,
    tech: 'the_wheel', upgradesTo: 'knight', abilities: ['ignoreTerrain', 'moveAfterAttack'],
    uniqueTo: 'colombia', replaces: 'chariot', model: 'u_chariot', icon: 'mounted',
    description: 'A six-wheel rover painted in bright colors, with twenty passengers and one goat. Replaces the Assault Rover. Ignores terrain costs and needs no Methane.',
  },
  andean_sentinel: {
    id: 'andean_sentinel', name: 'Andean Guard', era: 2, class: 'ranged', cost: 55, strength: 13, rangedStrength: 19, range: 2, moves: 2, vision: 3,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    uniqueTo: 'chile', replaces: 'crossbowman', model: 'u_crossbowman', icon: 'ranged',
    description: 'A mountain sharpshooter trained under the clearest sky on the planet. Replaces the Coil Gunner with more vision and a stronger shot.',
  },
  boomerang_mortar: {
    id: 'boomerang_mortar', name: 'Boomerang Mortar', era: 1, class: 'siege', cost: 42, strength: 8, rangedStrength: 18, range: 2, moves: 2, vision: 3,
    tech: 'mathematics', upgradesTo: 'trebuchet', abilities: ['noMelee'],
    uniqueTo: 'australia', replaces: 'catapult', model: 'u_catapult', icon: 'siege',
    description: 'A mortar team whose shot comes back if it misses. Replaces the Mortar Team with a steadier shot and a wider view.',
  },
  springbok_scrum: {
    id: 'springbok_scrum', name: 'Springbok Team', era: 2, class: 'melee', cost: 62, strength: 25, moves: 3, vision: 2,
    tech: 'steel', upgradesTo: 'musketman',
    uniqueTo: 'south_africa', replaces: 'man_at_arms', model: 'u_man_at_arms', icon: 'melee',
    description: 'Eight players in exo-armor who move as one. Replaces the Exo-Trooper with more strength and speed. Needs no Nickel-Iron.',
  },
  medjay_sentry: {
    id: 'medjay_sentry', name: 'Medjay Guard', era: 0, class: 'antiCavalry', cost: 27, strength: 13, moves: 2, vision: 3,
    tech: 'bronze_working', upgradesTo: 'pikeman', bonusVs: { mounted: 75 },
    uniqueTo: 'egypt', replaces: 'spearman', model: 'u_spearman', icon: 'antiCavalry',
    description: 'A guard on a watch post above the old delta. Replaces the Shield Guard with more vision and +75% strength against mounted units.',
  },
  immortal_guard: {
    id: 'immortal_guard', name: 'Immortal Guard', era: 0, class: 'melee', cost: 28, strength: 13, moves: 2, vision: 2,
    tech: null, upgradesTo: 'swordsman', bonusVs: { melee: 15 },
    uniqueTo: 'iran', replaces: 'warrior', model: 'u_warrior', icon: 'melee',
    description: 'A guard whose number never drops: when one leaves, another steps in. Replaces the Militia with +15% strength against melee units.',
  },
  karakoram_marksman: {
    id: 'karakoram_marksman', name: 'Karakoram Sniper', era: 0, class: 'ranged', cost: 30, strength: 6, rangedStrength: 10, range: 2, moves: 2, vision: 3,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee', 'ignoreTerrain'],
    uniqueTo: 'pakistan', replaces: 'archer', model: 'u_archer', icon: 'ranged',
    description: 'A mountain sniper who climbs a ridge before breakfast. Replaces the Slug Thrower with more vision. Ignores terrain costs.',
  },
};

export const UNIQUE_BUILDINGS_AMERICAS: Record<string, BuildingDef> = {
  universal_med_bay: {
    id: 'universal_med_bay', name: 'Universal Med Bay', era: 4, cost: 230, tech: 'electricity', yields: { food: 3, cul: 1 }, happiness: 3, maintenance: 3,
    requires: 'aqueduct', uniqueTo: 'canada', replaces: 'hospital', pillar: 'prosperity', icon: 'hospital',
    effects: {
      growthThreshold(ctx, a) {
        if (a.city.id === ctx.cityId) a.value = Math.round(a.value * 0.8);
      },
    },
    description: 'Replaces the Med Bay: +3 {food}, +1 {cul}, +3 {happy}. This Colony needs 20% less {food} to grow. Treatment is free at the airlock.',
  },
  sun_stone_chapel: {
    id: 'sun_stone_chapel', name: 'Sun Stone Chapel', era: 1, cost: 70, tech: 'calendar', yields: { cul: 3 }, happiness: 2, maintenance: 2,
    requires: 'shrine', uniqueTo: 'mexico', replaces: 'temple', model: 'bld_temple', pillar: 'arts', icon: 'temple',
    effects: {
      cityYield(ctx, a) {
        if (a.city.id === ctx.cityId) a.pct.cul += 10;
      },
    },
    description: 'Replaces the Memorial Chapel: +3 {cul}, +2 {happy}, +10% {cul}. A carved sun calendar and a table set for those we lost.',
  },
  estancia: {
    id: 'estancia', name: 'Ranch', era: 2, cost: 90, tech: 'chivalry', yields: { food: 2, gold: 2 }, maintenance: 1,
    uniqueTo: 'argentina', replaces: 'stable', pillar: 'prosperity', icon: 'stable',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.improvement === 'pasture') a.yields.gold += 1;
      },
      cost(ctx, a) {
        if (a.currency !== 'prod' || a.item.kind !== 'unit' || a.city?.id !== ctx.cityId) return;
        if (ROVER_IDS[a.item.id]) a.cost = Math.round(a.cost * 0.75);
      },
    },
    description: 'Replaces the Rover Bay: +2 {food}, +2 {gold}. Bio Tanks this Colony works yield +1 {gold}. Mounted and armor units cost 25% less {prod} here. The grill is always on.',
  },
  cafeteria_exchange: {
    id: 'cafeteria_exchange', name: 'Coffee Exchange', era: 1, cost: 75, tech: 'currency', yields: { gold: 2, sci: 2 }, pct: { gold: 20 }, happiness: 1, maintenance: 0,
    uniqueTo: 'colombia', replaces: 'market', model: 'bld_market', pillar: 'commerce', icon: 'market',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.resource === 'sugar') a.yields.gold += 2;
      },
    },
    description: 'Replaces the Exchange: +2 {gold}, +2 {sci}, +20% {gold}, +1 {happy}. Coffee Clones this Colony works yield +2 {gold}. Every deal starts with a cup of coffee.',
  },
  atacama_array: {
    id: 'atacama_array', name: 'Atacama Telescope', era: 3, cost: 170, tech: 'astronomy', yields: { sci: 4 }, pct: { sci: 25 }, maintenance: 2,
    uniqueTo: 'chile', replaces: 'observatory', model: 'bld_observatory', pillar: 'discovery', icon: 'observatory',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && (a.tile.terrain === 'desert' || a.tile.elevation === 'hills')) a.yields.sci += 1;
      },
    },
    description: 'Replaces the Deep Space Array: +4 {sci}, +25% {sci}. Dunes and Hills this Colony works yield +1 {sci}. The sky is so clear that it is almost unfair.',
  },
  shell_harbour: {
    id: 'shell_harbour', name: 'Shell Dock', era: 2, cost: 110, tech: 'cartography', yields: { gold: 2, cul: 1 }, maintenance: 2,
    coastal: true, uniqueTo: 'australia', replaces: 'harbor', model: 'bld_harbor', pillar: 'prosperity', icon: 'harbor',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id !== ctx.cityId) return;
        const t = a.tile;
        if (t.terrain !== 'ocean' && t.terrain !== 'coast' && t.terrain !== 'lake') return;
        a.yields.food += 1;
        if (t.resource === 'fish' || t.resource === 'whales' || t.resource === 'pearls') a.yields.prod += 1;
      },
    },
    description: 'Replaces the Skiff Dock: +2 {gold}, +1 {cul}. Coastal. Water tiles this Colony works yield +1 {food}. Dust Silt, Orbital Debris and Iron Blueberries also yield +1 {prod}.',
  },
  reef_foundry: {
    id: 'reef_foundry', name: 'Reef Forge', era: 1, cost: 75, tech: 'iron_working', yields: { prod: 2, gold: 2 }, maintenance: 1,
    uniqueTo: 'south_africa', replaces: 'forge', pillar: 'glory', icon: 'forge',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.improvement === 'mine') a.yields.gold += 1;
      },
    },
    description: 'Replaces the Metal Foundry: +2 {prod}, +2 {gold}. Ground Mines this Colony works yield +1 {gold}. The ore goes down deep, and the credits come up deeper.',
  },
  house_of_life: {
    id: 'house_of_life', name: 'House of Life', era: 1, cost: 70, tech: 'writing', yields: { sci: 3, cul: 1 }, perPop: { sci: 0.25 }, maintenance: 1,
    uniqueTo: 'egypt', replaces: 'library', model: 'bld_library', pillar: 'discovery', icon: 'library',
    description: 'Replaces the Data Archive: +3 {sci}, +1 {cul}, +0.25 {sci} per colonist. Writers copy everything twice and carve the backups in stone.',
  },
  qanat_reclaimer: {
    id: 'qanat_reclaimer', name: 'Tunnel Recycler', era: 2, cost: 110, tech: 'engineering', yields: { food: 3 }, happiness: 1, maintenance: 1,
    uniqueTo: 'iran', replaces: 'aqueduct', model: 'bld_aqueduct', pillar: 'prosperity', icon: 'aqueduct',
    effects: {
      growthThreshold(ctx, a) {
        if (a.city.id === ctx.cityId) a.value = Math.round(a.value * 0.75);
      },
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.terrain === 'desert') a.yields.food += 1;
      },
    },
    description: 'Replaces the Water Recycler: +3 {food}, +1 {happy}. This Colony needs 25% less {food} to grow. Dunes it works yield +1 {food}. The water flows underground, calm and quiet.',
  },
  karakoram_ramparts: {
    id: 'karakoram_ramparts', name: 'Karakoram Walls', era: 0, cost: 50, tech: 'bronze_working', yields: {}, cityHp: 100, cityStrength: 10, maintenance: 1,
    uniqueTo: 'pakistan', replaces: 'walls', pillar: 'conquest', icon: 'walls',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.elevation === 'hills') a.yields.prod += 1;
      },
    },
    description: 'Replaces Blast Walls: +100 Colony HP, +10 Colony strength. Hills this Colony works yield +1 {prod}. Built into the mountain and painted with flowers.',
  },
};
