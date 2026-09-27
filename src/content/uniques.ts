// OWNER: ContentRogue. Leader-unique units & buildings (spread into UNITS/BUILDINGS by ContentCiv).
// Literal defs only: units.ts/buildings.ts import this module at evaluation time, so nothing here may
// read UNITS/BUILDINGS while the module evaluates. Unique units reuse the replaced unit's model.
import type { BuildingDef, UnitDef } from '../sim/defs';

export const UNIQUE_UNITS: Record<string, UnitDef> = {
  steppe_rider: {
    id: 'steppe_rider', name: 'Steppe Rider', era: 0, class: 'mounted',
    cost: 32, strength: 13, moves: 5, vision: 3,
    tech: 'animal_husbandry', upgradesTo: 'knight',
    bonusVs: { city: -33 }, abilities: ['moveAfterAttack'],
    uniqueTo: 'varkhan', replaces: 'horseman',
    description: 'Varkhan horse-archer lord. Replaces the Horseman: +1 strength, +1 movement, +1 vision, needs no Horses. Moves after attacking; −33% vs cities.',
    model: 'u_horseman', icon: 'mounted',
  },
  thornwarden: {
    id: 'thornwarden', name: 'Thornwarden', era: 0, class: 'ranged',
    cost: 26, strength: 6, rangedStrength: 8, range: 2, moves: 2, vision: 3,
    tech: 'archery', upgradesTo: 'crossbowman',
    abilities: ['noMelee', 'ignoreTerrain'],
    uniqueTo: 'sylvaran', replaces: 'archer',
    description: 'Sylvaran grove sentinel. Replaces the Archer: +1 strength and ranged strength, +1 vision, moves through any terrain at 1 cost; +25% strength in forest or jungle.',
    model: 'u_archer', icon: 'ranged',
  },
  dune_chariot: {
    id: 'dune_chariot', name: 'Dune Chariot', era: 1, class: 'mounted',
    cost: 38, strength: 15, moves: 5, vision: 2,
    tech: 'the_wheel', resource: 'horses', upgradesTo: 'knight',
    bonusVs: { city: -33, ranged: 25 }, abilities: ['moveAfterAttack'],
    uniqueTo: 'ashkari', replaces: 'chariot',
    description: 'Ashkari sand-sled chariot. Replaces the Chariot: +1 strength, +1 movement, +25% vs ranged units, +20% strength on desert. Moves after attacking; −33% vs cities.',
    model: 'u_chariot', icon: 'mounted',
  },
  forgeguard: {
    id: 'forgeguard', name: 'Forgeguard', era: 1, class: 'melee',
    cost: 40, strength: 17, moves: 2, vision: 2,
    tech: 'iron_working', resource: 'iron', upgradesTo: 'man_at_arms',
    bonusVs: { city: 20 },
    uniqueTo: 'morvane', replaces: 'swordsman',
    description: 'Morvane iron-clad shock troop. Replaces the Swordsman: +3 strength, +20% vs cities; heals 10 extra HP when resting on hills.',
    model: 'u_swordsman', icon: 'melee',
  },
};

export const UNIQUE_BUILDINGS: Record<string, BuildingDef> = {
  sun_court: {
    id: 'sun_court', name: 'Sun Court', era: 1, cost: 70, tech: 'calendar',
    yields: { cul: 3, gold: 2 }, happiness: 3, maintenance: 2, requires: 'shrine',
    uniqueTo: 'aurelian', replaces: 'temple',
    model: 'bld_temple', pillar: 'glory', icon: 'temple',
    description: 'Aurelian gilded sanctum. Replaces the Temple: +3 {cul}, +2 {gold}, +3 {happy}. Requires a Shrine.',
  },
  tide_market: {
    id: 'tide_market', name: 'Tide Market', era: 2, cost: 110, tech: 'cartography',
    yields: { gold: 3 }, maintenance: 2, influence: 1, coastal: true,
    effects: {
      tileYield(ctx, a) {
        if (!a.city || a.city.id !== ctx.cityId) return;
        const t = a.tile.terrain;
        if (t !== 'coast' && t !== 'ocean' && t !== 'lake') return;
        a.yields.food += 1;
        a.yields.gold += 1;
        if (a.tile.resource === 'fish' || a.tile.resource === 'whales' || a.tile.resource === 'pearls') a.yields.prod += 1;
      },
    },
    uniqueTo: 'thalassan', replaces: 'harbor',
    model: 'bld_harbor', pillar: 'commerce', icon: 'harbor',
    description: 'Thalassan floating bazaar. Replaces the Harbor: +3 {gold}, +1 {influence} per chapter. Coastal. This city\'s water tiles +1 {food} and +1 {gold}; Fish, Whales and Pearls +1 {prod}.',
  },
  athenaeum: {
    id: 'athenaeum', name: 'Athenaeum', era: 1, cost: 70, tech: 'writing',
    yields: { sci: 3, cul: 1 }, perPop: { sci: 1 / 3 }, maintenance: 1,
    uniqueTo: 'kethran', replaces: 'library',
    model: 'bld_library', pillar: 'discovery', icon: 'library',
    description: 'Kethran star-archive. Replaces the Library: +3 {sci}, +1 {cul}, +1 {sci} per 3 pop.',
  },
  seers_spire: {
    id: 'seers_spire', name: "Seers' Spire", era: 1, cost: 85, tech: 'mathematics',
    yields: { cul: 3, sci: 2 }, happiness: 2, maintenance: 2, influence: 1,
    uniqueTo: 'celestine', replaces: 'amphitheater',
    model: 'bld_amphitheater', pillar: 'arts', icon: 'amphitheater',
    description: 'Celestine oracle tower. Replaces the Amphitheater: +3 {cul}, +2 {sci}, +2 {happy}, +1 {influence} per chapter.',
  },
};
