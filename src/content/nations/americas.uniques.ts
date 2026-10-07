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
    description: 'A rescue sled with a heated cab and a very firm sense of procedure. Replaces the Dune Buggy with a sharper-eyed raider; no methane requirement. Always gets its rover.',
  },
  luchador_trooper: {
    id: 'luchador_trooper', name: 'Luchador Trooper', era: 1, class: 'melee', cost: 38, strength: 16, moves: 2, vision: 2,
    tech: 'iron_working', upgradesTo: 'man_at_arms', bonusVs: { melee: 20 },
    uniqueTo: 'mexico', replaces: 'swordsman', model: 'u_swordsman', icon: 'melee',
    description: 'A masked brawler in reinforced spandex who treats every fight as a rematch. Replaces the Security Trooper with a hard hitter against other close-quarters troops; no Nickel-Iron requirement.',
  },
  gaucho_hoverbike: {
    id: 'gaucho_hoverbike', name: 'Gaucho Hover Bike', era: 2, class: 'mounted', cost: 62, strength: 23, moves: 5, vision: 3,
    tech: 'chivalry', upgradesTo: 'cavalry', bonusVs: { ranged: 25, city: -15 }, abilities: ['moveAfterAttack'],
    uniqueTo: 'argentina', replaces: 'knight', model: 'u_knight', icon: 'mounted',
    description: 'A long-range hover bike with a bolas launcher and a mate gourd in the cup holder. Replaces the Hover Bike with extra reach, a bonus against exposed gunners, and no methane requirement.',
  },
  chiva_rover: {
    id: 'chiva_rover', name: 'Chiva Rover', era: 1, class: 'mounted', cost: 40, strength: 15, moves: 4, vision: 3,
    tech: 'the_wheel', upgradesTo: 'knight', bonusVs: { city: -20 }, abilities: ['ignoreTerrain', 'moveAfterAttack'],
    uniqueTo: 'colombia', replaces: 'chariot', model: 'u_chariot', icon: 'mounted',
    description: 'A six-wheel rover painted in every color the survey drones could find, carrying twenty passengers, a speaker stack and one improbable goat. Replaces the Assault Rover; ignores terrain costs and needs no methane.',
  },
  andean_sentinel: {
    id: 'andean_sentinel', name: 'Andean Sentinel', era: 2, class: 'ranged', cost: 55, strength: 13, rangedStrength: 19, range: 2, moves: 2, vision: 3,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    uniqueTo: 'chile', replaces: 'crossbowman', model: 'u_crossbowman', icon: 'ranged',
    description: 'A high-altitude marksman trained under the clearest sky on the planet. Replaces the Coilgunner with extra vision and a stronger shot.',
  },
  boomerang_mortar: {
    id: 'boomerang_mortar', name: 'Boomerang Mortar', era: 1, class: 'siege', cost: 42, strength: 8, rangedStrength: 16, range: 2, moves: 2, vision: 3,
    tech: 'mathematics', upgradesTo: 'trebuchet', bonusVs: { city: 200 }, abilities: ['noMelee'],
    uniqueTo: 'australia', replaces: 'catapult', model: 'u_catapult', icon: 'siege',
    description: 'A mortar team that lobs a curved projectile which, on a miss, politely returns. Replaces the Mortar Team with a steadier shot and a wider view.',
  },
  springbok_scrum: {
    id: 'springbok_scrum', name: 'Springbok Scrum', era: 2, class: 'melee', cost: 62, strength: 22, moves: 3, vision: 2,
    tech: 'steel', upgradesTo: 'musketman', bonusVs: { city: 10 },
    uniqueTo: 'south_africa', replaces: 'man_at_arms', model: 'u_man_at_arms', icon: 'melee',
    description: 'Eight exo-armored players who move like one and tackle like a landslide. Replaces Exo-Troopers with a faster, hard-driving push; no Nickel-Iron requirement.',
  },
  medjay_sentry: {
    id: 'medjay_sentry', name: 'Medjay Sentry', era: 0, class: 'antiCavalry', cost: 27, strength: 13, moves: 2, vision: 3,
    tech: 'bronze_working', upgradesTo: 'pikeman', bonusVs: { mounted: 75 },
    uniqueTo: 'egypt', replaces: 'spearman', model: 'u_spearman', icon: 'antiCavalry',
    description: 'A patrol guard on a lookout post above the old delta, trained to see trouble early. Replaces the Breacher with a longer view and a solid answer to fast rovers.',
  },
  immortal_guard: {
    id: 'immortal_guard', name: 'Immortal Guard', era: 0, class: 'melee', cost: 28, strength: 13, moves: 2, vision: 2,
    tech: null, upgradesTo: 'swordsman', bonusVs: { melee: 15 },
    uniqueTo: 'iran', replaces: 'warrior', model: 'u_warrior', icon: 'melee',
    description: 'A standing guard whose count never drops: when one is rotated out, another steps up the same hour. Replaces the Militia with a sturdier line against close-quarters troops.',
  },
  karakoram_marksman: {
    id: 'karakoram_marksman', name: 'Karakoram Marksman', era: 0, class: 'ranged', cost: 30, strength: 6, rangedStrength: 10, range: 2, moves: 2, vision: 3,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee', 'ignoreTerrain'],
    uniqueTo: 'pakistan', replaces: 'archer', model: 'u_archer', icon: 'ranged',
    description: 'A high-altitude sniper who climbs a ridge before breakfast and shoots from it before lunch. Replaces the Slug Thrower with more vision and ridge-hopping legs.',
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
    description: 'Replaces the Med Bay: +3 {food}, +1 {cul}, +3 {happy}. This colony needs 20% less {food} to grow. Treatment is free at the airlock; the waiting room is a different story.',
  },
  sun_stone_chapel: {
    id: 'sun_stone_chapel', name: 'Sun Stone Chapel', era: 1, cost: 70, tech: 'calendar', yields: { cul: 3 }, happiness: 2, maintenance: 2,
    requires: 'shrine', uniqueTo: 'mexico', replaces: 'temple', model: 'bld_temple', pillar: 'arts', icon: 'temple',
    effects: {
      cityYield(ctx, a) {
        if (a.city.id === ctx.cityId) a.pct.cul += 10;
      },
    },
    description: 'Replaces the Memorial Chapel: +3 {cul}, +2 {happy}, +10% {cul}. A great carved calendar, a long table and a place set for the ones who did not make it.',
  },
  estancia: {
    id: 'estancia', name: 'Estancia', era: 2, cost: 90, tech: 'chivalry', yields: { food: 2, gold: 2 }, maintenance: 1,
    uniqueTo: 'argentina', replaces: 'stable', pillar: 'prosperity', icon: 'stable',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.improvement === 'pasture' && !a.tile.pillaged) a.yields.gold += 1;
      },
      cost(ctx, a) {
        if (a.currency !== 'prod' || a.item.kind !== 'unit' || a.city?.id !== ctx.cityId) return;
        if (ROVER_IDS[a.item.id]) a.cost = Math.round(a.cost * 0.75);
      },
    },
    description: 'Replaces the Rover Bay: +2 {food}, +2 {gold}. Mounted and armor units cost 25% less {prod} here; Bioreactors worked by this colony yield +1 {gold}. The grill is always on.',
  },
  cafeteria_exchange: {
    id: 'cafeteria_exchange', name: 'Cafetería Exchange', era: 1, cost: 75, tech: 'currency', yields: { gold: 2, sci: 2 }, pct: { gold: 20 }, happiness: 1, maintenance: 0,
    uniqueTo: 'colombia', replaces: 'market', model: 'bld_market', pillar: 'commerce', icon: 'market',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.resource === 'sugar') a.yields.gold += 2;
      },
    },
    description: 'Replaces the Exchange: +2 {gold}, +2 {sci}, +20% {gold}, +1 {happy}. Coffee Clones worked by this colony yield +2 {gold}. Every deal is struck over a cup, and every cup is struck over a deal.',
  },
  atacama_array: {
    id: 'atacama_array', name: 'Atacama Array', era: 3, cost: 170, tech: 'astronomy', yields: { sci: 4 }, pct: { sci: 25 }, maintenance: 2,
    uniqueTo: 'chile', replaces: 'observatory', model: 'bld_observatory', pillar: 'discovery', icon: 'observatory',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && (a.tile.terrain === 'desert' || a.tile.elevation === 'hills')) a.yields.sci += 1;
      },
    },
    description: 'Replaces the Deep Space Array: +4 {sci} and +25% {sci}. Dune Sea and Ridges worked by this colony yield +1 {sci}. A sky so clear the dishes have started to feel judged.',
  },
  shell_harbour: {
    id: 'shell_harbour', name: 'Shell Harbour', era: 2, cost: 110, tech: 'cartography', yields: { gold: 2, cul: 1 }, maintenance: 2,
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
    description: 'Replaces the Skiff Dock: +2 {gold}, +1 {cul}. Coastal. Water tiles worked by this colony yield +1 {food}; Regolith Silt, Orbital Debris and Hematite Blueberries +1 {prod}. The roof looks like sails and cost like a sunk ship.',
  },
  reef_foundry: {
    id: 'reef_foundry', name: 'Reef Foundry', era: 1, cost: 75, tech: 'iron_working', yields: { prod: 2, gold: 2 }, maintenance: 1,
    uniqueTo: 'south_africa', replaces: 'forge', pillar: 'glory', icon: 'forge',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.improvement === 'mine' && !a.tile.pillaged) a.yields.gold += 1;
      },
    },
    description: 'Replaces the Alloy Foundry: +2 {prod}, +2 {gold}. Regolith Mines worked by this colony yield +1 {gold}. The ore goes down deep, the credits come up deeper.',
  },
  house_of_life: {
    id: 'house_of_life', name: 'House of Life', era: 1, cost: 70, tech: 'writing', yields: { sci: 3, cul: 1 }, perPop: { sci: 0.25 }, maintenance: 1,
    uniqueTo: 'egypt', replaces: 'library', model: 'bld_library', pillar: 'discovery', icon: 'library',
    description: 'Replaces the Data Archive: +3 {sci}, +1 {cul}, +0.25 {sci} per colonist. Scribes copy everything twice and the backups are carved in stone.',
  },
  qanat_reclaimer: {
    id: 'qanat_reclaimer', name: 'Qanat Reclaimer', era: 2, cost: 110, tech: 'engineering', yields: { food: 3 }, happiness: 1, maintenance: 1,
    uniqueTo: 'iran', replaces: 'aqueduct', model: 'bld_aqueduct', pillar: 'prosperity', icon: 'aqueduct',
    effects: {
      growthThreshold(ctx, a) {
        if (a.city.id === ctx.cityId) a.value = Math.round(a.value * 0.75);
      },
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.terrain === 'desert') a.yields.food += 1;
      },
    },
    description: 'Replaces the Water Reclaimer: +3 {food}, +1 {happy}. This colony needs 25% less {food} to grow, and Dune Sea tiles it works yield +1 {food}. Water moves underground, unnoticed and unbothered.',
  },
  karakoram_ramparts: {
    id: 'karakoram_ramparts', name: 'Karakoram Ramparts', era: 0, cost: 50, tech: 'bronze_working', yields: {}, cityHp: 100, cityStrength: 10, maintenance: 1,
    uniqueTo: 'pakistan', replaces: 'walls', pillar: 'conquest', icon: 'walls',
    effects: {
      tileYield(ctx, a) {
        if (a.city?.id === ctx.cityId && a.tile.elevation === 'hills') a.yields.prod += 1;
      },
    },
    description: 'Replaces Blast Walls: +100 colony HP, +10 colony strength. Ridges worked by this colony yield +1 {prod}. Built into the mountainside, and painted in flowers so nobody takes it personally.',
  },
};
